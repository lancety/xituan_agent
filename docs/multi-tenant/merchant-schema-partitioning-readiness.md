# Merchant schema partitioning – readiness check

Pre-migration checklist for converting merchant tables to HASH(merchant_id) partitioning. Per devGuide: partition counts by table (50 uniform), simple migration mode (rename → create partitioned table → copy data).

---

## 0. Full schema check: merchant_id isolation (40 tables)

All tables under `merchant` schema were verified to have a `merchant_id` column used for tenant isolation (from entity definitions and/or migration `1710000000221_split_schemas_platform_and_merchant.sql`). So **all 40 tables are suitable** for the same 50-partition-by-`merchant_id` migration pattern from a schema perspective. Implementation priority (which to partition first) is in section 1.

| Table | Has merchant_id | Source | Note |
|-------|-----------------|--------|------|
| alert_orders_payments | Y | Entity | |
| cart_items | Y | Entity | |
| carts | Y | Entity | |
| categories | Y | Entity | |
| equipment | Y | Entity | |
| equipment_depreciation_records | Y | Entity | |
| expenses | Y | Entity | |
| inventory_locks | Y | Entity | |
| inventory_transactions | Y | Entity | |
| merchant_settings | Y | Entity | |
| news | Y | Entity | |
| offer_products | Y | Entity | |
| offers | Y | Entity | |
| order_items | Y | Entity | |
| order_payment_records | Y | Entity | |
| order_status_transitions | Y | Entity | |
| orders | Y | Entity | |
| partner_addresses | Y | Entity | |
| partner_invoice_summaries | Y | Entity | |
| partner_invoices | Y | Entity | |
| partners | Y | Entity | |
| preorder_promotes | Y | Entity | |
| preorders | Y | Entity | |
| print_temp_cache | Y | Entity | |
| print_temp_elements | Y | Entity | |
| print_temp_script_history | Y | Entity | |
| print_temp_usage_logs | Y | Entity | |
| print_temps | Y | Entity | |
| product_barcodes | Y | Migration 1710000000221 | No TypeORM entity; raw SQL in product.service |
| product_inventory | Y | Entity | |
| product_option_groups | Y | Entity | |
| product_options | Y | Entity | |
| products | Y | Entity | |
| products_preorderable | Y | Entity | |
| revenues | Y | Entity | |
| store_addresses | Y | Entity | |
| suppliers | Y | Entity | |
| tax_return_report_audit_logs | Y | Entity | |
| tax_return_reports | Y | Entity | |
| webhooks_events_airwallex | Y | Migration 1710000000221 | No TypeORM entity; raw SQL in webhook-event.service |

**Conclusion**: Every merchant schema table has `merchant_id` and can be partitioned by HASH(merchant_id) with the same DDL pattern. The plan in section 1 only prioritises a subset (orders chain + revenues + inventory_transactions + expenses + cart_items); the rest can be added in later phases with the same steps.

---

## 1. Target tables and partition counts (from devGuide)

**Uniform partition count**: All tables partitioned by `merchant_id` use the **same** partition count (e.g. 50) so that the same merchant lands in the same partition index in every table.

| Table | Partition count | Priority | Note |
|-------|-----------------|----------|------|
| orders | 50 | Highest | Pilot first |
| order_items | 50 | Highest | After orders |
| order_status_transitions | 50 | Highest | |
| order_payment_records | 50 | Highest | |
| revenues | 50 | Highest | |
| inventory_transactions | 50 | Highest | |
| expenses | 50 | Medium | Same modulus as above |
| cart_items | 50 | Medium | Same modulus; ~219k rows/merchant/year (100 customers/day × 2 carts × 3 items × 365) |
| equipment_depreciation_records, partner_invoices, etc. | — | Low | Not partitioned for now |

---

## 2. Current state (from migration 1710000000221 and entities)

### 2.1 merchant.orders

- **PK**: `id` (UUID) — must become composite `(id, merchant_id)` for partitioning.
- **Unique**: `idx_orders_merchant_order_number` on `(merchant_id, order_number)` — already partition-key compliant.
- **FK out**: `fk_orders_merchant` — `merchant_id` → `platform.merchants(id)`. **Must drop**: PostgreSQL does not allow a partitioned table to have a foreign key that references another table. Rely on application to ensure `merchant_id` is valid.
- **Indexes**: `idx_orders_merchant_id` on `(merchant_id)`. After partition, add e.g. `(merchant_id, created_at)`, `(merchant_id, status)` on the partitioned table for query performance.
- **Entity**: `Order` has `@PrimaryGeneratedColumn('uuid') id` and `merchantId`. After partition, entity should use composite PK `(id, merchantId)` (TypeORM: `@PrimaryColumn()` for both) so that findByPk and FKs align.

### 2.2 Tables that reference orders

