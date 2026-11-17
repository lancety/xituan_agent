# merchant-ios-iap-pay-restore

Last updated: 2026-11-17

## 摘要

Merchant App 为过审关掉的 iOS 订阅购买 / PassKit，在上架 **IAP** 时按清单恢复。**mid**。  
**不要**把 Stripe Apple Pay 再开回 iOS 订阅结账。Cursor plan：[`ios_iap_pay_restore_e3b4d099.plan.md`](../../../../.cursor/plans_planned/ios_iap_pay_restore_e3b4d099.plan.md)；本轮接线 plan：`~/.cursor/plans/expo-iap_storekit_wire_d504b404.plan.md`。

## 当前掌握的信息

- Connect：4 月订 + 12 Non-Renewing 已建完（见 `xituan_agent/docs/ios-iap-connect-product-checklist.md`）。
- IAP API Key 已申请；`APPLE_IAP_*` 写入 backend env（dev/prod 同一套）。
- 现状进展：`expo-iap` + `merchant-iap-storekit.util` + Modal（仅 `activated` 后 finish）+ `AppleIapVerifyService` JWS/API 验票与幂等开权益已落地；需本地 `build:local:ios` + 沙盒实测。
- PassKit 来自 `@stripe/stripe-react-native` + `merchantIdentifier`；订阅结账 iOS 走 IAP，不走 Stripe。

## 期望目标结果

### 计划要做的（IAP 启动时）

- [x] App Store Connect 订阅商品 + IAP 后端校验（`POST /api/admin/subscription/verify-apple-iap`）
- [x] StoreKit / expo-iap 拉价、购买、恢复、finish（验票成功后）
- [ ] 端到端沙盒购买验证（你本地 `build:local:ios`）
- [ ] `allowsInAppPurchase()` / 订阅页 CTA / i18n 收尾核对（若仍有「本版不可购」残留）
- [ ] Review Notes：商业模式与 IAP 路径；生产首发随版本提审
- [ ] Paid Apps 银行核实后正式销售

### 明确不做

- 恢复 Stripe-on-iOS 订阅结账以「绕过 IAP」
- Customer App 实物 Apple Pay（不在本条）
- Connect zh-Hans 本地化（可选后续）

## 触发条件 / 目标窗口

**mid**。Connect + 代码接线已齐；剩余沙盒实测与提审 / Paid Apps。
