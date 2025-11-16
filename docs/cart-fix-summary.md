# 购物车API修复总结

## 问题描述

在测试购物车功能时，出现了以下错误：

```
error: column Cart__Cart_items.selectedOptions does not exist
QueryFailedError: column Cart__Cart_items.selectedOptions does not exist
```

## 问题原因

1. **字段名不匹配**：CartItem 实体中的 `selectedOptions` 字段没有指定 `name` 属性
2. **命名约定不一致**：TypeORM 默认使用驼峰命名，但数据库中使用下划线命名
3. **数据库字段缺失**：数据库中可能缺少 `selected_options` 字段

## 修复方案

### 1. 修复 CartItem 实体

**文件**: `src/domains/order/domain/cart-item.entity.ts`

**修改前**:
```typescript
@Column({ type: 'jsonb', default: [] })
selectedOptions!: iSelectedOption[];
```

**修改后**:
```typescript
@Column({ type: 'jsonb', name: 'selected_options', default: [] })
selectedOptions!: iSelectedOption[];
```

### 2. 创建数据库迁移

**文件**: `migrations/1710000000011_fix_cart_items_selected_options.sql`

```sql
-- 检查并添加selected_options字段（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'cart_items' 
        AND column_name = 'selected_options'
    ) THEN
        ALTER TABLE cart_items ADD COLUMN selected_options JSONB DEFAULT '[]';
        RAISE NOTICE 'Added selected_options column to cart_items table';
    ELSE
        RAISE NOTICE 'selected_options column already exists in cart_items table';
    END IF;
END $$;

-- 更新现有记录的selected_options字段为默认值（如果为NULL）
UPDATE cart_items SET selected_options = '[]' WHERE selected_options IS NULL;
```

### 3. 运行迁移

```bash
npm run migrate:dev
```

## 验证结果

### 1. API 测试

运行测试脚本验证购物车API功能：

- ✅ 获取购物车（未认证）正确返回401错误
- ✅ 获取购物车统计（未认证）正确返回401错误  
- ✅ 获取产品列表正常工作

### 2. 数据库验证

确认数据库中 `cart_items` 表包含以下字段：

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'cart_items' 
AND column_name = 'selected_options';
```

## 相关文件

### 后端文件
- `src/domains/order/domain/cart-item.entity.ts` - CartItem 实体
- `src/domains/order/domain/cart.entity.ts` - Cart 实体
- `src/domains/order/domain/order-item.entity.ts` - OrderItem 实体
- `migrations/1710000000011_fix_cart_items_selected_options.sql` - 数据库迁移

### 前端文件
- `xituan_wechat_app/lib/commerce.ts` - 购物车API调用
- `xituan_wechat_app/lib/error-handler.util.ts` - 错误处理工具
- `xituan_wechat_app/pages/cart/cart.ts` - 购物车页面

## 注意事项

1. **字段命名**：所有实体字段都应该明确指定 `name` 属性，确保与数据库字段名一致
2. **迁移顺序**：确保迁移文件按正确顺序执行
3. **数据一致性**：更新现有记录的 `selected_options` 字段为默认值
4. **错误处理**：前端已实现完善的错误处理机制

## 后续建议

1. **代码审查**：检查其他实体是否有类似的字段命名问题
2. **测试覆盖**：增加购物车功能的单元测试和集成测试
3. **文档更新**：更新API文档，说明购物车字段的用途和格式
4. **监控**：监控购物车API的使用情况和错误率 