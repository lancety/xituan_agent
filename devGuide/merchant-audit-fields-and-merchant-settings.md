# Merchant Audit Fields & Merchant Settings Implementation

## Overview

- **Merchant table (platform.merchants)**: Added platform-audited fields (ABN, legal entity type, ACN, legal name). These are like business license info: platform audits them and merchants cannot change them arbitrarily.
- **Merchant settings (merchant.merchant_settings)**: New table in `merchant` schema for merchant self-configured settings. Categories: shipping, preorder, finance, operation, customer_support. **Order** remains in `platform.platform_settings` (same for all merchants).

## 1. Merchant Table Additions (Platform-Audited)

| Column             | Type         | Note                                      |
|--------------------|--------------|-------------------------------------------|
| abn                | VARCHAR(11)  | Australian Business Number                |
| legal_entity_type  | VARCHAR(30)  | sole_trader, company  |
| acn                | VARCHAR(9)   | Australian Company Number (company only)  |
| legal_name         | VARCHAR(255) | Legal / trading name with legal effect    |

- Enum: `epLegalEntityType` in `submodules/xituan_codebase/typing_entity/merchant.enum.ts`.
- All nullable for existing rows. Restrict updates in API so only platform (e.g. SUPER_ADMIN) can set/change these; merchant self-service must not modify them.

## 2. Category Enums (Do Not Mix)

- **Platform**: `epPlatformSettingCategory` in `platform-setting.type.ts`. Only **order** is stored in `platform_settings` and managed by PlatformSettingService. Use `PLATFORM_ONLY_CATEGORIES` for filtering.
- **Merchant**: `epMerchantSettingCategory` in `merchant-setting.type.ts` (SHIPPING, PREORDER, FINANCE, OPERATION, CUSTOMER_SUPPORT). Merchant settings are grouped by this enum only; do not reuse platform enum for merchant_settings.

## 3. Merchant Settings Table (merchant.merchant_settings)

- **Schema**: `merchant`.
- **Columns**: id (UUID), merchant_id (FK → platform.merchants), category (VARCHAR 50, values from epMerchantSettingCategory), settings (JSONB), description (TEXT), created_at, updated_at.
- **Unique**: (merchant_id, category).
- **Order** is not in this table; it stays in `platform.platform_settings` (platform-wide).

## 4. Platform vs Merchant Settings API

- **GET /api/admin/platform-settings**: Returns merged list: platform-only (order) + current merchant’s settings (from request context `merchantId`). Requires auth + requestContext + merchantRequired + requireMerchantAccess.
- **GET /api/admin/platform-settings/:category**: If category is order → from platform cache; otherwise from `merchant_settings` for current merchant.
- **PUT /api/admin/platform-settings/:category**: If order → update `platform_settings`; otherwise upsert `merchant_settings` for current merchant.

## 5. Service Usage

- **PlatformSettingService**: Loads and caches only **order** from `platform_settings`. `getOrderSettings()` unchanged. No longer serves shipping/preorder/finance/operation/customer_support.
- **MerchantSettingService**: All reads/writes for shipping, preorder, finance, operation, customer_support by `merchantId`. Used by:
  - Platform setting controller (with `getMerchantId()` from request context).
  - ShippingFeeService (async `calculateShippingFee`, `calculateShippingFeeByAddress`).
  - PartnerService (finance for GST/invoice).
  - PdfGeneratorService (finance + operation for PDF).

## 5.1 Merchant Settings Caching (Reduce DB Reads)

- **Problem**: Multi-tenant mode reads merchant_settings per request by merchantId; without cache this causes many DB reads.
- **Module**: `src/shared/cache/` — adapter pattern for easy Redis migration:
  - **ICacheAdapter**: `get(key)`, `set(key, value, options?)`, `delete(key)` (all async).
  - **InMemoryCacheAdapter**: in-process Map with TTL (default 5 min).
  - **getDefaultCache()**: returns shared in-memory instance; used by MerchantSettingService when no adapter is injected.
- **MerchantSettingService**: Constructor accepts optional `ICacheAdapter`; key scheme `merchantId` (full list) and `merchantId:category` (single). On update, invalidates both keys for that merchant.
- **Migrate to Redis**: Implement `ICacheAdapter` with Redis (e.g. get/set/delete + SETEX for TTL). In app bootstrap or where services are built, pass `new RedisCacheAdapter(redisClient)` into `MerchantSettingService`. No changes to service logic.

## 6. Migration

- **1710000000223_merchant_audit_fields_and_merchant_settings.sql**:
  - Adds abn, legal_entity_type, acn, legal_name to `platform.merchants`.
  - Creates `merchant.merchant_settings`.
  - Copies existing rows from `platform.platform_settings` where category in (shipping, preorder, finance, operation, customer_support) into `merchant.merchant_settings` for each existing merchant (e.g. DEFAULT).

## 7. Route / Middleware

- **Platform settings routes**: Use requestContextMiddleware, merchantRequiredMiddleware, requireMerchantAccessMiddleware so all handlers have `merchantId`.
- **Shipping routes**: Use requestContextMiddleware, merchantRequiredMiddleware so shipping fee logic has `merchantId` for merchant_settings.

## 8. Follow-Up (Not Done in This Change)

- **Merchant CRUD**: Restrict updates to abn, legal_entity_type, acn, legal_name (e.g. only SUPER_ADMIN or dedicated “platform audit” API).
- **Optional**: Remove or archive shipping/preorder/finance/operation/customer_support rows from `platform.platform_settings` after migration and verification (currently left in place).

---

## 9. Merchant Application Review Flow (审核流程) — Not Yet Implemented

**Current state**: The CMS "申请成为商户" page collects platform-audited fields (legal_name, legal_entity_type, abn, acn, contactName, contactPhone, remark). On submit, the form only runs a **stub** (no API call); no application is persisted and there is no admin review.

**Intended flow (to implement)**:

1. **Storage**  
   New table e.g. `platform.merchant_applications`: id, user_id, legal_name, legal_entity_type, abn, acn, contact_name, contact_phone, remark, status (pending / approved / rejected), reviewed_at, reviewed_by, created_at, updated_at. Migration + entity + repository.

2. **Submit**  
   CMS apply-merchant: `onFinish` calls `POST /api/merchant-applications` with form payload (auth required). Backend creates row with status = pending.

3. **Admin list**  
   SUPER_ADMIN only: `GET /api/admin/merchant-applications?status=pending`. Backend returns list of applications.

4. **Approve**  
   Admin action → e.g. `POST /api/admin/merchant-applications/:id/approve`. Backend: create merchant (code, name, abn, legal_entity_type, acn, legal_name), assign user to merchant via UserMerchantRepository, set application status = approved, reviewed_at, reviewed_by.

5. **Reject**  
   Admin action → e.g. `POST /api/admin/merchant-applications/:id/reject` (optional reason). Backend: set status = rejected, reviewed_at, reviewed_by.

6. **CMS admin UI**  
   New page/section: list pending applications, buttons "通过" / "拒绝".

Until the above is implemented, there is **no real review flow**; the apply page is input-only and submit is a stub.
