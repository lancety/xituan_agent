# auspost-mypost-app-mvp

Last updated: 2026-11-09

## 摘要

MyPost **其他端（Merchant App 等）对齐 CMS MVP**：连接 Token、打包台未连 CSV / 已连 API、出标写 tracking。**high / planned**。  
微信商户面板一期仍 CSV，不纳入本 entry。

父项 CMS 主链路：[`./2026-11-auspost-mypost-dual-track.md`](./2026-11-auspost-mypost-dual-track.md)  
Cursor plan：`d:/projects/xituan_module/.cursor/plans_planned/csv_mode_retention_0ed474ac.plan.md`

## 当前掌握的信息

- CMS：设置页连接 + 打包台路径互斥 + API confirm 已可 testbed 出标。
- Merchant App：仍有 CSV/打包台骨架；**无** Partners Token 连接卡；CSV 确认后分享 batch 未对齐 CMS。
- 后端 Connection / Core 已按 subject 抽象，App 应复用同一 API，不另写 AusPost HTTP。

## 期望目标结果

### 计划要做的

- [ ] Merchant App 设置：贴 Partners Token + 连接状态（对齐 CMS 卡片文案：绑 Visa/Mastercard）
- [ ] App 打包台：未连 = 手动 + CSV；已连 = 手动 + API（不渲染 CSV）
- [ ] App API confirm：写 tracking / label_url；失败行为与 CMS 加固后一致（回滚/不作废成功态）
- [ ] App CSV 确认后直接分享 batch CSV（对齐 CMS）

### 触发后才做的

- [ ] 微信商户面板 API 出标 — 触发：产品明确要微信走 API
- [ ] Customer App — 不在范围

## 触发条件 / 目标窗口

**high**；CMS MVP 失败回滚与 attention 误判修好后即可开做（可与 Sign Off 材料并行）。
