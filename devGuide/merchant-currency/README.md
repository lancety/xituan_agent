# 商户记账货币

Last updated: 2026-10-25

Skill checklist：`.cursor/skills/merchant-currency/SKILL.md`。流水数据块保存/删除见 [../ledger-intake/README.md](../ledger-intake/README.md) 与 `.cursor/skills/ledger-intake/SKILL.md`。

本文锁定 **2026-10 流水入账 / 收入支出管理** 已经落地的货币规则。以后做「商户可配置记账货币」时必须先对照本文，禁止另起一套计入条件、汇率语义或金额列含义，以免和已入账数据冲突。

流水产品流程仍以 [../ledger-intake/README.md](../ledger-intake/README.md) 为准；本文只管 **货币、汇率、进不进账**。

## 结论

| 项 | 当前锁定 |
|----|----------|
| 商户记账货币 | **AUD**。代码入口 `ledgerSourceCurrencyUtil.defaultMerchant()`。商户表 **没有** `currency` 列 |
| 收入/支出/订单/结算单金额 | **记账货币数字**，表上 **没有** 币种列。今天等价于 AUD |
| 流水块源货币 | `epLedgerCurrency`：`AUD` \| `CNY`。界面把 CNY 显示成 **RMB**。库内禁止存 `RMB` |
| 源货币谁可改 | CBA **锁 AUD**；支付宝 **锁 CNY**；标准银行 / 标准电商可下拉，**默认 AUD** |
| 计入账目汇总 | `块货币 !== 商户货币`（今天即非 AUD，例如 RMB 流水） |
| 不计入账目汇总 | `块货币 === 商户货币`（今天 AUD–AUD）：**不写**收入支出管理；用来发现漏记后 **手动**补记录 |
| 「进」的含义 | 计入块：按块汇率换算后，每种收入/支出类型最多 **1 条**管理记录（金额 > 0 才写）；保存/更新时 upsert；删块时一并删 |
| 入账汇率 | 块级 `fx_to_merchant`： **1 单位源货币 = 多少记账货币**（例：1 RMB = 0.21 AUD 填 `0.21`） |
| 税表展示汇率 | 财年级 `fxCnyToAud`，只换算税表 overlay / `commerceCny` 展示，**不得**再写入 `revenues`/`expenses` |
| 外币自动入账 GST | **0**（`gst_amount = 0`，`net_amount = total_amount`） |
| 时区 | 商户/平台 IANA 时区与货币 **独立**。改货币不要动时区工具 |

## 术语

| 说法 | 含义 |
|------|------|
| 商户货币 / 记账货币 | 收入支出管理、税表 P&L 数字所在的币种。当前恒为 AUD |
| 块货币 / 源货币 | 该份流水文件本身的币种（CBA=AUD，支付宝=CNY，标准源可选） |
| 计入 | 换算后自动写入管理记录，并进入账目汇总 |
| 不计入 | 不写管理记录；只做对账查漏 |
| `fxToMerchant` | 入账用。merchant / 1 source |
| `fxCnyToAud` | 税表 overlay 用。历史命名，语义仍是「目标货币 / 1 CNY」，与入账汇率 **不是同一字段** |

## 当前实现边界（as-is）

还没有「商户货币设置」功能。

- 比较商户货币时 **不要读数据库商户行**，只调用 `defaultMerchant()`。
- `merchant.revenues` / `merchant.expenses` 的 `total_amount` / `gst_amount` / `net_amount` **没有币种**。读这些列的代码必须假定它们已经是记账货币。
- 流水块头 `ledger_analysis_blocks.currency` 存的是 **源货币**；`*_total` 标量是 **源货币金额**（未换算）。
- 自动写入的管理记录金额是 **已乘汇率的记账货币**。不能从 `total_amount` 反推源币金额，除非同时保存汇率快照（目前汇率只在块头 `fx_to_merchant`）。

