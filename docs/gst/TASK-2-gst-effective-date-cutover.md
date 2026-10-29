# 大任务 2：GST 生效日切齐（收支 + 单据 PDF）

> **状态：** 大任务 2 等 ATO 的 D；**纠错**（2025-07-01 起未注册计法）可先做，与手续费 plan、与「D 日迁移」分开。  
> **手续费：** Cursor plan `stripe_fee_auto_expense`（无关本文）。  
> **细节：** [`gst-effective-date-amount-cutover.md`](./gst-effective-date-amount-cutover.md)

### 纠错 vs 生效日迁移（两回事）

| | 纠错 | 生效日迁移（本文主体） |
|--|------|------------------------|
| 为何 | 未注册却写入了 gst/净值 | 正式注册从 D 起按含税业务走 |
| 何时 | 现在即可（WP-0 + 历史） | D 确定后 |
| 脏数据主战场 | **`revenues` / `expenses`**；票仅当误按已注册计价时 |

发货/结算 UI 通常不展示 GST；PDF 应按注册状态。未注册正确计价是折扣后再 ×10/11，不是收支那种「拆 gst+净值」展示。

---

## 1. 你要确认的结论

**对。** 税务局把 GST **生效日 D** 定下来之后，需要从 **D 起（含）** 批量调整：

1. **收入** `revenues` 的 `gst_amount` / `net_amount`（尊重**出单/入账业务日**相对 D 的注册状态）  
2. **支出** `expenses` 的 `gst_amount` / `net_amount`（可抵扣进项取决于**你在支出日是否已注册**；成本报税用 net）  
3. **合作送货单 / 结算单** 上已按「未注册」算死的 GST 行与汇总  
4. **相关 PDF**（订单税票/收据按日重算；合作票需 bump 版本重生成）

**不是**把历史全部重算：`业务日 < D` 保持未注册计法；只动 **`业务日 >= D`**。  

**OmiPay 已收款 18.18→18 不在本文** — 归手续费独立 plan，勿与 GST 纠错/切齐混同一脚本。

---

## 2. 与大任务 1 的边界

| | 大任务 1（手续费） | 大任务 2（本文） |
|--|-------------------|------------------|
| 何时做 | 可先上线（不依赖 D） | **必须等 D 确定** |
| 内容 | Stripe fee 支出 + OmiPay 已收款历史（手续费 plan） | 未注册纠错 + D 日起 GST 切齐 / PDF |
| 不做 | 站内提现 | 手续费记账、OmiPay 18.18→18 |

两 plan **脚本与验收分开**，不要混在同一运维批次里讲成一件事。

---

## 2.1 审计：未注册时是否仍默认拆 GST（2026-10-29）

现象：商户设置仍为**未注册**，但订单/结算单/支出等仍常见 gst+净额拆分。流水「合作商转账→结算单收入」已改为尊重注册（未注册 gst=0）。

### 现网：已尊重注册的路径

| 路径 | 行为 |
|------|------|
| `RevenueService.createRevenue` **未传** gst/net | `gstAppliesOnDate` → 未注册则 gst=0、net=total |
| `ExpenseService.create/update` **未传** gst/net；OCR 收尾 | 同上 |
| CMS `RevenueEditModal` / `ExpenseEditModal` **auto 模式** | `isRegisteredOnDate(gstSettings, date)` |
| `PartnerService` 创建/改票 | `isGstRegisteredOn(issueDate)` 传入计算 |
| 订单 PDF | `order-document-pdf-gst.util` 按日判定 |
| Ledger 计入自动账 | **硬编码 gstAmount: 0**（外币计入）；合作转账建结算收入已 respect |

### 漏洞 / 仍会拆出 GST 的路径（未注册也应堵住）

1. **后端信任前端传入的 gst/net（主因）**  
   `createRevenue` / `createExpense`：仅当 `gstAmount === undefined \|\| netAmount === undefined` 才查注册。  
   CMS/API **一旦带上 gst+net**，未注册也会落库非 0 gst。  
   → **应改为：`!gstAppliesOnDate` 时强制 gst=0、net=total**（覆盖客户端）。

2. **CMS 收入「含 GST」手动按钮**  
   `RevenueEditModal`：`gstMode === 'include'` 时 `applyGstSplit(true)`，**不看** `gstApplies`。未注册仍可点「含税」拆出 gst 并提交。  
   → 未注册时隐藏/禁用含税拆分，仅允许 gst=0。

3. **合作发票 repository 默认参数**  
   `createPartnerInvoice(..., isGstRegistered = true)` 默认 **true**。当前 service 有传参；默认不安全。  
   → 默认改为 `false`。

4. **历史脏数据**  
   修复前写入的收支/送货单仍带 gst；列表看起来像「现在还在拆」。  
   → 大任务 2 在 D 前可加预清理：`isRegistered=false` 期间全库将误拆行改回 gst=0、net=total（与 D 切齐不同，是**纠错**）。

5. **订单**  
   订单表无 gst 列；PDF 现算。若 PDF 仍显示 GST，优先核对设置里 `isRegistered` 是否真为 false，或看的是旧 PDF 文件。

### WP-0（可先于 D；与手续费 plan 独立）

