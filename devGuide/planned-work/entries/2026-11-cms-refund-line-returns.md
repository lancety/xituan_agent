# cms-refund-line-returns

Last updated: 2026-11-07

## 摘要

CMS 退货选品：仅退款不加库存、按行退货/扣回。**done（2026-11-07）**。本轮范围仅 CMS；微信面板与 Merchant App 未做、未触发。

Cursor plan：`d:/projects/xituan_module/.cursor/plans_completed/退货选品与库存_cf4cdc27.plan.md`

## 当前掌握的信息

- Backend 行退货 / disposition、`order_item_returns`、CMS 退款弹窗与详情选品已上 `production`（backend `c07f36f9`，CMS `595c82f` / `3e1ec37`）。
- 旧端不传新字段 → 仍全额退款释放锁。
- 产品规则见 Cursor plan 正文。

## 期望目标结果

### 计划要做的

- [x] CMS 退款弹窗 + 订单详情单独退货 / 扣回 UI 完成并 QA
- [x] 发版确认旧端兼容（已合入 `production`）

### 触发后才做的（本 entry 不跟踪实施）

- [ ] Merchant App / 微信面板对等 UI — 触发：产品要求移动端选品（微信「我的网店」若删除则只做 App）。需要时另开 entry。

## 触发条件 / 目标窗口

已完成（CMS 范围）。
