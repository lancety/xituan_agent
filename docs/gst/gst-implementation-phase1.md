# GST功能实现方案 - 第一阶段

## 概述

本文档描述GST功能第一阶段实现方案，包括：
1. PlatformSettings GST设置更新
2. CMS Invoices / Invoice Summaries 价格计算调整

**第二阶段内容：** 微信小程序订单GST计算和显示（见 `gst-implementation-plan.md`）

## 需求背景

1. 支持GST注册状态管理（注册/未注册）
2. 支持GST注册日期记录（用于历史订单追溯）
3. 支持价格模式（含GST价格 / 不含GST价格）
4. CMS Invoices / Invoice Summaries 根据GST注册状态调整价格计算

## 数据结构设计

### 1. PlatformSettings - 财务设置扩展

**文件位置：** `xituan_backend/submodules/xituan_codebase/typing_entity/platform-setting.type.ts`

```typescript
export interface iFinanceSettings {
  bank: {
    forPartnerInvoice: {
      bankName: string;
      accountName: string;
      bsb: string;
      accountNumber: string;
    };
    forCustomerInvoice: {
      bankName: string;
      accountName: string;
      bsb: string;
      accountNumber: string;
    };
  };
  gst: {
    isRegistered: boolean;              // 是否注册了GST
    registrationDate?: string;          // GST注册生效日期（ISO 8601格式，如 "2025-01-01"）
    isPriceInclusiveGst: boolean;       // 基础价格是否包含GST
  };
}
```

**说明：**
- `isRegistered`: 控制是否计算和收取GST
- `registrationDate`: 记录GST注册生效日期，用于历史订单追溯
- `isPriceInclusiveGst`: 
  - `true` = 基础价格已含GST（需要除以1.1得到不含GST价格）
  - `false` = 基础价格不含GST（需要乘以1.1得到含GST价格）

### 2. Product - 添加GST字段

**文件位置：** `xituan_backend/submodules/xituan_codebase/typing_entity/product.type.ts`

```typescript
export interface iProduct {
  id: string;
  code: string;
  name: iMultilingualContent;
  basePrice: number;
  salePrice?: number;
  wholesalePrice20?: number;
  wholesalePrice25?: number;
  wholesalePrice30?: number;
  isCustomizable: boolean;
  isGstFree: boolean;  // 新增：是否GST-free（true = GST-free，false = 需要GST）
  images: string[];
  stock: number;
  categoryId: string;
  status: epProductStatus;
  barCode?: string | null;
  barCodeShared?: string | null;
  metadata?: iProductMetadata;
  createdAt: Date;
  updatedAt: Date;
}
```

**默认值：**
- `isGstFree`: 默认 `false`（新产品默认需要GST）

**GST分类规则：**
- `isGstFree = true`: GST-free产品（如普通面包、基本食品）
- `isGstFree = false`: 需要GST的产品（如蛋糕、有甜馅料的面包、糕点等）

**说明：**
- Invoice计算时需要根据产品的 `isGstFree` 字段判断是否计算GST
- GST-free产品不计算GST，需要GST的产品才计算GST

### 3. Partner - 添加GST自定义字段

**文件位置：** `xituan_backend/submodules/xituan_codebase/typing_entity/partner.type.ts`

```typescript
export interface iPartner {
  id: string;
  name: iMultilingualContent;
  clientCode: string;
  partnerType: epPartnerType;
  discountRate: number;
  abn?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  otherContacts?: Record<string, string>;
  isActive: boolean;
  isWholesaler: boolean;
  barCodePreference: epBarCodePreference;
  isGstFreeCustomisable: boolean;  // 新增：是否支持产品GST独立设置
  createdAt: Date;
  updatedAt: Date;
}
```

**默认值：**
- `isGstFreeCustomisable`: 默认 `false`（不支持产品GST独立设置，统一按需要GST计算）

**说明：**
- `isGstFreeCustomisable = true`：Partner Invoice计算时使用产品自身的 `isGstFree` 值
- `isGstFreeCustomisable = false`：Partner Invoice计算时忽略产品自身的 `isGstFree`，统一按 `isGstFree = false` 计算（所有产品都需要GST）
- **注意：** 普通订单（微信小程序）不考虑此字段，只使用产品自身的 `isGstFree`

**使用场景：**
- 某些Partner的系统不支持产品级别的GST设置，需要所有产品统一按需要GST计算
- 设置 `isGstFreeCustomisable = false` 可以覆盖产品自身的 `isGstFree` 设置

## CMS Invoices / Invoice Summaries 价格计算

