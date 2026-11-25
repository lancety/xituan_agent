# Post-Deploy Registry（巡检入口）

Last updated: 2026-11-25

**日常巡检：「检查 post-deploy」** — 打开本文件，活跃表行数应为 **0** 表示无待收尾部署债务。非 0 则点击 **Entry** 查看 Gate 与勾选清单。

**版本约定（以 git tag / release commit 为准）：**

- **Phase1 首次** = 该兼容层/新路径第一次进入统一发版的版本。
- Phase 1 的这个版本在各端都部署之后，就可以做 Phase N，不再另排「最早可清理」或「下一可执行」。
- 证据口径：backend / wechat / site / cms / app_* 的 `chore: release vX.Y.Z` tag。

---

## 活跃（Active）

### A. Phase 1 已进版 — 清理债务（版本已查）

<table style="width:100%;table-layout:fixed">
  <colgroup>
    <col style="width:28%" />
    <col style="width:8%" />
    <col style="width:10%" />
    <col style="width:46%" />
    <col style="width:8%" />
  </colgroup>
  <thead>
    <tr>
      <th>ID</th>
      <th style="white-space:nowrap">状态</th>
      <th style="white-space:nowrap">Phase1 首次</th>
      <th>证据摘要</th>
      <th style="white-space:nowrap">Entry</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>orders-reorder-preorder-retire</code></td>
      <td style="white-space:nowrap"><code>blocked</code></td>
      <td><code>4.3.0</code></td>
      <td>reorder preview@2026-11-07（backend/微信/Site）→<code>v4.3.0</code></td>
      <td><a href="./entries/2026-11-orders-reorder-preorder-retire.md">entry</a></td>
    </tr>
    <tr>
      <td><code>openim-attachment-multipart-retire</code></td>
      <td style="white-space:nowrap"><code>blocked</code></td>
      <td><code>4.3.0</code></td>
      <td>CMS/backend presign@11-14；微信/App@11-14～15→<code>v4.3.0</code></td>
      <td><a href="./entries/2026-11-openim-attachment-multipart-retire.md">entry</a></td>
    </tr>
    <tr>
      <td><code>openim-cdn-lane-util-cleanup</code></td>
      <td style="white-space:nowrap"><code>blocked</code></td>
      <td><code>4.3.0</code></td>
      <td>codebase <code>epOpenimCdnLane</code>@2026-11-14；4.2 submodule 无、4.3 有</td>
      <td><a href="./entries/2026-11-openim-cdn-lane-util-cleanup.md">entry</a></td>
    </tr>
    <tr>
      <td><code>product-storage-type-columns</code></td>
      <td style="white-space:nowrap"><code>blocked</code></td>
      <td><code>3.9.2</code></td>
      <td>migrations <code>0348/0349</code>@→<code>v3.9.2</code>。剩下停双写，并用属性弃用处理 <code>storeType</code> / <code>storageDay</code>；不清理 jsonb；打印模板已改</td>
      <td><a href="./entries/2026-08-product-storage-type-columns.md">entry</a></td>
    </tr>
    <tr>
      <td><code>order-activity-scopes</code></td>
      <td style="white-space:nowrap"><code>blocked</code></td>
      <td><code>3.8.0</code></td>
      <td>scopes@2026-06-07→<code>v3.8.0</code>；前端早已只靠 scopes；仍 dual-write 旧列</td>
      <td><a href="./entries/2026-06-order-activity-scopes.md">entry</a></td>
    </tr>
    <tr>
      <td><code>multipart-image-upload-retire</code></td>
      <td style="white-space:nowrap"><code>blocked</code></td>
      <td>直传域 <code>4.3.0</code></td>
      <td>剩余业务图改 path 并删 multer</td>
      <td><a href="./entries/2026-11-multipart-image-upload-retire.md">entry</a></td>
    </tr>
    <tr>
      <td><code>platform-metadata-drop-cms-site-print-vis</code></td>
      <td style="white-space:nowrap"><code>blocked</code></td>
      <td>刷列 <code>4.3.0</code></td>
      <td>去三轴 UI 并 DROP 三列</td>
      <td><a href="./entries/2026-11-platform-metadata-drop-cms-site-print-vis.md">entry</a></td>
    </tr>
    <tr>
      <td><code>summary-payment-from-revenues</code></td>
      <td style="white-space:nowrap"><code>blocked</code></td>
      <td>派生已落地</td>
      <td>停双写并 DROP 三列；<code>countPaidSummaries</code> 仍读 <code>isPaid</code></td>
      <td><a href="./entries/2026-10-summary-payment-from-revenues.md">entry</a></td>
    </tr>
  </tbody>
</table>

### B. Phase 1 未齐 / 未定版 — 先落地再标清理版

| ID | 状态 | Phase1 | 备注 | Entry |
|----|------|--------|------|-------|
| `wechat-c-order-item-list-section` | `planned` | 未落地 | 2026-11-16 仍在用。Phase 1 未在各端部署前不做 Phase N | [entry](./entries/2026-06-wechat-c-order-item-list-section.md) |
| `sih-format-allowlist-webp-png` | `planned` | N/A | 老 jpg（主要是聊天图）是否还留 SIH jpeg | [entry](./entries/2026-09-sih-format-allowlist-webp-png.md) |

---

## 已归档（Done / Cancelled）

| ID | 状态 | 完成日 | Entry | 备注 |
|----|------|--------|-------|------|
| `metadata-rebind-provenance-batch` | `done` | 2026-11-25 | [entry](./entries/2026-09-metadata-rebind-provenance-batch.md) | Phase N 清洗取消：无 id 的历史 `UNBIND_COPY` 保留；带 id 的同一来源副本由再绑删除 |
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
