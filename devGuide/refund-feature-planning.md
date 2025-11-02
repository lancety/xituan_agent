# 订单退款功能开发规划（已实现）

## 📋 需求分析

### 当前需求概述

根据业务需求，已实现三种退款场景：

1. **PaymentIntent退款**：通过Airwallex API发起原路退款（费用从退款额扣除，3% + 0.3 AUD）
2. **Deposit退款**：通过Airwallex API发起Payout Transfer退款到收款人账户（无手续费）
3. **手动退款**：现金或其他手动支付退款（直接创建SETTLED状态记录）

### ✅ 已实现的关键设计

1. **退款处理基于 transactionId**：退款请求直接使用原支付记录的 `transactionId`，而非 `orderId`
2. **parentPaymentId 关联**：所有退款记录通过 `parentPaymentId` 关联到原始支付记录
3. **Webhook 事件创建新记录**：每个 webhook 事件都会创建新的 `OrderPaymentRecord`，而非更新现有记录
4. **状态枚举**：
   - `CREATED`：API 调用成功后创建
   - `SENT`：退款已发送（refund.accepted, payout.transfer.sent）
   - `RECEIVED`：退款已收到（refund.received）
   - `SETTLED`：退款已完成（refund.settled, payout.transfer.paid）
   - `FAILED`：退款失败（refund.failed, payout.transfer.failed）
   - `REVERSED`：退款已撤销（deposit.reversed）
5. **费用扣除**：仅 PaymentIntent 退款扣除费用（3% + 0.3 AUD），Deposit 和手动退款无费用
6. **字段说明**：
   - `refundedAmount`：CMS 输入的退款金额（用于计算已退款总额）
   - `refundedAmountReceived`：实际收款金额（扣除手续费后，仅 PaymentIntent 退款）
   - `operatorId`：操作退款的管理员ID（存储在独立字段，非 metadata）
7. **订单状态更新**：仅在收到 `SETTLED` webhook 事件后更新订单状态和支付状态

### 澳洲法律合规性 ✅

根据ACCC规定：
- 商家可以在用户协议中明确说明退款费用扣除方式
- 只要用户同意用户协议，按照条款扣除费用是合法的
- 用户服务协议已更新为：退款费用 = 付款额的3% + 0.3澳币转账费用

### 需求合理性分析

✅ **合理的部分：**
- PaymentIntent退款逻辑正确：可以使用payment intent ID直接发起refund
- Deposit不能原路退款：符合Airwallex的实际限制
- 使用bank transfer退款：合理的替代方案
- 手动支付退款记录：符合线下退款场景

✅ **已实现的关键点：**

1. **支付记录类型识别** ✅
   - ✅ 仅使用 `paymentMethod` 和枚举集合判断
   - ✅ `eAirwallexPaymentMethods.has(paymentMethod)` → PaymentIntent 退款
   - ✅ `eAirwallexDepositMethods.has(paymentMethod)` → Deposit 退款（Payout）
   - ✅ 其他 → Cash/手动退款

2. **退款金额校验** ✅
   - ✅ 基于支付记录的 `transactionId` 进行退款校验（非整个订单）
   - ✅ 计算已退款总额（基于 `parentPaymentId`，数据库层面聚合）
   - ✅ 支持同一支付记录的多次部分退款

3. **退款费用计算** ✅
   - ✅ CMS 输入退款金额，后端自动扣除手续费（仅 PaymentIntent 退款）
   - ✅ 费用 = 退款金额 × 3% + 0.3 AUD
   - ✅ 实际转账金额 = 退款金额 - 费用
   - ✅ 分别存储在 `refundedAmount`（CMS 输入）和 `refundedAmountReceived`（实际收款）

4. **收款人信息获取** ✅
   - ✅ Deposit 支付：从支付记录 `metadata.payer` 提取收款人信息（用于预填充）
   - ✅ Cash 支付选择银行转账退款：必须手动输入收款人银行信息
   - ✅ 验证收款人信息完整性（必须有 name 或 bank_account_id）

5. **退款类型说明** ✅
   - ✅ 所有退款都是手动触发（通过 CMS）
   - ✅ 退款方式区别：
     - PaymentIntent 退款：使用 Airwallex PaymentIntent Refund API
     - Deposit 退款：使用 Airwallex Payout Transfer API
     - Cash/手动退款：直接创建 SETTLED 状态记录，无需 API 调用

