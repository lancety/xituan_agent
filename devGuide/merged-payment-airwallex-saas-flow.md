# Merged Payment to Airwallex SaaS: End-to-End Flow

This doc describes the systematic flow from **frontend merged payment** (multi-merchant, multi-activity, excluding retail) through **Airwallex Payment for SaaS**, and the choice between **platform as owner** vs **connected account as owner**. It complements [merged-payment-design.md](./merged-payment-design.md) by adding the platform/split/hold/refund layer.

---

## 0. Current stage: Prefer avoiding platform liability and hold

### Official confirmation (Airwallex onboarding, Feb 2026)

Airwallex’s platform onboarding (e.g. Tara’s Payments for Platforms guidance) explicitly states:

- **Two models are supported**, with different compliance and operational implications:
  - **Payments for SaaS** – your customers (sellers) act as **Merchant of Record (MoR)**. Aligns with “**customers as owner of payments**”: each payment is created on behalf of a connected account; funds land in that account; the connected account is responsible for fees, refunds, chargebacks. The platform does not own the payment and does not need to hold or disburse; it only takes commission via FundsSplit from the connected account to the platform.
  - **Payments for marketplaces** – **you** act as MoR and pay out to sellers. Aligns with “**platform as owner of payments**”: the platform collects into its own account, then splits to connected accounts (and may hold funds). The platform bears fees, refunds, chargebacks and may need additional licensing.

- **“One payment, auto split, SaaS doesn’t bear so much responsibility”**: The mode where the **SaaS bears less responsibility** is **customers as owner / Payments for SaaS**. In that mode there is no single “platform-owned” payment that then “auto-splits” to multiple sellers: each payment is **owned by one connected account** (one Payment Intent per seller). So for a multi-seller cart you have **multiple payments** (multiple intents), each on-behalf-of one seller; “auto” here means funds go straight to that seller’s wallet and the platform only splits out commission. **True one-payment merge** (one Payment Intent for the whole cart, then split to N sellers) is the **platform-as-owner** model and comes with higher platform liability. Airwallex does not offer “one payment that auto-splits to many connected accounts with customers as owner” – that combination would be contradictory (one payment can have only one owner at creation).

