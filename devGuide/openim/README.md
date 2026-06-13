# OpenIM 客户端交互

Last updated: 2026-06-13

本目录收录 OpenIM 聊天室 UI/滚动/缓存/历史同步的**定稿设计**与落地参考，供微信小程序及后续 CMS / Site / Platform 复用。

## 文档索引

| 文档 | 说明 |
|------|------|
| [chat-room-inverted-scroll-design.md](./chat-room-inverted-scroll-design.md) | **权威**：rotateX 倒置滚动、进房/离房位置恢复、历史分页、缓存与后端契约；§5.4 商户侧进房须带 `merchantId`、踩坑与跨端移植 |

## 源码锚点（微信小程序）

| 层级 | 路径 |
|------|------|
| 页面 | `xituan_wechat_app/packageIm/pages/chat/room/room.{ts,wxml,wxss}` |
| 倒置滚动 util | `xituan_wechat_app/packageIm/utils/chat-room-inverted-scroll.util.ts` |
| 历史/缓存 loader | `xituan_wechat_app/packageIm/utils/openim-history-loader.wechat.util.ts` |
| 商户侧进房导航 | `xituan_wechat_app/packageMerchant/utils/merchant-panel-staff-chat-nav.wechat.util.ts` |
| 共享契约 | `xituan_codebase/typing_api/openim-chat.type.ts` |
| 滚动意图 | `xituan_codebase/utils/openim-chat-scroll-intent.util.ts` |
| 历史同步 | `xituan_codebase/utils/openim-history-sync.util.ts` |
| 消息缓存引擎 | `xituan_codebase/utils/openim-message-cache-engine.util.ts` |

## Agent Skill

实现或改动 OpenIM 客户端交互时，先读 Skill：

- `.cursor/skills/openim-client-scroll-interaction/SKILL.md`

## 相关文档

- [backend-protection-layers-and-scale-notes.md](../backend-protection-layers-and-scale-notes.md) — OpenIM 后端与拉取路径
- [site-login-register-wechat-flow.md](../site-login-register-wechat-flow.md) — 站点与微信登录（非 IM 滚动）
