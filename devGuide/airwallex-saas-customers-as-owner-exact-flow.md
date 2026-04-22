# Airwallex SaaS “Customers as Owner” – Exact Flow from Official Docs

This doc is derived **only** from official Airwallex documentation reached by following links (no web search). It answers: (1) when funds land in the Connected Account and whether the merchant can withdraw before split; (2) exact create/split/release/refund flow; (3) document URLs for each step.

---

## 1. Source documents (exact URLs)

| Topic | URL | Content used |
|-------|-----|--------------|
| Collect on behalf of CA | https://www.airwallex.com/docs/payments-for-platforms__process-payments-and-manage-funds__collect-payments-on-behalf-of-connected-accounts | End-to-end flow, settlement wording |
| Create FundsSplit (API) | https://www.airwallex.com/docs/api/payments/funds_splits/create | Timing: after succeed, before settlement; `auto_release` |
| Release FundsSplit (API) | https://www.airwallex.com/docs/api/payments/funds_splits/release | When to call, endpoint |
| Payments for SaaS overview | https://www.airwallex.com/docs/payments-for-platforms__payments-for-saas | Two models, who is MoR |
| Customers as owner (use case) | https://www.airwallex.com/docs/payments-for-platforms/use-cases/payments-for-saas/customers-as-the-owner-of-payments | Funds flow, split from CA to platform |
| Understanding P4P | https://www.airwallex.com/docs/payments-for-platforms/understanding-payments-for-platforms | High-level capabilities |
| Refunds | https://www.airwallex.com/docs/payments__refunds | Full/partial refund, funding source |

---

## 2. “先进商户 Connected Account” – when can merchant withdraw?

### 2.1 Key sentence (Collect on behalf of connected accounts)

After the platform creates the FundsSplit (step 4 in that doc), the doc states:

> **Funds will be settled to both parties' wallets based on split portion**, where platform receives 10 GBP as commission and connected account receives 85 GBP (5 GBP Airwallex fees being netted).

So:

- **Settlement** happens **after** the FundsSplit is created.
- Settlement is **“based on split portion”**: the CA is credited with **(amount − split − fees)**, not the full payment amount.
- There is **no** step where “full amount lands in CA, then platform creates split”. The split is created **before** settlement; at settlement, only the split portions are credited.

### 2.2 Create FundsSplit timing (API doc)

