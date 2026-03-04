# Airwallex Payments for SaaS — 申请流程与材料清单

一份文档：我们的决定、申请步骤、平台与商户材料清单。用于准备并提交 SaaS 平台申请。

---

## 一、我们的决定（已确定）

| 项目 | 决定 |
|------|------|
| **产品模式** | **Payments for SaaS**（商户为 MoR，平台不碰资金流） |
| **平台主体** | 使用**现有**已开通 Airwallex 的公司作为平台（Company B） |
| **小程序与收款** | 平台（Company B）名下运营小程序；**所有应收计入公司 B**；提供 Mini Program AppID 一次开通微信支付 |
| **公司 A 角色** | 仅作为**入驻商户**之一，与其他商户一样支付平台费用；**保留小程序名称的免费使用权**（书面授权/协议约定） |
| **资金流** | 通过 **Funds Split** 从买家支付中扣平台费；平台不持有商户资金 |
| **网关** | 与 Airwallex 确认：Gateway vs PSP-agnostic（或混合） |
| **子模式** | 与 Airwallex 确认：Customers as owner vs Platform as owner（影响谁做 KYB、谁处理纠纷/预留金） |

---

## 二、申请流程（按顺序）

1. **与 Airwallex 确认**  
   确认：Payments for SaaS、Customers vs Platform as owner、Gateway vs PSP-agnostic。

2. **准备平台申请材料**  
   完成下文「平台材料清单」；确保网站/小程序满足「支付方式开通要求」。

3. **提交 Payments 申请**  
   在 Airwallex 提交 Payments for Platforms 申请；申请开通所需支付方式（含 WeChat Pay）；提供 **Mini Program AppID** 及收款主体与小程序主体是否一致（不一致则配合客户经理做额外登记）。

4. **上线商户入驻**  
   实现 Hosted / Embedded / Native API 之一；每个商户：KYC → KYB → 为该 CA 请求支付能力 → 状态 ENABLED 后可收款。

5. **对接与上线**  
   集成收款（含 Funds Split 扣平台费）、从 CA 向商户外部银行账户的 Payout；可选为商户开通 AU AUD Global Accounts（BSB+账号）。

---

## 三、平台材料清单（申请 P4P 时提交 / 准备）

以下内容以**简短 deck 或文档**形式准备，便于提交或会议使用。

### 3.1 平台与业务说明

- [ ] **模式与用例**：写明「Payments for SaaS」，商户为 MoR；收款方式（如 Airwallex 网关）。
- [ ] **商户与买家画像**：商户类型（SME/个体/行业）、地区、客单价、月交易笔数/金额、峰值与增长预期。
- [ ] **资金流与结算**：如何收款；如何分账（Funds Split、平台费、预留金如有）；给商户的结算方式（银行转账和/或发卡）。
- [ ] **合规与风险**：行业范围（对照 AUP）；是否需额外牌照；若直接处理卡数据则说明 PCI-DSS 情况。

### 3.2 网站 / 产品（满足支付方式开通）

- [ ] 平台 + 小程序 **URL**（正式或测试环境）。
- [ ] 业务说明：卖什么、交易对手是谁、平台在交易中的角色。
- [ ] **条款与政策**：Terms & Conditions、Privacy Policy、Refund/Cancellation Policy。
- [ ] **与商户的协议**：平台与入驻商户的协议（含费用、责任）。
- [ ] **结账页**：价格与商品信息清晰；无不当跳转；适用法律与注册地一致。

### 3.3 公司 KYC（若为新主体）

- [ ] 公司注册证明、ABN、营业地址证明、股权/UBO、董事身份与地址、Marketplace/Financial Institution 问卷（如要求）。  
- **现有公司**：基础 KYC 已完成，无需重复提交。

---

## 四、支付方式开通要求（平台一次满足）

以下为开通支付方式（含 WeChat Pay）时，平台网站/小程序需满足的要点：

- [ ] 页面展示**公司名称、注册号、联系方式**（地址、邮箱、电话）。
- [ ] 业务/行业与申请描述一致。
- [ ] 已发布 T&Cs、退款政策、隐私政策。
- [ ] 结账页有**清晰价格与商品信息**；无违规跳转；适用法律与注册地一致。
- [ ] 若小程序/收款主体与发布主体不一致：与客户经理完成**额外登记**。
- [ ] 部分支付方式/地区需本地化内容（如日语）。

---

## 五、商户侧（每个 Connected Account）

- [ ] **KYC**：必做（身份、地址等）；通过 Embedded / Hosted / Native API 之一提交。
- [ ] **KYB**：必做（商户为 MoR：企业名称/类型/注册地址/业务描述/行业/注册号/预估月收入、注册证明与股权或合伙协议、UBO 与董事身份及地址；按国家与主体类型，如澳洲个体见下）。
- [ ] **支付能力**：KYC/KYB 通过后，为该 CA **请求支付方式能力**（如 WeChat Pay），直至状态 **ENABLED**。
- [ ] **WeChat**：商户**无需**单独申请微信支付或提供 AppID；使用平台同一小程序，按 merchant_id 路由到对应 CA。

**商户类型**：支持公司、合伙企业、个体户（Sole proprietor）；个人账户（个体/自由职业者）。具体要求按国家。

---

## 六、WeChat Pay + 小程序（要点）

