# GST功能实现方案 - 完整版

## 概述

本文档描述了系统中GST（商品及服务税）功能的完整实现方案，包括数据结构设计、价格计算逻辑、前端显示格式等。

**注意：** 第一阶段（PlatformSettings + CMS Invoices）请参考 `gst-implementation-phase1.md`

**第二阶段：** 微信小程序订单GST计算和显示（本文档）

## 需求背景

1. 支持GST注册状态管理（注册/未注册）
2. 支持GST注册日期记录（用于历史订单追溯）
3. 支持产品GST分类（GST-free / 需要GST）
4. 支持价格模式（含GST价格 / 不含GST价格）
5. 订单价格计算时正确计算GST
6. 前端显示GST明细信息

## 数据结构设计

> **注意：** 
> - PlatformSettings GST设置已在第一阶段完成，请参考 `gst-implementation-phase1.md`
> - Product isGstFree 字段已在第一阶段完成，请参考 `gst-implementation-phase1.md`

### Order - 添加GST相关字段（第二阶段）

**文件位置：** `xituan_backend/submodules/xituan_codebase/typing_entity/order.type.ts`

```typescript
export interface iOrder {
  // ... 现有字段
  subtotalExcludingGst: number;        // 商品总额（不含GST）
  deliveryFeeExcludingGst: number;     // 运费（不含GST）
  gstAmount: number;                    // GST总额（商品GST + 运费GST）
  totalAmount: number;                  // 最终应付款（含GST）= subtotalExcludingGst + deliveryFeeExcludingGst + gstAmount
}
```

**说明：**
- 这些字段用于记录订单创建时的GST信息
- 即使未来GST设置改变，历史订单的GST金额保持不变
- 便于税务报告和BAS申报

## 价格计算逻辑

### 1. 产品价格计算

**计算流程：**

```typescript
function calculateProductPrice(
  product: iProduct,
  isGstRegistered: boolean,
  isPriceInclusiveGst: boolean
): {
  priceExcludingGst: number;
  gstAmount: number;
  priceIncludingGst: number;
} {
  const basePrice = product.salePrice || product.basePrice;
  
  // 如果产品是GST-free，不计算GST
  if (product.isGstFree) {
    return {
      priceExcludingGst: basePrice,
      gstAmount: 0,
      priceIncludingGst: basePrice
    };
  }
  
  // 如果未注册GST，不计算GST
  if (!isGstRegistered) {
    return {
      priceExcludingGst: basePrice,
      gstAmount: 0,
      priceIncludingGst: basePrice
    };
  }
  
  // 已注册GST且产品需要GST
  if (isPriceInclusiveGst) {
    // 基础价格已含GST
    const priceExcludingGst = basePrice / 1.1;
    const gstAmount = basePrice - priceExcludingGst;
    return {
      priceExcludingGst: Number(priceExcludingGst.toFixed(2)),
      gstAmount: Number(gstAmount.toFixed(2)),
      priceIncludingGst: basePrice
    };
  } else {
    // 基础价格不含GST
    const priceExcludingGst = basePrice;
    const gstAmount = basePrice * 0.1;
    const priceIncludingGst = basePrice * 1.1;
    return {
      priceExcludingGst: Number(priceExcludingGst.toFixed(2)),
      gstAmount: Number(gstAmount.toFixed(2)),
      priceIncludingGst: Number(priceIncludingGst.toFixed(2))
    };
  }
}
```

### 2. 运费GST计算

**计算逻辑：**

```typescript
function calculateDeliveryFeeGst(
  deliveryFee: number,
  isGstRegistered: boolean,
  isPriceInclusiveGst: boolean
): {
  feeExcludingGst: number;
  gstAmount: number;
  feeIncludingGst: number;
} {
  // 如果未注册GST，不计算GST
  if (!isGstRegistered) {
    return {
      feeExcludingGst: deliveryFee,
      gstAmount: 0,
      feeIncludingGst: deliveryFee
    };
  }
  
  // 运费通常需要GST（除非是GST-free服务）
  if (isPriceInclusiveGst) {
    // 运费已含GST
    const feeExcludingGst = deliveryFee / 1.1;
    const gstAmount = deliveryFee - feeExcludingGst;
    return {
      feeExcludingGst: Number(feeExcludingGst.toFixed(2)),
      gstAmount: Number(gstAmount.toFixed(2)),
      feeIncludingGst: deliveryFee
    };
  } else {
    // 运费不含GST
    const feeExcludingGst = deliveryFee;
    const gstAmount = deliveryFee * 0.1;
    const feeIncludingGst = deliveryFee * 1.1;
    return {
      feeExcludingGst: Number(feeExcludingGst.toFixed(2)),
      gstAmount: Number(gstAmount.toFixed(2)),
      feeIncludingGst: Number(feeIncludingGst.toFixed(2))
    };
  }
}
```

### 3. 订单总价计算

**计算流程：**

```typescript
function calculateOrderTotal(
  cartItems: CartItem[],
  deliveryFee: number,
  isGstRegistered: boolean,
  isPriceInclusiveGst: boolean
): {
  subtotalExcludingGst: number;
  deliveryFeeExcludingGst: number;
  gstAmount: number;
  totalAmount: number;
} {
  let subtotalExcludingGst = 0;
  let totalGstAmount = 0;
  
  // 计算所有商品的价格和GST
  for (const item of cartItems) {
    const product = await getProduct(item.productId);
    const priceInfo = calculateProductPrice(product, isGstRegistered, isPriceInclusiveGst);
    
    const itemSubtotalExcludingGst = priceInfo.priceExcludingGst * item.quantity;
    const itemGstAmount = priceInfo.gstAmount * item.quantity;
    
    subtotalExcludingGst += itemSubtotalExcludingGst;
    totalGstAmount += itemGstAmount;
  }
  
  // 计算运费的GST
  const deliveryFeeInfo = calculateDeliveryFeeGst(deliveryFee, isGstRegistered, isPriceInclusiveGst);
  totalGstAmount += deliveryFeeInfo.gstAmount;
  
  // 计算总价
  const totalAmount = subtotalExcludingGst + deliveryFeeInfo.feeExcludingGst + totalGstAmount;
  
  return {
    subtotalExcludingGst: Number(subtotalExcludingGst.toFixed(2)),
    deliveryFeeExcludingGst: Number(deliveryFeeInfo.feeExcludingGst.toFixed(2)),
    gstAmount: Number(totalGstAmount.toFixed(2)),
    totalAmount: Number(totalAmount.toFixed(2))
  };
}
```

