# Redis / Valkey 开发指南（xituan backend）

Last updated: 2026-05-24

本文描述 **ElastiCache Serverless Valkey → Valkey 节点 → Redis 节点（仅当需要高级模块时）** 的长期基础设施规划、应用架构与迁移注意事项。

相关文档：

- [current-state.md](./current-state.md) — 缓存 / ETag / LRU **现状（as-is）**
- [../README.md](../README.md) — Redis & Search 总览
- [../../backend-protection-layers-and-scale-notes.md](../../backend-protection-layers-and-scale-notes.md) — WAF、公网暴露、PgBouncer、RDS 扩容
- [../../aws-setup/DATABASE-OPTIMIZATION-GUIDE.md](../../aws-setup/DATABASE-OPTIMIZATION-GUIDE.md) — RDS 连接数预算
- `xituan_backend/src/shared/cache/` — `ICacheAdapter`（当前为内存实现）
- Agent skill：`.cursor/skills/redis-valkey-backend/SKILL.md`

---

## 1. 长期基础设施路线

| 阶段 | AWS 选型 | 何时升级 | 应用代码变更 |
|------|----------|----------|--------------|
| **P0（当前）** | **Serverless Valkey** | 全局限速 + 短 TTL 缓存；约 100–1000 MAU | 一次性引入共享 client + adapter |
| **P1** | **Valkey 节点** `cache.t4g.micro`（可选副本） | QPS 稳定、账单可预期，或 Serverless ECPU 升高 | **仅 env + 连接池参数** |
| **P2** | 更大 Valkey 节点 / 只读副本 | micro 内存或 CPU 吃紧 | AWS 控制台改规格 |
| **P3** | **Redis OSS 节点** | 仅当需要 **Redis 专有模块**（RediSearch、RedisJSON、Stack 等） | **模块相关代码** + 换 endpoint；核心 KV/限速不变 |

**原则：** 把 Valkey/Redis 当作 **RESP 上的远程 KV**。业务 domain **不要** 按「Serverless vs 节点」或「Valkey vs Redis」分支，除非某模块明确依赖 Redis Stack。

### 费用量级（ap-southeast-2，以限速 workload 为例）

| 部署方式 | 约 100 活跃 / 月 | 约 1000 活跃 / 月 |
|----------|------------------|-------------------|
| Serverless Valkey | ~USD 6–7 | ~USD 7–9 |
| Valkey `t4g.micro` 节点 | ~USD 14（固定） | ~USD 14（固定） |
| Serverless Redis OSS | ~USD 15–25+（最低 1 GB） | 小流量不推荐 |
| Valkey vs Redis 节点 | Valkey 约便宜 20% | 同上 |

WAF 仍是第一道防线；Redis 负责 **跨 ECS** 的限速与缓存，**不能替代** WAF。

---

## 2. Valkey vs Redis — 何时代码必须区分

### Valkey 足够（xituan 规划内全部场景）

- 限速：`INCR`、`EXPIRE`、`TTL`；必要时 sorted set 滑动窗口
- 短 TTL 缓存：`GET`、`SET`、`SETEX`、`DEL`
- 分布式锁：`SET key value NX EX`
- 小批量原子操作：pipeline / `MULTI`
- Node 客户端：**`ioredis`**（Valkey 与 Redis 共用）

### 需要 Redis OSS / Stack（**不要** 假设 Valkey 有）

- **RediSearch**、**RedisJSON**、**RedisTimeSeries**、**RedisGraph**（旧）
- 尚未移植到 Valkey 的 Redis 8+ 专有特性
- 合规/合同要求必须使用 Redis® 商标引擎

Redis 专有能力放在 **独立 domain 模块**（如 `domains/search/`），不要写进通用 cache/限速 util。

---

## 3. 应用架构（强制约定）

### 3.1 单一连接模块

所有 Redis 访问经同一模块（规划路径）：

```text
xituan_backend/src/shared/redis/redis-client.util.ts
```

职责：

- 从 env 懒连接
- ElastiCache 使用 TLS（`rediss://`）
- 每个 ECS task 小连接池
- 提供 `isRedisConfigured()` / `getRedis()`，调用方先检查
- domain service / controller 内 **禁止** `new Redis()`

### 3.2 缓存：沿用 `ICacheAdapter`

