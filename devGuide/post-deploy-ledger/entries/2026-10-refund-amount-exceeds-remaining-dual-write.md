# 退款超额：BusinessError code + legacy message 双写

Last updated: 2026-10-10

| Field | Value |
|-------|-------|
| **ID** | `refund-amount-exceeds-remaining-dual-write` |
| **Status** | `active` |
| **Deployed** | Phase 1 已落地（code + payload + dual-write `message`）；待生产发版确认 |
| **Pending** | Phase N：去掉 legacy `message` 双写（见下方 Post-deploy debt） |
| **Gate** | 微信商户面板 + Merchant App + CMS 退款路径均已按 `error.code`→i18n 发版并全量；旧包占比可接受 |
| **Created** | 2026-10-10 |

## Background

`payment-business.service.processRefund` 超额时曾 `throw new Error(中文)`；merchant-panel / CMS catch 只回 `message`，无 `eBusinessErrorCode`。客户端无法稳定 i18n。

## Phase 1（兼容旧端 — 已实施，增量）

**对旧逻辑零破坏约定：**

| 消费者 | 旧读法 | Phase 1 仍保证 |
|--------|--------|----------------|
| 微信商户面板旧包 | `error.message` | 同模板中文（`退款金额 ${n} 超过可退款金额…`） |
| CMS 旧页 | 顶层 `message` | 同上字符串 |
| 其它 `processRefund` 失败（非 BusinessError） | panel `error.message` / CMS 顶层 `message` | 信封与改前一致 |

**增量（新端）：**

- code：`REFUND_AMOUNT_EXCEEDS_REMAINING`
- payload：`refundAmountExceedsRemaining`
- 响应在保留上述 `message` 的同时附带完整 `errorData`（panel：`error` 内；CMS：顶层 `message` + `error`）

实现：`refund-amount-exceeds-remaining-response.util.ts`（`toPanelErrorBody` / `toCmsErrorBody`）。

## Phase N（Gate 后 — post-deploy todo）

Gate 满足后再做；**不要**与 Phase 1 同 PR。

### Post-deploy debt（待办）

- [ ] **Gate 确认**：微信商户面板 + Merchant + CMS 退款均已全量走 `code`→i18n；旧包占比可接受
- [ ] **Backend**：panel / CMS 退款 catch 对 BusinessError 改为仅 `toApiResponse()`（或等价），删除 `formatLegacyMessage` / dual-write
- [ ] **Backend**：可删除 `refund-amount-exceeds-remaining-response.util.ts`（若无其它引用）
- [ ] **文档**：更新 `cross-client-business-error-handling.md`；本 entry → `done`；registry 归档

## Checklist

### Pre-deploy

- [x] codebase enum/type/factory
- [x] backend service + dual-write controllers（旧 message 保留）
- [x] 四端 i18n + 新端展示走 code（本轮客户端补齐）
- [x] registry 本行

### Post-deploy debt

- [ ] Phase N 去掉 message 双写（见上列表）

## 相关

- [cross-client-business-error-handling.md](../cross-client-business-error-handling.md)
- [registry](../registry.md)
