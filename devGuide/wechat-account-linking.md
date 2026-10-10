# 微信 / 账号名邮箱：账号绑定（防双开）

Last updated: 2026-10-10

**部署尾项:** [post-deploy-ledger entry](./post-deploy-ledger/entries/2026-10-wechat-account-link-legacy-autoregister.md)

## 结论

- 微信与账号名/邮箱是同一 `users` 上的凭证，不是两个用户。
- 新客户端传 `accountLinkFlow: true`：未命中 → `WECHAT_ACCOUNT_NEED_LINK` + `linkToken`，再选绑定已有或创建新账号。
- 旧客户端不传 flag：保持自动注册（兼容，见 ledger）。
- 绑定凭证：**账号名或邮箱 + 密码**（与现网 login 一致；不支持手机号登录）。
- 完善资料（昵称/头像/手机）在 **已登录之后** 强制，与身份绑定分两步。
- 微信 API **不能** 提供微信号。

## 状态机（简）

```
微信 OAuth 成功
  → openid/unionid 已命中 → 登录现有用户 → 若资料不全则强制完善资料
  → 未命中 + accountLinkFlow
       → NEED_LINK + linkToken
            → 绑定已有（username/email + password）→ 写微信身份到该用户
            → 创建新账号（仅 linkToken）→ placeholder 用户 → 强制完善资料
  → 未命中 + 无 flag（旧端）→ legacy 自动 register（待 Gate 后删除）
```

## API（Phase 1）

| 方法 | Path | 说明 |
|------|------|------|
| POST | `/auth/wechat/login`、`/auth/wechat-web/login`、`/auth/wechat-mobile/login` | body 可含 `accountLinkFlow: true` |
| POST | `/auth/wechat/account-link` | `linkToken` + username/email/identifier + password |
| POST | `/auth/wechat/account-register` | 仅 `linkToken` → placeholder 用户 |
| POST | `/auth/wechat/account-bind` | 需登录；body `code` + `channel`（`mini` / `web` / `customer` / `merchant`） |

`linkToken`：Redis/Valkey（或默认 cache），TTL 10 分钟，消费后删除。

`GET /auth/me` 额外返回 `wechatLinked: { mini, web, customer, merchant }`（是否已绑各通道）。

业务错误码（A 形）：`WECHAT_ACCOUNT_NEED_LINK`、`WECHAT_ACCOUNT_LINK_TOKEN_INVALID`、`WECHAT_ACCOUNT_ALREADY_BOUND`、`WECHAT_ACCOUNT_TARGET_HAS_WECHAT`。

## 客户端顺序

1. 微信授权 → 若 NEED_LINK → 关联账号二选一 →（绑定则输账号密码）
2. 获得 session 后 → 资料未完成则强制「完善资料」（可退出登录）

### UI 放置

| 端 | NEED_LINK | 完善资料 | 设置页绑微信 |
|----|-----------|----------|--------------|
| Customer App | `CustomerLoginPanel` / `AuthScreens` | 登录后进账号信息（缺头像/昵称/手机） | 账号信息「绑定微信」→ `account-bind` channel=`customer` |
| Merchant App | `AuthScreens` Alert + 绑定表单 | 提示完善资料 | （商户侧后续可对齐 CMS/账号页） |
| 小程序 | 个人中心登录区 chooser/bind | 现有 `profile-completion-modal` | 已微信登录则已绑 mini；密码用户可再绑 |
| Site | `wechat-callback` 页内 chooser/bind | `needCompleteProfile` → `/user/account-info` | 账号资料页（既有邮箱/密码补全） |

## Phase 2：空壳吸收

绑定已有账号或登录态 `account-bind` 时：若该 openid 已挂在 **placeholder 邮箱** 且 **无订单** 的空壳用户上 → 清除空壳该通道 openid，无剩余微信身份则置 `inactive`，再把身份写到目标账号。

有订单或非 placeholder → `WECHAT_ACCOUNT_ALREADY_BOUND`（不自动合并双活跃账号）。

## Phase N（post-deploy）

Gate 通过后删除三通道「未传 `accountLinkFlow` 则自动 register」分支；见 ledger。

## 相关文档

- [post-deploy-ledger README](./post-deploy-ledger/README.md)
