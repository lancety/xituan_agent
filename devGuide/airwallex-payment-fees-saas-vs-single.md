# Airwallex Payment Fees: Gateway, WeChat Pay, Mastercard, SaaS vs Single Account

Summary of **public** fee schedules for payment acceptance (gateway + payment method), and how **Payments for SaaS** (Platform API) differs from a **single standard Airwallex account**. Exact numbers depend on **region** and on **custom pricing** for Platform/SaaS.

---

## 1. Fee structure (all accounts)

From [Payment fees and pricing models](https://www.airwallex.com/docs/payments/about-airwallex-payments/fees-and-pricing-models):

Each transaction has **three base components**:

| Component | Description |
|-----------|-------------|
| **Gateway fee** | Routing and gateway tech (and often includes fraud & 3DS in blended schedules). |
| **Payment method fee** | Depends on method (Visa, Mastercard, WeChat Pay, etc.). Cards: either **Interchange++** or **Blended** (fixed % + fixed amount). |
| **Fraud and 3D Secure fee** | Risk and 3DS; sometimes bundled into “Gateway” in public tables. |

Plus **additional** when applicable: FX, refund, chargeback, exception handling, etc.

---

## 2. Region-specific examples (single/standard account)

Rates below are from the **standard** Fee Schedules / Platform Pricing for **single-entity** accounts (Explore/Grow/Accelerate). Currency and tiers differ by region.

### 2.1 Australia (AUD)

Source: [Australia Fee Schedule](https://www.airwallex.com/au/terms/fee-schedule) (PDF link on page).

| Item | Standard Fee (AUD) |
|------|--------------------|
| **Gateway fee** (Cards & Local Payment Methods, incl. Fraud & 3DS) | **$0.30** per transaction |
| **Domestic cards** (Visa, Mastercard, Diners, Discover, Amex) – blended | **1.65%** per transaction |
| **International cards** (Visa, Mastercard, Amex, UnionPay, etc.) – blended | **3.40%** per transaction |
| **Local payment methods** (e.g. WeChat Pay) | **Refer to** [AU online payments capability](https://www.airwallex.com/au/online-payments-capability): **Gateway $0.30 + payment method fee** (per-method rate not in fee schedule) |

So for **Mastercard** in AU: **1.65% + $0.30** (domestic) or **3.40% + $0.30** (international).  
For **WeChat Pay** in AU: **$0.30 + [payment method fee]**; the WeChat-specific % is not in the public schedule (see capability page / sales).

### 2.2 United States (USD)

Source: [US Fee Schedule](https://www.airwallex.com/us/terms/fee-schedule).

| Item | Standard Fee (USD) |
|------|--------------------|
| **Gateway fee** (incl. fraud & 3DS) | **$0.30** per transaction |
| **Domestic cards** (Visa, Mastercard, Amex) – blended | **2.80% + $0.30** per transaction |
| **International cards** (Visa, Mastercard, UnionPay) – blended | **4.30% + $0.30** per transaction |
| **Local payment methods** (e.g. WeChat Pay) | **$0.30 + Payment Method Fee** – see [US online payments capability](https://www.airwallex.com/us/online-payments-capability) |

So **Mastercard** US: **2.80% + $0.30** (domestic) or **4.30% + $0.30** (international).  
**WeChat Pay** US: **$0.30 + [payment method fee]** (WeChat-specific rate not in schedule).

### 2.3 EMEA (e.g. EU-NL, EUR)

Source: [Plans & Pricing – EU-NL Platform](https://airwallex.com/eu-nl/platform-pricing).

| Item | Standard Fee (EUR) |
|------|--------------------|
| **EEA Consumer Cards** (Visa, Mastercard, Apple Pay, Google Pay) | **1.30% + €0.25** per transaction |
| **EEA commercial & International cards** (Visa, Mastercard) | **3.15% + €0.25** per transaction |
| **Local payment methods** (WeChat Pay, GrabPay, 160+ others) | **€0.25 + Payment method Fee** |

So **Mastercard** EU: **1.30% + €0.25** (EEA consumer) or **3.15% + €0.25** (commercial/international).  
**WeChat Pay** EU: **€0.25 + [payment method fee]** (WeChat % not listed on the page).

---

## 3. WeChat Pay “payment method fee”

- In all regions above, **WeChat Pay** is quoted as: **fixed gateway (e.g. $0.30 / €0.25) + Payment method Fee**.
- The **percentage or fixed “Payment method Fee” for WeChat** is **not** in the public fee schedules; it is typically in:
  - The regional **online payments capability** page, or
  - **Custom pricing** from sales.
- So for an exact WeChat Pay total: use **Gateway from the table above + confirm WeChat payment method fee** with Airwallex (help centre or account manager).

---

## 4. Payments for SaaS (Platform API) vs single account

### 4.1 What the docs say

- [Payments for SaaS](https://www.airwallex.com/docs/payments-for-platforms__payments-for-saas): Platforms can charge connected accounts via **payout fees**, **FX markups**, and **platform fees**; the **underlying** payment (gateway + payment method) is still processed by Airwallex and incurs Airwallex’s fees.
- [Understanding Payments for Platforms](https://www.airwallex.com/docs/payments-for-platforms/understanding-payments-for-platforms): “You can generate revenue through **payout fees**, **FX markups**, and **platform fees** collected from the connected account’s Wallet.”
- [EU Platform Pricing](https://airwallex.com/eu-nl/platform-pricing): “For **Platform API**, **Embedded Finance** and **High Volume** use cases get in touch with us to discuss **custom pricing**.”
- AU and US fee schedules state that the listed fees apply to “Explore, Grow, Accelerate and **Custom** Tiers” but do **not** explicitly say that **Platform API / Payments for SaaS** use the same table; Platform API is typically **custom**.

So:

- **Single standard account**: Use the **public Fee Schedule / Platform Pricing** for your region (e.g. AU, US, EU) as above. That gives you **gateway + payment method** (e.g. Mastercard, WeChat Pay) for that region.
- **Payments for SaaS (Platform API, Connected Accounts)**: Officially **custom pricing**. It may be:
  - Same per-transaction (gateway + payment method) as the standard schedule, or
  - Different (e.g. volume-based, or different structure).
- **Airwallex’s own “platform fee”**: The docs refer to **your** platform monetisation (you charging your connected accounts). Airwallex does not publish a separate “Airwallex platform fee” for Payments for SaaS in the same way as the standard gateway + payment method table; any such fee would be part of your **custom** commercial agreement.

### 4.2 Summary table (your question)

| Question | Answer |
|----------|--------|
| **Gateway fee** (WeChat & Mastercard) | **AU**: $0.30/txn. **US**: $0.30/txn. **EU**: Included in the %+fixed (e.g. 1.30%+€0.25 or €0.25 for local). See tables above. |
| **Airwallex “platform” fee / commission** | No separate published “Airwallex platform fee” for Payments for SaaS. Your **platform** charges your merchants (e.g. 3%); Airwallex’s cut is the **gateway + payment method** (and any custom terms). |
| **WeChat Pay total** | **Gateway** (above) **+ Payment method fee**. WeChat-specific % not in public schedules; confirm with [capability](https://www.airwallex.com/au/online-payments-capability) or sales. |
| **Mastercard total** | **Gateway + card %**. e.g. AU: 1.65%+$0.30 (domestic), 3.40%+$0.30 (int’l). US: 2.80%+$0.30 / 4.30%+$0.30. EU: 1.30%+€0.25 / 3.15%+€0.25. |
| **Payment for SaaS vs 普通单用户** | **Single account**: public fee schedule for your region. **Payments for SaaS (Platform API)**: **custom pricing** – same or different from standard; must confirm with Airwallex (sales / account manager). |

---

## 5. Doc links (for your region / use case)

| Region / topic | Link |
|----------------|------|
| Fee structure (generic) | https://www.airwallex.com/docs/payments/about-airwallex-payments/fees-and-pricing-models |
| Australia Fee Schedule | https://www.airwallex.com/au/terms/fee-schedule |
| US Fee Schedule | https://www.airwallex.com/us/terms/fee-schedule |
| EU (NL) Platform Pricing (cards + local methods) | https://airwallex.com/eu-nl/platform-pricing |
| AU online payments capability (local methods) | https://www.airwallex.com/au/online-payments-capability |
| US online payments capability | https://www.airwallex.com/us/online-payments-capability |
| Payments for SaaS | https://www.airwallex.com/docs/payments-for-platforms__payments-for-saas |
| Understanding P4P (revenue: payout, FX, platform fees) | https://www.airwallex.com/docs/payments-for-platforms/understanding-payments-for-platforms |

**Recommendation**: For **WeChat Pay** exact % and for **Payments for SaaS** gateway + payment method (and any platform-side fee), get a **custom quote** from Airwallex (e.g. via Tara / account manager or contact sales) and keep it in this folder or in a separate commercial summary.
