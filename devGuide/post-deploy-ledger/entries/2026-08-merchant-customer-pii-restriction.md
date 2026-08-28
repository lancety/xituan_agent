# 商户侧客户 PII 限制（账号 / 邮箱 / 手机）

Last updated: 2026-08-27

| Field | Value |
|-------|-------|
| **ID** | `merchant-customer-pii-restriction` |
| **Status** | `planned` |
| **Deployed** | 部分：订单列表 `batchUserDisplay` 仅 nickname + avatar；`ManualRefundModal` 改用 merchant-scoped batch，不再 fallback username |
| **Pending** | 全量商户侧 PII 收口 + 平台代发短信/邮件能力规划 |
| **Gate (可收尾)** | 产品方案确认；平台 relay API 可用；CMS + 小程序商户面板全量发版 |
| **Created** | 2026-08-27 |

## Background

**产品原则（已确认，尚未全量实施）：**

- **Platform（平台管理端）**：运营/管理员 **可以** 查看客户账号（username）、邮箱、手机等，用于排查与运营。
- **CMS / 小程序商户面板（商户上下文）**：商户 **不得** 直接查看客户的登录账号、邮箱、手机号。
- 商户如需触达客户，应通过 **平台代发短信 / 代发邮件** 通道，不允许商户拿到明文 contact 自行联系。

本条目追踪「尚未完成的收口与 relay 设计」，避免只改一处 UI 而遗漏 API 与小程序。

---

## 已完成（Phase 0 / 局部）

| 区域 | 改动 |
|------|------|
| `POST /admin/merchant-clients/batch` | 响应仅 `id`, `nickname`, `avatarUrl`（无 username/email） |
| CMS 订单列表 | 只显示昵称 + 头像；配送列三行布局 |
| CMS `monitoring/order-payment` | `batchGetUsers` 仅 `nickname \|\| id` |
| CMS `ManualRefundModal` | 退款收款人姓名：`batchGetUsers` 取 nickname，不用 `/admin/users/:id` 与 username fallback |

**不在此条目范围（保持现状）：**

- Platform `monitoring/order-payment`：仍用 `/admin/users/batch`，`nickname \|\| username`（平台管理员可见账号）。

---

## Phase 1 — 待规划：商户 API 与 UI 审计（additive / 限制响应）

目标：商户 scoped API **不再返回** email、phone、username；UI 移除展示与搜索依赖。

### Backend（merchant-scoped）

- [ ] `GET /admin/merchant-clients` — `iMerchantClient.user` 是否仍含 `email` / `username`？改为 nickname + avatar 为主展示字段
- [ ] `GET /admin/merchant-clients/:userId` — 同上
- [ ] `GET /admin/merchant-clients/lookup?email=` — **敏感**：按 email 查找是否仍应对商户开放？需产品定：仅「添加客户」流程 hashed/脱敏 hint，或改 invite-only
- [ ] 订单详情 / 活动订单 expand — `order.user` 字段是否与 batch display 对齐
- [ ] OpenIM 商户会话 profile — 是否仍下发 username/email

### CMS（商户登录）

- [ ] `pages/clients/index.tsx` — 列表/卡片/搜索现展示 `user.email`
- [ ] `pages/clients/[userId].tsx` — 详情页 email
- [ ] `ManualOrderEditor` — 选用户 label 含 email
- [ ] `OpenimChatSenderProfileModal` — username / email 展示
- [ ] `OrderEditModal` — 确认 `phone` 等字段是否为客户 PII（收件电话 vs 账号手机）
- [ ] 其它 grep：`user?.email`, `user?.phone`, `user?.username` 于 CMS `src/`（排除商户员工/partner/supplier 自身）

### 小程序商户面板

- [ ] `resolveClientDisplayName(nickname, email, username?)` — 现 email/username 兜底；改为仅 nickname（空则「客户」）
- [ ] 客户列表/网格 API 消费处 — 确认不渲染 email

### Platform

- [ ] **不限制** — 保持 admin batch / user 详情可见账号（文档注明例外）

---

## Phase 2 — 待规划：平台代发短信 / 邮件（relay）

商户触达客户的正路；**详细方案另开 devGuide**，本条目只列 Gate 依赖。

- [ ] 产品：哪些场景允许代发（订单通知、退款、营销 opt-in 等）
- [ ] Backend：relay 服务 / 模板 / 审计日志；商户 API 仅 `POST send-on-behalf`，无 recipient 明文回显
- [ ] CMS / 小程序：触达入口走 relay，无 copy email/phone 按钮
- [ ] 合规：退订、频率限制、merchant consent

---

## Gate（Phase 1 + 2 可标记 done）

- [ ] Phase 1：商户 scoped API 响应无 email/phone/username；CMS + 小程序商户面板 UI 无上述字段展示/搜索（人工 smoke + grep 清零）
- [ ] Phase 2：relay MVP 上线且商户触达路径已切换
- [ ] Platform admin 路径回归：仍可按 email/username 查用户
- [ ] 无外部集成依赖被误删（文档列出例外：partner/supplier 等非 C 端用户）

---

## Post-deploy debt（清理，Gate 后）

- [ ] 删除 CMS 内对 `/admin/users/:id` 的商户上下文调用（若仍有残留）
- [ ] 删除 `iMerchantClientUser` 上 deprecated 字段或文档标记 platform-only
- [ ] 移除 lookup-by-email 的明文响应（若 Phase 1 改为 invite flow）

---

## 相关

- 订单列表客户展示改动（2026-08）：本仓库 CMS `orders.tsx` + `merchant-clients/batch`
- Skill：`.cursor/skills/post-deploy-ledger/SKILL.md`
