# 承诺支付机制设计方案

## 📋 概述

通过引入"承诺支付"状态，解决现金支付和银行转账的过期时间管理问题，同时简化库存锁定逻辑。

### 核心设计理念
- 🎯 **过渡状态**: 承诺支付是过渡状态，最终被实际支付覆盖
- 🛡️ **权限控制**: 承诺支付过期时禁用用户对应支付方式权限
- ⏰ **时间管理**: 现金支付2周，银行转账48小时
- 📊 **监控记录**: 完整的承诺支付监控和警报
- 🔄 **系统集成**: 与现有订单和支付系统无缝集成

### 解决的问题
1. **库存锁定复杂性**: 消除支付方式变更对库存锁定过期时间的影响
2. **业务逻辑简化**: 统一库存锁定过期时间计算逻辑
3. **用户体验优化**: 给用户更多时间完成现金和银行转账支付
4. **风险控制**: 通过权限管理防止承诺支付滥用

---

## 🏗️ 核心设计

### 1. 支付状态扩展

```typescript
// 扩展支付状态枚举
export enum epPaymentStatus {
  PENDING = 'pending',               // 待处理
  PROCESSING = 'processing',         // 处理中
  SUCCESS = 'success',              // 支付成功
  FAILED = 'failed',                // 支付失败
  CANCELLED = 'cancelled',          // 支付取消
  REFUNDED = 'refunded',            // 已退款
  PARTIALLY_REFUNDED = 'partially_refunded', // 部分退款
  COMMITTED = 'committed'           // 承诺支付（新增）
}
```

### 2. 用户权限扩展

```typescript
// 用户权限通过 user_permissions 表管理，前端通过API获取联合查询结果
// 在 typing_api 中定义包含权限的用户API返回类型
export interface iUserWithPermissions {
  // 用户基本信息（来自 users 表）
  id: string;
  username: string;
  email: string;
  nickname: string;
  // ... 其他用户字段
  
  // 权限信息（来自 user_permissions 表）
  allowCash: boolean;
  allowBankTransfer: boolean;
}
```

### 3. 订单过期逻辑简化

#### 简化的过期时间计算

```typescript
// 简化的过期时间计算
function calculateOrderExpiryMinutes(order: Order): number {
  // 只根据订单模式计算，忽略支付方式
  switch (order.mode) {
    case epOrderMode.REGULAR:
      return 2 * 60;    // 2小时
    case epOrderMode.OFFER:
      return 30;        // 30分钟
    case epOrderMode.PREORDER:
      return 24 * 60;   // 24小时
    default:
      return 2 * 60;   // 默认2小时
  }
}

// 简化的过期检查逻辑
async function checkOrderExpiry(order: Order): Promise<boolean> {
  // 承诺支付状态豁免过期检查
  if (order.paymentStatus === epPaymentStatus.COMMITTED) {
    return false;
  }
  
  // 其他状态按正常逻辑检查
  const expiryMinutes = calculateOrderExpiryMinutes(order);
  const expiryTime = new Date(order.createdAt.getTime() + expiryMinutes * 60 * 1000);
  
  return new Date() > expiryTime;
}
```

### 4. 承诺支付流程

#### 承诺支付随订单创建/更新自动设置

```typescript
// 承诺支付随订单创建自动设置
async function createOrder(orderData: CreateOrderDto): Promise<Order> {
  // ... 现有订单创建逻辑
  
  // 根据支付方式设置支付状态
  let paymentStatus = epPaymentStatus.PENDING;
  if (orderData.paymentMethod === epPaymentMethod.CASH || 
      orderData.paymentMethod === epPaymentMethod.BANK_TRANSFER) {
    paymentStatus = epPaymentStatus.COMMITTED;
  }
  
  const order = await this.orderRepository.save({
    ...orderData,
    paymentStatus,
    // ... 其他字段
  });
  
  return order;
}

// 承诺支付随支付方式更新自动设置
async function updateOrderPaymentMethod(orderId: string, paymentMethod: string): Promise<Order> {
  const order = await this.orderRepository.findOne({ where: { id: orderId } });
  
  if (!order) {
    throw new BusinessError('订单不存在');
  }
  
  // 根据新支付方式设置支付状态
  let paymentStatus = epPaymentStatus.PENDING;
  if (paymentMethod === epPaymentMethod.CASH || 
      paymentMethod === epPaymentMethod.BANK_TRANSFER) {
    paymentStatus = epPaymentStatus.COMMITTED;
  }
  
  await this.orderRepository.update(orderId, {
    paymentMethod,
    paymentStatus,
    updatedAt: new Date()
  });
  
  return await this.orderRepository.findOne({ where: { id: orderId } });
}
```

