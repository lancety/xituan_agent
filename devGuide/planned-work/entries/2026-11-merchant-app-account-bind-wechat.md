# merchant-app-account-bind-wechat

Last updated: 2026-11-09

## 摘要

Merchant App 登录后在「更多」账号区绑定微信（`POST /auth/wechat/account-bind`，`channel=merchant`）。补齐 `wechat-account-linking.md` 中商户「设置页绑微信」延后项；**非** post-deploy Phase N。

关联 post-deploy：`wechat-account-link-legacy-autoregister`（登录 NEED_LINK 已有；本项为已登录补绑）。

## 当前掌握的信息

- Backend `wechatAccountBind` 已支持 `MERCHANT_MOBILE`。
- 登录侧 NEED_LINK → `account-link` / `account-register` 已在 `AuthScreens`。
- Customer 参考：`AccountInfoScreen` + `accountProfileApiUtil.bindWechat`。
- Merchant 无独立账号资料页；入口放「更多」顶部 `accountCard`。

## 期望目标结果

### 计划要做的

- [x] `auth.api`：`wechatAccountBind` + `/auth/me` 解析 `wechatLinked.merchant`
- [x] 「更多」账号区：未绑显示绑定按钮；已绑显示状态；OAuth → account-bind
- [x] i18n（zh_cn / zh_tw / en）与业务错误码展示
- [x] 更新 `wechat-account-linking.md` 商户行

### 触发后才做的

- [ ] 若后续做完整「账号资料」页（头像/昵称/手机）——触发：产品要求对齐 Customer AccountInfo；本入口可迁入该页

## 触发条件 / 目标窗口

本窗口直接实施并关单。
