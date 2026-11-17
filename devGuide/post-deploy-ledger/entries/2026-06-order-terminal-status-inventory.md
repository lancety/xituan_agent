# Order terminal status inventory handling

Last updated: 2026-11-17

| Field | Value |
|-------|-------|
| **ID** | `order-terminal-status-inventory` |
| **Status** | `done` |
| **Phase1 版本** | `4.4.0`（随统一发版上线） |
| **可清理版本** | N/A — **无 Phase N**：行为改动一次上线，无 dual-write / 删兼容层 / DROP |
| **Deployed** | 排入 `4.4.0`；本条按「无需后续清理」于 2026-11-17 归档 |
| **Pending** | — |
| **Gate (Phase 2)** | 已实现：未付取消/过期放锁；已付不能改成取消/删除；退款按行退货再标退款状态 |
| **Created** | 2026-06-18 |

## 为何无 Phase N

本项是库存锁 / 退款回填的**行为对齐**（`ORDER_NEEDS_REFUND`、`REFUND_ONLY_WHILE_RESERVED`、退款退货行），不是先加兼容层再删字段或旧路由。全端随 `4.4.0` 同发即可，**没有**待 Gate 后的清理债务。

组合表仍见：[inventory-lock-refund-restock.md](../../inventory-lock-refund-restock.md)。

## Phase map（回顾）

| Phase | Scope | 结果 |
|-------|-------|------|
| **1** | 盘点入口与付款/锁组合；定矩阵 | 已定稿 |
| **2** | 未付放锁；已付拒裸改终态；顾客已付 pending 取消走退款；按行退货回填 | 代码 + 客户端提示已落地；集成测试 47 项通过 |

## Post-deploy debt

### Phase 1 analysis

- [x] 状态转换入口与付款/锁组合盘点（见上表与实现）
- [x] 已定：未付 → `CANCELLED`/`EXPIRED` 放锁；已付禁止 `CANCELLED`/`EXPIRED`/`DELETED`，走退款按行退货
- [x] 还库存只发生在退款的退货行；手动改 `REFUNDED` 不入库

### Phase 2 implementation

- [x] 通用状态服务 / 调用方库存处理
- [x] 未付放锁；已付拒绝并提示退款
- [x] 支付成功后顾客取消：退款 + 回填路径
- [x] 退款按行；全额才标订单 `REFUNDED`
- [x] 单测 / 集成：`order-item-return` + `inventory-outcome.api`（2026-11-17 再跑 47 通过）
- [x] Entry → `done`；registry 归档

## Links

- Status: `xituan_backend/src/domains/order/services/order-status.service.ts`
- Inventory: `xituan_backend/src/domains/inventory/services/inventory-management.service.ts`
- Returns: `xituan_backend/src/domains/order/services/order-item-return.service.ts`
- Cursor plan → `.cursor/plans_completed/库存退款回填_72183848.plan.md`