### 5. 承诺支付过期检查

#### 承诺支付过期处理逻辑

```typescript
// 承诺支付过期检查（独立于正常过期检查）
async function checkCommittedPaymentExpiry(): Promise<void> {
  const now = new Date();
  
  // 检查银行转账承诺支付过期（48小时）
  const bankTransferExpired = await orderRepository.find({
    where: {
      status: epOrderStatus.PENDING,
      paymentMethod: epPaymentMethod.BANK_TRANSFER,
      paymentStatus: epPaymentStatus.COMMITTED,
      createdAt: LessThan(new Date(now.getTime() - 48 * 60 * 60 * 1000))
    }
  });
  
  // 检查现金支付承诺支付过期（2周）
  const cashExpired = await orderRepository.find({
    where: {
      status: epOrderStatus.PENDING,
      paymentMethod: epPaymentMethod.CASH,
      paymentStatus: epPaymentStatus.COMMITTED,
      createdAt: LessThan(new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000))
    }
  });
  
  const expiredOrders = [...bankTransferExpired, ...cashExpired];
  
  for (const order of expiredOrders) {
    // 过期处理
    await orderRepository.update(order.id, {
      status: epOrderStatus.EXPIRED,
      updatedAt: new Date()
    });
    
    // 释放库存
    await inventoryService.releaseOrderStock(order.id);
    
    // 记录监控警报
    await alertOrdersPaymentsService.recordAlert({
      alertType: epOrderPaymentAlertType.COMMITMENT_PAYMENT_EXPIRED,
      description: `承诺支付订单过期，支付方式：${order.paymentMethod}`,
      orderIds: [order.id],
      userIds: [order.userId],
      paymentRecordIds: [],
      severity: epAlertSeverity.MEDIUM
    });
  }
  
  // 检查用户权限是否需要调整
  await checkUserPermissionAdjustment(expiredOrders);
}

// 用户权限调整检查
async function checkUserPermissionAdjustment(expiredOrders: Order[]): Promise<void> {
  const userIds = [...new Set(expiredOrders.map(order => order.userId))];
  
  for (const userId of userIds) {
    const userExpiredOrders = expiredOrders.filter(order => order.userId === userId);
    
    // 统计过去4周的承诺支付过期订单
    const fourWeeksAgo = new Date(Date.now() - 4 * 7 * 24 * 60 * 60 * 1000);
    const recentExpiredCount = await orderRepository.count({
      where: {
        userId,
        status: epOrderStatus.EXPIRED,
        paymentStatus: epPaymentStatus.COMMITTED,
        updatedAt: MoreThan(fourWeeksAgo)
      }
    });
    
    // 如果超过阈值，调整用户权限
    if (recentExpiredCount >= 1) { // 阈值设为1
      await adjustUserPermissions(userId, userExpiredOrders);
    }
  }
}

// 调整用户权限
async function adjustUserPermissions(userId: string, expiredOrders: Order[]): Promise<void> {
  // 同时禁用两种权限
  await this.userPermissionRepository.update(userId, {
    allow_cash: false,
    allow_bank_transfer: false,
    updated_at: new Date()
  });
  
  // 记录权限调整监控警报
  await alertOrdersPaymentsService.recordAlert({
    alertType: epOrderPaymentAlertType.USER_PERMISSION_SUSPENDED,
    description: `用户权限被暂停，原因：承诺支付过期次数过多`,
    orderIds: expiredOrders.map(order => order.id),
    userIds: [userId],
    paymentRecordIds: [],
    severity: epAlertSeverity.HIGH
  });
}
```

