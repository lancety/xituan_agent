# 支付现状：按平台 / 端实装 + 异常处理

Last updated: 2026-10-16

> **权威文档**。旧总览与 Airwallex 时代方案见 [README.md](./README.md)「历史文档」表；细节冲突时以本文与源码为准。

---

## 1. 背景与结论

| 域 | PSP | 说明 |
|----|-----|------|
| 零售订单在线 | **商户 Stripe Connect** + **商户 OmiPay** | `PspRouterService` 按商户配置与 `checkoutPaymentMethod` 路由 |
| 零售线下 | 无 PSP | 现金 / 银行转账 → 下单 `COMMITTED` |
| 订阅（平台账单） | **平台 Stripe** + **平台 OmiPay**（`OMI_*` 环境变量） | 月订 Stripe；预付可 Stripe 或 OmiPay |
| Airwallex | 遗留 | 枚举 / 未匹配 webhook 回放仍可能出现；**不再**作为 `createPaymentIntent` 新轨 |

客户端识别：`POST /api/payment_intents/create` 使用 `body.client` 或请求头 **`X-Client-Kind`**：`site` | `mini_program` | `customer_app` | `merchant_app`。

成功确认通式：**PSP Webhook 落库为主** + 客户端 **订单 / bulk 状态轮询**（防 webhook 延迟）。废弃：`GET /api/payment_intents/:id`、客户端 confirm-intent → **410**。

---

## 2. 按端：零售订单结账

### 2.1 总表

| 端 | 微信 / 支付宝 | 卡 / Apple / Google | 现金 / 转账 |
|----|---------------|---------------------|-------------|
| 微信小程序 | OmiPay 小程序单 → `wx.requestPayment` | 若返回 Stripe → 引导去网页 | 下单 COMMITTED，信息页 |
| Site | OmiPay QR / JSAPI，或商户配置 Stripe 微信支付宝 | Stripe Connect Elements | 通常无在线 intent |
| Customer App | OmiPay **MakeAPPOrder** | Stripe Connect Payment Sheet | 指引页 + 公开转账信息 API |
| Merchant App | **无** C 端订单收银 | — | — |
| CMS | 无 C 端收银（配置 Connect / OmiPay 入驻） | — | — |

### 2.2 微信小程序（`xituan_wechat_app`）

| 项 | 内容 |
|----|------|
| PSP | 在线仅 **OmiPay**（`makeMiniProgramOrder` → `miniProgramPayParams`） |
| 关键页 | `packageTrade/pages/payment/payment.ts`；轮询 `packageTrade/lib/payment-polling.util.ts` |
| 流程 | openid → `POST /api/payment_intents/create`（`X-Client-Kind: mini_program`）→ `wx.requestPayment` → 短轮询 `GET /api/orders/:orderId/status` |
| 成功确认 | OmiPay webhook `/api/webhooks/omipay/:webhookKey` + 订单状态轮询 |

### 2.3 Site（`xituan_site`）

| 项 | 内容 |
|----|------|
| PSP | Stripe Connect（卡 / Apple / Google；可选微信支付宝 Stripe 轨）；OmiPay Dedicated → QR 或 H5 JSAPI |
| 关键 | `src/services/payment.service.ts`；页 `PaymentPageClient.tsx`；Stripe `StripeCheckoutBlock.tsx` |
| 流程 | `createPaymentIntent`（`client=site`）→ Elements / 展 QR / H5 跳转 → 回站后轮询订单状态（约 15×1s） |
| 成功确认 | Stripe `/api/webhooks/stripe` 或 OmiPay 商户 webhook + 轮询 |

### 2.4 Customer App（`xituan_app_customer`）

| 项 | 内容 |
|----|------|
| PSP | 微信/支付宝：**商户 OmiPay MakeAPPOrder**；卡/Apple/Google：**Stripe Connect** |
| 关键 | `PaymentScreen.tsx`；`consumer-payment.api.ts`；`consumer-omipay-pay.util.ts` / `consumer-stripe-pay.util.ts` |
| OmiPay | create-intent → `expo-native-wechat` / `xituan-alipay` → `pollOrderPaid`（约 20×1s） |
| Stripe | create-intent → Payment Sheet；**SDK `paid` 即 UI 成功**，业务落库仍靠 webhook（manual capture 可能 `pending_capture`） |
| 线下 | `COMMITTED`；转账详情 `GET /api/merchants/retail-bank-transfer-details` |

