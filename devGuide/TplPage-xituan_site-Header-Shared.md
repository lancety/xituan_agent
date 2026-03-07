## Template: Shared Header (xituan_site)

### Purpose

Provide a consistent, search-first top area shared by Homepage and Search page (and optionally other consumer-facing pages). The header prioritizes **search** while keeping secondary actions accessible but not visually dominant.

### Layout regions

- **Header container**: fixed at top of the page layout, within site max-width rules.
- **Nav row**: logo + menu trigger.
- **Search row**: search type selector + search input.
- **Search history strip**: shown below search input (within header area), presents recent keywords.

### Desktop rules

- **Three-zone layout**:
  - Left: Logo (home link)
  - Center: search scope + input (primary)
  - Right: key actions (e.g. cart, locale)
- Actions must not visually compete with the search input.
- The “Search page link” in header is not used; users initiate search via the search input.

### Mobile rules (classic industry pattern)

Reference pattern: e-commerce / local-life “search-driven home”.

- **Two-row header** (recommended):
  - Row 1: small logo on the left; a single menu button on the right.
  - Row 2: scope selector + search input, full width.
- **Search history**:
  - Directly below the input.
  - Default shows a single line of chips; horizontal scroll allowed.
  - Each chip triggers a search immediately.
- **Secondary functions in menu**:
  - Use a Drawer/BottomSheet from the top-right menu button.
  - Contents ordered from most frequent to least:
    - Common user actions (orders/profile/addresses/cart)
    - Locale switch
    - Theme switch (light/dark)
  - Keep the menu visually simple; avoid dense multi-column content on small screens.

### Search scope model

Header supports a scope selector. Two common models are acceptable, but the implementation must pick one and remain consistent across pages:

- **Model A**: “Products / Merchants” (search entity type)
- **Model B**: “All / This store” (search boundary, for merchant-context pages)

For xituan_site current implementation (consumer pages), **Model A** is used and expressed by URL params on `/search`.

### Routing & URL params (current)

- Path: `/search`
- Params:
  - `q`: keyword (string)
  - `type`: `product | merchant`

### i18n keys (required)

Namespace rules follow `Web-UI-Text-i18n-Solution.md`.

- `layout.menu`
- `layout.quickActions`
- `layout.language`
- `layout.theme`
- `layout.lightMode`
- `layout.darkMode`
- `layout.cart`
- `layout.userCenter`
- `search.typeProduct`
- `search.typeMerchant`
- `search.placeholderProducts`
- `search.placeholderMerchants`
- `search.history`
- `search.clearHistory`

### Non-goals

- Pixel-perfect spacing/typography for every breakpoint.
- Full “search suggestions / autocomplete” system (can be added later).
- Full-text searching merchants unless backend capability exists (current implementation uses merchant list filtering).

