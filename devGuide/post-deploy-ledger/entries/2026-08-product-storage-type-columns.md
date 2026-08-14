# Product storage type / shelf-life as core columns

| Field | Value |
|-------|--------|
| **id** | `product-storage-type-columns` |
| **title** | Promote storageType / storageDays to product columns; AusPost ambient-only filter |
| **status** | `planned` |
| **created** | 2026-08-13 |
| **owner** | TBD |
| **related plans / PRs** | Phase 1 shipping + product dual-write; printTemps path cleanup split (code vs DB) |

## Why phased

Checkout / shipping must read **product columns only** (no metadata fallback). Existing merchants still have `metadata.storeType` / `metadata.storageDay` and printTemps may bind those paths. Dual-write and schema attributes stay until Gate so CMS/print/history stay consistent without a same-day wipe.

## Metadata → column mapping (source of truth)

| Metadata jsonKey | Product column | Notes |
|------------------|----------------|-------|
| `storeType` | `storageType` | Correct live key |
| `storageDay` | `storageDays` | Correct |
| `storageType` | — | Misnamed / early draft / some seeds only; migration falls back if `storeType` missing; do not dual-write here |

## Phase 1 (this release — additive)

- ADD `products.storage_type`, `products.storage_days`; backfill in `0348` (legacy `metadata.storageType` / `storageDay`); correct `storage_type` from live `metadata.storeType` in `0349` (no fallback to `metadata.storageType`).
- Dual-write columns → jsonb keys `storeType` / `storageDay` on product create/update.
- CMS fixed fields; hide dynamic metadata keys `storeType` / `storageDay` / misnamed `storageType` in the metadata card.
- Shipping / cart: cold chain → AusPost not selectable + `COLD_CHAIN_SHIPPING_REQUIRED` + `lineErrors`; transit uses `min(storageDays, maxAllowedDeliveryDays)`.
- **Print / entityFields hardcode cleanup (same Phase 1 deploy):** product `storageType` / `storageDays` in field catalog; do not list promoted metadata paths in defaults.
- **Do not** rewrite DB `print_temps.optional_fields` / `template_data` entityPaths in Phase 1 (CMS-edited rows → Phase N).

## Gate before Phase N

- [ ] Migration applied in prod; dual-write live long enough that CMS edits land on columns.
- [ ] WeChat / Site builds that read product columns (not metadata) for storage display / shipping are fully rolled out where needed.
- [ ] Inventory of printTemps still using `metadata.storeType` / `metadata.storageDay` / misnamed `metadata.storageType` in optional_fields or element bindings.

## Phase N debt (cleanup — separate change after Gate)

- [ ] Stop dual-write; stop writing storage keys into `products.metadata`.
- [ ] One-shot clear jsonb keys `storeType` / `storageDay` / misnamed `storageType`.
- [ ] Retire platform metadata attributes / schema bindings for those keys.
- [ ] **DB printTemps:** rewrite bindings from `metadata.storeType` → `storageType`, `metadata.storageDay` → `storageDays`.
- [ ] Open bag: drop typed storage keys from `iProductMetadata` if still present; keep only open `[key: string]`.
- [ ] Remove any remaining dual-write helpers / comments marked Phase N.

## Notes / rollback

- Phase 1 rollback: drop columns only if no consumer depends on them; jsonb still holds legacy values during dual-write window.
- Missing storage on old rows → treat as `AMBIENT` at read and backfill.
- Mixed cart: whole cart blocks AusPost until cold-chain carriers exist; no auto-split in Phase 1.
