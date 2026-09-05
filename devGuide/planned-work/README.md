# Planned Work（规划台账）

Last updated: 2026-09-05

> **日常巡检口令：「检查规划」**（或「检查 planned」）  
> → 打开 [`registry.md`](./registry.md)，看 **活跃** 表中非 `done` / `cancelled` 行。  
> → 需要细节时点进 [`entries/`](./entries/)：当前掌握的信息 + 期望目标结果。

---

## 用途

跨仓、跨阶段的 **尚未实施但计划内必做** 功能（有目标阶段 / 触发条件），不是「已上生产等 Gate 的清理债」。

| 台账 | 管什么 |
|------|--------|
| **本目录 planned-work** | 未来必做的规划项（简述表 + 详文） |
| [post-deploy-ledger](../post-deploy-ledger/README.md) | 已部分上线后的 **Phase N 清理债** |
| [各 app `todo/`](../todo/README.md) | 单仓人工 follow-up |

**不要**把规划项写进 post-deploy；**不要**把 Phase N DROP/删 API 写进本台账。

---

## 目录

| 路径 | 职责 |
|------|------|
| [`registry.md`](./registry.md) | 巡检入口：todo **简表**（状态 + 关键信息） |
| [`entries/YYYY-MM-<slug>.md`](./entries/) | **详文**：已知信息 + 期望结果 + 触发条件 |

---

## Registry 列约定

| 列 | 含义 |
|----|------|
| ID | 稳定 slug |
| 状态 | `planned` \| `scheduled` \| `in_progress` \| `blocked` \| `done` \| `cancelled` |
| 简述 | 一句话 |
| 目标阶段/触发 | 阶段名、大致窗口、或可观测指标 |
| 下一动作 | 现在最该做 / 刻意不做的提醒 |
| Entry | 详文链接 |

---

## Entry 详文结构（强制）

1. **摘要** — 一句话；为何不是 post-deploy  
2. **当前掌握的信息** — 已定决策、约束、相关路径  
3. **期望目标结果** — 可勾选验收  
4. **触发条件 / 目标窗口**  
5. **可选：实施备忘** — 候选方案草稿  

---

## 相关文档

- [async-lambda-jobs-framework](../async-lambda-jobs-framework.md)
- [post-deploy-ledger](../post-deploy-ledger/README.md)
- [Cross-repo todo](../todo/README.md)
