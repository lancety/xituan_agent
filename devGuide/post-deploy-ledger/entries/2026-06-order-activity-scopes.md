# Order activity scopes (migrate seq from orders header)

Last updated: 2026-11-22

| Field | Value |
|-------|-------|
| **ID** | `order-activity-scopes` |
| **Status** | `blocked` |
| **Phase1 首次进版** | `v3.8.0`（scopes@2026-06-07） |
| **最早可清理** | `≥4.4.0` |
| **下一可执行** | `≥4.4.0` |
| **Deployed** | Phase 1 自 3.8；生产早已走 scopes；旧列仍 dual-write（兼容债） |
| **Pending** | 4.4：停 dual-write → DROP `orders.mode_activity_*` → 去 `iOrder` 旧字段 |
| **Gate (Phase 3)** | 开发确认：前端已无仅依赖 `orders.mode_activity_*` 的旧路径；4.4 统一发版时清理 |
| **Created** | 2026-06-07 |

## Background

Move `orders.mode_activity_id` / `mode_activity_seq_number` to `merchant.order_activity_scopes`. Enable multi-preorder-promote combined checkout with unified seq allocation. Phase 1 is additive + dual-write; Phase 3 drops legacy columns.

2026-11-22：确认新方案已长期全量执行，仅剩同步写旧列；无旧格式前端依赖 → 排入 **4.4.0** 与其它 blocked 项同批清理。

## Phase map

| Phase | Scope | Deploy | Verify |
|-------|-------|--------|--------|
| **1** | Migration 0332: `order_activity_scopes`, `allocate_unified_mode_activity_seq`, backfill; backend dual-write + scope-first read | done（自 3.8） | scopes 为权威；头字段仅 dual-write |
| **3** | Migration：DROP `orders.mode_activity_id`, `mode_activity_seq_number`, related index；remove dual-write + header fallback | **≥4.4.0** | Gate：无旧前端依赖 |

## Post-deploy debt

### Phase 1 prod confirm

- [x] Migration `1710000000332_order_activity_scopes.sql` on prod（自 3.8）
- [x] 新方案长期全量；头字段仅 dual-write（2026-11-22 确认）
- [x] Entry → `blocked`；registry 排入 `≥4.4.0`

### Phase 3 cleanup（≥4.4.0）

- [ ] Migration DROP legacy columns（`migrations/` 下一数字序号）
- [ ] Remove dual-write and orders-column fallback in backend（含 `orderActivityScopeUtil` legacy pick）
- [ ] Remove `modeActivityId` / `modeActivitySeqNumber` from `iOrder`（codebase sync）
- [ ] Entry → `done`；registry archived

## Links

- Plan: `order_activity_scopes` refactor (Cursor plan)
- Migration Phase 1: `xituan_backend/migrations_stable/1710000000332_order_activity_scopes.sql`
