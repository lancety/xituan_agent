# Post-Deploy Registry（巡检入口）

Last updated: 2026-11-15

**日常巡检：「检查 post-deploy」** — 打开本文件，活跃表行数应为 **0** 表示无待收尾部署债务。非 0 则点击 **Entry** 查看 Gate 与勾选清单。

**版本约定（agent 全端同版本同时发；以 git tag / release commit 为准）：**  
- **Phase1** = 该兼容层/新路径 **首次进入统一发版** 的版本（查 commit → `merge-base --is-ancestor` → 最早 tag）  
- **最早可清理** = Phase1 全量后的 **下一统一版本**（历史最早可开清的点；逾期未做则债务仍挂）  
- **下一可执行** = 现在若要动手，通常仍排在 **当前全量确认后的下一版**（现全端 **4.3.0** → 多为 **≥4.4.0**）  
- 证据口径：backend / wechat / site / cms / app_* 的 `chore: release vX.Y.Z` tag

---

## 活跃（Active）

### A. Phase 1 已进版 — 清理债务（版本已查）

| ID | 状态 | Phase1 首次 | 最早可清理 | 下一可执行 | 证据摘要 | Entry |
|----|------|-------------|------------|------------|----------|-------|
| `non-same-day-wechat-compat` | `blocked` | backend `3.9.3`；客户端 AusPost 结账 Gate=`3.11.0` | `≥3.12.0` | `≥4.4.0` | backend `allowNonSameDay`@2026-08-15→`v3.9.3`；微信 `AUSPOST_PP` 结账@2026-09-01→`v3.11.0` | [entry](./entries/2026-08-non-same-day-wechat-compat.md) |
| `shipping-service-pp-exp-alias` | `blocked` | `3.11.0` | `≥3.12.0` | `≥4.4.0` | backend compat + 微信长名@2026-09-01→`v3.11.0`（原 Gate 亦写 3.11） | [entry](./entries/2026-09-shipping-service-pp-exp-alias.md) |
| `merchant-panel-mixed-activities-retire` | `blocked` | `4.0.0` | `≥4.1.0` | `≥4.4.0` | 微信 home 改 `getOffersList`@2026-10-07→`v4.0.0` | [entry](./entries/2026-10-merchant-panel-mixed-activities-retire.md) |
| `wechat-account-link-legacy-autoregister` | `blocked` | 主端`4.1.0`；全端已`≥4.2.0` | `≥4.2.0`（已满足） | Platform 本次发版后即可 Phase N | 开发者确认全端 4.2.0+；Platform 补齐后清 legacy | [entry](./entries/2026-10-wechat-account-link-legacy-autoregister.md) |
| `orders-reorder-preorder-retire` | `blocked` | `4.3.0` | `≥4.4.0` | `≥4.4.0` | reorder preview@2026-11-07（backend/微信/Site）→`v4.3.0` | [entry](./entries/2026-11-orders-reorder-preorder-retire.md) |
| `openim-attachment-multipart-retire` | `blocked` | `4.3.0` | `≥4.4.0` | `≥4.4.0` | CMS/backend presign@11-14；微信/App@11-14～15→`v4.3.0` | [entry](./entries/2026-11-openim-attachment-multipart-retire.md) |
| `openim-cdn-lane-util-cleanup` | `blocked` | `4.3.0` | `≥4.4.0` | `≥4.4.0` | codebase `epOpenimCdnLane`@2026-11-14；4.2 submodule 无、4.3 有 | [entry](./entries/2026-11-openim-cdn-lane-util-cleanup.md) |
| `product-storage-type-columns` | `blocked` | `3.9.2` | `TBD`（退役 schema 同批） | `TBD` | migrations `0348/0349`@→`v3.9.2`；CMS metadata 三项仍保留 | [entry](./entries/2026-08-product-storage-type-columns.md) |
| `order-activity-scopes` | `blocked` | `3.8.0` | `TBD`（停 dual-write 后下一版） | `TBD` | scopes@2026-06-07→`v3.8.0`；旧列 dual-write 仍在 | [entry](./entries/2026-06-order-activity-scopes.md) |
| `metadata-rebind-provenance-batch` | `blocked` | `4.0.0` | 数据清洗（非纯版本） | 抽查后排期 | migration `0363`→`v4.0.0` | [entry](./entries/2026-09-metadata-rebind-provenance-batch.md) |

