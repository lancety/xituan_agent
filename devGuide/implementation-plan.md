# 订单和支付系统实施计划表

## 📋 项目概述

基于 `order-system.md` 和 `payment-system.md` 的设计方案，制定详细的实施计划，确保多支付方式支持和订单状态管理系统的顺利实现。

---

## 🎯 实施目标

### 主要目标
1. **多支付方式支持**: 实现微信支付、现金支付、银行转账、网页支付
2. **订单状态简化**: 简化订单状态枚举，支持跳过中间环节的状态转换
3. **支付状态分离**: 将支付状态与订单状态分离管理
4. **智能匹配机制**: 实现银行转账的智能匹配和人工处理
5. **权限控制**: 实现现金支付权限控制机制

### 技术目标
- 保持现有系统稳定性
- 确保数据一致性
- 提供完整的审计追踪
- 支持未来扩展

---

## 📅 实施时间线

| 阶段 | 时间 | 状态 | 主要任务 |
|------|------|------|----------|
| **阶段一** | 1-2周 | 🔄 进行中 | 数据库扩展和类型定义 |
| **阶段二** | 2-3周 | 📋 计划中 | 后端核心功能实现 |
| **阶段三** | 2-3周 | 📋 计划中 | 前端界面更新 |
| **阶段四** | 1-2周 | 📋 计划中 | 管理后台功能 |
| **阶段五** | 1周 | 📋 计划中 | 测试和部署 |

---

## 📊 当前项目状况评估

### ✅ 已完成的功能

#### 1. 类型定义和枚举
- **支付方式枚举**: `epPaymentMethod` 已定义，包含 WECHAT、CASH、BANK_TRANSFER 等
- **支付记录方法枚举**: `epPaymentRecordMethod` 已定义，包含各种 Airwallex 和手动支付方式
- **支付相关接口**: `iOrderPaymentRecord`、`iManualPaymentConfirmation` 等接口已定义

#### 2. 后端核心功能
- **手动支付确认**: `confirmManualPayment` API 已实现
- **支付记录管理**: `PaymentBusinessService` 已实现基础功能
- **权限管理**: 基于角色的权限控制已实现（ADMIN、SUPER_ADMIN）
- **订单状态管理**: `AdminOrderStatusController` 已实现基础功能

#### 3. 前端组件
- **支付方式选择组件**: `payment-method-selector` 组件已实现
- **环境控制逻辑**: 开发/生产环境支付方式控制已实现
- **订单页面集成**: 普通订单、团购订单、预约订单页面已集成支付方式选择

#### 4. 数据库和基础设施
- **权限系统**: 完整的权限管理中间件已实现
- **审计日志**: 订单状态转换历史、支付记录等已实现
- **PDF生成**: 合作伙伴发票系统已实现

### ❌ 未完成的功能

#### 1. 数据库扩展
- **orders表字段**: `payment_method`、`payment_status`、`payment_reference` 字段未添加
- **payment_records表字段**: `needs_manual_review`、`manual_review_reason`、`webhook_event_data` 字段未添加
- **用户现金权限表**: `user_cash_payment_permissions` 表未创建

#### 2. 订单状态简化
- **epOrderStatus枚举**: 仍使用旧的复杂状态，未简化为 PENDING、PROCESSING 等
- **状态转换规则**: `ORDER_STATUS_RULES` 未更新以支持跳过中间环节

#### 3. 核心业务逻辑
- **银行转账智能匹配**: 未实现 reference 匹配和金额日期匹配逻辑
- **现金支付权限控制**: 未实现基于历史订单的自动授权逻辑
- **过期检测和回退**: 未实现基于支付方式的灵活过期检测
- **Webhook处理**: 未实现 deposit.* 和 payment_intent.* 事件处理

#### 4. 前端页面
- **现金支付信息页面**: 未创建
- **银行转账信息页面**: 未创建
- **网页支付信息页面**: 未创建
- **订单状态显示更新**: 未更新以反映新的状态逻辑

#### 5. 管理后台
- **人工处理界面**: 未创建支付记录人工处理界面
- **支付记录管理**: 未创建支付记录列表和详情页面
- **通知机制**: 未实现支付相关通知

### 🔄 需要调整的功能

#### 1. 现有功能适配
- **支付方式选择组件**: 需要适配新的支付状态逻辑
- **订单状态显示**: 需要适配简化的状态枚举
- **手动支付确认**: 需要适配新的订单状态转换逻辑

---

## 🗂️ 详细实施计划

### 阶段一：数据库扩展和类型定义 (1-2周)