### 2.5 Merchant App / CMS（零售）

- Merchant App：**不做**顾客订单在线收银。
- CMS：商户收款配置（Stripe Connect Embedded、OmiPay 入驻）；见 [omipay-onboarding-apply.md](../omipay-onboarding-apply.md)。

---

## 3. 按端：订阅（平台账单）

| 场景 | 端 | PSP | 拉起方式 | 确认 |
|------|----|-----|----------|------|
| 月订 / 绑卡 / 换套餐 | CMS | 平台 Stripe | Elements / SetupIntent（`StripeSubscriptionPayment.tsx`） | `/api/webhooks/stripe-subscription` + 前端 confirm |
| 预付（扫码） | CMS | 平台 OmiPay 或 Stripe | QR / Stripe 一次性 | OmiPay：`/api/webhooks/omipay-subscription` + 轮询 + `confirm-bulk` |
| 预付（App） | Merchant App | 平台 Stripe **或** OmiPay | Stripe PaymentSheet / 微信·支付宝原生 SDK | Stripe：`confirm-bulk`；OmiPay：webhook + `bulk-payment-status` 轮询 + `confirm-bulk` |
| 月订开通 / 预约 / 恢复 | Merchant App | 平台 Stripe | **PaymentSheet**（PI / SetupIntent，与 CMS Element 同源 intent） | Sheet 成功后 `confirm-recurring` + webhook |
| 换套餐（含补差价） | Merchant App | 平台 Stripe | 预览 Modal → `changePlan` → 可选 PaymentSheet → `confirm-change-plan` | 同 CMS |
| 账单门户 | CMS / Merchant 状态卡 | Stripe Customer Portal | 跳转 URL / App `WebBrowser` | Stripe 侧 |

**Merchant App 预付调用链（摘要）**

1. `POST /api/admin/subscription/bulk-purchase`（`client: merchant_app`；`provider: STRIPE` 或 `OMIPAY` + `omipayAppPlatform`）
2. Stripe：`merchant-stripe-subscription-pay.util` PaymentSheet → `confirm-bulk`；OmiPay：`merchant-omipay-pay.util` 钱包 → `bulk-payment-status` 轮询 → `confirm-bulk`

**Merchant App 月订 / 换套餐（摘要）**

1. `subscribe` / `resume-recurring` / `change-plan-preview` + `changePlan`（Admin API，与 CMS 相同）
2. `merchant-stripe-subscription-pay.util` → PaymentSheet（**平台** publishableKey，无 Connect `stripeAccountId`）
3. `confirm-recurring` 或 `confirm-change-plan`
4. 生产日志前缀：`[StripeSub]`（取消/失败稳定 code）；预付钱包仍用 `[WalletPay]`

关键文件：`MerchantBulkPrepaidCheckoutModal.tsx`、`SubscriptionPlansScreen.tsx`、`merchant-stripe-subscription-pay.util.ts`、`merchant-subscription.api.ts`；后端 `OmipayOneTimeAdapter` / `StripeRecurringAdapter`、`admin-subscription.controller.ts`。

**后续步骤（未进本版）：** App 月订/换套餐 **recurring 优惠券** UI（`promotionCode`）。

---

## 4. 后端关键入口

| 类别 | 路径 / 模块 |
|------|-------------|
| 创建 intent | `POST /api/payment_intents/create` → `payment.controller.ts` → `psp-router.service.ts` |
| 订单状态 | `GET /api/orders/:orderId/status` |
| 零售 Stripe webhook | `POST /api/webhooks/stripe` |
| 零售 OmiPay webhook | `POST /api/webhooks/omipay/:webhookKey` |
| 订阅 Stripe / OmiPay webhook | `.../stripe-subscription`、`.../omipay-subscription` |
| 订阅 Admin | `/api/admin/subscription/*`（subscribe、bulk-purchase、confirm-bulk、billing-portal 等） |
| 归一化落单 | `payment.handler.service.ts`（订单）；订阅 adapter + webhook controller |

**契约枚举（codebase，勿在文档硬编码值列表）**

| 枚举 | 用途 |
|------|------|
| `epPaymentMethod` | 结账选项（wechat / alipay / cash / bank_transfer / apple_pay / …） |
| `epPaymentStatus` | 含 `COMMITTED`、`PENDING_CAPTURE` 等 |
| `epPaymentProvider` | stripe / omipay /（遗留 airwallex） |
| `epPaymentRecordMethod` | 流水通道 STRIPE_* / OMIPAY_* / MANUAL_* |
| `epSubscriptionPaymentProvider` | 订阅 STRIPE / OMIPAY |

