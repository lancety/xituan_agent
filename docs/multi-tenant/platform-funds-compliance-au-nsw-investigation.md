# Platform funds & compliance (AU/NSW) – investigation note

**Status**: Investigation / planning. Not legal or tax advice. Confirm with a lawyer and accountant in Australia before acting.

---

## 1. Your described model

- **Revenue**: Membership fees and/or transaction commission from merchants.
- **Money flow**: Customer payments go into **your platform’s Airwallex account**; merchants can withdraw/transfer out after a delay (e.g. T+1, T+7).
- **Question**: What licences and financial management are needed under Australian (NSW) rules?

---

## 2. Regulatory areas to clarify (AU generally, NSW where relevant)

### 2.1 Holding / moving merchant funds

- **Client money / trust money**  
  If you receive customer money “on behalf of” merchants and hold it before paying them, regulators may treat it as **client/trust money**. That often requires:
  - Keeping it in a **trust account** (or equivalent) separate from your own operating funds.
  - Compliance with **trust account rules** (e.g. accounting, reconciliation, audits).
- **Your setup**: Money sits in your Airwallex account; you then pay merchants. Whether this is “holding client money” and whether a formal trust account is required depends on legal structure and how the product is characterised. **Needs legal advice.**

### 2.2 Financial services licence (AFSL)

- **AFSL** (Australian Financial Services Licence): Required if you provide “financial services” as defined in the *Corporations Act* (e.g. certain payment, custodial, or investment-like services).
- **Payment facilitation / aggregation**: Collecting and distributing funds can touch financial services regulation. Whether you need an AFSL or can rely on an exemption (e.g. “pass-through” arrangements, or using a licensed partner like Airwallex) must be confirmed with a lawyer.
- **Practical**: Many platforms use a **licensed payment provider** (e.g. Airwallex) and structure flows so the provider is the one “handling” funds; your role (platform fee, settlement timing) still needs to be clearly scoped for compliance.

### 2.3 AML/CTF (anti‑money laundering & counter‑terrorism financing)

- **AU AML/CTF**: If you are a “reporting entity” (e.g. certain designated services involving moving funds), you have obligations: AML/CTF program, KYC, reporting, record-keeping.
- **Payment service providers** and **remittance**-like flows often fall in scope. Whether your exact model (membership fee + commission + delayed payout) makes you a reporting entity should be confirmed with a lawyer or compliance adviser.

### 2.4 Tax (GST, income, withholding)

- **GST**: If your turnover is **$75k+** (or you choose to register), you need to register for GST and account for GST on taxable supplies (e.g. membership fees, commission). You need a clear **GST treatment** for:
  - Membership fees (typically taxable supply by you).
  - Transaction commission (who supplies what, and whether it’s a separate taxable supply).
- **Income tax**: Membership fees and commission are generally **ordinary income**; you need proper records and reporting (ABN, possibly ACN if you’re a company).
- **Withholding**: If you pay merchants (e.g. as contractors or in a B2B arrangement), you may have **withholding** or **reporting** obligations (e.g. PAYG, or reporting to ATO). Structure depends on whether merchants are treated as employees, contractors, or businesses; an accountant can advise.

### 2.5 Contract & terms

- **Terms of use / merchant agreement** should clearly state:
  - That funds are received by the platform (or by the payment provider on your behalf) and when/how they are made available for withdrawal.
  - Fee structure (membership, commission), timing of payouts, and any reserve/chargeback provisions.
  - That merchants are responsible for their own tax (GST, income) and that the platform is not giving tax advice.
- **Refunds, chargebacks, disputes**: Who bears the risk (platform vs merchant), and how that is documented and implemented in the flow (e.g. reserve, delayed payout).

### 2.6 NSW-specific

- NSW does not add a **state financial licence** for this type of activity; the main rules are **Commonwealth** (Corporations Act, AML/CTF, tax).
- If you have **employees** in NSW, standard employment and payroll (including NSW payroll tax if applicable) apply; that’s separate from “platform funds” design.

---

## 3. Financial management (operational)

Regardless of final legal structure, you will need:

- **Clear separation** of:
  - Customer money intended for merchants (if treated as trust/client money, in a proper structure).
  - Your own revenue (membership fees, commission) and operating funds.
- **Reconciliation**: Daily/weekly reconciliation between Airwallex balances, your ledger, and payouts to merchants.
- **Audit trail**: Records of every transaction (sale, fee, commission, payout) for tax, disputes, and any future audit/regulatory request.
- **Payout rules**: Documented policy (e.g. T+1, T+7, minimum payout, reserves) and consistent implementation in your system (e.g. in CMS/backend and, when you add it, mini-program).

---

## 4. Mini-program (小程序) – scope of “what to update”

