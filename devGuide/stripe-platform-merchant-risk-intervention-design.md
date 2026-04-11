# 平台侧商户风险主动介入与加强验证设计方案

本文档与 Stripe 面向软件平台的风险管理框架对齐（信用风险、欺诈风险、账户接管 ATO），在 **Stripe 负责 KYC/onboarding 与（若已签约）Managed Risk 等支付侧能力** 的前提下，定义 **平台侧** 可独立落地的分层策略：何时介入、如何加强验证、如何缓解损失与声誉风险。

**参考**：Stripe — [Introduction to risk management for software platforms](https://stripe.com/au/guides/introduction-to-risk-management)

---

## 1. 设计目标与边界

### 1.1 目标

- 在 Stripe 风控与合规能力之上，补齐 **平台业务语境** 下的风险识别与处置（类目、履约、重复开户、运营投诉、账号安全）。
- 将「被动等拒付/封号」转为 **可编排的主动介入**：分级、可审计、可回滚。
- 与官方指南一致，覆盖三类风险：**信用风险**、**欺诈风险**、**账户接管（ATO）**。

### 1.2 责任边界（概念层）


| 领域        | Stripe 典型承担                | 平台仍需承担                         |
| --------- | -------------------------- | ------------------------------ |
| 身份/商户验证流程 | 托管 onboarding、校验规则更新       | 禁止/限制业务类目、商家真实性二次核验、平台条款与数据配合  |
| 交易级欺诈     | Radar 等（视方案）               | 业务异常模式（自买自卖、异常分销）、站内行为与重复账户    |
| 信用/拒付暴露   | Managed Risk 等条款内覆盖（以合同为准） | 履约纠纷 SOP、对用户的退款与沟通、商家分层限额与暂停营业 |
| ATO       | 部分账户层能力（视产品）               | 登录与权限、敏感操作 MFA、会话与设备风控、提现/改卡复核 |


**原则**：具体赔付与合规义务以 **Stripe 服务协议与当前产品档位** 为准；本方案不替代法务结论，只定义平台产品与运营的 **控制面**。

---

## 2. 与 Stripe 指南的映射矩阵

将官方指南中的 **Onboarding / Monitoring / Mitigation** 映射到本平台能力（见第 3–6 节）。

### 2.1 信用风险（Credit risk）


| 指南要点                              | 平台侧对应设计                            |
| --------------------------------- | ---------------------------------- |
| Onboarding：评估卖家、高价值人工复核           | 商户分级 + 高风险类目清单 + 大额/新商户增强问卷        |
| Monitoring：拒付率、负向余额趋势、客诉          | 指标看板 + 阈值告警 + 周期性复盘队列              |
| Mitigation：延迟结算思路、交割日 capture、集中度 | 平台侧「暂停接单/限制营销/要求保证金或担保」（与支付条款解耦表述） |


指南提示：争议率显著高于常态时需关注（文中示例阈值 **0.75%** 为行业参考，平台应结合自身基线校准）。

### 2.2 欺诈风险（Fraud risk）


| 指南要点                           | 平台侧对应设计                                |
| ------------------------------ | -------------------------------------- |
| Onboarding：重复账户、资料交叉比对         | 设备指纹/支付标识弱关联 + 人工重复户审查规则               |
| Monitoring：行为基线、异常突增           | 交易量/客单价/退款率 Z-score 或环比规则              |
| Mitigation：延迟付款侧释放、防卡测（402 激增） | 收银台限流/CAPTCHA 策略由前端与网关协同；平台侧限制新户小额密集下单 |


### 2.3 账户接管（Account takeover）


| 指南要点       | 平台侧对应设计                                            |
| ---------- | -------------------------------------------------- |
| 登录强认证      | 高权限与「资金相关操作」强制 2FA                                 |
| 异常登录与交易突增  | 新设备/异地会话标记 + 自动进入「只读或暂停提现」态                        |
| 立即暂停打款相关动作 | 与 Stripe payout 策略文档对齐前提下，平台侧先冻结「可发起的业务侧资金动作」与敏感设置 |


---

## 3. 商户风险分层模型

### 3.1 风险档位（建议枚举）

与现有商户状态（如 `pending` / `active` / `suspended` 等）**正交**：风险档位描述 **风控强度**，不替代法务意义上的启用/停用。

建议档位：

- **R0 — 标准**：默认新户通过平台准入后进入。
- **R1 — 观察**：一项软信号触发；加强日志与抽检。
- **R2 — 加强验证**：须完成补充材料或视频核验之一才可恢复全功能。
- **R3 — 限制交易**：限制日/月 GMV、新客订单数、或仅允许履约后结算类流程（与产品形态一致）。
- **R4 — 暂停业务**：停止对外售卖或接单；支付链路是否关停由支付方案与合规共同决定。

### 3.2 档位与平台动作矩阵（示例）


| 档位  | 接单/上架 | 营销/推广 | 提现/分账相关 API      | 加强验证      |
| --- | ----- | ----- | ---------------- | --------- |
| R0  | 允许    | 允许    | 允许（在 Stripe 规则内） | 无         |
| R1  | 允许    | 允许    | 允许               | 抽检        |
| R2  | 条件允许  | 限制    | 延迟或人工复核          | 必做        |
| R3  | 限制    | 禁止    | 暂停或仅允许退款路径       | 必做        |
| R4  | 禁止    | 禁止    | 暂停               | 必做 + 升级人工 |


具体列名与 API 以现有 `merchants` / 权限系统为准（参见 `merchant-audit-fields-and-merchant-settings.md` 等文档）。

---

## 4. 信号源与触发规则（Monitoring）

### 4.1 信号分类

1. **Stripe 侧（Webhook / Dashboard）**
  - `charge.dispute.`*、`charge.refunded`、`payout.*`、`account.updated`（若使用 Connect 或托管账户模型）、Radar 相关事件（视开通情况）。  
  - 用途：拒付、退款异常、payout 失败、账户能力变化。
2. **平台侧交易与履约**
  - 短时订单激增、客单价异常、同一买家多商户分散下单、高退款 SKU、发货超时率。
3. **平台侧身份与关联**
  - 多商户共用设备/证件碎片、与历史拒绝商户信息弱匹配、同 IP 批量注册。
4. **客诉与运营**
  - 工单密度、社交媒体投诉、监管转办（如有）。
5. **安全（ATO）**
  - 新设备登录、非常用地区、敏感操作后短时大额、API key 异常调用。

### 4.2 规则设计原则

- **组合触发**：单信号少误判，**2-of-N** 或「硬阈值 + 软信号」组合进入 R2+。  
- **冷却期**：同一商户同类告警在窗口期内合并，避免告警风暴。  
- **基线自适应**：新市场/大促前调整阈值（指南强调业务会演变，风险画像非静态）。

### 4.3 示例阈值（需按业务校准）


| 信号                     | 示例条件              | 建议档位         |
| ---------------------- | ----------------- | ------------ |
| 滚动 90 天争议率             | > 0.75% 或环比 +200% | ≥ R2         |
| 滚动 30 天退款率             | 超类目 P95           | ≥ R1         |
| 7 日 GMV                | 超该商户历史 3σ         | R1 → 复核      |
| 新设备登录后 24h 内           | 大额订单或改收款信息        | ≥ R3（ATO 预案） |
| 与 rejected 商户税号/银行尾号匹配 | 命中                | ≥ R3 + 合规人工  |


---

## 5. 加强验证阶梯（Enhanced verification）

在 Stripe KYC **之外** 的平台层「加验」，用于欺诈与信用风险的早期隔离。

### 5.1 验证包（Verification packs）


| 包 ID | 内容                      | 适用       |
| ---- | ----------------------- | -------- |
| V1   | 补充经营资料（网址、库存证明、供应商合同其一） | R2 通用    |
| V2   | 法人/受益人视频或活体 + 对公打款小额验证  | 高风险类目或大额 |
| V3   | 物流与履约证明（运单、出库记录）        | 高退款、高客诉  |
| V4   | 关联主体说明（同一控制人多店铺声明）      | 重复户嫌疑    |


### 5.2 流程要求

- **时效**：进入 R2 后 T+72h 内提交，超时自动升级 R3 或进入人工队列（可配置）。  
- **审核**：双人复核（制单/审批分离）用于 R3+ 或单笔影响超过设定金额。  
- **留存**：证据哈希、操作人、时间戳；满足审计与 Stripe 或监管协查导出格式。

---

## 6. 缓解与处置动作（Mitigation）

与指南一致，优先 **延迟风险暴露**、**限制集中度**、**缩短支付与履约时间差**。

### 6.1 平台可执行动作库

- **A1**：限制日/月交易额或订单数（新户默认更严）。  
- **A2**：暂停营销活动、搜索降权、下架高风险 SKU。  
- **A3**：要求「发货后 N 小时才可标记完成」与自动抽检。  
- **A4**：对单一国家/单一商户设置占平台总 GMV 或总争议暴露的上限比例（集中度）。  
- **A5**：ATO 应急包——强制登出其他会话、重置 API 密钥、暂停 payout 相关操作直至人工解封。

### 6.2 与 Stripe 产品协同（概念）

- **Capture 时机**：若业务为预售/远距交付，在技术允许时采用预授权 + 履约后 capture，缩窄信用窗口（与指南「交割日 capture」一致）。  
- **Payout 节奏**：在 Connect/Managed 等模型下，由 Stripe/PSP 账户配置体现；**当前**平台 **不**以 R 档硬性驱动 payout 或 Pending 延迟（与 §12 一致）。

---

## 7. ATO 专章（账户接管）

### 7.1 预防

- 全站支持 2FA；**商家主账号与财务角色**强制开启。  
- 密码策略、登录通知、异常地区拦截或 step-up 验证。  
- 第三方集成密钥轮换与 IP 白名单（若有）。

### 7.2 检测

- 登录：新设备、新 ASN、与历史常驻地不一致。  
- 行为：短时修改收款信息、批量导出客户数据、API 调用模式突变。

### 7.3 响应（Runbook）

1. 自动：进入 **安全冻结态**（禁止敏感写操作、暂停资金侧动作）。
2. 通知：商户注册手机/邮箱 + 站内信。
3. 人工：客服外呼核实身份（防社工），通过后分级解封。
4. 事后：强制改密、撤销会话、记录 incident id。

---

## 8. 组织、工单与 SLA


| 角色   | 职责                       |
| ---- | ------------------------ |
| 风控运营 | 规则调参、队列处理、商户沟通           |
| 客服   | 客诉录入、用户侧退款沟通             |
| 法务合规 | 禁限售、监管函件、与 Stripe 条款变更跟踪 |
| 工程   | Webhook 可靠性、特征计算、审计日志    |


**SLA 建议**：R3+ 工单 4h 内首次响应；ATO 15–30min 内完成自动冻结。

---

## 9. 数据与系统落地（实现概要）

### 9.1 核心数据对象（建议）

- `merchant_risk_tier`：当前档位、变更时间、变更原因 code。  
- `merchant_risk_event`：信号快照、规则 ID、命中字段 JSON。  
- `merchant_verification_case`：验证包、材料、审核记录。  
- `security_incident`：ATO 事件时间线与解封记录。

### 9.2 集成点

- Stripe Webhook 消费者：归一化事件 → 写入 `merchant_risk_event` → 规则引擎评估 → 更新档位 + 通知。  
- 订单/退款服务：下单前读取档位，执行 A1/A2 等策略。  
- CMS/Platform：风控队列 UI、材料审核、人工升降级。

### 9.3 可观测性

- 规则命中率、误杀率（申诉成功）、从 R2 恢复到 R0 的时长分布。  
- Webhook 延迟与重放监控。

---

## 10. 分阶段实施建议


| 阶段  | 内容                                  | 产出                    |
| --- | ----------------------------------- | --------------------- |
| P0  | 商户档位枚举 + 手工升降级 + 审计日志               | 最小可用管控                |
| P1  | Stripe 核心 Webhook + 拒付/退款阈值自动 R1/R2 | 自动化监控                 |
| P2  | 验证包 V1–V2 + 队列 UI                   | 加强验证闭环                |
| P3  | ATO Runbook 自动化 + 会话与敏感操作 MFA       | 安全专章落地                |
| P4  | 集中度与自适应阈值                           | 与指南 Mitigation 高级策略对齐 |


---

## 11. 文档修订

- 与 Stripe 合同、具体产品名（Connect / Managed Risk / Radar for Platforms 等）变更时，同步修订第 1 节边界与第 6.2 节协同描述。  
- 争议率等阈值应每季度按类目复盘，与 [Stripe 平台风险指南](https://stripe.com/au/guides/introduction-to-risk-management) 中的 Monitoring 建议保持一致方向。
- **Direct charge 资金节奏**：**第 12 节** — **硬性仅 Capture（§12.11）**；Pending→Available、Payout **不做平台硬性限制**；§12.2–12.10 中 delay/payout 矩阵为远期参考。
- **关联实施（不重复本文）**：Connect 嵌入式 onboarding、**平台 Stripe 密钥仅 backend env**、**抽成在平台 ORDER + xituan_platform**、**CMS 仅销售侧 PSP**、**Airwallex 与 Stripe Webhook 入口差异及归一化后半段可对齐**、**订阅与抽成解耦**等，以 Cursor 计划 `stripe_connect_站内嵌入_onboarding_*.plan.md` 与 `xituan_agent/devGuide/platform-subscription-billing-devplan.md` 为准；本文侧重风险分层与 Capture 节奏。

---

## 12. Direct charge 下的统一资金节奏与订单协同设计

**当前产品口径（已拍板）**：平台侧 **仅对 Capture 做硬性规则**（何时扣款，见 **§12.11**）。**Pending→Available** 与 **Payout** 阶段 **不做平台硬性限制**，遵循 **Stripe / 各 PSP 默认结算与打款节奏**（含 Managed Risk、账户级 delay、商户侧 `payouts_enabled` 等均由支付方与合同约束）。下文 **§12.2–12.10** 中涉及 `delay_days_override`、按 R 档切换 payout interval、manual payout 末道闸、双账本 `releasable` 等，**保留为远期扩展与运营参考**，**不**作为现阶段实现清单或验收条件。

**Stripe 参考**：[Manage payout schedule](https://docs.stripe.com/connect/manage-payout-schedule)、[Using manual payouts](https://docs.stripe.com/connect/manual-payouts)、[Express Dashboard / Balance](https://docs.stripe.com/connect/express-dashboard)。

### 12.1 能力边界（必须接受的前提）

- **按单笔订单** 精细控制 Pending→Available 的 **不同天数**：Stripe **无** per-PaymentIntent 的 `delay_days_override`；账户级 delay 以官方文档为准。**当前产品不对该层做平台硬性配置。**  
- **「送货完成前可提」**：在 **纯 Direct charge** 下无法在 Stripe 语义上按单锁死；**当前**以 **capture 时机** 为主控制风险暴露，**不**强制叠加 payout 末道闸或内部 releasable 账本。  
- **Express**：商户 Dashboard 能力以 Stripe 设置与合同为准；**当前**不将「关闭自提、仅平台代发 payout」列为必做项。

### 12.2 分级体系（除「商户风险 R」外建议保留的轴）

**现阶段**：**R 档与 Pending/Payout 无硬性联动**（不接 `delay_days_override`、不按 R 强制改 payout schedule）。R 档仍用于第 3–6 节的 **接单/营销/加强验证** 等，不扩展为「结算末道闸」。

| 分级轴 | 当前用途 | 远期可选（未实施） |
|--------|----------|-------------------|
| **商户风险档 R0–R4** | 监控、验证包、接单/上架限制等（见第 3 节） | 若未来要强控资金，再讨论与 delay/payout 绑定 |
| **结算档案 `settlement_profile`** | **仅驱动 Capture 时机**（与 §12.11 一致） | — |
| **成熟度 / 支付路由 / `payout_release`** | 可不建或仅观测 | 若未来做「业务可释放提款」双账本再引入 |

**商户风险 R** 管 **「这人有多可信」**；**`settlement_profile`** 管 **「这类订单何时 capture」**；**Pending→Available / Payout** 当前 **不由平台产品强控**。

### 12.3 三层延迟杠杆（概念模型；当前仅 Layer 1 为必控）

```
Layer 1 — Capture（授权 → 扣款）【当前：平台硬性规则，见 §12.11】
  └ 受卡授权有效期约束；超时 cancel + 重付或调整 capture 策略

Layer 2 — Settlement（Pending → Available）【当前：不平台强限】
  └ 由 Stripe/PSP 默认与账户配置决定；平台可做 **监控与说明**，**不**作为产品硬性门槛矩阵

Layer 3 — Payout（Available → 银行）【当前：不平台强限】
  └ 由 Stripe/PSP、Express 设置与合规状态决定；**不**要求现阶段实现 manual 末道闸或按 R 强制 interval
```

**话术**：仍可教育用户区分 **已付 / 结算中 / 可打款 / 已打款**；**不要求**在 UI 上实现「平台审批每一笔 payout」。

### 12.4 订单类型与 Capture 策略（与业务阶段对齐）

**当前落地口径以 §12.11 为准**；下表与后文 12.8 等保留作扩展参考（含历史讨论：delay、payout 末道闸等）。


| `settlement_profile` | Capture 触发（建议）                                                                                   | 约束与说明                   |
| -------------------- | ------------------------------------------------------------------------------------------------ | ----------------------- |
| **regular**          | CMS 将订单设为 **处理中** 时 **capture**（`auto_capture=false` 流程下）；须在 **授权有效期内** 完成                    | 与 §12.11 一致              |
| **preorder**         | **当前**：与 regular 相同——**一次性付款**，处理中时 **capture**；须在授权有效期内。长周期预售的 **订金+尾款（方案 A）** 见 **§12.11** | 授权过期未 capture → 订单 **取消**（见 §12.11） |
| **group_offer**（团购）  | **最多提前 5 天** 开放下单；**活动/团购开始** 时 **批量 capture**（定时任务，幂等）。付款至开团开始须落在 **授权有效期** 内       | 活动延期须有 Runbook；未 capture 过期 → **取消**   |


**实现要点**：manual capture 的订单必须 **监控「距离授权过期」** 的 SLA，临期自动告警 / 自动 capture / 客服介入。

### 12.5 订单状态机 ↔ Stripe 动作（概念）

建议平台订单至少区分：`**paid_authorized`（仅授权）** / `**paid_captured`（已扣）** / `**processing`** / `**fulfilled**` / `**cancelled**` / `**refund_***`。


| 订单事件                  | Stripe 动作（Direct charge） | 备注                         |
| --------------------- | ------------------------ | -------------------------- |
| 客户完成支付（manual 模式）     | PI `requires_capture`    | 启动授权倒计时任务                  |
| 商户「开始处理」或定时开团 capture | `capture`                | 失败则走补扣/重付流程                |
| 订单取消（未 capture）       | `cancel` PaymentIntent   | 无 capture 则无后续余额链          |
| 订单取消（已 capture）       | **Refund**               | 按政策全额/部分                   |
| 履约完成                  | 无必调 Stripe（除非争议）         | **可选**：内部标记履约（**不**强制驱动 payout 硬闸） |
| 风控 R4 / ATO           | 暂停代发起 payout、关敏感操作       | 与 Stripe 账户能力联动            |


### 12.6 Payout / Pending→Available 作为「末道闸」（远期可选）

**当前**：**不实施**「按 R 档映射 payout interval / 强制 manual + 平台代发 payout」等硬性策略；**不实施**平台侧对 **Pending→Available** 天数的强制配置矩阵。

**若未来要强控**（单独立项时再启用）：可考虑 R 与 manual payout、`delay_days_override`、内部 `releasable` 账本等；本节原列点保留作备忘，**不作为现版需求**。

- Express 是否允许商户自提、Stripe Managed Risk 是否 pause payout，仍以 **Dashboard / 合同** 为准，平台文档不重复列为必做工程项。

### 12.7 退款、争议与负余额防控

- **原则**：尽量在 **仍有 Available 余额** 时完成退款，降低 **借记负余额** 概率；对已 payout 部分需 **从后续进账抵扣** 或 **商户补款**（Stripe Connect 常见路径，以文档为准）。  
- **冷静期**：高争议类目在 **fulfilled** 后保留 **N 天** 再允许该笔关联金额进入「本期释放提款」池（内部规则，非 Stripe 按单冻结）。  
- **Webhook**：`charge.refunded`、`charge.dispute.`* 驱动 **内部可释放余额重算** 与 **R 档再评估**。  
- **Express**：可考虑启用文档所述 **future refunds and disputes balance** 相关能力（若适用），让商户侧更易维持余额健康（见 [Express Dashboard](https://docs.stripe.com/connect/express-dashboard) 中 Payments / balance 描述）。  
- **建议（非硬性）**：争议未结时关注 Available 与后续进账，降低负余额概率；**不**作为平台必须实现的 payout 拦截规则。

### 12.8 配置矩阵（已简化 — 当前不设 delay/payout 数值矩阵）

**当前**：仅需落实 **§12.11 的 Capture 规则**（按 `settlement_profile`：Regular / Preorder / Offer）。**不再**维护「R × profile × delay_days × payout interval」的硬性配置表。

**远期**若恢复 Layer 2/3 平台强控，可再数值化下表类矩阵（历史草案已废弃为验收口径）。

### 12.9 实施检查清单（工程 / 运营）— 与当前口径对齐

- 所有 manual PI 有 **授权过期监控** 与 Runbook。  
- `group_offer` / `preorder` 定时 capture 任务 **幂等**（按 `payment_intent_id` 去重）。  
- **不要求**（当前）：R 档变更自动改 `delay_days_override` / payout schedule；不要求双账本 `releasable` 与 Dashboard 仅展示业务可释放额。  
- **可选**：争议/退款 Webhook 用于 **风控档位再评估**（第 4、7 节），与资金节奏解耦。

### 12.10 Stripe Managed Risk 与平台 payout 控款并行时序

在 **Direct charge + Stripe Managed Risk**（或 Stripe 对子账户负余额承担责任的同类方案）下，**「钱何时进银行」** 往往同时受 **两条轨** 影响，**互不替代**，设计产品时需并列考虑。

**官方依据**：[Stripe Managed Risk](https://docs.stripe.com/connect/risk-management/managed-risk)（Monitoring and mitigation：*slow or pause payouts*、*hold a reserve* 等）；[Using manual payouts](https://docs.stripe.com/connect/manual-payouts)；[Connect risk best practices](https://docs.stripe.com/connect/risk-management/best-practices)（*update your payout creation logic to defer or slow down payouts*）。

#### 两条轨分别管什么

| 轨道 | 主体 | 典型动作 | 与「提现」的关系 |
|------|------|----------|------------------|
| **轨 A — Stripe 风控/合规** | Stripe（Managed Risk 等） | 放慢/暂停 payout、对余额 hold reserve、暂停收款、极端关户 | 子账户 **`payouts_enabled`**、在途 pause 等可能 **不经由你们应用** 即变化 |
| **轨 B — 平台业务控款（当前弱化）** | 你们 | **现阶段不强制**：不按 R 配 delay、不强制 manual payout + releasable；以 **Capture 规则 + 风控档位（接单/验证）** 为主。若未来启用强控，再叠加 `delay_days_override`、manual payout、内部账本 |

**结论**：**当前**商户体感上的 Pending / Payout 节奏 **主要来自轨 A + PSP 默认**；平台 **不**再加一层「必须与 R 挂钩」的硬性 payout 策略。**实际可打款** 以 **Stripe `payouts_enabled` 等账户状态** 与 PSP 规则为准；平台侧 **不**将「未满足内部 releasable」作为与 Stripe 并行的硬闸（未实现该账本即不适用）。

#### 并行时序（文字图，从左到右为时间）

```
客户支付（Direct charge 记在子账户）
    │
    ├─► 子账户 Pending → Available（国家规则 ± 平台设的 delay_days_override）
    │
    ├─►【轨 A】Stripe 持续监控 ──► 可随时：pause/slow payout、reserve、pause charges…
    │
    └─►【轨 B】平台：争议/退款 Webhook、订单 fulfill、冷静期 ──► 重算 releasable
            │
            ▼
    当前产品：不强制平台计算 releasable；Payout 主要由 Stripe/PSP 与商户账户状态驱动
            │
            ▼
    银行入账（节奏以 Stripe/PSP 为准）
```

#### 产品/工程注意

- **Dashboard**：可与 Stripe Express 展示对齐为主；**不强制**自建「业务可释放额」与 Stripe Available 双列对客展示（除非未来立项）。  
- **Webhook**：`account.updated`、`payout.*` 等可用于 **风控观测与客服说明**，**不要求**驱动平台侧「禁止 payout」硬逻辑（除第 3 节 R4 等业务停业类动作外）。  
- **与第 12.7 节**：退款/争议 **建议** 仍关注负余额风险，表述为 **运营建议**，**非**「必须暂扣 payout」的硬性产品规则。

### 12.11 当前落地：仅 Capture 控制 + PSP 默认（及 Preorder 方案 A 备忘）

本节固定 **现阶段** 与 Stripe / Airwallex **子账户收款** 对齐的 **最小策略**：**只规范何时 capture**；**Pending→Available、Payout** 等 **不自建延迟**，按 **各支付服务商默认**（及合同中的 reserve 等）。后续若恢复「平台强控 payout / releasable」等，再以 §12.3–12.8 为扩展。

#### 12.11.1 三条业务线的 Capture 规则（当前）

| 类型 | 规则 |
|------|------|
| **Offer（团购）** | 活动开始前 **最多 5 天** 内允许下单支付（`auto_capture=false`）；**活动开始时** 对仍未 capture 的订单 **统一批量 capture**（任务须 **幂等**，按 `payment_intent_id` 去重）。 |
| **Regular** | 商户在 CMS 将订单置为 **处理中** 时 **capture**。 |
| **Preorder** | **当前与 Regular 相同**：**一次性付款**；CMS **处理中** 时 **capture**（不拆订金/尾款，直至另行启用 §12.11.3 **方案 A**）。 |

**过期未 capture**：授权失效前仍未 capture → 订单按 **取消** 处理（cancel PaymentIntent + 业务单关闭/可重付，具体状态码与前端提示由产品定）。

**工程**：所有 manual capture 须 **授权倒计时**（告警、Runbook）；**Airwallex / Stripe 授权天数** 可能不同（如卡常见 **~5 / ~7 天**），`max_auth_capture_days` 建议取 **多 PSP 保守值** 或 **按路由分支**。

#### 12.11.2 与 Airwallex 路径对齐

- **子账户为收款方**（`x-on-behalf-of`）时：capture 语义与上表一致；**结算 T+N、Reserve** 以 Airwallex 文档与后台为准，**不在此节重复配置**。  
- **佣金 FundsSplit**：在 capture 成功之后从子账户拆佣金；**FundsSplitReversal 仅针对已拆佣金金额**，全额退款走 **Refund**（见仓库 `merged-payment-airwallex-saas-flow.md` §0）。

#### 12.11.3 后续跟进：Preorder **方案 A**（条件订金 + 尾款）— 未启用

**背景**：若 **计划取货日（或允许的最晚 capture 业务日）与支付日间隔** 大于 **安全授权 capture 窗口**（`max_auth_capture_days`，需与卡种、Airwallex/Stripe 文档对齐），则「处理中再 capture」会 **系统性过期**。

**方案 A（条件拆分，未实现）**：

- 若 `pickup_or_capture_deadline_date - payment_date <= max_auth_capture_days`（且商户会在窗口内点处理中）→ 维持 **单笔 + 处理中 capture**（与当前 Regular 一致）。  
- 若 **>** 该窗口 → **下单流程自动改为订金 + 尾款**（两笔 PaymentIntent 或两阶段收款）：订金规则、尾款时点（截单 / 发货前 / 取货前 N 天等）**待产品定案**；支付流程、Webhook、退款对账需单独排期。

**当前决策**：Preorder **先按一次性付款** 上线；启用方案 A 时 **以此节为需求锚点**，并同步改 §12.4 表与下单 UI。

