# OpenIM 聊天举报与屏蔽（App Store 1.2）

Last updated: 2026-10-19

## 背景与结论

顾客 ↔ 商户私聊属于用户生成内容（UGC）。App Store **Guideline 1.2** 要求提供：

- 举报不当内容/用户的机制
- 屏蔽滥用用户、使其无法再向你投递内容的机制
- 可联系运营方的公开联系方式（隐私政策 / 支持邮箱即可）

**结论：** Phase 1 在 `customer_merchant` 会话上实现「按会话屏蔽 + 举报落库 + 内部通知邮件」；客户端仅 **顾客 App + 商户 App**。微信 IM **本期不做**。商家 ↔ 平台会话可后续复用同一套契约。

当前仓库 **无** 现成举报/屏蔽实现。落地前若 CMS 已有独立投诉后台，应优先对接，避免平行造两套。

---

## Phase 1 范围

| 含 | 不含 |
|----|------|
| `customer_merchant` 双向会话 | 微信 `packageIm`（后续单独排期） |
| 顾客 Expo + 商户 Expo | `merchant_platform` 会话 |
| 屏蔽 / 解除（仅屏蔽方）/ 举报落库 | 举报当下强制备份全文到 PG |
| 内部通知邮件 + DB 记录 | 必须上线的 CMS 工单台（可后置） |
| **预留** 内部 AI 分析接口（见下文） | Phase 1 强制接好 LLM 供应商（可 stub → 真模型） |

产品模型说明：业务上顾客与商户会话本身是 **一对一会话实例**；「全局拉黑该用户在所有商户」对本期无独立需求，**会话级屏蔽即可**。

---

## 产品规则

### 屏蔽（Block）

| 规则 | 说明 |
|------|------|
| 粒度 | **单个会话**（`conversationId`） |
| 生效后 | 双方均不可再发消息（服务端硬拦）；可进房看历史；输入区禁用 |
| 列表 | 会话仍可见，展示「已屏蔽」态 |
| **解除** | **仅提出屏蔽的一方**可解除（`blocked_by_user_id` 必须等于当前用户）。对端不能替对方解封 |
| 双方都曾屏蔽 | 各有一条生效 block 时，须各自解除后会话才恢复可发；任一生效记录存在即 `isBlocked` |
| 与现有字段 | 已有 `allow_customer_send`（merchant_push）**独立**；勿混用 |

### 举报（Report）

| 规则 | 说明 |
|------|------|
| 入口 | 聊天室「⋯」→ 举报；可选：长按消息 → 举报该条 |
| 原因 | 固定枚举（垃圾广告、骚扰、欺诈、不当内容、其他） |
| 反馈 | 提交成功 Toast；不暴露 AI/工单细节 |
| 处理路径 | **DB 落库** + **内部通知邮件**（见下）+ 可选 AI 分析写回 |

### 「邮件」指什么

不是给举报用户再发一封「感谢举报」营销信（可做可不做）。

**指运营通知：** 用户提交举报后，后端向内部邮箱（如 support / trust-safety 配置项）发一封邮件，内容含 reportId、conversationId、双方 userId、reason、时间、可选 message_ref 与后台/后续 AI 分析入口链接。这样在没有 CMS 列表时，仍满足「有人能收到并处理」的 App Review 处理路径。

### 明确不做（Phase 1）

- OpenIM 原生好友黑名单（以 PG block + 发消息拦截为准）
- 举报瞬间把完整聊天记录拷进 PostgreSQL（见「证据与持久化」）
- 微信侧入口

---

## 证据与 IM 持久化

| 问题 | 结论 |
|------|------|
| 聊天记录存在哪？ | **OpenIM 服务端**（部署含 Mongo 等）；业务 PG（`im` schema）只存会话映射、参与者、预览、附件元数据等，**不存消息全文** |
| 举报当下要不要备份？ | **不用。** 初期只存举报元数据 + 可选 `message_ref`（消息 id / 短摘要） |
| 纠纷后续怎么取证？ | 处理/AI 分析时再按 `conversationId` **按需**从 OpenIM 拉文本历史（现有 history API / `pull_msg_by_seq` 等） |
| 风险 | 若日后启用会话 `purge_after_at` / retention 清历史，须在清之前完成分析或再做证据快照；Phase 1 默认假定 IM 仍保留可拉历史 |

可选增强（非 Phase 1 必做）：人工点「升级处理」或 AI 分析成功后，将**文本窗口快照**写入 `content_reports.evidence_text`（或对象存储），防止后续 purge。

---

## 数据模型

Schema：`im`。时间列一律 `timestamptz`。

### `im.conversation_blocks`

| 列 | 说明 |
|----|------|
| id | uuid PK |
| conversation_id | 会话 |
| blocked_by_user_id | 屏蔽方 |
| blocked_by_role | customer / merchant_staff |
| created_at | 屏蔽时间 |
| cleared_at | 解除时间；`NULL` = 仍生效 |

解除 API：仅当当前用户 = `blocked_by_user_id` 且 `cleared_at IS NULL` 时可写 `cleared_at`。

### `im.content_reports`

| 列 | 说明 |
|----|------|
| id | uuid PK |
| conversation_id | |
| reporter_user_id / reporter_role | |
| target_user_id | 被举报对端 |
| reason | enum |
| note | 可选短文本 |
| message_ref | jsonb，可选消息 id，非全文 |
| status | open / ai_reviewed / reviewed / dismissed |
| created_at / reviewed_at / reviewed_by | 审计 |
| **ai_*** | 见下节（可空，分析后回填） |