---

## 5. 异常处理（回顾分析用）

### 5.1 原则

| 层级 | 做法 |
|------|------|
| API 业务失败 | `BusinessError` + `eBusinessErrorCode`；响应 **无**面向用户的固定中文（客户端 i18n） |
| 钱包 SDK | 映射为 **稳定 code**（如 `CANCELLED`、`WECHAT_COMMON_ERROR`）；toast 用 i18n，**禁止**直接展示 `native wechat -2 null` |
| 生产排障 | 结构化 `console.warn('[WalletPay]', …)`；后端 create-intent / webhook 打 sanitized 日志 |

### 5.2 后端（零售 create-intent / 订单）

常见 `BusinessError`（非穷尽，以 `eBusinessErrorCode` 为准）：

| 方向 | 示例 code |
|------|-----------|
| 参数 / 配置 | `INVALID_REQUEST_PARAMETER`（金额、openid、Stripe/OmiPay 未就绪等，`errorData.details` 偏运维） |
| 风控 | `USER_PAYMENT_LOCKED` |
| 订单行 | `ORDER_ITEM_INVALID` / `ORDER_ITEMS_INVALID`（集合用 lineErrors） |
| 活动窗口 | `ACTIVITY_PAYMENT_NOT_STARTED` / `ENDED`、`OFFER_TIME_INVALID` 等 |
| 商户路由 | `MERCHANT_OMIPAY_DEDICATED_ROUTE_NOT_READY` 等 |
| 兜底 | 非 BusinessError → 按控制器约定失败响应 |

**日志（便于 grep）**

- `[createPaymentIntent] api payload (sanitized):`
- `[createPaymentIntent] OmiPay order create (sanitized):`（含 notifyUrl、clientKind）
- Stripe / OmiPay webhook：event id、未匹配、replay 结果
- 微信 `code2session` 凭证类错误（如 40125）

订阅侧另有 `SUBSCRIPTION_*`、`OMIPAY_ONBOARDING_*` 等；CMS 用 `subscription-error-message.util` 等映射展示。

### 5.3 钱包 SDK 映射（Expo Merchant / Customer）

| 来源 | 原始信号 | 稳定 code（示例） | 用户 toast 方向 |
|------|----------|-------------------|-----------------|
| 微信 `errCode` | `-2` | `CANCELLED` | 已取消支付 |
| 微信 | `-1` | `WECHAT_COMMON_ERROR` | 参数/签名类失败 |
| 微信 | `-3` / `-4` / `-5` | `WECHAT_SEND_FAILED` / `AUTH_DENIED` / `UNSUPPORTED` | 对应简短文案 |
| 微信 | 其它非 0 | `WECHAT_PAY_FAILED` | 微信支付失败 |
| 支付宝 `resultStatus` | `6001` | `CANCELLED` | 已取消 |
| 支付宝 | `4000` / `5000` / `6002` / `6004` | `ALIPAY_ORDER_FAILED` 等 | 订单失败 / 重复 / 网络 / 结果未知 |
| 前置 | 未安装、未配置、order_string 空/非法 | `WECHAT_NOT_INSTALLED` 等 | 对应文案 |
| 支付宝 | SDK 未集成 | `ALIPAY_SDK_NOT_INTEGRATED` | 改用微信或稍后 |

实现文件：

- Merchant：`merchant-wallet-pay-error.util.ts`、`merchant-omipay-pay.util.ts`；预付 Modal 用 `toastI18nKey`
- Customer：`consumer-wallet-pay-error.util.ts`、`consumer-omipay-pay.util.ts`；`PaymentScreen` 同上

### 5.4 生产日志：`[WalletPay]`

每条映射结果打 **`console.warn('[WalletPay]', { … })`**（取消也会记，便于统计取消率）：

| 字段 | 含义 |
|------|------|
| `channel` | `wechat` \| `alipay` |
| `code` | 上表稳定 code |
| `canceled` | 是否用户取消 |
| `rawErrCode` | 微信原始 errCode（若有） |
| `rawStatus` | 支付宝 resultStatus（若有） |
| `rawMessage` | 截断后的原始文案（≤200） |

**不写** `order_string`、prepay 签名、完整 openid 等敏感字段。