现有契约（`shared/cache/cache-adapter.type.ts`）：

- `get`、`set`（可选 `ttlMs`）、`delete`
- 新增 `RedisCacheAdapter` 实现同一接口
- `getDefaultCache()`：有 `REDIS_URL` 用 Redis adapter，否则内存（本地开发）

domain 代码（如 `merchant-setting.service.ts`）继续只调 `getDefaultCache()` — **不 import 引擎类型**。

### 3.3 限速中间件

规划路径：

```text
xituan_backend/src/shared/middleware/rate-limit.middleware.ts
xituan_backend/src/shared/redis/rate-limit.redis.util.ts
```

- 在 `app.ts` 靠前挂载（`trust proxy` 之后、重路由之前）
- 计数 key 经 Redis 在 ECS 任务间共享
- 超限返回 **429** + `Retry-After`
- 敏感路径与 WAF `RateLimit-Sensitive` 规则对齐（纵深防御）
- Redis 不可用：**fail open**（打 warn，依赖 WAF）；后续可对 auth 路径改为 fail closed

### 3.4 Key 命名规范

统一前缀，冒号分段，不含空格。

```text
xituan:{env}:{purpose}:{scope}:{id}
```

示例：

| Key | 用途 |
|-----|------|
| `xituan:prod:rl:ip:{ipHash}` | 全站 IP 窗口 |
| `xituan:prod:rl:user:{userId}` | 单用户 API 配额 |
| `xituan:prod:rl:merchant:{merchantId}` | CMS 商户配额 |
| `xituan:prod:cache:merchant-settings:{merchantId}` | 热设置缓存 |
| `xituan:prod:cache:jwt-deny:{jti}` | 可选：吊销 token（短 TTL） |

不宜存明文 IP 时，用稳定哈希（如 SHA256 截断）。

### 3.5 环境变量

写在部署 secrets / ECS task 定义中（仓库根 `.env` 仅本地，AI 工具不可见）：

| 变量 | 是否必填 | 说明 |
|------|----------|------|
| `REDIS_URL` | 生产限速/共享缓存 | `rediss://:password@host:6379` 或 ElastiCache TLS URL |
| `REDIS_ENABLED` | 可选 | 本地显式关闭；未设则根据 `REDIS_URL` 推断 |
| `REDIS_CONNECT_TIMEOUT_MS` | 可选 | 默认 3000 |
| `REDIS_MAX_RETRIES_PER_REQUEST` | 可选 | 宜低（1–2），控制延迟 |
| `REDIS_KEY_PREFIX` | 可选 | 默认 `xituan:{NODE_ENV}` |

业务逻辑 **不要** 增加 `IS_SERVERLESS`、`IS_VALKEY`、`IS_REDIS` 等分支 flag。

### 3.6 依赖

实现时添加：

```bash
npm install ioredis
npm install -D @types/ioredis   # 视 TS 版本需要
```

`package.json` 锁定主版本；提交 lockfile。

---

## 4. 基础设施切换清单（无需重写 domain）

### 4.1 Serverless Valkey → Valkey 节点

| 步骤 | 负责 |
|------|------|
| 创建 ElastiCache Valkey 复制组（可先单节点） | AWS |
| 与 ECS 同 VPC/子网；SG：ECS SG → Redis 6379 | AWS |
| 更新 ECS `REDIS_URL` 为主 endpoint | 部署 |
| 调 `ioredis` 的 `maxRetriesPerRequest`、连接数（节点比 Serverless 更能扛连接） | 仅配置 |
| 冒烟：health、登录、一条限速路径 | QA |
| 观察期后下线 Serverless | AWS |

**预期代码 diff：** 业务逻辑零改动；仅 env + 连接池常量。

### 4.2 Valkey 节点 → 更大规格 / 加副本

| 步骤 | 负责 |
|------|------|
| 控制台升节点规格或加只读副本 | AWS |
| 若缓存读走副本，client util 可选第二 URL `REDIS_READ_URL` | 代码（可选；限速不必） |
| key  schema / 中间件不变 | — |

### 4.3 Valkey → Redis OSS 节点（仅高级功能）

