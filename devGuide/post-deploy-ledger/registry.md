# Post-Deploy Registry（巡检入口）

Last updated: 2026-06-02

**日常巡检：「检查 post-deploy」** — 打开本文件，活跃表行数应为 **0** 表示无待收尾部署债务。非 0 则点击 **Entry** 查看 Gate 与勾选清单。

---

## 活跃（Active）

| ID | 状态 | 已部署 | 待完成 | Gate 摘要 | 下一动作 | Entry | Last updated |
|----|------|--------|--------|-----------|----------|-------|--------------|
| `user-address-last-used-delivery` | `planned` | — | Phase 1 + Phase 3 | WeChat 新版本全量后再 DROP `is_default` | 实施 Phase 1 后改 `blocked` | [entry](./entries/2026-06-user-address-last-used-delivery.md) | 2026-06-02 |

---

## 已归档（Done / Cancelled）

| ID | 状态 | 完成日 | Entry | 备注 |
|----|------|--------|-------|------|
| *(none yet)* | | | | |
