# Airwallex Webhook Multi-Tenant (Merchant ID) Implementation

## Problem

After migrating to multi-tenant, `merchant.webhooks_events_airwallex` and related tables use `merchant_id` as partition key. The webhook is called by Airwallex (external), so there is no request context (no `x-merchant-id` or JWT). We must derive `merchant_id` from the payload.

## When merchant cannot be resolved

If a webhook event does not match any order or payment record, we **cannot** assign a merchant. To avoid the transaction “disappearing” (only in logs):

- We **persist the event** in **platform.webhook_events_psp_unmatched** (no merchant_id): created/replaced by migration `1710000000259_platform_webhook_events_psp_unmatched.sql` (after `1710000000237_platform_webhook_events_airwallex_unmatched.sql` legacy table).
- **Idempotency**: If the same event_id is already in the unmatched table, we skip insert and still return 200.
- We return **200** so Airwallex does not retry.
- Ops can query `platform.webhook_events_psp_unmatched` to review and handle unmatched events. Implementation: `WebhookEventService.saveUnmatchedWebhookEvent()`, `isEventInUnmatched()`.

---

## Resolving merchant_id from payload

### 1. Payment Intent (e.g. WeChat Pay) – prefer metadata

- **Best**: When creating the Payment Intent, pass **metadata** including `merchant_id`. Airwallex supports a `metadata` object. The webhook payload includes `data.object.metadata`, so we read `merchant_id` directly (no mismatch, faster).
- **Fallback**: If `metadata.merchant_id` is missing, resolve by `merchant_order_id` → global order lookup → `order.merchantId`.
3. **PaymentController.handleWebhook**:
   - After verify signature: resolve `merchantId`; if null, use `WEBHOOK_PENDING_MERCHANT_ID` (env); if still null, return 200 and skip save.
   - Idempotency: `isEventProcessed(eventId, merchantId)`.
   - `runWithContextAsync(createRequestContext(merchantId), () => { saveWebhookEvent(...); res.sendStatus(200); setImmediate(...) })`.
   - In `setImmediate`, again `runWithContextAsync(merchantId, () => { updateEventStatus(PROCESSING); handleWebhookEvent(payload); updateEventStatus(PROCESSED/FAILED) })`.


### 2. Deposit (bank transfer)

Flow: **收款银行信息 → merchant_id**, then **within that merchant** match order or leave for manual match.

1. **TEMPORARY**: Use merchant with code `DEFAULT` for all deposit events until per-merchant bank account mapping (`platform.airwallex_deposit_account_merchant`) is in place. Code: `MerchantService.getByCode('DEFAULT')` → `merchant.id`. Replace with account_id lookup when ready.
2. **Resolve merchant by receiving bank (future)**: The deposit webhook payload includes `account_id` (Airwallex account that received the payment). We look up **platform.airwallex_deposit_account_merchant**: `airwallex_account_id` → `merchant_id`. When using per-merchant bank accounts (e.g. Airwallex payment for platform), each merchant has an `account_id`; configure one row per merchant.
3. **Within merchant, match order**: With `merchant_id` set in context, we match orders for that merchant only:
   - By **6-digit reference** (payment_reference), or
   - By **amount + date** (fuzzy), or
   - **No match** → create a payment record with `needs_manual_review = true` for that merchant so the merchant can match manually.

So: event comes in → resolve merchant_id from 收款银行信息 (account_id) → then 商户订单里根据支付信息模糊匹配订单，或无法匹配时由商户人工匹配.

### 3. Refund / Payout

- **Refund**: `merchant_order_id` → global order lookup → `order.merchantId`.
- **Payout**: `data.id` (payout id) → find `order_payment_records` by `transaction_id` (global) → `record.merchantId`.

---

## Processing flow

- **Sync**: Verify signature → resolve `merchant_id`. If failed → save to **platform.webhook_events_psp_unmatched**, return 200. Else → idempotency check → persist event in merchant table → return 200.
- **Async**: Run in `runWithContextAsync(merchantId)`: update status → `handleWebhookEvent(payload)` → update status (processed/failed).

---

## Code / DB references

- **platform.webhook_events_psp_unmatched**: Stores events that could not be resolved to a merchant (migration 1710000000259; legacy name from 1710000000237 is dropped in that step).
- **platform.airwallex_deposit_account_merchant**: Maps `airwallex_account_id` (receiving bank) to `merchant_id` (migration 1710000000237).
- **WebhookEventService.saveUnmatchedWebhookEvent**: Inserts into unmatched table when resolve fails.
- **WebhookMerchantResolver** (deposit): First lookup by `payload.account_id` in `airwallex_deposit_account_merchant`; fallback to reference/amount/date global order match.
- **WebhookAirwallexPaymentService.matchOrderByDepositReference**: Scoped to current merchant (getMerchantId()); creates manual-review record when no order match.