**SaaS (customers as owner): different merchants cannot have one merged payment.** Per [Collect payments on behalf of connected accounts](https://www.airwallex.com/docs/payments-for-platforms__process-payments-and-manage-funds__collect-payments-on-behalf-of-connected-accounts): “Payments belong to your **connected account**” and you “specify the **account ID of the connected account** with the **x-on-behalf-of** header.” Each Payment Intent is created with a **single** connected account ID; the API does not support one payment on behalf of multiple connected accounts. So one payment = one merchant (one CA). For a cart with multiple merchants you must create multiple Payment Intents (one per merchant), each with that merchant’s `x-on-behalf-of`; the customer cannot complete “one merged payment” across different merchants in this model. By contrast, [Collect payments directly](https://www.airwallex.com/docs/payments-for-platforms__process-payments-and-manage-funds__collect-payments-directly) (platform as owner) explicitly states: “The fund will be split from the platform account to **one or many** connected accounts” and “In the case where funds need to be split into **multiple** connected accounts, the platform needs to create **multiple FundsSplit** to each connected account as a destination.” So only **platform as owner** supports one customer payment that is then split to multiple merchants (one Intent + N FundsSplits).

**Risk with “platform as owner” + hold**: When the platform collects the payment, holds funds, and is responsible for fees, disputes, and refunds, the platform takes on significant liability and may need additional licensing (e.g. e-money / payment institution). Many teams prefer not to take this on in the early stage.

**Recommended for now: Connected account as owner**

- Create each payment **on behalf of** the merchant (Connected Account): use `x-on-behalf-of` with that merchant’s Airwallex connected account ID.
- Funds go **directly into the merchant’s** sub-account. The **connected account (merchant)** is responsible for payment fees, refunds, and chargebacks—not the platform.
- Platform only creates a **FundsSplit** to take commission from the merchant’s account to the platform. No platform hold, no platform as payer of refunds; liability stays with the merchant.

**Implication for “merged payment” (one cart, multiple merchants)**

- **True one-payment merge** (one Payment Intent for the whole batch) requires the platform to own that single payment → platform bears liability and may need to hold/settle. That conflicts with “no platform liability” above.
- **To avoid platform liability**: do **not** use one platform-owned Payment Intent for the batch. Instead use **multiple Payment Intents**, one **per merchant**, each created **on-behalf-of** that merchant. Each payment is then owned by the respective merchant; no platform hold, no extra platform licensing for owning funds.
- **“One user action triggers multiple payments”?** Airwallex docs do **not** clearly support a single user action (e.g. one button) that confirms **multiple** Payment Intents at once. The documented flow is one Payment Intent per create/confirm; there is no documented batch-confirm or “one click pays N intents” API. So in practice you would need either:
  - **N sequential confirmations**: create N intents (one per merchant), then call confirm for each in turn (e.g. one after another in the same page). Whether the card/issuer allows multiple charges in quick succession, or 3DS for each, is product- and issuer-dependent and not guaranteed.
  - **N separate payment steps**: user sees “Pay merchant A”, completes; then “Pay merchant B”, completes; etc. Clear but heavier UX.
- **Recommendation**: Do **not** assume that “one operation triggers multiple Payment Intents” is supported. Confirm with Airwallex (support or account manager) whether they support a single checkout that charges multiple intents (one per connected account) in one flow. Until then, treat “multiple intents, no platform liability” as either sequential or multi-step UX, or accept that true one-click merged payment may require **platform as owner** (one intent + FundsSplit) with the associated liability.

Sections 1–2 below describe the **platform-as-owner** flow (one payment + FundsSplit + optional hold) for when you later decide to take on that model (e.g. after licensing); section 2.5 and 2.6 (hold, refund/reversal) apply only in that case.

### Flow at current stage (no platform liability)

1. **Batch / orders**: Same as today: create orders and a batch (batch_id, total, list of (order_id, merchant_id, amount)).
2. **Payment**: For each **merchant** in the batch, create **one Payment Intent** with `x-on-behalf-of: <that merchant’s connected_account_id>`, amount = that merchant’s total for the batch. Customer must complete **each** intent (N intents → N confirmations). Airwallex docs do not describe a “one click confirms all” flow; assume N separate confirm steps or N sequential confirm() calls until confirmed otherwise with Airwallex. No single platform-owned payment.
3. **Commission**: After each payment is captured, create one **FundsSplit** from that connected account to the platform (commission). No hold: use default settlement (auto_release true or omit).
4. **Refunds**: Handled by the merchant’s connected account (refund API with `x-on-behalf-of` that merchant). Platform does not own the funds, so no FundsSplitReversal from platform side.
5. **Bookkeeping**: Your batch and `order_payment_records` (one per order, batch_id, transaction_id = respective payment_intent_id) still apply; webhook and revenue logic can stay as in merged-payment-design, with the difference that each payment_intent is tied to one merchant.

---

## 1. Airwallex Payment for SaaS: Two Models

- **Customers (connected accounts) as owner**: Payment is created with `x-on-behalf-of` connected account; funds land in that account; platform creates **FundsSplit** to take commission from connected account to platform. Suited when the merchant directly faces the end customer. **Lower platform liability; no hold; no extra licensing for owning funds.**
- **Platform as owner**: Platform creates Payment Intent **without** on-behalf-of; funds are collected into the **platform account**. Platform is responsible for fees, refunds, chargebacks. After capture, platform creates **FundsSplit**(s) to send money to one or many **connected accounts**. Enables true one-payment merge and optional hold, but **increases platform liability and may require additional licensing**.

For **merged payment with multiple merchants** without platform liability, use **multiple Payment Intents (connected account as owner)** as in section 0. Use **platform as owner** only when you are ready to take on that responsibility (see section 2).

### 2.1 Frontend: Customer selects multiple merchants / activities → merged payment

- Customer selects items from multiple merchants and/or multiple activities (e.g. different group-buys; retail can be excluded or handled separately).
- Backend creates **multiple orders** (one per merchant/activity as today) and a **payment batch** (batch_id, total_amount, list of (order_id, merchant_id, amount)).
- Frontend requests **one** Payment Intent with **total amount**; request carries `batch_id` in metadata (and optionally merchant_id for routing). No `connected_account_id` at create if the platform owns the payment; platform account collects.

### 2.2 Backend: Create Payment Intent (platform owns)

- Call Airwallex **Create Payment Intent** with:
  - `amount` = batch total, `currency`, `merchant_order_id` = batch_id (or a reference that resolves to batch).
  - **No** `x-on-behalf-of` (platform collects).
  - Metadata: `batch_id` (and any needed for webhook resolution).
- Customer completes payment (e.g. card / WeChat) and payment is **captured** on the platform account.

### 2.3 Webhook: payment_intent.succeeded

- Persist event to `webhooks_events_airwallex` (one row per merchant in batch, with `batch_id`, as in merged-payment-design).
- Process once: resolve batch → create N rows in `order_payment_records` (one per order, each with `order_id`, `merchant_id`, `amount`, `batch_id`, same `transaction_id`).
- Then trigger **FundsSplit** step (see below).

### 2.4 Split funds to merchant sub-accounts (and platform commission)

- After **payment_intent.succeeded**, create **FundsSplit** requests via [Create FundsSplit](https://www.airwallex.com/docs/payments-for-platforms__manage-funds-split__create-funds-split):
  - `source_id` = payment_intent_id, `source_type` = PAYMENT_INTENT.
  - For **each merchant** in the batch: one FundsSplit with `destination` = that merchant’s **Airwallex connected account ID**, `amount` = that merchant’s share (order amount minus platform commission and any share of Airwallex fees, per your rules).
  - Optionally one “split” to the platform’s own wallet for total commission (or keep commission as the residual that does not get split out).
- **Multiple connected accounts**: “In the case where funds need to be split into multiple connected accounts, the platform needs to create multiple FundsSplit to each connected account as a destination.” So N merchants → N FundsSplit calls (or N+1 if platform commission is also a split).

### 2.5 Hold period (funds in platform / holding, release later)

- In **FundsSplit** request, set **`auto_release`: false** for each destination that should be held.
- Funds are then held in Airwallex’s holding/settlement flow until the platform calls **Release FundsSplit** ([release API](https://www.airwallex.com/docs/payments-for-platforms__manage-funds-split__create-funds-split)) with the split id.
- Your backend can:
  - After X days, or when “order confirmed / goods received” (or other rule), call Release for the corresponding split(s).
  - Store `funds_split_id` per (batch_id, merchant_id) or per order so you know which split to release.

### 2.6 Refund and FundsSplitReversal

- **Refund (to customer)**: Use existing refund flow on the **Payment Intent** (full or partial). Refund amount is capped by the payment intent’s captured amount. Your business logic (per-order caps, batch total cap) should already be enforced before calling Airwallex refund (see merged-payment-design: 可退金额 = current order’s payment record amount, two-layer check).
- **Rebalancing (FundsSplitReversal)**: When you refund the customer, money leaves the platform. If you had already split funds to connected accounts, you need to **reverse** part of that split so the platform (or the bearing party) gets the money back. Use [Reverse split funds](https://www.airwallex.com/docs/payments-for-platforms__manage-funds-split__reverse-split-funds):
  - **Platform as owner**: Funds were split **to** connected accounts; on refund, reverse from the **connected account(s)** back **to** the platform (so the platform can refund the customer).
  - Create **FundsSplitReversal** with `funds_split_id` = the split you want to reverse, and `amount` (cannot exceed the original split amount; multiple reversals can be created until the full split is reversed).
- Refund check logic (unchanged from merged-payment-design): (1) Refund for one order ≤ that order’s payment record amount; (2) optionally total refunds for the batch ≤ batch total. Then call Airwallex refund; then call FundsSplitReversal for the affected merchant(s) so the platform has funds to cover the refund.

---

## 3. Summary Table

| Step | Who | Action |
|------|-----|--------|
| 1 | Frontend | Customer selects multi-merchant / multi-activity → backend creates orders + batch |
| 2 | Backend | Create **one** Payment Intent (platform owner), amount = batch total, metadata = batch_id |
| 3 | Customer | Pay (e.g. card / WeChat); payment captured to **platform** account |
| 4 | Airwallex | Webhook **payment_intent.succeeded** |
| 5 | Backend | Save webhook (per-merchant rows with batch_id); create N order_payment_records; then create **N FundsSplit** (and optional platform commission split) to connected accounts; use **auto_release: false** for hold |
| 6 | Backend (later) | When conditions met, call **Release FundsSplit** for each held split |
| 7 | Refund | Refund via Payment Intent (within caps); then **FundsSplitReversal** from affected connected account(s) to platform |

---

## 4. Data and Idempotency

- **Batch**: batch_id, total_amount, list of (order_id, merchant_id, amount). Map merchant_id → Airwallex connected_account_id (store in merchant/payment config).
- **FundsSplit**: Create after payment_intent.succeeded; store split ids (e.g. per batch_id + merchant_id) for release and reversal.
- **Idempotency**: Use request_id for Payment Intent and FundsSplit; for webhook, use event_id so the same event is only processed once (and only one set of FundsSplits is created per payment).

---

## 5. References

- [Collect payments directly (platform as owner)](https://www.airwallex.com/docs/payments-for-platforms__process-payments-and-manage-funds__collect-payments-directly)
- [Create funds split](https://www.airwallex.com/docs/payments-for-platforms__manage-funds-split__create-funds-split) (including manual release / hold)
- [Reverse split funds](https://www.airwallex.com/docs/payments-for-platforms__manage-funds-split__reverse-split-funds)
- [Manage funds split (overview)](https://www.airwallex.com/docs/payments-for-platforms__manage-funds-split)
- [Sample integration – Platform as owner](https://www.airwallex.com/docs/payments-for-platforms/use-cases/payments-for-saas/platform-as-the-owner-of-payments/sample-integration)
- [Merged payment design (batch, webhook, order_payment_records, refund caps)](./merged-payment-design.md)

---

## 6. Official links (from Airwallex onboarding) and Platform-as-owner qualifications

### 6.1 Key docs (Tara’s list, verified)

| Purpose | Link | Notes |
|--------|------|--------|
| Payments for Platforms overview | [Payments for Platforms – Overview](https://www.airwallex.com/docs/payments-for-platforms/overview) | Use cases: PSP-agnostic marketplaces, Payments for SaaS, Payments for marketplaces |
| Roles and fund flows | [Understanding Payments for Platforms](https://www.airwallex.com/docs/payments-for-platforms__understanding-payments-for-platforms) | Reconcile flows, no PayFac registration required for you or customers in many cases, split proceeds, onboard via connected accounts |
| Payments for SaaS (two models) | [Payments for SaaS](https://www.airwallex.com/docs/payments-for-platforms__payments-for-saas) | Table: customers as owner vs platform as owner (who handles fees, disputes, refunds, reserve) |
| Platform as owner | [Platform as the owner of payments](https://www.airwallex.com/docs/payments-for-platforms__payments-for-saas__platform-as-the-owner-of-payments) | Platform collects, owns payment; Funds Split for fees; “Specific requirements may apply based on jurisdictions. Always speak to a member of the Airwallex team.” |
| Customers as owner | [Customers as the owner of payments](https://www.airwallex.com/docs/payments-for-platforms/use-cases/payments-for-saas/customers-as-the-owner-of-payments) | CA is MoR; platform stays out of funds flow |
| Payments for marketplaces | [Payments for marketplaces](https://www.airwallex.com/docs/payments-for-platforms/use-cases/payments-for-marketplaces) | Platform as MoR; Full CA model vs Ledger model (seller verification, fund ownership) |
| Gateway vs PSP-agnostic | [Choose your Payments for Platforms solution](https://www.airwallex.com/docs/payments-for-platforms/choose-your-payments-for-platforms-solution) | Gateway = Airwallex as acquirer; PSP-agnostic = your acquirer, Airwallex for settlement/payouts |
| Compliance | [Compliance requirements](https://www.airwallex.com/docs/payments-for-platforms__compliance-requirements) | Requirements must be met before go-live and are continually monitored; doc is non-exhaustive; contract/MSA applies |
| AU/NZ company KYC | [Documents required for companies in Australia and New Zealand](https://help.airwallex.com/hc/en-gb/articles/900001756866-Verifying-your-business-in-Australia-and-New-Zealand) | ABN/NZBN, incorporation/trust/partnership docs, beneficial owners, PPTA, authorisation letter; **Marketplace Questionnaire** if marketplace; **Evidence of required licenses/regulatory compliance in your industry** if applicable |

### 6.2 What you need for Platform as owner (qualifications / credentials)

The public docs do **not** state a single “you must hold license X” for platform-as-owner. They do say:

- **Jurisdiction-specific**: “Specific requirements may apply based on the jurisdictions to which you want to deliver services. Always speak to a member of the Airwallex team.” (Platform as the owner of payments.)
- **Compliance**: Requirements must be met before go-live and are continually monitored; the compliance doc is non-exhaustive and does not replace the contract/MSA.
- **What you provide (from Tara’s email and Help Centre):**
  1. **Standard platform entity KYC** (e.g. AU company): ABN, certificate of incorporation, proof of business address, ownership structure (UBOs), personal ID and proof of address for directors/signatories, authorisation letter (PPTA). See [Documents required for companies in Australia and New Zealand](https://help.airwallex.com/hc/en-gb/articles/900001756866-Verifying-your-business-in-Australia-and-New-Zealand).
  2. **Payments for Platforms / Payments activation**: Platform model (SaaS vs marketplace), **whether customers as owner vs platform as owner**, seller/buyer profile, volumes, **funds flows** (collect, split, payout, reserves), website/product info, T&Cs and refund policy, **compliance & risk** (sectors, **any additional licenses if applicable**, PCI-DSS if you touch card data).
  3. **Marketplace Questionnaire**: If you operate a **marketplace** (platform as MoR, connect buyers and sellers), Airwallex Help Centre requires the **[Marketplace Questionnaire](https://help.airwallex.com/hc/article_attachments/8211888402575)** for internal compliance.
  4. **Industry licenses**: “Evidence of required licenses/regulatory compliance in your industry” is listed under additional KYC requirements. So if your jurisdiction or industry requires a specific license (e.g. payment facilitator, e-money, or financial services), you may need to provide evidence; the exact need is jurisdiction- and model-dependent and should be confirmed with Airwallex.

**Summary**: For **platform as owner** you need (1) full platform business KYC, (2) clear description of model and funds flows (including that you are platform as owner), (3) Marketplace Questionnaire if you are a marketplace, and (4) any **jurisdiction- or industry-specific licenses** that apply to you (to be confirmed with Airwallex). There is no single “platform as owner = you must have e-money license” stated in the public docs; they defer to the team and jurisdiction.
