# Order line: metadata + schema context (what to reuse vs add)

## What exists today

`merchant.order_items` already stores **snapshots** that are **not** live product joins, e.g.:

- **`product_name`** — `jsonb` multilingual snapshot at order time (same idea as “freeze what the buyer saw”).

There is **no** column today for **`products.metadata`**, **`category_id` used for schema**, or **`effective_schema_revision`**.

## What “复用” means here

- **Do not** overload `selected_options` or `product_name` to carry schema revision or category context — they are different domains.
- **Reuse the snapshot pattern**: add **dedicated columns** (or one `jsonb` envelope if you prefer fewer columns) alongside existing line fields, same spirit as `product_name`.
- **Optional reuse of doc-versioning**: when invoice/receipt needs metadata-aware diff, extend **`iOrderItemDocRelevantSnapshot`** / bump rules in `orderDocumentContentVersion.util.ts` — same mechanism as other doc-relevant fields.

## Recommended new columns (semantic names; DDL by order domain)

| Column | Purpose |
|--------|---------|
| **`metadata_snapshot`** | `jsonb` — copy of `products.metadata` at checkout / line creation |
| **`schema_context_category_id`** | `uuid` — **leaf** `category_id` used to compute effective schema for that snapshot (frozen; product may move later) |
| **`effective_schema_revision`** | **`varchar(64)`** — SHA-256 hex of canonical merged-schema fingerprint (see [`metadata-phase3-engineering-defaults.md`](./metadata-phase3-engineering-defaults.md)) |

Exact SQL names/types follow **`order_items`** migration owned by the order team; this doc is the **semantic contract** for metadata/order integration.
