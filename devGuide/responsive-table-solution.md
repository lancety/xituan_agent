# Responsive Table Solution (CMS)

Unified pattern for list pages that show as **Table on desktop** and **Cards on mobile**, with theme support.

## Responsive behaviour (how it works)

- **Breakpoint**: Ant Design Grid `useBreakpoint()`; default **mobile** when `!screens.md` (i.e. below `md`). Configurable via `mobileBreakpoint` (`'xs'|'sm'|'md'|'lg'|'xl'|'xxl'`).
- **Desktop (≥ breakpoint)**: Renders Ant Design `<Table>`; all Table props (including `scroll`, column `fixed`) are passed through. So desktop has full Table behaviour: fixed columns and horizontal scroll are supported natively.
- **Mobile (< breakpoint)**: Renders a list of Cards (one per row). Column order and visibility use `mobileShow` / `mobilePriority` / `mobileLabel` / `mobileRender`; no fixed columns (cards scroll vertically as a list). When `dataSource` is empty, shows an **Empty** component with `locale.emptyText` (string or React element); if not provided, uses "暂无数据".

## Component

- **Path**: `xituan_cms/submodules/xituan_codebase/components/ResponsiveTable.tsx`

## Fixed columns and horizontal scroll (desktop)

Tables can have **fixed left column(s)** (e.g. main identifier / 法定名称) and **fixed right column(s)** (e.g. 操作). The middle columns scroll horizontally when the total width exceeds the container.

- **Column `fixed`**: Use Ant Design column option `fixed: 'left'` or `fixed: 'right'`. Multiple columns can be fixed (left-most columns with `fixed: 'left'`, right-most with `fixed: 'right'`).
- **Horizontal scroll**: Pass `scroll={{ x: number }}` (e.g. `1200`) or `scroll={{ x: 'max-content' }}` so the table gets a horizontal scrollbar when needed. Required for fixed columns to take effect.
- **Column `width`**: Give fixed and scrollable columns explicit `width` so layout is predictable.

**Example (e.g. merchant approval / 商户审批):**

- First column: 法定名称 — `fixed: 'left'`, `width: 180`.
- Middle columns: code, name, type, ABN, ACN, contact, phone, remark, etc. — no `fixed`, with `width` each.
- Last column: 操作 — `fixed: 'right'`, `width: 160`.
- Table: `scroll={{ x: 1200 }}` (or `'max-content'`).

Result: 法定名称 stays on the left, 操作 stays on the right; the rest scroll horizontally when space is limited.

## Usage

```tsx
import ResponsiveTable from '../../submodules/xituan_codebase/components/ResponsiveTable';

<ResponsiveTable
  columns={columns}
  dataSource={data}
  rowKey="id"
  pagination={{ ... }}
  mobileBreakpoint="md"
  mobileCardClassName="responsive-table-mobile-card"
  locale={{ emptyText: '暂无XXX' }}
/>
```

**Empty state (mobile)**: Always pass `locale={{ emptyText: '...' }}` (string or React element) for a clear empty message on mobile. Default is "暂无数据".

## Column Extensions

Each column can extend Ant Design `ColumnType` with:

| Prop | Type | Purpose |
|------|------|---------|
| `mobileShow` | boolean | If `false`, column is hidden in mobile card view. Default: shown. |
| `mobileLabel` | string \| ReactNode | Label in card row (default: column `title`). |
| `mobileRender` | (value, record, index) => ReactNode | Custom render for mobile card cell. |
| `mobilePriority` | number | Order in mobile card (lower = higher). Default 999. |

Mobile card lists columns with `mobileShow !== false`, sorted by `mobilePriority`, then renders each row as a Card with label/value rows. Uses `col.render` or `col.mobileRender` for value; falls back to cell value as string.

## Custom Mobile Cards

For fully custom card layout per row, pass `mobileCardRender`:

```tsx
<ResponsiveTable
  columns={columns}
  dataSource={data}
  rowKey="id"
  mobileCardRender={(record, index) => (
    <Card key={record.id} className="responsive-table-mobile-card" ...>
      {/* custom content */}
    </Card>
  )}
/>
```

