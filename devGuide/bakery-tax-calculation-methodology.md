### 目标

说明一个通用的 **小型烘焙 Pty Ltd 公司** 如何基于：

- CMS/ERP 系统中的收入与成本数据，
- 银行流水（CBA CSV），
- 设备与折旧记录，
- 个人账户/公司账户混用的实际情况，

系统化地推导出：

- 本财年的 **P&L（Profit & Loss）**，以及  
- 期末 **Balance Sheet（资产负债表）** 所需的关键数字，  

而不是绑定在某一个具体财年的数值上。

---

### 一、数据来源与核心表

1. **业务系统（CMS）内部表**
   - `orders` / `partner_invoices`：所有营业收入，已净掉退款、折扣。
   - `expenses`：日常支出，包含：
     - 原材料（raw materials）
     - 水电费（utilities）
     - 服务费（services）
     - 许可证（licences）
     - 运输（transport）
     - 其他运营支出（other）
   - `equipments`：设备主表，字段示例：
     - `purchaseDate`
     - `purchasePrice`
     - `depreciationMethod`（直线法等）
     - `currentBookValue`（当前账面价值）
     - `accumulatedDepreciation`
   - `equipment_depreciation_records`：设备按财年分的折旧记录：
     - `assetId`
     - `fiscalYear`
     - `openingValue`
     - `deprAmount`
     - `closingValue`

2. **银行流水（CBA CSV）**
   - 原始字段：`Date, Amount, Description, Balance`。
   - 通过 `balance_sheet.mjs` 脚本解析并增加：
     - `Type`：`income | expense | refund`
     - `Party`：`company | personal | unknown`
     - `Confidence`：`high | medium | low`
     - `Reason`：分类原因说明。

3. **个人账户信息（人工整理）**
   - 个人为公司支付的业务成本清单：
     - 个人买设备（原值）
     - 个人账号支付的原材料/耗材
     - 个人账号支付的水电/服务/许可证等
   - 这些都需要最终转化为 **Loan from director**。

---

### 二、P&L 计算流程（年度）

#### 1. 收入（Income）

1. 从 CMS 中导出当年的：
   - 订单销售净收入（已扣退款等）
   - 合作伙伴发票净收入
2. 确认：
   - 所有金额为不含 GST 的净额；
   - 与银行流水中的入账（CBA + 第三方收款账户）做抽样核对（金额级别即可）。
3. 汇总：
   - `Sales (orders)`
   - `Partner invoices`
   - `Total income = Sales + Partner invoices`

#### 2. 运营成本（Operating expenses）

1. 从 CMS 中导出各类支出总额（不含 GST）：
   - Raw materials
   - Utilities
   - Services
   - Licences
   - Transport
   - Other
2. 若存在「超市购物中混有个人消费」的情况：
   - **推荐做法**：
     - CMS 中的原材料成本只记 **业务相关部分**；
     - 个人消费部分不计入成本，改用银行流水 → Loan to director 表达；
   - 若暂时无法准确拆分，可以：
     - 先按估算比例拆分（例如 60% 业务 / 40% 个人），
     - 40% 个人部分不进成本，记入 Loan to director。
3. 得到：
   - `Operating expenses (cash)` = 上述各类现金支出之和。

#### 3. 折旧（Depreciation）

1. 通过 `equipment_depreciation_records` 表，选出 **本财年的记录**：
   - 对所有资产（设备）按 `fiscalYear = 当前财年` 求和 `deprAmount`。
2. 该合计值记为：
   - `Depreciation – equipment`。
3. P&L 中：
   - `Total cost before wages = Operating expenses (cash) + Depreciation`。

#### 4. 工资与 super

1. 根据工资策略（例如两个人各 18,000）确定：
   - 本年所有员工/董事的 **年度总工资**。
2. 根据当年 SG 比例（例如 11.5%）计算：
   - `Superannuation = Total wages × SG_rate`。
3. P&L 的分层视图：
   - `Profit before wages/super = Income - (Operating + Depreciation)`  
   - `Profit after wages (before super) = Profit before wages/super - Wages`  
   - `Net profit/(loss) after wages and super = Profit after wages - Super`

> 提醒：报公司税时的 super 可扣金额，应以「本财年内实际支付到 super fund 的金额」为准，若整年未付，税表需把会计口径的 super 从可扣费用中加回。

---

### 三、Balance Sheet 关键科目计算方法

#### 1. Cash at bank (CBA)

- 直接取 **银行对账单 30/06 财年末的 closing balance**。
- 如有多个银行账户，需要将所有业务相关账户余额相加。

#### 2. Property, plant & equipment (net)

1. 对每一台设备，从 `equipments` 或联表查询中得到：
   - `purchasePrice`（原值）
   - 当前累计折旧（可由 `equipment_depreciation_records` 汇总，或直接使用 `currentBookValue` / `accumulatedDepreciation` 字段）。
2. 计算方式：
   - 若使用折旧记录表：
     - 找到该资产「截至当前财年的最新折旧记录」的 `closingValue`；
     - 即 \( \text{PPE\_net\_asset} = \text{closingValue} \)。
   - 若使用设备表现有字段：
     - \( \text{PPE\_net\_asset} = \text{purchasePrice} - \text{accumulatedDepreciation} \)。
