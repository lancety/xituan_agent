# 支付系统设计方案

## 📋 项目概述

本方案设计了一个支持多种支付方式的完整支付系统，包括实时支付（微信支付）、非实时支付（现金、银行转账）以及网页支付（Apple Pay、Google Pay、Mastercard）。系统采用支付状态与订单状态分离的设计，确保业务逻辑清晰、扩展性强。

### 核心设计理念
- 🎯 **支付状态独立**: 支付确认状态与订单状态分离管理
- 🏦 **智能匹配机制**: 银行转账自动匹配订单
- 🛡️ **安全权限控制**: 现金支付权限管理
- ⚡ **自动化处理**: Webhook自动处理支付确认
- 🔄 **人工处理兜底**: 复杂情况支持人工干预

### 核心特性
- ✅ 多种支付方式支持（微信、现金、银行转账、网页支付）
- ✅ 支付状态与订单状态分离
- ✅ 银行转账智能匹配和人工处理
- ✅ 现金支付权限控制
- ✅ 完整的支付记录追踪
- ✅ Webhook事件处理
- ✅ 人工处理机制

---

## 🏗️ 系统架构

### 支付方式分类

#### 用户支付方式选择（前端显示）
```typescript
export enum epUserPaymentMethod {
  WECHAT = 'WECHAT',           // 微信支付
  CASH = 'CASH',               // 现金支付
  BANK_TRANSFER = 'BANK_TRANSFER' // 银行转账
}
```

#### 支付记录通道（后端处理）
```typescript
export enum epPaymentRecordMethod {
  // 实时支付通道
  AIRWALLEX_WECHAT = 'AIRWALLEX_WECHAT',
  AIRWALLEX_APPLE_PAY = 'AIRWALLEX_APPLE_PAY',
  AIRWALLEX_GOOGLE_PAY = 'AIRWALLEX_GOOGLE_PAY',
  AIRWALLEX_MASTERCARD = 'AIRWALLEX_MASTERCARD',
  
  // 银行转账通道
  AIRWALLEX_BANK_TRANSFER = 'AIRWALLEX_BANK_TRANSFER',
  
  // 手动确认通道
  MANUAL_CASH = 'MANUAL_CASH',
  MANUAL_BANK_TRANSFER = 'MANUAL_BANK_TRANSFER',
  MANUAL_OTHER = 'MANUAL_OTHER'
}
```

### 数据库设计

#### 支付记录表扩展
```sql
-- payment_records 表新增字段
ALTER TABLE payment_records ADD COLUMN needs_manual_review BOOLEAN DEFAULT FALSE;
ALTER TABLE payment_records ADD COLUMN manual_review_reason VARCHAR(500);
ALTER TABLE payment_records ADD COLUMN webhook_event_data JSONB; -- 保存完整的webhook事件数据
```

#### 用户现金支付权限表
```sql
CREATE TABLE user_cash_payment_permissions (
  user_id VARCHAR(255) PRIMARY KEY,
  allow_cash BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

---

## 💳 支付流程设计

### 1. 微信支付流程
```
用户下单 → 选择微信支付 → 创建Airwallex Payment Intent → 微信支付 → Webhook确认 → 支付状态更新
```

### 2. 现金支付流程
```
用户下单 → 选择现金支付 → 检查权限 → 订单创建 → 配送员确认收款 → 支付状态更新
```

### 3. 银行转账流程
```
用户下单 → 选择银行转账 → 生成6位参考号 → 用户转账 → Webhook接收 → 智能匹配订单 → 自动/人工处理
```

### 4. 网页支付流程
```
用户下单 → 选择网页支付 → 跳转支付页面 → 完成支付 → Webhook确认 → 支付状态更新
```

---

## 🏦 银行转账智能匹配

### 匹配策略
1. **优先匹配**: 使用6位数字参考号匹配最近7天的订单
2. **备用匹配**: 使用金额+日期精确匹配
3. **人工处理**: 无法匹配时标记为需要人工处理

### 匹配逻辑
```typescript
interface iOrderMatchResult {
  orderId: string | null;
  matchMethod: 'reference' | 'amount_date' | 'none';
  confidence: 'high' | 'medium' | 'low';
  needsManualReview: boolean;
  reason?: string;
}
```

### 处理流程
1. 接收 `deposit.settled` webhook事件
2. 提取参考号、金额、日期信息
3. 执行智能匹配算法
4. 成功匹配：自动更新支付状态
5. 无法匹配：标记为需要人工处理

### 支付方式与过期时间管理
系统根据支付方式自动设置不同的过期时间，并在支付方式变更时同步更新库存锁定：

**过期时间规则**：
- **现金支付**：30天（1个月）- 受信任客户，给予充足时间
- **银行转账**：48小时 - 固定时间，便于资金到账确认
- **微信支付**：根据订单模式确定（常规12小时，特价30分钟，预售48小时）

**支付方式变更处理**：
当用户修改订单支付方式时，系统会：
1. 更新订单的支付方式字段
2. 重新计算过期时间
3. 更新所有相关库存锁定的 `expires_at` 时间
4. 确保库存管理的一致性

---

## 🔐 现金支付权限控制

### 权限获取条件
1. **后台手动授权**: 管理员直接授权用户
2. **历史订单达标**: 累计订单数≥3单 或 累计金额≥150澳币

### 权限检查逻辑
```typescript
async function checkAndUpdateCashPaymentPermission(userId: string): Promise<boolean> {
  // 1. 检查权限表
  const permission = await getUserCashPermission(userId);
  if (permission?.allow_cash) {
    return true;
  }
  
  // 2. 检查历史订单
  const orderStats = await getOrderStats(userId);
  const hasEnoughOrders = orderStats.totalOrders >= 3;
  const hasEnoughAmount = orderStats.totalAmount >= 150;
  
  if (hasEnoughOrders || hasEnoughAmount) {
    // 3. 自动授权
    await grantCashPaymentPermission(userId);
    return true;
  }
  
  return false;
}
```

---

## 🔗 Webhook事件处理

### 架构设计
系统采用**分层Webhook处理架构**，将不同类型的支付事件分离处理：

```
WebhookAirwallexService (主服务)
├── WebhookAirwallexPaymentService (处理 payment_intent.* 和 deposit.* 事件)
├── WebhookAirwallexRefundService (处理退款事件 - 待实现)
└── PaymentHandlerService (统一支付处理逻辑)
    ├── OrderService (订单操作)
    ├── InventoryManagementService (库存管理)
    └── PaymentLockService (支付锁定评估)
