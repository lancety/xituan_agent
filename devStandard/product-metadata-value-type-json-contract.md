# Product metadata: `value_type` ↔ JSON contract (draft)

> **Status**: placeholder — fill in Phase 3. **Single source of truth** for CMS forms, backend validation, and `product_metadata_search_index` column typing.  
> **Related plans**: `xituan_agent/devGuide/product_metadata_开发计划_b162e071.plan.md` (§15, §21–§28).

## Principles

- Align with workspace **date-only** rules: `YYYY-MM-DD` strings for date-only fields in API payloads where applicable.
- No `any` in TypeScript implementations; enum **codes** in JSON, not DB surrogate ids.

## Contract table (TBD)

| `value_type` | JSON shape in `products.metadata[jsonKey]` | Validation notes | Notes for search index |
|--------------|----------------------------------------------|------------------|-------------------------|
| … | … | … | … |

*(Add rows: STRING, NUMBER, BOOLEAN, MULTILINGUAL, ENUM, DATE-only vs DATETIME if any, etc.)*