### 6. 订单支付监控系统

#### 监控数据结构

```typescript
// 订单支付监控实体
export interface iAlertOrdersPayments {
  id: string;
  alertType: epOrderPaymentAlertType;  // 异常类型
  description: string;                 // 异常描述
  orderIds: string[];                  // 相关订单ID数组
  userIds: string[];                   // 相关用户ID数组
  paymentRecordIds: string[];          // 相关支付记录ID数组
  severity: epAlertSeverity;           // 严重程度
  createdAt: Date;
}

// 订单支付异常类型枚举
export enum epOrderPaymentAlertType {
  COMMITMENT_PAYMENT_EXPIRED = 'COMMITMENT_PAYMENT_EXPIRED',  // 承诺支付过期
  USER_PERMISSION_SUSPENDED = 'USER_PERMISSION_SUSPENDED',     // 用户权限暂停
  PAYMENT_FAILED_MULTIPLE = 'PAYMENT_FAILED_MULTIPLE',         // 多次支付失败
  ORDER_PAYMENT_CANCELLED = 'ORDER_PAYMENT_CANCELLED'          // 订单支付取消
}

// 异常严重程度枚举
export enum epAlertSeverity {
  LOW = 'LOW',       // 低
  MEDIUM = 'MEDIUM', // 中
  HIGH = 'HIGH',     // 高
  CRITICAL = 'CRITICAL' // 严重
}

// 订单支付监控服务
export class AlertOrdersPaymentsService {
  async recordAlert(alert: Omit<iAlertOrdersPayments, 'id' | 'createdAt'>): Promise<void> {
    await this.alertOrdersPaymentsRepository.save({
      ...alert,
      id: generateUUID(),
      createdAt: new Date()
    });
  }
  
  async getAlertsByType(alertType: epOrderPaymentAlertType, limit: number = 100): Promise<iAlertOrdersPayments[]> {
    return await this.alertOrdersPaymentsRepository.find({
      where: { alertType },
      order: { createdAt: 'DESC' },
      take: limit
    });
  }
  
  async getAlertsByUser(userId: string, limit: number = 50): Promise<iAlertOrdersPayments[]> {
    return await this.alertOrdersPaymentsRepository.find({
      where: { userIds: Like(`%${userId}%`) },
      order: { createdAt: 'DESC' },
      take: limit
    });
  }
  
  async getAlertsBySeverity(severity: epAlertSeverity, limit: number = 100): Promise<iAlertOrdersPayments[]> {
    return await this.alertOrdersPaymentsRepository.find({
      where: { severity },
      order: { createdAt: 'DESC' },
      take: limit
    });
  }
}
```

### 7. 前端实现建议

#### Modal设计和用户协议

```typescript
// 微信小程序端实现
interface iCommitmentModalProps {
  orderId: string;
  paymentMethod: epPaymentMethod.CASH | epPaymentMethod.BANK_TRANSFER;
  onConfirm: () => void;
  onCancel: () => void;
  onViewAgreement: () => void;
}

// Modal内容建议
const COMMITMENT_TEXT = {
  [epPaymentMethod.CASH]: {
    title: '现金支付确认',
    content: '您选择现金支付，点击确认表示承诺完成付款。如改变主意请及时取消订单。',
    agreementText: '查看用户协议'
  },
  [epPaymentMethod.BANK_TRANSFER]: {
    title: '银行转账确认', 
    content: '您选择银行转账，转账需要2天内到达，为节省时间请尽快付款。如改变主意请及时取消订单。谢谢合作。',
    agreementText: '查看用户协议'
  }
};
```

---

## ⏰ 定时任务整合

