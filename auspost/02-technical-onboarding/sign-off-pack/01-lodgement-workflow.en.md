# 1. Lodgement Plan / Product Features / API Calls

Last updated: 2026-11-12  
Company: Galaxy108 Pty Ltd / Xituan  
Partner / testbed ID: TESTBED-XITUAN-8745  
Implementation: `xituan_backend` AusPost MPB Shipping & Tracking integration

This document supports **MPB Tech Sign Off** §§3–9.

---

## §3 Lodgement Plan (integration workflow)

Merchant connects MyPost Business in the CMS pack bench by pasting their Partners Token. The platform then calls MPB using Partner credentials plus the merchant token.

```text
1) GET  /organisations          — validate token on connect; store encrypted Connection
2) POST /prices/items           — OWN packaging quote (flat-rate uses a local rate table; no prices call)
3) POST /shipments              — one request may include multiple parcels (same order)
4) PUT  /orders                 — Create Order from Shipments; payment_method=STORED_PAYMENT
5) POST /labels                 — wait_for_label_url=true; layout=A6-1pp or A4-4pp
6) DELETE /shipments/{id}       — roll back unordered shipments on order failure; basket management
7) GET  /track                  — shipment tracking status (end users do not call AusPost directly)
```

Failure summary: quote failure blocks label creation; order failure DELETEs created shipments; label URL failure keeps tracking and directs the merchant to MyPost Business to retrieve the label (`AUSPOST_MPB_LABEL_UNAVAILABLE`).

**Out of scope this phase:** Create International Shipment, Pickup within Order, Charge Account, OAuth Authorisation Code.

---

## §4 Product Features

| Feature | This phase |
|---------|------------|
| Signature on Delivery | Supported (OWN / applicable products; `features.SIGNATURE_ON_DELIVERY`) |
| Extra Cover | Not supported |
| Pickup within Order | Not supported |

Domestic products: Own packaging Parcel/Express (testbed `BE1P10` / `BE9P10`) plus AusPost flat-rate box/satchel (`BE1*` / `BE9*` mapping). International products: not supported.

Label layouts:

| UI | API `layout` |
|----|----------------|
| A6 | `A6-1pp` |
| A4 (4 labels per page) | `A4-4pp` |

---

## §5 API Calls (implemented)

**Implemented**

- Get Organisation
- Create Domestic Shipment
- Create Order from Shipments
- Create Label
- Delete Shipment
- Track Items
- Get Item Price (`POST /prices/items`, OWN path)

**Not implemented this phase**

- Create International Shipment
- Create Payment with Charge Account
- Pickups / Get Label (standalone) / Get Order / Get Shipment / Update Item / Validate Suburb
- Create Order Including Shipments (we use Create Order **from** Shipments)
- OAuth (§8 = No)

---

## §6 Create Orders from Shipments

Within a single confirm action, all parcels for the order are submitted in **one** `PUT /orders` with `shipments: [{shipment_id}, …]` so multiple STORED_PAYMENT charges in quick succession are avoided.

---

## §7 Pickup

Not applicable. No Pickup commitments beyond N/A for this phase.

---

## §8 OAuth

**No** — merchants copy the Partners Token from the MyPost Business dashboard. Production OAuth is deferred.

---

## §9 JSON payloads and labels

See attached request/response JSON captures and label PDFs (Express Post A6 + A4-4pp; Parcel Post A6).
