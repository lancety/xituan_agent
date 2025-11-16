# 订单价格计算改进

## 概述

本次改进使后端创建订单时的价格计算逻辑与微信小程序中的 `getFormattedCartStats` 保持一致，确保每个选中的自定义产品选项都被正确计算。

## 改进内容

### 1. 新增价格计算方法

在 `OrderService` 中添加了以下方法：

#### `calculateCartItemDetailedPrice(cartItem)`
- 计算单个购物车项的详细价格信息
- 包含基础价格、选项额外价格、单价和小计
- 自动获取最新的产品选项价格

#### `calculateOptionsExtraPrice(selectedOptions)`
- 计算产品选项的额外价格总和
- 从数据库获取最新的选项价格（安全考虑）
- 更新选项信息，确保价格是最新的

#### `calculateOrderAmountWithDetails(cartItems)`
- 计算整个订单的金额和详细数据
- 为每个订单项提供完整的价格信息
- 返回结构化的订单项数据

### 2. 价格计算逻辑

#### 基础价格
- 优先使用 `salePrice`（特价）
- 如果没有特价，使用 `basePrice`（基础价格）

#### 选项额外价格
- 遍历所有选中的产品选项
- 从数据库获取每个选项的当前价格
- 累加所有选项的额外价格

#### 最终价格
- 单价 = 基础价格 + 选项额外价格
- 小计 = 单价 × 数量
- 总金额 = 所有小计之和

### 3. 安全特性

- **价格验证**: 拒绝使用用户提供的选项价格，始终从数据库获取最新价格
- **选项验证**: 检查选项是否存在，防止使用已失效的选项
- **错误处理**: 完善的错误处理和日志记录

### 4. 类型安全修复

#### 问题描述
在初始实现中遇到了 `unitPrice.toFixed is not a function` 错误，这是因为数据库中的价格字段（如 `base_price`、`sale_price`、`extra_price`）可能是字符串类型。

#### 解决方案
在价格计算过程中，使用 `Number()` 函数确保所有价格值都是数字类型：

```typescript
// 修复前（可能导致类型错误）
const basePrice = product.salePrice || product.basePrice;

// 修复后（确保类型安全）
const basePrice = Number(product.salePrice || product.basePrice || 0);
```

#### 修复位置
- `calculateCartItemDetailedPrice()` 方法中的基础价格计算
- `calculateOrderAmountWithDetails()` 方法中的订单项数据构建
- 所有涉及价格计算的字段都确保是数字类型

## 使用示例

### 创建订单时的价格计算

```typescript
// 在 createOrderByCartItems 方法中
const { totalAmount, deliveryFee, finalAmount, orderItemsData } = 
  await this.calculateOrderAmountWithDetails(cartItems);

// orderItemsData 包含每个订单项的详细价格信息
orderItemsData.forEach(itemData => {
  console.log(`商品: ${itemData.productName}`);
  console.log(`单价: $${itemData.unitPrice}`);
  console.log(`选项额外价格: $${itemData.totalExtraPrice}`);
  console.log(`小计: $${itemData.subtotal}`);
});
```

### 价格计算示例

假设有以下购物车项：

**商品1: 经典蛋糕**
- 基础价格: $25
- 选项: 大尺寸 (+$5), 巧克力口味 (+$3)
- 数量: 2
- 计算: (25 + 5 + 3) × 2 = $66

**商品2: 生日蛋糕**
- 特价: $30 (原价 $35)
- 选项: 生日蜡烛 (+$2.5)
- 数量: 1
- 计算: (30 + 2.5) × 1 = $32.5

**订单总计**: $66 + $32.5 = $98.5

## 与微信小程序的对比

### 微信小程序逻辑 (`getFormattedCartStats`)
```typescript
// 计算单价（基础价格 + 额外价格）
const unitPrice = priceUtil.sum(item.product?.basePrice, item.totalExtraPrice);

// 计算小计
const itemTotal = unitPrice * item.quantity;
```

### 后端新逻辑
```typescript
// 计算单价（基础价格 + 额外价格）
const unitPrice = basePrice + totalExtraPrice;

// 计算小计
const subtotal = unitPrice * cartItem.quantity;
```

## 数据库字段

订单项表 (`order_items`) 包含以下价格相关字段：

- `unit_price`: 单价（基础价格 + 选项额外价格）
- `base_price`: 产品基础价格
- `total_extra_price`: 选项额外价格总和
- `subtotal`: 小计（单价 × 数量）
- `selected_options`: 选中的产品选项（JSON格式）

## 测试验证

已通过测试验证价格计算逻辑的正确性：

- ✅ 基础价格计算正确
- ✅ 选项额外价格累加正确
- ✅ 特价优先使用正确
- ✅ 数量乘法计算正确
- ✅ 总金额汇总正确
- ✅ 字符串类型价格处理正确
- ✅ 所有价格字段类型安全

## 注意事项

1. **价格同步**: 选项价格从数据库实时获取，确保价格准确性
2. **库存检查**: 创建订单前会检查产品库存
3. **图片处理**: 购物车备注图片会自动转移到订单
4. **错误处理**: 完善的错误处理机制，确保订单创建的稳定性
5. **类型安全**: 所有价格字段都确保是数字类型，避免运行时错误

## 总结

通过本次改进，后端订单创建的价格计算逻辑现在与微信小程序完全一致，能够：

- 正确计算每个产品选项的额外价格
- 支持特价和基础价格的灵活使用
- 提供详细的价格计算信息
- 确保价格计算的准确性和安全性
- 处理数据库中的字符串类型价格，确保类型安全

这为订单管理提供了可靠的价格计算基础，确保前后端价格计算的一致性，同时解决了类型安全问题。
