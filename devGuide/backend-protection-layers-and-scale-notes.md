# Backend protection layers & DB scale notes

Last updated: 2026-05-24

Companion to WAF setup on `xituan-backend-production`. Covers network exposure checks, app-layer Redis rate limiting, PgBouncer, RDS parameter scaling, read-replica timing, and a **separate ticket backlog** for “reduce DB work per request”.

Related: `aws-setup/DATABASE-OPTIMIZATION-GUIDE.md`, `aws-setup/03_security-groups.yaml`, `aws-setup/02_alb.yaml`, `aws-setup/CAPACITY-ANALYSIS.md`.

---

## 1. Is the API “exposed to the public internet”?

### Intended production shape (from CloudFormation)

| Component | Public? | How traffic enters |
|-----------|---------|-------------------|
| **ALB** | Yes (by design) | `internet-facing`, SG allows `0.0.0.0/0` on **80/443** |
| **WAF** | On ALB | Filters before traffic hits ECS |
| **ECS (3050)** | **No direct public** | SG ingress **only from ALB SG** (`03_security-groups.yaml`) |
| **RDS (5432)** | **No** | SG ingress **only from ECS SG** |

So: **`backend.xituan.com.au` is meant to be public via ALB + WAF**. ECS tasks and RDS must **not** be reachable from the internet on 3050/5432.

### Console checklist (production)

1. **EC2 → Security Groups**
   - `xituan-ecs-sg-production`: Inbound **3050** source = **ALB security group only** (not `0.0.0.0/0`).
   - `xituan-rds-sg-production`: Inbound **5432** source = **ECS SG only**.
   - `xituan-alb-sg-production`: Inbound **443/80** from `0.0.0.0/0` (expected).

2. **EC2 → Load Balancers → xituan-alb-production**
   - Scheme = **internet-facing**.
   - Listeners: **443** (and maybe 80 → redirect).
   - **WAF** tab: Web ACL associated.

3. **ECS → Clusters → Service → Networking**
   - Tasks in **private subnets** (no public IP on tasks), **or** if public IP exists, SG must still block 3050 from internet (SG is authoritative).

4. **RDS → Databases**
   - **Publicly accessible = No**.
   - VPC security group = RDS SG above.

5. **Sanity test from laptop** (replace hostnames):
   - `curl -I https://backend.xituan.com.au/api/health` → **200** (expected).
   - Direct task IP `:3050` or RDS endpoint `:5432` from internet → **must fail** (timeout / refused).

### CLI examples (ap-southeast-2)

```bash
# ALB scheme
aws elbv2 describe-load-balancers --names xituan-alb-production \
  --query 'LoadBalancers[0].Scheme'

# ECS SG ingress (look for 3050 — should reference ALB SG, not 0.0.0.0/0)
aws ec2 describe-security-groups --filters "Name=group-name,Values=xituan-ecs-sg-production" \
  --query 'SecurityGroups[0].IpPermissions'

# RDS publicly accessible
aws rds describe-db-instances --query 'DBInstances[?DBInstanceIdentifier==`xituan-db-production`].PubliclyAccessible'
```

### What “bad” looks like

- ECS SG: `3050` from `0.0.0.0/0` → **API bypasses ALB/WAF**.
- RDS: `Publicly accessible = Yes` or `5432` from `0.0.0.0/0` → **database on the internet**.
- Orphan EC2 / old task with public IP + open SG.

---

## 2. Application layer: Redis + backend rate limiting

**Role:** WAF limits by **IP / path** at the edge. Redis limits by **IP / userId / merchantId** inside **all ECS tasks** with **shared counters**.

| Layer | Multi-ECS shared state? | Typical keys |
|-------|------------------------|--------------|
| WAF | N/A (edge) | IP, URI |
| In-process `Map` (e.g. password-reset today) | **No** — per task only | email/IP |
| **Redis (ElastiCache)** | **Yes** | `rl:ip:…`, `rl:user:…`, `rl:path:…` |

**Yes:** Redis is for **cross-task** rate limit + optional short-lived auth/JWT cache. It **complements** WAF, does not replace it.

Suggested rollout (when implementing):

1. Express middleware early in `app.ts` (after `trust proxy`, before heavy routes).
2. ElastiCache Redis in same VPC; ECS SG egress to Redis SG.
3. 429 + `Retry-After`; log metric `rate_limit_exceeded`.
4. Stricter limits on same sensitive paths as WAF `RateLimit-Sensitive` (defense in depth for stolen JWT / same-IP many users).

---

## 3. PgBouncer — what it is and why

### Problem without pooler

```
3 ECS tasks × 12 TypeORM connections = 36+ TCP sessions to PostgreSQL
Under spike: each request may wait for pool slot; slow queries hold connections
RDS max_connections and RAM become the hard ceiling
```

Each PostgreSQL backend connection costs memory (~10–15 MB on small instances). TypeORM pool `max: 12` per task is **client-side**; PostgreSQL still sees **one server connection per checked-out client connection**.

### PgBouncer sits in the middle

```
ECS (many app connections) → PgBouncer (small pool) → PostgreSQL (few server connections)
```

- **Transaction pooling** (recommended for TypeORM/Node): server connection returned to pool after each **transaction**, not after client disconnect.
- App opens many “logical” connections; PgBouncer multiplexes them onto **N** real PG connections (e.g. 20–40).
- Queued waiters wait at PgBouncer instead of spawning unlimited PG backends.

### What it does **not** do