Migration 仅 `xituan_backend/migrations/` 下一序号。

---

## AI 分析接口（预留，降低人工成本）

**目的：** 运营/内部工具调用后，基于举报点前后的**纯文本**上下文，给出责任比例与短结论，减少逐条读聊天。

### 建议内部 API（非 C 端）

| 项 | 建议 |
|----|------|
| 路径 | 例如 `POST /api/admin/openim/customer-merchant/reports/:reportId/analyze`（需平台/内部权限，勿挂顾客 JWT） |
| 输入 | reportId；可选 `windowBefore` / `windowAfter`（条数或 seq 范围，默认合理窗口） |
| 拉数 | 服务端用 report.conversationId 从 OpenIM 拉文本消息（先忽略图片/语音，或只留「[图片]」占位） |
| 输出写回 report | 见下表 |

### `ai_*` 写回字段（建议）

| 字段 | 说明 |
|------|------|
| ai_status | pending / succeeded / failed / skipped |
| ai_conclusion | **短枚举**，例如：reporter_mostly_at_fault / target_mostly_at_fault / shared_responsibility / insufficient_context / no_violation_apparent |
| ai_reporter_responsibility_pct | 0–100（举报方责任占比） |
| ai_target_responsibility_pct | 0–100（与上项互补或独立校验） |
| ai_summary | 短文本总结（给人工扫一眼） |
| ai_model | 模型标识 |
| ai_analyzed_at | timestamptz |
| ai_raw_ref | 可选：提示词/响应对外不展示的存储键 |

Phase 1 实现策略：

1. 表字段与 API 骨架先落地；`analyze` 可先 **stub**（固定 insufficient_context）或接现有内部 LLM。
2. 举报创建成功路径 **不阻塞** 等 AI；邮件里可带「待分析 / 已分析」状态。
3. 人工仍以 `status` + 自己判断为准；AI 仅为辅助，结论枚举禁止直接自动封号（除非产品另定）。

---

## API 契约（C 端 / 商户端）

| 客户端 | 前缀 |
|--------|------|
| 顾客 | `/api/openim/customer-merchant` |
| 商户 staff | `/api/admin/openim/customer-merchant` |

| 方法 | 路径 | 行为 |
|------|------|------|
| POST | `/conversations/:id/block` | 屏蔽（幂等） |
| DELETE | `/conversations/:id/block` | **仅屏蔽方**解除自己的生效记录 |
| POST | `/conversations/:id/reports` | 提交举报 → 落库 → 发内部邮件（可异步） |
| GET | 会话详情 / 列表 | `isBlocked`、`blockedByMe` |

发消息路径：任一生效 block → `BusinessError`，建议码 `OPENIM_CONVERSATION_BLOCKED`（`eBusinessErrorCode` + i18n）。

共享类型放 `xituan_codebase`；禁止裸字符串枚举。

---

## 客户端 UX

```text
ChatRoom 标题栏 ⋯
  ├─ 举报 → 原因 → 确认 → API → Toast
  └─ 屏蔽 → 二次确认 → API → 禁用输入
仅当 blockedByMe：展示「解除屏蔽」
对端屏蔽了我：只显示已屏蔽/无法发送，无解除按钮
```

| 端 | 锚点 |
|----|------|
| 商户 Expo | ChatRoom / Messages（skill `merchant-openim-chat-ux`） |
| 顾客 Expo | 对应 ChatRoom |
| 微信 | **本期不做** |

审核录屏：进房 → 举报 → 屏蔽 → 无法发送（可再演示屏蔽方解除）。

---

## 运营处理（最小）

1. 举报 → DB + **内部通知邮件**。  
2. （可选）调用 AI `analyze`，写回枚举结论 + 总结。  
3. 人工按邮件 / 后续 CMS 列表处理；严重则维持 block 或动用账号 status。  
4. CMS 只读列表：Phase 1.5 可选。

联系方式：隐私政策与支持邮箱；举报成功文案可再提示。

---

## 实施顺序

1. Migration（blocks / reports，含可空 `ai_*`）+ codebase enum/type  
2. block / report service；发消息拦截；内部邮件  
3. `analyze` API 骨架（stub 或接模型）  
4. 商户 App UI → 顾客 App UI  
5. 业务错误码与 i18n；真机录屏  

粗估：后端 1.5～2.5 天（含 AI 骨架）；双端 UI 各约 0.5～1 天。微信另排。

---

## 后续（非 Phase 1）

- 微信 `packageIm` 对称入口  
- `merchant_platform` 复用  
- CMS 举报工作台 + 一键触发 AI  
- 升级处理时文本证据快照（防 purge）  

---

## 相关文档

- [openim/README.md](./README.md) — OpenIM 文档索引  
- [chat-room-inverted-scroll-design.md](./chat-room-inverted-scroll-design.md) — 聊天室滚动与进房契约  
- [device-push-offline-workflow.md](./device-push-offline-workflow.md) — 离线推送  
- `.cursor/rules/openim-module-boundary.mdc` — 模块边界（消息正文不进 PG）  
- `.cursor/skills/merchant-openim-chat-ux/SKILL.md` — 商户 Expo 消息 UX  
- `xituan_agent/aws-setup/OPENIM-DEPLOYMENT.md` — OpenIM 部署（含 Mongo 等）  