```

**架构优势**:
- 🎯 **关注点分离**: 每个服务职责单一
- 🔄 **代码复用**: 统一支付处理逻辑
- 🛡️ **错误处理**: 改进的错误处理和日志记录
- 📦 **模块化**: 易于维护和扩展

### 事件分类
- **支付事件**: `payment_intent.*` 和 `deposit.*` → `WebhookAirwallexPaymentService`
- **退款事件**: `refund.*` → `WebhookAirwallexRefundService` (待实现)

### 处理流程
```typescript
// WebhookAirwallexService.handleWebhookEvent()
async handleWebhookEvent(payload: any) {
  const { name: event_type } = payload;
  
  switch (event_type) {
    // 支付事件 - 统一处理
    case 'payment_intent.succeeded':
    case 'payment_intent.failed':
    case 'payment_intent.cancelled':
    case 'payment_intent.pending':
    case 'deposit.settled':
    case 'deposit.pending':
    case 'deposit.rejected':
    case 'deposit.reversed':
      await this.getWebhookPaymentService().handlePaymentEvent(payload);
      break;
    
    // 退款事件 - 待实现
    case 'refund.succeeded':
    case 'refund.failed':
      console.log('退款事件处理待实现:', event_type);
      break;
  }
}
```

### 统一支付处理
所有支付事件都通过 `PaymentHandlerService` 统一处理：
```typescript
// 统一的支付处理接口
PaymentHandlerService.handlePayment(context, status)
├── handlePaymentSuccess()    // 成功: 更新订单状态 + 确认库存
├── handlePaymentFailure()    // 失败: 记录失败 + 锁定评估
├── handlePaymentCancellation() // 取消: 记录取消 + 锁定评估
├── handlePaymentReversal()   // 撤销: 记录撤销
└── handlePaymentPending()    // 待处理: 记录待处理状态
```

### 关键事件处理
- `deposit.settled`: 银行转账到账 → 智能匹配订单 → 自动/人工处理
- `deposit.rejected`: 银行转账被拒绝 → 记录失败状态
- `payment_intent.succeeded`: 移动支付成功 → 更新支付状态 → 更新库存
- `payment_intent.failed`: 移动支付失败 → 记录失败状态
- `payment_intent.cancelled`: 移动支付取消 → 记录取消状态 → 处理锁定评估
- `payment_intent.pending`: 移动支付待处理 → 记录待处理状态

---

## 🛠️ 人工处理机制

### 需要人工处理的情况
1. 银行转账无法匹配到订单
2. 匹配到多个相同金额的订单
3. 支付处理失败
4. 异常情况

### 人工处理操作
1. **分配订单**: 将支付记录关联到具体订单
2. **拒绝支付**: 标记支付为失败
3. **处理退款**: 执行退款操作

### 处理界面
- 支付记录列表（筛选需要人工处理的记录）
- 支付详情页面（显示webhook事件数据）
- 订单匹配界面（手动分配订单）

---

## 📱 前端界面设计

### 支付方式选择
- 微信支付：直接调用现有流程
- 现金支付：显示支付说明页面
- 银行转账：显示银行信息和参考号
- 网页支付：跳转到支付页面

### 支付状态显示
- 根据支付方式显示不同内容
- 现金支付：显示"等待配送员确认收款"
- 银行转账：显示"等待管理员确认到账"
- 实时支付：显示具体支付方式

### 环境控制
- 开发环境：显示所有支付方式
- 生产环境：仅显示现金和银行转账

---

## 🔧 实施计划

### 阶段一：数据库和类型定义
1. 更新支付记录表结构（添加人工处理字段）
2. 创建用户权限表
3. 统一支付方式枚举定义

### 阶段二：后端核心功能 ✅ 已完成
1. ✅ 实现银行转账智能匹配逻辑 (`WebhookAirwallexPaymentService`)
2. ✅ 实现现金支付权限控制 (`CashPaymentPermissionService`)
3. ✅ 重构Webhook事件处理 (新架构：`WebhookAirwallexService` + `WebhookAirwallexPaymentService` + `PaymentHandlerService`)
4. ✅ 实现支付状态与订单状态分离
5. ✅ 完善人工处理机制
6. ✅ 统一支付处理逻辑 (`PaymentHandlerService`)
7. ✅ 改进错误处理和日志记录
8. ✅ 支付锁定评估机制

### 阶段三：前端界面
1. 更新支付方式选择组件
2. 创建支付信息页面
3. 实现环境控制

### 阶段四：管理后台
1. 创建人工处理界面
2. 实现支付记录管理
3. 添加权限管理功能
4. 完善通知机制

---

## 🧪 测试策略

### 单元测试
- 支付匹配算法测试
- 权限控制逻辑测试
- Webhook事件处理测试

### 集成测试
- 完整支付流程测试
- 银行转账匹配测试
- 人工处理流程测试

### 用户验收测试
- 各种支付方式流程测试
- 异常情况处理测试
- 界面交互测试
- 权限控制测试

---

## 🔍 安全考虑

### 支付安全
- 支付凭证加密存储
- 操作日志完整记录
- 权限控制严格

### 数据安全
- 敏感信息脱敏显示
- 操作审计追踪
- 异常操作告警

### 业务安全
- 防重复确认机制
- 金额校验严格
- 超时自动处理

---

## 📊 监控和告警

### 关键指标
- 支付成功率
- 银行转账匹配率
- 人工处理及时性

### 告警机制
- 支付失败率过高
- 银行转账匹配失败
- 人工处理积压
- 系统异常

---

## 🎯 总结

本支付系统设计方案具有以下优势：

### 1. 灵活性 ⭐⭐⭐⭐⭐
- 支持多种支付方式
- 支付状态与订单状态分离
- 智能匹配和人工处理结合

### 2. 智能化 ⭐⭐⭐⭐⭐
- 银行转账自动匹配
- 现金支付权限自动管理
- Webhook自动处理

### 3. 可靠性 ⭐⭐⭐⭐⭐
- 完整的错误处理机制
- 人工处理兜底方案
- 完整的审计追踪

### 4. 可扩展性 ⭐⭐⭐⭐⭐
- 易于添加新的支付方式
- 支持新的业务规则
- 模块化设计

### 5. 用户体验 ⭐⭐⭐⭐⭐
- 清晰的支付流程
- 及时的状态反馈
- 友好的错误提示

---

*最后更新: 2025-01-25*
*版本: 2.0.0*
*状态: 架构重构完成，所有测试通过，前端界面待实施*
*架构: 统一支付处理 + 分层Webhook处理 + 支付状态分离 + 智能匹配 + 权限控制*

## 📚 相关文件

### 后端核心文件
- `src/domains/payment/services/webhook-airwallex.service.ts` - Webhook入口和分发
- `src/domains/payment/services/webhook-airwallex-payment.service.ts` - 支付事件处理
- `src/domains/payment/services/webhook-airwallex-refund.service.ts` - 退款事件处理 (待实现)
- `src/domains/payment/services/payment.handler.service.ts` - 统一支付处理逻辑
- `src/domains/payment/services/payment-business.service.ts` - 支付业务逻辑服务
- `src/domains/payment/services/cash-payment-permission.service.ts` - 现金支付权限服务
- `src/domains/payment/services/bank-transfer-matching.service.ts` - 银行转账匹配服务
- `src/domains/payment/services/payment-lock.service.ts` - 支付锁定评估服务
- `src/domains/order/services/order.service.ts` - 订单服务 (支付状态更新)