#### 1.1 数据库表结构更新
| 任务 | 优先级 | 预估时间 | 负责人 | 状态 |
|------|--------|----------|--------|------|
| 更新 `orders` 表添加支付字段 | 高 | 2小时 | 后端开发 | ❌ 未开始 |
| 更新 `payment_records` 表添加人工处理字段 | 高 | 2小时 | 后端开发 | ❌ 未开始 |
| 创建 `user_cash_payment_permissions` 表 | 高 | 1小时 | 后端开发 | ❌ 未开始 |
| 创建数据库迁移脚本 | 高 | 1小时 | 后端开发 | ❌ 未开始 |
| 测试数据库迁移 | 中 | 2小时 | 后端开发 | ❌ 未开始 |

**具体字段：**
```sql
-- orders 表新增字段
ALTER TABLE orders ADD COLUMN payment_method VARCHAR(50);
ALTER TABLE orders ADD COLUMN payment_status VARCHAR(50);
ALTER TABLE orders ADD COLUMN payment_reference VARCHAR(10);

-- payment_records 表新增字段
ALTER TABLE payment_records ADD COLUMN needs_manual_review BOOLEAN DEFAULT FALSE;
ALTER TABLE payment_records ADD COLUMN manual_review_reason VARCHAR(500);
ALTER TABLE payment_records ADD COLUMN webhook_event_data JSONB;

-- 新建用户现金支付权限表
CREATE TABLE user_cash_payment_permissions (
  user_id VARCHAR(255) PRIMARY KEY,
  allow_cash BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### 1.2 类型定义更新
| 任务 | 优先级 | 预估时间 | 负责人 | 状态 |
|------|--------|----------|--------|------|
| 更新 `epOrderStatus` 枚举 | 高 | 1小时 | 全栈开发 | ❌ 未开始 |
| 创建 `epUserPaymentMethod` 枚举 | 高 | 30分钟 | 全栈开发 | ✅ 已完成 |
| 创建 `epPaymentRecordMethod` 枚举 | 高 | 30分钟 | 全栈开发 | ✅ 已完成 |
| 更新 `ORDER_STATUS_RULES` 常量 | 高 | 1小时 | 全栈开发 | ❌ 未开始 |
| 创建支付相关接口类型 | 中 | 2小时 | 全栈开发 | ✅ 已完成 |

**关键类型定义：**
```typescript
// 简化的订单状态
export enum epOrderStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  READY_FOR_DELIVERY = 'ready_for_delivery',
  IN_DELIVERY = 'in_delivery',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  REFUNDED = 'refunded',
  DELETED = 'deleted'
}

// 用户支付方式选择
export enum epUserPaymentMethod {
  WECHAT = 'WECHAT',
  CASH = 'CASH',
  BANK_TRANSFER = 'BANK_TRANSFER'
}

// 支付记录通道
export enum epPaymentRecordMethod {
  AIRWALLEX_WECHAT = 'AIRWALLEX_WECHAT',
  AIRWALLEX_APPLE_PAY = 'AIRWALLEX_APPLE_PAY',
  AIRWALLEX_GOOGLE_PAY = 'AIRWALLEX_GOOGLE_PAY',
  AIRWALLEX_MASTERCARD = 'AIRWALLEX_MASTERCARD',
  AIRWALLEX_BANK_TRANSFER = 'AIRWALLEX_BANK_TRANSFER',
  MANUAL_CASH = 'MANUAL_CASH',
  MANUAL_BANK_TRANSFER = 'MANUAL_BANK_TRANSFER',
  MANUAL_OTHER = 'MANUAL_OTHER'
}
```

---

### 阶段二：后端核心功能实现 (2-3周)

#### 2.1 支付方式支持
| 任务 | 优先级 | 预估时间 | 负责人 | 状态 |
|------|--------|----------|--------|------|
| 实现银行转账智能匹配逻辑 | 高 | 1天 | 后端开发 | ❌ 未开始 |
| 实现现金支付权限控制 | 高 | 1天 | 后端开发 | ❌ 未开始 |
| 实现过期检测和回退机制 | 高 | 1天 | 后端开发 | ❌ 未开始 |
| 更新Webhook事件处理 | 高 | 1天 | 后端开发 | ❌ 未开始 |
| 实现支付状态分离逻辑 | 中 | 1天 | 后端开发 | ❌ 未开始 |

**核心功能实现：**

1. **银行转账智能匹配服务**
```typescript
class BankTransferMatchingService {
  async matchOrderByDepositReference(
    reference: string,
    amount: number,
    currency: string,
    depositDate: Date
  ): Promise<iOrderMatchResult> {
    // 1. 优先使用6位数字参考号匹配
    // 2. 备用方案：金额+日期精确匹配
    // 3. 无法匹配时标记为需要人工处理
  }
}
```

2. **现金支付权限控制服务**
```typescript
class CashPaymentPermissionService {
  async checkAndUpdateCashPaymentPermission(userId: string): Promise<boolean> {
    // 1. 检查权限表
    // 2. 检查历史订单（累计订单数≥3单 或 累计金额≥150澳币）
    // 3. 自动授权
  }
}
```

3. **过期检测和回退机制**
```typescript
class OrderExpiryService {
  async checkOrderExpiry(order: Order): Promise<iOrderExpiryCheck> {
    // 根据订单模式和支付方式计算过期时间
  }
  
