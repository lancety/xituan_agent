# 微信小程序支付系统实现方案

## 📋 项目概述

本方案专门针对微信小程序环境下的支付系统实现，重点解决微信小程序与标准实时支付系统的差异，以及小程序特有的支付限制和用户体验要求。

### 核心设计理念
- 🎯 **小程序环境适配**: 针对微信小程序的特有限制进行优化
- 🔄 **支付方式差异化**: 区分小程序内支付和小程序外支付
- 🛡️ **合规性优先**: 严格遵守微信小程序支付政策
- ⚡ **用户体验优化**: 简化支付流程，减少用户操作步骤

### 与标准实时支付的主要区别
- ✅ 微信小程序内支付 vs 网页支付
- ✅ 支付方式环境控制（开发/生产环境）
- ✅ 小程序支付限制和合规要求
- ✅ 支付状态显示和用户引导
- ✅ 跨平台支付链接处理

---

## 🏗️ 微信小程序支付架构

### 支付方式分类（小程序专用）

#### 小程序内支付方式
```typescript
export enum epWeChatAppPaymentMethod {
  WECHAT = 'WECHAT',           // 微信支付（小程序内）
  CASH = 'CASH',               // 现金支付
  BANK_TRANSFER = 'BANK_TRANSFER' // 银行转账
}
```

#### 小程序外支付方式（网页支付）
```typescript
export enum epWebPaymentMethod {
  APPLE_PAY = 'APPLE_PAY',     // Apple Pay
  GOOGLE_PAY = 'GOOGLE_PAY',   // Google Pay
  MASTERCARD = 'MASTERCARD'    // Mastercard
}
```

### 环境控制机制
```typescript
// 小程序环境检测
const accountInfo = wx.getAccountInfoSync();
const isDev = accountInfo.miniProgram.envVersion === 'develop';

// 支付方式显示控制
const availablePaymentMethods = isDev 
  ? [...epWeChatAppPaymentMethod, ...epWebPaymentMethod]  // 开发环境：显示所有
  : Object.values(epWeChatAppPaymentMethod);              // 生产环境：仅小程序内支付
```

---

## 💳 支付流程差异对比

### 标准实时支付流程
```
用户下单 → 选择支付方式 → 创建Payment Intent → 跳转支付页面 → 完成支付 → Webhook确认
```

### 微信小程序支付流程
```
用户下单 → 选择支付方式 → 环境判断 → 小程序内支付/跳转外部支付 → 状态确认
```

### 关键差异点

#### 1. 支付方式限制
- **标准支付**: 支持所有Airwallex支付方式
- **小程序支付**: 受微信政策限制，仅支持特定支付方式

#### 2. 支付页面处理
- **标准支付**: 统一支付页面
- **小程序支付**: 根据支付方式跳转不同页面

#### 3. 状态确认机制
- **标准支付**: 主要依赖Webhook
- **小程序支付**: 结合Webhook和手动确认

---

## 🔄 支付方式实现差异

### 1. 微信支付（小程序内）
```typescript
// 小程序内微信支付流程
async function processWeChatPayment(orderData: any) {
  // 1. 创建Airwallex Payment Intent
  const paymentIntent = await createPaymentIntent({
    amount: orderData.totalAmount,
    currency: 'AUD',
    payment_method: 'AIRWALLEX_WECHAT'
  });
  
  // 2. 调用微信支付API
  wx.requestPayment({
    timeStamp: paymentIntent.timeStamp,
    nonceStr: paymentIntent.nonceStr,
    package: paymentIntent.package,
    signType: 'MD5',
    paySign: paymentIntent.paySign,
    success: (res) => {
      // 3. 支付成功处理
      handlePaymentSuccess(orderData.orderId);
    },
    fail: (err) => {
      // 4. 支付失败处理
      handlePaymentFailure(orderData.orderId, err);
    }
  });
}
```

