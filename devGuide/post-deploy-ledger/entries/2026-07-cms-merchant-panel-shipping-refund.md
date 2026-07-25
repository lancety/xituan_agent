# CMS：退运费 — 订单编辑模组 + 活动排号 modal

Last updated: 2026-07-25

| Field | Value |
|-------|-------|
| **ID** | `cms-merchant-panel-shipping-refund` |
| **Status** | `planned` |
| **Deployed** | WeChat 商户面板代码已落地（待发版确认）；CMS 未做 |
| **Pending** | Phase CMS：两入口对齐退运费 + 共用 ManualRefundModal |
| **Gate (CMS 可收尾)** | WeChat 退运费 smoke 通过；CMS 两入口上线且共用同一退款组件 |
| **Created** | 2026-07-25 |

## Background

微信「我的网店」已实现退运费（金额明细 + 运费左侧按钮 + 处理退款预填 enum 原因）。CMS 需在 **两个入口** 对齐交互，并复用同一套退款处理组件。

**CMS 仅两入口（不含独立「订单列表行」第三入口）：**

1. **订单列表 → 订单编辑模组**（`OrderEditModal`）
2. **活动相关订单查看 / 排号 modal**（`ActivityOrderDetailModal`）

**无 DB migration**；`reason` 存 enum 字符串；历史非 enum 原样展示。

---

## CMS 产品约定（本阶段）

### 金额区（两入口已有运费等信息）

- **不新增**「已收款 / 已退款 / 付款余额」显示（与微信六行不同；CMS 本阶段刻意省略）。
- 沿用现有商品总额 / 运费 / 应付等展示即可。

### 退运费按钮

- **位置**：运费**金额左侧**（两入口一致）。
- **显示**：`deliveryFee > 0` 且订单可退款（已支付 / 部分退款，与现有退款入口口径一致）。
- **点击**：
  1. 疑似已退过运费 → 二次确认「继续」；
  2. 打开共用 `ManualRefundModal`；
  3. 预填金额 = `min(deliveryFee, remainingRefundable)`；
  4. 预填原因 = `epMerchantPanelRefundReason.COMBINED_ORDERS_SHIPPING_REFUND`。

### 疑似已退运费判定（与微信一致）

SETTLED 的 `REFUND` / `PARTIAL_REFUND`，命中任一：

- 金额（`refundAmount ?? amount`）与 `deliveryFee` 相差 `< 0.001`
- `reason === epMerchantPanelRefundReason.COMBINED_ORDERS_SHIPPING_REFUND`

### 共用退款组件：`ManualRefundModal`

| 入口 | 现状 | 待做 |
|------|------|------|
| **订单编辑模组** | 已有「处理退款」→ `ManualRefundModal` | ① 运费左侧「退运费」打开同一 modal 并预填；② **补上原因快捷选择 chip**（现无） |
| **活动排号 modal** | 无退款组件；已有「支付方式」「支付记录」等区块 | ① 运费左侧「退运费」；② 在「支付方式 / 支付记录」标题**同级最下方**增加「处理退款」按钮；③ 两者均打开 **同一** `ManualRefundModal`（退运费带预填） |

**「处理退款」显示口径（已确认）：** 与 `OrderEditModal` 现有逻辑一致——存在可退的已结算支付时才显示（与退运费按钮的支付状态/可退口径对齐）。不可退时不展示按钮，不依赖点开后再由 API 报错。

`ManualRefundModal` 增强：

- 支持 `initialAmount` / `initialReason`（enum value）预填。
- 增加原因快捷 chip：提交存 enum value；**展示文案走 CMS `t(...)` i18n**（messages 按 enum key 配文案；存库仍为 enum value，不存中文）。
- 「可能已退过运费」二次确认文案同样走 `t(...)`。
- 自由输入非 enum → 原样提交；空原因默认 `MERCHANT_MANUAL`。
- 普通「处理退款」打开时 **不**预填，避免污染。
- codebase 的 `MERCHANT_PANEL_REFUND_REASON_LABEL_ZH` 可作为文案参考/默认中文，但 CMS UI **不以该 map 直接渲染**，以免绕过 i18n。