- **平台**：在申请中开通 WeChat Pay **一次**；提供 **Mini Program AppID**；确认收款主体与小程序主体是否一致。
- **商户**：仅需其 CA 的 WeChat Pay 能力变为 ENABLED，无需再交 AppID 或向微信单独申请。
- **名称授权**：公司 A 对小程序名称的免费使用以书面协议约定即可，不改变收款主体与 MoR，合规上无问题。

---

## 七、资金流（简要）

- 买家付款（卡、微信等）→ 进入**商户的 Connected Account**（商户 MoR）。
- **Funds Split**：从该笔支付中扣平台费及 Airwallex 费用；平台不持有资金。
- **Payout**：从各 CA 钱包打到商户**外部银行账户**（或发卡）；可选 FX，50+ 币种。

---

## 八、可选：为商户开通澳洲 AUD Global Accounts（BSB+账号）

- **用途**：让商户拥有**澳洲 AUD 的 BSB + 账号**，其客户可本地银行转账至该 CA 钱包。
- **方式**：无单独申请表；通过 API 创建。  
  `POST /api/v1/global_accounts/create`，Header：`x-on-behalf-of: <CA open_id>`（格式 `acct_xxxxxx`）。  
  Body：`country_code: "AU"`, `required_features: [{ currency: "AUD", transfer_method: "LOCAL" }]`, `request_id`（唯一 UUID）, `nick_name`。AU AUD 仅支持 LOCAL 收款。
- **前提**：平台已开通 P4P/Global Treasury（或 Banking as a Service）；该 CA 已存在且 KYC/KYB 通过；具备 API 凭证（Client ID + API Key）并可获取 access token。
- **返回**：BSB 在 `supported_features` → `routing_codes`（type `bsb`）；账号在 `account_number`；`status` 为 ACTIVE 或 PROCESSING。PROCESSING 时需订阅 Global Account webhook 或轮询至 ACTIVE 再向商户提供 BSB+账号；入账对账使用 Deposits API。
- **大量开户**：联系 Airwallex Account Manager。  
  请求示例见 [API: Open a Global Account](https://www.airwallex.com/docs/api/core_resources/global_accounts/create)。

---

## 九、澳洲 / 新州个体户（商户为个人时）

- **监管**：需 ABN；若用非本人全名经营需注册 business name；营业额≥$90k 需注册 GST；行业/地区许可查 ABLIS。
- **Airwallex 个人 KYC（AU）**：姓名、生日、国籍、常住地址（不可 P.O.Box）；一种身份证件（驾照/护照/Medicare 等）；account_usage（收款/付款国家、来源/去向、月交易量、产品用途如 MARKETPLACE_WALLET/RECEIVE_TRANSFERS）；协议同意；平台商户标识；主联系人邮箱。若平台启用 deferred identity verification，证件可后补至达到阈值再验证。详见 [Individual KYC - AU](https://www.airwallex.com/docs/connected-accounts/onboarding/kyc-and-onboarding/native-api/individual-kyc-requirements/au)。

---

## 十、关键文档链接（申请与对接时用）

| 用途 | 链接 |
|------|------|
| Payments for SaaS 总览 | https://www.airwallex.com/docs/payments-for-platforms__payments-for-saas |
| Customers as owner of payments | https://www.airwallex.com/docs/payments-for-platforms/use-cases/payments-for-saas/customers-as-the-owner-of-payments |
| Platform as owner of payments | https://www.airwallex.com/docs/payments-for-platforms/use-cases/payments-for-saas/platform-as-the-owner-of-payments |
| 商户入驻 | https://www.airwallex.com/docs/payments-for-platforms/connected-accounts/onboard-connected-accounts |
| KYB and onboarding | https://www.airwallex.com/docs/connected-accounts__kyb-and-onboarding |
| 代收（on behalf of CAs） | https://www.airwallex.com/docs/payments-for-platforms__process-payments-and-manage-funds__collect-payments-on-behalf-of-connected-accounts |
| View connected accounts | https://www.airwallex.com/docs/connected-accounts/manage-accounts/view-connected-accounts |
| 支付方式开通 | https://www.airwallex.com/docs/payments/get-started-with-payments/payment-method-activation |
| 支付方式页面要求 | https://www.airwallex.com/docs/payments/payment-methods/payment-method-onboarding-requirement |
| WeChat Pay | https://www.airwallex.com/docs/payments/payment-methods/apac/wechat-pay |
| Funds Split | https://www.airwallex.com/docs/payments-for-platforms/airwallex-gateway/manage-funds-split |
| Global Accounts 创建 | https://www.airwallex.com/docs/banking-as-a-service/global-accounts/create-global-accounts |
| API: Open a Global Account | https://www.airwallex.com/docs/api/core_resources/global_accounts/create |
| Global Account webhooks | https://www.airwallex.com/docs/developer-tools/webhooks/listen-for-webhook-events/global-accounts |
| AU/NZ 公司所需文件（Help） | Airwallex Help Centre 搜索 "Documents required Australia New Zealand" |
| Individual KYC - AU | https://www.airwallex.com/docs/connected-accounts/onboarding/kyc-and-onboarding/native-api/individual-kyc-requirements/au |

---

*基于现有 Airwallex 多份文档整理，用于 Payments for SaaS 申请与材料准备。*