3. `Property plant & equipment (net)`：
   - 为所有资产的 `PPE_net_asset` 之和。

> 注意：**设备原值本身不进 P&L**；只有折旧 \(\text{deprAmount}\) 进入当年成本。

#### 3. Loan from director（股东借给公司）

总规则：**凡是“个人账户为公司支付的业务成本与设备投入”，都记作 Loan from director**。

计算步骤：

1. 汇总个人账户支付的 **设备原值**（所有财年的投入）：
   - 例如 23–24 买设备 12,703.30，24–25 再买 3,162.94 等。
2. 汇总个人账户支付的 **各类业务成本**（本财年）：
   - 个人支付的原材料/耗材；
   - 个人支付的水电、服务、许可证等；
   - 个人支付的与业务直接相关的运输等。
3. 期末余额：
   - `Loan from director (closing) = 期初 Loan from director + 本年个人账户支付的所有业务支出`
   - 若以前年度只发生了设备投入且没有偿还，期初值为「历史设备原值之和」。

结果：Loan from director 反映 **公司欠股东多少钱**。

#### 4. Loan to director（公司借给股东）

总规则：**凡是“公司账户为股东/家庭支付的个人消费，且未认定为工资/福利的部分”，都记作 Loan to director**。

计算方法依赖于银行流水分类：

1. 用 CBA CSV + `balance_sheet.mjs`，对所有交易增加 `Party = company | personal | unknown`。
2. 统计：
   - 本财年全部 `Party = personal` 且 `Type = expense` 的金额合计，得到 `personal_expense_total`。
3. 将当年的 **工资部分**（例如 2 人各 18k）认定为正常薪酬：
   - `wage_component_in_personal = Total wages`（前提是以公司账户发放或当成已支付工资处理）。
4. 非工资的个人消费部分：
   - `Loan_to_director_increment = personal_expense_total - wage_component_in_personal`
5. 若以前年度已存在未结清的 Loan to director 期初余额，则：
   - `Loan_to_director (closing) = 开始余额 + Loan_to_director_increment`

结果：Loan to director 反映 **股东欠公司多少钱**（不包含已认定为工资的部分）。

#### 5. Retained earnings (opening) 与 Current year profit

1. **Retained earnings (opening)**：
   - = 截至上个财年末的 **累计净利润/亏损之和**。
   - 若之前年度仅有折旧，无收入：
     - 上年净利润 = -折旧合计；
     - 则本年的 opening retained earnings = -折旧合计。
   - 不包含任何：
     - 设备原值；
     - 期初现金；
     - Loan from/to director 期初余额；
     这些都通过资产或负债科目反映。

2. **Current year profit/(loss)**：
   - 直接引用本年 P&L 中「Net profit/(loss) after wages and super」的会计口径。
   - 若要计算税务口径利润，需要对 super、不可扣项目等做额外调整（不在本文展开）。

3. **Total equity**：
   - `Total equity = Share capital + Retained earnings (opening) + Current year profit/(loss)`

---

### 四、资产负债表平衡检查（Check）

最终构建 Balance Sheet 时，应满足：

\[
\text{Assets} = \text{Liabilities} + \text{Equity}
\]

在 Excel 或脚本中可以增加一行：

- `Check = Total assets - Total liabilities - Total equity`
- 正常情况下 `Check` 应为 0（或接近 0，允许极小四舍五入差异）。

若 `Check ≠ 0`，通常是以下问题之一：

- Loan from director 中 **遗漏了历史设备投入或个人垫付成本**；
- Loan to director 中 **遗漏了公司账户支付的个人消费**；
- PPE net 没有使用最新的折旧记录（closing value 未更新）；
- Retained earnings (opening) 未包含上一年度真实的净利润/亏损；
- Share capital 未按 ASIC 注册文件中的金额填写。

解决思路：

1. 先构建完整的 **上一财年（23–24）期末资产负债表**，确保 Check = 0；
2. 再在此基础上「滚动」添加本财年的：
   - 新设备、
   - 新折旧、
   - 新的 Loan from/to director、
   - 本年 P&L 结果；
3. 重算 24–25 的 Balance Sheet，检查 Check 是否归零。

---

### 五、实现层面建议

1. **将 Loan from/to director、PPE net 计算抽象为 util 函数**
   - 输入：
     - 设备列表与折旧记录；
     - 个人支付清单；
     - 银行流水分类结果；
     - 上年期初余额；
   - 输出：
     - Loan from director closing；
     - Loan to director closing；
     - PPE net；
     - 用于 P&L 的折旧合计。

2. **Balance Sheet 生成脚本**
   - 类似 `balance_sheet.mjs`，但从多个数据源汇总，生成：
     - `pl_YYYY-YY.csv`（P&L）；
     - `balance_sheet_YYYY-YY.csv`（Balance Sheet）；
   - 在 CSV 中预留一行 `Check` 用于自动提示不平衡。

3. **与会计沟通时优先展示结构与方法**
   - 清晰说明：
     - 哪些数据来自 CMS；
     - 哪些是 CBA 流水分类的结果；
     - 哪些是个人账户垫付的汇总；
     - Loan from/to director 的精确含义；
   - 会计可以在此基础上做小范围调整，而不需要从零重新整理全部流水。***


