# Multi-Tenant Development Release Plan

Phases and milestones aligned with `xituan_agent/docs/multi-tenant/multi-tenant-platform-implementation.md` and progress tracked in `multi-tenant-refactor-progress.md`.

---

## Phase 1: Foundation (Done)

- [x] Schema split: `platform`, `merchant`; `platform.merchants`, `platform.merchant_subscriptions`, `user_merchants`.
- [x] Business tables in `merchant` with `merchant_id`; default merchant `DEFAULT` for migration.
- [x] Request Context (merchantId, userId, etc.) + AsyncLocalStorage; middleware to extract from Header/query/params and `req.user.merchantId`.
- [x] MerchantRepositoryHelper; apply merchant filter in repositories.
- [x] Routes using `requestContextMiddleware` + `merchantRequiredMiddleware` where needed; multer context restore.

---

## Phase 2: Auth & Frontend (Done)

- [x] User–merchant (staff) relation: `platform.user_merchants` — only merchant **internal members**, not customers; merchant–customer relation if needed uses a separate table. UserMerchantRepository (assign, getDefault, getFirst, userHasAccessToMerchant).
- [x] Login/register: createUserSession puts merchantId in JWT payload (default/first merchant); auth middleware attaches to `req.user.merchantId`.
- [x] Login/register/me responses include `user.merchantId`; backend uses it for request context when no Header.
- [x] CMS: getRequestHeaders() includes `X-Merchant-Id` from localStorage; most API modules use it; login/refresh/me set merchantId from response.
- [x] New user registration: assign to default merchant (DEFAULT_MERCHANT_CODE).
- [x] Merchant application flow: CMS apply → backend create merchant (pending) + assign user; Platform admin approve/reject.

---

## Phase 3: Optional Enhancements

- **Platform merchant management**: Only approve/reject (list pending, PUT status) is required; already done. Platform is platform-level admin and does not operate “as a merchant user”; no need for Platform to obtain or send merchantId.
- [ ] **Merchant list / current merchant (CMS only, optional)**  
  - For CMS: GET /api/admin/merchants with filters, current-merchant in /auth/me, merchant switcher when user has multiple merchants. Not needed for Platform.
- [ ] **User–merchant–permission modeling (用户×商户×权限 建模与校验)**  
  - Model: “user U has role/permission P in merchant M”. In permission checks, combine with getMerchantId() so that access is scoped by merchant and cross-tenant access is denied. Implemented at system level (see “MerchantId and cross-tenant enforcement” below), not per-API.
- [ ] **SystemRepository**  
  - Dedicated path for platform-only tables (no merchant_id); avoid using request-context merchantId for these.

---

## Phase 4: Scale (When Needed)

- [ ] Table partitioning per `database-optimization-guide.md` (e.g. when table size > 5M rows).
- [ ] Merchant settings / platform settings caching (e.g. Redis) per `merchant-audit-fields-and-merchant-settings.md`.

---

## Acceptance Criteria (Phase 2)

- Any CMS request that needs merchant context sends `X-Merchant-Id` (via getRequestHeaders) or backend uses JWT `merchantId`.
- Login/register/me return `user.merchantId`; CMS stores it and uses it in subsequent requests.
- Backend routes that require merchantId receive it from Header or JWT and run with correct request context.
- Platform does not need merchantId: it is platform-level admin (e.g. merchant approve/reject only), not “acting as a merchant user”.

---

## MerchantId and cross-tenant enforcement (system-level)

MerchantId and cross-merchant access control are enforced at **system level** to avoid per-API checks and oversight:

- **requestContextMiddleware** (or optionalRequestContextMiddleware): Extracts merchantId from JWT, Header `X-Merchant-Id`, query, or params; sets AsyncLocalStorage so downstream code uses `getMerchantId()`.
- **merchantRequiredMiddleware**: Applied on routes that must have merchant context; returns 400 if merchantId is missing (no per-handler check needed).
- **merchantAccessMiddleware** (where needed): Uses `userHasAccessToMerchant(userId, merchantId)` so the user is allowed to access that merchant; super_admin can access any.
- **MerchantRepositoryHelper**: Repositories add `merchant_id` to queries via the helper so data is filtered by request context; controllers do not add merchant filters by hand.

This way, APIs that are mounted with these middlewares and use the repository pattern are protected without each handler implementing its own merchant check.

---

## Trust model: who do we trust for merchantId?

- **JWT payload `merchantId`**  
  Set by the server at login (from `user_merchants`: default or first merchant). Verified by JWT signature; the client cannot forge or alter it. **This is the only server-authoritative source.** The auth middleware attaches it to `req.user.merchantId`; `extractMerchantId` uses it first.

- **`X-Merchant-Id` header (and query/params)**  
  Sent by the client. **It can be tampered;** it is not server-declared and there is no cryptographic binding. It is used only when JWT has no `merchantId` (e.g. legacy token or user with no merchants). The backend **never trusts it for authorization**. After reading it into request context, **requireMerchantAccessMiddleware** always runs and checks `userHasAccessToMerchant(userId, merchantId)` (or super_admin). So even if a client sends `X-Merchant-Id: other-merchant-id`, access is denied unless that user is allowed that merchant in `user_merchants`.

- **Summary**  
  Identity is from JWT (user id). Merchant is from JWT when present (trusted), or from header/query/params as a hint. Authorization is always: server verifies (user, merchant) via `user_merchants`; no API relies on “client said so” for merchant access.
