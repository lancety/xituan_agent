# Merchant Layout and Pages – Outline and Description

Planning document for 商户 layout, header variants, menu-list layout, and detail pages (preorder/group-buy/product). Use this to confirm understanding before implementation.

---

## 1. 商户 Layout (Merchant Layout)

**Purpose:** Wrapper for all merchant/shop pages. Reuses the same **top bar** as consumer site; body area is merchant-specific.

**Structure:**

- **Top bar (same as ConsumerLayout):**
  - **Left:** Theme toggle (light/dark), Locale switch.
  - **Right:** 我的 | 订单 | 地址 | 购物车 (links); optional menu/drawer on small screens.

- **Body area (below top bar):**
  - **Left:** Site/merchant logo (e.g. link to home or merchant home).
  - **Right:** Search block = **搜索** (global search) | **搜本店** (search within current merchant); search triggers same search page with scope/merchantId.

**Note:** Existing `MerchantLayout.tsx` has a simpler header (merchant name, type, search, 进店, 客服). The new spec is: **reuse ConsumerLayout-style top bar**, then in body: logo left, search (全站 | 搜本店) right. So the “same header” = the consumer top bar; the “main bar” inside layout = logo + search.

---

## 2. 商户 Header (Merchant Header)

**Placement:** Inside layout body, near the top of the page (e.g. store homepage or store-level landing).

**Structure:**

- **Left:**
  - Merchant logo (image).
  - Next to it, 3 lines of text:
    - Line 1: **商户名称** (merchant name).
    - Line 2: **类型** (公司 / 个体 / 个人 等).
    - Line 3: **备用** (reserved for future use).

- **Right (buttons):**
  - **店铺首页** – show only when **not** on store homepage; link to `/merchant/[merchantId]`.
  - **客服** – customer service (e.g. link or contact).
  - **关注** – follow/subscribe to merchant.

---

## 3. 商户 HeaderMini (Compact Merchant Header)

**Placement:** Used on product detail and other pages where space is limited; compact one-row header.

**Structure:**

- **Left (in order):**
  - Merchant logo.
  - Merchant name (link → 商户菜单列表主页, e.g. `/merchant/[merchantId]`).
  - **客服**.
  - **进店** (enter store, same as 店铺首页).

- **Right:** Same row, right-aligned (e.g. optional actions or spacing). “同行靠右” = these elements on the same row, right side.

---

## 4. 商户菜单列表 Layout (Merchant Menu + List Layout)

**Purpose:** List pages for merchant content. Only list pages use left menu + right list; activity detail and product detail pages do **not** use the left menu—they provide back navigation only.

**Menu structure (current):**

- **产品菜单组 (Product menu group):** Includes merchant-defined type/category list; right side shows product list (optionally filtered by type).
- **团购 (Group-buy):** Menu item “团购”; right side shows this store’s group-buy activity list. Click an activity → activity detail page (no left menu, back nav only).
- **预约 (Reservation / 预购):** Menu item “预约”; right side shows this store’s reservation/preorder activity list. Click an activity → activity detail page (no left menu, back nav only).

**Structure:**

- **Left:** Side menu = 产品菜单组 (with type list) + 团购 + 预约. One item active per page.
- **Right:** Main content = list for the selected menu (products or activities).

**Navigation:** Click an activity in the list → activity detail (5). Activity detail and product detail pages have **no left menu**, only back navigation.

---

## 5. 预定详情 / 团购详情 (Preorder Detail & Group-Buy Detail)

**Purpose:** Single preorder-promote or group-buy activity page: activity info + product list + add to cart.

**Entry:** Reached from **4** when user clicks an activity. **No left menu/sidebar** on this page—only **back navigation** (e.g. “返回活动列表” to `/merchant/[merchantId]/offers` or `/merchant/[merchantId]/preorder`).

**Layout:**

- **Back navigation** at top or prominent position (e.g. link back to activity list).
- **Main content:**
  - **Section 1:** Activity image carousel + activity basic info (name, time, rules, etc.).
  - **Section 2:** Product list for this activity. Click product → product detail (6). Add to cart with current activity context (mode + modeInstanceId + modeProductId), same as WeChat.

**Cart:** Create cart item with activity context and product selection; align with wechat/mini-program flow.

---

## 6. 产品详情 (Product Detail)

**Purpose:** Single product page: gallery, details, reviews, recommendations, and purchase panel. **No left menu/sidebar**—provide **back navigation** (e.g. back to activity detail or product list).

**Layout: Two columns.**

**Left column (scrollable):**

- Row 1: **商户 HeaderMini** (logo, name→menu home, 客服, 进店).
- Row 2: **Product image gallery** – thumb list + large preview (click thumb to change main image).
- Below: **用户评价** (reviews) | **图文详情** (rich content) | **本店推荐** (store recommendations) | **相关产品** (related products). Tabs or sections.

**Right column (sticky):**

- Product name.
- Price.
- Product ID / 规格组 (product ID group, e.g. sku/variant selector).
- Quantity selector.
- **添加购物车** button.
- **收藏** icon.

**Add to cart:** Use **passed purchase mode and product selection** (e.g. from activity or direct) to create cart item; same cart creation logic as wechat when coming from activity.

---

## Summary Table

| Item | Description |
|------|-------------|
| **商户 Layout** | Consumer-style top bar (theme, locale, 我的/订单/地址/购物车); body: left logo, right 搜索 \| 搜本店. |
| **商户 Header** | In body: logo + 3 lines (name, type, 备用); right: 店铺首页(if not home), 客服, 关注. |
| **商户 HeaderMini** | One row: logo, name(→menu home), 客服, 进店; right-aligned on same row. |
| **商户菜单列表 Layout** | Left: 产品菜单组(含商户类型列表) + 团购 + 预约; right: list. Click 活动 → (5). Activity/product detail pages do not use left menu. |
| **预定/团购详情** | No left menu. Back nav only; main: carousel+info, product list; click product → (6); add to cart = activity + product. |
| **产品详情** | No left menu. Back nav only. Left col: HeaderMini, gallery, 评价/详情/推荐/相关; right: sticky name, price, ID组, 数量, 加购, 收藏; add to cart by mode + selection. |

---

## Open Points

1. **“同样的 header”:** Confirmed as ConsumerLayout’s top bar (theme, locale, 我的/订单/地址/购物车). The “logo + 搜索 | 搜本店” is the **layout body** bar, not the very top strip.
2. **Header vs HeaderMini:** Header = full store intro (logo + 3 lines + 店铺首页/客服/关注). HeaderMini = compact row for product/detail pages.
3. **Cart creation:** Preorder/group-buy detail and product detail both create cart items with activity + product selection, consistent with wechat flow.
4. **Routes:** Menu-list layout applies to existing `/merchant/[merchantId]/products|offers|preorder` and any new 团购 list; detail pages are preorder-promote/[id], offers/[id], product [id], etc.

If any of the above doesn’t match your intent (e.g. which header is “same”, or where 关注/客服 link to), point out and we can adjust the outline before coding.
