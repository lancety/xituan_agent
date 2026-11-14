# L2 · WeChat（`xituan_wechat_app`）差异

Last updated: 2026-11-14

继承：[`00-platform-wide.md`](./00-platform-wide.md) → [`client.md`](./client.md)

## 本端差异（相对 L1）

| 项 | 约定 |
|----|------|
| 栈 | 微信小程序 |
| 主题 | L0 语义映射到小程序样式变量 / 类；遵守微信组件与审核约束 |
| 业务 API | 与 Site / Customer 同一套 Public/Auth 语义（含 client platform 头） |
| 聊天等 | OpenIM 相关 UX 见既有 openim skills / devGuide，不在此重复 |

## 待补

- 与 Site 店面模块的视觉/信息架构对照。
- 小程序特有页面（登录、订阅消息等）的密度与主 CTA 约定。