### 业务逻辑说明

**场景：** 给经销商/超市开具发票时的价格计算

**逻辑：**
- 如果供应商注册了GST（`isGstRegistered = true`）：
  - 按正常计算，价格含GST
  - 经销商/超市可以claim GST credits
  - 应付款 = 原价（含GST）
  - GST = 原价中的GST部分

- 如果供应商未注册GST（`isGstRegistered = false`）：
  - 经销商/超市无法claim GST credits
  - 供应商需要承担GST成本（从价格中扣除）
  - 应付款 = 原价 - GST（扣除GST部分）
  - GST = 0（因为未注册GST，不能收取GST）

### 计算逻辑

```typescript
function calculatePartnerInvoiceItemPrice(
  product: iProduct,
  unitPrice: number,  // 产品单价（已根据partner折扣计算）
  quantity: number,
  isGstRegistered: boolean,
  isPriceInclusiveGst: boolean,
  isGstFreeCustomisable: boolean  // Partner是否支持产品GST独立设置
): {
  unitPriceExcludingGst: number;
  gstAmount: number;
  subtotalExcludingGst: number;
  subtotal: number;  // 小计（含GST，如果需要）
} {
  // 判断产品是否GST-free
  // 如果Partner不支持GST独立设置，统一按需要GST计算（忽略产品自身的isGstFree）
  const effectiveIsGstFree = isGstFreeCustomisable ? product.isGstFree : false;
  
  // 如果产品是GST-free，不计算GST
  if (effectiveIsGstFree) {
    return {
      unitPriceExcludingGst: unitPrice,
      gstAmount: 0,
      subtotalExcludingGst: unitPrice * quantity,
      subtotal: unitPrice * quantity
    };
  }
  
  // 如果未注册GST，不计算GST
  if (!isGstRegistered) {
    return {
      unitPriceExcludingGst: unitPrice,
      gstAmount: 0,
      subtotalExcludingGst: unitPrice * quantity,
      subtotal: unitPrice * quantity
    };
  }
  
  // 已注册GST且产品需要GST
  if (isPriceInclusiveGst) {
    // 单价已含GST
    const unitPriceExcludingGst = unitPrice / 1.1;
    const gstAmount = (unitPrice - unitPriceExcludingGst) * quantity;
    return {
      unitPriceExcludingGst: Number(unitPriceExcludingGst.toFixed(2)),
      gstAmount: Number(gstAmount.toFixed(2)),
      subtotalExcludingGst: Number((unitPriceExcludingGst * quantity).toFixed(2)),
      subtotal: unitPrice * quantity
    };
  } else {
    // 单价不含GST
    const unitPriceExcludingGst = unitPrice;
    const gstAmount = unitPrice * 0.1 * quantity;
    return {
      unitPriceExcludingGst: Number(unitPriceExcludingGst.toFixed(2)),
      gstAmount: Number(gstAmount.toFixed(2)),
      subtotalExcludingGst: Number((unitPriceExcludingGst * quantity).toFixed(2)),
      subtotal: Number((unitPrice * 1.1 * quantity).toFixed(2))
    };
  }
}

function calculatePartnerInvoiceTotal(
  invoiceItems: Array<{
    productId: string;
    unitPrice: number;
    quantity: number;
    gstAmount: number;
    subtotal: number;
  }>,
  isGstRegistered: boolean
): {
  subtotalExcludingGst: number;
  gstAmount: number;
  totalAmount: number;  // 应付款
} {
  let subtotalExcludingGst = 0;
  let totalGstAmount = 0;
  
  for (const item of invoiceItems) {
    subtotalExcludingGst += item.subtotal - item.gstAmount;
    totalGstAmount += item.gstAmount;
  }
  
  // 如果未注册GST，应付款需要扣除GST部分
  if (!isGstRegistered) {
    return {
      subtotalExcludingGst: Number(subtotalExcludingGst.toFixed(2)),
      gstAmount: 0,  // 未注册GST，不能收取GST
      totalAmount: Number(subtotalExcludingGst.toFixed(2))  // 应付款扣除GST
    };
  } else {
    return {
      subtotalExcludingGst: Number(subtotalExcludingGst.toFixed(2)),
      gstAmount: Number(totalGstAmount.toFixed(2)),
      totalAmount: Number((subtotalExcludingGst + totalGstAmount).toFixed(2))
    };
  }
}
  // 如果注册了GST，按正常计算
  if (isGstRegistered) {
    if (isPriceInclusiveGst) {
      // 原价已含GST
      const subtotalExcludingGst = originalPrice / 1.1;
      const gstAmount = originalPrice - subtotalExcludingGst;
      return {
        subtotalExcludingGst: Number(subtotalExcludingGst.toFixed(2)),
        gstAmount: Number(gstAmount.toFixed(2)),
        totalAmount: originalPrice
      };
    } else {
      // 原价不含GST
      const subtotalExcludingGst = originalPrice;
      const gstAmount = originalPrice * 0.1;
      return {
        subtotalExcludingGst: Number(subtotalExcludingGst.toFixed(2)),
        gstAmount: Number(gstAmount.toFixed(2)),
        totalAmount: Number((originalPrice * 1.1).toFixed(2))
      };
    }
  } else {
    // 未注册GST，需要扣除GST部分
    // 假设原价是含GST的价格
    if (isPriceInclusiveGst) {
      // 原价已含GST，需要扣除GST部分
      const subtotalExcludingGst = originalPrice / 1.1;
      const gstAmount = originalPrice - subtotalExcludingGst;
      // 应付款 = 不含GST价格（扣除GST部分）
      return {
        subtotalExcludingGst: Number(subtotalExcludingGst.toFixed(2)),
        gstAmount: 0,  // 未注册GST，不能收取GST
        totalAmount: Number(subtotalExcludingGst.toFixed(2))  // 应付款扣除GST
      };
    } else {
      // 原价不含GST，直接使用
      return {
        subtotalExcludingGst: originalPrice,
        gstAmount: 0,  // 未注册GST，不能收取GST
        totalAmount: originalPrice
      };
    }
  }
}
```

