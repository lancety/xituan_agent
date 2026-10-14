# openim-voice-message

Last updated: 2026-10-13

## 摘要

OpenIM 聊天补齐 **语音消息（Voice / contentType 103）**：气泡展示、播放，以及 Customer App 优先的录音发送。  
**不是** post-deploy Phase N：全端尚未实现语音气泡；属规划内新功能。

## 当前掌握的信息

### as-is（2026-10-13）

| 层 | 现状 |
|----|------|
| 枚举 / 预览 | `epOpenimMessageKind.VOICE`、`enOpenimContentType.Voice = 103`；会话预览已有 `[语音]` |
| RN SDK | `@openim/rn-client-sdk`：`createSoundMessageByURL` / `createSoundMessageFromFullPath`，`SoundElem`（`sourceUrl` / `duration` / `dataSize`…） |
| Customer 气泡 | `ChatMessageBubble` / `openim-chat-bubble.util` 仅 TEXT / IMAGE / FILE / LOCATION / CONTEXT_CARD；`fromSdk` 对语音会丢弃 |
| Customer Composer | more：`album` \| `camera` \| `location` \| `file`；无 voice 入口 |
| 上传策略 | `openim-attachment-policy.util` 仅 image + 文档 MIME，无 `audio/*` |
| 录音依赖 | Customer / Merchant **无** `expo-av` / `expo-audio` |
| iOS 权限 | Customer / Merchant `expo-image-picker`（及 Merchant `expo-camera`）`microphonePermission: false`，Info.plist 不含麦克风用途说明；做 Phase B 前再改回具体文案 |
| WeChat / Merchant | 气泡同样无 VOICE；无 Recorder / 语音 stub |

### 关键路径（Customer）

| 角色 | 路径 |
|------|------|
| 房间 | `xituan_app_customer/src/screens/ChatRoomScreen.tsx` |
| 气泡 UI | `xituan_app_customer/src/components/ChatMessageBubble.tsx` |
| kind 映射 | `xituan_app_customer/src/openim/openim-chat-bubble.util.ts` |
| 发送 | `xituan_app_customer/src/openim/openim-session.util.ts` |
| Composer | `xituan_app_customer/src/components/ChatComposer.tsx` |
| 附件选择 | `xituan_app_customer/src/utils/chat-attachment-pick.util.ts`（仅 images） |

发送范式可复用：上传 CDN → `create*ByURL` → `sendMessageNotOss`（与图片/文件一致）。

### 已定决策

1. **先做 Customer App**；Merchant / WeChat 发送可后置，但对端至少要能 **播** 才开放跨端互通发送。
2. 分两阶段：先收播，再录音发送。
3. 暂不做：波形动画、转文字、视频消息、全端同时开发送。

### 明确不做（现在）

- 当前窗口不排期实施（开发者暂无空）。
- 不在未补播放端前，让 Customer 单独上线「可发不可收」的跨端语音。

## 期望目标结果

### 计划要做的（启动实施后）

- [ ] **Phase A（Customer 收+播）**：history + realtime 解析 `soundElem` → `voiceUrl` + duration；气泡 UI；`expo-audio` / `expo-av` 点击播放；会话列表继续用已有 `[语音]`
- [ ] **Phase B（Customer 发）**：麦克风权限 → hold-to-record → 上传（扩 `audio/*` MIME + `durationMs`）→ `createSoundMessageByURL` → 本地乐观气泡；Composer 入口
- [ ] codebase / history map：`iOpenimChatHistoryMessage` / `iOpenimChatUiMessage` / `iChatRoomBubble` 补语音字段；`openim-chat-log-map` 等 map Voice
- [ ] 本 entry → `done`，registry 归档

### 触发后才做的

| 项 | 触发条件 |
|----|----------|
| Merchant Expo 至少收+播语音气泡 | Customer Phase A 可用，且需要商家端看到顾客语音时 |
| WeChat `packageIm` 至少收+播 | 小程序客服场景需要听语音时 |
| Merchant / WeChat 录音发送 | 对应端已能播，且产品确认要开发送 |

## 触发条件 / 目标窗口

主动启动「OpenIM 语音消息」实施时（优先排 Customer Phase A）。  
**现在不实施**（2026-10-13：仅登记规划；麦克风权限已关，避免审核占位文案问题。Phase B 前再开权限并写具体用途说明）。

## 实施备忘（可选草稿）

工作量粗估：仅 Customer 收+播偏小～中；完整收发中等；全端对齐偏大。  
Phase A 缺口：bubble util 分支、history/SDK map、播放依赖。  
Phase B 缺口：录音 UI、权限、attachment policy、session `sendSound*`。  
相关：会话预览 `openim-message-preview.util`；附件直传规划见 [`openim-attachment-direct-upload`](./2026-09-openim-attachment-direct-upload.md)（语音上传短期可仍走现有 multipart）。