When `mobileCardRender` is provided, the default card builder is not used.

## List Card Wrapper (parent Card styling)

Pages that use ResponsiveTable should wrap it in a Card. On **mobile**, make the Card transparent so the mobile card list blends with the main background. See MainLayout devGuide Section 6.1 for full pattern:

```tsx
const isMobile = !useBreakpoint().md;
<Card
  style={isMobile ? { backgroundColor: 'transparent', border: 'none' } : cardStyle}
  styles={isMobile ? { body: { backgroundColor: 'transparent', padding: 0, boxShadow: 'none' } } : undefined}
>
  <ResponsiveTable ... />
</Card>
```

---

## Mobile Card Styling (ResponsiveTable.module.css)

ResponsiveTable provides **unified margin and border-radius** for all list items via `.mobileContainer > *`. Values align with `mobile-product-card` responsive breakpoints.

### Rules

1. **Do NOT set `margin-bottom` or `border-radius`** on:
   - `.mobileCard` (default card)
   - Custom cards in `mobileCardRender` (e.g. `mobile-order-card`, `mobile-product-card`, or `responsive-table-mobile-card`)

2. **Single source of truth**: `.mobileContainer > *` controls spacing and radius for both default and custom cards.

### Responsive values

| Breakpoint | margin-bottom | border-radius | .mobileCardBody padding |
|------------|---------------|---------------|-------------------------|
| Default    | 12px          | 8px           | 12px                    |
| max-width 768px | 8px    | 6px           | 8px                     |
| max-width 480px | 18px    | 6px           | 6px                     |

### Custom card usage

When using `mobileCardRender`, custom cards (e.g. `<Card className="mobile-order-card">`) should **omit** `margin-bottom` and `border-radius` from their styles. The container provides them. Pages (order-list.css, ProductList, NewsList, etc.) must not override these.

---

## Styling and Theme

- **Container**: `.mobileContainer` wraps the list; `.mobileContainer > *` provides unified margin/border-radius.
- **Card**: `.responsive-table-mobile-card`; use for custom cards so theme applies.
- **Theme**: Use CSS variables: `var(--text-primary)`, `var(--text-secondary)`, `var(--border-primary)`, `var(--bg-primary)`. Global styles in `globals.css` define `body[data-theme='dark'] .responsive-table-mobile-card` for background/border/hover.

Default card body uses label (left, `var(--text-secondary)`) and value (right, `var(--text-primary)`), with bottom border `var(--border-primary)` between rows.

## When to Use

- Any list page that uses Ant Design `Table` and must work on mobile: use `ResponsiveTable` instead of `Table`, add column options as needed.
- Existing pages using it: suppliers, expenses, equipment, users, stores, categories, payment-records, partners, partner-invoices, partner-invoice-summaries, orders, products (ProductList), news (NewsList), tax-return-report.

## Filter bar / search input

For list pages with a search/filter Input that triggers API queries, use the IME-safe pattern (debounced onChange + composition events, separate refs for desktop/mobile). See:

- `xituan_agent/devGuide/cms-filter-search-input-ime-solution.md`

## Checklist

- [ ] Replace `Table` with `ResponsiveTable` (same props plus optional mobile*).
- [ ] Pass `locale={{ emptyText: '...' }}` for mobile empty state.
- [ ] Custom mobileCardRender cards: do **not** set margin-bottom or border-radius (ResponsiveTable provides via .mobileContainer > *).
- [ ] Set `rowKey` (string or function).
- [ ] **Desktop**: For fixed main column(s) at start: set first column(s) `fixed: 'left'` and `width`. For fixed action column(s) at end: set last column(s) `fixed: 'right'` and `width`. Set `scroll={{ x: number }}` or `scroll={{ x: 'max-content' }}`.
- [ ] For columns to hide on mobile: `mobileShow: false`.
- [ ] For custom order on mobile: set `mobilePriority`.
- [ ] For custom label or cell on mobile: `mobileLabel` / `mobileRender`.
- [ ] Optional: `mobileCardRender` for fully custom cards.
- [ ] Use theme variables in any custom card styles; add `body[data-theme='dark']` overrides if needed.
