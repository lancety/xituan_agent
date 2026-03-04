# Partner Supply List & Price Sharing Design

## 1. Goals

Provide a per-partner supply product list that:

- Reuses existing product, partner, barcode, and invoice pricing logic
- Shows, for each product:
  - Name, category, metadata
  - Barcode (text + image)
  - Base price, partner wholesale price (ex-GST), GST amount
- Is shared to partners via a URL containing merchant/partner IDs (UUIDs)
- Has a history tab so partners can see:
  - When products were added/removed from the supply list
  - When base prices changed
- Respects each partner's barcode preference (unique vs shared)

Design principle: **minimal, incremental changes** on top of the existing architecture.

---

## 2. Existing Components Reused (Confirmed)

### 2.1 Product model

Backend entity:

```7:47:d:\projects\xituan_module\xituan_backend\src\domains\product\domain\product.entity.ts
@Entity('products', { schema: 'merchant' })
export class Product {
  ...
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: false, name: 'base_price' })
  basePrice!: number;
  ...
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'wholesale_price_20' })
  wholesalePrice20?: number;
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'wholesale_price_25' })
  wholesalePrice25?: number;
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'wholesale_price_30' })
  wholesalePrice30?: number;
  ...
  @Column({ 
    type: 'boolean', 
    default: false, 
    name: 'is_gst_free',
    comment: '是否GST-free（true = GST-free，false = 需要GST）'
  })
  isGstFree!: boolean;
  ...
  @Column({ type: 'text', nullable: true, name: 'bar_code' })
  barCode?: string | null;
  @Column({ type: 'text', nullable: true, name: 'bar_code_shared' })
  barCodeShared?: string | null;
  ...
}
```

We **reuse**:

- `basePrice`, `wholesalePrice20/25/30` for pricing
- `isGstFree` for GST logic
- `barCode` and `barCodeShared` for barcode behaviour

There is currently **no** field indicating "this product is in the partner supply list" — that will be added.

### 2.2 Partner model & barcode preference

Types:

```6:17:d:\projects\xituan_module\xituan_backend\submodules\xituan_codebase\typing_entity\partner.type.ts
export enum epPartnerType {
  STORE = 'store',
  BULK = 'bulk',
  DISTRIBUTOR = 'distributor'
}

export enum epBarCodePreference {
  UNIQUE = 'unique',         // 唯一 - 使用barCode
  SHARED = 'shared'          // 共享 - 使用barCodeShared
}

export interface iPartner {
  ...
  discountRate: number;
  ...
  barCodePreference: epBarCodePreference;
  isGstFreeCustomisable: boolean;
  ...
}
```

Entity:

```100:115:d:\projects\xituan_module\xituan_backend\src\domains\partner\domain\partner.entity.ts
@Column({ 
  type: 'varchar', 
  length: 20,
  default: 'unique',
  name: 'bar_code_preference',
  comment: '条形码偏好'
})
barCodePreference!: epBarCodePreference;

@Column({ 
  type: 'boolean', 
  default: true,
  name: 'is_gst_free_customisable',
  comment: '是否支持产品GST独立设置（true = 使用产品自身的isGstFree，false = 统一按需要GST计算）'
})
isGstFreeCustomisable!: boolean;
```

We **reuse**:

- `discountRate` as the only partner-specific price parameter
- `barCodePreference` to decide how to filter and display products based on barcodes
- `isGstFreeCustomisable` in GST logic via existing util

No new partner fields are required for the supply list feature in the final design (we use `merchantId` + `partnerId` in the URL instead of a dedicated share token).

### 2.3 Invoice item pricing & GST calculation

Util (already implemented, used for partner invoices):

```29:155:d:\projects\xituan_module\xituan_backend\submodules\xituan_codebase\utils\invoiceDetail.util.ts
export function calculateInvoiceDetailItem(
  product: iProduct,
  partner: iPartner,
  quantity: number,
  isGstRegistered: boolean,
  isPriceInclusiveGst: boolean
): iPartnerInvoiceItem {
  // Step 1: basePrice
  // Step 2: effective GST flags (isGstFree, isGstRegistered, isGstFreeCustomisable)
  // Step 3: retailPriceBase / retailPriceGst / retailPriceWithGst
  // Step 4: partnerDiscountPrice based on partnerType + discountRate + wholesalePrice20/25/30
  // Step 5: unitPrice (ex-GST), gst (per unit)
  // Step 6–7: amount, gstAmount, subtotal
}
```

