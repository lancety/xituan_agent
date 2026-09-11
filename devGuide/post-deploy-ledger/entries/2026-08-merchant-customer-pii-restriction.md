# 商户侧客户 PII 限制（账号 / 邮箱 / 手机）

Last updated: 2026-09-10

| Field | Value |
|-------|-------|
| **ID** | `merchant-customer-pii-restriction` |
| **Status** | `active` |
| **Deployed** | Phase 1 大部：merchant-clients 去 email；下线 lookup/create/delete；OpenIM CUSTOMER 无 email；CMS/微信客户 UI；首次消费日；客户订单过滤 |
| **Pending** | ManualOrderEditor 选人 email；OrderEditModal 收件电话边界；relay 代发；CLIENT_CREATE/DELETE 权限点清理 |
| **Gate (可收尾)** | ManualOrderEditor/grep 清零；relay MVP；CMS + 小程序商户面板全量发版 |
| **Created** | 2026-08-27 |

## Background

**产品原则（已确认）：**

- **Platform（平台管理端）**：可查看客户账号（username）、邮箱、手机。
- **CMS / 小程序商户面板**：不得直接查看客户登录账号、邮箱、手机号。
- 触达走平台代发（Phase 2）。

---

## 已完成

| 区域 | 改动 |
|------|------|
| `POST /admin/merchant-clients/batch` | 仅 id/nickname/avatarUrl |
| CMS 订单列表 / ManualRefundModal | nickname + avatar |
| `GET /admin/merchant-clients` list/get | 无 email/username；`firstOrderAt` |
| lookup / create / DELETE merchant-clients | **已下线**（客户由下单 addClient 建立） |
| OpenIM CUSTOMER profile | 无 email/username；附 clientSinceAt + 支付三态 + firstOrderAt |
| CMS clients 列表/详情 | 无 email；首次消费；查看订单；无添加/删除 |
| CMS/Site OpenIM 资料卡 | 商户侧客户富资料；Site 点自己精简、点店员保持 |
| 微信商户面板 clients | 无 email；ActionSheet 订单/编辑/聊天；client-edit 页 |
| 微信活动订单 serialize user | 无 email/phone |
| 订单 list `userId` + `customerOrderScope` | 隐性客户过滤 |

### 仍待（Phase 1 残留）

- [ ] `ManualOrderEditor` — 选用户 label 含 email
- [ ] `OrderEditModal` — 收件电话 vs 账号手机边界
- [ ] 权限常量 `CLIENT_CREATE` / `CLIENT_DELETE` 从角色表清理（路由已不用）

### Phase 2 — 平台代发（未做）

- [ ] relay 短信/邮件

## Platform

- [x] **不限制** — admin 仍可见账号
