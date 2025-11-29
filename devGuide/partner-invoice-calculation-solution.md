# Partner Invoice 计算方案

## 概述

本文档描述 Partner Invoice 的完整计算流程，包括产品详情计算、发票汇总计算和损失计算。所有计算逻辑集中在 `xituan_codebase/utils` 中，确保前后端一致性。

## 计算流程架构

```
Product + Partner + Settings
    ↓
calculateInvoiceDetailItem (单个产品详情)
    ↓
iPartnerInvoiceItem[] (detail items)
    ↓
calculateInvoiceSummary (发票汇总)
    ↓
calculateLosses (损失计算)
    ↓
Final Invoice Data
```

## 核心计算模块

### 1. Invoice Detail 计算 (`invoiceDetail.util.ts`)

**函数**: `calculateInvoiceDetailItem()`

**输入参数**:
- `product`: 产品实体
- `partner`: 合作伙伴实体
- `quantity`: 数量
- `isGstRegistered`: 公司是否注册GST
- `isPriceInclusiveGst`: 基础价格是否包含GST

**计算步骤**:

1. **确定有效GST状态**
   ```
   effectiveIsGstFree = product.isGstFree
   if (!partner.isGstFreeCustomisable) {
     effectiveIsGstFree = false  // 强制计算GST
   }
   ```

2. **计算零售价组件（折扣前）**
   - 未注册GST 或 产品GST-free: `retailPriceBase = basePrice`, `retailPriceGst = 0`
   - 已注册GST + 价格包含GST: `retailPriceBase = basePrice / 1.1`, `retailPriceGst = basePrice - retailPriceBase`
   - 已注册GST + 价格不包含GST: `retailPriceBase = basePrice`, `retailPriceGst = basePrice * 0.1`

3. **应用合作伙伴折扣**
   - Distributor: `partnerDiscountPrice = basePrice * (1 - discountRate)`
   - Store/Bulk: 优先使用批发价，否则 `partnerDiscountPrice = price * (1 - discountRate)`

4. **计算最终单价和GST**
   - 未注册GST: `unitPrice = partnerDiscountPrice * 10/11` (GST-free产品除外), `gst = 0`
   - 已注册GST + GST-free: `unitPrice = partnerDiscountPrice`, `gst = 0`
   - 已注册GST + 需要GST: `unitPrice = partnerDiscountPrice / 1.1`, `gst = partnerDiscountPrice - unitPrice`

**输出**: `iPartnerInvoiceItem` (包含 `unitPrice`, `gst`, `amount`, `gstAmount`, `subtotal` 等)

### 2. Invoice Summary 计算 (`invoiceSummary.util.ts`)

**函数**: `calculateInvoiceSummary()`

**输入参数**:
- `detailItems`: 已计算的发票详情项数组
- `discountRate`: 发票折扣率
- `isGstRegistered`: 公司是否注册GST

**计算逻辑**:
```
subtotalIncludingGst = sum(item.retailPrice * item.quantity)
discountAmount = subtotalIncludingGst * discountRate
gstAmount = sum(item.gstAmount)
amount = sum(item.amount)
totalAmount = amount + gstAmount
```

**输出**: `iInvoiceSummary` (包含 `subtotalIncludingGst`, `discountAmount`, `gstAmount`, `totalAmount`)

### 3. Invoice Price 计算 (`invoicePrice.util.ts`)

**函数**: `calculatePrices()`

**计算逻辑**:
```
subtotal = sum(item.subtotal)
gstAmount = sum(item.gstAmount)
discountAmount = subtotal * discountRate
totalAmount = subtotal - discountAmount
```

**注意**: 此函数主要用于简化计算，实际在 create/update 中使用 `calculateInvoiceSummary`。

### 4. Loss 计算 (`invoiceCalculation.util.ts`)

**函数**: `calculateLosses()`

**输入参数**:
- `detail`: 发票详情项数组
- `discountRate`: 发票折扣率（保留用于兼容性）
- `discountDeduction`: 折扣扣减数据 `{ productId: { discounted: number, quantity: number } }`
- `outdatedDeduction`: 过期扣减数据 `{ productId: number }`
- `isGstRegistered`: 公司是否注册GST（保留用于兼容性）

**核心逻辑**:
```
actualPricePerUnit = item.unitPrice + item.gst  // 实际向合作伙伴收取的价格（含GST）

// 折扣损失
discountedLoss = sum(actualPricePerUnit * (1 - deduction.discounted) * quantity)

// 过期损失
outdatedLoss = sum(actualPricePerUnit * quantity)
```

**输出**: `{ discountedLoss, outdatedLoss, totalLoss }`

