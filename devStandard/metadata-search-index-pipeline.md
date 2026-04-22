# Metadata search index: outbox, retries, unification

## Goal

After **migration tasks complete** and **`products.metadata` is stable**, refresh **`product_metadata_search_index`** (or equivalent projection) **asynchronously** so list/facet queries stay fast without blocking the main request.

## Retry policy (unified with existing “pending event” style)

Use the **same operational pattern** as other durable async work in this repo (e.g. payment **webhook pending rows** with `status`, **`retry_count`**, and bounded replays):

1. **Persist a pending row** (or queue message) when a product/category/binding change should reindex.
2. **Worker / cron** picks pending rows, runs idempotent projection, marks **processed** or **failed**.
3. On transient failure: **`retry_count + 1`** until **max retries** (configurable), then **dead-letter / admin alert** (same philosophy as webhook retry tooling — **one place** for ops runbooks).

Concrete table names live with the team that owns search; this document fixes **ordering + retry semantics** only.

## Ordering (hard rule)

**Never** write search projection **before**:

- metadata **migration task** for the affected scope is **successfully finished**, and  
- **`products` row** reflects the final metadata for indexing.

Emit the outbox event **after** DB commit of those changes.