6. **Webhook处理** ✅
   - ✅ PaymentIntent 退款：通过 `refund.*` webhook 更新状态
   - ✅ Deposit 退款：通过 `payout.transfer.*` webhook 更新状态
   - ✅ 每个 webhook 事件创建新记录（而非更新现有记录）

7. **错误处理** ✅
   - ✅ Airwallex API 调用失败：不创建记录（只在成功时创建 CREATED 状态记录）
   - ✅ Webhook 失败事件：保存到 records 表，设置 `needsManualReview = true` 和失败原因
   - ✅ 收款人信息不完整：验证并返回错误提示

## 🎯 技术方案（已实现）

### 1. 支付记录类型识别

**实现方式**：仅使用 `paymentMethod` 和枚举集合判断（不依赖 metadata）

```typescript
// 判断支付方式类型（仅基于原支付记录的 paymentMethod）
const isPaymentIntent = paymentRecord.paymentMethod && 
  eAirwallexPaymentMethods.has(paymentRecord.paymentMethod);
const isDeposit = paymentRecord.paymentMethod && 
  eAirwallexDepositMethods.has(paymentRecord.paymentMethod);
const isManualPayment = !isPaymentIntent && !isDeposit;

// 枚举集合定义
export const eAirwallexPaymentMethods = new Set([
  epPaymentRecordMethod.AIRWALLEX_WECHAT,      // → PaymentIntent 退款
  epPaymentRecordMethod.AIRWALLEX_APPLE_PAY,   // → PaymentIntent 退款
  epPaymentRecordMethod.AIRWALLEX_GOOGLE_PAY,  // → PaymentIntent 退款
  epPaymentRecordMethod.AIRWALLEX_MASTERCARD   // → PaymentIntent 退款
]);

export const eAirwallexDepositMethods = new Set([
  epPaymentRecordMethod.AIRWALLEX_BANK_TRANSFER // → Deposit 退款（Payout）
]);
```

### 2. 退款流程设计（已实现）

#### 2.1 PaymentIntent退款流程（Airwallex移动支付）

```
CMS提交退款请求（transactionId, amount, refundMethod）
  ↓
根据 transactionId 查询 SETTLED 支付记录
  ↓
获取 parentPaymentId = paymentRecord.id
  ↓
计算已退款总额（基于 parentPaymentId，数据库层面聚合）
  ↓
校验：退款金额 ≤ 原支付金额 - 已退款金额
  ↓
计算费用：fee = refundAmount * 3% + 0.3 AUD
实际退款金额 = refundAmount - fee
  ↓
调用 Airwallex PaymentIntent Refund API（发送 actualRefundAmount）
  ↓
创建退款记录（状态：CREATED）
  - transactionId: refundResult.id（Airwallex refund ID）
  - parentPaymentId: paymentRecord.id
  - refundedAmount: request.amount（CMS输入值）
  - refundedAmountReceived: actualRefundAmount（扣除费用后）
  - status: CREATED
  - operatorId: 操作员ID
  ↓
等待 webhook 事件更新状态：
  - refund.accepted → SENT（创建新记录）
  - refund.settled → SETTLED（创建新记录，更新订单状态）
  - refund.failed → FAILED（创建新记录）
```

#### 2.2 Deposit退款流程（Bank Transfer Payout）

```
CMS提交退款请求（transactionId, amount, 收款人信息）
  ↓
根据 transactionId 查询 SETTLED 支付记录（Deposit）
  ↓
获取 parentPaymentId = paymentRecord.id
  ↓
计算已退款总额（基于 parentPaymentId）
  ↓
校验：退款金额 ≤ 原支付金额 - 已退款金额
  ↓
验证收款人信息（从 request.metadata.recipient 获取）
  ↓
调用 Airwallex Payout Transfer API（无手续费）
  - depositId: transactionId
  - transfer_amount: request.amount（全额退款，无扣除）
  - beneficiary: 收款人银行账户信息（映射为 Airwallex API 要求的字段名）
  ↓
创建退款记录（状态：CREATED）
  - transactionId: payoutResult.id（Airwallex payout ID）
  - parentPaymentId: paymentRecord.id
  - refundedAmount: request.amount
  - refundedAmountReceived: request.amount（无手续费）
  - status: CREATED
  - operatorId: 操作员ID
  ↓
等待 webhook 事件更新状态：
  - payout.transfer.sent → SENT（创建新记录）
  - payout.transfer.paid → SETTLED（创建新记录，更新订单状态）
  - payout.transfer.failed → FAILED（创建新记录）
```

