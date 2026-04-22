# Draft Reply to Tara (Airwallex) + Materials Checklist

**Copy-paste ready email and attachment are in `docs/email-tara/`:**
- `reply-to-tara.txt` – subject, body, and placeholders to fill; Mini Program AppID gh_6c7532704373 already in body
- `attachment-platform-model-and-policies.txt` – attach this to the email (platform model, policy URLs)

Use the materials checklist below for your own tracking. The email draft in §1 is kept for reference; for sending, use the files in `docs/email-tara/`.

---

## 1. Email draft (reply to Tara)

**Subject:** Re: Ticket 1320978 – Payments for Platforms: Confirmation of Customers-as-Owner (SaaS) Implementation

---

Hi Tara,

Thank you for the detailed guidance and the document links. We have decided to proceed with **Payments for SaaS** in the **customers as the owner of payments** model and will implement our platform accordingly.

**Our choice**

- **Model:** Payments for SaaS – our merchants (sellers) will act as **Merchant of Record (MoR)**. Each payment will be created on behalf of the relevant connected account; funds will land in that account, and the connected account will be responsible for payment fees, refunds, and chargebacks. Our platform will not hold or disburse seller funds; we will only take commission via **FundsSplit** from the connected account to our platform account.
- **Funds flow:** We will create payments on behalf of each merchant (using `x-on-behalf-of`). After capture, we will create a FundsSplit to move the platform commission from the connected account to our platform account. Settlement will be based on the split portion (as per your “Collect payments on behalf of connected accounts” flow). We do not require holding seller funds until delivery; sellers will receive their share at settlement as per the standard flow.
- **Channels:** We will accept payments via our **WeChat Mini Program** and our **e‑commerce website** (data synced). We intend to activate WeChat Pay and card payments (e.g. Mastercard/Visa) for our platform and connected accounts as applicable.

**Next steps on our side**

We are preparing the application and supporting materials as you outlined (KYC for our new entity, platform model description, funds flow, website/policies, WeChat Mini Program details, etc.). We will submit these through the appropriate channel or as you direct, and we are happy to provide a short deck or document describing our platform model and funds flow.

**WeChat Mini Program**

- Mini Program AppID: **gh_6c7532704373**. Legal entity behind Mini Program = P4P entity: **Galaxy108 Pty Ltd** (ABN 21652101641). New Airwallex account is also under this entity.

**Platform model summary** (you can attach or paste this into a short document for Tara):

- **Seller & buyer profile:** Australia market; merchants serve local customers in their surrounding suburbs. Focus on local craft/specialty shops (e.g. party decorations, baking, group-buy local produce, pre-order and group-buy activities). Not targeting high-value products. About 80% of orders around AUD 100, occasionally hundreds.
- **Expected volumes:** Local merchants, made-to-order or weekly/monthly small group-buys; typically 1–100 transactions per week per merchant. Early stage; no rapid scaling in first 6 months; target 30–100 long-term active merchants, then expand after model is proven.
- **Payout model:** Card and mobile payments to merchant Connected Account; merchants transfer from Airwallex wallet to their external bank. We also plan to use Airwallex-issued bank account details per merchant for customer bank transfers so we can auto-match payments to orders (to confirm with you if supported).
- **Sectors:** Retail, F&B, local services, group-buy, pre-order. Excluding medical, alcohol, and other licensed sectors.
- **PCI-DSS:** We do not handle card data; we use Airwallex-provided flows only.

Please let us know if you need any further information or a specific format for the platform model document.

**Live website (production):** **https://xituan.com.au**

Our legal and policy pages are published on the consumer site and linked from the site footer. **English (default for AU)** URLs:

| Document | Production URL (en) |
|----------|---------------------|
| Terms and Conditions | https://xituan.com.au/en/terms |
| Privacy Policy | https://xituan.com.au/en/privacy |
| Acceptable Use Policy | https://xituan.com.au/en/acceptable-use |
| Refund and Cancellation Policy | https://xituan.com.au/en/refund-policy |
| Merchant Agreement | https://xituan.com.au/en/merchant-agreement |

The same pages exist under **Simplified Chinese** (`/zh_cn/...`) and **Traditional Chinese** (`/zh_tw/...`) with the same path suffix (e.g. `https://xituan.com.au/zh_cn/terms`).

**Checkout:** We use **Airwallex Payments for SaaS (customers as owners)** as planned. Checkout is integrated in our site (cart → pay flow); we do not hold or disburse seller funds; we only take commission via FundsSplit. Our **public policy pages** (Terms, Privacy, Refund, Merchant Agreement) describe payment in generic terms (e.g. “our payment provider”, “funds settled to the merchant”) and do not name Airwallex in the policy text—this keeps the legal wording flexible and is common practice; we are of course using Airwallex and will provide any processor details Tara or activation requires.

We look forward to moving forward with the onboarding.

Best regards,  
[Your name]

---

## 2. Materials checklist (as per Tara’s email)

### 2.1 Standard business KYC for new entity (Galaxy108 Pty Ltd, Australia; ABN 21652101641)

| # | Item | Status / Note |
|---|------|----------------|
| 1 | Certificate of incorporation / company registration | [ ] |
| 2 | Active and current ABN | [ ] |
| 3 | Proof of business address | [ ] |
| 4 | Ownership structure (incl. UBOs – Ultimate Beneficial Owners) | [ ] |
| 5 | Personal ID and proof of address for directors / authorised signatories | [ ] |
| 6 | Marketplace Questionnaire (if applicable) | [ ] |
| 7 | Financial Institution Onboarding Questionnaire (if applicable) | [ ] |

