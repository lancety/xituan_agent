# platform-feedback-ai-triage

Last updated: 2026-10-20

## 摘要

平台 **多类型反馈**（投诉 / 举报 / 建议 / 技术问题等）入库后，用 AI **预处理**生成固定格式报告与建议行为，再分流「可自动裁定」与「人工裁定」。  
**不是** post-deploy：IM 聊天举报 Phase 1 只做落库 + 反馈邮箱；本项是后续运营能力规划。

## 当前掌握的信息

### 已定（与 IM 举报设计对齐）

| 项 | 结论 |
|----|------|
| Phase 1 IM 举报 | 落库 + 发往 Platform **反馈** Tab 配置的邮箱；`ai` jsonb 可空，**不接真模型** |
| 反馈邮箱 | 独立 Platform Tab **反馈**；默认 `feedback@xituan.com.au`；各环境各自配置 |
| 屏蔽语义 | 对齐微信半双工（见 [chat-report-block-design](../../openim/chat-report-block-design.md)） |
| 合规边界 | 仅平台行为准则 / 违规内容；**不做**业务纠纷仲裁（见 [platform-compliance-report-design](../../platform-compliance-report-design.md)） |
| 分表策略 | **按对象分表**（`platform.fb_chat_reports` / `fb_product_reports`…）；统一 `epFeedbackStatus` / `epFeedbackHandlingType`；**不做**万能 subject 单表 |
| 屏蔽 | 不进反馈表 |
| Platform 管理页 | **要做**（查询/跟踪/结案）；settings 反馈 Tab 只配邮箱。人工页先于本 AI 项 |
| 商品图 / 信息举报 | 顾客 → 商品合规表；**下一刀** |
| 本规划 | 反馈类型扩展 + AI 分诊 / 自动裁定 **后置** |

### 产品意向（待设计细化）

1. 反馈按类型分类：投诉、举报、建议、技术问题等（可再扩展）。  
2. 入库后 AI 读结构化字段 +（举报类）可选拉 OpenIM 文本窗口。  
3. 输出：**固定格式报告** + **建议行为**（枚举动作，禁止自由发挥封号文案）。  
4. 分流：  
   - 结论明确 → 标记可自动裁定，执行最匹配行为（需白名单 + 审计）  
   - 不确定 → 人工裁定队列  
5. 模型供应商、prompt、是否异步 Job：实施时再定；Phase 1 不绑定。

### 相关路径（现有）

| 角色 | 路径 |
|------|------|
| IM 举报/屏蔽方案 | `xituan_agent/devGuide/openim/chat-report-block-design.md` |
| Platform 设置页 | `xituan_platform/src/pages/settings.tsx` |
| platform_settings | `epPlatformSettingCategory`（将新增反馈类 category） |
| 邮件 | 现有 SES / `PLATFORM_NOTIFY_EMAILS` 等可参考；反馈收件以配置项为准 |

### 明确不做（现在）

- 不在 IM 举报 Phase 1 内接真模型或自动封号。  
- 不把本项写成 post-deploy 清理债。

## 期望目标结果

### 计划要做的（启动实施后）

- [ ] 设计文档：反馈类型枚举、报告 schema、动作白名单、人工队列状态机  
- [ ] Platform **反馈** Tab 扩展（类型开关 / 邮箱已有则可复用）  
- [ ] 入库管道：各端写入各自 `platform.fb_*_reports`；管理页多表汇总  
- [ ] AI 预处理 Job 或同步 API：写回报告 + 建议动作 + auto/manual 标记  
- [ ] 自动裁定仅执行白名单动作 + 全量审计日志  
- [ ] 本 entry → `done`，registry 归档  

### 触发后才做的

| 项 | 触发条件 |
|----|----------|
| 接具体 LLM 供应商与计费 | 设计文档定稿且平台同意成本模型后 |
| IM 举报成功后自动 enqueue AI | IM Phase 1 已上线且反馈管道能消费同一报告格式时 |
| 高风险动作（封号/强制解除会话）进自动裁定 | 人工裁定跑通一段时间、误判率可接受后 |

## 触发条件 / 目标窗口

主动启动「平台反馈 AI 分诊」设计/实施时（建议在顾客+商户 App 举报/屏蔽上架之后）。  
**现在不实施**（2026-10-20：仅登记规划）。

## 实施备忘（可选草稿）

- 报告 JSON 与各 `fb_*_reports.ai` jsonb 宜共用一份 codebase type，避免两套结论枚举。  
- 自动裁定与 BusinessError / 账号 status 变更需走现有权限与审计，勿在 LLM 输出里直接执行任意 SQL。  
- 异步可用现有 async jobs 框架（见 [async-lambda-jobs-framework](../../async-lambda-jobs-framework.md)）。
