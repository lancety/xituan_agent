# 系统消息 Inbox（订单/退款/物流异常/收款）

Last updated: 2026-11-14

## 概要

设备 push 双写 `merchant.system_messages`（HASH `merchant_id` 50 分区）。顾客/商家 Expo Messages 列表混入一条「系统消息」会话行（**不置顶**，按 `lastMessageAt` 与 IM 排序）。只读时间线 + 订单卡片跳转。

**实例线程（本轮）**：同一收件人 + `instance_type` + `instance_id` 聚合成一行；新事件 append `history[]`，并清空 `read_at`（重新未读）。旧「一事件一行」不合并迁移，列表照实返回（可能新旧并存）。

Cursor plan：`~/.cursor/plans/order_thread_system_inbox_9e5b9244.plan.md`

## 表与字段

- Schema：`merchant.system_messages`
- PK：`(merchant_id, id)`
- 去重：`UNIQUE (merchant_id, recipient_app, recipient_user_id, dedupe_key)`（首插仍用；事件级去重看 `history[].dedupeKey`）
- 线程：`instance_type` + `instance_id`（同有或同空；枚举 `epSystemMessageInstanceType`，本轮仅 `order`）
- `history` jsonb：`{ at, who, what, kind, dedupeKey }[]`
- `recipient_app`：`customer` | `merchant`
- `kind`：见 `epSystemMessageKind`
- `card` / `deeplink` jsonb 快照；`created_at` / `read_at` 均为 timestamptz

Migrations：

- `1710000000411_merchant_system_messages.sql`
- `1710000000412_system_messages_instance_thread.sql`（勿擅自执行）

## 双写点（本轮）

| 事件 | 受众 | 入口 |
|------|------|------|
| 下单 / 退款申请 / 物流异常(商) | ADMIN+MANAGER 各一线程 | `device-push-notification-channel.handler` |
| 订单状态 / 退款结算 / 物流异常(客) | 顾客 `userId` | 同上 |
| 收款到账 | ADMIN+MANAGER | `device-push-order-notify.util` |

**不写**：`device-push-shipment-track-notify.util` 中途 track 更新。

Helper：`systemMessageInboxWriteUtil` → `upsertInstanceEvent`（`instance_type=order`）。Device push **仍按次发送**，仅 inbox 聚合。

无 `instance` 的广播行：两列 NULL，走 `insert` + `dedupe_key`（业务尚未使用）。

## API

- 顾客：`GET/POST /api/system-messages*`（summary / unread-total / read）
- 商家：`/api/admin/system-messages*` + `X-Merchant-Id`
- Item 含 `instanceType` / `instanceId` / `history[]`

## App

- 列表 merge：`system-message-list-merge.util` + `SYSTEM_MESSAGE_LIST_ROW_ID`
- 房：`SystemMessageRoomScreen` — 外侧自适应头像（`openimChatImageDisplayUtil.resolveChatAvatarEdge`，基准 44dp × fontScale）；**merchant** 用客户头像（点开 `OpenimChatSenderProfileModal`，可跳转客户订单/编辑），**customer** 用订单所属商户 logo（`card.merchantAvatarUrl`，点开同聊天房商户资料弹层）；气泡内订单号 / 商品 `lineLabels` / 多行 `日期 + 谁 + 做了什么`；无 history 的旧行用 `summary` 兜底
- 真实聊天房头像同用上述自适应 edge；点头像行为对齐 CMS/Site/WeChat（`participants` → profile modal）
- 时间线：线程与线程之间间隔 ≥ **5 分钟**分割线（`openimChatTimelineUtil`）
- Tab 角标：IM unread + system unread（append 清 `read_at` 后重新计入）

## Platform Support 顺带

- 置顶槽去掉多余水平 padding，与普通会话卡同宽
- 商户视角标题始终 `t('im.platformSupportTitle')`；后端 summary title 留空
