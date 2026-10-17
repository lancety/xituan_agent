# 支付（Payment）文档索引

Last updated: 2026-10-16

本目录为 **当前实装（as-is）** 支付文档的权威入口。历史方案、Airwallex 遗留设计、早期总览仍保留在上级 `devGuide/` 根目录，以本目录链接为准，避免两处各写一份细节。

## 文档结构

| 文档 | 用途 |
|------|------|
| [current-state.md](./current-state.md) | **现状总览**：按平台/端的 PSP 轨、调用链、成功确认；各端与后台异常处理与生产排障 |
| [../stripe-omipay-rail-manual-test-checklist.md](../stripe-omipay-rail-manual-test-checklist.md) | Stripe / OmiPay 换轨与线下支付 **人工测试清单** |
| [../omipay-onboarding-apply.md](../omipay-onboarding-apply.md) | CMS / Platform OmiPay 入驻申请 |
| [../commitment-payment-design.md](../commitment-payment-design.md) | 现金 / 银行转账「承诺支付」设计（理念；实现以 `order.service` `COMMITTED` 为准） |

## 一句话现状

- **零售订单在线**：商户 **Stripe Connect** + 商户 **OmiPay**（`PspRouterService`）；客户端拉起 + PSP webhook + `GET /api/orders/:id/status` 轮询。
- **订阅**：平台 **Stripe**（月订 / 换套餐 PaymentSheet）+ 平台 **OmiPay**（预付 MakeAPPOrder）；CMS 仍用 Elements/QR；Merchant App 月订与 CMS 同源 Admin API。
- **现金 / 转账**：无 PSP intent；下单即 `paymentStatus=COMMITTED`。
- **Airwallex**：枚举与部分 webhook 回放仍可见；**新单 create-intent 不再走 Airwallex**。

## 历史 / 部分过时文档（只读参考）

| 文件 | 说明 |
|------|------|
| [../payment-system.md](../payment-system.md) | 早期总设计；理念可用，枚举/PSP 细节以 current-state 为准 |
| [../payment-wechat-app-pay.md](../payment-wechat-app-pay.md) | 小程序支付早期方案；现网以 OmiPay + `payment.ts` 为准 |
| [../payment-service-architecture-refactor.md](../payment-service-architecture-refactor.md) | Webhook/Handler 拆分（Airwallex 中心时代） |
| [../payment-refactor-summary.md](../payment-refactor-summary.md) | Airwallex 文件重命名归档 |
| [../merged-payment-design.md](../merged-payment-design.md) / [../merged-payment-airwallex-saas-flow.md](../merged-payment-airwallex-saas-flow.md) | 合并支付 / Airwallex SaaS（后者 stale） |
| [../airwallex-merchant-owned-payment-phased-design.md](../airwallex-merchant-owned-payment-phased-design.md) 等 | Airwallex 分阶段 / 费率 / webhook 运维 — **新轨勿当实施依据** |
