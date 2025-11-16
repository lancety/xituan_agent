# 验证服务测试文档

## 概述

本文档描述了为后端验证服务创建的单元测试和集成测试。这些测试覆盖了购物车和订单创建过程中的各种验证逻辑，包括常规模式、预购模式和团购模式的验证。

## 测试结构

### 单元测试

#### 1. PreorderProductValidationService 单元测试
**文件**: `tests/unit/validation/preorder-product-validation.service.unit.test.ts`

**测试覆盖**:
- ✅ 成功验证有效的预购产品
- ✅ 产品不存在错误处理
- ✅ 产品不支持预购错误处理
- ✅ 预购库存不足错误处理
- ✅ 无限制库存预购产品验证
- ✅ 边界库存情况处理

#### 2. OfferProductValidationService 单元测试
**文件**: `tests/unit/validation/offer-product-validation.service.unit.test.ts`

**测试覆盖**:
- ✅ 成功验证有效的团购产品
- ✅ 团购产品不存在错误处理
- ✅ 团购活动未激活错误处理
- ✅ 团购活动未发布错误处理
- ✅ 团购活动时间无效错误处理
- ✅ 团购产品未激活错误处理
- ✅ 团购产品库存不足错误处理
- ✅ 无限制库存团购产品验证

### 集成测试

#### 1. 购物车验证集成测试
**文件**: `tests/integration/cart/cart-validation.integration.test.ts`

**测试覆盖**:

**常规模式验证**:
- ✅ 成功添加常规模式商品到购物车
- ✅ 常规模式库存不足错误处理
- ✅ 成功更新现有购物车项数量

**预购模式验证**:
- ✅ 成功添加预购模式商品到购物车
- ✅ 产品不支持预购错误处理
- ✅ 预购库存不足错误处理

**团购模式验证**:
- ✅ 成功添加团购模式商品到购物车
- ✅ 团购产品无效错误处理
- ✅ 团购产品库存不足错误处理

**数量更新验证**:
- ✅ 成功更新常规模式购物车项数量
- ✅ 常规模式库存不足错误处理
- ✅ 成功更新预购模式购物车项数量
- ✅ 预购模式库存不足错误处理

**库存可用性检查**:
- ✅ 正确检查常规模式库存可用性
- ✅ 检测常规模式库存不足
- ✅ 正确检查预购模式库存可用性
- ✅ 检测预购模式库存不足

#### 2. 订单验证集成测试
**文件**: `tests/integration/order/order-validation.integration.test.ts`

**测试覆盖**:

**常规模式订单创建**:
- ✅ 成功创建常规模式订单
- ✅ 常规模式库存不足错误处理

**预购模式订单创建**:
- ✅ 成功创建预购模式订单
- ✅ 产品不支持预购错误处理
- ✅ 预购库存不足错误处理

**团购模式订单创建**:
- ✅ 成功创建团购模式订单
- ✅ 团购产品无效错误处理
- ✅ 团购产品库存不足错误处理

**混合模式订单创建**:
- ✅ 成功创建包含多种模式的订单

## 测试数据管理

### 测试助手类 (TestHelper)

测试使用 `TestHelper` 类来管理测试数据：

- **createTestUser()**: 创建测试用户
- **createTestProduct()**: 创建测试产品
- **createTestOrder()**: 创建测试订单
- **createTestOrderItem()**: 创建测试订单项
- **cleanupTestData()**: 清理测试数据

### 数据库清理

每个测试前后都会清理相关数据，确保测试的独立性：

```typescript
beforeEach(async () => {
  await TestHelper.cleanupTestData();
});
```

## 运行测试

### 运行所有验证相关测试

```bash
# 运行所有验证测试
npm run test:validation

# 运行验证单元测试
npm run test:validation:unit

# 运行验证集成测试
npm run test:validation:integration
```

### 运行特定测试

```bash
# 运行购物车测试
npm run test:cart

# 运行订单测试
npm run test:order

# 运行预购验证测试
npm run test -- --testNamePattern="PreorderProductValidationService"

# 运行团购验证测试
npm run test -- --testNamePattern="OfferProductValidationService"
```

### 运行测试并生成覆盖率报告

```bash
# 生成覆盖率报告
npm run test:coverage

# CI环境运行
npm run test:ci
```

## 测试环境配置

### 环境变量

