# OpenIM 聊天举报与屏蔽（App Store 1.2）

Last updated: 2026-10-20

## 背景与结论

顾客 ↔ 商户私聊属于用户生成内容（UGC）。App Store **Guideline 1.2** 要求提供：

- 举报不当内容/用户的机制
- 屏蔽滥用用户、使其无法再向你投递内容的机制
- 可联系运营方的公开联系方式（隐私政策 / 支持邮箱即可）

**结论：** Phase 1 在 `customer_merchant` 会话上实现「按会话屏蔽 + 举报落库 + 平台反馈邮箱通知」；客户端仅 **顾客 App + 商户 App**。微信 IM **本期不做**。商家 ↔ 平台会话可后续复用同一套契约。

仓库目前 **无** 现成举报/屏蔽实现；也 **无** CMS 独立投诉台。处理方是 **平台运营**（读邮件 / 后续 Platform 工具），两端 App 只做屏蔽开关与提交举报，不做「审案」。

---

## Phase 1 范围

| 含 | 不含 |
|----|------|
| `customer_merchant` 双向会话 | 微信 `packageIm`（后续单独排期） |
| 顾客 Expo + 商户 Expo | `merchant_platform` 会话 |
| 屏蔽 / 解除（仅本侧）/ 举报落库 | 举报当下强制备份全文到 PG |
| 平台反馈邮箱通知 + DB 记录 | 必须上线的 CMS/Platform 工单台（可后置） |
| OpenIM **before-send** 硬拦 + Valkey 缓存 | OpenIM 原生好友黑名单 |
| **预留** 内部 AI 分析（`ai` jsonb） | Phase 1 强制接好 LLM（可 stub） |

产品模型：一对一会话实例；**会话级屏蔽**即可（不做「全局拉黑该用户在所有商户」）。

---

## 产品规则

### 屏蔽（Block）

| 规则 | 说明 |
|------|------|
| 粒度 | **单个会话**（`conversationId`） |
| **收发语义（已定 A，对齐微信）** | **屏蔽方仍可发**；**被屏蔽侧 → 屏蔽侧** 的消息由 before-send **拒绝**；历史保留；会话列表仍可见并标「已屏蔽」 |
| UX | 被屏蔽侧输入区禁用或发送失败提示（拒收）；屏蔽方输入区仍可用 |
| **顾客侧** | 顾客屏蔽 = `blocked_side=customer`；仅该顾客可解除 |
| **商户侧权限** | 仅 **`epMerchantRole.ADMIN`** 与 **`MANAGER`** 可屏蔽/解除；`PRODUCER` / `DELIVERY` **无** |
| **商户侧效果** | 代表整店；全员同责；任一 ADMIN/MANAGER 可解除（不限原操作者） |
| 双方都曾屏蔽 | 两侧各最多一条生效记录；各自解除；before-send：若发送方命中「对端已屏蔽本侧」则拒 |
| 确认文案（商户） | 声明：**屏蔽后本店所有成员均拒收该顾客来信，责任由商户侧共同承担** |
| 与现有字段 | `allow_customer_send`（merchant_push）**独立**；勿混用 |

### before-send 判定（半双工）

| 发送方向 | 拒发条件 |
|----------|----------|
| 顾客 → 商户 | 存在生效 `blocked_side=merchant`（店已屏蔽该会话） |
| 商户任一 staff → 顾客 | 存在生效 `blocked_side=customer`（顾客已屏蔽） |
| 屏蔽方 → 对端 | **允许**（与微信一致） |

### Platform「反馈」Tab（已定）

- **新建独立 Tab：反馈**（不新建「运营」Tab；反馈类型会扩展：投诉 / 举报 / 建议 / 技术问题等）。
- Phase 1 Section：至少 **反馈邮箱**；默认值 **`feedback@xituan.com.au`**。
- 本地 / staging / 生产 **各自** `platform_settings` 存一份，用各自 Platform 后台改；未配置时回退同一默认邮箱。
- 现有「OmiPay 合作方」等 Tab **保持不动**（不强制合并）。

### 举报（Report）

**范围边界（已定，见 [platform-compliance-report-design](../platform-compliance-report-design.md)）：**  
本管道只接受 **平台行为准则 / 合规**（聊天垃圾话、骚扰、欺诈话术、不当内容等）。**不含**买卖纠纷、退款货不对板等（SaaS 不提供仲裁）。商品图违规（成人/暴力/宗教迷信等）属同一合规域，但 **不在 IM 会话表内实现**，见该文档「下一刀」。

| 规则 | 说明 |
|------|------|
| 入口 | **聊天室**标题栏「⋯」→ 举报；可选：长按消息 → 举报该条。消息列表卡片 **不做** 举报入口（Phase 1） |
| 原因 | 固定枚举（垃圾广告、骚扰、欺诈、不当内容、其他）— **聊天行为类** |
| 反馈 | 提交成功 Toast；不暴露平台审案细节；文案勿暗示平台仲裁订单纠纷 |
| 处理 | **平台运营**读反馈邮箱 + DB；两端不「审」 |

