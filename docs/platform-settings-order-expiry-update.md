# 平台设置订单过期时间更新

## 概述
更新了 iPlatformSettings 以支持三种订单类型的不同过期时间设置，满足不同业务需求。

## 业务需求
- **regular（常规订单）**: 时效性一般，12小时过期
- **offer（特价订单）**: 时效性强，库存管理需要更敏感的更新和清理，30分钟过期
- **preorder（预约订单）**: 需要后台确认，用户需要更多时间才能付款，48小时过期

## 更改内容

### 1. 数据库迁移文件更新
**文件**: `xituan_backend/migrations/1710000000127_create_platform_settings.sql`

```sql
-- 更新订单设置默认值
('order', '{
    "pendingPayExpMinutes_regular": 720,    -- 12小时 = 720分钟
    "pendingPayExpMinutes_offer": 30,       -- 30分钟
    "pendingPayExpMinutes_preorder": 2880   -- 48小时 = 2880分钟
}', '订单相关设置');
```

### 2. TypeScript 接口定义更新
**文件**: 
- `xituan_backend/submodules/xituan_codebase/typing_entity/platform-setting.type.ts`
- `xituan_wechat_app/submodules/xituan_codebase/typing_entity/platform-setting.type.ts`
- `xituan_cms/submodules/xituan_codebase/typing_entity/platform-setting.type.ts`

```typescript
// 订单设置
export interface iOrderSettings {
  pendingPayExpMinutes_regular: number;   // 常规订单过期时间（分钟）- 12小时
  pendingPayExpMinutes_offer: number;     // 特价订单过期时间（分钟）- 30分钟
  pendingPayExpMinutes_preorder: number;  // 预约订单过期时间（分钟）- 48小时
}
```

### 3. 定时任务逻辑更新
**文件**: `xituan_backend/src/domains/inventory/services/inventory-cron.service.ts`

#### 主要更改：
1. 添加了 `epOrderMode` 枚举导入
2. 重构了 `handleExpiredOrders()` 方法，按订单模式分别处理
3. 新增了 `handleExpiredOrdersByMode()` 私有方法，专门处理特定模式的过期订单

#### 新逻辑：
- 从平台设置获取三种订单模式的过期时间配置
- 分别调用 `handleExpiredOrdersByMode()` 处理每种模式的过期订单
- 在 SQL 查询中按 `mode` 字段过滤订单
- 在日志中显示具体的订单模式信息

### 4. 测试文件更新
**文件**: `xituan_backend/tests/setup.ts`

更新了测试环境中的默认平台设置，使用新的过期时间配置。

## 技术细节

### 过期时间计算
- **regular**: 720分钟 = 12小时
- **offer**: 30分钟
- **preorder**: 2880分钟 = 48小时

### 定时任务执行
- 每5分钟检查一次过期订单
- 按订单模式分别处理，提高效率
- 每次处理最多50个订单（每种模式）

### 数据库查询优化
```sql
SELECT o.id, o.order_number, o.created_at, o.user_id, o.mode
FROM orders o
WHERE o.status = $1 
AND o.mode = $2
AND o.created_at < NOW() - INTERVAL '${expiryMinutes} minutes'
AND NOT EXISTS (
  SELECT 1 FROM order_payment_records opr 
  WHERE opr.order_id = o.id 
  AND opr.status IN ('success', 'pending')
)
ORDER BY o.created_at ASC
LIMIT 50
```

## 影响范围
1. **后端服务**: 定时任务逻辑更新
2. **数据库**: 平台设置表数据更新
3. **类型定义**: 所有子模块的类型定义同步更新
4. **测试环境**: 测试数据配置更新

## 部署注意事项
1. 需要运行数据库迁移脚本
2. 定时任务会自动重启以应用新配置
3. 所有子模块的类型定义已同步更新
4. 建议在测试环境验证后再部署到生产环境

## 验证方法
1. 检查平台设置是否正确加载新的过期时间配置
2. 创建不同模式的测试订单，验证过期逻辑
3. 查看定时任务日志，确认按模式分别处理
4. 验证库存释放逻辑正常工作
