# 支付过期阈值测试文档

## 概述

本文档描述了针对新增的支付过期阈值配置功能的测试用例。该功能允许管理员通过CMS界面动态配置现金和银行转账的过期时间。

## 新增的配置属性

### 现金过期阈值 (cashExpirationMinutes)
- **默认值**: 40320 分钟（28天）
- **用途**: 现金支付订单的过期时间
- **单位**: 分钟

### 银行转账过期阈值 (bankTransferExpirationMinutes)
- **默认值**: 2880 分钟（48小时）
- **用途**: 银行转账支付订单的过期时间
- **单位**: 分钟

## 测试文件

### 1. 单元测试

#### `tests/unit/order/order-expiry.service.unit.test.ts`
- **用途**: 测试 `OrderExpiryService` 的支付过期阈值功能
- **测试场景**:
  - ✅ 从平台设置获取现金过期阈值
  - ✅ 从平台设置获取银行转账过期阈值
  - ✅ 平台设置不可用时的回退机制
  - ✅ 使用自定义的平台设置值

**关键测试点**:
```typescript
// 测试现金订单使用平台配置
const minutes = expiryService.calculateExpiryOffsetMinutes(cashOrder);
expect(minutes).toBe(28 * 24 * 60); // 28天

// 测试银行转账使用平台配置
const minutes = expiryService.calculateExpiryOffsetMinutes(bankTransferOrder);
expect(minutes).toBe(48 * 60); // 48小时
```

### 2. 集成测试

#### `tests/integration/commitment-payment/inventory-cron.integration.test.ts`
- **用途**: 测试承诺支付过期处理功能
- **更新内容**:
  - ✅ 在 `beforeEach` 中初始化平台设置
  - ✅ 更新测试用例注释，说明使用动态配置
  - ✅ 新增自定义过期阈值测试用例

**新增测试场景**:
1. **测试自定义银行转账过期阈值**
   - 设置72小时过期阈值
   - 创建2小时前的订单
   - 验证订单未过期

2. **测试自定义现金过期阈值**
   - 设置24小时过期阈值
   - 创建2天前的订单
   - 验证订单已过期

#### `tests/integration/platform-setting/platform-setting.integration.test.ts`
- **用途**: 测试平台设置服务的持久化和读取
- **测试场景**:
  - ✅ 读取订单设置中的过期阈值
  - ✅ 更新并读取自定义过期阈值
  - ✅ 缺失过期阈值的优雅处理
  - ✅ 过期阈值的持久化验证

**关键测试点**:
```typescript
// 验证过期阈值存在
expect(orderSettings).toHaveProperty('cashExpirationMinutes');
expect(orderSettings).toHaveProperty('bankTransferExpirationMinutes');

// 验证默认值
expect(orderSettings.cashExpirationMinutes).toBe(40320); // 28天
expect(orderSettings.bankTransferExpirationMinutes).toBe(2880); // 48小时
```

## 运行测试

### 运行所有支付过期阈值相关测试
```bash
npm test -- payment-expiration
```

### 运行单元测试
```bash
npm test -- tests/unit/order/order-expiry.service.unit.test.ts
```

### 运行集成测试
```bash
npm test -- tests/integration/commitment-payment/inventory-cron.integration.test.ts
npm test -- tests/integration/platform-setting/platform-setting.integration.test.ts
```

### 运行特定测试套件
```bash
# 测试自定义过期阈值
npm test -- "handleCommittedPaymentExpired with custom expiration thresholds"

# 测试过期计算服务
npm test -- "calculateExpiryOffsetMinutes"
```

## 测试数据准备

测试使用以下默认配置:
```json
{
  "pendingPayExpMinutes_regular": 720,
  "pendingPayExpMinutes_offer": 30,
  "pendingPayExpMinutes_preorder": 2880,
  "cancelLock": 3,
  "cancelLockSum": 5,
  "cashExpirationMinutes": 40320,
  "bankTransferExpirationMinutes": 2880
}
```

## 测试覆盖率

### 覆盖的功能点
- ✅ 平台设置读取
- ✅ 自定义过期阈值配置
- ✅ 默认值回退机制
- ✅ 现金支付过期处理
- ✅ 银行转账过期处理
- ✅ 设置持久化

### 未覆盖的边界情况
- 极端过期阈值值（负数、0、超大值）
- 并发更新平台设置
- 数据库连接失败时的处理

## 注意事项

1. **数据库依赖**: 集成测试需要真实的数据库连接
2. **数据清理**: 测试会自动清理测试数据
3. **平台设置**: 测试会重置平台设置为默认值
4. **时间敏感**: 时间相关的测试需要注意系统时间

## 相关文件

- 服务文件:
  - `src/domains/inventory/services/inventory-cron.service.ts`
  - `src/domains/order/services/order-expiry.service.ts`
  - `src/domains/platform-setting/services/platform-setting.service.ts`

- 数据库迁移:
  - `migrations/1710000000177_add_payment_expiration_thresholds.sql`

- 类型定义:
  - `submodules/xituan_codebase/typing_entity/platform-setting.type.ts`

## 未来改进

1. 添加边界值测试
2. 添加并发测试
3. 添加压力测试
4. 添加性能测试
