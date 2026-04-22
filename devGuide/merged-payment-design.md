# Merged Payment Design (Batch Payment)

## Purpose

Support "one payment for multiple orders": user pays once (one amount) and the system creates multiple independent orders (e.g. multi-merchant retail or different group-buys), linked by a batch. Terminology: avoid "parent/child" so it is not confused with refund's "parent payment record"; use **batch** and **batch payment** instead.

---

## 0. Webhook event and storage strategy

**Airwallex webhook event** is the same for single-order and batch: it is just a payment/deposit record. The only difference is in **metadata** (mobile) or the default object’s **order id** field: we may have `batch_id` or a single `order_id`. The system must not rely on a separate "batch event" type in storage.

**Current behavior** when persisting:
- Before writing to `webhooks_events_airwallex` we must resolve **merchant_id** and **order_id** (or batch): mobile uses `metadata.merchant_id` and `metadata.order_id` (or single order lookup); bank transfer matches by ref to get one (merchant_id, order_id). The table has one row per event with that single `merchant_id` and `merchant_order_id`.
- For **batch**, we have one event but **multiple orders and possibly multiple merchants**. The table is partitioned by merchant and has unique `(merchant_id, event_id)` (per partition), so the same `event_id` can appear in more than one partition if we use different `merchant_id`. We cannot store multiple order IDs in a single `merchant_order_id` column.

**Chosen approach (Option B – no separate batch event type):**

- Do **not** introduce a separate "batch event" table or record type. Keeping one table for both single-order and batch would otherwise lead to different fields and different branches when writing to payment history.
- **Flow (order of operations):** After the webhook is received, **first** persist the raw event to the **webhook event table** (one row per incoming Airwallex event). **Then** process the event: resolve order(s) and create payment records. So: webhook in → save to webhook event table → process → write to `order_payment_records` (and then payment history). The “为每个订单写一条记录” is the step that happens **after** the webhook event is saved, when we write into the payment record table.
- When the webhook indicates a **batch** (metadata `batch_id` or ref → batch):
  1. Resolve **batch_id** and load from the batch table the list of orders (order_id, merchant_id, amount).
  2. Create **one payment record per order** in the existing payment record table (`order_payment_records`), each with:
     - `order_id`, `merchant_id`, `amount` (that order’s share), `transaction_id` (same for all, e.g. payment_intent_id or deposit_id).
     - New field: **`batch_id`** so the key is effectively (order_id + batch_id) for batch payments; single-order payments leave `batch_id` null.
  3. These records are then processed by the **same pipeline** one-by-one into payment history (revenue): no separate "batch event" branch, just an extra `batch_id` (and possibly a batch-type flag) on the payment record / revenue where needed.
- **Refund**: 可退金额 must be based on the **current order’s payment record amount** (该订单用于支付创建的总额), not the batch total. Use `batch_id` to find per-order records; for each order the cap is that order’s payment record row amount. Two-layer check: (1) refund for one order ≤ that order’s payment record amount; (2) optionally total refunds for the batch ≤ batch total.

### Writing to `webhooks_events_airwallex` for batch

- **Schema**: Table has `merchant_id`, `merchant_order_id` (single UUID), and (after migration) nullable `batch_id`. Unique constraint is `(merchant_id, event_id)` per partition, so the same `event_id` can appear in multiple rows with different `merchant_id`.
- **Single-order (unchanged)**: Resolve one `merchant_id` and one `merchant_order_id` → write **one** row.
- **Batch**: Resolve `batch_id` from payload (metadata or ref→batch), then load batch to get the list of (order_id, merchant_id). Write **one row per distinct merchant** in that batch:
  - Same `event_id`, same `raw_payload`, same `payment_intent_id` / deposit id.
  - `merchant_id` = that merchant.
  - `merchant_order_id` = **null** (no single order).
  - `batch_id` = the batch UUID (new column).
  So each merchant in the batch has a row in their partition; "list my webhook events" for that merchant will show the event. We still process the event **once** (idempotency by `event_id`): when processing, take any row with this `event_id`, if `batch_id` is set then load batch and create N rows in `order_payment_records`; then update **all** rows with this `event_id` to status PROCESSED.
- **Resolve order before write**: For single-order we resolve (merchant_id, order_id) then write one row. For batch we must resolve **before** write too: from metadata get `batch_id` (or for bank transfer match ref → batch), load batch to get the set of merchant_ids, then write one row per merchant with `batch_id` set and `merchant_order_id` null. So the "match merchant id and order id" step becomes: **either** (merchant_id, order_id) for single **or** (batch_id → list of merchant_ids) for batch; then insert one or N rows accordingly.

---

## 1. Mobile (Airwallex Payment Intent)

- **Metadata**: Airwallex allows custom metadata. Use it to carry either:
  - `batch_id` (UUID) when paying for a batch of orders, or
  - `order_id` (single order) for backward compatibility.
- **Flow**: Create one Payment Intent with total amount; webhook resolves `batch_id` or `order_id` from metadata, then either confirms one order or all orders in the batch. No change to the 6-digit ref: mobile does not use it.

---

## 2. Bank Transfer – Constraint

- User can only enter **one** reference (e.g. 6-digit) in the bank transfer. There is no structured metadata like mobile.
- So for merged payment, that **single ref must identify the whole batch**, not a single order.

---

## 3. Bank Transfer – Recommended Flow