From migrations_stable and 1710000000221, these tables have or had FK to `orders(id)`:

| Table | Column(s) | Current FK | Action when orders is partitioned |
|-------|------------|------------|-------------------------------------|
| order_items | order_id, merchant_id | Likely `order_id` → orders(id) | Prefer composite FK `(order_id, merchant_id)` → orders(id, merchant_id). If not supported or too heavy, drop FK and enforce in app. |
| order_status_transitions | order_id, merchant_id | order_id → orders(id) | Same as above. |
| order_payment_records | order_id, merchant_id | order_id → orders(id) | Same as above. |
| inventory_locks | order_id (nullable?) | order_id → orders(id) | Same as above. |

PostgreSQL allows FKs that **reference** a partitioned table; the referencing table can point to the partition key as well. So after orders has PK (id, merchant_id), add or replace FK with `(order_id, merchant_id) REFERENCES orders(id, merchant_id)` where the child table has both columns.

### 2.3 merchant.order_items

- **PK**: `id` (UUID) — for partitioning use composite `(id, merchant_id)`.
- **Unique**: none that conflict.
- **FK out**: `fk_order_items_merchant` (merchant_id → platform.merchants). Must drop when this table becomes partitioned.
- **FK in**: order_id (and merchant_id) → orders. Update to composite reference after orders is partitioned.
- **Entity**: Single PK; add composite PK for partition.

### 2.4 merchant.order_status_transitions

- **PK**: `id`; for partition use `(id, merchant_id)`.
- **FK out**: `fk_order_status_transitions_merchant` — drop when partitioned.
- **FK in**: order_id → orders — update to (order_id, merchant_id) → orders(id, merchant_id) after orders partitioned.
- **Entity**: Single PK; add composite PK for partition.

### 2.5 merchant.order_payment_records

- **PK**: `id`; for partition use `(id, merchant_id)`.
- **FK out**: `fk_order_payment_records_merchant` — drop when partitioned.
- **FK in**: order_id → orders — update to composite after orders partitioned.
- **Entity**: Single PK; add composite PK for partition.

### 2.6 merchant.revenues

- **PK**: `id`; for partition use `(id, merchant_id)`.
- **FK out**: `fk_revenues_merchant` — drop when partitioned.
- **Indexes**: Several on revenue_date, revenue_type, source_id, etc.; ensure (merchant_id, revenue_date) or similar exists for partition-friendly queries.
- **Entity**: Single PK; add composite PK for partition.

### 2.7 merchant.inventory_transactions

- **PK**: `id`; for partition use `(id, merchant_id)`.
- **FK out**: `fk_inventory_transactions_merchant` — drop when partitioned.
- **Entity**: Single PK; add composite PK for partition.

---

## 3. Application / repository behaviour

- All target tables are under merchant schema and already have `merchant_id`; repositories use `MerchantRepositoryHelper` and `getMerchantId()` so queries include `merchant_id`. No change needed for partition pruning.
- Lookups by `id` only (e.g. `findOne({ where: { id } })`) should be updated to include `merchant_id` in the predicate so that the planner can prune to one partition; otherwise all partitions are scanned. Prefer `findOne({ where: { id, merchantId } })` everywhere for these entities.

---

## 4. Migration order (simple mode)

1. **orders** (pilot): Rename to orders_old → create partitioned table with 50 HASH(merchant_id) partitions and PK (id, merchant_id) → copy data from orders_old → drop fk_orders_merchant on old table before rename (or it goes with the table). New table has no FK to platform.merchants. Update FKs from order_items, order_status_transitions, order_payment_records, inventory_locks to composite (order_id, merchant_id) → orders(id, merchant_id). Then update Order entity to composite PK.
2. **order_items**: Same pattern; drop fk_order_items_merchant; FK to orders already updated in step 1.
3. **order_status_transitions**, **order_payment_records**, **revenues**, **inventory_transactions**: Same pattern in turn; each drops its FK to platform.merchants; tables that reference orders already fixed in step 1.
4. **expenses**, **cart_items** (later): 50 partitions each; same pattern.

---

## 5. Summary checklist

- [ ] orders: Drop FK to platform.merchants; change PK to (id, merchant_id); create 50 HASH partitions; update referencing FKs to composite; update Order entity.
- [ ] order_items, order_status_transitions, order_payment_records, revenues, inventory_transactions: Same PK + partition + drop merchant FK; partition count per table as above.
- [ ] All queries by id for these entities include merchant_id in WHERE.
- [ ] No new FK from any partitioned table to another table (only to platform.merchants, which we drop and enforce in app).

---

## 6. 按 id（或单列）查表需补 merchantId 的代码清单

以下为分区表 **仅按 id 查** 或 **按 id + 其他但未带 merchantId** 的调用点，分区上线前必须加上 `merchantId`，否则会全分区扫描。已带 `merchantId` 的未列出。