### 2. 现金支付（小程序特有）
```typescript
// 现金支付流程（无需实际支付处理）
async function processCashPayment(orderData: any) {
  // 1. 直接创建订单，状态为待现金支付
  const order = await createOrder({
    ...orderData,
    payment_method: 'CASH',
    status: 'PENDING'
  });
  
  // 2. 跳转到现金支付说明页面
  wx.navigateTo({
    url: '/pages/payment-info/cash/cash?orderId=' + order.id
  });
  
  // 3. 等待配送员手动确认收款
}
```

### 3. 银行转账（小程序特有）
```typescript
// 银行转账流程
async function processBankTransfer(orderData: any) {
  // 1. 生成6位参考号
  const reference = generatePaymentReference();
  
  // 2. 创建订单
  const order = await createOrder({
    ...orderData,
    payment_method: 'BANK_TRANSFER',
    payment_reference: reference,
    status: 'PENDING'
  });
  
  // 3. 跳转到银行转账信息页面
  wx.navigateTo({
    url: `/pages/payment-info/bank-transfer/bankTransfer?orderId=${order.id}&reference=${reference}`
  });
}
```

### 4. 网页支付（小程序外）
```typescript
// 网页支付流程（跳转到外部）
async function processWebPayment(orderData: any) {
  // 1. 创建支付链接
  const paymentLink = await createPaymentLink({
    amount: orderData.totalAmount,
    currency: 'AUD',
    payment_methods: ['APPLE_PAY', 'GOOGLE_PAY', 'MASTERCARD']
  });
  
  // 2. 跳转到网页支付信息页面
  wx.navigateTo({
    url: `/pages/payment-info/web-payment/webPayment?link=${encodeURIComponent(paymentLink)}`
  });
}
```

---

## 📱 小程序特有组件设计

### 1. 支付方式选择组件
```typescript
// components/payment-method-selector/paymentMethodSelector.ts
Component({
  properties: {
    selectedMethod: {
      type: String,
      value: ''
    },
    disabled: {
      type: Boolean,
      value: false
    }
  },

  data: {
    paymentMethods: [
      { id: 'WECHAT', name: '微信支付', icon: '💳', description: '使用微信支付' },
      { id: 'CASH', name: '现金支付', icon: '💰', description: '接收时请准备准确数额的现金' },
      { id: 'BANK_TRANSFER', name: '银行转账', icon: '🏦', description: '转账给指定银行账户' }
    ]
  },

  lifetimes: {
    attached() {
      this.initPaymentMethods();
    }
  },

  methods: {
    initPaymentMethods() {
      // 检测开发环境
      const accountInfo = wx.getAccountInfoSync();
      const isDev = accountInfo.miniProgram.envVersion === 'develop';
      
      let paymentMethods = [
        { id: 'WECHAT', name: '微信支付', icon: '💳', description: '使用微信支付' },
        { id: 'CASH', name: '现金支付', icon: '💰', description: '接收时请准备准确数额的现金' },
        { id: 'BANK_TRANSFER', name: '银行转账', icon: '🏦', description: '转账给指定银行账户' }
      ];

      // 开发环境显示"其他"选项
      if (isDev) {
        paymentMethods.push({
          id: 'OTHER',
          name: '其他支付',
          icon: '💳',
          description: 'Apple Pay、Google Pay、Mastercard等'
        });
      }

      this.setData({ paymentMethods });
    },

    onMethodSelect(e: any) {
      const methodId = e.currentTarget.dataset.methodId;
      this.triggerEvent('methodSelect', { method: methodId });
    }
  }
});
```

### 2. 现金支付信息页面
```typescript
// pages/payment-info/cash/cash.ts
Page({
  data: {
    orderId: '',
    orderInfo: null
  },

  onLoad(options: any) {
    this.setData({ orderId: options.orderId });
    this.loadOrderInfo();
  },

  loadOrderInfo() {
    // 加载订单信息
    wx.request({
      url: `${API_BASE}/orders/${this.data.orderId}`,
      success: (res) => {
        this.setData({ orderInfo: res.data });
      }
    });
  },

  goToOrderDetail() {
    wx.navigateTo({
      url: `/pages/order-detail/orderDetail?id=${this.data.orderId}`
    });
  }
});
```