*Ref: “Documents required for companies in Australia and New Zealand” – Airwallex Help Centre.*

---

### 2.2 Payments for Platforms / Payments activation (business model document)

Prepare a short deck or document covering:

| # | Item | Status / Note |
|---|------|----------------|
| 1 | **Platform model & use case** – SaaS, customers as owner of payments (merchants are MoR); platform only takes commission via FundsSplit | [ ] |
| 2 | **Seller & buyer profile** – see §2.2.1 below | [ ] |
| 3 | **Expected volumes** – see §2.2.2 below | [ ] |
| 4 | **Funds flows / Payout model** – see §2.2.3 below | [ ] |
| 5 | **Website / product** – **Production:** https://xituan.com.au (EN primary for AU: `/en/...`). Checkout on cart flow. | [ ] |
| 6 | **Policies** – On production xituan.com.au; footer links. **EN URLs:** Terms, Privacy, Acceptable Use, Refund, Merchant Agreement (see §1 table). Same paths for `zh_cn` / `zh_tw`. Policy text describes payment in generic terms (“our payment provider”); we use Airwallex P4P (customers as owners) and will provide processor details as required for activation. | [ ] |
| 7 | **Compliance & risk** – sectors §2.2.4; PCI-DSS §2.2.5 | [ ] |

#### 2.2.1 Seller & buyer profile (for Tara / activation doc)

- **Market:** Australia-focused; merchants serve **local customers in their surrounding suburbs**.
- **Merchant focus:** Local craft and specialty shops, e.g. party decorations, baking, group-buy for local produce, and local pre-order / group-buy activities. **Not targeting high-value product markets.**
- **Order values:** About **80% of orders around AUD 100**; occasionally orders in the hundreds of dollars.
- **Buyers:** End customers in the merchant’s local area (same suburb or nearby).

#### 2.2.2 Expected volumes (for Tara / activation doc)

- **Pattern:** Local merchants selling made-to-order or running small weekly/monthly group-buys. **Typical volume: about 1–100 transactions per week per merchant** (varies by merchant type).
- **Stage:** Early stage; **no aggressive scaling in the first 6 months**. Target **30–100 long-term active merchants**; will expand promotion after the operating model is proven and we have sufficient experience.

#### 2.2.3 Payout model (for Tara / activation doc)

- **Card and mobile payments** (e.g. WeChat Pay, card): Funds go to the **merchant’s Connected Account**. Merchants can then transfer from their **Airwallex wallet** to their **designated external bank account**.
- **Bank transfer from customer to merchant:** We intend to use **Airwallex-issued bank account details for each merchant** (rather than the merchant’s own registered bank account) so that incoming transfers can be **automatically matched to platform orders**. Merchants would still withdraw from their Airwallex wallet to their own external bank account. *(Confirm with Airwallex whether this “receive payments to an Airwallex-issued account for order matching” is supported and how it fits with Connected Accounts.)*

#### 2.2.4 Sectors / industries (for Acceptable Use Policy)

- **In scope:** Retail, food & beverage, local services, group-buy, pre-order.
- **Out of scope:** Medical, alcohol, and any other sectors that require specific licences or permits.

#### 2.2.5 PCI-DSS

- We **do not** handle card data directly; we use **Airwallex-provided flows** (hosted/redirect or API as per Airwallex docs) only.

---

### 2.3 WeChat Mini Program (for new platform entity)

| # | Item | Status / Note |
|---|------|----------------|
| 1 | Mini Program AppID for the new platform | gh_6c7532704373 |
| 2 | Confirmation: legal entity behind Mini Program = P4P entity (yes) – Galaxy108 Pty Ltd | [x] |
| 3 | If different: coordinate extra registration steps with WeChat/Tenpay (per Tara) | [ ] |

---

### 2.4 Connected accounts & payment methods (after entity approval)

- Plan for onboarding connected accounts (hosted / embedded / native API – as you decide with Airwallex).
- Plan for activating payment methods (e.g. cards, WeChat Pay) for your account and, where applicable, per connected account – including “Payment method onboarding requirements” (business identity on website, T&Cs, refund policy, checkout page, etc.).

---

## 3. Requirements Tara mentioned – status

| Requirement | Status | Note |
|-------------|--------|------|
| Seller & buyer profile | Done | §2.2.1 (AU local merchants, suburb-focused, craft/baking/group-buy, ~80% orders ~AUD 100). |
| Expected volumes | Done | §2.2.2 (1–100 txns/week per merchant; 30–100 active merchants; no rapid scale in 6 months). |
| Payout model | Done | §2.2.3 (card/mobile → Connected Account; wallet → merchant’s bank; bank transfer via Airwallex-issued account for order matching – to confirm with Airwallex). |
| T&C, Privacy, AUP, Refund, Merchant agreement | **Live on xituan.com.au** | See §1 email table: `/en/terms`, `/en/privacy`, `/en/acceptable-use`, `/en/refund-policy`, `/en/merchant-agreement` (+ zh_cn / zh_tw). Footer on all consumer pages. |
| PCI-DSS | Done | §2.2.5 – do not touch card data; use Airwallex flows only. |
| Sectors / industries | Done | §2.2.4 – retail, F&B, local services, group-buy, pre-order; exclude medical, alcohol, licensed. |
| Live URL | **https://xituan.com.au** | Policies + checkout on production; notify Tara if URLs or entity branding change. |

---

*You can copy the email draft into your mail client and adjust [Your name] and any details (e.g. entity name, AppID timing).*