  async handleExpiredOrderPayment(
    orderId: string,
    paymentData: any,
    context: 'webhook' | 'manual'
  ): Promise<void> {
    // 处理过期订单的支付回退
  }
}
```

#### 2.2 状态转换优化
| 任务 | 优先级 | 预估时间 | 负责人 | 状态 |
|------|--------|----------|--------|------|
| 更新状态转换规则引擎 | 高 | 1天 | 后端开发 | ❌ 未开始 |
| 实现跳过中间环节的状态转换 | 高 | 1天 | 后端开发 | ❌ 未开始 |
| 实现基于支付方式的过期检测 | 高 | 1天 | 后端开发 | ❌ 未开始 |
| 添加过期订单回退机制 | 中 | 1天 | 后端开发 | ❌ 未开始 |

#### 2.3 人工处理机制
| 任务 | 优先级 | 预估时间 | 负责人 | 状态 |
|------|--------|----------|--------|------|
| 实现人工处理API接口 | 高 | 1天 | 后端开发 | ✅ 已完成 |
| 实现支付记录管理功能 | 中 | 1天 | 后端开发 | ✅ 已完成 |
| 实现通知机制 | 中 | 1天 | 后端开发 | ❌ 未开始 |

---

### 阶段三：前端界面更新 (2-3周)

#### 3.1 微信小程序更新
| 任务 | 优先级 | 预估时间 | 负责人 | 状态 |
|------|--------|----------|--------|------|
| 创建支付方式选择组件 | 高 | 1天 | 前端开发 | ✅ 已完成 |
| 创建现金支付信息页面 | 高 | 1天 | 前端开发 | ❌ 未开始 |
| 创建银行转账信息页面 | 高 | 1天 | 前端开发 | ❌ 未开始 |
| 创建网页支付信息页面 | 中 | 1天 | 前端开发 | ❌ 未开始 |
| 更新订单状态显示逻辑 | 高 | 1天 | 前端开发 | ❌ 未开始 |
| 实现环境控制逻辑 | 中 | 0.5天 | 前端开发 | ✅ 已完成 |

**关键组件实现：**

1. **支付方式选择组件**
```typescript
// components/payment-method-selector/paymentMethodSelector.ts
Component({
  properties: {
    selectedMethod: { type: String, value: '' },
    disabled: { type: Boolean, value: false }
  },
  data: {
    paymentMethods: [
      { id: 'WECHAT', name: '微信支付', icon: '💳' },
      { id: 'CASH', name: '现金支付', icon: '💰' },
      { id: 'BANK_TRANSFER', name: '银行转账', icon: '🏦' }
    ]
  },
  methods: {
    initPaymentMethods() {
      // 根据环境控制显示哪些支付方式
    }
  }
});
```

2. **支付信息页面**
- 现金支付：显示支付说明和准备现金提示
- 银行转账：显示银行信息和6位参考号
- 网页支付：显示支付链接和二维码

#### 3.2 CMS管理后台更新
| 任务 | 优先级 | 预估时间 | 负责人 | 状态 |
|------|--------|----------|--------|------|
| 创建人工处理界面 | 高 | 2天 | 前端开发 | ❌ 未开始 |
| 实现支付记录管理 | 高 | 1天 | 前端开发 | ❌ 未开始 |
| 添加权限管理功能 | 中 | 1天 | 前端开发 | ✅ 已完成 |
| 完善通知机制界面 | 中 | 1天 | 前端开发 | ❌ 未开始 |

---

### 阶段四：管理后台功能 (1-2周)

#### 4.1 人工处理系统
| 任务 | 优先级 | 预估时间 | 负责人 | 状态 |
|------|--------|----------|--------|------|
| 创建支付记录列表页面 | 高 | 1天 | 前端开发 | ⏳ 待开始 |
| 实现支付记录筛选功能 | 高 | 0.5天 | 前端开发 | ⏳ 待开始 |
| 创建支付详情页面 | 高 | 1天 | 前端开发 | ⏳ 待开始 |
| 实现订单匹配界面 | 高 | 1天 | 前端开发 | ⏳ 待开始 |
| 实现支付记录操作功能 | 高 | 1天 | 前端开发 | ⏳ 待开始 |

#### 4.2 权限管理系统
| 任务 | 优先级 | 预估时间 | 负责人 | 状态 |
|------|--------|----------|--------|------|
| 创建用户权限管理页面 | 中 | 1天 | 前端开发 | ⏳ 待开始 |
| 实现权限授权功能 | 中 | 0.5天 | 前端开发 | ⏳ 待开始 |
| 实现权限历史记录 | 低 | 0.5天 | 前端开发 | ⏳ 待开始 |

---

### 阶段五：测试和部署 (1周)

#### 5.1 测试计划
| 任务 | 优先级 | 预估时间 | 负责人 | 状态 |
|------|--------|----------|--------|------|
| 单元测试编写 | 高 | 2天 | 全栈开发 | ⏳ 待开始 |
| 集成测试 | 高 | 1天 | 全栈开发 | ⏳ 待开始 |
| 用户验收测试 | 高 | 1天 | 全栈开发 | ⏳ 待开始 |
| 性能测试 | 中 | 1天 | 全栈开发 | ⏳ 待开始 |

#### 5.2 部署计划
| 任务 | 优先级 | 预估时间 | 负责人 | 状态 |
|------|--------|----------|--------|------|
| 数据库迁移部署 | 高 | 0.5天 | 运维 | ⏳ 待开始 |
| 后端服务部署 | 高 | 0.5天 | 运维 | ⏳ 待开始 |
| 前端应用部署 | 高 | 0.5天 | 运维 | ⏳ 待开始 |
| 功能验证 | 高 | 0.5天 | 全栈开发 | ⏳ 待开始 |

---

## 🔧 技术实施细节

### 数据库迁移策略
1. **向后兼容**: 确保现有功能不受影响
2. **分步迁移**: 先添加字段，再更新逻辑
3. **数据验证**: 确保数据完整性
4. **回滚计划**: 准备回滚方案

### API设计原则
1. **RESTful设计**: 遵循REST API设计原则
2. **版本控制**: 支持API版本管理
3. **错误处理**: 统一的错误响应格式
4. **文档完善**: 提供完整的API文档

### 前端架构
1. **组件化**: 可复用的支付组件
2. **状态管理**: 统一的状态管理方案
3. **错误处理**: 友好的错误提示
4. **性能优化**: 减少不必要的渲染

---

## 📊 风险评估和缓解措施

### 高风险项
| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| 数据库迁移失败 | 高 | 中 | 充分测试，准备回滚方案 |
| 支付流程中断 | 高 | 低 | 保持现有支付方式，逐步切换 |
| 性能影响 | 中 | 中 | 性能测试，优化查询 |
| 用户体验下降 | 中 | 低 | 充分测试，用户反馈 |

### 中风险项
| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| 开发时间超期 | 中 | 中 | 合理估算，预留缓冲时间 |
| 测试不充分 | 中 | 低 | 制定详细测试计划 |
| 文档不完善 | 低 | 中 | 同步更新文档 |

---

## 📈 成功指标

### 技术指标
- [ ] 所有API接口响应时间 < 500ms
- [ ] 数据库查询性能提升 20%
- [ ] 支付成功率 > 99%
- [ ] 系统可用性 > 99.9%

### 业务指标
- [ ] 支持4种支付方式
- [ ] 银行转账自动匹配率 > 80%
- [ ] 人工处理及时性 < 2小时
- [ ] 用户满意度 > 90%

### 质量指标
- [ ] 代码覆盖率 > 80%
- [ ] 单元测试通过率 100%
- [ ] 集成测试通过率 100%
- [ ] 安全漏洞 0个

---

## 📝 交付物清单

### 代码交付物
- [ ] 数据库迁移脚本
- [ ] 后端API服务
- [ ] 前端小程序组件
- [ ] CMS管理后台页面
- [ ] 单元测试代码
- [ ] 集成测试代码

### 文档交付物
- [ ] API接口文档
- [ ] 数据库设计文档
- [ ] 部署指南
- [ ] 用户操作手册
- [ ] 故障排除指南

### 配置交付物
- [ ] 环境配置
- [ ] 数据库配置
- [ ] 支付配置
- [ ] 监控配置

---

## 🎯 下一步行动

### 立即开始 (本周)
1. 创建数据库迁移脚本
2. 更新类型定义
3. 开始后端核心功能开发

### 短期目标 (2周内)
1. 完成数据库扩展
2. 实现基础支付功能
3. 开始前端界面开发

### 中期目标 (1个月内)
1. 完成所有核心功能
2. 完成前端界面
3. 开始测试阶段

### 长期目标 (2个月内)
1. 完成所有功能
2. 完成测试和部署
3. 正式上线运行

---

*最后更新: 2025-01-12*
*版本: 1.0.0*
*状态: 计划制定完成，待开始实施*
*预计完成时间: 6-8周*