### 6.1 Order（orders）

| 文件 | 行号 | 当前写法 | 修改要点 |
|------|------|----------|----------|
| `payment/services/payment-business.service.ts` | 316 | `findOne({ where: { id: orderId } })` | 从请求上下文 `getMerchantId()` 取 merchantId，改为 `where: { id: orderId, merchantId }` |
| `payment/services/payment-business.service.ts` | 711 | `findOne({ where: { id: orderId } })` | 同上（assignPaymentToOrder 在商户上下文中，用 getMerchantId()） |
| `payment/services/webhook-airwallex-refund.service.ts` | 70, 133 | `findOne({ where: { id: refundRecord.orderId } })` | 使用 `refundRecord.merchantId`，改为 `where: { id: refundRecord.orderId, merchantId: refundRecord.merchantId }` |
| `order/services/order-status.service.ts` | 82 | `manager.findOne(Order, { where: { id: orderId } })` | 方法需增加 merchantId 参数或从 context 取，改为 `where: { id: orderId, merchantId }` |
| `order/services/order-status.service.ts` | 198 | `findOne({ where: { id: orderId } })` | 同上 |
| `payment/services/refund.handler.service.ts` | 80 | `findOne({ where: { id: context.refundRecord.orderId } })` | 使用 `context.refundRecord.merchantId`，改为 `where: { id: ..., merchantId: context.refundRecord.merchantId }` |
| `order/services/order-expiry.service.ts` | 241 | `findOne({ where: { id: orderId } })` | 调用方传入 merchantId 或从 context 取，改为 `where: { id: orderId, merchantId }` |
| `inventory/services/inventory-management.service.ts` | 105 | `findOne({ where: { id: order.id } })` | 已有 order，改为 `where: { id: order.id, merchantId: order.merchantId }` |

**说明**：`order/infrastructure/order.repository.ts` 的 `findOrderByIdForAdmin` 已用 `where: { id, merchantId }`，无需改。

### 6.2 OrderPaymentRecord（order_payment_records）

| 文件 | 行号 | 当前写法 | 修改要点 |
|------|------|----------|----------|
| `payment/services/payment-business.service.ts` | 636–638 | `getPaymentRecordById(id)` 内 `findOne({ where: { id } })` | 方法增加 merchantId 参数（或内部 getMerchantId()），改为 `where: { id, merchantId }`；调用方 `payment-records.controller.ts` 从 req 取 merchantId 传入 |
| `payment/services/payment-business.service.ts` | 701–702 | `findOne({ where: { id: paymentRecordId } })` | assignPaymentToOrder 在商户上下文，改为 `where: { id: paymentRecordId, merchantId: getMerchantId() }` |
| `payment/services/payment-business.service.ts` | 711–712 | `findOne({ where: { id: orderId } })` | 见 6.1 同一处 |
| `payment/services/payment-business.service.ts` | 751–752 | `findOne({ where: { id: paymentRecordId } })` | rejectPaymentRecord：改为 `where: { id: paymentRecordId, merchantId: getMerchantId() }` |
| `payment/services/payment-business.service.ts` | 789–790 | `findOne({ where: { id: paymentRecordId } })` | updatePaymentRecord：同上 |

### 6.3 Revenue（revenues）

| 文件 | 行号 | 当前写法 | 修改要点 |
|------|------|----------|----------|
| `revenue/infrastructure/revenue.repository.ts` | 114 | `getRevenueById(id)` 内 `findOne({ where: { id } })` | 方法内 `getMerchantId()`，改为 `where: { id, merchantId }`（controller 已在商户路由下，context 有 merchantId） |

### 6.4 其他分区表（order_items / order_status_transitions / inventory_transactions / expenses / cart_items）

- **order_items**：当前无按 `id` 查单条的 findOne；`findOrderItemsByOrderId` 已用 `where: { orderId, merchantId }`，无需改。
- **order_status_transitions**：`order-status.service.ts` 的 `getOrderStatusHistory(orderId)` 使用 `find({ where: { orderId } })`，**需补 merchantId**（从 context 或参数），改为 `where: { orderId, merchantId }`，否则分区后全分区扫描。
- **inventory_transactions**：当前无按 id 查单条的 findOne；若后续有按 id 查需带 merchantId。
- **expenses**：`expense/infrastructure/expense.repository.ts` 的 findOne 已用 `where: { id, merchantId }`，无需改。
- **cart_items**：`cart-item.repository.ts` 的 findCartItemById、findCartItemByCartAndProduct、findCartItemByCartAndProductWithConfig 均已带 merchantId，无需改。

### 6.5 非分区表但易混淆的按 id 查（仅作参考）

