# Non-same-day shipping: WeChat 旧版超距离兼容

Last updated: 2026-08-15

| 字段 | 值 |
|------|-----|
| **ID** | `non-same-day-wechat-compat` |
| **状态** | `planned` |
| **当前已部署** | — |
| **待完成** | Phase 1（backend 双路径）→ Phase N（去掉 `allowNonSameDay` 兼容层） |
| **Gate** | WeChat 含 AusPost 结账的版本审核通过并 **全量** 后，再删除 legacy `DELIVERY_DISTANCE_EXCEEDED` 分流 |
| **创建日** | 2026-08-15 |

## 背景

Backend 已上线非当日（AusPost）结账：超 `maxDeliverKM` 且店铺未开通非当日邮寄时抛 `NON_SAME_DAY_SHIPPING_DISABLED`。生产 WeChat 仍是旧版（新版审核中），只认识 `DELIVERY_DISTANCE_EXCEEDED`，会显示裸 400。

## Phase 对照

| Phase | 内容 | 部署状态 | 验证 |
|-------|------|----------|------|
| **1** | 运费报价 / 下单：无 AusPost 能力的请求超距离仍返回 `DELIVERY_DISTANCE_EXCEEDED`；新客户端（报价带 cart `items`，或下单带 PP/EXP）走 AusPost / `NON_SAME_DAY_SHIPPING_DISABLED` | pending | 旧 WeChat 超距离弹「超出配送范围」；Site / 新 WeChat 仍可切 AusPost |
| **N** | 删除 `allowNonSameDay` 及 legacy 分流，超距离统一走非当日路径 | pending | 仅 Gate 通过后 |

## 识别规则（Phase 1）

| 请求 | `allowNonSameDay` | 超距离结果 |
|------|-------------------|------------|
| 旧 WeChat 报价（无 `items`） | false | `DELIVERY_DISTANCE_EXCEEDED` |
| 新 WeChat / Site 报价（有 cart lines） | true | AusPost options 或 `NON_SAME_DAY_SHIPPING_DISABLED` |
| 旧 WeChat 下单（无 PP/EXP） | false | `DELIVERY_DISTANCE_EXCEEDED` |
| 新客户端下单（`shippingService` = PP/EXP） | true | AusPost 履约 |

## 部署后债务（Post-deploy debt）

### Phase 1 生产确认

- [ ] Backend 已部署；旧 WeChat 超距离不再裸 400
- [ ] Site / 已审核新 WeChat：开通非当日可切 AusPost；未开通仍为 `NON_SAME_DAY_SHIPPING_DISABLED`
- [ ] Entry 状态 → `blocked`（等 WeChat 全量）

### Phase N 清理（Gate 通过后）

- [ ] 去掉 `allowNonSameDay`；报价默认走非当日路径
- [ ] 本 entry → `done`；registry 移至已归档

## 相关链接

- Backend: `xituan_backend/src/domains/shipping/services/shipping-fee.service.ts`
- Quote: `shipping-fee.controller.ts`；下单: `order.service.ts`
- 旧 WeChat handler: `DELIVERY_DISTANCE_EXCEEDED` in `simple-error-handler.default.ts`