测试使用 `.env.test` 文件配置测试数据库：

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=password
DB_TEST_DATABASE=xituan_test
```

### 数据库设置

测试环境使用独立的测试数据库，确保不会影响开发或生产数据。

## 测试覆盖的业务场景

### 1. 常规模式验证
- 产品存在性检查
- 产品库存检查
- 购物车项数量更新
- 订单创建时的库存验证

### 2. 预购模式验证
- 产品是否支持预购
- 预购产品库存检查
- 预购订单创建验证
- 预购数据完整性检查

### 3. 团购模式验证
- 团购活动有效性检查
- 团购产品关联性检查
- 团购产品库存检查
- 团购时间有效性检查

### 4. 混合模式验证
- 多种模式商品的购物车管理
- 混合模式订单创建
- 不同模式的库存独立验证

## 错误处理测试

### 业务错误代码测试

测试覆盖了所有相关的业务错误代码：

- `PRODUCT_NOT_FOUND`: 产品不存在
- `PRODUCT_NOT_PREORDERABLE`: 产品不支持预购
- `OFFER_PRODUCT_INVALID`: 团购产品无效
- `PRODUCT_STOCK_INSUFFICIENT`: 产品库存不足（统一使用）

### 边界条件测试

- 库存为0的情况
- 库存为-1（无限制）的情况
- 边界数量（刚好等于库存）的情况
- 超过库存的情况

## 性能考虑

### 测试数据量
- 每个测试使用最小必要的数据集
- 测试数据在测试结束后自动清理
- 避免创建大量不必要的测试数据

### 数据库连接
- 测试使用共享的数据库连接
- 测试间数据隔离
- 避免数据库连接泄漏

## 持续集成

### 测试自动化
- 所有测试在CI环境中自动运行
- 测试失败会阻止部署
- 覆盖率报告自动生成

### 测试报告
- 详细的测试结果报告
- 覆盖率统计
- 失败的测试详情

## 维护指南

### 添加新测试
1. 在相应的测试文件中添加新的测试用例
2. 确保测试覆盖新的业务逻辑
3. 更新测试文档

### 修改现有测试
1. 确保修改不会破坏现有功能
2. 更新相关的测试文档
3. 验证测试仍然有效

### 测试数据管理
1. 使用 `TestHelper` 创建测试数据
2. 确保测试数据的唯一性
3. 及时清理测试数据

## 故障排除

### 常见问题

1. **数据库连接失败**
   - 检查 `.env.test` 配置
   - 确保测试数据库存在
   - 验证数据库权限

2. **测试数据冲突**
   - 检查测试数据清理逻辑
   - 确保测试间数据隔离
   - 验证测试数据唯一性

3. **测试超时**
   - 检查数据库查询性能
   - 优化测试数据量
   - 调整测试超时设置

### 调试技巧

1. **启用详细日志**
   ```bash
   npm run test:verbose
   ```

2. **调试模式运行**
   ```bash
   npm run test:debug
   ```

3. **运行单个测试**
   ```bash
   npm test -- --testNamePattern="specific test name"
   ```

## 总结

这些测试提供了全面的验证服务覆盖，确保购物车和订单创建过程中的各种验证逻辑都能正确工作。测试涵盖了正常情况、错误情况和边界条件，为系统的稳定性和可靠性提供了保障。


## 概述

本文档描述了为后端验证服务创建的单元测试和集成测试。这些测试覆盖了购物车和订单创建过程中的各种验证逻辑，包括常规模式、预购模式和团购模式的验证。

## 测试结构

### 单元测试

#### 1. PreorderProductValidationService 单元测试
**文件**: `tests/unit/validation/preorder-product-validation.service.unit.test.ts`

**测试覆盖**:
- ✅ 成功验证有效的预购产品
- ✅ 产品不存在错误处理
- ✅ 产品不支持预购错误处理
- ✅ 预购库存不足错误处理
- ✅ 无限制库存预购产品验证
- ✅ 边界库存情况处理

#### 2. OfferProductValidationService 单元测试
**文件**: `tests/unit/validation/offer-product-validation.service.unit.test.ts`

**测试覆盖**:
- ✅ 成功验证有效的团购产品
- ✅ 团购产品不存在错误处理
- ✅ 团购活动未激活错误处理
- ✅ 团购活动未发布错误处理
- ✅ 团购活动时间无效错误处理
- ✅ 团购产品未激活错误处理
- ✅ 团购产品库存不足错误处理
- ✅ 无限制库存团购产品验证

### 集成测试

#### 1. 购物车验证集成测试
**文件**: `tests/integration/cart/cart-validation.integration.test.ts`

**测试覆盖**:

**常规模式验证**:
- ✅ 成功添加常规模式商品到购物车
- ✅ 常规模式库存不足错误处理
- ✅ 成功更新现有购物车项数量

**预购模式验证**:
- ✅ 成功添加预购模式商品到购物车
- ✅ 产品不支持预购错误处理
- ✅ 预购库存不足错误处理

**团购模式验证**:
- ✅ 成功添加团购模式商品到购物车
- ✅ 团购产品无效错误处理
- ✅ 团购产品库存不足错误处理

**数量更新验证**:
- ✅ 成功更新常规模式购物车项数量
- ✅ 常规模式库存不足错误处理
- ✅ 成功更新预购模式购物车项数量
- ✅ 预购模式库存不足错误处理

**库存可用性检查**:
- ✅ 正确检查常规模式库存可用性
- ✅ 检测常规模式库存不足
- ✅ 正确检查预购模式库存可用性
- ✅ 检测预购模式库存不足

#### 2. 订单验证集成测试
**文件**: `tests/integration/order/order-validation.integration.test.ts`

**测试覆盖**:

**常规模式订单创建**:
- ✅ 成功创建常规模式订单
- ✅ 常规模式库存不足错误处理

**预购模式订单创建**:
- ✅ 成功创建预购模式订单
- ✅ 产品不支持预购错误处理
- ✅ 预购库存不足错误处理

**团购模式订单创建**:
- ✅ 成功创建团购模式订单
- ✅ 团购产品无效错误处理
- ✅ 团购产品库存不足错误处理

**混合模式订单创建**:
- ✅ 成功创建包含多种模式的订单

## 测试数据管理

### 测试助手类 (TestHelper)

测试使用 `TestHelper` 类来管理测试数据：

- **createTestUser()**: 创建测试用户
- **createTestProduct()**: 创建测试产品
- **createTestOrder()**: 创建测试订单
- **createTestOrderItem()**: 创建测试订单项
- **cleanupTestData()**: 清理测试数据

### 数据库清理

每个测试前后都会清理相关数据，确保测试的独立性：

```typescript
beforeEach(async () => {
  await TestHelper.cleanupTestData();
});
```

## 运行测试

### 运行所有验证相关测试

```bash
# 运行所有验证测试
npm run test:validation

