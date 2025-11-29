# Invoice GST 计算逻辑说明

## 概述

本文档详细说明 Partner Invoice 在各种 GST 情况下的计算逻辑，包括价格计算和损失计算。

## GST 情况组合

### 关键参数

1. **isGstRegistered** (平台设置)
   - `true`: 已注册GST
   - `false`: 未注册GST

2. **isPriceInclusiveGst** (平台设置)
   - `true`: 基础价格包含GST（如 $7.99 含GST）
   - `false`: 基础价格不包含GST（如 $7.27 + GST = $8.00）

3. **product.isGstFree** (产品设置)
   - `true`: 产品GST-free（如普通面包）
   - `false`: 产品需要GST（如蛋糕、有甜馅料的面包）

4. **partner.isGstFreeCustomisable** (合作伙伴设置)
   - `true`: 支持产品GST独立设置（使用产品自身的isGstFree）
   - `false`: 不支持，统一按需要GST计算（忽略产品的isGstFree）

## 价格计算逻辑

### 步骤1: 确定产品是否计算GST

```typescript
let effectiveIsGstFree = product.isGstFree;
if (!partner.isGstFreeCustomisable) {
  effectiveIsGstFree = false;  // 强制需要GST
}
```

### 步骤2: 计算单价和GST

#### 情况1: 产品GST-free 或 未注册GST
```
不含GST单价 = 基础单价
含GST单价 = 基础单价（相同）
GST金额 = 0
```

#### 情况2: 已注册GST + 产品需要GST + 基础价格包含GST
```
示例: 基础价 $7.99 (含GST)
不含GST单价 = $7.99 ÷ 1.1 = $7.27
含GST单价 = $7.99
GST金额 = ($7.99 - $7.27) × 数量 = $0.72 × 数量
```

#### 情况3: 已注册GST + 产品需要GST + 基础价格不包含GST
```
示例: 基础价 $7.27 (不含GST)
不含GST单价 = $7.27
含GST单价 = $7.27 × 1.1 = $8.00
GST金额 = $7.27 × 0.1 × 数量 = $0.73 × 数量
```

### 步骤3: 计算小计

```typescript
不含GST小计 = 所有产品的不含GST单价 × 数量之和
GST总额 = 所有产品的GST金额之和
含GST小计 = 不含GST小计 + GST总额
```

### 步骤4: Invoice Summary 统计

**重要**: Invoice Summary 仅统计 detail items 的值，不重新计算。

```typescript
// 从已计算的 detail items 统计
subtotalIncludingGst = sum(item.retailPrice * item.quantity)  // 含税零售价总和（未应用 invoice 折扣）
discountAmount = subtotalIncludingGst * discountRate          // 折扣金额（仅用于显示）
gstAmount = sum(item.gstAmount)                               // 直接累加所有 item 的 GST 金额
amount = sum(item.amount)                                     // 直接累加所有 item 的金额（不含GST）
totalAmount = amount + gstAmount                              // 应付款总额
```

**关键点**:
- `gstAmount` 和 `amount` 直接来自 detail items，不应用 invoice discount
- `discountAmount` 仅用于显示，不影响实际计算
- 所有计算已在 `calculateInvoiceDetailItem` 中完成

**示例:**
- Detail items 已计算完成:
  - `gstAmount = 1.42` (来自 detail items)
  - `amount = 14.18` (来自 detail items)
- Invoice Summary 统计:
  - `subtotalIncludingGst = 15.60` (7.8 × 2)
  - `discountAmount = 3.12` (15.60 × 0.2，仅用于显示)
  - `gstAmount = 1.42` (直接累加，不调整)
  - `totalAmount = 15.60` (14.18 + 1.42)

## 损失计算逻辑

### 关键原则

**损失应该基于含GST价格计算**（如果产品有GST），因为损失的是含GST的价值。

### 计算含GST单价（用于损失计算）

```typescript
function getUnitPriceForLoss(item: iPartnerInvoiceItem): number {
  if (item.gstAmount > 0 && item.quantity > 0) {
    // 有GST: 含GST单价 = 不含GST单价 + (GST金额 / 数量)
    return item.unitPrice + (item.gstAmount / item.quantity);
  }
  // 无GST: 使用不含GST单价
  return item.unitPrice;
}
```

### 折扣损失计算

