# 团购购物车验证功能实现

## 概述

本实现为购物车添加产品和创建订单时增加了团购产品验证功能，确保团购模式的产品必须存在于指定的 `offer_products` 表中，并且通过 `mode_instance_id` (offerId) 和 `mode_product_id` (offerProductId) 进行关联验证。

## 实现方案

### 1. 创建独立的团购产品验证服务

**文件**: `src/shared/services/offer-product-validation.service.ts`

**功能**:
- `validateOfferProductBelongsToOffer(offerId, offerProductId, productId)`: 验证团购产品是否属于指定的offer
- `validateOfferProductStock(offerProductId, quantity)`: 验证团购产品库存
- `validateOfferProduct(offerId, offerProductId, productId, quantity)`: 综合验证团购产品
- `getOfferProductInfo(offerProductId)`: 获取团购产品信息
- `validateOfferCartItems(cartItems)`: 批量验证团购购物车项

**核心验证逻辑**:
```sql
SELECT 
  op.id, op.offer_id, op.product_id, op.stock, op.is_active,
  o.start_date, o.end_date, o.is_released
FROM offer_products op
JOIN offers o ON op.offer_id = o.id
WHERE op.id = $1 
  AND op.offer_id = $2 
  AND op.product_id = $3
```

**验证步骤**:
1. 验证 `offer_products` 表中是否存在指定的 `offerProductId`
2. 验证该记录是否属于指定的 `offerId`
3. 验证产品ID是否匹配
4. 验证团购活动状态（已发布且活跃）
5. 验证团购活动时间（在有效期内）
6. 验证团购产品是否激活
7. 验证库存是否充足

### 2. 更新购物车服务

**文件**: `src/domains/order/services/cart.service.ts`

**修改**:
- 在 `addToCart` 方法中使用新的团购产品验证服务
- 当 `cartItemData.mode === epOrderMode.OFFER` 时，调用综合验证方法
- 删除了旧的 `validateOfferProduct` 方法

**验证时机**:
```typescript
// 如果是团购产品，验证团购产品有效性
if (cartItemData.mode === epOrderMode.OFFER && cartItemData.modeInstanceId && cartItemData.modeProductId) {
  await this.offerProductValidationService.validateOfferProduct(
    cartItemData.modeInstanceId, 
    cartItemData.modeProductId, 
    cartItemData.productId, 
    cartItemData.quantity
  );
}
```

### 3. 更新订单服务

**文件**: `src/domains/order/services/order.service.ts`

**修改**:
- 在 `validateOfferCartItem` 方法中使用新的验证服务
- 简化了验证逻辑，移除了重复的数据库查询
- 保持了产品存在性和状态验证

**优化**:
- 代码更简洁，逻辑更清晰
- 统一的验证逻辑和错误处理
- 减少了重复的数据库查询

### 4. 添加业务错误代码

**文件**: `submodules/xituan_codebase/typing_api/business-error.enum.ts`

**新增错误代码**:
- `OFFER_PRODUCT_INVALID`: 团购产品无效
- `PRODUCT_STOCK_INSUFFICIENT`: 产品库存不足（统一使用）

## 验证流程

### 添加产品到购物车时的验证流程

1. **产品存在性验证**: 检查产品是否存在于 `products` 表
2. **模式实例验证**: 验证 `mode_instance_id` 有效性（如果提供）
3. **团购产品验证**: 如果是团购模式，验证团购产品关联和库存
4. **预购产品验证**: 如果是预购模式，验证预购产品有效性
5. **库存验证**: 检查产品库存是否充足

### 团购产品验证详细步骤

1. **关联验证**: 查询 `offer_products` 表，验证 `offerProductId` 是否属于 `offerId`
2. **产品匹配**: 验证 `productId` 是否与 `offer_products` 记录中的产品ID匹配
3. **团购活动验证**: 
   - 检查团购活动是否已发布 (`is_released = true`)
   - 检查团购活动是否在有效期内
4. **团购产品验证**: 检查团购产品是否激活 (`is_active = true`)
5. **库存验证**: 
   - 如果 `stock = -1`，表示无限制库存
   - 如果 `stock >= 0`，检查是否满足需求数量

## 使用示例

### 在购物车服务中使用

