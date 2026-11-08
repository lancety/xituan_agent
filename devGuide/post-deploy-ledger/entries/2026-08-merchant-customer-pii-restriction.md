# 商户侧客户 PII 限制（账号 / 邮箱 / 手机）

Last updated: 2026-11-08

| Field | Value |
|-------|-------|
| **ID** | `merchant-customer-pii-restriction` |
| **Status** | `done` |
| **Deployed** | 账户邮箱脱敏、email 可空/停写 placeholder、软提示、ManualOrder 脱敏（CMS+Merchant）、收件电话边界、`CLIENT_*` 清理；schema `0406` + data-repair 清 placeholder 随发版窗口执行 |
| **Pending** | —（不再作为 post-deploy 债） |
| **Gate (可收尾)** | 本条产品范围已落地；履约手机「中间号/对商户隐藏」见 planned-work |
| **Created** | 2026-08-27 |
| **Completed** | 2026-11-08 |

## 产品边界（已定稿）

| 信息 | 商户侧 |
|------|--------|
| 订单收货人 / 履约联系电话 / 地址 | 本轮仍明文（履约） |
| 账户登录手机 | 不暴露于 OpenIM / 客户资料 / 订单嵌套 `user.phone` |
| 账户邮箱 | 脱敏；无邮箱可空；订单联系邮箱可手填不写回账户 |
| Platform | 仍可看完整账号 |
| placeholder | 禁止新建；存量清 NULL（data-repair） |

## 已完成（勾选）

- [x] merchant-clients / OpenIM / 微信客户 UI 去账户 email
- [x] email 可空 + 停写 `@placeholder.com` + `lacksDeliverableEmail`
- [x] 软提示补邮箱（会话一次 + 7 天暂不提醒）
- [x] ManualOrder hints/contact 脱敏（CMS + Merchant App）
- [x] 订单嵌套 user 不带账户手机；履约用 snapshot `contactNumber`
- [x] `CLIENT_CREATE` / `CLIENT_DELETE` 清理
- [x] 台账从 post-deploy 收尾；手机中间号另开 planned-work

## 迁出（不再本条跟踪）

| 主题 | 去向 |
|------|------|
| 履约手机中间号 / 对商户隐藏真实号（自行配送、手动/自动 AusPost 建单等） | planned-work `delivery-phone-merchant-mask` |
| 平台 relay 代发短信/邮件 | 未排期；需要时另开 planned 或产品单 |

## Platform

- [x] **不限制** — admin 仍可见账号
