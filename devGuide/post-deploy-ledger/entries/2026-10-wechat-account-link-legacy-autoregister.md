# 微信登录：legacy 未命中自动注册兼容层

Last updated: 2026-11-15

| 字段 | 值 |
|------|-----|
| **ID** | `wechat-account-link-legacy-autoregister` |
| **状态** | `blocked` |
| **Phase1 首次进版** | 主端 `v4.1.0`；Platform 补齐（`accountLinkFlow` + 仅绑定管理员）随本次发版 |
| **最早可清理** | `≥4.2.0`（开发者确认：**全端已 4.2.0+**） |
| **下一可执行** | Platform 本次生产发版后即可 Phase N（清 legacy 时不再保留 Platform 旧兼容） |
| **当前已部署** | 主端 ≥4.2.0 均已 `accountLinkFlow`；Platform 代码已改、待本次生产；legacy 自动注册仍保留至 Phase N |
| **待完成** | Platform 生产上线 → Phase N 删三通道「未传 flag 则自动注册」 |
| **Gate** | ✅ 全端 4.2.0+；⏳ Platform 本次发版带上 NEED_LINK 绑定 UI |
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
| 新 WeChat / Site / App / CMS | 传 `accountLinkFlow: true` + 绑定/新建 UI |
| **Platform** | 传 `accountLinkFlow: true`；NEED_LINK 后 **仅绑定已有管理员**（不提供新建，新建会是 USER 进不了平台） |
| Merchant App 登录后补绑 | 「更多」账号区 → `account-bind` channel=`merchant`（planned-work `merchant-app-account-bind-wechat`，2026-11-09） |

## 部署后债务（Post-deploy debt）

### Phase 1 生产确认

- [ ] Backend 已部署；旧端微信登录仍成功
- [ ] 新端 NEED_LINK → 绑定 / 新建可用
- [ ] Entry → `active` / `blocked`（等 Gate）

### Phase N 清理（Gate 通过后）

- [ ] 删除三通道登录里的 legacy 自动注册分支
- [ ] Grep 确认无「默认自动建号」路径
- [ ] 本 entry → `done`；registry 归档
