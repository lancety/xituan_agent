## Template: Search page (xituan_site)

### Purpose

Search page is a “find & filter” page. Users can:

- Enter a keyword and get results quickly.
- Switch type (products vs stores).
- Adjust sorting / filters (future extension).

### Layout regions

- **Shared header**: `TplPage-xituan_site-Header-Shared.md`
- **Body**
  - Results grid
  - Loading state / empty state

### Desktop rules

- Search controls are placed above results.
- Results reuse the same card grid as homepage blocks.
- When scope is “store”, results are restricted to the given merchant.

### Mobile rules (classic industry pattern)

Reference pattern: search results with a control bar + results list.

- Keep the control area compact at the top of the results.
- Filters and advanced options should open in Drawer/BottomSheet (avoid inline dense controls).
- Results remain a single scroll region; keep loading/empty states lightweight.

### Routing & URL params (required)

- Path: `/search`
- Params:
  - `q`: keyword (required to show results)
  - `type`: `product | merchant` (optional, defaults to `product`)

### i18n keys (required)

- `search.search`
- `search.noResults`
- `search.noMerchants`
- `search.typeProduct`
- `search.typeMerchant`
- `search.placeholderProducts`
- `search.placeholderMerchants`
- `common.loading`

### Backend dependency note

Current backend public search endpoint supports product search only. If the product expands to searching offers/preorder/merchants, this template doc should be updated while keeping the routing contract stable.

### Non-goals

- Implementing new backend full-site search capabilities in this template doc.
- Autocomplete suggestions (can be added later).

