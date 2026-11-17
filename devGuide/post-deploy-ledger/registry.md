# Post-Deploy Registry（巡检入口）

Last updated: 2026-11-17

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
| `orders-reorder-preorder-retire` | `blocked` | `4.3.0` | `≥4.4.0` | `≥4.4.0` | reorder preview@2026-11-07（backend/微信/Site）→`v4.3.0` | [entry](./entries/2026-11-orders-reorder-preorder-retire.md) |
| `openim-attachment-multipart-retire` | `blocked` | `4.3.0` | `≥4.4.0` | `≥4.4.0` | CMS/backend presign@11-14；微信/App@11-14～15→`v4.3.0` | [entry](./entries/2026-11-openim-attachment-multipart-retire.md) |
| `openim-cdn-lane-util-cleanup` | `blocked` | `4.3.0` | `≥4.4.0` | `≥4.4.0` | codebase `epOpenimCdnLane`@2026-11-14；4.2 submodule 无、4.3 有 | [entry](./entries/2026-11-openim-cdn-lane-util-cleanup.md) |
| `product-storage-type-columns` | `blocked` | `3.9.2` | `TBD`（退役 schema 同批） | `TBD` | migrations `0348/0349`@→`v3.9.2`；CMS metadata 三项仍保留 | [entry](./entries/2026-08-product-storage-type-columns.md) |
| `order-activity-scopes` | `blocked` | `3.8.0` | `TBD`（停 dual-write 后下一版） | `TBD` | scopes@2026-06-07→`v3.8.0`；旧列 dual-write 仍在 | [entry](./entries/2026-06-order-activity-scopes.md) |
| `metadata-rebind-provenance-batch` | `blocked` | `4.0.0` | 数据清洗（非纯版本） | 抽查后排期 | migration `0363`→`v4.0.0` | [entry](./entries/2026-09-metadata-rebind-provenance-batch.md) |
| `multipart-image-upload-retire` | `blocked` | 直传域 `4.3.0` | `4.4.0` | `4.4.0` | 4.4 剩余业务图改 path 并删 multer | [entry](./entries/2026-11-multipart-image-upload-retire.md) |
| `platform-metadata-drop-cms-site-print-vis` | `blocked` | 刷列 `4.3.0` | `4.4.0` | `4.4.0` | 4.4 去三轴 UI 并 DROP 三列 | [entry](./entries/2026-11-platform-metadata-drop-cms-site-print-vis.md) |
| `summary-payment-from-revenues` | `blocked` | 派生已落地 | `4.4.0` | `4.4.0` | 4.4 停双写并 DROP 三列；`countPaidSummaries` 仍读 `isPaid` | [entry](./entries/2026-10-summary-payment-from-revenues.md) |

### B. Phase 1 未齐 / 未定版 — 先落地再标清理版

| ID | 状态 | Phase1 | 可清理 | 备注 | Entry |
|----|------|--------|--------|------|-------|
| `wechat-c-order-item-list-section` | `planned` | 未落地 | 未定 | 2026-11-16 仍在用，不能 4.4 删 | [entry](./entries/2026-06-wechat-c-order-item-list-section.md) |
| `sih-format-allowlist-webp-png` | `planned` | N/A | 以后再决定 | 老 jpg（主要是聊天图）是否还留 SIH jpeg | [entry](./entries/2026-09-sih-format-allowlist-webp-png.md) |

---

## 已归档（Done / Cancelled）

| ID | 状态 | 完成日 | Entry | 备注 |
|----|------|--------|-------|------|
| `order-terminal-status-inventory` | `done` | 2026-11-17 | [entry](./entries/2026-06-order-terminal-status-inventory.md) | 随 4.4.0 上线；无 Phase N（非兼容层清理） |
| `ledger-intake-manual-ledger-block-id` | `done` | 2026-11-16 | [entry](./entries/2026-10-ledger-intake-manual-ledger-block-id.md) | 新建已写 `ledger_block_id`；绑定不写；删块预览与税锁已在 |
| `non-same-day-wechat-compat` | `done` | 2026-11-15 | [entry](./entries/2026-08-non-same-day-wechat-compat.md) | Phase N：去掉 `allowNonSameDay`；超距离统一非当日路径 |
| `shipping-service-pp-exp-alias` | `done` | 2026-11-15 | [entry](./entries/2026-09-shipping-service-pp-exp-alias.md) | Phase N：删 compat 夹 + 入站 PP/EXP 别名 / legacy_short 出站 |
| `merchant-panel-mixed-activities-retire` | `done` | 2026-11-15 | [entry](./entries/2026-10-merchant-panel-mixed-activities-retire.md) | Phase N：删混合 `GET /activities` + `listActivities` + WeChat `getActivities` |
| `wechat-account-link-legacy-autoregister` | `done` | 2026-11-15 | [entry](./entries/2026-10-wechat-account-link-legacy-autoregister.md) | Phase N：三通道未命中一律 NEED_LINK；Platform 已 `accountLinkFlow` |
| `cms-merchant-panel-shipping-refund` | `done` | 2026-11-08 | [entry](./entries/2026-07-cms-merchant-panel-shipping-refund.md) | CMS/WeChat 退运费两入口已上线；关台账 |
| `contact-name-server-gate` | `done` | 2026-11-08 | [entry](./entries/2026-11-contact-name-server-gate.md) | WeChat 全量后开回 `ENFORCE_CONTACT_NAME_ON_SERVER`；随 backend 发版生效 |
| `refund-amount-exceeds-remaining-dual-write` | `done` | 2026-11-08 | [entry](./entries/2026-10-refund-amount-exceeds-remaining-dual-write.md) | Phase N：删 dual-write util，退款 catch 仅 `toApiResponse()` |
| `merchant-customer-pii-restriction` | `done` | 2026-11-08 | [entry](./entries/2026-08-merchant-customer-pii-restriction.md) | 邮箱/账户 PII 收尾；履约手机中间号 → planned `delivery-phone-merchant-mask` |
