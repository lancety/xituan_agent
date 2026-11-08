# 退款超额：BusinessError code + legacy message 双写

Last updated: 2026-11-08

| Field | Value |
|-------|-------|
| **ID** | `refund-amount-exceeds-remaining-dual-write` |
| **Status** | `done` |
| **Deployed** | Phase 1 双写已落地；Phase N 已去掉 dual-write（待生产发版） |
| **Pending** | — |
| **Gate** | 微信商户面板 + Merchant App + CMS 退款路径均已按 `error.code`→i18n ✅ |
| **Created** | 2026-10-10 |
| **Completed** | 2026-11-08 |

## Background

`payment-business.service.processRefund` 超额时曾 `throw new Error(中文)`；merchant-panel / CMS catch 只回 `message`，无 `eBusinessErrorCode`。客户端无法稳定 i18n。

## Phase 1（兼容旧端 — 已完成）

**增量（新端）：** code `REFUND_AMOUNT_EXCEEDS_REMAINING` + payload `refundAmountExceedsRemaining`，同时 dual-write 历史中文 `message`。

实现曾位于：`refund-amount-exceeds-remaining-response.util.ts`（已删除）。

## Phase N（Gate 后 — 已完成 2026-11-08）

- [x] **Gate 确认**：各端退款均走 `code`→i18n（开发者确认收尾）
- [x] **Backend**：panel / CMS 退款 catch 对 BusinessError 改为仅 `toApiResponse()`
- [x] **Backend**：删除 `refund-amount-exceeds-remaining-response.util.ts`
- [x] **文档**：更新 `cross-client-business-error-handling.md`；本 entry → `done`；registry 归档

## 相关

- [cross-client-business-error-handling.md](../cross-client-business-error-handling.md)
- [registry](../registry.md)