From [Create a FundsSplit](https://www.airwallex.com/docs/api/payments/funds_splits/create):

> A FundsSplit can be created **only after the PaymentIntent succeeds and before funds settlement**. Subscribe to `payment_intent.succeeded` webhook to confirm if the payment was successful or alternatively provide `funds_split_data` directly in Create/Confirm/Capture a PaymentIntent request.

So:

- Create split: **after** PaymentIntent succeeds (capture done), **before** funds settlement.
- At settlement time the split is already in place; the CA’s wallet is credited with the **net** (after split and fees).
- **Conclusion**: In “customers as owner”, the merchant **cannot** withdraw the “full” payment before split, because the full amount never reaches the CA’s available balance. Only the net amount (e.g. 85 in the 100/10/5 example) is settled to the CA. Your requirement “不希望到账之后 创建split并release之前 商户可以动这笔钱” is satisfied by this design.

### 2.3 Optional: create split in same flow as capture

The “Collect on behalf” doc also says (for Hosted/Embedded/Drop-in/Mobile):

> In the case of Hosted Payment Page/Embedded Fields/Drop-in/Mobile Integration, platform can **bypass step 2&3 but needs to create the FundsSplit request after receiving notifications that the payment is successfully captured**.

So best practice: on **payment_intent.succeeded** (or equivalent “payment successfully captured” notification), create the FundsSplit immediately so it is always in place before settlement.

---

## 3. Exact flow (Customers as owner – Collect on behalf of connected accounts)

From [Collect payments on behalf of connected accounts](https://www.airwallex.com/docs/payments-for-platforms__process-payments-and-manage-funds__collect-payments-on-behalf-of-connected-accounts):

1. **Create PaymentIntent** (on behalf of CA)  
   - `POST /api/v1/pa/payment_intents/create`  
   - Header: `x-on-behalf-of: <connected_account_id>`  
   - Body: `request_id`, `merchant_order_id`, `amount`, `currency`

2. **Confirm PaymentIntent** (on behalf of CA)  
   - `POST /api/v1/pa/payment_intents/{id}/confirm` (or equivalent)  
   - Header: `x-on-behalf-of: <connected_account_id>`  
   - Body: `payment_method` (e.g. card)

3. **Capture PaymentIntent** (on behalf of CA)  
   - `POST /api/v1/pa/payment_intents/{id}/capture`  
   - Header: `x-on-behalf-of: <connected_account_id>`  
   - Body: `amount`  
   - (Or use auto-capture so step 3 is implicit.)

4. **Create FundsSplit** (platform commission from CA to platform)  
   - **Only after** PaymentIntent succeeds, **before** funds settlement ([Create FundsSplit API](https://www.airwallex.com/docs/api/payments/funds_splits/create)).  
   - `POST /api/v1/pa/funds_splits/create`  
   - Header: `x-on-behalf-of: <connected_account_id>` (same CA that owns the payment)  
   - Body: `request_id`, `source_id` = payment_intent_id, `source_type` = PAYMENT_INTENT, `amount` (commission), `destination` = platform account_id, optionally `auto_release` (default true).  
   - For “release at 交货阶段”: set **`auto_release: false`**.

5. **Settlement**  
   - “Funds will be **settled to both parties' wallets based on split portion**” (from the same doc).  
   - CA receives (captured amount − split amount − Airwallex fees).  
   - Platform receives the split amount (and, if `auto_release: false`, that part is held until release).

6. **Release (only when `auto_release: false`)**  
   - When your system determines “交易交货阶段” (e.g. order delivered / confirmed), call:  
   - [Release a FundsSplit](https://www.airwallex.com/docs/api/payments/funds_splits/release): `POST /api/v1/pa/funds_splits/{id}/release`  
   - Body: `request_id`.  
   - Doc: “Call this endpoint when you are ready to let the funds arrive at the destination. A FundsSplit is capturable if `auto_release=false`.”

---

## 4. Refunds (from Refunds doc)

From [Refunds](https://www.airwallex.com/docs/payments__refunds):

- Create refund against the **Payment Intent** (or Payment Attempt). In “customers as owner”, the payment belongs to the CA, so **refundable funds** are the CA’s: available balance + unsettled funds (same currency).
- **Full or partial refund**: you can send multiple partial refunds until the principal is covered.
- Refund succeeds only when the CA has enough “refundable funds” (unsettled and/or available balance). So “扣除手续费后余额退还” is implemented by your logic computing the refund amount (e.g. original − fee), then calling the refund API with that `amount`; Airwallex does not auto-deduct a fee from the refund.

---

## 5. Summary table (exact flow)

| Step | Action | Doc link |
|------|--------|----------|
| 1 | Create PaymentIntent with `x-on-behalf-of: CA` | Collect on behalf of connected accounts |
| 2 | Confirm PaymentIntent (on behalf of CA) | Same |
| 3 | Capture PaymentIntent (on behalf of CA) | Same |
| 4 | On `payment_intent.succeeded`, create FundsSplit (source = payment_intent_id, destination = platform, optional `auto_release: false`) | Create FundsSplit API (only after succeed, **before settlement**) |
| 5 | Settlement: funds settled to both wallets **based on split portion** (CA gets net; platform gets split; if `auto_release: false`, platform’s share is held until release) | Collect on behalf of connected accounts |
| 6 | When 交货阶段: `POST /api/v1/pa/funds_splits/{id}/release` | Release a FundsSplit API |
| 7 | Refund: create refund on Payment Intent with desired `amount` (e.g. after deducting fee); funds debited from CA | Refunds |

---

## 6. Direct answer to “商户能提现吗？”

- **“先进商户 Connected Account”** in this model means: at **settlement**, the CA is credited with the **split portion** (amount − platform split − Airwallex fees), not the full payment.
- So the merchant **can** withdraw only what was settled to the CA (the net amount). The platform’s commission (the FundsSplit) is **not** part of the CA’s balance; it is either auto-released to the platform or held until you call Release.
- There is **no** state where “full payment has landed in CA and split not yet created”: the API requires split to be created **before** settlement, and settlement is **based on split portion**. So your requirement “到账之后 创建split并release之前 商户不能动这笔钱” is met: the portion you keep never lands in the CA.

All references above are to the exact Airwallex doc URLs listed in section 1.
