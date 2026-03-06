# Product Options and Custom Presets - CMS Implementation Guide

This document describes the CMS implementation for product option groups and custom presets, including UI components, API usage, validation rules, and backend API behavior.

---

## 1. Overview

- **CustomOptionsEditorModal**: Edit product option groups and options (standalone modal, separate from ProductEditModal)
- **CustomPresetsModal**: Create/edit custom presets (option combinations with preview images)
- **ProductOptionsManager**: Shared component for option group/option management, used inside CustomOptionsEditorModal
- **PresetEditor**: Add/update preset (option selection + preview image)
- **PresetList**: Display preset cards with validation status

---

## 2. CustomOptionsEditorModal

### 2.1 Form Context Requirement

`ProductOptionsManager` uses `MultilingualInput` which relies on `Form.useFormInstance()`. **The modal must wrap `ProductOptionsManager` in a Form** to provide form context:

```tsx
<Form form={form} layout="vertical">
  <ProductOptionsManager ... />
</Form>
```

Without Form, option group and option multilingual names will not display correctly.

### 2.2 Data Flow

- Uses `useState(optionGroups)` for state; Form is only for MultilingualInput context
- Loads option groups via `productOptionApi.getProductOptionGroups(productId)`
- Saves via `productOptionApi.updateProductOptionGroups(productId, optionGroups)`

---

## 3. Product Option Groups API

### 3.1 Admin vs Public

| Route | Controller | Description |
|-------|------------|-------------|
| `GET /admin/products/:id/option-groups` | `getProductOptionGroupsAdmin` | Returns option groups for product in **any status** (draft, needs_completion, active) |
| `GET /products/:id/option-groups` (public) | `getProductOptionGroups` | Returns option groups only for **ACTIVE** products |

**Why**: `findProductById(id, includeDeleted=false)` filters by `status = ACTIVE`. Admin needs to edit options for draft/needs_completion products, so admin route uses `findProductById(id, true)`.

### 3.2 Service

```typescript
// product.service.ts
getProductOptionGroups(productId: string, forAdmin = false): Promise<ProductOptionGroup[]>
```

- `forAdmin = true`: product lookup includes all statuses
- `forAdmin = false`: product must be ACTIVE

---

## 4. Custom Presets API - Request Context

### 4.1 Context Restoration

Both preset list APIs restore request context for partitioned table queries:

- `getProductCustomPresets` (public, product.routes)
- `getProductCustomPresetsAdmin` (admin, admin-product.routes)

```typescript
const context = restoreRequestContextFromReq(req);
if (!context) {
  res.status(400).json({ success: false, message: 'Merchant ID is required' });
  return;
}
// Run in context if AsyncLocalStorage was lost
if (!requestContext.getStore()) {
  presets = await new Promise((resolve, reject) => {
    requestContext.run(context, () =>
      this.presetService.getPresetsByProductId(productId).then(resolve).catch(reject)
    );
  });
}
```

### 4.2 Data Refresh

- `CustomPresetsModal` calls `loadData()` when switching to the "预设列表" tab to sync with latest option groups
- Ensures validation reflects recent option group changes

---

## 5. PresetEditor

### 5.1 Layout

- **Preview image** at top (128x128 in upload, follows FormData pattern)
- **Option groups** below with selectable option buttons
- **Actions** at bottom

### 5.2 Image Preview Modal

- Click on uploaded image opens Modal overlay with larger image (900x900 for server images)
- Does not open in new tab; uses in-page Modal for reliability

### 5.3 Buttons

| Mode | Primary Button | Secondary Button |
|------|----------------|------------------|
| Add (editingPreset = null) | 添加 | 取消 (calls onCancel, closes editor) |
| Edit (editingPreset set) | 更新 | 重置 (resets form to original preset values) |

### 5.4 FormData Image Upload

- `fileList` + `currentPreviewKey` (S3 key) pattern per FormData-Image-Management-System
- New image: `formData.append('previewImage', file)`
- Retain existing: `formData.append('currentPreviewImagePath', currentPreviewKey)`

---

## 6. PresetList

### 6.1 Validation (validatePresetOptionConfig)

A preset is **invalid** if:

1. Any key in `optionConfig` references a non-existent or inactive option
2. **Every** option group (required or optional) must have a selection in `optionConfig`

When a new option group is added, existing presets without a selection for that group are invalid and marked "需更新".

### 6.2 UI

- **All valid section**: Green card "预设校验已通过" + "确认上架" when `allValid && product.status === NEEDS_COMPLETION`
- **Invalid count**: "有 X 个预设需更新（选项组变更后请编辑补充选择）" in warning color
- **Preset cards**: 128x128 image, no body content, image flows to action buttons
- **Invalid edit button**: Warning color background (`--color-warning`), black icon
- **Image click**: Opens Modal with 900x900 preview (large image)

### 6.3 Theme Variables

Requires in `globals.css`:

- `--color-error` (light: #ff4d4f, dark: #ff7875)
- `--color-warning` (light: #faad14, dark: #ffc53d)

---

## 7. CustomPresetsModal

### 7.1 Tabs

- **预设编辑**: PresetEditor (add or edit preset)
- **预设列表**: PresetList (card grid, validation status)

### 7.2 Data Refresh on Tab Switch

When user switches to "预设列表" tab, `loadData()` is called to refetch option groups and presets. This ensures validation is correct after option group changes made in CustomOptionsEditorModal.

---

## 8. File References

| Component | Path |
|-----------|------|
| CustomOptionsEditorModal | `xituan_cms/src/components/products/CustomOptionsEditorModal.tsx` |
| CustomPresetsModal | `xituan_cms/src/components/products/CustomPresetsModal.tsx` |
| ProductOptionsManager | `xituan_cms/src/components/products/ProductOptionsManager.tsx` |
| PresetEditor | `xituan_cms/src/components/products/PresetEditor.tsx` |
| PresetList | `xituan_cms/src/components/products/PresetList.tsx` |
| Product controller | `xituan_backend/src/domains/product/controllers/product.controller.ts` |
| Admin product routes | `xituan_backend/src/domains/product/routes/admin-product.routes.ts` |
| Product routes (public) | `xituan_backend/src/domains/product/routes/product.routes.ts` |
| globals.css (theme vars) | `xituan_cms/src/styles/globals.css` |

---

## 9. Related Docs

- `FormData-Image-Management-System.md` - Image upload pattern for preset preview
- `cms-multilingual-form-editor` skill - MultilingualInput + Form context
- `custom-product-preset-list-design.md` - WeChat app frontend design (backend/CMS complete; WeChat app pending)
