# system-message-inbox

Last updated: 2026-11-14

## 摘要

顾客/商家 Expo「系统消息」会话：设备 push（订单/退款/物流异常/收款）双写 `merchant.system_messages`（HASH `merchant_id` 50 分区）；Messages 列表与 IM **按最新消息时间混排（不置顶）**；只读时间线 + 订单卡片跳转。顺带修商家列表置顶 Platform Support 行宽与 i18n。

Cursor plan：`d:/projects/xituan_module/.cursor/plans_planned/系统消息会话（订单_支付_物流推送历史）_74034fc4.plan.md`

## 当前掌握的信息

- 不写 OpenIM；track 中途更新本轮不进 inbox。
- 顾客全 App 一条系统会话（跨商户）；商家按当前商户一条。
- 进房锚定最新；进房即标已读。

## 期望目标结果

### 计划要做的

- [x] Migration + insert helper + list/read/unread API（代码已落；SQL 待你授权执行）
- [x] Push 发送点双写（不含 track 中途）
- [x] 双端混排列表 + SystemMessageRoom + 卡片跳转
- [x] Platform Support 行宽 + i18n
- [x] 未读并入 Messages tab / 桌面角标
- [x] 短 devGuide

### 触发后才做的

- [ ] 物流 track 中途进 inbox（可选后续）
- [ ] 微信 / Site / CMS UI

## 触发条件 / 目标窗口

**high** — 本轮正在实现。
