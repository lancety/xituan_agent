# 1. Lodgement Plan / Product Features / API Calls

Last updated: 2026-11-11

供填写 **MPB Tech Sign Off** §3–§9。实现代码：`xituan_backend/src/domains/auspost-mpb/`。

---

## §3 Lodgement Plan（集成工作流）

商户在 CMS 打包台连接 MyPost Business（粘贴 Partners Token）→ 平台用 Partner 凭证 + 商户 Token 调 MPB。

```text
1) GET  /organisations          — 连接时校验 Token，写入加密 Connection
2) POST /prices/items           — OWN 包装估价（flat-rate 用本地费率表，不调 prices）
3) POST /shipments              — 一次请求可含多包裹（同订单多件合并）
4) PUT  /orders                 — Create Order from Shipments；payment_method=STORED_PAYMENT
5) POST /labels                 — wait_for_label_url=true；layout=A6-1pp 或 A4-4pp
6) DELETE /shipments/{id}       — 建单失败时回滚未入单 shipment；管理 basket
7) GET  /track                  — 运单轨迹状态（终端用户不直打 AusPost）
```

失败策略摘要：估价失败禁止出标；Order 失败则 DELETE 已建 shipment；Labels 失败保留 tracking 并提示商户回 MyPost 后台取标（`AUSPOST_MPB_LABEL_UNAVAILABLE`）。

**不做（本期）**：Create International Shipment、Pickup within Order、Charge Account、OAuth Authorisation Code。

---

## §4 Product Features

| 功能 | 本期 |
|------|------|
| Signature on Delivery | 支持（OWN/适用产品；`features.SIGNATURE_ON_DELIVERY`） |
| Extra Cover | 不支持 |
| Pickup within Order | 不支持 |

国内产品：Own packaging Parcel/Express（testbed `BE1P10` / `BE9P10`）+ AusPost flat-rate box/satchel（`BE1*` / `BE9*` 映射，见代码 `auspost-mpb-product-id.util.ts`）。国际产品：不支持。

标签 layout：

| UI | API `layout` |
|----|----------------|
| A6 | `A6-1pp` |
| A4（一页 4 标） | `A4-4pp` |

---

## §5 API Calls（勾选建议）

**Required / 已实现**

- [x] Get Organisation
- [x] Create Domestic Shipment
- [x] Create Order from Shipments
- [x] Create Label
- [x] Delete Shipment
- [x] Track Items
- [x] Get Item Price（`POST /prices/items`，OWN 路径）

**不勾 / 本期不做**

- Create International Shipment
- Create Payment with Charge Account
- Pickups / Get Label（单独）/ Get Order / Get Shipment / Update Item / Validate Suburb
- Create Order Including Shipments（我们用 Create Order **from** Shipments）
- OAuth（§8 = No）

---

## §6 Create Orders from Shipments

同一确认动作里，订单下多包裹 **一次** `PUT /orders`，`shipments: [{shipment_id}, …]` 合并，避免连续多笔 STORED_PAYMENT。

---

## §7 Pickup

不适用；不勾 §7 限制项以外的承诺。Pickup Phase 2 见 planned-work `auspost-mypost-oauth-pickup`。

---

## §8 OAuth

**No** — 商户 Dashboard 复制 Partners Token；生产 OAuth 后置。

---

## §9 JSON + Labels

见 [`03-sample-payloads/`](./03-sample-payloads/) 与 [`04-label-pdfs/`](./04-label-pdfs/)。
