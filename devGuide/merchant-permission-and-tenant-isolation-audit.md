# Merchant Permission & Tenant Isolation Audit

## Purpose

- **Part 1**: Ensure all merchant-schema (CMS-facing) routes use **merchant role/permission**, not platform **user role** (epUserRole.ADMIN/SUPER_ADMIN). Only platform-facing features should use user role.
- **Part 2**: Ensure all queries for merchant-schema entities filter by **merchantId** so that one merchant never sees another merchant's data.

## Part 1: User Role vs Merchant Permission

### Rule

- **CMS / merchant-scoped APIs**: Use `requireMerchantPermission(MERCHANT_PERMISSION_KEYS.xxx)` (and optionally `requireMerchantAccessMiddleware`). Do **not** use `requireRole([epUserRole.ADMIN, epUserRole.SUPER_ADMIN])` or controller-level `req.user?.role === ADMIN/SUPER_ADMIN`.
- **Platform-only APIs**: Use `requireRole` or `requireAdmin` / `isSuperAdmin()` (e.g. platform settings, list-all-merchants, platform user management).

### Domains Fixed (were using user role, now use merchant permission)

| Domain | Route file | Change |
|--------|------------|--------|
| **news** | admin-news.routes.ts | Removed `requireRole([ADMIN, SUPER_ADMIN])`, added `requireMerchantPermission(SETTING_READ)`. Removed all controller role checks. |
| **payment-records** | payment-records.routes.ts | Replaced `requireAnyRole([ADMIN, SUPER_ADMIN])` with `requireMerchantPermission(ORDER_LIST)`. Removed controller `checkAdminPermission`. |
| **preorder-promotes** | admin-preorder-promotes.routes.ts | Replaced `requireRole([ADMIN, SUPER_ADMIN])` with `requireMerchantPermission(SETTING_READ)`. Removed all controller role checks. |
| **partner** | partner.routes.ts | Replaced `requireAdmin` with `requireMerchantPermission(SETTING_READ)`. |
| **order (admin)** | admin-order.routes.ts | Already used `requireMerchantPermission(ORDER_LIST/ORDER_UPDATE_STATUS)`. Removed redundant controller role checks. |
| **order-status (admin)** | admin-order-status.routes.ts | Already used merchant permission. Removed controller `checkAdminPermission`. |

### Domains Left as Platform (correctly use user role)

- **platform-setting**: Platform-wide settings; `requireRole([ADMIN, SUPER_ADMIN])` and controller checks are intentional.
- **merchant.controller**: List merchants / merchant status; `isSuperAdmin()` is intentional for platform admin.
- **user admin-user-management**: Platform user management; `requireAnyRole([ADMIN, SUPER_ADMIN])` for admin routes is intentional.

### Domains Already Using Merchant Permission (no change)

- **admin-product.routes**: `requireMerchantPermission(PRODUCT_UPDATE/CREATE/DELETE)`.
- **admin-offer.routes**: `requireMerchantPermission(PRODUCT_*)`.
- **admin-order.routes** / **admin-order-status.routes**: `requireMerchantPermission(ORDER_LIST/ORDER_UPDATE_STATUS)`.

---

## Part 2: merchantId in Queries

### Rule

For any entity that has `merchant_id` (merchant schema), every **list/find/get/count** must restrict by `merchantId` from `getMerchantId()` (request context) or from a previously loaded entity (e.g. `order.merchantId`). Never return rows for another merchant.

### Repositories Audited (all use getMerchantId / applyMerchantFilter)

- **product.repository**: findProducts, findCategories, findCategoryById, findCategoryByName, createProduct, updateProduct, findProductById, etc. — all use `getMerchantId()` or `MerchantRepositoryHelper.applyMerchantFilter`. (findCategories and findCategoryByName were fixed earlier to add merchantId.)
- **news.repository**: findMany, findById, findPublishedById — all use getMerchantId / applyMerchantFilter.
- **offer.repository**, **offer-product.repository**: All list/find use getMerchantId / applyMerchantFilter.
- **order.repository**, **order-item.repository**, **cart.repository**, **cart-item.repository**: All use getMerchantId.
- **revenue.repository**, **expense.repository**, **equipment.repository**: All use getMerchantId / applyMerchantFilter.
- **partner.repository**, **supplier.repository**, **store (store-address).repository**: All use getMerchantId.
- **printTemp.repository**: findMany and others use getMerchantId / applyMerchantFilter.
- **preorder-promotes.repository**, **admin-products-preorderable.repository**, **products-preorderable.repository**: All use getMerchantId.

### Payment Domain Fixes (merchantId was missing in some queries)

**payment-business.service** (CMS-facing; request context has getMerchantId):

- **getPaymentRecords**: Added `merchantId` to `whereConditions` and to `orderRepository.find` when filtering by orderNumber.
- **getOrderPaymentRecords**: Added `merchantId` to `where`.
- **getPaymentRecordById**: Added `merchantId` to `where`.
- **getPaymentRecordRefundInfo**: Added `merchantId` to findOne.
- **assignPaymentToOrder**, **rejectPaymentRecord**, **updatePaymentRecord**: findOne by id now includes `merchantId`.
- **getPaymentRecordsStats**: Added `merchantId` to `baseWhere`.

**refund.handler.service**:

- **allRefundRecords** find: Added `merchantId: order.merchantId` to `where` for tenant safety.

### Not Changed (different context)

- **payment.handler.service** `findOne` by transactionId: Used in webhook/create flow; transactionId is unique. Caller may not have request context. Left as-is; ensure webhook path does not expose cross-tenant data by other means.
- **bank-transfer-matching.service** order find without merchantId: Used for matching payments to orders; may run in job context. If run per-request (e.g. from CMS), request context has merchantId; if run as global job, consider iterating by merchant.
- **webhook-airwallex-*** order find: Webhook payload may identify merchant; order lookup may be by reference. Left as-is; webhook handlers must not rely on request context for tenant.

---

## Checklist for New Merchant-Scoped Features

1. **Routes**: Use `requireMerchantPermission(MERCHANT_PERMISSION_KEYS.xxx)` (and `requestContextMiddleware` + `merchantRequiredMiddleware` + `requireMerchantAccessMiddleware` where applicable). Do not use `requireRole([epUserRole.ADMIN, epUserRole.SUPER_ADMIN])`.
2. **Controllers**: Do not add controller-level checks for `req.user?.role === ADMIN/SUPER_ADMIN` for CMS flows.
3. **Repositories / services**: For every query that reads merchant-scoped data, include `merchantId` (from `getMerchantId()` or from a loaded entity) in the where clause or query builder.
