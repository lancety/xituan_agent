# shipping_service：订单枚举长名化与旧 PP/EXP 入站别名

Last updated: 2026-09-01

| 字段 | 值 |
|------|-----|
| **ID** | `shipping-service-pp-exp-alias` |
| **状态** | `planned` |
| **当前已部署** | — |
| **待完成** | Phase 1（长名落库 + 入站双读）→ Phase N（删 backend 入站 PP/EXP fallback） |
| **Gate** | WeChat 含本切片结算/商户面板全量 + Site 已发版且订单路径只传 `AUSPOST_*` / `MERCHANT_NEGOTIATE` |
| **创建日** | 2026-09-01 |

## 背景

`epOrderShippingService` 原入库短码 `'PP'` / `'EXP'` 无承运商标识，且与未来其它快递的「普通/特快」易撞码。改为成员名=落库值：`AUSPOST_PP` / `AUSPOST_EXP`，并新增 `MERCHANT_NEGOTIATE`。生产旧 WeChat 结算仍可能传 `'PP'`/`'EXP'`，Phase 1 需入站归一。

**勿删** `epAuspostDeliveryService.PP` / `.EXP`——那是 AusPost API 服务码，永久保留。

## Phase 对照

| Phase | 内容 | 部署状态 | 验证 |
|-------|------|----------|------|
| **1** | 加宽 `shipping_service`；回填；枚举长名 + `MERCHANT_NEGOTIATE`；**独立 compat 模块** `shared/compat/mini-program-shipping-service-phase1/`：入站双读 PP/EXP；出站 x.y≤3.10 → 短码；客户订单 + 运费报价 + **商户面板全部含 shippingService 的 API** | pending | 3.10.x 全链路短码；3.11+ 长名 |
| **N** | 删除整个 `mini-program-shipping-service-phase1/` compat 文件夹；codebase 删入站 PP/EXP 别名 | pending | Gate 后单独 PR |

## Gate（可验证）

- [ ] 含本切片的 WeChat **3.11.0** 审核通过并 **全量**（客户结算 + 商户面板使用长名 `AUSPOST_*` / `MERCHANT_NEGOTIATE`）
- [ ] 线上无 `X-Client-Version` **x.y ≤3.10** 的 mini_program 订单/报价流量（或已可忽略）
- [ ] Site 已发版，结算只传长名
- [ ] CMS 传该字段已用长名
- [ ] Grep：订单路径无 `shippingService: 'PP'|'EXP'`（`epAuspostDeliveryService` 短码除外）

## 部署后债务（Post-deploy debt）

### Phase 1 生产确认

- [ ] Backend 迁移 + 入站双读 + **出站 version-gate（x.y ≤3.10 → 短码）** 已部署
- [ ] 旧 WeChat 仍可传 `PP`/`EXP` 并成功归一
- [ ] 新 WeChat / Site 写出与请求均为长名
- [ ] Entry 状态 → `blocked`（等 Gate）

### Phase N 清理（Gate 通过后，单独 PR）

- [ ] 删除 `shared/compat/mini-program-shipping-service-phase1/` 整个目录
- [ ] 删除 codebase `normalizeOrderShippingService` 内 `'PP'`/`'EXP'` 入站别名分支
- [ ] 删除 codebase `serializeShippingServiceForOutbound` / `legacy_short` 出站分支
- [ ] 入站非法短码按未知值拒绝
- [ ] **禁止**改/删 `epAuspostDeliveryService.PP` / `.EXP`
- [ ] 本 entry → `done`；registry 归档

## 相关链接

- Enum: `xituan_codebase/typing_entity/order.enum.ts` → `epOrderShippingService`
- Compat（Phase 1 独立，Phase N 整夹删除）: `xituan_backend/src/shared/compat/mini-program-shipping-service-phase1/`
- Normalize（codebase，Phase N 删别名）: `order-shipping-service.util.ts` → `normalizeOrderShippingService`
- Migration: `xituan_backend/migrations/` 加宽 + 回填
- Plan: Merchant NSD override / negotiate third card
