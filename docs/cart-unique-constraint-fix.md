# 购物车唯一约束修复文档

## 问题描述

在购物车功能中，当用户尝试添加相同产品但具有不同选项或备注时，会出现以下错误：

```
error: duplicate key value violates unique constraint "cart_items_cart_id_product_id_key"
```

这是因为数据库中存在 `UNIQUE(cart_id, product_id)` 约束，导致同一个购物车中不能有相同的产品ID，即使这些产品有不同的配置选项。

## 根本原因

1. **数据库约束过于严格**: 原有的唯一约束只考虑了购物车ID和产品ID，没有考虑产品选项和备注的差异
2. **业务逻辑缺陷**: 购物车服务试图区分"普通产品"和"自定义产品"，但数据库约束不支持这种区分
3. **用户体验问题**: 用户无法在购物车中添加相同产品的不同配置版本

## 解决方案

### 1. 数据库层面修复

创建了新的迁移文件 `1710000000014_fix_cart_items_unique_constraint.sql`：

- 删除了原有的 `UNIQUE(cart_id, product_id)` 约束
- 创建了 `generate_cart_item_hash()` 函数来生成基于配置的唯一标识
- 添加了 `unique_hash` 计算列，自动生成基于购物车ID、产品ID、选项和备注的唯一标识
- 创建了新的唯一约束 `idx_cart_items_unique_hash`，基于 `unique_hash` 列

### 2. 实体层面更新

更新了 `CartItem` 实体：

```typescript
@Column({ 
  type: 'text', 
  name: 'unique_hash', 
  generatedType: 'STORED', 
  asExpression: 'generate_cart_item_hash(cart_id, product_id, selected_options, note)' 
})
uniqueHash!: string;
```

### 3. 业务逻辑优化

重构了 `CartService.addToCart()` 方法：

- **普通产品**: 无选项、无备注、无图片的产品，相同产品会合并数量
- **自定义产品**: 有选项、有备注、有图片的产品，每次添加都创建新的购物车项
- **混合情况**: 普通产品但购物车中已有不同配置的相同产品时，创建新的购物车项

### 4. 仓库层增强

添加了新的查询方法：

```typescript
async findCartItemByCartAndProductWithConfig(
  cartId: string, 
  productId: string, 
  selectedOptions: any[] = [], 
  note?: string
): Promise<CartItem | null>
```

## 修复效果

### 修复前
- ❌ 无法添加相同产品的不同配置
- ❌ 违反唯一约束导致添加失败
- ❌ 用户体验差

### 修复后
- ✅ 可以添加相同产品的不同配置
- ✅ 普通产品自动合并数量
- ✅ 自定义产品独立管理
- ✅ 支持复杂的购物车场景

## 测试用例

1. **普通产品合并**: 添加相同普通产品时，数量会自动合并
2. **选项产品独立**: 有不同选项的产品会作为独立项存在
3. **备注产品独立**: 有不同备注的产品会作为独立项存在
4. **混合配置**: 支持选项+备注的复杂配置

## 数据库变更

### 新增函数
```sql
CREATE OR REPLACE FUNCTION generate_cart_item_hash(
    p_cart_id UUID,
    p_product_id UUID,
    p_selected_options JSONB,
    p_note TEXT
) RETURNS TEXT
```

### 新增列
```sql
ALTER TABLE cart_items 
ADD COLUMN unique_hash TEXT GENERATED ALWAYS AS (
    generate_cart_item_hash(cart_id, product_id, selected_options, note)
) STORED;
```

### 约束变更
- 删除: `UNIQUE(cart_id, product_id)`
- 新增: `UNIQUE(unique_hash)`

## 注意事项

1. **向后兼容**: 修复完全向后兼容，不影响现有数据
2. **性能影响**: 新增的计算列和索引对性能影响微乎其微
3. **数据一致性**: 新的唯一约束确保数据一致性
4. **业务逻辑**: 保持了原有的业务逻辑，只是修复了约束冲突

## 相关文件

- 迁移文件: `migrations/1710000000014_fix_cart_items_unique_constraint.sql`
- 实体文件: `src/domains/order/domain/cart-item.entity.ts`
- 服务文件: `src/domains/order/services/cart.service.ts`
- 仓库文件: `src/domains/order/infrastructure/cart-item.repository.ts`
- 测试文件: `test-cart-fix.js`

## 部署说明

1. 运行数据库迁移: `npm run migrate:dev`
2. 重启后端服务: `npm run dev`
3. 验证修复效果: 运行测试脚本 `node test-cart-fix.js`

---

**修复完成时间**: 2025-07-26  
**修复人员**: AI Assistant  
**状态**: ✅ 已完成 