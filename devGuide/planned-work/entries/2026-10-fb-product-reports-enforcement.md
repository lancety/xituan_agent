# fb-product-reports-enforcement

Last updated: 2026-10-20

## 摘要

商品合规举报（`platform.fb_product_reports`）的 **App 入口、S3 证据备份、Platform 商品 Tab、结案动作（下架 / `pt::` tag / 商户邮件）** 与 **《商户协议》条款更新**。  
表结构已在 migration `1710000000373` 建好；**本 entry 未开工前不写业务代码**。

权威产品口径：[platform-compliance-report-design](../../platform-compliance-report-design.md)。

## 当前掌握的信息

### 已定

| 项 | 结论 |
|----|------|
| SQL | `platform.fb_product_reports` 已在 0373 |
| 谁可报 | **登录顾客**；身份保密确认文案暂不做（后置可选） |
| category | `product_image` 先做；`product_info` 同表后置入口 |
| 证据 | 全组主图 **原件 + 已有 `_w128`** → feedback S3 目录；只存 `evidence_image_keys` + `focal_ord` |
| reason | `epFeedbackProductReason`（含 adult / violence / religion_superstition / hate / child_safety / illegal_regulated / copyright_ip / scam_misleading / other） |
| 结案成立时 | **下架**（图或品，实施时定粒度）+ 产品 tag **`pt::…`**（platform 签发，**黄色警告**样式）+ 商户 **外部联系邮箱**通知 |
| 协议 | 更新 Site/微信等 **《商户协议》**，写明平台可对违规内容下架、加 `pt::` 标记并通知商户 |
| 不做（本项） | 业务纠纷仲裁；为反馈链路现生成 SIH；为 Copy 失败做复杂降级 |

### 现有相关能力

| 能力 | 路径 |
|------|------|
| 产品 tag / `t::` 系统前缀 | `product-tag.util.ts`、`merchant.product_tags` |
| S3 Copy | `s3UploadManager` |
| 商户协议文案 | `xituan_site/.../MerchantAgreementContent.tsx`、微信 `wechat-legal-content` |
| 徽章/警告样式 | CMS/App badge 约定（黄色警告对齐现有 warning token） |
| 聊天反馈管理（先做） | Platform 反馈页只接 `fb_chat_reports` |

## 期望目标结果

- [ ] Customer App：商品详情/大图「举报此图」+ 理由（身份保密确认文案后置）  
- [ ] Backend：创建 report → S3 备份 → 写 `fb_product_reports` → 反馈邮箱  
- [ ] Platform：反馈页 **商品** Tab（列表/详情/结案）  
- [ ] 结案 `upheld`：下架 + 写/链 `pt::` tag + 商户外部邮箱通知  
- [ ] 《商户协议》中英/多端同步上述措施  
- [ ] `product_info` 入口（可选同一 PR 或紧随）  
- [ ] 本 entry → `done`

## 触发条件

主动启动「商品合规举报」实施时（聊天 Platform 管理页上线之后优先）。  
**现在不实施 App/结案动作**（2026-10-20：仅登记 + SQL）。

## 实施备忘

- `pt::` 与现有商户/系统 `t::` 区分命名空间；normalize 时勿被商户改写删除。  
- 黄警告样式：列表与详情统一，避免与普通商户 tag 混淆。  
- 邮件：用商户外部联系邮箱字段（与 OmiPay/设置里 contact email 对齐，实施时 grep 现有字段）。  
- 协议改动需法务/产品过目后再发站点与小程序文案。  
