# cms-refund-line-returns

Last updated: 2026-11-07

## 摘要

CMS 退货选品：仅退款不加库存、按行退货/扣回。**high / in_progress**。微信面板与 Merchant App 本轮不做。

Cursor plan：`d:/projects/xituan_module/.cursor/plans_planned/退货选品与库存_cf4cdc27.plan.md`

## 当前掌握的信息

- Backend 行退货 / disposition 路径已推进。
- 旧端不传新字段 → 仍全额退款释放锁。
- 产品规则见 Cursor plan 正文。

## 期望目标结果

### 计划要做的

- [ ] CMS 退款弹窗 + 订单详情单独退货 / 扣回 UI 完成并 QA
- [ ] 发版确认旧端兼容

### 触发后才做的

- [ ] Merchant App / 微信面板对等 UI — 触发：CMS 稳定且产品要求移动端选品（微信「我的网店」若删除则只做 App）

## 触发条件 / 目标窗口

正在做。
