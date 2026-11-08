# delivery-phone-merchant-mask

Last updated: 2026-11-08

## 摘要

履约收件人手机对**商户侧**隐藏或改显示为**中间号/脱敏**，同时保证派送方（自配送司机、AusPost 标签/API）仍能联系收件人。  
**mid**。不是 post-deploy：原 `merchant-customer-pii-restriction` 邮箱/账户 PII 已收尾；本条是**新能力设计**，需按配送渠道分别定方案。

Cursor plan：无独立草稿（从 PII 讨论拆出）；实施时可新开 plan。

## 当前掌握的信息

- 现状：订单 snapshot `contactNumber` 对商户明文（履约需要）；账户 `user.phone` 已不嵌在商户订单 user 上。
- 产品意向：商户尽量不看完整真实手机；派送链路仍要可用。
- 渠道差异大，不可一套 UI 硬套：

| 场景 | 需想清楚的点 |
|------|----------------|
| **自行配送** | 司机/店员如何拿到可拨打号码？中间号转接？一次性明文仅给配送员角色？ |
| **手动 AusPost 建单**（CMS/Merchant CSV 或 MyPost 手工） | 标签上的号码从哪来；商户预览是否必须见全号；能否服务端注入明文只进导出文件 |
| **自动继承 AusPost 建单**（系统代填/confirm） | API/CSV 直传收件人手机；商户详情只显示脱敏/中间号 |
| **OpenIM / 客户资料** | 继续不暴露账户手机（已做）；勿与履约号混用 |

- 相关：`auspost-mypost-dual-track`（MyPost CSV+API）；订单 `deliveryAddressSnapshot.contactNumber`；CMS/Merchant 订单与手动下单联系电话字段。

## 期望目标结果

### 计划要做的

- [ ] 定产品矩阵：上表各场景「商户可见形态」vs「承运/配送可见形态」
- [ ] 定技术手段候选：中间号 / 服务端仅在导出·API 注入明文 / 角色权限（配送员可见）
- [ ] 设计订单详情与手动下单：脱敏展示 + 不把脱敏串写回 snapshot 明文（对照邮箱脱敏模式）
- [ ] 与 AusPost 双轨 entry 对齐：自动建单路径优先「直传不展示」

### 触发后才做的

- [ ] 接入第三方中间号/隐私号供应商 — 触发：产品选定「转接号」方案且有供应商
- [ ] DROP 或强制清空商户 API 中的明文 `contactNumber` — 触发：全端（含旧包）已只消费脱敏字段或服务端导出通道
- [ ] 平台代发短信触达客户（relay）— 触发：产品单独排期（原 PII Phase 2）

## 触发条件 / 目标窗口

**mid**。AusPost 双轨或自配送隐私诉求明确时启动设计；可与 `auspost-mypost-dual-track` 同窗口讨论「API 直传手机」。

## 相关

- 已完成 post-deploy：[`../post-deploy-ledger/entries/2026-08-merchant-customer-pii-restriction.md`](../post-deploy-ledger/entries/2026-08-merchant-customer-pii-restriction.md)
- AusPost：[`./2026-11-auspost-mypost-dual-track.md`](./2026-11-auspost-mypost-dual-track.md)