### B. Phase 1 未齐 / 未定版 — 先落地再标清理版

| ID | 状态 | Phase1 | 可清理 | 备注 | Entry |
|----|------|--------|--------|------|-------|
| `multipart-image-upload-retire` | `planned` | 直传域自 `4.3.0` 起；**业务图未全切** | `≥Phase1齐+1` | `direct-upload`@2026-11-13→`v4.3.0`；multer 仍大量保留 | [entry](./entries/2026-11-multipart-image-upload-retire.md) |
| `platform-metadata-drop-cms-site-print-vis` | `planned` | migration `0404`∈`4.3.0`；**UI Phase1 未收完** | `≥UI-Phase1+1` | 刷列恒 true 已进 4.3；表单三轴仍在 | [entry](./entries/2026-11-platform-metadata-drop-cms-site-print-vis.md) |
| `summary-payment-from-revenues` | `planned` | `TBD`（未落地） | `≥Phase1+1` | 未见收入派生 Phase 1 commit | [entry](./entries/2026-10-summary-payment-from-revenues.md) |
| `ledger-intake-manual-ledger-block-id` | `planned` | `TBD` | 无 Phase N | 生产确认后关台账 | [entry](./entries/2026-10-ledger-intake-manual-ledger-block-id.md) |
| `user-address-last-used-delivery` | `planned` | 未落地 | `≥Phase1+1` | 全仓无 `last_used_delivery` 实现 | [entry](./entries/2026-06-user-address-last-used-delivery.md) |
| `wechat-c-order-item-list-section` | `planned` | 未落地 | `≥Phase1+1` | C 端仍内联 `order-line-display` | [entry](./entries/2026-06-wechat-c-order-item-list-section.md) |
| `profile-error-copy-i18n` | `planned` | 未落地 | `≥Phase1+1` | codebase 仍有中文 `PROFILE_ERROR_COPY` | [entry](./entries/2026-06-profile-error-copy-i18n.md) |
| `sih-format-allowlist-webp-png` | `planned` | N/A | C4 回填后 | 非纯版本 Gate | [entry](./entries/2026-09-sih-format-allowlist-webp-png.md) |
| `order-terminal-status-inventory` | `planned` | 盘点 | N/A | 非兼容层清理 | [entry](./entries/2026-06-order-terminal-status-inventory.md) |

---

## 已归档（Done / Cancelled）

| ID | 状态 | 完成日 | Entry | 备注 |
|----|------|--------|-------|------|
| `cms-merchant-panel-shipping-refund` | `done` | 2026-11-08 | [entry](./entries/2026-07-cms-merchant-panel-shipping-refund.md) | CMS/WeChat 退运费两入口已上线；关台账 |
| `contact-name-server-gate` | `done` | 2026-11-08 | [entry](./entries/2026-11-contact-name-server-gate.md) | WeChat 全量后开回 `ENFORCE_CONTACT_NAME_ON_SERVER`；随 backend 发版生效 |
| `refund-amount-exceeds-remaining-dual-write` | `done` | 2026-11-08 | [entry](./entries/2026-10-refund-amount-exceeds-remaining-dual-write.md) | Phase N：删 dual-write util，退款 catch 仅 `toApiResponse()` |
| `merchant-customer-pii-restriction` | `done` | 2026-11-08 | [entry](./entries/2026-08-merchant-customer-pii-restriction.md) | 邮箱/账户 PII 收尾；履约手机中间号 → planned `delivery-phone-merchant-mask` |
