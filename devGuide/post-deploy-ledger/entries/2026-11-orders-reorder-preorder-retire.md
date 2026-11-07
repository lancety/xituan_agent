# 退役 `POST /orders/reorder-preorder`

Last updated: 2026-11-07

| 字段 | 值 |
|------|-----|
| **ID** | `orders-reorder-preorder-retire` |
| **状态** | `planned` |
| **当前已部署** | —（Phase 1：新增 `preview`/`confirm`；**保留**旧路由薄封装） |
| **待完成** | Phase 1 发版 → 微信/Site/Customer 新路径全量 → Phase N 删旧路由 |
| **Gate** | ① 微信含统一再次购买版本全量且不再调 `reorder-preorder`；② Site 已改用 `preview`/`confirm`（代码已切；待生产发版验证）；③ Customer App 已用 `preview`/`confirm`；④ 可观测期内 `POST /orders/reorder-preorder` 调用可忽略或为 0 |
| **创建日** | 2026-11-07 |

**部署尾项:** 本 entry  
**Plan:** Cursor plan「统一再次购买基础版」

## 背景

统一零售/团购/预定「再次购买」为 `POST /orders/reorder/preview` + `POST /orders/reorder/confirm`。

旧接口 `POST /orders/reorder-preorder` 仍可能被：

| Consumer | 用途 |
|----------|------|
| 微信预定订单详情（旧包） | 再次购买 |
| Site 生产旧构建 | 预定再次购买（本地代码已迁走） |
| 零售再次购买（旧 Site） | **不调用**（本地 addToCart） |

WeChat 审核与 Site 发版滞后于 backend → Phase 1 **禁止**删除旧路由。

## Phase 对照

| Phase | 内容 | 部署状态 | 验证 |
|-------|------|----------|------|
| **1** | 新增 preview/confirm；微信/Site/Customer 详情切新 API；`reorder-preorder` 薄封装转调内部 helper（语义不变） | pending | 旧包仍 200；新端弹层预检+确认正常 |
| **N** | 删除 `POST /orders/reorder-preorder`、controller/service 薄封装、微信/Site `reorderPreorder` 客户端封装 | pending | 仅 Gate 通过后 |

## 消费者

| Consumer | Phase 1 行为 |
|----------|----------------|
| **WeChat 新代码** | 改走 preview/confirm |
| **WeChat 已发布包** | 预定详情仍可能调 `reorder-preorder` → backend 必须保留 |
| **Site 新代码** | 已切 preview/confirm（含 OFFER）；`reorderPreorder` 客户端方法暂留至 Phase N |
| **Customer App** | 已实现 preview/confirm |
| **CMS** | 不依赖 |

## 部署后债务（Post-deploy debt）

### Phase 1 生产确认

- [ ] Backend 已部署且 **未** 删除 `POST /orders/reorder-preorder`
- [ ] 生产 Site 再次购买走 preview/confirm
- [ ] 新微信再次购买（零售/团购/预定）弹层流程正常
- [ ] Customer App 再次购买弹层流程正常
- [ ] Entry 状态 → `blocked`（等全量）或 `active`

### Phase N 清理（Gate 通过后）

- [ ] Site / WeChat / Customer 生产无旧路径调用
- [ ] Grep：无 consumer 再引用 `reorder-preorder` / `reorderPreorder`
- [ ] 删除 route、controller、service 薄封装与客户端封装
- [ ] 本 entry → `done`；registry 移至已归档

## 相关链接

- Backend: `order.routes.ts`、`order.controller.ts`、`order.service.ts`（`reorderPreorder`）
- WeChat: `lib/commerce.ts`、`packageTrade/utils/order-reorder.wechat.util.ts`
- Site: `order-reorder.site.util.ts`、`OrderReorderConfirmModal.tsx`、`OrderDetailClient.tsx`
- Customer: `order-reorder.customer.util.ts`、`OrderReorderConfirmModal.tsx`、`OrderDetailScreen.tsx`
