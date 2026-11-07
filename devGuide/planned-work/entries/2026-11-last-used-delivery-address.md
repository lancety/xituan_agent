# last-used-delivery-address

Last updated: 2026-11-07

## 摘要

用「最近一次配送地址」替代用户地址「默认地址」。**不是** post-deploy 债本身（有独立 post-deploy entry）；本条标记产品实施优先级为 **low**。

Cursor plan：`d:/projects/xituan_module/.cursor/plans_planned/last_used_delivery_address_f32868e1.plan.md`

## 当前掌握的信息

- 配送下单成功写 `lastUsedDeliveryAt`；自提不写。
- 结账 / 地址列表预填用最近配送地址。
- 端：Site / WeChat / Customer App。
- Phase1 双写 `is_default`；WeChat 全量后再 DROP — 见 post-deploy `user-address-last-used-delivery`。

## 期望目标结果

### 计划要做的

- [ ] Phase1 migration + backend markLastUsed + 三端 UI
- [ ] 冒烟：配送更新最近地址；自提不变

### 触发后才做的

- [ ] **Phase3 DROP `is_default`** — 触发：WeChat 新版本全量（post-deploy Gate）

## 触发条件 / 目标窗口

低优先；有空窗或地址相关改动时顺带做。
