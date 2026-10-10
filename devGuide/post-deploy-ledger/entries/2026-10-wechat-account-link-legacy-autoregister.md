# 微信登录：legacy 未命中自动注册兼容层

Last updated: 2026-10-10

| 字段 | 值 |
|------|-----|
| **ID** | `wechat-account-link-legacy-autoregister` |
| **状态** | `planned` |
| **当前已部署** | — |
| **待完成** | Phase 1 发版（opt-in `accountLinkFlow`）→ Gate → Phase N 删除 legacy 自动注册 |
| **Gate** | WeChat 小程序含 NEED_LINK 的版本全量；Site / Customer App / Merchant App 已发布带 `accountLinkFlow: true` 的版本；可观测期内无旧端依赖「未命中即建号」 |
| **创建日** | 2026-10-10 |

**部署尾项:** 本 entry  
**方案文档:** [`../wechat-account-linking.md`](../wechat-account-linking.md)

## 背景

未绑定的微信身份若一律改为 `WECHAT_ACCOUNT_NEED_LINK`（不发 session），已发布小程序 / Site / 旧 App 只会按「登录失败」处理，用户无法登录。

## Phase 对照

| Phase | 内容 | 部署状态 |
|-------|------|----------|
| **1** | 新接口 `account-link` / `account-register` / `account-bind`；登录 body `accountLinkFlow: true` → NEED_LINK；**未传则保持自动 register** | pending |
| **N** | 删除「未传 flag 则自动注册」分支；未命中一律 NEED_LINK | pending |

## 消费者

| Consumer | Phase 1 |
|----------|---------|
| 旧 WeChat / 旧 Site / 旧 App | 不传 `accountLinkFlow` → 仍自动建号 |
| 新 WeChat / Site / App | 传 `accountLinkFlow: true` + 绑定 UI |

## 部署后债务（Post-deploy debt）

### Phase 1 生产确认

- [ ] Backend 已部署；旧端微信登录仍成功
- [ ] 新端 NEED_LINK → 绑定 / 新建可用
- [ ] Entry → `active` / `blocked`（等 Gate）

### Phase N 清理（Gate 通过后）

- [ ] 删除三通道登录里的 legacy 自动注册分支
- [ ] Grep 确认无「默认自动建号」路径
- [ ] 本 entry → `done`；registry 归档
