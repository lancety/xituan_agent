# WeChat C-end: unify order product list with main-package order-item-list-section

Last updated: 2026-06-16

| Field | Value |
|-------|-------|
| **ID** | `wechat-c-order-item-list-section` |
| **Status** | `planned` |
| **Deployed** | — |
| **Pending** | Phase 1 → Phase 2 |
| **Gate (Phase 2)** | WeChat 小程序新版本（含本改动）全量发布后，再删除 trade 分包内联商品列表与冗余 `order-line-display` 引用 |
| **Created** | 2026-06-16 |

## Background

商户端订单详情已使用主包可复用组件 `components/order-item-list-section` + `utils/order-detail-item-list.wechat.util.ts` 构建商品清单。

C 端（`packageTrade`）订单**结算页**与**订单详情页**仍各自内联 `order-line-display` 循环渲染，样式与多活动分组逻辑与商户端 duplicated，维护成本高。

目标：C 端 6 个页面统一改用主包 `order-item-list-section`，数据经 `orderDetailItemListWechatUtil.buildItemListViewForOrder`（或 checkout 等价 input）驱动。

**无 DB / API 变更**；属小程序分包 UI 重构，需分阶段以兼容已发布版本与分包 `componentPlaceholder` 加载。

## Scope (pages)

| 场景 | 页面路径 |
|------|----------|
| 结算 | `packageTrade/pages/order/regular/order-regular` |
| 结算 | `packageTrade/pages/order/offer/order-offer` |
| 结算 | `packageTrade/pages/order/preorder/order-preorder` |
| 详情 | `packageTrade/pages/order-detail/regular/regular` |
| 详情 | `packageTrade/pages/order-detail/offer/offer` |
| 详情 | `packageTrade/pages/order-detail/preorder/preorder` |

**参考实现：** `packageMerchant/components/merchant-panel-order-detail` + `merchant-panel-order-item-list.wechat.util.ts`

**主包组件：** `components/order-item-list-section`（内部仍用主包 `components/order-line-display`）

## Phase map

| Phase | Scope | Deploy | Verify |
|-------|-------|--------|--------|
| **1** | 6 页 wxml/json 改为 `order-item-list-section`；page ts 构建 `itemListView`；json 配置 `componentPlaceholder`（trade → main）；保留 trade 内 `order-line-display` 组件文件不删 | pending | 三 mode 结算 + 详情：单品/多活动分组/定制行/备注图/价格展示与改前一致；分包预加载正常 |
| **2** | 移除 6 页内联 `item-list` wxss 与 `order-line-display` 引用；评估删除 `packageTrade/components/order-line-display` 副本（若零引用）；清理 dead util | pending | Gate 满足后 |

## Post-deploy debt

### Phase 1 prod confirm

- [ ] 6 页均已挂载 `order-item-list-section`，无控制台 component not found
- [ ] regular / offer / preorder 结算页商品列表 smoke
- [ ] regular / offer / preorder 详情页商品清单 smoke（含 multi-activity groups）
- [ ] 定制商品、note、noteImages、产品名点击（若原页支持）行为未回归
- [ ] Entry → `active` 或 `blocked`；registry updated

### Phase 2 cleanup (after Gate)

- [ ] WeChat 含 Phase 1 的版本已全量（Gate）
- [ ] 删除 6 页对 `packageTrade/components/order-line-display` 的 `usingComponents` 与相关 wxss
- [ ] 若 grep 无引用：删除 `packageTrade/components/order-line-display/` 副本
- [ ] 合并或删除 trade 页重复 `.item-list` / `.section-title` 样式（以 `order-item-list-section` 为准）
- [ ] Entry → `done`；registry archived

## Technical notes

- 跨分包引用主包组件：page/component json 需 `componentPlaceholder: { "order-item-list-section": "view" }`（与 merchant order-detail、`preorder-calendar` 模式一致）
- checkout 页若无完整 order 对象，需对齐 `iOrderDetailItemListOrderInput` 字段映射（可参考各 mode 现有 cart → line 逻辑）
- **不**在本任务中改 backend、codebase API 类型或 DB

## Links

- 主包组件：`xituan_wechat_app/components/order-item-list-section/`
- 构建 util：`xituan_wechat_app/utils/order-detail-item-list.wechat.util.ts`
- 商户端参考：`xituan_wechat_app/packageMerchant/components/merchant-panel-order-detail/`
