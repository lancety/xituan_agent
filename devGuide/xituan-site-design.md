# xituan_site Design

Consumer-facing web application providing similar functionality to xituan_wechat_app. Uses the same backend Public/Auth APIs. Served at `site-domain.website` (e.g. https://xituan.com.au).

---

## 1. Project Overview

| Item | Value |
|------|-------|
| **Purpose** | Web consumer shopping: products, offers, preorder, orders, payments |
| **Shared** | xituan_codebase submodule (types, utils, API helpers) |
| **API** | Same backend as wechat app: X-Merchant-Id, X-Client-Platform: web |

### 1.1 Tech stack

| Category | Choice |
|----------|--------|
| **Engine** | Next.js |
| **UI library** | Ant Design |
| **Icons** | Font Awesome v5 (free solid) |
| **i18n** | next-intl (same as xituan_cms, xituan_platform) |
| **Core** | React 18, TypeScript 5.8 |
| **Routing** | Next.js built-in (App Router or Pages Router) |

See also: Ant Design docs, Font Awesome 5 Free Solid docs, next-intl docs.
Reference: `Web-UI-Text-i18n-Solution.md` for full i18n spec.

### 1.2 i18n (UI text, same as CMS / Platform)

Use next-intl with nested JSON preset. Full spec: `Web-UI-Text-i18n-Solution.md`.

- **Library**: next-intl
- **i18n.ts**: `getRequestConfig` loads `messages/{locale}.json`; wired via `createNextIntlPlugin('./i18n.ts')` in next.config
- **Messages**: `messages/zh_cn.json`, `en.json`, `zh.json`, `zh_tw.json` — nested structure (e.g. `common.save`, `order.status.pending`)
- **Load flow**: middleware → locale → page getServerSideProps loads full messages → NextIntlClientProvider → `useTranslations('namespace')` + `t('key')`
- **Locales**: `en`, `zh`, `zh_cn`, `zh_tw`; `localePrefix: 'as-needed'`
- **Split policy**: keep single file per locale while messages &lt; ~50KB; consider namespace split when larger (see Web-UI-Text-i18n-Solution.md §5)

---

## 2. Site Structure and Routing

### 2.1 Route groups

| Group | Paths | Auth | Layout |
|-------|-------|------|--------|
| Home | `/`, `/search` | No | ConsumerLayout |
| Merchant | `/merchant/:merchantId`, `/merchant/:merchantId/offers`, `/merchant/:merchantId/preorder`, `/merchant/:merchantId/products` | No | MerchantLayout |
| Product/Activity detail | `/products/:productId`, `/offers/:offerId`, `/preorder-promote/:id` | No | MerchantLayout |
| User | `/user/orders`, `/user/orders/:orderId`, `/user/payment/:orderId`, `/user/profile`, `/user/addresses` | Yes | UserLayout |
| Checkout | `/checkout/regular`, `/checkout/offer`, `/checkout/preorder` | Yes (at submit) | CheckoutLayout |
| Content | `/news/:id`, `/contact`, `/user-agreement` | No | ConsumerLayout |

### 2.2 Navigation rules

- Preorder, Offer, Product are **not** in main navigation.
- Entry via: homepage recommendations, merchant homepage, search.
- Merchant homepage shows links to offers, preorder, products; user can browse within a merchant.

---

## 3. Homepage Structure

### 3.1 Required blocks

| Block | Description |
|-------|-------------|
| Multi-merchant recommendations | Links to merchant homepages or lists |
| Popular preorder recommendations | Preorder-promote cards, links to preorder lists or merchant preorder |
| Popular offer recommendations | Offer cards, links to offer lists or merchant offers |
| Popular product recommendations | Product cards, links to product lists or merchant products |
| Product search | Global search bar |
| News | News strip/carousel near top, max height 100px |

Layout follows common e-commerce patterns (e.g. Taobao/JD); block order can differ.

### 3.2 Links from homepage

- Merchant card → merchant homepage
- Offer/Preorder/Product card → merchant activity list or product detail
- Search → search results (products, offers, preorder as applicable)

---

## 4. Layouts

### 4.1 ConsumerLayout

- Header (logo, search, cart)
- Main content
- Optional bottom nav (home, cart, profile)
- Used for: homepage, search, news, contact

### 4.2 MerchantLayout

- **Header**: merchant logo, name, merchant-type badge, rating (optional), "进店" (shop home), "客服" (customer service, WeChat)
- Main content (products, offers, preorder lists or detail)
- Used for: merchant homepage, merchant lists, product/offer/preorder detail (with merchant context)

### 4.3 UserLayout

- User-specific header
- Main content
- Used for: orders, payment, profile, addresses

### 4.4 CheckoutLayout

- Simple header, no bottom nav
- Used for: checkout flows

---

## 5. Merchant Type and Header

### 5.1 Merchant type labels

| Taobao reference | xituan type | Label |
|------------------|-------------|-------|
| 普通商铺 | 个人 | 个人 |
| 普通商铺（企业） | 个人实体 | 个人实体 |
| 天猫 | 公司 | 公司 |

- Shown clearly on merchant cards and MerchantLayout header.
- Use distinct badge style (color/background) per type.

### 5.2 Product/Activity page header (MerchantLayout)

- Merchant logo
- Merchant name
- Merchant type badge
- Rating / metrics (optional)
- **进店** → merchant homepage
- **客服** → WeChat customer service (for now)

---

## 6. Authentication

| Scenario | Login required |
|----------|----------------|
| Homepage, search, browse products/offers/preorder | No |
| Add to cart, view merchant | No |
| Checkout, orders, profile, addresses | Yes |

- Own login page.
- Similar to wechat app: prompt login when hitting user-protected actions (e.g. checkout, orders).

---

## 7. Merchant CMS Link

- Provide link to CMS for merchants (e.g. "商户管理后台").
- Placement: merchant homepage, user profile, or footer.

---

## 8. Card Styles

### 8.1 Card types

Merchant, Offer, Preorder, Product cards must be visually distinct.

### 8.2 Style reference

- E-commerce card style (Taobao/JD): image on top, title, price, optional tags.
- **Image area**: first image; fallback to merchant logo; fallback to placeholder.
- **Aspect ratio**: 1:1 for image area; `object-fit: cover`.

### 8.3 Card content

| Card type | Title | Price / Info |
|-----------|-------|--------------|
| Merchant | Merchant name | Optional tagline |
| Offer | Offer title | Offer price, original price |
| Preorder | Preorder name | Price range or starting price |
| Product | Product name | Price, original price |

### 8.4 Card differentiation (border/tag)

| Card type | Border/tag color |
|-----------|------------------|
| Merchant | #22C3C0 |
| Offer | #22C3C0 |
| Preorder | #F5B92F |
| Product | #A891D7 |

Use left border or tag badge per card type; avoid margin/border-radius conflicts with list container.

### 8.5 News block

- Near top of homepage.
- Max height 100px.
- Width follows layout.
- Compact and scannable.

---

## 9. Color Palette

### 9.1 Palette values

| Color | HEX | Use |
|-------|-----|-----|
| Teal | #22C3C0 | Merchant, Offer |
| Golden | #F5B92F | Preorder |
| Lavender | #A891D7 | Product |
| Burgundy | #9B2D3B | News |
| Tan | #BEA59A | Neutral accents |
| Peach | #FCE1B6 | Light backgrounds |
| White | #FFFFFF | Backgrounds |

### 9.2 Mapping (aligned with wechat app)

| Type | WeChat app | xituan_site |
|------|------------|-------------|
| Offer | #06b6d4 | #22C3C0 |
| Preorder | #f59e0b | #F5B92F |
| Product | #8b5cf6 | #A891D7 |
| Merchant | - | #22C3C0 |
| News | - | #9B2D3B |

### 9.3 CSS variables

```css
:root {
  --card-merchant: #22C3C0;
  --card-offer: #22C3C0;
  --card-preorder: #F5B92F;
  --card-product: #A891D7;
  --card-news: #9B2D3B;
  --palette-tan: #BEA59A;
  --palette-peach: #FCE1B6;
}
```

---

## 10. Responsive Layout

### 10.1 Breakpoints

| Breakpoint | Media | Usage |
|------------|-------|-------|
| xs | max-width: 480px | Small phone |
| sm | max-width: 768px | Phone / small tablet |
| md | min-width: 768px | Tablet |
| lg | min-width: 1024px | Desktop |
| xl | min-width: 1280px | Large desktop |

### 10.2 Desktop and user layout

- **Desktop max-width**: 1660px for main content container.
- **User layout main menu**: fixed width 220px (UserLayout sidebar/menu).

### 10.3 Principles

- Mobile-first.
- Main content max-width: ~480px (phone), ~768px (tablet), ~1200px (desktop), 1660px (desktop).
- Padding: 12px (mobile), 24px (desktop).

### 10.4 Card grid

| Viewport | Columns |
|----------|---------|
| Phone | 2 |
| Tablet | 3 |
| Desktop | 4 |

---

## 11. Frontend Specifications

### 11.1 Typography

- Minimum font size site-wide: **12px**.

### 11.2 Content loading

- Use **scroll-based lazy loading** for long lists (products, offers, preorder, merchants, news).
- Implement via Intersection Observer or Ant Design List `onScroll` loading.

### 11.3 Ant Design

- Use Ant Design components.
- Avoid reusing Ant Design class names for custom styles.
- Use custom prefix (e.g. `xituan-site-`, `xs-`) for custom classes.

### 11.4 xituan_codebase reuse

- Reuse types, utils, and shared components where applicable.
- Do not reuse CMS-specific or layout-specific components that don't fit site structure.

---

## 12. SEO

### 12.1 Rendering

- Prefer **SSR** (e.g. Next.js) or **pre-rendering** for public pages.
- Ensure full HTML for crawlers.

### 12.2 Meta tags

- Per-page `title`, `description`, `canonical`, `robots`.
- Open Graph for sharing.

### 12.3 Technical SEO

- `/sitemap.xml`, `robots.txt`.
- JSON-LD where appropriate (Product, Organization, BreadcrumbList).

---

## 13. References

- xituan_wechat_app: pages, commerce API usage, order modes.
- site-domain: `website` base URL for each env.
- api-route-groups skill: Public vs Auth API usage.
- layout-selection skill: Consumer vs Partner-facing layout (site uses Consumer/Merchant style).
- Web-UI-Text-i18n-Solution.md: next-intl UI text i18n spec, load flow, split policy.