```typescript
// 整合的定时任务
export class OrderExpiryCronService {
  async handleExpiredOrders(): Promise<void> {
    // 1. 处理正常过期订单
    await this.handleNormalExpiredOrders();
    
    // 2. 处理承诺支付过期订单
    await this.checkCommittedPaymentExpiry();
  }
  
  private async handleNormalExpiredOrders(): Promise<void> {
    // 现有的过期订单处理逻辑
    // 只处理 paymentStatus 为 PENDING 或空的订单
  }
}
```

---

## 🗄️ 数据库迁移

```sql
-- 只需要添加 allow_bank_transfer 字段到现有的 user_permissions 表
ALTER TABLE user_permissions ADD COLUMN allow_bank_transfer BOOLEAN DEFAULT true;

-- 创建订单支付监控表
CREATE TABLE alert_orders_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  order_ids TEXT[] DEFAULT '{}',
  user_ids TEXT[] DEFAULT '{}',
  payment_record_ids TEXT[] DEFAULT '{}',
  severity VARCHAR(20) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_alert_orders_payments_type ON alert_orders_payments(alert_type);
CREATE INDEX idx_alert_orders_payments_severity ON alert_orders_payments(severity);
CREATE INDEX idx_alert_orders_payments_created_at ON alert_orders_payments(created_at);
CREATE INDEX idx_alert_orders_payments_user_ids ON alert_orders_payments USING GIN(user_ids);
CREATE INDEX idx_alert_orders_payments_order_ids ON alert_orders_payments USING GIN(order_ids);
```

---

## 📋 用户协议更新建议

### 承诺支付条款

在用户协议中新增以下条款：

**承诺支付服务条款**

1. **服务说明**
   - 承诺支付服务允许用户选择现金支付或银行转账方式，并承诺在指定时间内完成付款
   - 现金支付：用户承诺在订单约定的时间（自提或配送时）完成现金付款
   - 银行转账：用户承诺立即完成转账操作（通常2天内到账）

2. **用户责任**
   - 用户选择承诺支付即表示同意履行付款义务
   - 如改变主意，请及时取消或删除订单
   - 未履行付款承诺可能影响店铺正常生产安排

3. **服务限制**
   - 如用户多次未履行承诺支付义务，系统可能暂停该用户的承诺支付服务权限
   - 暂停权限不影响其他支付方式的使用

4. **联系方式**
   - 如有疑问或需要帮助，请通过客服系统联系我们
   - 我们会在收到您的联系后及时处理相关问题

**注意：条款表述温和友好，强调帮助而非惩罚**

---

## 🚀 实施指南

### 实施步骤
1. **数据库迁移**: 执行上述SQL脚本，添加必要字段和表
2. **后端实现**: 
   - 更新支付状态枚举
   - 更新订单创建/更新服务，自动设置承诺支付状态
   - 更新定时任务处理承诺支付过期
   - 创建订单支付监控服务
   - 更新用户权限服务支持新字段
3. **前端实现**: 
   - 添加承诺支付确认Modal
   - 更新用户协议内容
   - 实现权限检查逻辑
   - 集成承诺支付流程到订单创建/更新
4. **测试验证**: 
   - 单元测试承诺支付逻辑
   - 集成测试完整流程
   - 用户验收测试

### 与现有系统的集成点
- **订单系统**: 在 `order-system.md` 中简要介绍
- **支付系统**: 在 `payment-system.md` 中简要介绍
- **监控 UI**: 订单支付监控页面结构见 [System Monitoring — Overview](./System-Monitoring-Overview.md)、[System Monitoring — CMS](./System-Monitoring-CMS.md)、[System Monitoring — Platform](./System-Monitoring-Platform.md)
- **详细设计**: 本文档包含所有实现细节

---

## ✅ 优势总结

1. **技术简化**：库存锁定逻辑统一，消除同步复杂性
2. **业务合理**：承诺支付符合现金/银行转账的实际使用场景
3. **风险控制**：通过权限管理和监控系统防止滥用
4. **可追溯性**：完整的监控记录，便于审计和分析
5. **用户体验**：给用户更多时间，同时有明确的责任边界
6. **监控清晰**：专门的监控表结构，便于UI展示和数据分析
7. **扩展性好**：监控系统设计支持未来添加其他类型的警报