### 示例

**场景1：注册了GST，原价$110（含GST）**
```
原价: $110.00
计算：
- 不含GST: $100.00
- GST: $10.00
- 应付款: $110.00（经销商可以claim $10 GST credits）
```

**场景2：未注册GST，原价$110（含GST）**
```
原价: $110.00
计算：
- 不含GST: $100.00
- GST: $0.00（未注册，不能收取）
- 应付款: $100.00（扣除$10 GST，供应商承担）
```

**说明：**
- 未注册GST时，供应商需要承担GST成本
- 因为经销商无法claim GST credits，所以从应付款中扣除GST部分
- 这样确保经销商的实际成本一致（无论供应商是否注册GST）

### 实现位置

- Partner Invoice Summaries: `xituan_backend/src/domains/partner/services/partner.service.ts`
  - 更新 `calculateInvoiceItems` 方法，传入 `partner.isGstFreeCustomisable`
  - 更新 `calculatePartnerInvoiceItemPrice` 调用，传入 `isGstFreeCustomisable` 参数
- CMS Invoice 页面: `xituan_cms/src/pages/partner-invoice-summaries/[id]/edit.tsx`
- Partner管理页面: `xituan_cms/src/pages/partners/...`（添加 isGstFreeCustomisable 字段编辑）

## 数据库迁移

### 1. 更新 finance settings

**Migration文件：** `xituan_backend/migrations/1710000000XXX_add_gst_settings_to_finance.sql`

```sql
-- 更新财务设置，添加GST配置
UPDATE platform_settings
SET settings = jsonb_set(
  settings,
  '{gst}',
  '{
    "isRegistered": false,
    "registrationDate": null,
    "isPriceInclusiveGst": false
  }'::jsonb
)
WHERE category = 'finance';
```

### 2. 添加产品 isGstFree 字段

**Migration文件：** `xituan_backend/migrations/1710000000XXX_add_is_gst_free_to_products.sql`

```sql
-- 添加 is_gst_free 字段到 products 表
ALTER TABLE products
ADD COLUMN IF NOT EXISTS is_gst_free BOOLEAN NOT NULL DEFAULT false;

-- 添加注释
COMMENT ON COLUMN products.is_gst_free IS '是否GST-free（true = GST-free，false = 需要GST）';
```

## 实施步骤

### Step 1: 数据结构更新

1. **更新类型定义**
   - 更新 `iFinanceSettings` 接口，添加 `gst` 字段
   - 更新 `iProduct` 接口，添加 `isGstFree` 字段
   - 更新 `iPartner` 接口，添加 `isGstFreeCustomisable` 字段

2. **数据库迁移**
   - 创建 finance settings GST配置迁移
   - 创建 products isGstFree 字段迁移
   - 创建 partners isGstFreeCustomisable 字段迁移

3. **实体类更新**
   - 更新 `Product` entity，添加 `isGstFree` 字段
   - 更新 `Partner` entity，添加 `isGstFreeCustomisable` 字段

### Step 2: 后端逻辑实现

