# merchant-ios-iap-pay-restore

Last updated: 2026-11-11

## 摘要

Merchant App 为过审关掉的 iOS 订阅购买 / PassKit，在上架 **IAP** 时按清单恢复。**mid**。  
**不要**把 Stripe Apple Pay 再开回 iOS 订阅结账。Cursor plan：[`ios_iap_pay_restore_e3b4d099.plan.md`](../../../../.cursor/plans_planned/ios_iap_pay_restore_e3b4d099.plan.md)。

## 当前掌握的信息

- 现状：`allowsInAppPurchase()` 在 iOS 为 false；订阅页/首页购买与外链账单已关。
- PassKit 来自 `@stripe/stripe-react-native` + `merchantIdentifier`；过审构建可去掉 iOS 链入。
- 手动开单里的「Apple Pay」是记账枚举，不是订阅结账。

## 期望目标结果

### 计划要做的（IAP 启动时）

- [ ] App Store Connect 订阅商品 + IAP 后端校验（新接口，待设计）
- [ ] 重做 `allowsInAppPurchase()`：iOS = IAP，非 Stripe
- [ ] `SubscriptionPlansScreen` / 首页订阅卡 CTA；i18n 去掉「本版不可购」
- [ ] `MerchantBulkPrepaidCheckoutModal`：iOS 改为 IAP 呈现（Android 可继续 Stripe）
- [ ] Native：按需加回 StoreKit / IAP；Stripe plugin 仅 Android 或不再用于 iOS 订阅
- [ ] Review Notes：商业模式与 IAP 路径

### 明确不做

- 恢复 Stripe-on-iOS 订阅结账以「绕过 IAP」
- Customer App 实物 Apple Pay（不在本条）

## 触发条件 / 目标窗口

**mid**。产品拍板 Merchant 订阅走 App Store IAP 后再开；可与删号过审解耦。