- [ ] Backend：收入/支出 create+update，未注册日强制 gst=0 / net=total  
- [ ] CMS：未注册禁止「含 GST」强制拆分  
- [ ] `createPartnerInvoice` 默认 `isGstRegistered=false`  
- [ ] **历史纠错（已定）：** 自 **2025-07-01** 起至 **D-1**（D 未定前做到当前）按未注册计法：`gst=0`、`net=total`；合作票脚本重算 + 必要 PDF；须预览并批准后再跑 SQL  

**说明：** 2025-07-01 对齐澳财年；纠错 ≠ 生效日切齐。D 公布后只对 `>= D` 再拆 GST。  

### 合作发货单 / 结算单（产品口径，已确认）

- **UI** 可不展示 GST；**PDF** 按注册状态。  
- **未注册：** 收费 = `货值 × (1 - 折扣率) × 10/11`，单上 `gst = 0`（把 GST 等价部分优惠给合作商，因其无法从你未注册税票抵进项）。  
- **已注册：** 正常显示 GST；折扣按设计（如 20% → 收 8 折货值后再拆/含税）。  
- 代码：`invoiceDetail.util.ts` 未注册分支已是 `partnerDiscountPrice * 10/11`。历史纠错须**整单重算**，禁止只清零 gst 列。  

---

## 3. Gate（执行前 checklist）

- [ ] ATO 书面/系统确认生效日 → `D = YYYY-MM-DD`  
- [ ] CMS 财务：`finance.gst.isRegistered = true`  
- [ ] CMS 财务：`finance.gst.registrationDate = D`  
- [ ] 确认 `isPriceInclusiveGst`（默认 **价内 true**：消费者实付一般不改，只拆税）  
- [ ] 选定 `merchant_id`（多租户逐商户或只 Galaxy）  
- [ ] DB 备份 + 预览 `SELECT` 行数/金额合计已复核  
- [ ] 开发者明确批准跑更新 SQL / 重算脚本（禁止擅自跑 migration/生产 SQL）

---

## 4. 用 / 不用 GST（统一判定）

`gstRegistrationUtil.isRegisteredOnDate(gst, eventDate)`：

| 业务日 | 结果 |
|--------|------|
| `< D` | **不用** GST（收入 gst=0；支出 gst=0 且 net=total → 成本=总额） |
| `>= D` 且已注册 | **用** GST（收入拆销项；支出拆进项；报税成本用 net；进项进 GST 表） |

- **收入：** 跟出单/入账日的商户状态（你已确认）。  
- **支出：** 收据上的税是供应商事实；库里的 `gst_amount` = **你可抵扣的进项**，跟你是否注册有关（见 cutover 文 §C5）。

---

## 5. 工作包拆分

### WP-A — 配置 Gate

只写设置，不改业务行。写完后：**新**创建的收入/支出/新开票会按 D 自动拆税。

### WP-B — 收入批量（`merchant.revenues`）

- 范围：`revenue_date >= D` 且当前 gst≈0、非董事借款  
- 动作：价内拆分 `gst = |total|/11`，`net = total - gst`（保留退款符号）  
- `< D`：**不动**

### WP-C — 支出批量（`merchant.expenses`）

- 范围：`expense_date >= D` 且 gst≈0；排除 loan/fine；价外供应商/复杂 OCR **不进自动 SQL**  
- 动作：补拆 gst/net  
- `< D`：**不动**（成本保持总额）  
- 若任务 1 已回填 Stripe 手续费支出：对 `expense_date >= D` 同样拆税

### WP-D — 合作送货单（`partner_invoices`）

- 范围：`issue_date::date >= D` 且 gst 未按注册重算（常 gst=0）  
- 动作：**脚本**调现有发票计算工具重写 `detail` + 头 `gst_amount` 等（禁止纯手写 JSONB）  
- 然后重汇总关联 **结算单** `partner_invoice_summaries`，`doc_content_version += 1`

### WP-E — PDF

| 单据 | 策略 |
|------|------|
| 消费者订单 TAX INVOICE / RECEIPT | 无存库 gst 列；设好 D 后按业务日 **现算**；对需归档的 `>= D` 订单触发重生成/重发 |
| 合作送货单 / 结算单 PDF | bump `doc_content_version` 后跑现有 PDF 生成；抽查含税栏 |

### WP-F — 验收（本任务，不含手续费）

- [ ] `< D` 收入支出 gst 仍为 0（抽样）  
- [ ] `>= D` 收入有销项；支出有进项（适用行）；报税成本为 net  
- [ ] 合作票 PDF GST 栏正确  
- [ ] 订单 PDF 在 D 后显示 GST，D 前不显示  

---

## 6. 执行顺序（运维日 · 仅 GST）

```text
Gate(A) → 备份/预览
  → 送货单脚本(D) → 结算单汇总 + PDF(E)
  → 收入 SQL(B) → 支出 SQL(C)
  → 订单 PDF 抽检/重生成(E)
  → 验收(F)
```

---

## 7. 交付物

1. 本文（任务说明书）  
2. [`gst-effective-date-amount-cutover.md`](./gst-effective-date-amount-cutover.md)（字段与 SQL/脚本细节）  
3. 生效日当天：带 `:mid` / `:D` 的最终预览清单 + 已批准的执行记录  
4. （可选）定稿后迁入 `xituan_agent/devGuide/gst/`

---

## 8. 明确不做

- 站内提现；Stripe/OmiPay 手续费自动支出与 OmiPay 已收款订正（手续费 plan）  
- 把 `业务日 < D` 的历史收支强行改成含 GST  
- 未批准的生产 SQL