#### 2.3 手动退款流程（Cash/Other）

```
CMS提交退款请求（transactionId, amount, refundMethod）
  ↓
根据 transactionId 查询 SETTLED 支付记录（手动支付）
  ↓
获取 parentPaymentId = paymentRecord.id
  ↓
计算已退款总额（基于 parentPaymentId）
  ↓
校验：退款金额 ≤ 原支付金额 - 已退款金额
  ↓
直接创建退款记录（状态：SETTLED，无需API调用）
  - transactionId: uuidv4()（生成唯一ID）
  - parentPaymentId: paymentRecord.id
  - refundedAmount: request.amount
  - refundedAmountReceived: request.amount（无手续费）
  - status: SETTLED（直接成功）
  - operatorId: 操作员ID
  ↓
立即调用 RefundHandlerService.handleRefund 更新订单状态
```

#### 2.4 Other退款流程

```
暂时忽略（待后续实现）
```

### 3. API设计（已实现）

#### 3.1 Airwallex API集成

**PaymentIntent 退款**：
```typescript
// webhook-airwallex.service.ts
async createPaymentRefund(
  paymentIntentId: string,
  amount: number,
  reason: string
): Promise<any>
// 调用: POST /api/v1/pa/payment_intents/{id}/refund
```

**Payout Transfer 退款（Deposit）**：
```typescript
// webhook-airwallex.service.ts
async createPayoutRefund(
  depositId: string,
  amount: number,
  currency: string,
  reason: string,
  beneficiaryInfo: { // 收款人信息
    bank_account_id?: string;
    name?: string;
    bank_account_number?: string;
    bank_account_bsb?: string;
  },
  externalReference?: string
): Promise<any>
// 调用: POST /api/v1/pa/deposits/{id}/payout
```

#### 3.2 退款费用计算（关键逻辑）

```typescript
// 计算退款费用（根据用户服务协议）
// 费用从退款额扣除，实际退款金额 = 退款额 - 费用
function calculateRefundFee(refundAmount: number): {
  requestedAmount: number;      // 用户输入的退款金额
  fee: number;                  // 费用总额
  actualRefundAmount: number;    // 实际退款金额（扣除费用后）
  breakdown: {
    percentageFee: number;       // 3% = refundAmount * 0.03
    fixedFee: number;            // 0.3 AUD
  };
} {
  const percentageFee = refundAmount * 0.03;
  const fixedFee = 0.3;
  const totalFee = percentageFee + fixedFee;
  const actualRefundAmount = refundAmount - totalFee;
  
  return {
    requestedAmount: refundAmount,
    fee: totalFee,
    actualRefundAmount: Math.max(0, actualRefundAmount), // 确保不为负数
    breakdown: {
      percentageFee,
      fixedFee
    }
  };
}
```

#### 3.3 退款记录字段说明

```typescript
// 退款记录存储：
{
  amount: requestedAmount,           // 用户输入的退款金额（用于epPaymentType判断）
  refundedAmount: requestedAmount,   // 退款输入值（不是实际转账值）
  paymentType: // REFUND 或 PARTIAL_REFUND（根据requestedAmount vs 原支付金额）
  metadata: {
    fee: totalFee,
    actualRefundAmount: actualRefundAmount, // 实际转账金额
    feeBreakdown: { ... }
  }
}

// WeChat端显示：显示 actualRefundAmount（实际退款数额）
```

## ✅ 已完成功能清单

### Phase 1: 基础功能 ✅

1. **支付记录类型识别** ✅
   - ✅ 基于 `paymentMethod` 和枚举集合判断
   - ✅ 使用 `eAirwallexPaymentMethods` 和 `eAirwallexDepositMethods`

2. **退款金额校验** ✅
   - ✅ 实现数据库层面聚合查询计算已退款总额
   - ✅ 校验退款金额不能超过可退款金额

3. **退款费用计算** ✅
   - ✅ 实现 `calculateRefundFee` 函数（仅 PaymentIntent 退款）
   - ✅ PaymentIntent：3% + 0.3 AUD
   - ✅ Deposit 和手动退款：无费用

### Phase 2: Deposit退款实现 ✅

