# Order terminal status inventory handling

Last updated: 2026-06-18

| Field | Value |
|-------|-------|
| **ID** | `order-terminal-status-inventory` |
| **Status** | `planned` |
| **Deployed** | — |
| **Pending** | Phase 1 analysis → Phase 2 implementation |
| **Gate (Phase 2)** | 付款状态、库存锁状态、订单终态转换矩阵已确认；生产数据中 orphaned/offline pending stock locks 已盘点；退款与取消路径 smoke OK |
| **Created** | 2026-06-18 |

## Background

当前本次修复只处理 `EXPIRED -> PROCESSING`：恢复处理中前重新 reserve stock，库存不足时返回 `PRODUCT_STOCK_INSUFFICIENT`。

另一个独立风险是：通用状态转换服务 `OrderStatusService.transitionOrderStatus()` 目前转入 `CANCELLED` / `EXPIRED` / `REFUNDED` 时没有统一处理库存锁释放或确认。部分专用入口已经有库存处理，例如 `cancelByMerchant()` 会按付款状态选择 `confirmStockOnPayment()` 或 `releaseOrderStock()`，但通用状态服务只更新状态与状态历史。

## Phase map

| Phase | Scope | Deploy | Verify |
|-------|-------|--------|--------|
| **1** | 盘点所有订单终态转换入口、付款状态组合、库存锁状态；定义转入取消/过期/退款时应 release / confirm / no-op 的决策矩阵 | pending | 矩阵覆盖 CMS、WeChat merchant panel、cron、payment/refund handler、manual cancel |
| **2** | 按矩阵统一库存处理逻辑，避免通用状态服务绕过库存；必要时抽出单一库存状态转换 helper | pending | 未支付订单取消/过期释放锁；已支付订单不误还库存；退款路径不重复扣减或释放 |

## Post-deploy debt

### Phase 1 analysis

- [ ] 列出所有状态转换入口：`OrderStatusService.transitionOrderStatus()`、`OrderService.updateOrderStatusForAdmin()`、`cancelByMerchant()`、`InventoryCronService`、payment/refund handlers、WeChat merchant panel。
- [ ] 区分 `paymentStatus`: `pending` / `pending_capture` / `success` / `committed` / `refunded` / `partially_refunded`。
- [ ] 区分库存锁状态：存在 `ORDER_RESERVED`、已 `confirmStockOnPayment()` 清锁、已 `releaseOrderStock()` 清锁、历史 orphaned lock。
- [ ] 定义目标状态为 `CANCELLED`、`EXPIRED`、`REFUNDED`、`DELETED` 时的库存动作矩阵。
- [ ] 明确 `REFUNDED` 是否只应由 refund handler 驱动库存恢复，避免 admin status update 直接误释放。
- [ ] 盘点 `getStockOccupancyForAdmin()` 返回的 orphaned/offline pending 数据是否需要配套清理工具或人工 SOP。

### Phase 2 implementation

- [ ] 给通用状态服务接入矩阵决策后的库存处理，或改造所有调用方走单一库存安全入口。
- [ ] 确保已付款订单转取消/过期不会把已确认销售库存错误释放回可售库存。
- [ ] 确保未付款/待授权订单转取消/过期释放 `ORDER_RESERVED` lock。
- [ ] 确保退款路径只在真实退款结算后恢复库存，避免状态手动切换导致重复恢复。
- [ ] 补充单测/集成测试覆盖 paid-like、unpaid、pending_capture、orphaned lock 场景。
- [ ] Entry → `done`；registry archived。

## Technical notes

- 不要把 Phase 2 和当前 `EXPIRED -> PROCESSING` 恢复库存修复混在同一改动中。
- 库存动作应继续保持模式隔离：`REGULAR` 只动 `products`，`OFFER` 只动 `offer_products`，`PREORDER` 只动 `products_preorderable`。
- 错误响应应使用 `BusinessError` code，不要把中文 `Error.message` 作为 API contract。

## Links

- Current status service: `xituan_backend/src/domains/order/services/order-status.service.ts`
- Current inventory service: `xituan_backend/src/domains/inventory/services/inventory-management.service.ts`
- Admin occupancy check: `xituan_backend/src/domains/order/services/order.service.ts`
