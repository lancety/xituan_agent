# Order activity scopes (migrate seq from orders header)

Last updated: 2026-06-07

| Field | Value |
|-------|-------|
| **ID** | `order-activity-scopes` |
| **Status** | `planned` |
| **Deployed** | — |
| **Pending** | Phase 1 → Phase 3 |
| **Gate (Phase 3)** | Phase 1 prod confirmed; backend reads/writes scopes only (no dual-write/fallback to `orders.mode_activity_*`); CMS + merchant panel + user order detail smoke OK |
| **Created** | 2026-06-07 |

## Background

Move `orders.mode_activity_id` / `mode_activity_seq_number` to `merchant.order_activity_scopes`. Enable multi-preorder-promote combined checkout with unified seq allocation. Phase 1 is additive + dual-write; Phase 3 drops legacy columns.

## Phase map

| Phase | Scope | Deploy | Verify |
|-------|-------|--------|--------|
| **1** | Migration 0332: `order_activity_scopes`, `allocate_unified_mode_activity_seq`, backfill; backend dual-write + scope-first read | pending | New orders have scope rows; activity API still returns `modeActivitySeqNumber` |
| **3** | Migration 0333: DROP `orders.mode_activity_id`, `mode_activity_seq_number`, index; remove dual-write | pending | Gate only |

## Post-deploy debt

### Phase 1 prod confirm

- [ ] Migration `1710000000332_order_activity_scopes.sql` on prod
- [ ] Single-promote order: 1 scope row + orders dual-write match
- [ ] Multi-promote combined order: N scope rows, same seq, CMS lists agree
- [ ] CMS / WeChat merchant panel seq badge + map sort
- [ ] Site / WeChat user order detail seq display
- [ ] Entry → `active` or `blocked`; registry updated

### Phase 3 cleanup (after Gate)

- [ ] Migration DROP legacy columns (next index after 0332)
- [ ] Remove dual-write and orders-column fallback in backend
- [ ] Remove `modeActivityId` / `modeActivitySeqNumber` from `iOrder` (codebase sync)
- [ ] Entry → `done`; registry archived

## Links

- Plan: `order_activity_scopes` refactor (Cursor plan)
- Migration: `xituan_backend/migrations/1710000000332_order_activity_scopes.sql`
