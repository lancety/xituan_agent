# 收入 / 支出创建幂等

Last updated: 2026-10-29

Skill checklist：`.cursor/skills/revenue-expense-idempotency/SKILL.md`。  
流水入账（数据块、分类、日期金额匹配）权威见 **[流水入账](../ledger-intake/README.md)**；本文只定 **管理账本创建如何防重复**。

## 背景

不计入流水里对同一行反复点「创建收支」、取消绑定后再创建、或私人卡垫付已有 loan from 后再确认，都会在 `revenues` / `expenses` 插出同额重复账。金额、日期不能单独当幂等键（超市同日同额很常见）。

## 结论

| 项 | 约定 |
|----|------|
| 命中行为 | **返回已有记录**，不新建（客户端照常写回 `revenueId` / `expenseId`） |
| 不用的键 | 单独金额；单独日期+金额；`ledger_block_id`（不计入手工账禁止写，删块会误删） |
| 订单收入 | `ORDER` + `orderId` **不**做 1:1 全局唯一（一单可多笔收款）；流水侧靠 `bank_row` 引用防同线重复 |
| 稳定行身份 | 银行分析行 `clientId` = UUID，进 IndexedDB / processed CSV |

## 幂等键表

| 场景 | 写入字段 | 查重顺序 |
|------|----------|----------|
| 任意从**银行行**创建的收入 | `source_reference = bank_row:{clientId}` | **先**按 `source_reference` + `is_refund` |
| 结算 / 送货 / 设备（有源头 id） | `source_type` + `source_id`（及同 `revenue_type`、`is_refund`） | 无 bank_row 引用命中时，再按 source 1:1 |
| 无业务源头的收入 / 向董事借款（未挂支出） | `source_type=bank_row` + `source_id=clientId` | 同上（source 1:1 集合含 `bank_row`） |
| 从银行行创建的支出 | `expenses.source_type=bank_row` + `source_id=clientId` | 按 source 查已有支出 |
| 私人卡垫付 `LOAN_FROM_DIRECTOR`（规划/已枚举） | `source_type=expense` + `source_id=expenseId` | 一笔支出最多一条非退款垫付借款 |

`bank_row:` 前缀与格式：`ledgerBookIdempotencyUtil.bankRowSourceReference`（codebase）。

有业务 `source_*` 时仍可同时写 `source_reference=bank_row:{clientId}`，以便取消绑定后再次创建优先撞到同一条收入。

## 服务端行为

1. `RevenueService.createRevenue`：若 `source_reference` 为 bank_row 引用 → `findBySourceReference`；否则若 `source_type` 在 1:1 集合内且有 `source_id` → `findBySourceIdempotent`；命中则返回已有。
2. `ExpenseService.createExpense`：若有 `source_type` + `source_id` → `findBySourceIdempotent`；命中则返回已有。
3. **不**对 `ORDER` 做 source 级唯一（多笔支付合法）。
4. 计入块自动账仍用 `ledger_block_id` / 每类型 ≤1，与本文手工幂等正交。

1:1 的收入 `source_type`：`partner_invoice`、`partner_invoice_summary`、`equipment_disposal`、`expense`、`bank_row`（见 `revenueSourceAllowsUniqueDedupe`）。

## CMS 流水创建预填

- 银行行打开创建收入：按有无订单/结算/送货/设备 id 选 `source_type`；否则 `bank_row` + `clientId`；**始终**带 `source_reference=bank_row:{clientId}`。
- 银行行打开创建支出：`source_type=bank_row`、`source_id=clientId`（FormData 传到后端）。
- `RevenueEditModal` / `ExpenseEditModal`：创建时保留 initialValues 里的 source / reference，勿被默认 `sourceType` 盖掉。

## 与流水匹配的边界

| 能力 | 归属 |
|------|------|
| 日期金额匹配、绑定列、clientId 进 CSV | [流水入账](../ledger-intake/README.md) |
| 匹配支出金额：单据额优先于总金额 | 流水入账日期金额表 + `listExpensesForDateAmount` |
| 创建查重键与 create 返回已有 | **本文** |
| orphan / 非公司支付待审 → 建 loan from | 产品未闭环；幂等键已预留 `expense` source |

## 禁止

- 用金额或「日期+金额」当唯一幂等键。
- 不计入手工创建写入 `ledger_block_id`。
- 仅靠行上已有 `revenueId`/`expenseId` 藏按钮、不做服务端查重（取消绑定 / 换浏览器会丢）。
- 把订单多笔收款误做成「一单只能一条收入」。
- 在流水 README 与本文各维护一份完整键表（改键只改本文，流水侧只留摘要链接）。

## 规范代码

| 件 | 路径 |
|----|------|
| 前缀 / 1:1 判定 | `xituan_codebase/utils/ledger-book-idempotency.util.ts` |
| 收入 source 枚举 | `epRevenueSourceType`（含 `BANK_ROW`、`EXPENSE`） |
| 支出 source 枚举 | `epExpenseSourceType.BANK_ROW` |
| 收入创建查重 | `RevenueService.createRevenue` / `RevenueRepository.findBySource*` |
| 支出创建查重 | `ExpenseService.createExpense` / `ExpenseRepository.findBySourceIdempotent` |
| 行 clientId UUID | `bank-ledger-analyze.util.ts` `asAnalyzed` |
| CMS 预填 | `xituan_cms/.../ledger-intake.tsx` `openCreateFromRow` |
| 迁移 | `1710000000389_expense_source_idempotency.sql`（支出 `source_type` / `source_id`） |

## 相关文档

- [../ledger-intake/README.md](../ledger-intake/README.md) — 流水块 / 匹配 / 绑定列（摘要链回本文）
- [../../.cursor/skills/revenue-expense-idempotency/SKILL.md](../../.cursor/skills/revenue-expense-idempotency/SKILL.md) — agent checklist
- [../../.cursor/skills/ledger-intake/SKILL.md](../../.cursor/skills/ledger-intake/SKILL.md) — 流水 checklist（创建幂等指向本 skill）
- [../merchant-currency/README.md](../merchant-currency/README.md) — 计入自动账与手工账边界