4. **Airwallex Payout Transfer API集成** ✅
   - ✅ 实现 `createPayoutRefund` 方法
   - ✅ 调用 `/api/v1/pa/deposits/{id}/payout` 接口

5. **Deposit退款流程** ✅
   - ✅ CMS 显示 payer 银行信息（从 metadata 提取，Deposit 支付记录才有）
   - ✅ Cash 支付退款时需要手动输入收款人银行信息
   - ✅ 收款人信息输入表单（Deposit 退款时必填）
   - ✅ 验证收款人信息完整性

### Phase 3: PaymentIntent退款 ✅

7. **PaymentIntent退款** ✅
   - ✅ 实现 `createPaymentRefund` 方法
   - ✅ 调用 `/api/v1/pa/payment_intents/{id}/refund` 接口
   - ✅ 费用扣除逻辑

### Phase 4: Webhook处理 ✅

8. **退款Webhook处理** ✅
   - ✅ 实现 `WebhookAirwallexRefundService`
   - ✅ 处理 `refund.*` 和 `payout.transfer.*` 事件
   - ✅ 每个事件创建新记录

9. **退款状态更新** ✅
   - ✅ `RefundHandlerService` 统一处理退款状态
   - ✅ 订单状态更新（仅在 SETTLED 后）

### Phase 5: 手动退款 ✅

10. **手动退款流程** ✅
    - ✅ 直接创建 SETTLED 状态记录
    - ✅ 立即更新订单状态
    - ✅ 记录 `operatorId`

### Phase 6: CMS界面 ✅

11. **CMS界面优化** ✅
    - ✅ Deposit 退款显示 payer 银行信息（仅参考，从 metadata 提取）
    - ✅ 收款人信息输入表单（Deposit 退款必填，Cash 支付选择银行转账退款时必填）
    - ✅ 基于 `transactionId` 的退款请求（基于支付记录，非订单）
    - ✅ 交易ID 显示（只读）

12. **数据库迁移** ✅
    - ✅ 添加 `operator_id` 字段
    - ✅ 添加 `refunded_amount_received` 字段
    - ✅ 更新状态约束（CREATED, SENT, RECEIVED, SETTLED, REVERSED 等）

## 🔍 关键实现细节

### 1. 退款记录关联

退款记录需要关联到原始支付记录：

```typescript
// 在OrderPaymentRecord中添加
@Column({ type: 'uuid', nullable: true, name: 'parent_payment_id' })
parentPaymentId?: string; // 关联到原始支付记录
```

### 2. 已退款金额计算（数据库层面聚合）

**实现方式**：使用 PostgreSQL `DISTINCT ON` 进行高效聚合

```typescript
private async calculateAlreadyRefundedAmount(parentPaymentId: string): Promise<number> {
  const query = `
    SELECT SUM(
      CASE 
        WHEN latest.status NOT IN ('failed', 'cancelled', 'reversed') 
        THEN COALESCE(latest.refunded_amount, latest.amount, 0)
        ELSE 0
      END
    ) as total
    FROM (
      SELECT DISTINCT ON (transaction_id)
        transaction_id,
        status,
        refunded_amount,
        amount
      FROM order_payment_records
      WHERE parent_payment_id = $1
        AND payment_type IN ('REFUND', 'PARTIAL_REFUND')
        AND transaction_id IS NOT NULL
      ORDER BY transaction_id, created_at DESC
    ) as latest
  `;

  const result = await this.paymentRecordRepository.query(query, [parentPaymentId]);
  return parseFloat(result[0]?.total || '0');
}
```

**关键逻辑**：
- 按 `transaction_id` 分组，每个 `transaction_id` 取最新记录（按 `created_at DESC`）
- 排除失败状态（`FAILED`, `CANCELLED`, `REVERSED`）
- 使用 `refunded_amount`（不存在时回退到 `amount`）
- 在数据库层面完成聚合，避免加载所有记录到内存

### 3. Webhook事件处理（每个事件创建新记录）

**实现方式**：`RefundHandlerService` 统一处理，每个 webhook 事件创建新记录

