# 平台合规举报 / 反馈（platform.fb_*）

Last updated: 2026-10-20

## 定位（已定）

喜团提供 **SaaS**。反馈管道只处理 **平台行为准则 / 合规**，**不**仲裁买卖纠纷。  
**屏蔽**只走 `im.conversation_blocks`，不进 `fb_*`。

举报人：**登录顾客**（商品）；聊天为会话双方。  
（「不向对方透露举报人身份」类确认文案：**暂不做**。）

---

## 表：`platform` + `fb_*`（已定）

| 表 | 对象 | 本轮 |
|----|------|------|
| `platform.fb_chat_reports` | 聊天举报 | SQL + API 已有；**Platform 管理页先做聊天** |
| `platform.fb_product_reports` | 商品图 / 信息 | **SQL 已进 0373**；App/备份/结案动作 → [planned-work](./planned-work/entries/2026-10-fb-product-reports-enforcement.md) |

### 跨表统一列

| 列 | 枚举 / 类型 |
|----|-------------|
| `status` | `epFeedbackStatus`：`pending` \| `processed` |
| `handling_type` | `epFeedbackHandlingType`：`auto` \| `manual`（可空） |
| `handling_note` | text — 人工处理备注 |
| `resolution` | `epFeedbackResolution`：`upheld` \| `dismissed` \| `no_action`（结案时填） |
| `merchant_id` | uuid |
| `assigned_to` | uuid 可空 — 认领人 |
| `updated_at` | timestamptz |
| `reviewed_at` / `reviewed_by` / `ai` | 审计 + AI 预留 |

API 只回枚举值；前端 i18n：`feedback.status.*` / `handlingType.*` / `resolution.*`。

---

## 商品证据（设计已定；实现见 planned）

- 登录顾客举报；系统备份该商品 **全部主图原件 + 已有 `_w128`**（缺 `_w128` 无所谓；不备 `_w512`；不现跑 SIH）。
- DB 只存 **`evidence_image_keys`**（备份）+ **`focal_ord`**；**不存** live `source_image_keys`。
- S3 路径：`platform/feedback/fb_product_reports/{reportId}/images/...`。Copy 失败极少见，不做特殊分支。

`category`：`product_image` \| `product_info`（信息入口后置同 planned）。

`epFeedbackProductReason`：`adult` / `violence` / `religion_superstition` / `hate` / `child_safety` / `illegal_regulated` / `copyright_ip` / `scam_misleading` / `other`。

---

## 结案动作（商品；planned）

成立（`upheld`）时可：

1. **下架**相关图或商品（细则 planned）  
2. 产品 tag 加 **`pt::`** 前缀（platform 签发；UI **黄色警告**样式）  
3. 向商户 **外部联系邮箱**发通知  
4. 更新 **《商户协议》** 写明上述措施  

详见 [2026-10-fb-product-reports-enforcement](./planned-work/entries/2026-10-fb-product-reports-enforcement.md)。

---

## Platform 管理页（本轮：先聊天）

- 权限：暂时 **所有 platform ADMIN**（含 SUPER_ADMIN）；不做更细角色。  
- 结案：`handling_type` **不限制**，表单默认 **`manual`**。  
- **认领 `assigned_to`：本轮不做**；有权限的管理员谁都可以操作。  
- 独立菜单「反馈」：列表 / 筛选（status、handling_type、resolution、merchant）/ 详情 / 结案。  
- 本轮只接 **`fb_chat_reports`**；商品 Tab 待 planned。  
- 系统设定 → 反馈 Tab：仍只配邮箱。

### 聊天举报：视窗双 seq + 「≤10 分钟相连」消息簇（已定）

原则：**最小必要** —— 不能进房随便翻全历史，但结案要看到用户**当前屏幕上那一段**以及紧邻上下文。

| 步骤 | 行为 |
|------|------|
| **举报时（App）** | 记录视窗两端：`seqFrom` = 屏内**最早**可见消息 seq；`seqTo` = 屏**最下边**（倒序列表上最新可见）消息 seq。写入 `message_ref`（可附 `sendTimeFrom` / `sendTimeTo` / `summary`）。不是单条「屏幕中间」锚点。 |
| **查阅时（Platform）** | **先整段落** `[seqFrom, seqTo]` 内全部消息；再向更早 / 更晚扩展：**相邻两条 `sendTime` 间隔 ≤ 10 分钟** 则纳入；**> 10 分钟则停止**该方向。只读、无「加载更多」、禁止全会话浏览。**条数不设硬顶**。 |
| **无视窗 seq** | 仅 meta；不提供证据簇。旧数据仅有单 `seq` 时按 `seqFrom=seqTo=seq` 兼容。 |
| **审计** | 每次打开证据簇记一条审计（谁、何时、reportId）。 |

行业对应：viewport + burst 扩展，而不是开放 inbox。  

**常量：** `FEEDBACK_CHAT_EVIDENCE_GAP_MS = 10 * 60 * 1000`（codebase 枚举/const，禁止魔法数）。

## 实施顺序

1. 跑 0373（blocks + `fb_chat_reports` + `fb_product_reports` 空表）  
2. Platform **聊天**反馈管理页（含只读证据窗）  
3. （planned）商品 App 入口 + S3 备份 + 管理页商品 Tab + 下架/`pt::`/邮件/协议  

## 相关文档

- [chat-report-block-design](./openim/chat-report-block-design.md)  
- [fb-product-reports-enforcement planned](./planned-work/entries/2026-10-fb-product-reports-enforcement.md)  
- [platform-feedback-ai-triage](./planned-work/entries/2026-10-platform-feedback-ai-triage.md)  
