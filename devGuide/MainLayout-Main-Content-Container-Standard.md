# MainLayout Main Content Container Standard

Standard layout and style for the main content area inside MainLayout (CMS or Platform). Reference implementations: **Orders** (`xituan_cms/src/pages/orders.tsx`), **Payment records** (`payment-records.tsx`), **Revenues** (`revenues/index.tsx`).

---

## 1. Structure Overview

- **1660px wrapper** (in MainLayout): `max-width: 1660px`, `margin: 0 auto`, `width: 100%`, **no padding**. Do **not** use `padding: 24px` (or any padding) on this parent container; padding belongs to the main section wrapper inside the page.
- **`.page-container`**: no padding; children define the main section.
- **Main section wrapper** (page-level): use `className="cms-main-content-wrapper"` (see Section 3). Provides responsive padding and main area background.
- **Header block (title block)**: one Card for page title, optional subtitle, and right-aligned action buttons; use `className="cms-page-header-card"` and unified h1 style.
- **Section blocks**: one or more Card blocks with shared `cardStyle`, 24px spacing between them.

---

## 2. Main Content Container Background

- The **main section** (the area that wraps all page content under `.page-container`) uses **`var(--bg-secondary)`** as background.
- This defines the “page background” and contrasts with the blocks on top of it.

---

## 3. Main Section Wrapper and Padding

Use `className="cms-main-content-wrapper"` on the main content wrapper. Global CSS in `xituan_cms/src/styles/globals.css` defines:

- **Padding**: Mobile (max-width 767px) **12px**; desktop (min-width 768px) **24px**.
- **Background**: `var(--bg-secondary)`; `width: 100%`; `min-height: 100vh`.
- **Mobile Card body**: Inside `.cms-main-content-wrapper`, `.ant-card .ant-card-body` has `padding: 12px` on mobile.

This is the **single** padding layer for the main content. The max-width 1660px parent container in MainLayout must **not** use padding; otherwise you get double padding.

---

## 4. Card style constant

Use a shared style for all header and section cards so theme and borders are consistent:

```ts
const cardStyle = { background: 'var(--bg-primary)', borderColor: 'var(--border-primary)', borderRadius: 8 };
```

Apply `...cardStyle` to every Card used as the header block or a section block.

---

## 5. Header Block (Title block)

- **One dedicated Card** at the top: `className="cms-page-header-card"`, `style={{ marginBottom: 24, ...cardStyle }}`.
- **Title (h1)**: use **unified title style** so font size and height match across all CMS pages:
  - `className="text-2xl font-bold text-gray-900 dark:text-white"`
  - `style={{ margin: 0 }}`
- **Subtitle** (optional): short description below the title (e.g. `Text` with `color: 'var(--text-secondary)'`, `display: 'block'`, `marginTop: 4`).
- **Right-aligned**: page-level action buttons in the same row as the title.
- **Last child no margin**: The header card body’s **last direct child** must have no bottom margin, so title block height is consistent. Global CSS in `xituan_cms/src/styles/globals.css`:
  ```css
  .cms-page-header-card.ant-card .ant-card-body > *:last-child { margin-bottom: 0 !important; }
  ```
  Do not add `marginBottom` to the last child inside the header Card.

---

## 6. Section Blocks and Spacing

- Each logical section (filters, table, etc.) is a **Card** with `style={{ marginBottom: 24, ...cardStyle }}` (the last block may omit marginBottom).
- **Spacing between section blocks**: **24px**.
- Use theme variables only; no hardcoded colors. Primary vs secondary background keeps contrast comfortable in both light and dark themes.

### 6.1 List / Table Card (ResponsiveTable wrapper)

For Cards that wrap **ResponsiveTable**, on **mobile** make the Card transparent so the mobile card list blends with the main background:

```tsx
const { Grid } = antd;
const { useBreakpoint } = Grid;
const isMobile = !useBreakpoint().md;

<Card
  style={isMobile ? { backgroundColor: 'transparent', border: 'none' } : cardStyle}
  styles={isMobile ? { body: { backgroundColor: 'transparent', padding: 0, boxShadow: 'none' } } : undefined}
>
  <ResponsiveTable locale={{ emptyText: '暂无数据' }} ... />
</Card>
```

Desktop: use `cardStyle`; mobile: transparent background, no border, body padding 0. Apply to all list pages using ResponsiveTable. Always pass `locale={{ emptyText: '...' }}` to ResponsiveTable for mobile empty state (see ResponsiveTable devGuide).

---

## 7. Block Styling Summary

| Layer              | Background         | Padding / spacing      |
|--------------------|--------------------|-------------------------|
| Main section       | `var(--bg-secondary)` | 12px mobile / 24px desktop |
| Header block       | `var(--bg-primary)`   | Internal padding as needed |
| Section blocks     | `var(--bg-primary)`   | Internal padding; 24px gap between blocks |

Use theme variables only; no hardcoded colors so light/dark stay consistent.

---

## 8. Reference Markup (conceptual)

```tsx
const cardStyle = { background: 'var(--bg-primary)', borderColor: 'var(--border-primary)', borderRadius: 8 };

<MainLayout>
  <div className="cms-main-content-wrapper">
    {/* Header block (title block): use cms-page-header-card, last child of body has no margin-bottom */}
    <Card className="cms-page-header-card" style={{ marginBottom: 24, ...cardStyle }}>
      <Row justify="space-between" align="middle">
        <Col>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white" style={{ margin: 0 }}>页面标题</h1>
          <Text style={{ color: 'var(--text-secondary)', display: 'block', marginTop: 4 }}>副标题说明</Text>
        </Col>
        <Col>
          <Space>{/* 整页功能按钮 */}</Space>
        </Col>
      </Row>
    </Card>

    {/* Section blocks - for list Card use mobile transparent pattern (see 6.1) */}
    <Card style={{ marginBottom: 24, ...cardStyle }}>{/* section content */}</Card>
    <Card style={isMobile ? { backgroundColor: 'transparent', border: 'none' } : cardStyle}
          styles={isMobile ? { body: { backgroundColor: 'transparent', padding: 0, boxShadow: 'none' } } : undefined}>
      <ResponsiveTable locale={{ emptyText: '暂无数据' }} ... />
    </Card>
  </div>
</MainLayout>
```

---

## 9. When to Apply

- New CMS or Platform pages under MainLayout that need a clear header and multiple sections.
- Refactoring existing pages to unify layout and readability with this standard.
- Ensuring 1660px wrapper has no padding and a single 24px padding layer for the main content.
