# 手续费记账口径（Stripe + OmiPay）

Last updated: 2026-10-29

> 与 **GST plan**（注册日 / 生效日切齐）完全分开。本文只描述通道费与营业额口径。

## 总览

| 通道 | 已收款 / 营业额 | 通道费支出 | 历史 |
|------|-----------------|------------|------|
| Stripe | 货款 `chargedAmount`（不是 合计−fee） | `payment_processing` 支出，绑订单 | **不做**历史回填（当前无数据） |
| OmiPay | 货款 `chargedAmount`；顾客费不进营业额 | **不建**支出（顾客费仅 metadata） | data-repair job，**不进** schema migrations |

## Stripe

1. Webhook 结算抽出 `balance_transaction.fee`；若 BT 仅为 id → retrieve（短重试）再落库  
2. `PspFeeExpenseService` 幂等建支出：`source_type=payment_record` + `source_id=支付记录 id`，`order_id` 可绑订单  
3. 取 fee / 建支出失败 → webhook **FAILED**，走现有 replay（勿吞掉标 PROCESSED）  
4. GST：未注册 → gst=0、net=total；已注册 → 价内拆（`/11`）  
5. **订单退款不冲销**；CMS 通道费支出只读（禁改/删/冲销）  
6. `payout.paid` / `payout.updated(status=paid)` 且 fee>0 → 账户级支出：`source_type=stripe_payout`

**勿与流水分类 `PLATFORM_PAYOUT` 混记同一笔**。

## OmiPay

- 新单：webhook 已收款 = `chargedAmount`；PSP 实付进 `metadata.omipayPspPaidAmount`
- 历史：`npm run migrate:script:data-repair` → `omipay-customer-fee-turnover`（只修支付已收款 + 收入 `total`；**不碰 gst/net**）
- 商户手续费：暂不自动记支出

## 相关代码

- Migration：`0391`（`order_id` additive）→ 查重 → `0392`（source unique）
- `PspFeeExpenseService`、`WebhookStripePaymentService`
- data-repair：`xituan_backend/scripts/data-repair/`

## 相关文档

- GST 切齐：`docs/gst/TASK-2-gst-effective-date-cutover.md`（不含手续费）
- Cursor plan：`stripe_fee_auto_expense`