```text
源 CSV / 块头汇总（源货币）
        │  × fx_to_merchant（仅计入）
        ▼
revenues / expenses.total_amount（记账货币，无币种列）
```

## 计入规则（不要改语义）

判定函数：`ledgerSourceCurrencyUtil.countsTowardAccountingSummary(block, merchant)` → `block !== merchant`。

| 块货币 | 商户货币（当前 AUD） | 结果 |
|--------|----------------------|------|
| AUD | AUD | 不计入。手动补管理记录 |
| CNY（界面 RMB） | AUD | 计入。必须有 `fxToMerchant`，自动写管理记录 |

这是 **相对商户货币** 的规则，不是「支付宝永远计入、CBA 永远不计入」。

以后若商户货币变成 CNY：

| 块 | 结果（按同一公式） |
|----|-------------------|
| 支付宝 CNY | **不计入**（与商户相同） |
| CBA AUD | **计入**（与商户不同，AUD→CNY 换算） |

若实装时把「支付宝一律进账」写死，会和已保存的 AUD 商户数据、以及本公式同时冲突。

## 汇率

### 入账（权威）

- 字段：`ledger_analysis_blocks.fx_to_merchant`（`numeric(18,8)`，可空）
- 语义：**记账货币 / 1 源货币**
- 计入保存：必须 `> 0` 有限数字，否则 `eBusinessErrorCode.LEDGER_BLOCK_FX_REQUIRED`
- 换算：`merchantAmount = round(sourceAmount * fxToMerchant, 2)`
- 实现仍叫 `ledgerFxUtil.cnyToAud` / `parseCnyToAud`：名字带 CNY/AUD，**语义已是通用乘法**。实装多商户货币时 **改名或包一层**，禁止再复制第二条乘法

### 税表 overlay（非入账）

- 字段：税表请求/快照上的 `fxCnyToAud`
- 用途：把勾选的 **计入** 电商块源币汇总，在税表卡片上显示换算后的旁路数字
- **禁止**：用这个财年汇率去 create/update `revenues`/`expenses`
- 已知差异：同一财年多块外币流水可以有 **不同** `fx_to_merchant`；税表 overlay 目前仍用 **一个** 财年汇率。P&L 以管理记录为准；overlay 只是展示。实装时不要把 overlay 汇率「提升」成入账汇率而不做迁移

### 不要引入第三套汇率

订单、合作商结算单、手工收入支出 **当前不换汇**（已是记账货币）。不要为它们再加一个隐式 AUD 汇率。

## 自动入账（计入块）

触发：`complete` / `PATCH` 块头成功后 `LedgerIntakeService.syncAccountingBooks`。不计入则删掉该块已有自动记录。

外键：`revenues.ledger_block_id` / `expenses.ledger_block_id`，复合 FK `(ledger_block_id, merchant_id)`，`ON DELETE CASCADE`。每块每类型唯一。

金额 > 0 的类型才保留行；变为 0 则删除该类型行。

| 来源 | 写入 |
|------|------|
| 电商 原材料 / 耗材 / 设备 / 海外 / 费用 | 支出 RAW_MATERIAL / PACKAGING / STUB_EQUIPMENT / TRANSPORT / DELIVERY |
| 电商计入（上列支出合计） | 收入 LOAN_FROM_DIRECTOR（向董事借款，不进 P&L） |
| 银行 收入（扣除向董事借款） | 收入 ORDER_SALES |
| 银行 工资 | 支出 SALARY |
| 银行 其余支出（扣除工资、借给董事） | 支出 OTHER |
| 银行计入 向董事借款合计 | 收入 LOAN_FROM_DIRECTOR |
| 待审、排除、退款、借给董事 | **不写**自动管理记录。本币手工：loan from → 收入管理，loan to → 支出管理 |

日期：该财年结束日 `YYYY-06-30`（`date` 列，Type 1）。GST = 0。

收入 `source_type = LEDGER_BLOCK`。支出没有历史 source 列，只靠 `ledger_block_id`。