```typescript
// 添加团购产品到购物车
const cartItemData = {
  productId: 'product-uuid',
  quantity: 2,
  mode: epOrderMode.OFFER,
  modeInstanceId: 'offer-uuid',    // offerId
  modeProductId: 'offer-product-uuid', // offerProductId
  // ... 其他字段
};

// 验证会自动进行
const cartItem = await cartService.addToCart(userId, cartItemData);
```

### 直接使用验证服务

```typescript
const validationService = new OfferProductValidationService();

// 验证团购产品关联
const offerValidation = await validationService.validateOfferProductBelongsToOffer(
  offerId, offerProductId, productId
);

// 验证团购产品库存
const stockValidation = await validationService.validateOfferProductStock(
  offerProductId, quantity
);

// 综合验证
await validationService.validateOfferProduct(
  offerId, offerProductId, productId, quantity
);
```

## 错误处理

### 业务错误

- `OFFER_PRODUCT_INVALID`: 当团购产品不存在或不属于指定的团购活动时
- `PRODUCT_STOCK_INSUFFICIENT`: 当团购产品库存不足时

### 错误信息

错误信息包含具体的产品ID、团购活动ID和错误原因，便于前端处理和用户理解。

## 测试

**测试文件**: `test_offer_validation.js`

**测试用例**:
1. 验证团购产品是否属于指定的offer
2. 验证团购产品库存
3. 综合验证功能
4. 批量验证功能

**运行测试**:
```bash
cd xituan_backend
node test_offer_validation.js
```

## 数据库表结构

### offer_products 表
- `id`: 团购产品ID (mode_product_id)
- `offer_id`: 团购活动ID (mode_instance_id)
- `product_id`: 产品ID
- `stock`: 库存数量
- `is_active`: 是否激活

### offers 表
- `id`: 团购活动ID
- `start_date`: 开始时间
- `end_date`: 结束时间
- `is_released`: 是否已发布

## 优势

1. **数据一致性**: 确保团购产品与团购活动的关联关系正确
2. **代码复用**: 验证逻辑在购物车和订单服务中共享
3. **清晰分离**: 团购产品验证逻辑独立，便于维护
4. **统一错误处理**: 使用统一的业务错误代码
5. **易于扩展**: 可以轻松添加更多团购相关的验证逻辑
6. **性能优化**: 通过JOIN查询减少数据库访问次数

## 注意事项

1. 确保 `offer_products` 表中有正确的数据
2. 团购产品验证只在 `mode === epOrderMode.OFFER` 时触发
3. 必须同时提供 `modeInstanceId` 和 `modeProductId`
4. 错误处理要确保用户能够理解具体的错误原因
5. 在生产环境中要监控验证失败的情况

## 后续优化建议

1. 添加缓存机制，减少数据库查询
2. 添加批量验证功能，提高性能
3. 添加团购产品验证的日志记录
4. 考虑添加团购产品验证的配置选项
5. 添加团购产品验证的监控和告警
1. 验证团购产品是否属于指定的offer
2. 验证团购产品库存
3. 综合验证功能
4. 批量验证功能

**运行测试**:
```bash
cd xituan_backend
node test_offer_validation.js
```

## 数据库表结构

### offer_products 表
- `id`: 团购产品ID (mode_product_id)
- `offer_id`: 团购活动ID (mode_instance_id)
- `product_id`: 产品ID
- `stock`: 库存数量
- `is_active`: 是否激活

### offers 表
- `id`: 团购活动ID
- `start_date`: 开始时间
- `end_date`: 结束时间
- `is_released`: 是否已发布

## 优势

1. **数据一致性**: 确保团购产品与团购活动的关联关系正确
2. **代码复用**: 验证逻辑在购物车和订单服务中共享
3. **清晰分离**: 团购产品验证逻辑独立，便于维护
4. **统一错误处理**: 使用统一的业务错误代码
5. **易于扩展**: 可以轻松添加更多团购相关的验证逻辑
6. **性能优化**: 通过JOIN查询减少数据库访问次数

## 注意事项

1. 确保 `offer_products` 表中有正确的数据
2. 团购产品验证只在 `mode === epOrderMode.OFFER` 时触发
3. 必须同时提供 `modeInstanceId` 和 `modeProductId`
4. 错误处理要确保用户能够理解具体的错误原因
5. 在生产环境中要监控验证失败的情况

## 后续优化建议

1. 添加缓存机制，减少数据库查询
2. 添加批量验证功能，提高性能
3. 添加团购产品验证的日志记录
4. 考虑添加团购产品验证的配置选项
5. 添加团购产品验证的监控和告警