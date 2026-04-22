# devStandard

Cross-project **normative docs** (contracts, JSON shapes, checklists) that are **not** full product PRDs.

| Doc | Role |
|-----|------|
| [`product-metadata-value-type-json-contract.md`](./product-metadata-value-type-json-contract.md) | `value_type` ↔ JSON — **backend-owned** draft table (Phase 3) |
| [`metadata-order-line-snapshot.md`](./metadata-order-line-snapshot.md) | Order line **metadata + schema context** — what to reuse vs new columns |
| [`metadata-search-index-pipeline.md`](./metadata-search-index-pipeline.md) | Search index **outbox + retries** — align with pending-event / webhook style |
| [`metadata-product-business-error-registry.md`](./metadata-product-business-error-registry.md) | **Business error codes** + CMS i18n key convention |
| [`metadata-phase3-engineering-defaults.md`](./metadata-phase3-engineering-defaults.md) | **Chosen defaults** for DDL types, revision hash, outbox table |

Runtime-shared **code** for the same contract should live in **`xituan_codebase`** and be imported by backend/CMS/site as needed.