### 举报限流（冷却 + 查重）

| 规则 | 建议 |
|------|------|
| 冷却 | 同一 `reporter` + `conversation_id`：成功提交后 **N 分钟内**不可再报（如 10～15 min）→ `BusinessError` |
| 查重 | 同会话 + 同 reason + 可选同 `message_ref`，且仍有 `status=open` 的未结案举报 → 幂等返回已有 reportId 或明确「已有处理中举报」，**不重复发邮件** |
| 目标 | 防刷邮箱；不影响正常换 reason / 隔一段时间再报 |

### 「邮件」与反馈邮箱

**不是**给举报用户发感谢信。

**是**通知平台运营：举报落库后向 **Platform 配置的「反馈邮箱」** 发信（默认值 `feedback@xituan.com.au`）。投诉 / 举报类均走此邮箱。邮件含 reportId、conversationId、双方标识、reason、时间、可选 message_ref。

配置落点：Platform 设置页 **反馈** Tab → platform setting category（新建，如 `feedback`）；读写走现有 platform-settings 管道。

### 明确不做（Phase 1）

- OpenIM 原生好友黑名单（以 PG block + before-send 为准）
- 举报瞬间把完整聊天记录拷进 PostgreSQL
- 微信侧入口；消息列表卡片上的屏蔽/举报

---

## 发消息硬拦（OpenIM callback）

现状：App 经 **OpenIM SDK 直发**（`sendMessage`），不经自家 REST。因此仅在 REST 抛 `BusinessError` **拦不住真消息**。

### callback 用来干什么

OpenIM 服务端在 **真正入信/投递前** 回调业务后端（如 `callbackBeforeSendSingleMsgCommand`）。业务根据会话是否存在生效 block 返回允许或拒绝。拒绝后对端收不到、发送方失败——这才是合规意义上的「无法再投递内容」。

对端输入禁用 / 失败提示 = UX；callback = **硬拦**（半双工：只拦「发给屏蔽方」的方向）。

### 性能：不要每条消息打 PG

| 层 | 做法 |
|----|------|
| 权威 | PG `im.conversation_blocks`（`cleared_at IS NULL`） |
| 热路径 | **Valkey/Redis**：key 如 `im:conv:{id}:blocked` → `0\|1` 或两侧标记；TTL + **block/unblock 时主动失效/写入** |
| Callback | 先读缓存；miss 再查 PG 并回填缓存 |
| 客户端 | 进房/列表带 `isBlocked` / `blockedByMe` / `blockedByPeer`，减少无效发送尝试 |

OpenIM 进程内 Redis **不能替代**业务 block 表；业务状态在 xituan backend + Valkey。

---

## 证据与 IM 持久化

| 问题 | 结论 |
|------|------|
| 聊天记录存在哪？ | **OpenIM**（Mongo 等）；业务 PG **不存**消息全文 |
| 举报当下备份？ | **不用。** 元数据 + 可选 `message_ref` |
| 取证 | 平台处理/AI 时按需从 OpenIM 拉文本窗口 |
| 风险 | 若启用 `purge_after_at`，须在清前分析或做证据快照 |

---

## 数据模型

Schema：`im`。时间列一律 `timestamptz`。

### `im.conversation_blocks`

| 列 | 说明 |
|----|------|
| id | uuid PK |
| conversation_id | 会话 |
| blocked_side | **`customer` \| `merchant`**（商户侧按店，不按 staff 人） |
| acted_by_user_id | 操作者（顾客 userId 或 staff userId，审计） |
| created_at | 屏蔽时间 |
| cleared_at | 解除时间；`NULL` = 仍生效 |
| cleared_by_user_id | 解除操作者（可空） |

约束：

- 部分唯一索引：`(conversation_id, blocked_side) WHERE cleared_at IS NULL`
- 顾客解除：当前用户须为该会话顾客，且 `blocked_side=customer`
- 商户解除：当前用户须为该商户 staff，且 `blocked_side=merchant`（**不要求** = `acted_by_user_id`）

### `platform.fb_chat_reports`（聊天举报；屏蔽不在此表）

与商品等反馈表同属 `platform` + `fb_*` 前缀；统一 `epFeedbackStatus` / `epFeedbackHandlingType`。详见 [platform-compliance-report-design](../platform-compliance-report-design.md)。

| 列 | 说明 |
|----|------|
| id | uuid PK |
| conversation_id | FK → `im.conversations` |
| reporter_side / target_side | customer / merchant |
| reporter_user_id | 操作者 |
| reason | 聊天行为枚举 |
| note / message_ref | 可选 |
| merchant_id | 冗余筛选 |
| status | `pending` \| `processed` |
| handling_type | `auto` \| `manual` \| NULL |
| handling_note | 处理备注（人工结案为主；与举报人 `note` 分开） |
| resolution | `upheld` \| `dismissed` \| `no_action` |
| assigned_to / updated_at | 认领 + 更新 |
| created_at / reviewed_at / reviewed_by | 审计 |
| ai | jsonb 可空 |

