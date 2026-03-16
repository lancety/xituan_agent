# Wechat app guest cart: local cart detail API logic (reference for site)

## Purpose

Reference how **xituan_wechat_app** fetches and uses product detail for **guest (offline) cart** display. Site cart should align on the “fetch detail API” behaviour; multi-merchant display and UI follow **site** cart design, not wechat.

## Wechat app: guest cart data flow

### 1. Add to cart (offline)

- **File**: `xituan_wechat_app/lib/offline-cart.util.ts`
- On add: `commerce.getProduct(productId)` is called **once per item**.
- **API**: `GET products/${productId}` with header `X-Merchant-Id` (cached from `merchants/default-id` at launch).
- The returned **product object is stored** in the cart item in local storage (`offline_cart`). So guest cart items hold a **full product snapshot** at add time.

### 2. Display cart (offline)

- **File**: `xituan_wechat_app/lib/base-cart.util.ts`
- `getFormattedCartStats()` → `getFormattedCart()`.
- **No product API call** on cart page load. It reads `this.cart.items` from storage and uses **stored `item.product`** for formatting (options, prices, names).
- So display uses the snapshot saved at add time.

### 3. Online cart load (server cart)

- **File**: `xituan_wechat_app/lib/commerce.ts` – `loadServeCart()`
- For each item from server: if `item.product` is missing and `item.productId` exists, it calls `this.getProduct(item.productId)` to fill product.
- **On fetch failure**: it builds a **placeholder product** with `name.zh_cn: '商品信息获取失败'`, `basePrice: 0`, etc., so the item still appears in the list and list count matches backend.

### 4. Incomplete items

- **File**: `xituan_wechat_app/lib/base-cart.util.ts`
- `isCartDataComplete()` / `getIncompleteItems()` treat items whose `product?.name?.zh_cn === '商品信息获取失败'` as incomplete.

## Site: alignment with wechat (detail API logic only)

- **Guest cart** does **not** store a product snapshot; it only stores ids + merchantId + quantity, etc.
- On cart page load, site **re-fetches** product for each guest item via `siteApiUtil.getProductById(merchantId, productId, locale)` (multi-tenant requires `merchantId`).
- **Merchant resolution**: if a guest item has no `merchantId`, site uses `getDefaultMerchantId()` then fallback to the first non-empty `merchantId` from any guest item (so list and stats stay in sync when some items lack merchantId).
- **On fetch failure or no data**: site now (like wechat) still adds a **placeholder** display item with `createPlaceholderProduct(productId)` (`name.zh_cn: '商品信息获取失败'`), so the **list count matches stats** and the user sees “商品信息获取失败” instead of the item disappearing.

## Summary

| Aspect                     | Wechat app                          | Site (aligned)                                        |
|----------------------------|-------------------------------------|-------------------------------------------------------|
| When product is fetched    | At add (offline); at load (online)  | At cart load for each guest item                      |
| API                        | `getProduct(productId)` + X-Merchant-Id | `getProductById(merchantId, productId, locale)`  |
| Stored in guest cart       | Full product snapshot               | Only ids + merchantId + quantity, etc.                |
| On fetch failure           | Placeholder product, item still shown | Placeholder product, item still shown (same copy)   |
| Multi-merchant display     | N/A (single merchant)               | Follow site cart design (merchant groups, tabs)      |

Multi-merchant UI and grouping stay defined by site cart; only the **local cart “detail API” behaviour** (when to call product API, and placeholder on failure) is referenced from wechat.