For the supply list we:

- Call `calculateInvoiceDetailItem(product, partner, quantity = 1, isGstRegistered, isPriceInclusiveGst)`
- Use these fields per product:
  - `retailPriceBase` (base price, ex-GST)
  - `unitPrice` (partner unit price, ex-GST)
  - `gst` (GST per unit, if applicable)
- Ignore `quantity`-dependent totals (`amount`, `subtotal`) on the list view.

This guarantees **exact consistency** between the supply list and partner invoice unit prices.

### 2.4 Print templates & barcode rendering

Frontend template renderer (already implemented) supports barcode elements and respects `barCodePreference` when binding data:

```236:243:d:\projects\xituan_module\xituan_cms\src\utils\templateRenderer.util.ts
// Special handling for barcode fields based on partner preference
if (path === 'barCode' && data.partner?.barCodePreference === 'shared') {
  const sharedBarcode = this.getNestedValue(data, 'barCodeShared');
  if (sharedBarcode) {
    return String(sharedBarcode);
  }
}
```

Barcode HTML structure:

```158:161:d:\projects\xituan_module\xituan_cms\src\utils\templateRenderer.util.ts
<div class="barcode" data-content="${content}" data-barcode="true" data-element-id="${element.id}">
  <canvas id="barcode-${element.id}" style="width: 100%; height: 100%;"></canvas>
</div>
```

For the supply list:

- We **reuse the same visual barcode logic** (CSS + `<canvas>` + JS barcode library) so that barcodes look identical to existing print templates.
- On the shared supply list page, each row shows:
  - Barcode text (selected according to the partner’s preference)
  - The rendered barcode image using the same conventions.

---

## 3. Schema Changes

### 3.1 Product: mark items that belong to the partner supply list

**New column** on `merchant.products`:

- Name: `is_partner_supply_item`
- Type: `boolean`
- Default: `false`

Semantics:

- `true`: this product appears in the generic partner supply list for **all** partners.
- `false`: this product is not part of the supply list (even if it exists in the product catalog).

Implementation notes:

- TypeORM:
  - Add `@Column({ type: 'boolean', default: false, name: 'is_partner_supply_item' }) isPartnerSupplyItem!: boolean;` to `Product` entity.
- Migration:
  - `ALTER TABLE merchant.products ADD COLUMN IF NOT EXISTS is_partner_supply_item boolean NOT NULL DEFAULT false;`

Indexes:

- Optional but recommended:
  - `CREATE INDEX idx_products_partner_supply ON merchant.products(is_partner_supply_item) WHERE is_partner_supply_item = true;`
  - This speeds up supply list queries which will always filter on `is_partner_supply_item = true`.

### 3.2 Supply list change history

**New table** `merchant.partner_supply_list_changes`:

Purpose:

- Track global changes to the supply list configuration so partners can see:
  - when products were added/removed
  - when base prices changed
  - when product GST-inclusive flag changed (含GST / 不含GST, i.e. `is_gst_free`)

Suggested schema (see migration 1710000000240 for `new_is_gst_free` and `GST_INCLUSIVE_CHANGE`; old = !new for display):

```sql
CREATE TABLE merchant.partner_supply_list_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL,
  product_id UUID NOT NULL,
  change_type VARCHAR(32) NOT NULL, -- 'ADD' | 'REMOVE' | 'BASE_PRICE_CHANGE' | 'GST_INCLUSIVE_CHANGE'
  old_is_partner_supply_item BOOLEAN,
  new_is_partner_supply_item BOOLEAN,
  old_base_price NUMERIC(10,2),
  new_base_price NUMERIC(10,2),
  new_is_gst_free BOOLEAN,  -- for GST_INCLUSIVE_CHANGE (null as false; old = !new)
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  operator_id UUID, -- optional: admin user who made the change
  note TEXT
);

CREATE INDEX idx_partner_supply_changes_merchant_time
  ON merchant.partner_supply_list_changes(merchant_id, changed_at DESC);

CREATE INDEX idx_partner_supply_changes_product
  ON merchant.partner_supply_list_changes(merchant_id, product_id, changed_at DESC);
```

Notes:

- This table is **global per merchant**, not per partner.
- Per-partner effects (actual wholesale price ex-GST / GST amount) are computed at read time using `calculateInvoiceDetailItem` so that the same history works for all partners.

### 3.3 Partner schema

For the **final design**:

