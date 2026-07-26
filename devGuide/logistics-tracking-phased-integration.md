# Logistics tracking — phased integration plan

> Related design: consumer-facing tracking here aligns with the merchant dispatch/booking flow in [`../docs/delivery/unified-dispatch-pipeline-design.md`](../docs/delivery/unified-dispatch-pipeline-design.md) (section 13: tracking webhooks, manual carrier tracking URLs, cancellation boundaries).

## Purpose

Define how the platform exposes shipment tracking to end customers while keeping **early phases low-integration** (manual data + official carrier pages) and leaving a clear path to **per-carrier APIs** and optional **merchant-owned credentials (BYOK)** later.

**Related backlog:** `../xituan_backend/todo/logistics-tracking-phased-integration.md`

---

## Phase 1 — Manual tracking number + official lookup (MVP)

### Behaviour

- Merchant (or CMS user) enters **carrier** and **tracking number** on the shipment / order fulfilment record.
- Customer sees tracking number and a **“Track on carrier site”** action.

### Carrier lookup URL (template)

- Maintain a **carrier registry** in code or DB: stable `carrierCode` → **official tracking URL template** with a placeholder for the tracking number (e.g. query param or path segment).
- At render time, substitute the placeholder with the URL-encoded tracking number.

### Link vs iframe

- **Prefer opening the official page in a new browser tab** (`target="_blank"`, `rel="noopener noreferrer"`). Simple and works on mobile.
- **Avoid relying on iframes** for generic carrier sites: many sites send `X-Frame-Options` or CSP `frame-ancestors` that **block embedding**; cookies, login flows, and mobile layouts also break easily inside iframes.
- If an iframe is required for a specific carrier, **validate that carrier’s page allows embedding** before offering iframe mode; default remains external link.

### Platform responsibilities (product / legal copy)

- Disclaim that tracking content is provided by the **third-party carrier**; the platform does not guarantee real-time accuracy on this phase.

---

## Phase 2 — Normalised carrier model (still no carrier API)

- Single source of truth for **display name**, **carrier code**, **URL template**, optional **region** or **notes**.
- Optional **per-merchant override** only if needed (e.g. regional subdomain); document when overrides are allowed.

---

## Phase 3 — Merchant-provided API credentials (BYOK) and per-carrier APIs

### Goal

- Let merchants bind **their own** carrier developer accounts (keys / tokens / customer codes as required by each carrier).
- Platform stores credentials **encrypted**, scoped by **merchant** (and environment), and uses them **server-side only** to call carrier **create label / cancel / query track** APIs where supported.

### Phased carrier support

- Add carriers **one at a time**: adapter interface (normalize request/response), rate limits, and idempotency keys per carrier docs.
- Prefer **webhooks or push** for track updates when the carrier supports it; otherwise **polling** with backoff and caching.

### Liability and billing (non-legal summary)

- **Technical design alone does not shift legal liability.** Carriers usually bill and contract with the **account that owns the API credentials / customer code**.
- To align “merchant as first responsible party” with product intent: prefer **merchant-owned carrier accounts** and merchant-facing terms; involve legal counsel for contracts and merchant agreements.

---

## Backend / data sketch (implementation-agnostic)

- Shipment or fulfilment record: `carrierCode`, `trackingNumber`, optional `trackingUrlOverride` (if template is insufficient).
- Later: `merchantCarrierCredentialId`, encrypted secret store, last track sync time, cached track events JSON (if API phase).

---

## Open decisions

- Whether tracking URL templates live in **DB** (CMS-editable) or **versioned config** in code first.
- Whether customer-facing tracking is served only from **site/wechat** or also a **dedicated public API** with auth.

---

## References

- In-repo backlog: `../xituan_backend/todo/logistics-tracking-phased-integration.md`
- Related shipping/label work (separate initiative): `../xituan_backend/todo/print-thermal-labels.md`