## 前端显示格式（第二阶段）

### 微信小程序订单确认页/订单详情页

**显示格式：**

```
商品总额（不含GST）: $XX.XX
运费（不含GST）: $XX.XX
GST: $XX.XX （商品 + 运费 的gst）
─────────────────
应付款: $XX.XX
```

**示例：**

```
商品总额（不含GST）: $90.91
运费（不含GST）: $9.09
GST: $10.00 （商品 + 运费 的gst）
─────────────────
应付款: $110.00
```

**实现位置：**
- 订单确认页：`xituan_wechat_app/pages/checkout/checkout.wxml`
- 订单详情页：`xituan_wechat_app/pages/order-detail/order-detail.wxml`

> **注意：** CMS Invoices / Invoice Summaries 价格计算已在第一阶段完成，请参考 `gst-implementation-phase1.md`

## 数据库迁移（第二阶段）

> **注意：** 
> - finance settings GST配置已在第一阶段完成，请参考 `gst-implementation-phase1.md`
> - products isGstFree 字段已在第一阶段完成，请参考 `gst-implementation-phase1.md`

### 添加订单GST字段

**Migration文件：** `xituan_backend/migrations/1710000000XXX_add_gst_fields_to_orders.sql`

```sql
-- 添加GST相关字段到 orders 表
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS subtotal_excluding_gst DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS delivery_fee_excluding_gst DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS gst_amount DECIMAL(10,2) NOT NULL DEFAULT 0;

-- 添加注释
COMMENT ON COLUMN orders.subtotal_excluding_gst IS '商品总额（不含GST）';
COMMENT ON COLUMN orders.delivery_fee_excluding_gst IS '运费（不含GST）';
COMMENT ON COLUMN orders.gst_amount IS 'GST总额（商品GST + 运费GST）';

-- 注意：total_amount 字段已存在，用于存储最终应付款（含GST）
```

## 实施步骤

> **第一阶段（PlatformSettings + CMS Invoices）已完成，请参考 `gst-implementation-phase1.md`**

### Phase 2: 数据结构更新（第二阶段）

> **注意：** Product isGstFree 字段已在第一阶段完成

1. **更新类型定义**
   - 更新 `iOrder` 接口，添加GST相关字段

2. **数据库迁移**
   - 创建 orders GST字段迁移

3. **实体类更新**
   - 更新 `Order` entity

### Phase 3: 后端逻辑实现（第二阶段）

1. **价格计算服务**
   - 实现产品价格计算逻辑
   - 实现运费GST计算逻辑
   - 实现订单总价计算逻辑

2. **订单服务更新**
   - 更新订单创建逻辑，包含GST计算
   - 更新订单价格计算，保存GST信息

### Phase 4: 前端实现（第二阶段）

1. **微信小程序**
   - 更新订单确认页显示GST明细
   - 更新订单详情页显示GST信息
   - 更新购物车价格计算

2. **CMS管理界面**
   - 订单详情页显示GST信息

### Phase 5: 数据迁移（第二阶段）

> **注意：** 产品 isGstFree 数据迁移已在第一阶段完成

1. **现有订单数据**
   - 对于历史订单，GST字段可以保持为0或根据订单日期计算

## 注意事项

1. **历史订单处理**
   - 历史订单的GST金额不应因设置变更而改变
   - 使用 `registrationDate` 判断订单创建时是否已注册GST

2. **价格精度**
   - 所有价格计算保留2位小数
   - 使用 `Number(value.toFixed(2))` 确保精度

3. **GST注册日期**
   - 必须记录GST注册生效日期
   - 用于判断历史订单是否应该包含GST

4. **产品GST分类**
   - 需要根据ATO规则正确设置每个产品的 isGstFree 值
   - 参考产品GST分类分析文档

5. **运费GST**
   - 运费通常需要GST（除非是GST-free服务）
   - 与商品GST一起计算和显示

6. **Partner Invoice价格计算**
   - 已在第一阶段完成，请参考 `gst-implementation-phase1.md`

## 测试要点

1. **未注册GST场景**
   - 所有价格不含GST
   - GST金额为0

2. **已注册GST场景**
   - GST-free产品不计算GST
   - 需要GST的产品正确计算GST
   - 运费正确计算GST

3. **价格模式测试**
   - 含GST价格模式：基础价格 / 1.1
   - 不含GST价格模式：基础价格 × 1.1

4. **订单创建测试**
   - 订单GST字段正确保存
   - 订单总价计算正确

5. **前端显示测试**
   - GST明细正确显示
   - 价格格式正确

6. **Partner Invoice测试**
   - 已在第一阶段完成，请参考 `gst-implementation-phase1.md`

## 相关文档

- **第一阶段实现方案：** `gst-implementation-phase1.md`（PlatformSettings + CMS Invoices）
- 产品GST分类分析（待创建）
- ATO GST规则参考：https://www.ato.gov.au/law/view/document?docid=GST/GSTR20018/NAT/ATO/00001