- We **do not** add new columns to `merchant.partners` beyond what already exists.
- We intentionally **do not introduce** a `partner_product_settings` table in this iteration, because:
  - All partners share the same supply list (`is_partner_supply_item = true` products).
  - Partner-specific differences are:
    - `discountRate`
    - `barCodePreference`
    - `isGstFreeCustomisable`

URL security:

- The shared supply list URL uses:
  - `merchantId` (UUID)
  - `partnerId` (UUID)
- Backend verifies:
  - `Partner.merchantId` matches the `merchantId` in the path
  - The request is routed through the correct merchant schema.

No extra token is required in the final agreed design (less moving parts; merchant/partner UUIDs are already hard to guess).

---

## 4. Backend Logic

### 4.1 Selecting products for the supply list

Given `(merchantId, partnerId)`:

1. **Verify partner:**
   - `SELECT * FROM merchant.partners WHERE id = $partnerId AND merchant_id = $merchantId;`
   - If not found, return 404.

2. **Base product filter:**

   ```sql
   SELECT *
   FROM merchant.products
   WHERE merchant_id = $merchantId
     AND is_partner_supply_item = true
     AND status = 'ACTIVE'
     AND deleted_at IS NULL;
   ```

3. **Apply barcode preference:**

   - Read `partner.barCodePreference` (`UNIQUE` or `SHARED`).

   - If `UNIQUE`:
     - **No additional filter** — show all products from step 2, even if barcodes are shared.

   - If `SHARED`:
     - Only include:
       - Products with **no shared barcode**:

         ```sql
         (bar_code_shared IS NULL OR bar_code_shared = '')
         ```

       - Or products where the product is the **shared root** (its own barcode equals the shared barcode):

         ```sql
         (bar_code IS NOT NULL AND bar_code = bar_code_shared)
         ```

     - Exclude products where the product depends on another product’s barcode:

       ```sql
       NOT (bar_code IS NOT NULL
            AND bar_code_shared IS NOT NULL
            AND bar_code <> bar_code_shared)
       ```

   This matches the business rule:

   - In shared mode, a **physical barcode appears only once** in the list:
     - either as a standalone (no shared code),
     - or as the shared root (`barCode == barCodeShared`).
   - Dependent products (those with `barCode != barCodeShared`) are hidden in the supply list for partners who prefer shared codes.

### 4.2 Computing per-product prices and GST

For each selected product:

1. Load:
   - `product` (includes `basePrice`, `wholesalePrice20/25/30`, `isGstFree`, `barCode`, `barCodeShared`)
   - `partner` (includes `discountRate`, `partnerType`, `barCodePreference`, `isGstFreeCustomisable`)
   - Tax context:
     - `isGstRegistered` (company-level)
     - `isPriceInclusiveGst` (whether stored basePrice is GST-inclusive)

2. Call:

   ```ts
   const item = calculateInvoiceDetailItem(
     product,
     partner,
     1,                  // quantity = 1
     isGstRegistered,
     isPriceInclusiveGst
   );
   ```

3. Extract fields for the supply list:

   - `retailPriceBase`  → **base price (ex-GST)** for display
   - `unitPrice`        → **partner wholesale unit price (ex-GST)**
   - `gst`              → **GST per unit**
   - Optionally `retailPrice` / `retailPriceGst` for reference if needed.

4. Do **not** use `amount` / `subtotal` (these are quantity-based).

This ensures all calculations:

- Use the same price ladder logic (`wholesalePrice20/25/30`, `discountRate`, `partnerType`).
- Use existing GST methodology (GST registration status, GST-free rules, 10/11 adjustment for non-registered partners, etc.).

### 4.3 Recording supply list changes

When certain product fields change, we write rows into `partner_supply_list_changes`:

1. **Add to supply list**

   - Condition:
     - `is_partner_supply_item` changes from `false` → `true`.
   - Insert:

   ```sql
   INSERT INTO merchant.partner_supply_list_changes (
     merchant_id,
     product_id,
     change_type,
     old_is_partner_supply_item,
     new_is_partner_supply_item,
     old_base_price,
     new_base_price,
     changed_at,
     operator_id
   ) VALUES (..., 'ADD', false, true, oldBasePrice, newBasePrice, NOW(), operatorId);
   ```

2. **Remove from supply list**

   - Condition:
     - `is_partner_supply_item` changes from `true` → `false`.
   - Insert with `change_type = 'REMOVE'`.

3. **Base price change**

   - Condition:
     - `base_price` changes while `is_partner_supply_item = true` (either before or after, depending on how strict we want to be).
   - Insert with `change_type = 'BASE_PRICE_CHANGE'` and the old/new base price values.

