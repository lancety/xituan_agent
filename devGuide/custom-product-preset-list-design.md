# Custom Product Preset List Design (WeChat App)

## 1. Overview

This document provides the design for **preset option combinations** in custom products (e.g. cakes) in the WeChat mini-program. Users can either:
- **Custom**: Manually select options from each option group (current flow)
- **Preset list**: Browse pre-defined option combinations and apply one to the custom form with one tap

When preset data exists for a product, the custom page shows tabs `自定制 | 预设列表`; otherwise only the custom form is shown.

**Status**: Backend and CMS implementation are **complete**. See `Product-Options-And-Custom-Presets-CMS-Implementation.md`. This document focuses on the remaining **WeChat app frontend** work and aligns with the existing implementation.

---

## 2. Requirements Summary

| Requirement | Description |
|-------------|-------------|
| Tab display | Show tabs only when preset data exists for the product |
| Preset item | Preview image + option config object (groupId -> optionId map) |
| Browse | Scrollable preset list; user can browse previews |
| Apply | Tap preset -> confirmation modal -> apply to custom form |
| Scroll resume | Return to preset list preserves last scroll position |
| Validation | Filter invalid presets before display/apply (client-side, same logic as CMS PresetList) |

---

## 3. Implemented Backend & CMS (Reference)

### 3.1 Table & Migration

- **Table**: `merchant.product_custom_presets` (HASH partitioned by merchant_id)
- **Migration**: `1710000000245_add_product_custom_presets_and_needs_completion.sql`
- **Columns**: id, merchant_id, product_id, preview_image_path, option_config (JSONB), active, created_at, updated_at
- **No sort_order**: Presets ordered by `createdAt` ASC

### 3.2 API (Implemented)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/products/:id/custom-presets` | Public: list active presets (no validation) |
| GET | `/admin/products/:id/custom-presets` | Admin: list all presets |
| POST | `/admin/products/:id/custom-presets` | Admin: create preset (multipart: previewImage) |
| PUT | `/admin/products/:id/custom-presets/:presetId` | Admin: update preset |
| DELETE | `/admin/products/:id/custom-presets/:presetId` | Admin: delete preset |

Both preset list APIs restore request context for partitioned table queries (see Product-Options-And-Custom-Presets-CMS-Implementation.md §4).

### 3.3 iCustomPreset Type (xituan_codebase)

