# 预购购物车验证功能实现

## 概述

本实现为购物车添加产品时增加了预购产品验证功能，确保只有存在于 `products_preorderable` 表中的产品才能被添加为预购模式。

## 实现方案

### 1. 创建独立的预购产品验证服务

**文件**: `src/shared/services/preorder-product-validation.service.ts`

**功能**:
- `isProductPreorderable(productId)`: 检查产品是否支持预购
- `validatePreorderStock(productId, quantity)`: 验证预购库存是否充足
- `validatePreorderProduct(productId, quantity)`: 综合验证预购产品
- `getPreorderableProductInfo(productId)`: 获取预购产品信息

**优势**:
- 单一职责原则，专门处理预购产品验证
- 可在多个服务中复用
- 代码清晰，便于维护

### 2. 更新购物车服务

**文件**: `src/domains/order/services/cart.service.ts`

**修改**:
- 在 `addToCart` 方法中添加预购产品验证
- 当 `cartItemData.mode === epOrderMode.PREORDER` 时，调用预购产品验证服务

**验证时机**:
```typescript
// 如果是预购产品，验证预购产品有效性
if (cartItemData.mode === epOrderMode.PREORDER) {
  await this.preorderProductValidationService.validatePreorderProduct(cartItemData.productId, cartItemData.quantity);
}
```

### 3. 更新订单服务

**文件**: `src/domains/order/services/order.service.ts`

**修改**:
- 在 `validatePreorderCartItem` 方法中使用新的验证服务
- 替换原有的直接数据库查询逻辑

**优化**:
- 代码更简洁
- 复用验证逻辑
- 统一的错误处理

### 4. 添加业务错误代码

**文件**: `submodules/xituan_codebase/typing_api/business-error.enum.ts`

**新增错误代码**:
- `PRODUCT_NOT_PREORDERABLE`: 产品不支持预购
- `PRODUCT_STOCK_INSUFFICIENT`: 产品库存不足（统一使用）

## 验证流程

### 添加产品到购物车时的验证流程

1. **产品存在性验证**: 检查产品是否存在于 `products` 表
2. **模式实例验证**: 验证 `mode_instance_id` 有效性（如果提供）
3. **团购产品验证**: 如果是团购模式，验证 offer 有效性
4. **预购产品验证**: 如果是预购模式，验证产品是否支持预购
5. **库存验证**: 检查产品库存是否充足

### 预购产品验证详细步骤

1. **检查预购支持**: 查询 `products_preorderable` 表，确认产品ID存在
2. **库存验证**: 
   - 如果 `stock = -1`，表示无限制库存
   - 如果 `stock >= 0`，检查是否满足需求数量
3. **错误处理**: 抛出相应的业务错误

## 使用示例

### 在购物车服务中使用

```typescript
// 添加预购产品到购物车
const cartItemData = {
  productId: 'product-uuid',
  quantity: 2,
  mode: epOrderMode.PREORDER,
  // ... 其他字段
};

// 验证会自动进行
const cartItem = await cartService.addToCart(userId, cartItemData);
```

### 直接使用验证服务

```typescript
const validationService = new PreorderProductValidationService();

// 检查产品是否支持预购
const isPreorderable = await validationService.isProductPreorderable(productId);

// 验证预购库存
const stockValidation = await validationService.validatePreorderStock(productId, quantity);

// 综合验证
await validationService.validatePreorderProduct(productId, quantity);
```

## 错误处理

### 业务错误

- `PRODUCT_NOT_PREORDERABLE`: 当产品不存在于 `products_preorderable` 表时
- `PRODUCT_STOCK_INSUFFICIENT`: 当预购库存不足时

### 错误信息

错误信息包含具体的产品ID和错误原因，便于前端处理和用户理解。

## 测试

**测试文件**: `test_preorder_validation.js`

**测试用例**:
1. 检查产品是否支持预购
2. 验证预购库存
3. 综合验证功能

**运行测试**:
```bash
cd xituan_backend
node test_preorder_validation.js
```

## 优势

1. **代码复用**: 验证逻辑在购物车和订单服务中共享
2. **清晰分离**: 预购产品验证逻辑独立，便于维护
3. **统一错误处理**: 使用统一的业务错误代码
4. **易于扩展**: 可以轻松添加更多预购相关的验证逻辑
5. **性能优化**: 避免重复的数据库查询

## 注意事项

1. 确保 `products_preorderable` 表中有正确的数据
2. 预购产品验证只在 `mode === epOrderMode.PREORDER` 时触发
3. 错误处理要确保用户能够理解具体的错误原因
4. 在生产环境中要监控验证失败的情况

## 后续优化建议

1. 添加缓存机制，减少数据库查询
2. 添加批量验证功能，提高性能
3. 添加预购产品验证的日志记录
4. 考虑添加预购产品验证的配置选项
