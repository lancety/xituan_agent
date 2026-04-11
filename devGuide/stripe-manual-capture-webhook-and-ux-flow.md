# 延后扣款（Manual / Deferred Capture）与 Webhook、前端行为

本文说明 Stripe（Connect manual capture）与团购 OFFER 场景下 Airwallex 延后 capture 时，**订单支付状态**、**进 processing 前扣款**、**Webhook** 与消费者端表现如何对齐。

## 1. 支付状态语义（`orders.payment_status`）

| 值 | 含义 |
|----|------|
| `committed` | **线下承诺**（现金、转账等），非「在线已授权待扣款」。 |
| `pending_capture` | **在线已授权**，PSP 侧尚未完成 capture（Stripe manual capture；或 OFFER+Airwallex 延后批量扣款路径）。 |
| `success` | 支付已结算/成功（含 capture 完成后的终态）。 |

历史数据：迁移脚本 `migrations/1710000000269_orders_payment_status_pending_capture_backfill.sql` 将误标为 `committed`、实为在线延后的订单保守回填为 `pending_capture`。

## 2. Webhook → 订单支付状态

处理「授权成功、尚未 capture」的 Webhook 分支时（`payment.handler.service` 中 deferred 逻辑）：

- Stripe manual capture，或
- **OFFER** 且 Airwallex

将订单 `payment_status` 更新为 **`pending_capture`**（不再使用 `committed` 表示在线授权）。

### 2.1 Stripe：`charge.succeeded`（manual capture）

在 Connect + manual capture 下，客户授权后 Stripe 常发送 **`charge.succeeded`**，且 Charge 上 **`captured: false`**、`amount_captured: 0`（仅授权，未扣款）。历史上仅处理 `payment_intent.*` 时该事件会进 **未匹配表**；`payment_intent.created` 也无状态映射，不会写支付记录。

`webhook-stripe-payment.service` 现已将 **`charge.succeeded` / `charge.updated`（且已 capture）** 标准化：`captured === false` → 支付记录 **PENDING** + 订单 **`pending_capture`**；`captured === true` → **SETTLED**（与自动扣款或 capture 完成一致）。金额解析在 `amount_received === 0` 时回退使用 Charge 的 **`amount`**（授权全额，单位分），避免写成 0 元。

## 3. 进入 `processing` 之前统一 Capture

**原则**：先对 PSP 执行 capture（或幂等成功），再提交「订单状态 → processing」的事务及后续副作用。

- `OrderStatusService.transitionOrderStatus`：在开启 DB 事务**前**调用 `OrderManualCaptureService.runDeferredCaptureBeforeProcessing`（目标状态为 `processing` 且当前非 `processing` 时）。
- 管理端 `OrderService.updateOrderStatusForAdmin`：`pending` → `processing` 同样在保存前执行上述前置 capture。
- **团购批量**：`OfferBatchCaptureService` 在 offer 开始时间到达后，对符合条件的 OFFER 订单调用 `transitionOrderStatus(..., transitionType: SYSTEM, reason: offer_cron_after_start)`，由同一套前置逻辑完成 capture。

Stripe 已 capture 的错误码/文案按 **幂等成功** 处理，不阻断流程。

## 4. 失败与监控

- Capture 失败：写入一条 `order_payment_records` 状态为 `failed` 的子记录（带原因），并记录告警 **`DEFERRED_CAPTURE_FAILED`**；抛出业务错误，**不**进入 `processing`。
- `payment_status === pending_capture` 但找不到可扣款的在线 PSP 未终态记录：告警 **`DEFERRED_CAPTURE_MISSING_AUTH`** 并失败。

CMS / Platform 监控页需展示上述告警类型中文标签（已与 `epOrderPaymentAlertType` 对齐）。

## 5. 取消 / 过期

订单从 `pending` 或 `processing` 变为 `cancelled` / `expired` 时，`OrderManualCaptureService.afterOrderStatusTransition` 对未终态的 Stripe/Airwallex 意图执行 **cancel**（与 REGULAR/PREORDER/OFFER 模式约定一致）。

### 5.1 `pending_capture` 自动过期（库存定时任务 + `OrderExpiryService`）

与团购 manual capture 共用 **`psp_checkout.offerManualCaptureMaxAdvanceHours`**（迁移 `1710000000272_...`，默认 **120** 小时 ≈ 原 5 天，范围 1–2160）：该 **N 小时** 用于「开团前 N 小时起可在线付」，以及 **首授 + N 小时** 的 capture 侧时间锚点。运行时仍兼容读取旧键 `offerManualCaptureMaxAdvanceDays`（按天 ×24 换算）。

先算出两个**绝对时刻**（比日历时刻，不比「时长谁长」）：

- **A** 订单待付规则截止：`created_at + 模式待付分钟`
- **B** 授权 + N 小时：`首条 Stripe/Airwallex、status=pending 的 PAYMENT 记录 created_at + N 小时`；无记录时锚点为 `created_at`

已授权、待商户 capture 的订单**不应**在 **B** 之前按「未支付」过早过期：  
**有效过期时刻** = **`max(A, B)`**（PostgreSQL `GREATEST` / TS `Math.max`）。即：若 A 早于 B（如特价 30 分钟规则早于首授+120 小时），以 **B** 为准延长；若 A 晚于 B（长待付窗口且客户在末期才授权），以 **A** 为准照常过期。

`InventoryCronService` 与 `OrderExpiryService` 使用同一套规则。

## 6. 消费者端 UX

- **站点**（`PaymentPageClient`）：轮询订单状态时，将 `pending_capture`（及兼容旧数据 `committed`）视为「支付流程可结束」，跳转订单详情。
- **站点订单详情**（`order-pay-expiry-display.util`）：`pending_capture` **不**计算「付款截止时间 / 剩余不足 24 小时」类提示（已授权，等待商户处理扣款，不再催促付款）。
- **微信小程序**（`payment-polling.util`）：与站点一致，`success` / `pending_capture` / `committed` 停止轮询并视为成功跳转。
- 订单列表卡片、CMS 订单列表等：为 `pending_capture` 提供独立文案（如「授权待扣款」），与线下「承诺支付」区分。

## 7. 状态转换审计

状态迁移记录使用 `iStatusTransitionRequest.transitionType`：人工操作为 `manual`（默认），定时任务为 `system`（如团购 cron），便于区分来源。

---

*实现入口（后端）*：`order-manual-capture.service.ts`、`order-status.service.ts`、`offer-batch-capture.service.ts`、`payment.handler.service.ts`。