- `product.repository.ts` 561–563：`findOne({ where: { id } })` 查 product_options，若日后 products 分区再考虑；当前 products 未在首批分区表。
- `equipment.repository.ts` 107：`findOne({ where: { id } })` 查 equipment，equipment 未在首批分区表。
- `merchant.repository.ts` 30、48：Merchant 在 platform schema，不分区，无需改。

### 6.6 按 orderId 查子表需带 merchantId（分区后避免全分区扫描）

| 文件 | 行号 | 当前写法 | 修改要点 |
|------|------|----------|----------|
| `order/services/order-status.service.ts` | 314–316 | `find({ where: { orderId } })` (OrderStatusTransition) | 改为 `where: { orderId, merchantId }`，merchantId 从 getMerchantId() 或参数传入 |
| `order/services/order.service.ts` | 1763–1765 | `find({ where: { orderId } })` (OrderPaymentRecord) | 同上，改为 `where: { orderId, merchantId }` |

**检查方式**：分区上线前用 grep 再搜一次 `findOne.*where.*id`、`\.find\(.*where:.*orderId`，确认无遗漏。

---

### 6.7 其他 merchant schema 表（当前未列为首批分区，若后续分区需补 merchantId）

以下表也在 merchant schema 且有 `merchant_id`，若将来做 50 分区，下列「仅按 id 查」或「按 id 未带 merchantId」的调用需一并补上 merchantId。

| 表 / 实体 | 文件 | 行号 | 当前写法 | 修改要点（若该表分区） |
|-----------|------|------|----------|------------------------|
| **Product** | product/infrastructure/product.repository.ts | 155–156 | findOne({ where: { id } }) | findProductDisplayInfoById：加 getMerchantId()，where: { id, merchantId } |
| **Category** | product/infrastructure/product.repository.ts | 379–380 | findOne({ where: { id } }) | findCategoryById：同上 |
| **ProductOptionGroup** | product/infrastructure/product.repository.ts | 541–542 | findOne({ where: { id } }) | findOptionGroupById：同上 |
| **ProductOption** | product/infrastructure/product.repository.ts | 563 | findOne({ where: { id } }) | findOptionById：同上 |
| **Product**（按 id 查） | inventory/services/inventory-management.service.ts | 293, 453 | findOne({ where: { id: item.productId } }) | 上下文有 order/item，用 order.merchantId 或 getMerchantId() |
| **Product**（按 id 查） | inventory/services/stock-calculator.service.ts | 35 | findOne({ where: { id: productId } }) | 方法需传入 merchantId 或 getMerchantId() |
| **Equipment** | equipment/infrastructure/equipment.repository.ts | 107 | findOne({ where: { id } }) | findById 内加 getMerchantId()，where: { id, merchantId } |
| **OfferProduct** | inventory/services/stock-updater.service.ts | 91 | findOne({ where: { id: offerProductId } }) | 加 merchantId（参数或 getMerchantId()） |
| **OfferProduct** | inventory/services/stock-calculator.service.ts | 43–44 | findOne({ where: { id: modeProductId } }) | 同上 |
| **OfferProduct** | inventory/services/inventory-management.service.ts | 359, 500 | findOne({ where: { id: offerProductId, offerId } }) | 补 merchantId |
| **Preorder** | order/services/order-validation.service.ts | 73–75 | findOne({ where: { id: preorderId } }) | 从请求/订单上下文取 merchantId，where: { id: preorderId, merchantId } |
| **Offer** | order/services/order-validation.service.ts | 117–118 | findOne({ where: { id: offerId } }) | 同上 |
| **ProductsPreorderable** | inventory/services/inventory-management.service.ts | 408, 530 | findOne({ where: { productId } }) | 补 merchantId（按 productId 查也需带 merchant_id 做分区裁剪） |
| **ProductsPreorderable** | inventory/services/stock-updater.service.ts | 103 | findOne({ where: { productId } }) | 同上 |
| **ProductsPreorderable** | inventory/services/stock-calculator.service.ts | 53–54 | findOne({ where: { productId } }) | 同上 |

**已带 merchantId、无需改的**（同表其他调用）：  
- Preorder：preorder.repository 的 findById 已用 id + merchantId。  
- Offer / OfferProduct：offer.repository、offer-product.repository 的 findById/findOne 已用 id + merchantId。  
- Partner、PartnerAddress、PartnerInvoice、PartnerInvoiceSummary、Supplier、StoreAddress、News、TaxReturnReport、MerchantSetting、Cart、CartItem、Expense、EquipmentDepreciationRecord、PrintTemp、PreorderPromotes、AdminProductsPreorderable：当前按 id 查处均已带 merchantId。

**非 merchant schema（不分区，可不改）**：  
- Merchant、User、UserMerchant、MerchantJoinApplication、PlatformSetting 等为 platform/public schema，不在本次分区范围。
