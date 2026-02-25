# Responsive Table Solution (CMS)

Unified pattern for list pages that show as **Table on desktop** and **Cards on mobile**, with theme support.

## Responsive behaviour (how it works)

- **Breakpoint**: Ant Design Grid `useBreakpoint()`; default **mobile** when `!screens.md` (i.e. below `md`). Configurable via `mobileBreakpoint` (`'xs'|'sm'|'md'|'lg'|'xl'|'xxl'`).
- **Desktop (≥ breakpoint)**: Renders Ant Design `<Table>`; all Table props (including `scroll`, column `fixed`) are passed through. So desktop has full Table behaviour: fixed columns and horizontal scroll are supported natively.
- **Mobile (< breakpoint)**: Renders a list of Cards (one per row). Column order and visibility use `mobileShow` / `mobilePriority` / `mobileLabel` / `mobileRender`; no fixed columns (cards scroll vertically as a list).

## Component

- **Path**: `xituan_cms/src/components/common/ResponsiveTable.tsx`

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
import ResponsiveTable from '../components/common/ResponsiveTable';

<ResponsiveTable
  columns={columns}
  dataSource={data}
  rowKey="id"
  pagination={{ ... }}
  mobileBreakpoint="md"
  mobileCardClassName="responsive-table-mobile-card"
/>
```

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

## Styling and Theme

- **Container**: `.responsive-table-mobile-container` wraps the list of cards.
- **Card**: `.responsive-table-mobile-card`; use for custom cards so theme applies.
- **Theme**: Use CSS variables: `var(--text-primary)`, `var(--text-secondary)`, `var(--border-primary)`, `var(--bg-primary)`. Global styles in `globals.css` define `body[data-theme='dark'] .responsive-table-mobile-card` for background/border/hover.

Default card body uses label (left, `var(--text-secondary)`) and value (right, `var(--text-primary)`), with bottom border `var(--border-primary)` between rows.

## When to Use

- Any list page that uses Ant Design `Table` and must work on mobile: use `ResponsiveTable` instead of `Table`, add column options as needed.
- Existing pages using it: suppliers, expenses, equipment, users, stores, categories, payment-records, partners, partner-invoices, partner-invoice-summaries, orders, products (ProductList), news (NewsList), tax-return-report.

## Checklist

- [ ] Replace `Table` with `ResponsiveTable` (same props plus optional mobile*).
- [ ] Set `rowKey` (string or function).
- [ ] **Desktop**: For fixed main column(s) at start: set first column(s) `fixed: 'left'` and `width`. For fixed action column(s) at end: set last column(s) `fixed: 'right'` and `width`. Set `scroll={{ x: number }}` or `scroll={{ x: 'max-content' }}`.
- [ ] For columns to hide on mobile: `mobileShow: false`.
- [ ] For custom order on mobile: set `mobilePriority`.
- [ ] For custom label or cell on mobile: `mobileLabel` / `mobileRender`.
- [ ] Optional: `mobileCardRender` for fully custom cards.
- [ ] Use theme variables in any custom card styles; add `body[data-theme='dark']` overrides if needed.