# 运行验证单元测试
npm run test:validation:unit

# 运行验证集成测试
npm run test:validation:integration
```

### 运行特定测试

```bash
# 运行购物车测试
npm run test:cart

# 运行订单测试
npm run test:order

# 运行预购验证测试
npm run test -- --testNamePattern="PreorderProductValidationService"

# 运行团购验证测试
npm run test -- --testNamePattern="OfferProductValidationService"
```

### 运行测试并生成覆盖率报告

```bash
# 生成覆盖率报告
npm run test:coverage

# CI环境运行
npm run test:ci
```

## 测试环境配置

### 环境变量

测试使用 `.env.test` 文件配置测试数据库：

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=password
DB_TEST_DATABASE=xituan_test
```

### 数据库设置

测试环境使用独立的测试数据库，确保不会影响开发或生产数据。

## 测试覆盖的业务场景

### 1. 常规模式验证
- 产品存在性检查
- 产品库存检查
- 购物车项数量更新
- 订单创建时的库存验证

### 2. 预购模式验证
- 产品是否支持预购
- 预购产品库存检查
- 预购订单创建验证
- 预购数据完整性检查

### 3. 团购模式验证
- 团购活动有效性检查
- 团购产品关联性检查
- 团购产品库存检查
- 团购时间有效性检查

### 4. 混合模式验证
- 多种模式商品的购物车管理
- 混合模式订单创建
- 不同模式的库存独立验证

## 错误处理测试

### 业务错误代码测试

测试覆盖了所有相关的业务错误代码：

- `PRODUCT_NOT_FOUND`: 产品不存在
- `PRODUCT_NOT_PREORDERABLE`: 产品不支持预购
- `OFFER_PRODUCT_INVALID`: 团购产品无效
- `PRODUCT_STOCK_INSUFFICIENT`: 产品库存不足（统一使用）

### 边界条件测试

- 库存为0的情况
- 库存为-1（无限制）的情况
- 边界数量（刚好等于库存）的情况
- 超过库存的情况

## 性能考虑

### 测试数据量
- 每个测试使用最小必要的数据集
- 测试数据在测试结束后自动清理
- 避免创建大量不必要的测试数据

### 数据库连接
- 测试使用共享的数据库连接
- 测试间数据隔离
- 避免数据库连接泄漏

## 持续集成

### 测试自动化
- 所有测试在CI环境中自动运行
- 测试失败会阻止部署
- 覆盖率报告自动生成

### 测试报告
- 详细的测试结果报告
- 覆盖率统计
- 失败的测试详情

## 维护指南

### 添加新测试
1. 在相应的测试文件中添加新的测试用例
2. 确保测试覆盖新的业务逻辑
3. 更新测试文档

### 修改现有测试
1. 确保修改不会破坏现有功能
2. 更新相关的测试文档
3. 验证测试仍然有效

### 测试数据管理
1. 使用 `TestHelper` 创建测试数据
2. 确保测试数据的唯一性
3. 及时清理测试数据

## 故障排除

### 常见问题

1. **数据库连接失败**
   - 检查 `.env.test` 配置
   - 确保测试数据库存在
   - 验证数据库权限

2. **测试数据冲突**
   - 检查测试数据清理逻辑
   - 确保测试间数据隔离
   - 验证测试数据唯一性

3. **测试超时**
   - 检查数据库查询性能
   - 优化测试数据量
   - 调整测试超时设置

### 调试技巧

1. **启用详细日志**
   ```bash
   npm run test:verbose
   ```

2. **调试模式运行**
   ```bash
   npm run test:debug
   ```

3. **运行单个测试**
   ```bash
   npm test -- --testNamePattern="specific test name"
   ```

## 总结

这些测试提供了全面的验证服务覆盖，确保购物车和订单创建过程中的各种验证逻辑都能正确工作。测试涵盖了正常情况、错误情况和边界条件，为系统的稳定性和可靠性提供了保障。
