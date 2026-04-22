# Phase 3 metadata — engineering defaults (chosen)

> **Authority**: complements [`../devGuide/product_metadata_开发计划_b162e071.plan.md`](../devGuide/product_metadata_开发计划_b162e071.plan.md) §23–§30. When code diverges, update **this file** or the plan.

---

## 1) `order_items` DDL (recommended)

| Column | Type | Nullable | Notes |
|--------|------|----------|--------|
| `metadata_snapshot` | `jsonb` | **YES** until backfill; new rows **NOT NULL** when product has metadata | Copy of `products.metadata` at line creation |
| `schema_context_category_id` | `uuid` | **YES** legacy; **NOT NULL** for new lines | Leaf `category_id` used for `getEffectiveMetadataSchema` |
| `effective_schema_revision` | **`varchar(64)`** | **YES** legacy; **NOT NULL** for new lines | **64-char hex** = SHA-256 of **canonical minimal schema JSON** (sorted keys, slim field list) at order time — no global counter, no clock skew |

**Why `varchar(64)` not `bigint`**: stable cross-node, easy to compare with API `schemaVersion` string if both use same hash; avoids inventing a distributed sequence.

**Migration**: one file under `xituan_backend/migrations/` next index; **order domain** owns review of `NOT NULL` vs phased backfill.

---

## 2) CMS i18n

- Add **`errors.business.<CODE>`** under `xituan_cms/messages/*.json` (same keys in `en`, `zh`, `zh_cn`, `zh_tw`).
- Until CMS uses `next-intl` (or equivalent) with that prefix everywhere, generic handlers may still show raw `code` — keys are ready for Phase 3 UI.

---

## 3) Copy / category APIs → new error codes

- **When** duplicate-product or category-change validation exists in backend, throw **`PRODUCT_METADATA_COPY_INVALID`** / **`PRODUCT_CATEGORY_METADATA_MIGRATION_REQUIRED`** per registry.
- **Until** those endpoints exist, enum entries are **reserved**; no runtime change required.

---

## 4) Search index outbox table (recommended)

**New table** (keeps payment webhooks independent):

- **Name**: `merchant.product_metadata_search_index_outbox`
- **Columns (minimal)**: `id uuid PK`, `merchant_id uuid`, `product_id uuid`, `effective_schema_revision varchar(64) null` (optional hint), `status text`, `retry_count int default 0`, `last_error text null`, `created_at timestamptz`, `updated_at timestamptz`
- **Semantics**: insert **after** product + migration stable; worker **idempotent** upsert into `product_metadata_search_index`; **retry_count** cap + DLQ row or `status=dead` + alert — same **ops story** as webhook pending rows.

---

## 5) `effective_schema_revision` generation

- **Single function** in backend (e.g. next to `getEffectiveMetadataSchema`): build **canonical JSON** of merged schema **fingerprint** (only: `jsonKey`, `value_type`, `required`, enum codes order, `require_exact_enum_match` if present) → **`sha256` → hex string (64 chars)**.
- **API** may expose the same value as `schemaVersion` string for conditional GET later.
- **Order line** stores whatever the API used at checkout.

---

*Chosen by implementation agent to unblock Phase 3 without further product meetings.*
