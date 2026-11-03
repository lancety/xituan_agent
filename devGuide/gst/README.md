# GST（商户注册与生效日）

Last updated: 2026-10-30

| 文档 | 用途 |
|------|------|
| [gst-effective-date-cutover.md](./gst-effective-date-cutover.md) | **生效日 D 切齐**运维/实施说明书（权威） |
| [planned-work entry](../planned-work/entries/2026-10-gst-effective-date-cutover.md) | 规划台账：等 ATO 确认 D 后再做 |

未定稿调研仍可参考 `xituan_agent/docs/gst/`（TASK-2 等）；**D 切齐以本目录为准**，docs 内旧文应链到此处。

## 两回事（勿混）

| | 纠错（WP-0 / FY 起） | 生效日切齐（本文） |
|--|---------------------|-------------------|
| 触发 | 未注册却写入了 gst/net | ATO 确认生效日 **D** |
| 窗口 | ≥2025-07-01 且 &lt; D（或至今） | **≥ D** |
| 结果 | gst=0、net=total | 按已注册价内拆 gst/net；票/PDF 按注册态 |

手续费 / OmiPay 已收款订正 → Cursor plan `stripe_fee_auto_expense`，**不**与本切齐混跑。