设备日志 / 崩溃上报中搜：`[WalletPay]`。

### 5.5 各端 UI 异常方式摘要

| 端 | 业务 API 错误 | 钱包 / PSP 拉起失败 | 备注 |
|----|---------------|---------------------|------|
| Customer App | 多走支付页 FAILED；BusinessError 按 code | `[WalletPay]` + i18n toast | 取消 → toast「已取消」并回 PENDING |
| Merchant App 预付 | toast API message / 业务码 | 同上 wallet util | 取消与失败均 toast，不露出原生串 |
| Merchant App 月订/换套餐 | Admin BusinessError message/code | PaymentSheet → `[StripeSub]` + `subscription.stripePay.*` | 成功后 confirm-recurring / confirm-change-plan |
| 微信小程序 | `SimpleErrorHandler` / `CommonErrorHandlers`（code → modal） | `wx.requestPayment` fail 用 `errMsg` 类提示 | 与 Expo 映射 util 尚未完全统一 |
| Site | `eBusinessErrorCode` → 页面文案 | Stripe/OmiPay 页内 error state + 轮询失败提示 | |
| CMS 订阅 | `ApiBusinessError` + subscription 文案 util | Stripe `error.message`；OmiPay 轮询超时提示 | |
| Backend | `toApiResponse()`；不向客户端塞 locale 文案 | Webhook 失败记日志 / 未匹配可 replay | 见测试清单 webhook 节 |

跨端业务错误形状（A/B/AB）见 [../cross-client-business-error-handling.md](../cross-client-business-error-handling.md)；支付行集合校验遵循 `lineErrors` 约定。

### 5.6 排障速查

| 现象 | 先查 |
|------|------|
| App 取消后出现 `native wechat -2 null` | 旧包未含 wallet 映射；新包应 toast「已取消」且日志 `code: CANCELLED, rawErrCode: -2` |
| SDK 成功但订单仍未付 | webhook 是否到达、商户 `webhookKey` / 订阅 notifyUrl、客户端轮询是否超时 |
| 小程序无法支付 | openid、OmiPay 小程序配置、`X-Client-Kind: mini_program`、平台/商户支付能力 410 |
| Site 卡支付失败 | Connect 账户、Elements clientSecret、Stripe webhook |
| 预付 App 已付未开通 | `bulk-payment-status`、`confirm-bulk`、omipay-subscription webhook |
| create-intent 400 | 响应 `error.code` + `details`；对照金额与订单 `chargedAmount` |

---

## 6. 关键源码索引

| 领域 | 路径 |
|------|------|
| 创建 intent / 410 | `xituan_backend/src/domains/payment/controllers/payment.controller.ts` |
| PSP 路由 | `.../services/psp-router.service.ts` |
| OmiPay / Stripe 零售实现 | `omipay-platform-payment.service.ts`、`stripe-platform-payment.service.ts` |
| 订阅 OmiPay 预付 | `xituan_backend/src/domains/subscription/providers/omipay/omipay-onetime.adapter.ts` |
| 小程序支付页 | `xituan_wechat_app/packageTrade/pages/payment/payment.ts` |
| Site 支付页 | `xituan_site/src/app/[locale]/(consumer)/payment/PaymentPageClient.tsx` |
| Customer 支付 | `xituan_app_customer/src/screens/PaymentScreen.tsx` |
| Merchant 预付 | `xituan_app_merchant/src/components/subscription/MerchantBulkPrepaidCheckoutModal.tsx` |
| CMS 订阅 UI | `xituan_cms/src/components/subscription/BulkPrepaidCheckoutModal.tsx`、`StripeSubscriptionPayment.tsx` |

---

## 7. 相关文档

- [README.md](./README.md) — 本目录索引与历史文档表
- [../stripe-omipay-rail-manual-test-checklist.md](../stripe-omipay-rail-manual-test-checklist.md) — 人工回归清单
- [../omipay-onboarding-apply.md](../omipay-onboarding-apply.md) — OmiPay 入驻
- [../commitment-payment-design.md](../commitment-payment-design.md) — 承诺支付设计
- [../cross-client-business-error-handling.md](../cross-client-business-error-handling.md) — 跨端业务错误展示
- [../platform-subscription-billing-devplan.md](../platform-subscription-billing-devplan.md) — 订阅计费规划（若与现状冲突，以本文订阅节 + 源码为准）