`ai` jsonb 建议键：`status`、`conclusion`、`reporterResponsibilityPct`、`targetResponsibilityPct`、`summary`、`model`、`analyzedAt`、`rawRef`。Phase 1 不按 AI 字段做 SQL 筛选则不必拆列。

Migration：`1710000000373_im_conversation_blocks_platform_fb_chat_reports.sql`（blocks 仍在 `im`）。

---

## AI（本 Phase）

`fb_chat_reports.ai` jsonb；**Phase 1 不接真模型**。  
平台侧「多类型反馈 + AI 预处理 / 自动裁定」见规划台账：[platform-feedback-ai-triage](../planned-work/entries/2026-10-platform-feedback-ai-triage.md)。

---

## API 契约（C 端 / 商户端）

| 客户端 | 前缀 |
|--------|------|
| 顾客 | `/api/openim/customer-merchant` |
| 商户 staff | `/api/admin/openim/customer-merchant` |

| 方法 | 路径 | 行为 |
|------|------|------|
| POST | `/conversations/:id/block` | 本侧屏蔽（幂等）；商户侧 = 整店 |
| DELETE | `/conversations/:id/block` | 解除本侧生效 block（规则见上） |
| POST | `/conversations/:id/reports` | 举报 → 落库 → 反馈邮箱（可异步）；限流/查重 |
| GET | 会话详情 / 列表 | `isBlocked`、`blockedByMe`、`blockedByPeer`（或等价字段） |

发消息被 callback 拒绝时，客户端映射稳定业务码（建议 `OPENIM_CONVERSATION_BLOCKED`）+ i18n。

共享类型放 `xituan_codebase`；禁止裸字符串枚举。

---

## 客户端 UX

```text
ChatRoom 标题栏 ⋯
  ├─ 举报 → 原因 → 确认 → API → Toast
  └─ 屏蔽 → 二次确认（商户含同责声明）→ API
blockedByMe：展示「解除屏蔽」；己方仍可发（半双工）
仅对端屏蔽了我：输入禁用 / 发送失败「已被拒收」；无解除按钮
消息列表卡片：Phase 1 不放屏蔽/举报
```

| 端 | 锚点 |
|----|------|
| 商户 / 顾客 Expo | ChatRoom（skill `merchant-openim-chat-ux` 等） |
| 微信 | **本期不做** |

**实施顺序（已定）：两端都要做；先顾客 App，再商户 App。** 商户端用于 App Store 录屏，但开发先后以顾客端为先。

审核录屏：进房 → 举报 → 屏蔽 → 发送受阻 →（可选）解除。

---

## 运营处理（平台）

1. 举报 → DB + **反馈邮箱**（Platform 配置，默认 `feedback@xituan.com.au`）。  
2. （可选）平台触发 AI `analyze`。  
3. 平台人工处理；严重可维持 block 或动账号 status。  
4. Platform/CMS 工单列表：后置。

用户侧联系方式：隐私政策 + 公开支持/反馈邮箱。

---

## 实施顺序

1. Migration（blocks / reports + `ai` jsonb）+ codebase enum/type  
2. Platform 新建 **反馈** Tab（反馈邮箱，默认 `feedback@xituan.com.au`）  
3. block / report service；Valkey；**OpenIM before-send**（半双工 A）  
4. **顾客 App** UI → **商户 App** UI（ADMIN / MANAGER）  
5. 业务错误码与 i18n；商户端录屏  

粗估：后端约 2～3.5 天；双端 UI 各约 0.5～1 天。微信另排。

---

## 后续（非 Phase 1）

- 微信 `packageIm` 对称入口  
- [平台合规举报（聊天 + 商品图）](../platform-compliance-report-design.md)  
- [平台反馈 AI 分诊](../planned-work/entries/2026-10-platform-feedback-ai-triage.md)  
- Platform 举报工作台  
- 升级处理时文本证据快照（防 purge）  

---

## 相关文档

- [openim/README.md](./README.md) — OpenIM 文档索引  
- [chat-room-inverted-scroll-design.md](./chat-room-inverted-scroll-design.md) — 聊天室滚动与进房契约  
- [device-push-offline-workflow.md](./device-push-offline-workflow.md) — 离线推送（已有 offline callback 先例）  
- [platform-feedback-ai-triage](../planned-work/entries/2026-10-platform-feedback-ai-triage.md) — 反馈 AI 规划  
- `.cursor/rules/openim-module-boundary.mdc` — 模块边界（消息正文不进 PG）  
- `.cursor/skills/merchant-openim-chat-ux/SKILL.md` — 商户 Expo 消息 UX  
- `xituan_agent/aws-setup/OPENIM-DEPLOYMENT.md` — OpenIM 部署  
- `.cursor/skills/redis-valkey-backend/SKILL.md` — Valkey 缓存约定  