### 3.1 Batch and ref assignment

- Introduce a **payment batch** (e.g. table `payment_batches` or `merged_payment_sessions`):
  - `id` (UUID), `reference` (6-digit, unique), `total_amount`, `currency`, `status`, `created_at`, etc.
- Batch has many orders (e.g. `payment_batch_orders`: `batch_id`, `order_id`, `merchant_id`, `amount`).
- When user chooses **merged payment + bank transfer**:
  1. Create all orders (each order may have `payment_reference` = null or leave as legacy field when in a batch).
  2. Create one batch with a **single generated 6-digit reference** (same format as current `generatePaymentReference()`).
  3. Store which orders belong to the batch and each order’s amount.
  4. Show user: "Please transfer **total X** and use reference **123456**."

So: **one ref = one batch** (multiple orders). Single-order bank transfer stays as today: one ref per order on `orders.payment_reference`.

### 3.2 Matching when deposit arrives (webhook)

Current logic:

1. Match by **reference** → one order (`orders.payment_reference`).
2. If no match, match by **amount + date** (one or many orders).

Add a step **before** (or in parallel with) single-order match:

- **Match by reference to batch**: if `reference` equals a batch’s `reference`, and incoming `amount` equals the batch’s `total_amount` (and optionally date in valid range), then:
  - Create payment record(s) for this deposit (one per order or one batch-level record, depending on your payment record model).
  - Mark **all orders in that batch** as paid and run normal post-payment logic (inventory, notification, etc.).

Order of checks can be:

1. Try **batch**: ref + total amount (and maybe date) → batch found → confirm batch.
2. Else try **single order**: ref → order with `payment_reference` = ref → confirm that order.
3. Else **amount + date** (single or multiple orders, existing logic).
4. Else **manual review**: staff assign deposit to one order or to a batch.

So: **one 6-digit ref is enough** for merged payment because the batch is the only entity that has that ref; the ref is unique per batch.

### 3.3 Manual handling

- If deposit cannot be auto-matched (wrong amount, wrong ref, or multiple candidates), send to **manual review**.
- In CMS, staff can:
  - Assign the deposit to **one order** (current behaviour), or
  - Assign to a **batch** (new): select batch by ref or by list; system checks that deposit amount = batch total, then confirms all orders in the batch.

### 3.4 Ref uniqueness

- Batch ref must be **unique** among batches and, if possible, not clash with single-order refs. Options:
  - Same 6-digit space: ensure batch ref is not reused as `orders.payment_reference` for the same period (e.g. same 7-day window), or
  - Reserve a range (e.g. 900000–999999 for batches) and match by ref range (batch vs order) before doing the DB lookup.

---

## 4. Summary

| Channel        | How to identify "what is paid"     | Merged payment handling                                      |
|----------------|------------------------------------|---------------------------------------------------------------|
| Mobile (PI)    | Metadata: `batch_id` or `order_id` | One Payment Intent, metadata = batch_id; webhook confirms batch. |
| Bank transfer  | Single 6-digit ref                 | One ref per **batch**; match ref + total amount to batch, then confirm all orders in batch. |

So for bank transfer merged payment: **one ref number per batch**, user pays the batch total and enters that ref; when the deposit arrives, match ref (and amount) to the batch and confirm all orders in one go. Manual review can still assign a deposit to a single order or to a batch if auto-match fails.

---

## 5. Data model summary (Option B)

| Layer | Single-order | Batch |
|-------|--------------|------|
| **Webhook (Airwallex)** | One event, metadata/object has order_id or ref | One event, metadata has batch_id or ref → batch |
| **webhooks_events_airwallex** | One row: merchant_id, merchant_order_id = order_id, batch_id = null | **One row per merchant** in batch: same event_id, merchant_id = that merchant, merchant_order_id = null, batch_id = batch UUID |
| **order_payment_records** | One row: order_id, transaction_id, batch_id = null | N rows: one per order, same transaction_id, same batch_id |
| **Payment history (revenue)** | Same logic per payment record | Same logic per payment record; add batch_id (or batch-type) if needed for reporting/refund |
| **Refund** | Per-order only | Two-layer: per-order cap + batch total cap |

- **order_payment_records**: add nullable `batch_id` (UUID). For a batch payment, all N rows share the same `transaction_id` and `batch_id`; each row has its own `order_id`, `merchant_id`, `amount`.
- Revenue table: add nullable `batch_id` (or equivalent) if refund or reporting needs to group by batch; otherwise refund can join order_payment_records by batch_id.
- **Refund – 可退金额 (refundable amount):** Today, refund logic uses the **payment record’s total payment amount** as the cap. With batch payment we must **not** use “支付总额” (batch total) for a single order. The cap must be **当前订单用于支付创建的总额**: i.e. the amount on **that order’s** payment record row (the row with this `order_id` and optional `batch_id`). So: for each order, “original amount” and “already refunded” are computed from the payment record row(s) for that order only; refunds for that order must not exceed that row’s amount. Optionally add a second check at batch level: total refunds for the batch ≤ batch total.
- **Shared `transaction_id` – no unique conflict:** The table `order_payment_records` has primary key `(id, merchant_id)` (partitioned by merchant). There is **no unique constraint** on `transaction_id`. Multiple rows with the same `transaction_id` (one per order in a batch) are therefore allowed and do not violate any key.