4. **GST-inclusive change (product 含GST / 不含GST)**

   - Condition:
     - `is_gst_free` (product-level) changes while `is_partner_supply_item = true`.
   - Insert with `change_type = 'GST_INCLUSIVE_CHANGE'`, `new_is_gst_free` only (old = !new for display), and existing base price fields so the history row is consistent.

Hook points:

- Product admin update flows in `ProductService` or `ProductRepository`:
  - When updating `basePrice`, `isPartnerSupplyItem`, or `isGstFree`, compare old vs new values and insert a change-row if needed (ADD/REMOVE/BASE_PRICE_CHANGE/GST_INCLUSIVE_CHANGE).

### 4.4 API surface

Backend routes (example shape; final paths must follow existing `partner.routes.ts` conventions):

- **Get supply list for a partner**

  - `GET /api/partners/:merchantId/:partnerId/supply-list`
  - Response:
    - Products with:
      - `productId`, `name`, `category`
      - `barCode` (selected according to `barCodePreference`)
      - `retailPriceBase`, `unitPrice`, `gst`

- **Get supply list change history (for the history tab)**

  - `GET /api/partners/:merchantId/:partnerId/supply-list/changes?since=YYYY-MM-DD`
  - Implementation:
    - Query `partner_supply_list_changes` for `merchant_id = merchantId`.
    - For each change row, compute:
      - Old and new partner prices via `calculateInvoiceDetailItem` using `old_base_price` vs `new_base_price` (and `is_partner_supply_item` flags).
    - Return a list ordered by `changed_at DESC`.

Security:

- For both endpoints:
  - Validate that `Partner.merchantId === merchantId`.
  - For CMS-only usage, require admin authentication.
  - For partner-facing usage, we can later introduce lightweight authentication (e.g. a per-partner PIN) without changing the data model.

---

## 5. CMS UI & UX

### 5.1 Partner list action

In the CMS partner list page:

- Add an action button in the partner row, e.g. **“Supply list”**.
- On click:
  - Open `/partner-supply-list/:merchantId/:partnerId` in a new tab.
  - This page is a generic “shared supply list viewer” for that partner.

### 5.2 Supply list page structure

Two main tabs:

1. **Supply Products**
   - Columns:
     - Product name
     - Category
     - Key metadata (size, flavour, etc.)
     - Barcode text
     - Barcode image (rendered via existing barcode canvas logic)
     - Base price (ex-GST) → `retailPriceBase`
     - Partner wholesale price (ex-GST) → `unitPrice`
     - GST per unit → `gst`
   - All prices are single-unit, no quantity totals.

2. **Change History**
   - Data from `partner_supply_list_changes` (via API).
   - Each row shows:
     - Time (`changed_at`)
     - Product (name + barcode)
     - Change type (ADD / REMOVE / BASE_PRICE_CHANGE / GST 含/不含 变更)
     - For GST_INCLUSIVE_CHANGE: label "改为含GST" or "改为不含GST" per `new_is_gst_free`
     - Old vs new partner wholesale price (ex-GST and GST, derived via util) where applicable
     - Optional operator information.
   - Ordered by `changed_at DESC`.

Barcode rendering:

- Reuse the same CSS and JS used by print templates (`.barcode` container + `<canvas>`).
- This guarantees consistent appearance between:
  - Printed labels / invoices (PrintTemps)
  - On-screen supply list.

---

## 6. Non-goals / Deferred Items

To keep the first iteration small and safe:

- **No partner-specific product overrides**:
  - No `partner_product_settings` table in this version.
  - All partners see the same set of supply products (filtered only by `isPartnerSupplyItem` and barcode preference).
- **No share token yet**:
  - The URL uses `(merchantId, partnerId)` directly.
  - If needed, we can later add a per-partner `supplyListPin` or `supplyListToken` without changing this core design.

---

## 7. Summary

- We reuse existing:
  - Product schema (`basePrice`, `wholesalePrice20/25/30`, `isGstFree`, `barCode`, `barCodeShared`)
  - Partner schema (`discountRate`, `barCodePreference`, `isGstFreeCustomisable`)
  - Invoice pricing util (`calculateInvoiceDetailItem`)
  - Print template barcode rendering logic.
- We add:
  - One boolean flag on products: `isPartnerSupplyItem`
  - One new table: `merchant.partner_supply_list_changes`