| 步骤 | 负责 |
|------|------|
| 确认功能 **必须** Redis 模块且 Valkey 不支持 | 产品/工程 |
| 开通 Redis 节点 / 启用模块 | AWS |
| 更换 `REDIS_URL` | 部署 |
| 回归：限速 + 全部 `ICacheAdapter` 路径 | QA |
| 在独立 domain 目录实现模块 API | 代码（新范围） |

核心 `INCR` / `SETEX` 路径不变。

---

## 5. 连接与连接池

### Serverless Valkey

- **每个 ECS task 一个共享 `ioredis` 实例**（不要 per-request）
- 避免 autoscaling 后数百并发连接
- 命令宜短；单 HTTP 请求多 op 时用 pipeline
- 启用 TLS（`rediss://`）

### Valkey / Redis 节点

- 同样「每 task 单 client」
- 可适当调高 `family: 4` / keepalive
- 有副本时：**限速必须写主库**；只读缓存若可接受短暂滞后可读副本

### 本地开发

- **无 `REDIS_URL`：** 内存 cache + 跳过 Redis 限速（本地无 WAF）
- 可选：Docker `valkey/valkey:8` 监听 `localhost:6379` 做集成测试

---

## 6. 安全

- Redis 放 **私有子网**；SG 仅允许 ECS SG
- 必须 **AUTH token**（ElastiCache ACL / auth token）
- 传输加密 TLS（`rediss://`）
- 禁止日志打印含 PII 或 token 的 key 值
- 限速 key 优先用哈希 IP /  opaque id

---

## 7. 可观测性

- 限速拦截打 `warn` 日志：path + key 类型（敏感时不打完整 key）
- CloudWatch：ElastiCache `CurrConnections`、`Evictions`、`EngineCPUUtilization`
- 应用指标：`rate_limit_429_total`（可选，后续接 Prometheus/CloudWatch agent）

---

## 8. 测试

| 层级 | 做法 |
|------|------|
| 单元 | Mock `ICacheAdapter`；mock redis util 测中间件 |
| 集成 | Testcontainers 或本地 Valkey；验证 INCR/TTL |
| 预发 | 指向 staging ElastiCache；敏感路径压测低于 WAF 阈值 |

---

## 9. 实现顺序（建议 ticket）

1. **REDIS-1：** `redis-client.util.ts` + env 接线 + 启动 health 日志
2. **REDIS-2：** `RedisCacheAdapter` + 接入 `getDefaultCache()`
3. **REDIS-3：** 全局限速中间件（IP + 鉴权后可选 userId）
4. **REDIS-4：** `password-reset.service.ts` 内存 Map 迁到共享 redis rate util
5. **REDIS-5：** 热点缓存（商户设置 / metadata schema）— 见 `todo/metadata-schema-etag-redis-l2.md`

第五层「少打 DB」（分页上限、JWT 快速 401）单独推进 — 见 [backend-protection-layers-and-scale-notes.md](../../backend-protection-layers-and-scale-notes.md) §6。

---

## 10. 反模式（禁止）

- 在多个 domain 散落 `ioredis` import
- 未经评审在 Redis 存大对象（>100 KB）
- 把 Redis 当主数据库
- 在共享 util 硬编码引擎专有命令且无能力检测
- **多 ECS task** 生产环境仍用进程内 Map 做限速
- Redis 宕机时未经产品决策就全站阻断流量

---

## 11. AWS 创建要点

ElastiCache Serverless Valkey（控制台）：

- Region：`ap-southeast-2`
- Engine：**Valkey**
- Mode：Serverless
- VPC：与 ECS 相同；私有 subnet group
- Security group：6379 仅来自 `xituan-ecs-sg-production`

后续 CloudFormation 模板放 `xituan_agent/aws-setup/`，并在 `parameters.production.example.json` 登记 — 遵循现有 stack 编号约定。

---

## 12. 目标文件结构（快速参考）

```text
xituan_backend/src/shared/redis/
  redis-client.util.ts          # connection singleton
  rate-limit.redis.util.ts      # INCR/TTL helpers
  redis-key.redis.util.ts       # key builders (optional)

xituan_backend/src/shared/cache/
  cache-adapter.type.ts           # existing
  in-memory-cache.adapter.ts      # existing
  redis-cache.adapter.ts          # new

xituan_backend/src/shared/middleware/
  rate-limit.middleware.ts      # Express middleware
```

上述文件尚未落地前，新增代码须遵循本指南，**不要** 另起一套并行模式。
