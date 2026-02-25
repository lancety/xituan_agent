# Merchant identity, JWT, CMS request headers, permission and CRUD

Temporary implementation notes (devDoc). devGuide not updated.

## 1. Backend: User–merchant relation and login

- **Migration** `1710000000222_user_merchants_and_assign_default.sql`: creates `platform.user_merchants` (user_id, merchant_id, is_default), assigns all existing users to the default merchant (code `DEFAULT` from migration 1710000000221). This table stores only **merchant internal members** (staff); merchant–customer relations, if needed, use a separate table.
- **Entity** `UserMerchant`; **repos** `UserMerchantRepository`, `MerchantRepository` (platform-level, no merchant filter).
- **AuthService**: On register, new user is assigned to default merchant via `MerchantRepository.findByCode('DEFAULT')` and `UserMerchantRepository.assignUserToMerchant`. On `createUserSession`, JWT payload includes `merchantId` (default or first assigned merchant for that user).
- **Auth middleware**: After setting `req.user`, decodes JWT and sets `(req.user).merchantId` so request-context middleware can prefer `req.user.merchantId`.
- **Auth controller**: Login, register, refreshToken, getCurrentUser responses include `data.user.merchantId`.

## 2. Request-context and merchant in request

- **extractMerchantId** (request-context.middleware): 1) `req.user.merchantId` (from JWT), 2) header `X-Merchant-Id`, 3) query `merchantId`, 4) param `merchantId`. So JWT is preferred when present.

## 3. CMS: Storing and sending merchantId

- **auth.api**: `getMerchantId()`, `setMerchantId(id)`, `getRequestHeaders()` (Authorization + X-Merchant-Id). On login, register, refreshToken, getCurrentUser success, `setMerchantId(data.data?.user?.merchantId)` when present. Clear merchantId on logout (clearStoredTokens removes `merchantId` from localStorage).
- **API modules**: Use `authApi.getRequestHeaders()` when building request headers so every backend call sends `X-Merchant-Id` when the user has a stored merchantId.

## 4. Permission: avoid cross-merchant

- **requireMerchantAccessMiddleware**: Runs after auth and request-context. Ensures `getMerchantId()` is one of the user’s allowed merchants (via `UserMerchantRepository.userHasAccessToMerchant`). Super_admin skips the check. Applied on all routes that use `requestContextMiddleware` + `merchantRequiredMiddleware`.

## 5. Merchant CRUD

- **Routes** `GET/POST/PUT/DELETE /api/admin/merchants` (and `GET /api/admin/merchants/:id`). Authenticated only. List: super_admin sees all, others see only assigned merchants. Create/update/delete: super_admin only.
- **MerchantController**, **MerchantService**, **MerchantRepository** (platform-level).

## 6. Run migration

- Run `1710000000222_user_merchants_and_assign_default.sql` after `1710000000221_split_schemas_platform_and_merchant.sql` so `platform.user_merchants` exists and existing users are linked to the default merchant.