**重要说明**: 
- 损失计算使用 `unitPrice + gst`，这是已经应用了折扣和GST处理后的实际价格
- 不需要再次应用折扣率或10/11，因为这些已经在 `calculateInvoiceDetailItem` 中处理

## Invoice Create/Update 流程

### Create Invoice

```typescript
1. 接收 items (productId, quantity)
2. 调用 calculateInvoiceItems(items, partner)
   - 对每个 item 调用 calculateInvoiceDetailItem()
   - 返回 detail: iPartnerInvoiceItem[]
3. 调用 calculateInvoiceSummary(detail, discountRate, isGstRegistered)
   - 返回 summary (totalAmount, gstAmount, discountAmount)
4. 保存 invoice (detail, summary 数据)
5. 如果有 deduction 数据，调用 calculateLosses() 并更新 invoice
```

### Update Invoice

```typescript
1. 如果更新了 items:
   - 重新调用 calculateInvoiceItems()
   - 重新调用 calculateInvoiceSummary()
   - 更新 invoice 的 detail, totalAmount, gstAmount, discountAmount
2. 如果更新了 discountRate 或 deductions:
   - 重新调用 calculateLosses()
   - 更新 invoice 的 discountedLoss, outdatedLoss, totalLoss
```

## 关键设计原则

1. **单一数据源**: `calculateInvoiceDetailItem` 是唯一计算产品详情的地方
2. **分层计算**: Detail → Summary → Loss，每层基于前一层的结果
3. **GST处理集中化**: 所有GST逻辑在 `calculateInvoiceDetailItem` 中处理
4. **损失计算简化**: 使用已计算的 `unitPrice + gst`，避免重复计算

## 数据字段说明

### iPartnerInvoiceItem
- `retailPrice`: 零售价（含GST，折扣前）
- `retailPriceBase`: 零售价基础（不含GST，折扣前）
- `retailPriceGst`: 零售价GST（折扣前）
- `unitPrice`: 单价（不含GST，已应用合作伙伴折扣）
- `gst`: GST单价（已应用合作伙伴折扣）
- `amount`: 金额（不含GST）= `unitPrice * quantity`
- `gstAmount`: GST金额 = `gst * quantity`
- `subtotal`: 小计 = `amount + gstAmount`

### iInvoiceSummary
- `subtotalIncludingGst`: 含税零售价总和（未应用发票折扣）
- `discountAmount`: 折扣金额（基于含税零售价）
- `gstAmount`: GST金额（显示用）
- `totalAmount`: 应付款总额 = `amount + gstAmount`

## 使用示例

### 创建发票

```typescript
// 1. 计算详情项
const detailItems = await calculateInvoiceItems(items, partner);

// 2. 计算汇总
const summary = calculateInvoiceSummary(detailItems, discountRate, isGstRegistered);

// 3. 创建发票
const invoice = {
  detail: detailItems,
  totalAmount: summary.totalAmount,
  gstAmount: summary.gstAmount,
  discountAmount: summary.discountAmount,
  // ...
};

// 4. 计算损失（如果有扣减）
if (discountDeduction || outdatedDeduction) {
  const losses = invoiceCalculationUtil.calculateLosses({
    detail: detailItems,
    discountRate,
    discountDeduction,
    outdatedDeduction,
    totalAmount: summary.totalAmount,
    isGstRegistered
  });
  invoice.discountedLoss = losses.discountedLoss;
  invoice.outdatedLoss = losses.outdatedLoss;
  invoice.totalLoss = losses.totalLoss;
}
```

## 注意事项

1. **GST设置影响**: `isGstRegistered` 和 `isPriceInclusiveGst` 从平台设置获取，影响所有计算
2. **合作伙伴类型**: Distributor 和 Store/Bulk 的折扣计算方式不同
3. **GST自定义**: `partner.isGstFreeCustomisable` 决定是否使用产品的 `isGstFree` 设置
4. **损失计算时机**: 损失计算在发票创建/更新时进行，使用当前的 `unitPrice + gst` 值
5. **实际应收**: `实际应收 = totalAmount - totalLoss`（计算值，不存储）

## 相关文件

- `xituan_codebase/utils/invoiceDetail.util.ts`: 产品详情计算
- `xituan_codebase/utils/invoiceSummary.util.ts`: 发票汇总计算
- `xituan_codebase/utils/invoicePrice.util.ts`: 价格计算（简化版）
- `xituan_codebase/utils/invoiceCalculation.util.ts`: 损失计算和完整计算
- `xituan_backend/src/domains/partner/services/partner.service.ts`: 业务逻辑层