### 3. 银行转账信息页面
```typescript
// pages/payment-info/bank-transfer/bankTransfer.ts
Page({
  data: {
    orderId: '',
    reference: '',
    bankInfo: null,
    orderInfo: null
  },

  onLoad(options: any) {
    this.setData({ 
      orderId: options.orderId,
      reference: options.reference 
    });
    this.loadBankInfo();
    this.loadOrderInfo();
  },

  loadBankInfo() {
    // 从平台设置获取银行信息
    wx.request({
      url: `${API_BASE}/platform-settings/finance`,
      success: (res) => {
        this.setData({ bankInfo: res.data.bank.forCustomerInvoice });
      }
    });
  },

  copyReference() {
    wx.setClipboardData({
      data: this.data.reference,
      success: () => {
        wx.showToast({
          title: '参考号已复制',
          icon: 'success'
        });
      }
    });
  }
});
```

### 4. 网页支付信息页面
```typescript
// pages/payment-info/web-payment/webPayment.ts
Page({
  data: {
    paymentLink: '',
    qrCodeUrl: ''
  },

  onLoad(options: any) {
    this.setData({ 
      paymentLink: decodeURIComponent(options.link) 
    });
    this.generateQRCode();
  },

  generateQRCode() {
    // 生成支付链接的二维码
    // 使用第三方二维码生成库
  },

  copyPaymentLink() {
    wx.setClipboardData({
      data: this.data.paymentLink,
      success: () => {
        wx.showToast({
          title: '支付链接已复制',
          icon: 'success'
        });
      }
    });
  },

  openPaymentLink() {
    // 在小程序外打开支付链接
    wx.showModal({
      title: '提示',
      content: '将在浏览器中打开支付页面',
      success: (res) => {
        if (res.confirm) {
          // 复制链接到剪贴板，用户手动粘贴到浏览器
          this.copyPaymentLink();
        }
      }
    });
  }
});
```

---

## 🔄 订单状态显示差异

### 小程序专用状态显示逻辑
```typescript
// 根据支付方式和订单状态显示不同内容
function getPaymentStatusDisplay(order: any) {
  switch (order.payment_method) {
    case 'WECHAT':
      if (order.status === 'paid') {
        return { text: '已支付（微信）', color: '#52c41a' };
      } else {
        return { text: '待微信支付', color: '#1890ff', showButton: true };
      }
      
    case 'CASH':
      if (order.status === 'paid') {
        return { text: '已收款（现金）', color: '#52c41a' };
      } else {
        return { text: '待现金支付', color: '#faad14', showButton: true };
      }
      
    case 'BANK_TRANSFER':
      if (order.status === 'paid') {
        return { text: '已收款（银行转账）', color: '#52c41a' };
      } else {
        return { text: '待银行转账', color: '#722ed1', showButton: true };
      }
      
    case 'OTHER':
      if (order.status === 'paid') {
        return { text: '已支付（网页支付）', color: '#52c41a' };
      } else {
        return { text: '待网页支付', color: '#13c2c2', showButton: true };
      }
      
    default:
      return { text: '未知状态', color: '#d9d9d9' };
  }
}
```

---

## 🛡️ 小程序合规性要求

### 1. 支付方式限制
- **生产环境**: 仅支持微信支付、现金支付、银行转账
- **开发环境**: 可显示所有支付方式用于测试
- **网页支付**: 必须跳转到小程序外处理

### 2. 用户引导要求
- **现金支付**: 明确说明线下支付流程
- **银行转账**: 提供完整的银行信息和参考号
- **网页支付**: 说明需要跳转到外部浏览器

### 3. 数据安全要求
- **敏感信息**: 不在小程序内显示完整银行账号
- **支付链接**: 使用一次性token，确保安全性
- **用户隐私**: 遵守微信小程序隐私政策

