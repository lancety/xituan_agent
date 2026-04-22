# Site: Full Migration to App Router

## Goal
Unify xituan_site on App Router with locale in path (`/[locale]/...`). Remove dependency on Pages Router for main flows.

## Current State
- **Pages Router** (no locale in path): `/`, `/search`, `/cart`, `/user/*`, `/merchant/[id]`, `/merchant/[id]/products`, etc. Locale from cookie.
- **App Router** (locale in path): `/en`, `/zh_cn`, `/zh_tw` (redirect to `/`), `/en/merchant/[id]/products/[id]` (detail pages).
- Layout chosen in `_app` via `getLayoutType(pathname)` and `LayoutWrapper` (ConsumerLayout, MerchantLayout, UserLayout, CheckoutLayout).

## Target State
- All user-facing routes under `app/[locale]/...`. Middleware redirects `/` to `/[locale]` (cookie or Accept-Language).
- Route groups: `(consumer)` home/search/cart, `(user)` user/*, `merchant/[merchantId]/*` with MerchantLayout.
- Same layout components (ConsumerLayout, etc.) reused; they use `usePathname`/`useParams` so links include locale when in App Router.

## Implementation Steps

1. **Middleware**  
   Redirect `/` to `/[locale]` (NEXT_LOCALE cookie or Accept-Language). Other paths without locale prefix redirect to `/[locale]/...` (keep existing detail-page behaviour).

2. **Consumer routes**
   - `app/[locale]/(consumer)/layout.tsx`: wrap with `ConsumerLayout`.
   - `app/[locale]/(consumer)/page.tsx`: home – server fetch + `HomeClient`.
   - `app/[locale]/(consumer)/search/page.tsx`: search page.
   - `app/[locale]/(consumer)/cart/page.tsx`: cart page.

3. **User routes**
   - `app/[locale]/(user)/layout.tsx`: wrap with `UserLayout`.
   - `app/[locale]/(user)/user/profile/page.tsx`, `orders`, `addresses`.

4. **Merchant routes**
   - `app/[locale]/merchant/[merchantId]/layout.tsx`: wrap with `MerchantLayout` (params: merchantId, locale).
   - Add: `page.tsx` (merchant home), `products/page.tsx`, `offers/page.tsx`, `preorder/page.tsx`.
   - Detail pages already exist: `products/[id]`, `offers/[id]`, `preorder-promote/[id]`.

5. **Layout components**
   - `ConsumerLayout`: use `usePathname()` and `useParams()` so home/search links are `/[locale]` and `/[locale]/search` when `params.locale` exists.
   - `MerchantLayout` / others: ensure internal links use `/[locale]/...`.

6. **Links**
   - All `Link href` and `router.push` that point to site routes use locale: `/${locale}/...` (from `useParams()` or next-intl).

7. **Deprecate Pages**
   - After migration, remove or redirect `pages/index.tsx`, `search.tsx`, `cart.tsx`, `user/*`, `merchant/[merchantId]/*` (or leave as redirects to App routes).

8. **Checkout**
   - `/checkout/*` (offer, preorder, regular) not yet in App Router. CartContext still navigates to `/checkout/...`; middleware redirects to `/[locale]/checkout/...` which 404s until App routes are added.

## Files to Add/Change (summary)

| Action | Path |
|--------|------|
| Edit | `src/middleware.ts` – redirect `/` to `/[locale]` |
| Add | `src/app/[locale]/(consumer)/layout.tsx` |
| Add | `src/app/[locale]/(consumer)/page.tsx` (home server) |
| Add | `src/app/[locale]/(consumer)/HomeClient.tsx` |
| Add | `src/app/[locale]/(consumer)/search/page.tsx`, `cart/page.tsx` |
| Add | `src/app/[locale]/(user)/layout.tsx`, `user/profile/page.tsx`, etc. |
| Add | `src/app/[locale]/merchant/[merchantId]/layout.tsx` |
| Add | `src/app/[locale]/merchant/[merchantId]/page.tsx`, `products/page.tsx`, ... |
| Edit | `src/components/layout/ConsumerLayout.tsx` – pathname + locale-aware links |
| Remove/redirect | `src/app/[locale]/page.tsx` (current redirect page) – replace by (consumer)/page |
