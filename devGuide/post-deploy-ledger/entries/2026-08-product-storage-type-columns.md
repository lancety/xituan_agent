# Product storage type / shelf-life as core columns

| Field | Value |
|-------|--------|
| **id** | `product-storage-type-columns` |
| **title** | Promote storageType / storageDays to product columns; AusPost ambient-only filter |
| **status** | `done` |
| **Phase1 首次进版** | `v3.9.2`（migrations `0348/0349`） |
| **完成日** | `2026-11-25` |
| **created** | 2026-08-13 |
| **owner** | TBD |
| **Last updated** | 2026-11-25 |
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
- Dual-write **only** `storageDays` → jsonb `storageDay` (NUMBER). **Do not** overwrite `metadata.storeType`: live schema is ENUM string (`room_temp` etc.). Writing multilingual labels from `epStorageType` caused `PRODUCT_METADATA_INVALID` (`must be an enum code string`).
- CMS fixed fields for product columns `storageType` / `storageDays`. **Do not hide** dynamic metadata keys `storeType` / `storageDay` / misnamed `storageType` in the product editor while those keys still exist on the merged schema — hiding them (and stripping on save) caused `PRODUCT_METADATA_INVALID` on update. Keep them in `ProductEditModal` until Phase N retires the schema attributes in the same change.
- Shipping / cart: cold chain → AusPost not selectable + `COLD_CHAIN_SHIPPING_REQUIRED` + `lineErrors`; transit uses `min(storageDays, maxAllowedDeliveryDays)`.
- **Print / entityFields hardcode cleanup (same Phase 1 deploy):** product `storageType` / `storageDays` in field catalog; do not list promoted metadata paths in defaults.
- **Do not** rewrite DB `print_temps.optional_fields` / `template_data` entityPaths in Phase 1 (CMS-edited rows → Phase N).

## Gate before Phase N

已关闭（2026-11-25）。Phase 1 版本 `3.9.2` 已在各端部署。

- [x] Migration `0348` / `0349` 随 `v3.9.2` 进版。
- [x] 打印模板已改：不再绑 `metadata.storeType` / `metadata.storageDay` / 误写的 `metadata.storageType`。

## Phase N debt

- [x] 停双写。保存商品时不再把 `storageDays` 写进 jsonb `storageDay`。CMS `ProductEditModal` 与 backend `product.service` 都已去掉。已有 jsonb 不清理。
- [x] 打印模板路径已改完。
- [x] 取消：一次性清 jsonb、从编辑页剥掉这些键、为了清值而改 `iProductMetadata`。schema 仍要求这些键时不要先藏字段。
- [x] 关闭本条。`storeType`、`storageDay`、误写的 `storageType` 走属性弃用，不作为本台账阻塞项。商品 jsonb 里的值留下。

## 关闭说明（2026-11-25）

双写已停，本条关闭。

- 保存商品不再把 `storageDays` 写入 jsonb `storageDay`。
- 已有 jsonb 不清理。
- 打印模板已不再绑这些 metadata 路径。
- `storeType` / `storageDay` / 误写的 `storageType` 若还在 schema 上，按属性弃用处理，不在这条里做 DROP 或清值。

## Notes / rollback

- Phase 1 rollback: drop columns only if no consumer depends on them; jsonb still holds legacy values during dual-write window.
- Missing storage on old rows → treat as `AMBIENT` at read and backfill.
- Mixed cart: whole cart blocks AusPost until cold-chain carriers exist; no auto-split in Phase 1.
- **2026-08-14:** CMS 曾把 `storeType` / `storageDay` / `storageType` 从产品编辑 metadata 卡隐藏，并在保存时从 payload 删除。schema 尚未退役，更新保存触发 `PRODUCT_METADATA_INVALID`。已把这三项放回编辑组件；**等 Phase N 退役 schema 时再一并隐藏/剥离**，不要单独先藏字段。
- **2026-08-14 (dual-write):** 0348/0349 **只读** metadata 回填列，不改 jsonb。保存失败是因为 create/update 把 `storeType` 覆盖成 `{intl, zh_cn, …}`，而 schema 仍是 ENUM。已停止覆盖 `storeType`，保留客户端/库里的枚举码（如 `room_temp`）。
- **2026-11-25:** 双写已停，本条关闭。不清理 jsonb。`storeType` / `storageDay` / 误写 `storageType` 走属性弃用，不作为本台账阻塞项。打印模板已改。
