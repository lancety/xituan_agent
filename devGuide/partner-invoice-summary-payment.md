# 结算单付款状态（由收入派生）

Last updated: 2026-10-30

**部署尾项:** [post-deploy entry](./post-deploy-ledger/entries/2026-10-summary-payment-from-revenues.md)

## 真相源

结算单是否已付、已付多少、到款日，以 `revenues` 为准：

- `source_type = partner_invoice_summary`
- `source_id = 结算单 UUID`（历史脏数据可能为 `summary_code`，读侧兼容）
- 仅非退款行计入

| API 字段 | 派生 |
|----------|------|
| `totalPaid` | `sum(total_amount)` |
| `isPaid` | `totalPaid >= totalAmount - totalLoss` |
| `paidDate` | 付清时取相关收入最晚 `revenue_date` |

工具：`xituan_codebase/utils/partner-invoice-summary-payment.util.ts`  
批量挂载：`RevenueService.applyDerivedPaymentToSummaries`

## 写入

- **确认收款**：只创建收入，再 dual-write 三列（Phase 1，供旧 SQL/计数）；读路径不依赖列。
- **流水建账并选结算单**：只建收入；列表/详情打开时自动显示已付。
- **`PUT .../status`**：已拒绝（不可只翻 `isPaid`）。

## Phase N

DROP `total_paid` / `is_paid` / `paid_date` — 见 post-deploy Gate。

## 相关

- [收入/支出幂等](./revenue-expense-idempotency/README.md)（结算单确认收款不做 source 1:1）