```typescript
// refund.handler.service.ts
async handleRefundSettled(context: iRefundHandleContext, order?: Order): Promise<iRefundHandleResult> {
  // 创建新记录（每次 webhook event 创建新记录）
  const newRecord = this.paymentRecordRepository.create({
    orderId: orderId,
    paymentType: context.refundRecord.paymentType,
    amount: context.refundRecord.amount,
    transactionId: context.refundRecord.transactionId, // 相同的 transactionId，但创建新记录
    status: epPaymentRecordStatus.SETTLED,
    parentPaymentId: context.refundRecord.parentPaymentId,
    operatorId: context.refundRecord.operatorId,
    refundedAmount: context.refundRecord.refundedAmount,
    refundedAmountReceived: context.refundRecord.refundedAmountReceived,
    // ... 其他字段
  });
  const savedRecord = await this.paymentRecordRepository.save(newRecord);

  // 计算总退款金额（按 transactionId 分组，取最新 SETTLED 记录）
  // 更新订单状态为 REFUNDED（如果总退款金额 >= 订单最终金额）
}
```

**Webhook 事件映射**：
- `refund.accepted` → `SENT`
- `refund.settled` → `SETTLED`
- `refund.failed` → `FAILED`
- `refund.received` → `RECEIVED`
- `payout.transfer.sent` → `SENT`
- `payout.transfer.paid` → `SETTLED`
- `payout.transfer.failed` → `FAILED`

## ⚠️ 注意事项

1. **费用扣除机制** ✅
   - ✅ 费用从退款金额中扣除（非额外收取）
   - ✅ 仅 PaymentIntent 退款扣除费用（3% + 0.3 AUD）
   - ✅ Deposit 和 Cash 退款无手续费
   - ⚠️ 额外收取的费用由 Airwallex 自动结算收取，暂时不记录费用明细

2. **数据安全** ✅
   - ✅ 银行账户信息（BSB、账号）仅用于退款转账，不需要加密存储
   - ✅ 仅在退款时使用，不 elsewhere 暴露

3. **状态同步** ✅
   - ✅ Webhook 事件创建新记录，确保状态历史完整
   - ✅ Webhook 失败时保存失败记录，设置 `needsManualReview = true` 和失败原因
   - ✅ 定期检查是否有未及时更新状态的退款记录（待添加监控）

4. **测试覆盖** ⚠️
   - ⚠️ 单元测试：费用计算、类型识别、金额校验（待添加）
   - ⚠️ 集成测试：Airwallex API调用（待添加）
   - ⚠️ E2E测试：完整退款流程（待添加）

## 📚 参考文档

- Airwallex Refund API: `/api/v1/pa/payment_intents/{id}/refund`
- Airwallex Payout Transfer API: `/api/v1/pa/deposits/{id}/payout`
- 用户服务协议：退款费用 = 付款额的3% + 0.3澳币转账费用
- Webhook事件：`refund.succeeded` 和 `refund.failed`（refund分组下）

## 📝 关键实现要点

### 1. 退款方式判断逻辑

```typescript
// 根据 paymentMethod 确定退款方式
function determineRefundMethod(paymentMethod: epPaymentRecordMethod, metadata: any): {
  usePaymentIntentRefund: boolean;
  useBankTransfer: boolean;
  useManual: boolean;
} {
  // PaymentIntent退款：所有Airwallex移动支付
  if (eAirwallexPaymentMethods.has(paymentMethod)) {
    return { usePaymentIntentRefund: true, useBankTransfer: false, useManual: false };
  }
  
  // Bank Transfer退款：Deposit收款
  if (paymentMethod === epPaymentRecordMethod.AIRWALLEX_BANK_TRANSFER || 
      metadata?.type === 'BANK_TRANSFER') {
    return { usePaymentIntentRefund: false, useBankTransfer: true, useManual: false };
  }
  
  // 手动退款：Cash或其他
  return { usePaymentIntentRefund: false, useBankTransfer: false, useManual: true };
}
```

### 2. PaymentType判断逻辑

```typescript
// 根据退款金额判断是全额还是部分退款
function determinePaymentType(refundAmount: number, originalAmount: number): epPaymentType {
  const difference = Math.abs(refundAmount - originalAmount);
  // 允许0.01的误差
  if (difference < 0.01) {
    return epPaymentType.REFUND; // 全额退款
  }
  return epPaymentType.PARTIAL_REFUND; // 部分退款
}
```

### 3. Webhook处理确认

- ✅ PaymentIntent退款成功：触发 `refund.succeeded` 事件
- ✅ Deposit退款成功：触发 `deposit.settled` 事件（新的deposit记录）
- ⚠️ 需要实现 `refund.succeeded` 和 `refund.failed` webhook处理

## 🎨 CMS界面退款模态框功能流程（已实现）

