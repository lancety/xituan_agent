# 报价库存系统设计说明

## 概述
本系统采用"库存借用+预留"的机制来管理报价产品的库存，确保库存一致性并避免超卖。

## 核心概念

### 1. 库存借用机制
- **Offer创建时**：从Product库存中"借用"指定数量到Offer
- **Offer进行中**：通过`reserved_stock`跟踪已预订数量
- **Offer截单后**：将剩余库存返还给Product表

### 2. 字段说明

#### offer_products表
- **`stock`**: 承诺可售数量
  - `-1`: 无限制库存
  - `0`: 无库存
  - `>0`: 有限库存（从products表借用）
- **`reserved_stock`**: 已预订数量
  - 订单创建时预留的数量
  - 防止超卖
- **`stock + reserved_stock`**: 该Offer承诺的总数量

#### products表
- **`stock`**: 实际可用库存
  - 被Offer借用的数量会暂时减少
  - Offer截单后会返还剩余数量

## 库存流程

### 1. Offer创建流程
```typescript
// 1. 检查产品库存
const product = await productRepo.findProductById(productId);
if (product.stock < borrowQuantity) {
  throw new Error('库存不足');
}

// 2. 从产品库存中借用数量
await productRepo.updateProductStock(productId, product.stock - borrowQuantity);

// 3. 创建offer_product记录
await offerProductRepo.create({
  offerId,
  productId,
  stock: borrowQuantity,  // 借用的数量
  reservedStock: 0        // 初始预留为0
});
```

### 2. 订单创建流程
```typescript
// 1. 检查Offer库存可用性
const offerProduct = await offerProductRepo.findByOfferAndProduct(offerId, productId);
if (!offerProduct.isQuantityAvailable(quantity)) {
  throw new Error('库存不足');
}

// 2. 预留库存
const newReservedStock = offerProduct.reservedStock + quantity;
await offerProductRepo.updateReservedStock(offerProduct.id, newReservedStock);

// 3. 创建订单
await orderRepo.createOrder(orderData);
```

### 3. Offer截单流程
```typescript
// 1. 计算需要返还的数量
const returnQuantity = offerProduct.stock - offerProduct.reservedStock;

// 2. 将剩余库存返还给产品
if (returnQuantity > 0) {
  const product = await productRepo.findProductById(offerProduct.productId);
  const newStock = product.stock + returnQuantity;
  await productRepo.updateProductStock(offerProduct.productId, newStock);
}

// 3. 将报价产品库存设为0
await offerProductRepo.updateStock(offerProduct.id, -offerProduct.stock);
```

## 库存检查策略

### 1. 实时检查
- **订单创建时**：检查Offer库存可用性
- **库存预留**：立即预留，防止超卖

### 2. 批量同步
- **定期检查**：可设置定时任务检查库存一致性
- **手动同步**：管理员可手动触发库存同步

### 3. 库存一致性验证
```sql
-- 检查Offer库存与Product库存的一致性
SELECT 
  op.offer_id,
  op.product_id,
  op.stock as offer_stock,
  op.reserved_stock,
  p.stock as product_stock,
  (op.stock - op.reserved_stock) as available_in_offer,
  CASE 
    WHEN op.stock = -1 THEN '无限制'
    WHEN (op.stock - op.reserved_stock) > 0 THEN '有库存'
    ELSE '无库存'
  END as status
FROM offer_products op
JOIN products p ON op.product_id = p.id
WHERE op.is_active = true;
```

## 优势

### 1. 库存一致性
- Offer库存不会超过Product实际库存
- 避免超卖问题

### 2. 性能优化
- 减少实时库存检查
- 批量处理库存更新

### 3. 业务灵活性
- 支持库存借用和返还
- 预留机制防止超卖

## 注意事项

### 1. 事务处理
- 库存借用和预留操作需要在事务中执行
- 确保数据一致性

### 2. 异常处理
- 库存不足时的错误处理
- 库存返还失败的回滚机制

### 3. 监控告警
- 库存不一致的监控
- 库存不足的告警

## 扩展功能

### 1. 库存预警
- 当Product库存低于阈值时告警
- 当Offer库存不足时提醒

### 2. 库存分析
- 库存周转率分析
- 库存占用分析

### 3. 自动化管理
- 自动库存同步
- 智能库存分配 