You asked: “多商户除了 cms backend platform，还需要更新小程序端.”

- **Technical**: For multi-merchant, the mini-program will need to:
  - Identify **which merchant** the user is buying from (store/merchant context).
  - Send **merchantId** (or equivalent) on orders/payments so backend can attribute revenue and apply commission correctly.
  - Show correct store/merchant info and, if you expose it, fee/payout policy (e.g. “Funds available for withdrawal in 7 days”).
- **Compliance**: The same **legal and financial** structure (who holds funds, who is licensed, GST, AML/CTF, terms) applies regardless of whether the client is CMS, web, or mini-program; the mini-program is another distribution channel, not a different regulatory regime.

---

## 5. What you “need” – summary (to confirm with professionals)

| Area | What to confirm |
|------|------------------|
| **Licence** | Whether you need AFSL or can rely on provider (e.g. Airwallex) + structure; get legal advice. |
| **Client/trust money** | Whether your flows are “holding client money” and whether a trust account (or equivalent) is required. |
| **AML/CTF** | Whether you are a reporting entity and what program/KYC/reporting you must have. |
| **Tax** | GST registration and treatment of membership fee and commission; income tax; any withholding when paying merchants. |
| **Contract** | Merchant agreement and terms covering fund flow, fees, payout timing, refunds/chargebacks. |
| **Operations** | Separation of funds, reconciliation, audit trail, clear payout rules in system and docs. |

**Next step**: Brief an Australian lawyer (financial services / payments) and an accountant (GST, income tax, withholding) on: “Platform collects customer payments into our Airwallex account; we take membership fee and/or commission; merchants withdraw after X days. What licences, trust/AML/tax and contract do we need for NSW/AU?”

This doc is for internal investigation only; it does not replace professional advice.

---

## 6. WeChat Mini Program (小程序) – overseas entity, multi-merchant SaaS

**Context**: Australian company, Chinese citizen; multi-merchant SaaS for **Sydney local merchants only** (no China / cross-border market). Payment via Airwallex (no in‑app WeChat Pay / no need for own financial licence for AU). Question: which 服务类目 / 主营类目 to choose, what 资质 is needed, how hard to apply.

### 6.1 Entity type → 类目 system

