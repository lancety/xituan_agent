# auspost-mypost-dual-track

Last updated: 2026-11-07

## 摘要

AusPost MyPost：**CSV fallback + Partner API 国内出标**；CMS 与 Merchant App 同构。**high / in_progress**。

Cursor plan：`d:/projects/xituan_module/.cursor/plans_planned/csv_mode_retention_0ed474ac.plan.md`

## 当前掌握的信息

- 一期：CMS + Merchant App；微信商户面板暂 CSV。
- Pickup = Phase 2。
- 凭证仅本地 env，不进 git。
- CMS 打包台已有手动 / API / CSV 路径骨架；App 侧 CSV 分享与「连接 MyPost」仍缺齐。

## 期望目标结果

### 计划要做的

- [ ] 设置页连接 MyPost（贴 Token + 校验）CMS+App
- [ ] 打包台三路径同一状态机；API confirm 出标写 tracking
- [ ] App CSV 确认后分享 batch（对齐 CMS）
- [ ] 冒烟：testbed BYO Trade Flow

### 触发后才做的

- [ ] **Pickup 预约** — 触发：API 出标稳定且产品要上门取件
- [ ] **UI 软弃用 CSV** — 触发：商户已切 API

## 触发条件 / 目标窗口

已在做；本 entry 作巡检。