不计入块（AUD–AUD）上银行、电商表都显示「创建」列，仍是 **手工** 收入/支出，**不要**带 `ledger_block_id`（否则删块会误删手工补记）。计入块不显示该列。

## 各表存的是哪种金额（防冲突）

| 位置 | 币种 | 换算了吗 |
|------|------|----------|
| `ledger_analysis_blocks.currency` | 源货币代码 | — |
| 块头 `*_total` / processed CSV 行金额 | 源货币 | 否 |
| `fx_to_merchant` | 汇率 | — |
| `revenues` / `expenses` 金额 | 记账货币 | 计入路径：是；手工/订单/结算单：本来就是记账货币 |
| 税表 overlay `ledgerIntake.commerce` | 展示用记账货币 | 用 **财年** `fxCnyToAud`，可能与块汇率不同 |
| 税表 overlay `commerceCny` | 源 CNY | 未换算，仅对照 |

同一列里混进「有的 AUD、有的 RMB」且没有币种标记 = 数据损坏。

## 实装「商户货币」时

在改 `defaultMerchant()` 或加 `merchant.currency` 之前必须有方案，至少覆盖：

1. **历史管理记录**：已按 AUD 写入。商户改成别的货币时，禁止只改设置不迁金额（否则旧 AUD 与新币数字会加在同一列）。
2. **已上传流水块**：块头仍是源货币。重新保存会按 **当时** 商户货币重算「计不计入」。商户从 AUD 改为 CNY 后，旧支付宝块会从「计入」变成「不计入」并 **删掉** 自动管理记录——这是公式结果，必须在产品上明示，或改为「按块保存时快照的商户货币」判定（若改判定，要写迁移，不要静默改公式）。
3. **`fx_to_merchant` 方向不变**：永远是 记账/1源。商户变 CNY、块为 AUD 时，填的是「1 AUD = 多少 CNY」，不是倒数，除非 UI 写清并在存储前取倒数。
4. **税表 `fxCnyToAud`**：要么降级为「仅当目标是 AUD 的 overlay」，要么迁到通用 `fxToMerchant` 并与块级汇率对齐；禁止长期三套汇率。
5. **枚举 / CHECK**：`ck_ledger_analysis_blocks_currency` 目前只允许 `AUD`,`CNY`。新币种要改 enum + CHECK + `selectOptions`。
6. **`ledgerFxUtil` 命名**：去掉 CnyToAud 硬编码名，避免后人按名字再写一条 AUD 专用函数。
7. **Phase**：改已入账金额或判定属于可能破坏生产的变更，按 post-deploy ledger 拆 Phase 1 / 清理。

未做上述计划就改默认货币 = 视为事故。

## 关键路径

| 层 | 路径 |
|----|------|
| 判定 / 显示 | `xituan_codebase/utils/ledger-source-currency.util.ts` |
| 汇率乘法 | `xituan_codebase/utils/ledger-fx.util.ts` |
| 类型映射 | `xituan_backend/src/domains/financial/utils/ledger-intake-books.util.ts` |
| 同步入账 | `xituan_backend/src/domains/financial/services/ledger-intake.service.ts` `syncAccountingBooks` |
| 税表 overlay | `tax-return-report.service.ts` `buildLedgerIntakeOverview` |
| CMS | `xituan_cms/src/pages/financial/ledger-intake.tsx`（汇率输入、计入标签） |
| 枚举 | `epLedgerCurrency` |
| 迁移 | `1710000000383_ledger_block_accounting_books.sql` |

## 相关文档

- [../ledger-intake/README.md](../ledger-intake/README.md) — 流水入账流程与存储
- [../tax-return-report-design.md](../tax-return-report-design.md) — 税表快照；overlay 汇率
- [../../.cursor/skills/merchant-currency/SKILL.md](../../.cursor/skills/merchant-currency/SKILL.md) — agent checklist
- [../agent-global-dev-rules-checklist.md](../agent-global-dev-rules-checklist.md) — 全仓规则索引
