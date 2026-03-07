## Template: Home page (xituan_site)

### Purpose

Homepage is a “browse & discover” page with a search-first entry. Users can:

- Start a search immediately.
- Discover recommended merchants / preorder / offers / products.
- Enter a merchant and continue browsing within a store context.

### Layout regions

- **Shared header**: `TplPage-xituan_site-Header-Shared.md`
- **Body blocks** (vertical stack):
  - News strip (compact, near top)
  - Home search bar (primary entry for search)
  - Merchant recommendations
  - Popular preorder recommendations
  - Popular offer recommendations
  - Popular product recommendations

### Desktop rules

- Body is a single scrollable column made of repeated “section blocks”.
- Each block structure:
  - Section title row (left title, optional right “more”)
  - Card grid (already responsive by implementation)
- Avoid adding extra navigation items; entry to detail comes from cards and search.

### Mobile rules (classic industry pattern)

Reference pattern: typical e-commerce home with stacked blocks.

- Keep **section blocks** stacked in a single column.
- Keep a consistent section title style across blocks.
- News strip stays near the top and remains compact.
- Category/tag bars (if any) should be a single-line horizontal scroll or a single “Filter” entry; avoid multi-row dense text.

### Search entry rule

- Homepage does not provide a dedicated “Search” link in header.
- Search should be initiated via the home search input, leading to `/search?q=...`.

### i18n keys (required)

- `home.searchPlaceholder`
- `home.merchants`
- `home.popularPreorder`
- `home.popularOffers`
- `home.popularProducts`
- `common.loading`

### Non-goals

- Complex filtering UI on homepage (belongs to Search template).
- Per-block unique layout rules; blocks should share the same pattern.

