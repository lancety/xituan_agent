# 库存系统更新说明

## 概述
本次更新移除了产品表中的 `stock_limit` 字段，通过 `stock` 字段的值来完全表示库存状态，简化了库存管理逻辑。

## 库存状态定义

### 产品库存 (products.stock)
- **`stock = -1`**: 无限制库存，永不售罄
- **`stock = 0`**: 无库存，不可购买
- **`stock > 0`**: 有限库存，需要检查并更新

### 产品选项库存 (product_options.current_stock)
- **`current_stock = -1`**: 无限制库存，永不售罄
- **`current_stock = 0`**: 无库存，不可选择
- **`current_stock > 0`**: 有限库存，需要检查并更新

## 主要变更

### 1. 数据库结构
- 移除了 `products.stock_limit` 字段
- 移除了 `product_options.stock_limit` 字段
- 添加了库存约束：`stock >= -1`, `current_stock >= -1`
- 优化了库存相关索引

### 2. 业务逻辑更新
- 库存检查逻辑从 `product.stockLimit && product.stock < quantity` 改为 `product.stock >= 0 && product.stock < quantity`
- 订单创建后自动更新产品库存
- 新增了 `reduceProductStock()` 和 `addProductStock()` 方法

### 3. 类型定义更新
- 移除了 `iProduct.stockLimit` 字段
- 更新了库存相关的业务方法

## 使用方法

### 检查产品是否有库存限制
```typescript
// 旧方法
if (product.stockLimit) {
  // 有库存限制
}

// 新方法
if (product.hasStockLimit()) {
  // 有库存限制
}
```

### 检查产品是否有可用库存
```typescript
// 旧方法
if (product.stockLimit && product.stock > 0) {
  // 有可用库存
}

// 新方法
if (product.hasAvailableStock()) {
  // 有可用库存
}
```

### 检查指定数量是否可用
```typescript
// 旧方法
if (product.stockLimit && product.stock >= quantity) {
  // 数量可用
}

// 新方法
if (product.isQuantityAvailable(quantity)) {
  // 数量可用
}
```

## 迁移注意事项

1. **数据迁移**: 系统会自动将之前 `stock_limit = true` 且 `stock = 0` 的产品设置为 `stock = -1`
2. **向后兼容**: 新的库存检查逻辑与旧逻辑功能一致
3. **性能提升**: 减少了字段查询和索引维护成本

## 库存更新流程

1. **订单创建时**: 自动检查库存并减少相应数量
2. **库存不足时**: 抛出 `BusinessError` 异常，错误代码为 `PRODUCT_STOCK_INSUFFICIENT`
3. **无限制库存**: 不会减少库存数量
4. **库存恢复**: 可通过 `addProductStock()` 方法增加库存

## 测试建议

1. 测试无限制库存产品的订单创建
2. 测试有限库存产品的库存检查
3. 测试库存不足时的错误处理
4. 测试库存更新后的数据一致性 