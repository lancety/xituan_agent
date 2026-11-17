# last-used-delivery-address

Last updated: 2026-11-16

## 摘要

用「最近一次配送地址」替代用户地址「默认地址」。功能尚未落地（全仓无 `last_used_delivery`）。只记在本规划，优先级 **low**。

Cursor plan：`d:/projects/xituan_module/.cursor/plans_planned/last_used_delivery_address_f32868e1.plan.md`

## 当前掌握的信息

- 现状：各端仍用 `isDefault` / `PUT .../set-default`。
- 配送下单成功写 `lastUsedDeliveryAt`；自提不写。
- 结账 / 地址列表预填用最近配送地址。
- 端：Site / WeChat / Customer App。
- Phase 1 必须双写 `is_default` 并保留 `set-default`，否则旧微信结账预填会断。
- Phase 1 发版之后，再单独记 DROP `is_default`。现在不挂 post-deploy。

## 期望目标结果

### 计划要做的

- [ ] Phase 1：ADD `last_used_delivery_at`，从 `is_default` 回填；配送下单 `markLastUsedDeliveryAddress` + 双写 default
- [ ] Site / WeChat / Customer 预填改读最近配送地址；旧微信「设为默认」仍可用
- [ ] 冒烟：配送更新最近地址；自提不变

### 触发后才做的

- [ ] **DROP `is_default`、删 `set-default`** — 触发：含 Phase 1 的统一版本全量（读 `lastUsedDeliveryAt`、无「设为默认」）。届时重开 post-deploy，不在本条里直接删列。

## 触发条件 / 目标窗口

低优先；有空窗或地址相关改动时顺带做。