### 退款原因 enum

Codebase：`typing_entity/merchant-panel-refund-reason.enum.ts`

| Enum | 存库 value | 显示 |
|------|------------|------|
| `CUSTOMER_CANCEL_ORDER` | `customer_cancel_order` | 客户取消订单 |
| `DUPLICATE_PAYMENT` | `duplicate_payment` | 重复付款 |
| `PRODUCT_OUT_OF_STOCK` | `product_out_of_stock` | 商品缺货 |
| `WRONG_OR_MISSING_SHIPMENT` | `wrong_or_missing_shipment` | 发错/漏发 |
| `CUSTOMER_NEGOTIATED` | `customer_negotiated` | 客户协商退款 |
| `ACTIVITY_CHANGED` | `activity_changed` | 活动变更 |
| `COMBINED_ORDERS_SHIPPING_REFUND` | `combined_orders_shipping_refund` | 多单合并退运费 |
| `MERCHANT_MANUAL` | `merchant_manual` | 商户手动退款 |

禁止中文存库；CMS 展示经 `t(enumValue)`；支付历史等读侧：能映射 enum 则用 i18n，否则原样显示。

**已确认决策（2026-07-25）：**

1. 排号 modal「处理退款」显示 = 与订单编辑模组可退口径一致。
2. chip / 二次确认文案 = CMS i18n（`t(...)`），不硬编码中文、不直接绑 `LABEL_ZH`。

---

## Phase map

| Phase | Scope | Deploy | Verify |
|-------|-------|--------|--------|
| **WeChat（代码已做）** | 商户金额弹层 + 退运费 + reason enum；backend 空原因默认 enum | 随 wechat/backend 发版 | WeChat smoke |
| **CMS** | `OrderEditModal` + 活动排号 modal + 增强 `ManualRefundModal` | 待排期 | 两入口退运费/处理退款均走同一 modal |

## Post-deploy debt

### WeChat prod confirm

- [ ] 运费左侧退运费；预填金额+enum 原因；二次确认；普通退款无预填污染
- [ ] 空原因落库 `merchant_manual`；支付历史 enum→中文 / 旧中文原样

### CMS 移植（主待办）

- [x] **`ManualRefundModal`**：原因快捷 chip（`t` i18n）+ `initialAmount` / `initialReason` 预填；二次确认文案 i18n
- [x] **订单编辑模组**（`OrderEditModal`）：运费金额左侧「退运费」→ 共用 modal 预填；现有处理退款继续无预填打开
- [x] **活动排号 modal**（`ActivityOrderDetailModal`）：运费左侧「退运费」；支付区块同级最下「处理退款」（仅可退时显示）；均复用 `ManualRefundModal`
- [x] 两入口：**不**加已收/已退/余额行
- [x] CMS messages 补齐各 `epMerchantPanelRefundReason` 文案 key（zh_cn / zh_tw / en）
- [ ] CMS 生产 / 本地 smoke：两入口退运费预填与二次确认；普通处理退款无预填污染
- [ ] Entry → `done`；registry 归档（smoke 通过后）

## 参考路径

| 用途 | 路径 |
|------|------|
| CMS 订单编辑 | `xituan_cms/src/components/orders/OrderEditModal.tsx` |
| CMS 退款 modal | `xituan_cms/src/components/orders/ManualRefundModal.tsx` |
| CMS 活动排号 modal | `xituan_cms/src/components/activity-orders-expand/ActivityOrderDetailModal.tsx` |
| 原因 enum | `xituan_codebase/typing_entity/merchant-panel-refund-reason.enum.ts` |
| 微信退运费参考 | `xituan_wechat_app/packageMerchant/.../merchant-panel-order-*-modal/`、`merchant-panel-order-refund.wechat.util.ts` |

## Links

- 巡检：[`../registry.md`](../registry.md)
