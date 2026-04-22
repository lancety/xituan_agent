# Product metadata: business error registry (CMS + API)

> **Purpose**: single lookup for **`eBusinessErrorCode`**, HTTP expectations, and **CMS i18n key** convention.  
> **Owner**: add new rows when introducing codes; keep **`xituan_codebase`** enum in sync (submodule bump across apps).

## i18n convention (CMS)

- Prefer key path: **`errors.business.<CODE>`** (e.g. `errors.business.PRODUCT_METADATA_INVALID`), where `<CODE>` equals the enum string value.
- If a code shares UX with another, map both keys to the same component handler until split is needed.

## Registry

| `eBusinessErrorCode` | HTTP | When raised | CMS / client note |
|----------------------|------|--------------|-------------------|
| `PRODUCT_METADATA_INVALID` | 400 | Save/patch product: keys/types/required vs effective schema | Block save; highlight invalid keys |
| `PRODUCT_METADATA_SCHEMA_TYPE_CONFLICT` | 400 | `getEffectiveMetadataSchema` / entityFields merge: same jsonKey, incompatible types | Fix template/bindings; do not silent fallback |
| `PRODUCT_METADATA_COPY_INVALID` | 400 | Duplicate product: copied `metadata` fails validation for **target** category | Pre-validate in CMS; show same message if backend rejects |
| `PRODUCT_CATEGORY_METADATA_MIGRATION_REQUIRED` | 400 / 409 | Category change blocked until mini-wizard / mapping complete (Phase 3) | Deep-link to wizard |

## Implementation note

- Enum values live in **`xituan_codebase/typing_api/business-error.enum.ts`** (canonical submodule).  
- **`PRODUCT_METADATA_COPY_INVALID`** and **`PRODUCT_CATEGORY_METADATA_MIGRATION_REQUIRED`** were added in the backend submodule pointer revision that accompanies this registry; **other apps** must **pull the same submodule commit** or cherry-pick the enum change.
- CMS copy: **`xituan_cms/messages/*.json`** include **`errors.business.<CODE>`** for the four product-metadata-related codes (en / zh / zh_cn / zh_tw).

## Chosen engineering defaults (DDL, outbox, revision)

See [`metadata-phase3-engineering-defaults.md`](./metadata-phase3-engineering-defaults.md) — single place for **column types**, **outbox table name**, and **SHA-256 revision** algorithm.
