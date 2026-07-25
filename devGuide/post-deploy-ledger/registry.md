# Post-Deploy Registry（巡检入口）

Last updated: 2026-07-25

**日常巡检：「检查 post-deploy」** — 打开本文件，活跃表行数应为 **0** 表示无待收尾部署债务。非 0 则点击 **Entry** 查看 Gate 与勾选清单。

---

## 活跃（Active）

| ID | 状态 | 已部署 | 待完成 | Gate 摘要 | 下一动作 | Entry | Last updated |
|----|------|--------|--------|-----------|----------|-------|--------------|
| `user-address-last-used-delivery` | `planned` | — | Phase 1 + Phase 3 | WeChat 新版本全量后再 DROP `is_default` | 实施 Phase 1 后改 `blocked` | [entry](./entries/2026-06-user-address-last-used-delivery.md) | 2026-06-02 |
| `order-activity-scopes` | `planned` | — | Phase 1 + Phase 3 | Phase 1 prod OK; no dual-write/fallback before DROP | 实施 Phase 1 后改 `active` | [entry](./entries/2026-06-order-activity-scopes.md) | 2026-06-07 |
| `wechat-c-order-item-list-section` | `planned` | — | Phase 1 + Phase 2 | WeChat 含 Phase 1 版本全量后再删 trade 内联列表与冗余组件 | 实施 Phase 1：6 页改用主包 `order-item-list-section` | [entry](./entries/2026-06-wechat-c-order-item-list-section.md) | 2026-06-16 |
| `profile-error-copy-i18n` | `planned` | — | Phase 1 + Phase 2 | 所有 frontend consumer 已改用 enum/code + i18n；`xituan_codebase` 无内嵌中文 copy | 实施 Phase 1：新增 enum/code 并补齐前端 i18n | [entry](./entries/2026-06-profile-error-copy-i18n.md) | 2026-06-18 |
| `order-terminal-status-inventory` | `planned` | — | Phase 1 + Phase 2 | 订单终态转换库存动作矩阵确认后再统一通用状态服务库存处理 | 完成 Phase 1 盘点：状态入口、付款状态、库存锁状态、退款路径 | [entry](./entries/2026-06-order-terminal-status-inventory.md) | 2026-06-18 |
| `cms-merchant-panel-shipping-refund` | `planned` | WeChat + CMS 代码已落地 | CMS smoke + 发版确认 | 本地/生产 smoke 两入口后退款行为 | 做 CMS smoke；通过后改 `active`/`done` | [entry](./entries/2026-07-cms-merchant-panel-shipping-refund.md) | 2026-07-25 |

---

## 已归档（Done / Cancelled）

| ID | 状态 | 完成日 | Entry | 备注 |
|----|------|--------|-------|------|
| *(none yet)* | | | | |