### 1. 退款请求参数

**API 调用**：
- 路径：`POST /admin/orders/refund`
- 参数：`transactionId`（原支付记录的 transactionId，不是 orderId）
- 请求体：`iRefundRequest`

### 2. Deposit 退款银行信息显示（已实现）

**显示逻辑**：

1. **识别 Deposit 支付记录**：
   ```typescript
   const isDeposit = selectedPaymentRecord?.paymentMethod === 
     epPaymentRecordMethod.AIRWALLEX_BANK_TRANSFER;
   ```

2. **提取 payer 银行信息**：
   ```typescript
   const payerInfo = isDeposit && selectedPaymentRecord?.metadata?.payer ? {
     name: selectedPaymentRecord.metadata.payer.name,
     bankAccountName: selectedPaymentRecord.metadata.payer.bank_account?.name,
     bsb: selectedPaymentRecord.metadata.payer.bank_account?.au_bsb?.bsb,
     accountNumber: selectedPaymentRecord.metadata.payer.bank_account?.au_bsb?.account_number,
     institution: selectedPaymentRecord.metadata.payer.bank_account?.institution?.name
   } : null;
   ```

3. **显示支付者银行信息卡片**（仅 Deposit 显示）：
   - 支付者姓名
   - 账户名称
   - BSB
   - 账号
   - 银行名称

4. **收款人信息输入表单**（Deposit 退款或 Cash 支付选择银行转账退款时必填）：
   - 收款人姓名
   - 银行账号
   - BSB

### 3. 退款方式选项（已实现）

所有退款方式选项：
- `AIRWALLEX_WECHAT`：Airwallex微信支付
- `AIRWALLEX_APPLE_PAY`：Airwallex Apple Pay
- `AIRWALLEX_GOOGLE_PAY`：Airwallex Google Pay
- `AIRWALLEX_MASTERCARD`：Airwallex Mastercard
- `AIRWALLEX_BANK_TRANSFER`：Airwallex银行转账退款
- `MANUAL_CASH`：手动现金退款
- `MANUAL_OTHER`：手动其他退款

**默认值**：使用原支付记录的 `paymentMethod`

### 4. 退款模态框流程（已实现）

```
用户点击"处理退款"按钮
  ↓
打开 ManualRefundModal，传入 selectedPaymentRecord
  ↓
初始化表单：
  - amount: selectedPaymentRecord.amount
  - currency: selectedPaymentRecord.currency
  - refundMethod: selectedPaymentRecord.paymentMethod
  - transactionId: selectedPaymentRecord.transactionId（显示，只读）
  ↓
如果是 Deposit：
  - 提取 payer 信息并显示在卡片中（参考）
  - 预填充收款人信息（使用 payer 信息，可修改）
如果是 Cash 支付选择银行转账退款：
  - 需要手动输入收款人银行信息
  ↓
用户填写/确认退款信息：
  - 退款类型（全额/部分，根据金额自动判断）
  - 退款金额
  - 退款方式（可修改）
  - 收款人信息（Deposit 退款或 Cash 银行转账退款时必填）
  - 退款原因（可选）
  ↓
提交退款请求：
  - API: POST /admin/orders/refund
  - 参数: transactionId（原支付记录的 transactionId）
  - 请求体: { amount, reason, currency, transactionId, refundMethod, metadata }
  ↓
后端处理并返回结果
```

### 5. 关键实现细节

**1. transactionId 处理**：
- 退款请求基于原支付记录的 `transactionId`
- CMS 端显示只读的 transactionId 字段
- 验证：如果 `transactionId` 不存在，显示错误并禁用提交

**2. 收款人信息（Deposit 或 Cash 银行转账退款）**：
- 存储在 `request.metadata.recipient`（代码中使用 `recipient`，兼容旧字段 `beneficiary`）
- 字段：`name`, `bank_account_number`, `bank_account_bsb`
- 后端验证：必须有 `name` 或 `bank_account_id`
- Deposit 支付：可以从支付记录 metadata.payer 提取并预填充
- Cash 支付选择银行转账退款：必须手动输入
- 发送到 Airwallex API 时映射为 `beneficiary` 字段（API 要求）

**3. 订单状态更新**：
- Airwallex 退款：仅在收到 `SETTLED` webhook 后更新订单状态
- 手动退款：立即更新订单状态（创建记录后调用 `RefundHandlerService`）

