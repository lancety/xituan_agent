# delivery-phone-merchant-mask

Last updated: 2026-11-08

## 摘要

履约收件人手机对**商户侧**隐藏或改显示为**中间号/脱敏**，同时保证派送方（自配送司机、AusPost 标签/API）仍能联系收件人。  
**mid**。不是 post-deploy：原 `merchant-customer-pii-restriction` 邮箱/账户 PII 已收尾；本条是**新能力设计**，需按配送渠道分别定方案。

Cursor plan：无独立草稿（从 PII 讨论拆出）；实施时可新开 plan。

## 当前掌握的信息

- 现状：订单 snapshot `contactNumber` 对商户明文（履约需要）；账户 `user.phone` 已不嵌在商户订单 user 上。
- 产品意向：商户尽量不看完整真实手机；派送链路仍要可用。
- 已有可减轻暴露的能力（不必等中间号也能先收紧）：
  - OpenIM 站内联系买家
  - 邮件代发（relay）
  - AusPost 系统代建单：真号可只走后端 API/CSV，不进商户 UI
- 渠道差异大，不可一套 UI 硬套：

| 场景 | 倾向方案（2026-11 讨论） | 仍待拍板 |
|------|--------------------------|----------|
| **自行配送** | 默认脱敏 + IM；需要电话时：短时揭示+审计 **或** 中间号外呼；地址可给全量 | 司机/店员角色是否单独「可见明文」 |
| **手动 AusPost 建单**（CMS/Merchant CSV 或 MyPost 网页） | 外站建单几乎必须有号 → 优先引导站内/平台建单；过渡：受控复制/导出+审计；有中间号后填 proxy | 是否允许商户预览全号 |
| **自动继承 AusPost 建单**（系统代填/confirm） | **主路径**：API/CSV 直传明文；商户详情只脱敏/中间号 | 与 `auspost-mypost-dual-track` 字段对齐 |
| **OpenIM / 客户资料** | 继续不暴露账户手机（已做）；勿与履约号混用 | — |

- 相关：`auspost-mypost-dual-track`（MyPost CSV+API）；订单 `deliveryAddressSnapshot.contactNumber`；CMS/Merchant 订单与手动下单联系电话字段。

### 中间号 / 供应商调研（2026-11-08）

- **AWS 不适合直接当淘宝式隐私号**：
  - 曾有 **Amazon Chime SDK Proxy Sessions**（临时中间号 Voice/SMS）→ **2026-04-07 已停服**，勿再评估。
  - **Amazon Connect**：呼叫中心 DID，非买卖双方 AXB 掩码；AU 有 DID（约 USD ~$0.13/天级占用 + 通话费 + KYC），自建绑定成本高。
  - **AWS End User Messaging**：SMS/WhatsApp，不是通话中间号。
- **更贴近候选**：**Twilio Proxy**（或同类 CPaaS）— 一对一掩码通话/短信；费用大致 = **AU 号码月租 + 通/信用量**（非单独「隐私号套餐」）。公开价量级参考：AU Local ~USD $3/月，Mobile ~$8.25/月；打本地 ~$0.025/min、打手机 ~$0.075/min（会变，以官网为准）。需号码池与 AU 合规。
- **阶段建议**：短期不做中间号也可推进脱敏 +「平台建单直传」；中间号仅当手建单/自送外呼量大、产品明确要「转接号」时再接入。

## 期望目标结果

### 计划要做的

- [ ] 定产品矩阵：上表各场景「商户可见形态」vs「承运/配送可见形态」（含短时揭示权限与审计）
- [ ] 定技术手段候选：中间号（Twilio Proxy 等） / 服务端仅在导出·API 注入明文 / 角色权限（配送员可见）
- [ ] 设计订单详情与手动下单：脱敏展示 + 不把脱敏串写回 snapshot 明文（对照邮箱脱敏模式）
- [ ] 与 AusPost 双轨 entry 对齐：自动建单路径优先「直传不展示」；手建路径降级为次要并受控

### 触发后才做的

- [ ] 接入第三方中间号/隐私号供应商（**首选非 AWS**；候选 Twilio Proxy 等）— 触发：产品选定「转接号」且自送/手建单外呼量证明值得号码池成本
- [ ] DROP 或强制清空商户 API 中的明文 `contactNumber` — 触发：全端（含旧包）已只消费脱敏字段或服务端导出通道
- [ ] 平台代发短信触达客户（relay）— 触发：产品单独排期（原 PII Phase 2）

## 触发条件 / 目标窗口

**mid**。AusPost 双轨或自配送隐私诉求明确时启动设计；可与 `auspost-mypost-dual-track` 同窗口先落地「API 直传手机 + 商户侧脱敏」，中间号可后置。

## 相关

- 已完成 post-deploy：[`../post-deploy-ledger/entries/2026-08-merchant-customer-pii-restriction.md`](../post-deploy-ledger/entries/2026-08-merchant-customer-pii-restriction.md)
- AusPost：[`./2026-11-auspost-mypost-dual-track.md`](./2026-11-auspost-mypost-dual-track.md)
