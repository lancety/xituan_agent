# 库存验证逻辑修复总结

## 问题描述

在之前的实现中，购物车服务中的库存验证逻辑存在错误：

- **所有模式都检查 `products` 表库存**：无论是普通模式、团购模式还是预购模式，都统一检查 `products` 表的库存
- **应该根据模式检查不同的库存表**：
  - `REGULAR` 模式：检查 `products` 表库存
  - `OFFER` 模式：检查 `offer_products` 表库存
  - `PREORDER` 模式：检查 `products_preorderable` 表库存

## 修复内容

### 1. 购物车服务 (`cart.service.ts`) 修复

#### 修复的方法：

1. **`addToCart` 方法**
   - 修复了添加产品到购物车时的库存验证逻辑
   - 根据不同的模式调用相应的验证服务

2. **更新现有购物车项时的库存检查**
   - 修复了当购物车中已存在相同产品时的库存验证
   - 确保更新数量时也检查正确的库存表

3. **`updateCartItemQuantity` 方法**
   - 修复了更新购物车项数量时的库存验证
   - 根据购物车项的模式检查相应的库存

4. **`checkCartStockAvailability` 方法**
   - 修复了批量检查购物车库存的方法
   - 为不同模式提供不同的错误信息

5. **`removeInsufficientStockItems` 方法**
   - 修复了移除库存不足商品的方法
   - 根据模式检查相应的库存表

6. **`validateCartItems` 方法**
   - 修复了验证购物车项的方法
   - 提供更准确的错误信息

#### 修复后的逻辑：

```typescript
// 根据不同的模式进行相应的验证和库存检查
if (cartItemData.mode === epOrderMode.OFFER && cartItemData.modeInstanceId && cartItemData.modeProductId) {
  // 团购模式：验证团购产品有效性（包括库存检查）
  await this.offerProductValidationService.validateOfferProduct(
    cartItemData.modeInstanceId, 
    cartItemData.modeProductId, 
    cartItemData.productId, 
    cartItemData.quantity
  );
} else if (cartItemData.mode === epOrderMode.PREORDER) {
  // 预购模式：验证预购产品有效性（包括库存检查）
  await this.preorderProductValidationService.validatePreorderProduct(cartItemData.productId, cartItemData.quantity);
} else {
  // 普通模式：检查products表库存
  if (product.stock >= 0 && product.stock < cartItemData.quantity) {
    throw BusinessError.createError(eBusinessErrorCode.PRODUCT_STOCK_INSUFFICIENT, [product.id]);
  }
}
```

### 2. 订单服务 (`order.service.ts`) 验证

订单服务中的库存验证逻辑已经是正确的：

- **`validateRegularCartItem`**：正确检查 `products` 表库存
- **`validateOfferCartItem`**：使用 `OfferProductValidationService` 检查 `offer_products` 表库存
- **`validatePreorderCartItem`**：使用 `PreorderProductValidationService` 检查 `products_preorderable` 表库存

## 库存验证规则总结

### 1. 普通模式 (REGULAR)
- **库存表**: `products`
- **字段**: `stock`
- **规则**: `stock >= 0 && stock < quantity` 时库存不足
- **特殊值**: `stock = -1` 表示无限制库存

### 2. 团购模式 (OFFER)
- **库存表**: `offer_products`
- **字段**: `stock`
- **规则**: `stock >= 0 && stock < quantity` 时库存不足
- **特殊值**: `stock = -1` 表示无限制库存
- **额外验证**: 必须验证 `offerProductId` 属于指定的 `offerId`

### 3. 预购模式 (PREORDER)
- **库存表**: `products_preorderable`
- **字段**: `stock`
- **规则**: `stock >= 0 && stock < quantity` 时库存不足
- **特殊值**: `stock = -1` 表示无限制库存
- **额外验证**: 必须验证产品存在于 `products_preorderable` 表

## 验证服务职责

### 1. `OfferProductValidationService`
- 验证团购产品是否属于指定的团购活动
- 验证团购产品库存是否充足
- 验证团购活动状态和时间有效性

### 2. `PreorderProductValidationService`
- 验证产品是否支持预购
- 验证预购产品库存是否充足

### 3. 购物车服务
- 根据模式调用相应的验证服务
- 处理普通模式的库存验证
- 提供统一的错误处理

## 错误处理

### 1. 普通模式
- 使用 `BusinessError` 抛出库存不足错误
- 错误代码：`PRODUCT_STOCK_INSUFFICIENT`

### 2. 团购模式
- 使用 `BusinessError` 抛出团购产品相关错误
- 错误代码：`OFFER_PRODUCT_INVALID`, `PRODUCT_STOCK_INSUFFICIENT`

### 3. 预购模式
- 使用 `BusinessError` 抛出预购产品相关错误
- 错误代码：`PRODUCT_NOT_PREORDERABLE`, `PRODUCT_STOCK_INSUFFICIENT`

## 测试建议

### 1. 单元测试
- 测试不同模式下的库存验证逻辑
- 测试库存不足时的错误处理
- 测试无限制库存的情况

### 2. 集成测试
- 测试添加不同模式产品到购物车的流程
- 测试更新购物车项数量时的验证
- 测试批量库存检查功能

### 3. 边界测试
- 测试库存为0的情况
- 测试库存为-1（无限制）的情况
- 测试库存刚好等于需求数量的情况

## 注意事项

1. **数据一致性**: 确保不同库存表之间的数据同步
2. **性能考虑**: 避免重复的数据库查询
3. **错误信息**: 提供清晰的错误信息，便于用户理解
4. **日志记录**: 记录库存验证失败的情况，便于调试
5. **监控告警**: 监控库存不足的情况，及时补充库存

## 后续优化建议

1. **缓存机制**: 为库存信息添加缓存，减少数据库查询
2. **批量验证**: 优化批量库存检查的性能
3. **库存预留**: 考虑实现库存预留机制，避免超卖
4. **实时同步**: 确保不同库存表之间的实时同步
5. **监控面板**: 创建库存监控面板，实时查看各模式库存状态