**使用 detail items 的 unitPrice + gst 计算:**
```typescript
// 实际价格 = unitPrice + gst (已包含所有 GST 和折扣计算)
实际单价 = item.unitPrice + item.gst
损失 = 实际单价 × (1 - 折扣扣减比例) × 数量
```

**示例:**
- Detail item: `unitPrice = 6.24`, `gst = 0.56`
- 实际单价 = 6.24 + 0.56 = 6.80
- 折扣扣减: 90折 (0.9)，所以 (1 - 0.9) = 0.1
- 数量: 1件
- 损失 = 6.80 × 0.1 × 1 = 0.68

### 过期损失计算

**使用 detail items 的 unitPrice + gst 计算:**
```typescript
// 实际价格 = unitPrice + gst (已包含所有 GST 和折扣计算)
实际单价 = item.unitPrice + item.gst
损失 = 实际单价 × 过期数量
```

**示例:**
- Detail item: `unitPrice = 6.24`, `gst = 0.56`
- 实际单价 = 6.24 + 0.56 = 6.80
- 过期数量: 1件
- 损失 = 6.80 × 1 = 6.80

## 完整计算示例

### 场景: 已注册GST + 基础价格包含GST + 产品需要GST

**产品信息:**
- 基础价: $7.99 (含GST)
- 数量: 10件
- 折扣率: 20%

**步骤1: 计算单价**
- 不含GST单价 = $7.99 ÷ 1.1 = $7.27
- 含GST单价 = $7.99
- GST单价 = $0.72

**步骤2: 计算小计**
- 不含GST小计 = $7.27 × 10 = $72.70
- GST总额 = $0.72 × 10 = $7.20
- 含GST小计 = $72.70 + $7.20 = $79.90

**步骤3: Invoice Summary 统计**
- Detail items 已包含所有计算:
  - `gstAmount = 7.20` (0.72 × 10)
  - `amount = 72.70` (7.27 × 10)
- Invoice Summary 统计:
  - `subtotalIncludingGst = 79.90` (7.99 × 10)
  - `discountAmount = 15.98` (79.90 × 0.2，仅用于显示)
  - `gstAmount = 7.20` (直接累加，不调整)
  - `totalAmount = 79.90` (72.70 + 7.20)

**步骤5: 计算损失（假设1件过期）**
- 含GST单价 = $7.99
- 过期损失 = $7.99 × (1 - 0.2) × 1 = $6.39

## 特殊情况说明

### 1. 未注册GST的情况

- 所有产品的GST金额 = 0
- 应付款 = 折扣后不含GST小计（不包含GST）
- 损失计算使用不含GST单价（因为GST = 0）

### 2. 产品GST-free的情况

- 产品的GST金额 = 0
- 不含GST单价 = 含GST单价（相同）
- 损失计算使用不含GST单价

### 3. Partner不支持GST自定义的情况

- 所有产品强制按需要GST计算
- 忽略产品自身的isGstFree设置

## 代码实现位置

1. **Detail Item 计算**: `xituan_backend/submodules/xituan_codebase/utils/invoiceDetail.util.ts`
   - `calculateInvoiceDetailItem()`: 计算单个产品的详情（包含所有 GST 和折扣计算）

2. **Invoice Summary 统计**: `xituan_backend/submodules/xituan_codebase/utils/invoiceSummary.util.ts`
   - `calculateInvoiceSummary()`: 统计 detail items 的值（不重新计算）

3. **损失计算**: `xituan_backend/submodules/xituan_codebase/utils/invoiceCalculation.util.ts`
   - `calculateLosses()`: 使用 detail items 的 unitPrice + gst 计算损失

4. **服务层**: `xituan_backend/src/domains/partner/services/partner.service.ts`
   - `calculateInvoiceItems()`: 计算发票产品详情
   - `createPartnerInvoice()`: 创建发票
   - `updatePartnerInvoice()`: 更新发票

## 测试要点

1. ✅ 未注册GST: Detail items 的 gstAmount = 0
2. ✅ 已注册GST + 基础价格包含GST: Detail items 正确提取GST
3. ✅ 已注册GST + 基础价格不包含GST: Detail items 正确计算GST
4. ✅ 产品GST-free: Detail items 的 gstAmount = 0
5. ✅ Partner不支持GST自定义: Detail items 强制计算GST
6. ✅ Invoice Summary: 直接统计 detail items，不重新计算
7. ✅ 折扣损失: 使用 detail items 的 unitPrice + gst 计算
8. ✅ 过期损失: 使用 detail items 的 unitPrice + gst 计算