```typescript
// typing_entity/product.type.ts
interface iCustomPreset {
  id: string;
  productId: string;
  merchantId: string;
  previewImagePath: string | null;
  optionConfig: Record<string, string>;  // groupId -> optionId
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### 3.4 Validation (Client-Side in CMS)

The backend returns **all active presets** without validation. CMS `PresetList` uses `validatePresetOptionConfig`:
- Invalid if any `optionConfig[groupId]` references non-existent or inactive option
- Invalid if preset does not have a selection for **every** option group (required or optional)

WeChat app must apply the same validation: filter invalid presets before display, only allow apply for valid presets.

### 3.5 CMS Components (Implemented)

- **CustomPresetsModal**: Tabs 预设编辑 | 预设列表
- **PresetEditor**: Option selection + preview image (FormData pattern)
- **PresetList**: Card grid, validation status, invalid marked "需更新"

---

## 4. Frontend Design (WeChat App) – Implementation Remaining

### 4.1 Data Model

Reuse `iCustomPreset` from `xituan_codebase/typing_entity/product.type.ts`.

```typescript
// page data additions (page-config.type.ts)
interface iProductCustomPageData {
  // ... existing
  activeTab: 'custom' | 'preset';
  presets: iCustomPreset[];           // valid presets only (filtered client-side)
  presetsLoading: boolean;
  presetListScrollTop: number;
}
```

### 4.2 Validation (Client-Side)

Before using presets, filter invalid ones using the same logic as CMS `PresetList.validatePresetOptionConfig`:
1. For each preset: every `optionConfig` key must be a current option group; every value must be an active option in that group.
2. Preset must have a selection for **every** option group (required or optional).
3. Only show and allow apply for valid presets.

### 4.3 Tab Display Logic

- When `presets.length > 0` (after filtering): show tabs `自定制 | 预设列表`.
- When no valid presets: no tabs; show only custom form.
- Default `activeTab = 'custom'`.

### 4.4 Preset List UI

- Vertical scrollable list (recommend for mobile).
- Each item: preview image (or placeholder), optionally option summary text.
- `bindtap` on item -> confirmation modal -> apply to custom form.

### 4.5 Apply Flow

1. User taps preset item (only valid presets are tappable).
2. `wx.showModal`: "确认使用此组合？" (Confirm / Cancel).
3. On Confirm: `setData({ selectedOptions: preset.optionConfig, activeTab: 'custom' })`, `calculatePrice()`, `updateSubmitButtonState()`.
4. On Cancel: do nothing.

### 4.6 Scroll Position Resume

- `scroll-view` with `scroll-top="{{presetListScrollTop}}"`, `bindscroll` saves `e.detail.scrollTop`.

### 4.7 Loading Sequence

1. `onLoad`: load product, option groups (existing).
2. After option groups loaded: call `GET /products/:id/custom-presets`.
3. Filter presets with validation logic; if any valid presets remain, set `presets`, enable tabs.

### 4.8 WXML Structure (Conceptual)

```xml
<!-- Tabs: only when presets exist -->
<view wx:if="{{presets.length > 0}}" class="tabs">
  <view class="tab {{activeTab === 'custom' ? 'active' : ''}}" data-tab="custom" bindtap="onTabChange">自定制</view>
  <view class="tab {{activeTab === 'preset' ? 'active' : ''}}" data-tab="preset" bindtap="onTabChange">预设列表</view>
</view>

<!-- Custom form: shown when activeTab === 'custom' -->
<view wx:if="{{activeTab === 'custom'}}" class="custom-form">
  <!-- existing option groups, quantity, note, etc. -->
</view>

<!-- Preset list: shown when activeTab === 'preset' -->
<scroll-view wx:if="{{activeTab === 'preset'}}"
  scroll-y
  scroll-top="{{presetListScrollTop}}"
  bindscroll="onPresetListScroll"
  class="preset-list">
  <view wx:for="{{presets}}" wx:key="id" class="preset-item" data-preset="{{item}}" bindtap="onPresetTap">
    <image class="preset-preview" src="{{item.previewImageUrl || placeholder}}" mode="aspectFill" />
    <!-- optional: option summary text -->
  </view>
</scroll-view>
```

---

## 5. Implementation Order (Remaining)

1. **WeChat App** (only remaining work)
   - API call: `GET /products/:id/custom-presets`
   - Client-side validation: filter invalid presets (same logic as PresetList)
   - Page data: `presets`, `activeTab`, `presetListScrollTop`
   - Tabs + preset list UI
   - Apply flow with confirmation modal
   - Scroll resume
   - Preview image URL: use same pattern as product images (contentUtil / productImageMapUtil)

---

## 6. File References

| Item | Path |
|------|------|
| CMS implementation guide | `Product-Options-And-Custom-Presets-CMS-Implementation.md` |
| Product custom page | `xituan_wechat_app/pages/product-custom/product-custom.ts` |
| PresetEditor, PresetList | `xituan_cms/src/components/products/PresetEditor.tsx`, `PresetList.tsx` |
| validatePresetOptionConfig | `PresetList.tsx` (export for reuse or copy logic to WeChat app) |
| iCustomPreset type | `xituan_codebase/typing_entity/product.type.ts` |
| Preset service | `xituan_backend/src/domains/product/services/product-custom-preset.service.ts` |
| Product routes | `xituan_backend/src/domains/product/routes/product.routes.ts` |
