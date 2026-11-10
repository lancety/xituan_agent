# auspost-mypost-oauth-pickup

Last updated: 2026-11-09

## 摘要

MyPost **OAuth 一键连接（生产）** + **Pickup 上门取件（Phase 2）**。**high / planned**；与 CMS/App MVP 出标主链路解耦。

父项：[`./2026-11-auspost-mypost-dual-track.md`](./2026-11-auspost-mypost-dual-track.md)  
Cursor plan：`d:/projects/xituan_module/.cursor/plans_planned/csv_mode_retention_0ed474ac.plan.md`

## 当前掌握的信息

- Core 已留 `exchangeOAuthCode` 骨架；**testbed 无 OAuth**，须 Production Partner 凭证后做。
- 贴 Token 路径永久保留（AusPost 建议）。
- Pickup = 可服务性查询 → 预约 → 与订单/shipment 关联；一期不做。
- Charge Account **不做**（本 entry 不含）。

## 期望目标结果

### 计划要做的

- [ ] OAuth：authorize → code → `/oauth2/token` → 写入 Connection；CMS + App 入口；保留贴 Token
- [ ] Pickup：API 路径上门取件（CMS/App 同构）；与已出标 shipment 关联

### 触发后才做的

- [ ] OAuth — 触发：Production Request 通过、生产 Partner ID / 回调域名就绪
- [ ] Pickup — 触发：国内 API 出标稳定且产品要上门取件

## 触发条件 / 目标窗口

**high** 优先级排队；**不要**阻塞当前 CMS MVP / Sign Off。OAuth 先于或并行于 Pickup 均可，但均以后置窗口启动。
