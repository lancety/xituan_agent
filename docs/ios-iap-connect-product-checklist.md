# App Store Connect IAP 建品进度（喜团运营）

订阅组：`Xituan Merchant Plans`（ID `22587772`）  
Product ID 规则：`au.com.xituan.merchant.sub.{plan}.{monthly|prepaid3|prepaid6|prepaid12}`  
Non-Renewing 入口：Subscriptions → **Non-Renewing Subscriptions** → Manage（不是 In-App Purchases 的 Create）

## 已完成 — 自动续订月订

| Product ID | AU 价 | 状态 |
|------------|-------|------|
| `…full_pro.monthly` | $194.99 | 可用性 + 价 + en-AU |
| `…full_lite.monthly` | $113.99 | 可用性 + 价 + en-AU |
| `…online_starter.monthly` | $79.90 | 可用性 + 价 + en-AU |
| `…supplier.monthly` | $56.90 | 可用性 + 价 + en-AU |
| Group display en-AU | — | `Xituan Merchant Plans` |

## 已完成 — Non-Renewing 预付（12/12）

| Reference | Product ID | 建议档 | Connect 实选 AU | 状态 |
|-----------|------------|--------|-----------------|------|
| Supplier Prepaid 3 | `…supplier.prepaid3` | $160.99 | **$164.99** | 可用性 + 价 + en-AU |
| Supplier Prepaid 6 | `…supplier.prepaid6` | $304.99 | **$309.99** | 可用性 + 价 + en-AU |
| Supplier Prepaid 12 | `…supplier.prepaid12` | $574.99 | **$579.00** | 可用性 + 价 + en-AU |
| Online Starter Prepaid 3 | `…online_starter.prepaid3` | $226.99 | **$229.00** | 可用性 + 价 + en-AU |
| Online Starter Prepaid 6 | `…online_starter.prepaid6` | $428.99 | **$429.00** | 可用性 + 价 + en-AU |
| Online Starter Prepaid 12 | `…online_starter.prepaid12` | $809.99 | **$809.99** | 可用性 + 价 + en-AU |
| Full Lite Prepaid 3 | `…full_lite.prepaid3` | $324.99 | **$329.00** | 可用性 + 价 + en-AU |
| Full Lite Prepaid 6 | `…full_lite.prepaid6` | $614.99 | **$619.00** | 可用性 + 价 + en-AU |
| Full Lite Prepaid 12 | `…full_lite.prepaid12` | $1161.99 | **$1,199.99** | 可用性 + 价 + en-AU |
| Full Pro Prepaid 3 | `…full_pro.prepaid3` | $553.99 | **$559.00** | 可用性 + 价 + en-AU |
| Full Pro Prepaid 6 | `…full_pro.prepaid6` | $1049.99 | **$1,049.99** | 可用性 + 价 + en-AU |
| Full Pro Prepaid 12 | `…full_pro.prepaid12` | $1982.99 | **$1,799.99** | 可用性 + 价 + en-AU；**AUD Non-Renewing 价签矩阵上限 $1,799.99，低于建议档** |

> Non-Renewing / IAP 价签矩阵与自动续订档位不同：建议价若不在下拉里，选 **≥ 建议价的最近 IAP 档**。Description 上限约 55 字符。入口：See Additional Prices 再搜。

## 待建 — Non-Renewing

（无）Connect 16 SKU（4 月订 + 12 预付）壳/价/en-AU 已齐。

## 操作要点

1. 月订：Subscriptions 组内建；搜不到价 → **See Additional Prices**。
2. 预付：Non-Renewing Subscriptions；价常在 **See Additional Prices**；无建议档则取列表中 ≥ 建议价档；矩阵触顶则取最高档并记笔记。
3. 基准国 **Australia (AUD)**。
4. 每 SKU 至少一条 **English (Australia)** Display Name + Description。
5. 勿把文案填进 Review Notes。
6. 首个自动续订 / 首个 Non-Renewing 均需随新版本提交审核。
7. Paid Apps Agreement 银行核实后才可正式销售。

## 后续（非 Connect 建品）

- [x] StoreKit / expo-iap 拉价与购买接线 + 后端 App Store Server API 验票（本轮）
- 可选 zh-Hans 本地化
- Paid Apps 银行核实
- 生产首发：首个自动续订 / 首个 Non-Renewing 须随 App 版本提审通过；沙盒测试不必等审核

## Backend env（dev/prod 同一套 Key）

```
APPLE_IAP_ISSUER_ID=
APPLE_IAP_KEY_ID=
APPLE_IAP_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
# optional
APPLE_IAP_BUNDLE_ID=au.com.xituan.merchant
APPLE_IAP_APP_APPLE_ID=   # Production SignedDataVerifier 需要；纯沙盒可空
```

私钥备份：`D:\download\SubscriptionKey_*.p8`（Connect 仅可下载一次）。Root CA：`xituan_backend/resources/apple-root-cas/`。
