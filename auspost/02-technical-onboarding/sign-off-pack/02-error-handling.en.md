# 2. Error Handling / Address / Basket / Availability

Last updated: 2026-11-12  
Company: Galaxy108 Pty Ltd / Xituan

Supports **MPB Tech Sign Off** §§11–15.

---

## §11 Error Handling

### End-user visible (merchant CMS / pack bench)

The platform returns stable business error codes with client-side i18n. Raw AusPost English error bodies are not dumped to the merchant UI.

| Business code | Typical trigger | Merchant-facing meaning |
|---------------|-----------------|-------------------------|
| `AUSPOST_MPB_NOT_CONNECTED` | No connection | Connect MyPost Business first |
| `AUSPOST_MPB_CONNECTION_INVALID` | organisations failure / bad token | Re-paste Partners Token |
| `AUSPOST_MPB_QUOTE_FAILED` | No usable price | Check packaging/address and retry |
| `AUSPOST_MPB_PAYMENT_FAILED` | 401/403 or STORED_PAYMENT message | Check card on file / token; connection flagged `needs_attention` |
| `AUSPOST_MPB_LABEL_FAILED` | General create/label failure | Retry or contact support |
| `AUSPOST_MPB_LABEL_UNAVAILABLE` | Charged but PDF URL failed | Keep tracking number; retrieve label in MyPost Business |
| `DISPATCH_PACKAGING_INVALID` | OWN missing weight/dimensions | Complete required fields (no guessed defaults) |

`needs_attention` is set **only** for auth/payment-class failures (401/403 or body indicating unauthenticated / stored_payment issues). Packaging validation failures do not mark the connection unhealthy.

### Troubleshooting ownership

| Party | Responsibility |
|-------|----------------|
| Merchant | Card on file, Partners Token, label retrieval in MyPost; follow CMS guidance |
| Xituan support | Backend logs (token redacted), connection status, business codes, partial tracking |
| AusPost | Partner/testbed credentials and API incidents; [status.developers.auspost.com.au](https://status.developers.auspost.com.au) |

Timeouts: Labels use `wait_for_label_url`. On timeout / missing URL → `LABEL_UNAVAILABLE` path; tracking remains available so the merchant can recover from MyPost without reading source code.

Server logs: HTTP status + redacted body; **never** echo the full merchant token.

### Checklist (Sign Off §11)

- [x] Allows recovery after ~55 seconds / no response / timeout on label wait
- [x] Interprets Shipping & Tracking API errors into meaningful end-user messages (via business codes + i18n)
- [x] Provides a process for the end user to recover shipment/manifest information (tracking retained; MyPost portal for labels)
- [x] Custom/internal errors direct the end user to contact their IT / business support (Xituan support)

---

## §12 Address Validation

- Fulfilment addresses come from the order / merchant sender snapshot (AU structured fields: name, lines, suburb, state, postcode).
- Mapped to MPB `from` / `to` via the platform address util.
- Validate Suburb API is **not** called separately; we rely on order-side AU address validation plus MPB create-shipment error responses.
- Invalid / rejected addresses: shipment create fails → business code + retryable; no half-created local shipment left after order failure (unordered shipments are DELETEd from the basket).

---

## §13 Basket Size

- On label/order failure: `DELETE /shipments/{id}` clears unordered basket entries.
- Single Create Order: one pack-bench confirm per order; article count is well below the 2,000 limit. We adhere to **≤ 2,000 articles per Create Order**.
- Basket-exceeded (10,000) errors are mapped to create/label failure business codes with retry / support guidance. The normal single-order path does not approach the limit.

---

## §14 Limitations and considerations

- Domestic only; `STORED_PAYMENT`; no Charge Account / Pickup / International in this phase.
- Flat-rate Create Shipments **omit** weight/dimensions; OWN packaging **requires** weight + three dimensions.
- Label PDFs are not retained long-term in our S3 (AusPost URL ~48h); on timeout we direct merchants to MyPost Business.
- Tracking status is retrieved via the Track Items API and presented in the merchant/customer experience.

We adhere to the **2,000 maximum article limit per Create Order** (Yes).

---

## §15 Service Availability and Status

- Operations subscribe to AusPost developer status updates at status.developers.auspost.com.au.
- Platform: standard health checks; planned maintenance is communicated through existing merchant/status channels.
- Formalised process for communicating planned outages: **Yes**.
