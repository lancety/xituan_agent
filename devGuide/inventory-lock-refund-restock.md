# 库存锁、退款与回填

Last updated: 2026-11-16

锁只表示客户付款前这张订单占了多少货。支付成功后锁删除，货算已售。已售要回到可售，只通过退货表 `merchant.order_item_returns`，订单行购买数量不改。放锁按锁上的购买模式。回填：零售回 `products`；团购或预定在 `end_date` 未到、未清仓、活动子行还在时回活动库存，否则回 `products` 主库存。没退满时订单停在退款前的履约状态，支付为 `partially_refunded`，商户可以继续把没退的货做到已送达。有未结算退款申请时订单停在 `PENDING`，不能改到处理中及之后。下表是最终方案。数量字段见 [inventory-stock-model-and-modes.md](./inventory-stock-model-and-modes.md)。

**支付列**

| 写法 | 包含 |
|---|---|
| 未付 | `pending`、`pending_capture`、`failed`、`cancelled`、`committed` |
| 已付 | `success`、`partially_refunded` |
| 已退清 | `refunded` |

**动作列**

| 写法 | 含义 |
|---|---|
| 放锁 | `releaseOrderStock`：按锁上的购买模式把可售加回，预留减少，删锁。只用于未付。不回主库存 |
| 结成已售 | `confirmStockOnPayment`：按锁上的购买模式，可售不变，预留和总量减少，删锁 |
| 回填 | 写入 `order_item_returns`，已售加回可售。零售回 `products`。团购回 `offer_products`、预定回 `products_preorderable`，仅当活动未过期、未清仓且子行还在；否则回 `products`。余量 = 购买数量 − 已退数量，超出则拒绝 |
| 整单回填 | 每一行退货数量 = 还没退过的购买数量 |
| 拒绝改状态 | 返回 `ORDER_NEEDS_REFUND`。这次取消、过期或删除不生效。不放锁，不回填。退钱改走退款 |

| 谁 | 订单状态 | 支付 | 操作 | 锁 | 退款 | 回填 | 正确做法 | 当前状况 | 需要做的修补 |
|---|---|---|---|---|---|---|---|---|---|
| 系统 | 未取消、未过期、未退款、未删除 | 未付 → 已付 | 支付成功 | 结成已售 | 无 | 不回填 | 按购买模式删锁，货算已售 | 已按锁上的模式结成已售 | 无 |
| 系统 | `CANCELLED` 或 `EXPIRED` | 付款晚到，记为已付 | 支付成功 | 不结成已售 | 转人工退款 | 不回填 | 不结成已售。记下付款，转人工退款 | 已跳过结成已售 | 无 |
| 系统 | `PENDING` | 未付，或 `pending_capture` 过了授权窗 | 超时过期 | 放锁 | 无 | 放锁即回到可售 | 按锁的模式放锁，订单改为 `EXPIRED` | 已放锁并标过期 | 无 |
| 系统 | `EXPIRED` | 未付 | 拉回 `PROCESSING` | 重新占用 | 无 | 不回填 | 按购买模式重新占用，订单改为 `PROCESSING` | 已重新占用 | 无 |
| 顾客 | `PENDING` | 未付 | 取消 | 放锁 | 无 | 放锁即回到可售 | 按锁的模式放锁，订单改为 `CANCELLED` | 已放锁并取消 | 无 |
| 顾客 | `PENDING` | 已付 | 取消 | 不再放锁 | 整单退款。钱马上退完：订单 `REFUNDED`，支付 `refunded`。只生成申请：订单保持 `PENDING` | 整单回填。申请未结算前不回填。活动未过期且未清仓回活动库存，否则回主库存 | 不改成已取消。整单退款并回填。钱未结清则保持 `PENDING` | 钱结清则订单已退款并回填。只建申请则保持待处理，退货行记在申请上，结算时回填 | 无 |
| 顾客 | `PROCESSING`、`READY_FOR_DELIVERY`、`SHIPPED`、`IN_DELIVERY`、`DELIVERED` | 已付 | 取消 | 不动 | 拒绝改状态 | 不回填 | 不取消。提示改由商户走退款 | 已拒绝 | 无 |
| 顾客 | `PENDING` | 未付 | 删除 | 锁还在则放锁 | 无 | 放锁即回到可售 | 按锁的模式放锁，订单改为 `DELETED` | 已放锁并删除 | 无 |
| 顾客 | `PENDING` 或 `PROCESSING` | 已付 | 删除 | 不动 | 拒绝改状态 | 不回填 | 不删除。先走退款 | 已付待处理和处理中都拒绝删除 | 无 |
| 顾客 | `CANCELLED` 或 `EXPIRED` | 未付 | 删除 | 锁还在则放锁 | 无 | 放锁即回到可售 | 锁还在就按模式放掉，订单改为 `DELETED` | 已尝试放锁再删除 | 无 |
| 商户 | 任意未终态 | 未付 | 改成 `CANCELLED` 或 `EXPIRED` | 放锁 | 无 | 放锁即回到可售 | 按锁的模式放锁，再改成目标状态 | 改状态成功后按锁的模式放锁 | 无 |
| 商户 | 任意 | 已付 | 改成 `CANCELLED`、`EXPIRED` 或 `DELETED`，或点取消 | 不放锁，也不再结成已售 | 拒绝改状态 | 不回填 | 不改状态。打开退款，选退货或仅退款 | 拒绝这次改状态，返回 `ORDER_NEEDS_REFUND` | 无 |
| 商户 | `PENDING` 或 `PROCESSING` | 已付 | 删除 | 不动 | 拒绝改状态 | 不回填 | 不删除。先走退款 | 与顾客删除同一入口，已付待处理和处理中都拒绝 | 无 |
| 商户 | 任意 | 已付 | 退款并退货 | 不动 | 退选中行的金额。退满整单：订单 `REFUNDED`，支付 `refunded`。未退满：订单停在原履约状态，支付 `partially_refunded`，可继续做到已送达 | 选中行回填。活动未过期且未清仓回活动库存，过期、已清仓或子行没了回主库存 | 退选中行的钱并按上面的落点回填。退满才把订单改为 `REFUNDED` | 已按活动是否仍开放选择回填落点 | 无 |
| 商户 | 任意 | 已付 | 仅退款 | 未发货且锁还在：拒绝。锁已删除：不动 | 退款金额。状态规则与上一行相同 | 不回填 | 未发货且锁还在则不许只退款。否则只退钱，不回填 | 未发货且锁还在已拒绝。否则只退钱 | 无 |
| 商户 | 任意 | 已付 | 把订单状态直接改成 `REFUNDED` | 不动 | 不算退款，拒绝 | 不回填 | 不改状态。改走退款 | 拒绝这次改状态，返回 `ORDER_NEEDS_REFUND` | 无 |

## 相关文档

- [inventory-stock-model-and-modes.md](./inventory-stock-model-and-modes.md)
- [post-deploy-ledger/entries/2026-06-order-terminal-status-inventory.md](./post-deploy-ledger/entries/2026-06-order-terminal-status-inventory.md)
- Skill：`.cursor/skills/inventory-lock-refund-restock/SKILL.md`