- We implement:
  - A supply list API that:
    - Filters products by `isPartnerSupplyItem` and partner barcode preference
    - Uses the same pricing logic as partner invoices
  - A CMS supply list page with:
    - A “products” tab (single-unit prices + barcodes)
    - A “history” tab based on the new change-log table.

This design is minimal, consistent with existing domains (product, partner, barcode, invoice), and can be implemented incrementally without breaking current flows.

---

## 8. Implementation Summary

### 8.1 Files added/updated

| Area | File | Change |
|------|------|--------|
| Migration | `migrations/1710000000238_partner_supply_list.sql` | Add `products.is_partner_supply_item`; create `partner_supply_list_changes` (partitioned by `merchant_id`). |
| Migration | `migrations/1710000000240_partner_supply_list_gst_change.sql` | Add `new_is_gst_free`; extend `change_type` CHECK to `GST_INCLUSIVE_CHANGE`. |
| Product entity | `product.entity.ts` | Add `isPartnerSupplyItem`. |
| Product types | `typing_entity/product.type.ts`, `typing_api/products.type.ts`, `product/types/product.type.ts` | Add `isPartnerSupplyItem` to iProduct, create/update requests. |
| Partner entity | `partner/domain/partner-supply-list-change.entity.ts` | New entity for change log. |
| Partner types | `typing_entity/partner.type.ts` | Add `epPartnerSupplyListChangeType` (incl. `GST_INCLUSIVE_CHANGE`), `iPartnerSupplyListChange` (incl. `newIsGstFree`), `iPartnerSupplyListItem`. |
| DB config | `shared/infrastructure/database.config.ts` | Register `PartnerSupplyListChange` entity. |
| Product repo | `product/infrastructure/product.repository.ts` | Add `findSupplyListProductsByMerchantId(merchantId)`. |
| Partner repo | `partner/infrastructure/partner.repository.ts` | Add `getPartnerByIdAndMerchantId`, `createSupplyListChange`, `getSupplyListChanges`. |
| Partner service | `partner/services/partner.service.ts` | Add `getSupplyList(merchantId, partnerId)`, `getSupplyListChanges(merchantId, options?)`. |
| Partner controller | `partner/controllers/partner.controller.ts` | Add `getSupplyList`, `getSupplyListChanges`. |
| Partner routes | `partner/routes/partner.routes.ts` | Add `GET /partners/supply-list/:merchantId/:partnerId`, `GET .../changes`. |
| Product service | `product/services/product.service.ts` | After create/update, record ADD/REMOVE/BASE_PRICE_CHANGE via `partnerRepository.createSupplyListChange`. |

### 8.2 API

- **Supply list (by merchant + partner):**  
  `GET /api/.../partners/supply-list/:merchantId/:partnerId`  
  Returns `{ partner, items: iPartnerSupplyListItem[] }`.
- **Change history:**  
  `GET /api/.../partners/supply-list/:merchantId/:partnerId/changes?since=YYYY-MM-DD&limit=100`  
  Returns `iPartnerSupplyListChange[]` (ordered by `changed_at` DESC).

### 8.3 Partner-facing access (no login)

Currently these routes are mounted under the same partner router that uses `authMiddleware` and `merchantRequiredMiddleware`. So they work when the **CMS user** is logged in and the frontend calls them with `merchantId` and `partnerId` from the shared URL.

To allow **partners** to open the supply list link without logging in (“目前允许直接查询”):

- Expose the same two handlers on a **public** router (no auth, no merchant context), and validate only that `partner.merchantId === merchantId` in the service (already done).
- Or add a path-based exception in auth middleware for these two paths so they can be called without a session.

---

## 9. Agent skills (reusable)

The implementation is split into project-level agent skills under `.cursor/skills/` for reuse across features:

| Skill | Focus | Use when |
|-------|--------|----------|
| **layout-selection** | MainLayout vs PartnerFacingLayout; no CMS on partner-facing; MerchantStatusGate allowlist. | Adding pages, partner-facing views, layout refactors. |
| **api-route-groups** | Public / CMS/admin / platform / third-party (partner-access) route grouping; no-auth vs auth; UUID validation. | Adding or moving API routes; third-party or role-based auth. |
| **partner-supply-list** | `is_partner_supply_item`, change history (ADD/REMOVE/BASE_PRICE_CHANGE), pricing via `calculateInvoiceDetailItem`, barcode preference, list/history display norms. | Supply list logic, product hooks, supply/history APIs, CMS supply toggle or partner-facing tabs. |

