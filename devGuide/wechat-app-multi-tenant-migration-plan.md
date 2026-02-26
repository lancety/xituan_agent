# Wechat App Multi-Tenant Migration Plan

## Context

- **Multi-tenant design**: See [multi-tenant-platform-implementation.md](../docs/multi-tenant/multi-tenant-platform-implementation.md) and related docs under `xituan_agent/docs/multi-tenant/`.
- **Current state**: CMS, platform, and backend have been migrated to multi-tenant (merchant-scoped data, `merchant_id`, request context). Wechat app is still single-tenant and does not send any merchant context.
- **Goal**: Support wechat app in multi-tenant with **minimal backend complexity**: backend only checks that merchant id is present (no “resolve missing to DEFAULT” in middleware). Frontend obtains and caches the default merchant id via a **temporary API**.

---

## When Other Projects Use Merchant Code

Across the codebase, **API identity** (which merchant a request is for) is always **merchant Id (UUID)**:

- **Backend**: Request context uses JWT `merchantId`, header **`X-Merchant-Id`**, query `merchantId`, or path `merchantId`. No `X-Merchant-Code` header.
- **CMS / Platform**: Login and API calls use merchant **id** (from JWT / session), not code.

**Merchant code** is used only for: (1) CMS apply-to-join flow — user inputs `merchantCode` in request **body**; (2) Backend `MerchantRepository.findByCode` for that body and internal lookup. So **all API identification is by merchant id**.

---

## Chosen Approach: Temporary API + Frontend Cache

- **Backend**: No change to request-context or “missing merchant” logic. Add a **temporary public API** (no auth, no merchant context): **GET /api/merchants/default-id** that returns the **merchant id** of the merchant whose **code = `'DEFAULT'`** (e.g. `{ merchantId: "uuid" }`). Backend continues to **only check** that requests that need a merchant have a merchant id (header / JWT / etc.).
- **Wechat app**: On launch (or before first API call that requires merchant), if there is **no cached merchant id**, call this API **once**, then **save** the returned `merchantId` in local storage. All subsequent requests send **`X-Merchant-Id`** with this cached value. No code handling on frontend; protocol remains merchant-id-only.

This avoids adding complexity to backend middleware; only one simple read-only endpoint is added.

---

## Platform settings vs merchant settings (no auth)

**Design**: Settings read does **not** require authentication. **Platform** and **merchant** are separate:

- **GET /api/platform-settings** (no auth): Returns **platform settings only**. Does not accept or use X-Merchant-Id.
- **GET /api/merchant-settings** (no auth, **requires X-Merchant-Id**): Returns **merchant settings for that id merged with platform settings** (one combined list). By category: **GET /api/merchant-settings/:category** uses **getByMerchantAndCategory** for merchant categories (no get-all-then-filter).

**CMS / Wechat**: For merged config (platform + current merchant), call **GET /api/merchant-settings** with header **X-Merchant-Id**. For platform-only, call **GET /api/platform-settings**.

---

## Migration Plan

### 1. Backend: Temporary API for default merchant id

| # | Task | Description |
|---|------|-------------|
| 1.1 | **GET /api/merchants/default-id** | Add a route **without auth** and **without** request-context. Handler looks up merchant with **code = `'DEFAULT'`** (e.g. via `MerchantService.getByCode('DEFAULT')` or `MerchantRepository.findByCode('DEFAULT')`). Return `{ success: true, data: { merchantId: "<uuid>" } }`. If not found or inactive, return 4xx. |
| 1.2 | **Mount before protected merchant routes** | Register this route so it is hit for `GET /api/merchants/default-id` (e.g. a dedicated public merchant router or a single route). Ensure it does not require auth or merchant context. |
| 1.3 | **DB** | Ensure one merchant has **code = `'DEFAULT'`** and is active. Document in deployment/ops. |

### 2. Wechat app: Cache merchant id and send on every request

| # | Task | Description |
|---|------|-------------|
| 2.1 | **Merchant context util** | Add a util (e.g. `merchant-context.util.ts`) with: **getCachedMerchantId()** (read from storage), **setCachedMerchantId(id)** (write to storage), **ensureMerchantId()** (if no cache, call GET /api/merchants/default-id, then cache and return). |
| 2.2 | **Ensure merchant id at startup** | In `App.onLaunch` (or before first commerce request), call **ensureMerchantId()** so that the cache is populated before any API call that requires merchant. |
| 2.3 | **Send X-Merchant-Id on all requests** | In `lib/commerce.ts` and in **getAuthHeaders()** (and any direct `wx.request` that hits merchant-scoped APIs), add header **`X-Merchant-Id`** with value from **getCachedMerchantId()** (after ensureMerchantId has run, cache is always set). |
| 2.4 | **Direct wx.request** | Audit pages/utils that use `wx.request` directly and ensure they include **X-Merchant-Id** (or use a shared wrapper / getAuthHeaders that already includes it). |

### 3. Testing and rollout

| # | Task | Description |
|---|------|-------------|
| 3.1 | **Backend** | Test: GET /api/merchants/default-id returns 200 and `data.merchantId` for the DEFAULT merchant; 404 or 4xx when no DEFAULT merchant. |
| 3.2 | **Wechat app** | Test: first launch fetches default-id once and caches; all subsequent requests send X-Merchant-Id; data is scoped to default merchant. |
| 3.3 | **Rollout** | Deploy backend (new endpoint + DEFAULT merchant in DB); then deploy wechat app (util + ensure on launch + header on requests). |

---

## Summary Checklist

- [ ] 1.1–1.3: Backend — temporary GET /api/merchants/default-id (no auth); ensure DEFAULT merchant exists in DB.
- [ ] 2.1–2.4: Wechat app — merchant-context util (get/set/ensure), ensure on launch, X-Merchant-Id in commerce + getAuthHeaders + direct wx.request.
- [ ] 3.1–3.3: Tests and rollout.

---

## Related Docs

- [Multi-tenant platform implementation](../docs/multi-tenant/multi-tenant-platform-implementation.md)
- [Multi-tenant architecture analysis](../docs/multi-tenant/multi-tenant-architecture-analysis.md)
- [Database optimization guide (system tables, repository split)](../docs/multi-tenant/database-optimization-guide.md)