- Does not replace query optimization or read replicas.
- Transaction pooling: avoid **session-level** features across transactions (temp tables, `SET`, some prepared statement patterns) — TypeORM default usage is usually fine; test before prod.

### Alternatives (AWS-native)

| Option | Notes |
|--------|--------|
| **PgBouncer** on small EC2 / sidecar | Cheap, full control; ops overhead |
| **RDS Proxy** | Managed, IAM auth, failover; extra cost |
| **Lower app `extra.max`** only | Helps but does not multiplex like PgBouncer |

**When to add:** RDS `DatabaseConnections` routinely > ~70% of safe limit, or connection wait errors during traffic spikes — see §4 scaling table.

---

## 4. RDS parameters — upgrade / scale cheat sheet

**Reconcile on every RDS instance class change** (see `DATABASE-OPTIMIZATION-GUIDE.md`).

Current app pool (`database.config.ts`): `extra.max: 12`, `min: 3`, `idleTimeoutMillis: 30000`, `connectionTimeoutMillis: 2000`.

### Connection budget

| ECS tasks | App pool max/task | App-side max TCP | Target PG backends (with PgBouncer) | Without PgBouncer (direct) |
|-----------|-------------------|------------------|--------------------------------------|----------------------------|
| 1 | 12 | 12 | 15–25 | ≤ 25 |
| 3 | 12 | 36 | 20–40 | ≤ 40–50 |
| 5 | 12 | 60 | 30–50 | **Risk on db.t3.micro** |

Rule of thumb for **db.t3.micro** (~1 GB RAM): treat **~50–60** as practical `max_connections` ceiling; leave headroom for admin/autovacuum.

### Parameter group settings to set/review

Apply via RDS **Parameter group**; adjust when upgrading instance class.

| Parameter | Suggested start (small prod) | Purpose | Revisit when |
|-----------|------------------------------|---------|------------|
| `max_connections` | 80–100 (micro), 150+ (small+) | Hard connection cap | Instance RAM ↑ |
| `statement_timeout` | `15000` (15s) ms | Kill runaway queries | Report queries need longer → async jobs |
| `idle_in_transaction_session_timeout` | `60000` (60s) ms | Free stuck transactions | — |
| `log_min_duration_statement` | `1000` ms (or use PI) | Slow query visibility | Noise vs signal |
| `shared_buffers` | AWS default for class | Buffer cache | Large instance upgrade |
| `random_page_cost` | 1.1 (SSD default often OK) | Planner hints | — |

### TypeORM pool (per ECS task) — keep aligned

When RDS class changes, update **both**:

- `xituan_backend/src/shared/infrastructure/database.config.ts` (`extra.max`, `connectionTimeoutMillis`)
- This doc + `CAPACITY-ANALYSIS.md` connection table

Example after move to **db.t3.small** and **5 ECS tasks**: consider PgBouncer before raising `extra.max` above 12.

---

## 5. Read replica — when (future)

**Defer until** read-heavy CMS/report traffic or primary CPU/connections saturate **after** index + cache + PgBouncer.

| Signal | Action |
|--------|--------|
| Primary CPU > 70% sustained, mostly **SELECT** | Consider replica |
| Dashboard/export queries block OLTP | Route read-only repos to replica |
| Still connection-bound | PgBouncer / RDS Proxy **before** replica |

Implementation notes (when ticketed):

1. Create RDS Read Replica (same region).
2. Second TypeORM `DataSource` or read routing in repositories for explicit read-only paths.
3. **Never** route writes or read-your-writes-critical paths to replica (cart, checkout, auth).
4. Update `parameters.production.json` / `04_rds.yaml`; document replica endpoint in secrets/env.
5. Cost: ~50–100% of primary instance — see `DATABASE-OPTIMIZATION-GUIDE.md` cost section.

---

## 6. Ticket backlog — “reduce DB cost per request” (Layer 5)

**Separate analysis ticket(s)** — not part of WAF/Redis/PgBouncer rollout. Goal: audit codebase and fix hotspots.

| ID | Topic | Acceptance idea |
|----|--------|-----------------|
| L5-1 | **Auth fast-fail** | Invalid/expired JWT returns 401 without DB hit; optional Redis `jwt:revoked` / session cache |
| L5-2 | **Pagination caps** | Global max `pageSize` (50/100) on list APIs; reject or clamp `99999` |
| L5-3 | **N+1 / heavy joins** | Profile top 10 CMS + site list endpoints; fix relations / add indexes |
| L5-4 | **Large reports async** | Tax/dashboard/export → job queue + poll/download |
| L5-5 | **Hot read cache** | Wire `cache-adapter` to Redis for merchant settings, metadata schema, public homepage |
| L5-6 | **Connection budget split** | Optional: webhook/cron ECS service with smaller pool so PSP bursts do not starve API pool |

Track in issue tracker; link PRs back to this section.

---

## 7. Current protection stack (reference)

```
Internet → ALB (443) → WAF → ECS:3050 → (future: PgBouncer) → RDS:5432
                ↑              ↑              ↑
           only public    RateLimit +     private SG
           API entry      managed rules   Redis RL (planned)
```

WAF rules (2026-05): IP reputation, Core/known-bad (Count→Block), `/api` rate limit, `RateLimit-Sensitive` (auth/token/payment/partner paths).

Frontend: CMS/Site OpenIM `ensureMessagingSession` single-flight + 3s backoff (prevents self-DDoS).

**Redis / Valkey application layer:** see `devGuide/redis_search/redis/valkey-development.md` and skill `.cursor/skills/redis-valkey-backend/SKILL.md`.