---

## 🔧 实施要点

### 1. 环境控制实现
```typescript
// 统一的环境检测工具
export const WeChatAppUtil = {
  isDev(): boolean {
    const accountInfo = wx.getAccountInfoSync();
    return accountInfo.miniProgram.envVersion === 'develop';
  },
  
  getAvailablePaymentMethods(): string[] {
    const baseMethods = ['WECHAT', 'CASH', 'BANK_TRANSFER'];
    return this.isDev() ? [...baseMethods, 'OTHER'] : baseMethods;
  }
};
```

### 2. 支付状态轮询
```typescript
// 小程序特有的支付状态轮询
class PaymentStatusPoller {
  private orderId: string;
  private maxAttempts: number = 30;
  private currentAttempt: number = 0;
  
  constructor(orderId: string) {
    this.orderId = orderId;
  }
  
  startPolling(): void {
    const poll = () => {
      this.currentAttempt++;
      
      wx.request({
        url: `${API_BASE}/orders/${this.orderId}/status`,
        success: (res) => {
          if (res.data.status === 'paid') {
            this.handlePaymentSuccess();
          } else if (this.currentAttempt < this.maxAttempts) {
            setTimeout(poll, 1000);
          } else {
            this.handlePaymentTimeout();
          }
        },
        fail: () => {
          if (this.currentAttempt < this.maxAttempts) {
            setTimeout(poll, 1000);
          } else {
            this.handlePaymentError();
          }
        }
      });
    };
    
    poll();
  }
  
  private handlePaymentSuccess(): void {
    wx.showToast({
      title: '支付成功',
      icon: 'success'
    });
    
    setTimeout(() => {
      wx.navigateTo({
        url: `/pages/order-detail/orderDetail?id=${this.orderId}`
      });
    }, 1500);
  }
}
```

### 3. 错误处理机制
```typescript
// 小程序支付错误处理
export class WeChatPaymentErrorHandler {
  static handlePaymentError(error: any): void {
    let message = '支付失败，请重试';
    
    switch (error.errMsg) {
      case 'requestPayment:fail cancel':
        message = '支付已取消';
        break;
      case 'requestPayment:fail':
        message = '支付失败，请检查网络连接';
        break;
      default:
        message = error.errMsg || message;
    }
    
    wx.showModal({
      title: '支付失败',
      content: message,
      showCancel: false
    });
  }
}
```

---

## 🧪 测试策略

### 1. 环境测试
- **开发环境**: 测试所有支付方式
- **生产环境**: 验证支付方式限制
- **环境切换**: 测试环境控制逻辑

### 2. 支付流程测试
- **微信支付**: 完整支付流程测试
- **现金支付**: 页面跳转和信息显示
- **银行转账**: 参考号生成和信息展示
- **网页支付**: 链接生成和跳转处理

### 3. 用户体验测试
- **支付方式选择**: 界面友好性测试
- **状态显示**: 不同状态下的显示效果
- **错误处理**: 异常情况的用户提示

---

## 🎯 总结

微信小程序支付系统与标准实时支付系统的主要区别：

### 1. 环境限制 ⭐⭐⭐⭐⭐
- 受微信小程序政策限制
- 需要环境控制机制
- 支付方式选择受限

### 2. 用户体验 ⭐⭐⭐⭐⭐
- 针对小程序环境优化
- 简化支付流程
- 提供清晰的支付指引

### 3. 技术实现 ⭐⭐⭐⭐⭐
- 小程序特有的API调用
- 状态轮询机制
- 跨平台支付处理

### 4. 合规性 ⭐⭐⭐⭐⭐
- 严格遵守微信政策
- 数据安全要求
- 用户隐私保护

---

*最后更新: 2025-01-12*
*版本: 1.0.0*
*状态: 设计完成，待实施*
*架构: 微信小程序专用支付系统*
*重点: 环境控制 + 合规性 + 用户体验优化*