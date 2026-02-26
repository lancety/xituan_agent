# user_member_merchants / user_client_merchants: Partitioning and Schema Placement

## Context

- **user_member_merchants**: which users are **members** of which merchant (staff/employees).
- **user_client_merchants**: which users are **clients** of which merchant.
- Both are one-to-many or many-to-many and will grow much larger than other platform tables.
- Query patterns:
  - By **merchant_id**: "list members/clients of this merchant" (CMS, admin).
  - By **user_id**: "which merchants can this user access?" (members), "which merchants is this user a client of?" (clients).

## Recommendation

### 1. Partition by merchant_id (same as other merchant tables)

- Use **HASH(merchant_id)** with **50 partitions**, consistent with `merchant.orders`, `merchant.categories`, etc.
- **By merchant_id**: partition pruning → one partition per query, best performance.
- **By user_id**: no partition pruning, but create an **index on (user_id)** on the partitioned table. PostgreSQL creates the index on each partition; a query by user_id becomes ~50 index lookups (one per partition), which is acceptable and much better than full table scan.

So: **partition by merchant_id**, and add **INDEX (user_id)** for user-centric queries.

### 2. Put both tables in merchant schema

- Move **user_member_merchants** and **user_client_merchants** into **merchant** schema (not platform).
- Reasons:
  - Same partition strategy as all other merchant-scoped data.
  - Backup/restore or archive by merchant naturally includes members and clients.
  - Conceptually they are "per-merchant association data" (who are this merchant’s members/clients); merchant schema already references `platform.users` (e.g. orders.user_id, carts.user_id).
- Partitioned tables in PostgreSQL typically **drop FK from the partition key column** to `platform.merchants` (as in existing migrations). Keep **FK from user_id to platform.users** (allowed).

### 3. Summary

| Decision | Choice | Note |
|----------|--------|------|
| Partition key | **merchant_id** | Aligns with existing 50 HASH partitions; best for "per merchant" queries. |
| Index for user_id queries | **INDEX (user_id)** | Enables efficient "which merchants for this user" without partition pruning. |
| Schema | **merchant** | Same as other partitioned tables; keeps platform schema for core identity only. |

## Implementation notes

- **Primary key**: must include partition key, e.g. `PRIMARY KEY (id, merchant_id)`.
- **UNIQUE**: must include partition key, e.g. `UNIQUE (merchant_id, user_id)` (order can be merchant_id first for locality).
- **user_member_merchants** (renamed from user_merchants): in platform had `UNIQUE(user_id)`. After migration to merchant schema and partitioning, table is partitioned by merchant_id; "default merchant" etc. still one row per user in app logic, stored in the partition of that merchant.
- **user_client_merchants**: if not yet applied, create directly in **merchant** schema as partitioned table; if already applied in platform, add a migration to move to merchant and partition (rename, create partitioned table, copy, indexes, drop old).

## Alternative considered: partition by user_id

- Would optimize "which merchants for this user" (partition pruning).
- Would make "list members/clients of this merchant" scan all partitions (no pruning).
- CMS/admin flows are usually "per merchant" (members list, clients list), so **merchant_id** as partition key is the better default; user_id index is enough for the other side.
