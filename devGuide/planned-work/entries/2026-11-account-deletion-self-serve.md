# account-deletion-self-serve

Last updated: 2026-11-11

## 摘要

App Store 5.1.1(v) 自助删号：应用内发起、**7 天可取消**、到期匿名化；**high**（过审阻塞）。  
邮件客服不可作为唯一路径。Cursor plan：[`account_deletion_7d_f12810cb.plan.md`](../../../../.cursor/plans_planned/account_deletion_7d_f12810cb.plan.md)。

关联：`merchant-ios-iap-pay-restore`（iOS 去 PassKit / 日后 IAP，**mid**，可并行）。  
Resolution Center 稿：[`2026-11-app-store-resolution-center-reply-draft.md`](./2026-11-app-store-resolution-center-reply-draft.md)。

## 当前掌握的信息

- 两端 App + CMS dashboard 顶栏 + Site `/delete-account` 自助；顾客「我的」顶栏；商户首页顶栏。
- 用户 `epUserStatus` 扩 **`deleted`**（与未验证 `inactive` 分开）。
- 到期匿名化用户 PII；订单/发票等依法保留。
- 商户 **ADMIN** 发起：该店 **只** `merchants.status → inactive`（关运营）；**不删**商户内容（商品/活动/设置/图/门店等一律保留）。取消且本次关的可恢复 `active`。普通成员只删自己。
- 审核不会因写「7 天」而挂审满 7 天；验的是可发起 + 透明提示。

## 期望目标结果

### 计划要做的

- [x] Backend：`deletion_*` 字段 + 发起/取消/me；ADMIN 关店；cron 匿名化 → `deleted`（migration `1710000000410`，**勿自动跑库**）
- [x] Merchant App：More 按角色确认；首页倒计时 + 取消
- [x] Customer App：AccountInfo 发起；我的页顶栏
- [x] CMS dashboard 顶栏；Site delete-account 自助页
- [x] 商户 iOS 构建去掉 Stripe/PassKit（`react-native.config.js` ios null）
- [x] Resolution Center 英文稿（见上 entry）

### 触发后才做的

- [ ] OpenIM 侧彻底清理策略细化 — 触发：实施匿名化时对齐现网能力
- [ ] Platform 商户管理 Select 补 `inactive`/`suspended` 选项 — 触发：改商户 status UI 同窗口

## 触发条件 / 目标窗口

**high**。下次准备重提 Merchant / Customer App Store 或主动解 5.1.1(v) 时启动。