- **Overseas entity**: If the mini program **registration subject** (注册主体) is outside mainland China (e.g. Australian company), you must use **「境外主体对应类目」** ([小程序境外主体开放的服务类目](https://developers.weixin.qq.com/miniprogram/product/material/#%E5%BF%AB%E9%80%92%E4%B8%8E%E9%82%AE%E6%94%BF)).
- **Certification**: Overseas entities need to complete **WeChat certification** (微信认证) after registration (e.g. business registration docs, admin ID; fee ~USD 99/year; audit ~1–7 days). Overseas mini programs do **not** require 备案 or 年审 (unlike domestic).

### 6.2 Multi-merchant platform → 电商平台 class (Sydney local only)

For a **multi-merchant platform** (多商户) that serves **Sydney / Australia local merchants only** (no China domestic or cross-border sales), use only:

- **服务类目**: 【本地服务—电商平台】  
  **无需**申请【跨境电商—电商平台】或其它跨境类目。

- **主营类目**: 在已通过的服务类目中选与主营业务最匹配的（若同一一级类目下通过多个类目，可能出现「综合类」可选）。

- **Scope**: 类目“适用范围”须与实际业务一致；选错主营类目可能导致代码/审核被拒。

### 6.3 资质 (credentials) for 【本地服务—电商平台】

后台添加该类目时需上传（以实际表单为准）：

| 项目 | 要求 |
|------|------|
| **境外当地颁发的电商平台资质原件及翻译件** (英文或中文) | 原件或复印件；jpg/jpeg/bmp/gif/png，单文件 ≤10M，可拼图。后台写“加盖公司公章”主要针对境内主体；**澳洲无公章习惯，授权人签字即可**。 |
| **消费者保障机制或方案**（如：消费者风险告知书） | 同上格式；**澳洲主体用授权人签字即可**。 |
| **资质有效期** | 与资质文件一致，且 **大于 30 天**（可选“长期有效”）。 |

注：【本地服务—电商平台】当前表单**未**要求“境内企业连带责任委托协议”（该要求多见于跨境电商类目）。

### 6.3.1 在澳洲如何取得这两项资质

澳洲**没有**类似国内的“电商平台经营许可证”单一证照，可按下面方式准备，满足“境外当地颁发的电商平台资质”的实质要求（证明你在当地合法经营电商平台）：

**（1）境外当地颁发的电商平台资质原件及翻译件**

- **建议组合**（任选其一或组合使用，以审核通过为准）：
  - **ASIC 公司注册证明**：若为 Pty Ltd，在 [ASIC](https://asic.gov.au/) 获取 **Certificate of Registration** 或 **Current company extract**（公司名称、ACN、注册地、状态），作为“当地颁发的合法经营主体证明”。
  - **ABN 证明**：在 [ABN Lookup](https://abr.business.gov.au/) 打印或截屏你公司的 ABN 登记信息（公司名、ABN、实体类型、状态），可作为“当地登记的经营主体”补充。
  - **平台性质说明函**：用公司信头纸出具一封**英文信**，内容大致为：本公司为澳大利亚注册企业（ACN/ABN），在澳洲本地运营多商户电商平台，为本地商户提供网上交易场所，遵守 Australian Consumer Law 及澳洲相关法律。由公司授权人（如 director）**签字 + 日期**即可；澳洲无公章惯例，不需盖章。  
    将此信与 ASIC/ABN 材料一起视为“电商平台资质”的组成：**原件 = 英文信 + ASIC/ABN 材料**；**翻译件 = 中文翻译**（若后台接受英文则可只交英文，以表单说明为准）。
- **翻译**：若微信要求“翻译件(英文或中文)”，而你提供的是英文原件，通常可注明“原文为英文”或附简短中文说明；若原件为政府出具的英文证明，可自行或找翻译公司译成中文后由授权人签字（澳洲无需盖章）上传。
- **有效期**：ASIC/ABR 上的登记无固定“有效期”时，在后台可选“长期有效”；若有到期日，选与实际一致且 >30 天。

若审核不通过，可发邮件至 **miniprogram_global@tencent.com** 说明：澳洲无单独“电商平台牌照”，询问是否接受“公司注册证明 + ABN + 平台运营说明函”作为等效资质，或是否需要律师/会计师出具证明函。

**（2）消费者保障机制或方案（如：消费者风险告知书）**

- **性质**：这是**平台自己制定的政策文档**，无需政府“颁发”，澳洲也没有统一格式。
- **建议内容**（1–2 页，公司信头、**授权人签字 + 日期**；澳洲无公章，签字即可）：
  - 标题：Consumer Protection Policy / 消费者保障方案（或“消费者风险告知书”）。
  - 退款与退换：在何种情况下用户可申请退款/换货（如：商品与描述严重不符、未收到货、符合 Australian Consumer Law 的 consumer guarantees 等）；变更心意是否可退（若可，写清条件）。
  - 纠纷处理流程：用户先联系商户 → 未解决可联系平台客服 → 平台协调或升级处理；说明平台作为交易场所的角色及不替代商户承担商品/服务责任（可注明商户责任、平台协助义务）。
  - 合规声明：平台与入驻商户均遵守 Australian Consumer Law（ACL）等适用法律。
  - 可选：风险提示（如：跨境/本地交易风险、支付安全、个人信息使用等），可作为“消费者风险告知”的一部分。
- **格式**：导出为 PDF 或图片（jpg/png 等），单文件 ≤10M；由授权人签字即可（澳洲无公章要求）。有效期可填“长期有效”或与公司政策生效日期一致且 >30 天。

以上在澳洲本地即可完成：ASIC/ABR 材料在线获取，说明函与消费者保障方案自行起草或由律师审阅后使用。

### 6.4 Ease of application

- **Registration + certification**: Straightforward for an Australian company (business cert, admin ID, etc.); no 备案.
- **类目**: 【本地服务—电商平台】需上传上述两项资质（见 6.3、6.3.1）；无“境内企业连带责任”要求。类目审核通常 **1–7 天**（境外无加急）。
- **Payment**: Using **Airwallex Payment for Platforms** means you do **not** need a separate financial/payment licence in AU for the platform funds; that is separate from WeChat’s **类目/资质** rules. If you later add **WeChat Pay** in the mini program, overseas merchant rules and possible extra agreements apply.

### 6.5 Summary (mini program)

| Item | Suggestion |
|------|------------|
| **服务类目** | 【本地服务—电商平台】only (Sydney local merchants; no 跨境电商). |
| **主营类目** | From approved 服务类目, choose the one that best matches main business (or 「综合类」 if available). |
| **资质** | 【本地服务—电商平台】仅需：境外当地电商平台资质原件及翻译件、消费者保障机制或方案；有效期 >30 天。在澳洲取得方式见 6.3.1。 |
| **认证** | Complete WeChat certification (overseas); prepare company + admin docs; ~USD 99/year. |
| **参考** | [境外业务类目常见问题](https://developers.weixin.qq.com/community/develop/article/doc/00062461834d105320744a3a66b013), [类目介绍与配置审核](https://developers.weixin.qq.com/community/business/doc/0006845b4dc70087677203bd16680d). |

For exact 资质 names and templates, use the current prompts in **微信公众平台 → 小程序 → 类目** when adding the class; the doc list can change.