1. **GST设置服务**
   - 创建/更新GST设置
   - 获取当前GST设置
   - 验证GST设置有效性

2. **Partner Invoice服务更新**
   - 实现 `calculatePartnerInvoiceItemPrice` 函数（考虑产品isGstFree和Partner isGstFreeCustomisable）
   - 实现 `calculatePartnerInvoiceTotal` 函数
   - 更新 `calculateInvoiceItems` 方法：
     - 传入 `partner.isGstFreeCustomisable` 参数
     - 根据 `isGstFreeCustomisable` 决定是否使用产品自身的 `isGstFree`
     - 如果 `isGstFreeCustomisable = false`，统一按 `isGstFree = false` 计算
   - 根据GST注册状态调整应付款和GST金额
   - **注意：** Partner Invoice Summaries 价格计算不需要更新，因为它是基于 invoices 的 sum，invoices 已经更新了计算逻辑

### Step 3: CMS前端实现

1. **财务设置页面**
   - 添加GST配置界面
   - 支持设置：
     - 是否注册GST
     - GST注册日期
     - 价格是否含GST

2. **产品管理页面**
   - 添加 isGstFree 字段编辑功能

3. **Partner管理页面**
   - 添加 isGstFreeCustomisable 字段编辑功能

4. **Invoice编辑页面**
   - 根据GST状态调整应付款显示
   - 显示GST金额（注册时显示实际GST，未注册时显示0）
   - 更新价格计算逻辑，考虑产品isGstFree

## 注意事项

1. **GST注册日期**
   - 必须记录GST注册生效日期
   - 用于判断历史订单是否应该包含GST

2. **价格精度**
   - 所有价格计算保留2位小数
   - 使用 `Number(value.toFixed(2))` 确保精度

3. **Partner Invoice价格计算**
   - 未注册GST时，应付款需要扣除GST部分（供应商承担）
   - 确保经销商的实际成本一致（无论供应商是否注册GST）
   - Invoice中的GST字段：注册GST时显示实际GST，未注册时显示0

4. **产品GST分类**
   - 需要根据ATO规则正确设置每个产品的 isGstFree 值
   - 参考产品GST分类分析文档

5. **Partner isGstFreeCustomisable 设置**
   - 默认值：`false`（不支持产品GST独立设置，统一按需要GST计算）
   - 如果Partner系统支持产品级别GST设置，设置为 `true`
   - 设置为 `true` 时，使用产品自身的 `isGstFree` 值

6. **历史数据兼容**
   - 历史Invoice数据不需要迁移，稍后手动重新保存，使用新的计算逻辑在保存时生成更新后的数据和PDF
   - 对于现有Partner，`isGstFreeCustomisable` 默认为 `false`
   - 对于现有产品，需要设置 isGstFree 值

## 测试要点

1. **未注册GST场景**
   - GST设置正确保存
   - Invoice应付款 = 原价 - GST
   - Invoice GST字段显示为0

2. **已注册GST场景**
   - GST设置正确保存
   - Invoice应付款 = 原价（含GST）
   - Invoice GST字段正确显示

3. **价格模式测试**
   - 含GST价格模式：原价 / 1.1
   - 不含GST价格模式：原价 × 1.1

4. **CMS界面测试**
   - 财务设置页面GST配置正确保存和显示
   - Invoice编辑页面价格计算正确
   - Invoice显示格式正确

5. **产品GST分类测试**
   - GST-free产品不计算GST
   - 需要GST的产品正确计算GST

6. **Partner isGstFreeCustomisable 测试**
   - `isGstFreeCustomisable = true`：使用产品自身的 `isGstFree` 值
   - `isGstFreeCustomisable = false`：忽略产品自身的 `isGstFree`，统一按需要GST计算
   - 混合GST-free和需要GST的产品时，根据 `isGstFreeCustomisable` 正确计算

7. **Partner Invoice测试**
   - 注册GST时：应付款 = 原价（含GST），GST正确显示
   - 未注册GST时：应付款 = 原价 - GST，GST显示为0
   - 确保经销商实际成本一致（无论供应商是否注册GST）
   - 混合GST-free和需要GST的产品时，GST计算正确
   - 测试 `isGstFreeCustomisable = false` 时，所有产品都按需要GST计算

## 相关文档

- **第二阶段实现方案：** `gst-implementation-plan.md`（微信小程序订单GST计算和显示）
- 产品GST分类分析（待创建）
- ATO GST规则参考：https://www.ato.gov.au/law/view/document?docid=GST/GSTR20018/NAT/ATO/00001

