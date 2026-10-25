# 电商分类 AI 用例契约

Last updated: 2026-10-25

独立模组：`xituan_backend/src/domains/ai/`。财务域不 import DeepSeek。共享类型在 `xituan_codebase`：`typing_api/ai-use-case.*`、`utils/ai-prompt-spec.util.ts`、`utils/ai-use-case.util.ts`。

与规划中的反馈分诊 AI 共用同一 `domains/ai` + 同一 prompt/输出标准，本切片不接反馈。见 [2026-10-platform-feedback-ai-triage.md](../planned-work/entries/2026-10-platform-feedback-ai-triage.md)。

## 环境变量

- `DEEPSEEK_API_KEY`：必填，缺则 `AI_NOT_CONFIGURED`。生产由 `xituan_backend/.github/workflows/deploy.yml` 注入 GitHub Environment `production` secret。demo **不提供**试用 AI，不注入该变量。本机 `.env*` 不会进 ECS。
- `DEEPSEEK_API_BASE_URL`：默认 `https://api.deepseek.com`
- `DEEPSEEK_MODEL`：默认 `deepseek-chat`
- 预留不读：`AI_API_BASE_URL` / `AI_API_KEY`（以后 backend 转发到独立 AI 进程）

## HTTP

CMS（merchant JWT + TAX_RETURN）：

- `POST /api/admin/ai/use-cases/classify-rule-translate`
- `POST /api/admin/ai/use-cases/ledger-import-review`
- `POST /api/admin/ai/use-cases/classify-rule-recommend`

Platform（ADMIN / SUPER_ADMIN）：仅 translate，`POST /api/admin/platform/ai/use-cases/classify-rule-translate`

请求体：`iAiUseCaseRequest`（`useCase` + `generation` + `payload`）。响应 `data`：`iAiUseCaseResponse`（另含 `provider`、`model`）。

错误码（Shape A）：`AI_NOT_CONFIGURED`、`AI_PROVIDER_UNAVAILABLE`、`AI_INVALID_RESPONSE`、`AI_USE_CASE_INPUT_INVALID`。客户端映射 i18n，不展示模型原文。

## Prompt 五段模板

用例只填 `iAiPromptSpec` 槽位，由 `aiPromptSpecUtil.buildMessages` 生成。user 固定标题：`Task` / `Generation` / `Constraints` / `Input JSON` / `Output JSON`。role、task、constraints 用中文。禁止手写散装 prompt。

## 模型输出信封

顶层只允许四键：`schemaVersion`（现为 1）、`useCase`、`generation`、`data`。与请求不一致或多余键 → `AI_INVALID_RESPONSE`。后续处理只读 typed `data`。

解析器保持严格（不把缺信封、缺 clusters、漏行当成成功）。格式精度靠 prompt：明确禁止把 `items`/`clusters`/`pattern`/`suggestions` 提升到根对象，并给出完整信封示例。失败时 backend 打 `[ai:parse]` 原因，不把模型原文返回给客户端。

## 三个 data

- 翻译：`{ pattern }`，只填空语种，不覆盖已填。
- 复查：`{ items, clusters }`。items：`clientId`、`clusterId`、`action`、`category?`、`confidence`。clusters 无关键词。单次最多 50 行（`AI_REVIEW_ITEM_LIMIT`）。不传现有规则。电商只根据商品名；银行把摘要填进同一 `productTitle` 字段并带 `kind=BANK`、`group`（收入/支出/退款），prompt 输入含 `incomeKinds` / `expenseKinds` 供动作对齐。
- 荐词：`{ suggestions }`。服务端按请求 cluster 回填 `action`/`category`。关键词只从商品名/摘要抽具体品牌/型号/物品名，不从对方抽，禁止 `sales`/`模块` 等泛词。每个勾选标题都应被覆盖（相同物名复用，不同商品各一条，最多 12）。CMS 按行上当前处理结果组 cluster，不依赖复查簇；对不上的行会从标题补一个具体词。每个标题只自动勾一个最长具体词。

分类字段统一用 `action` / `category` / `confidence`。

## 操作流程（CMS / Platform 翻译）

翻译（CMS 规则 Tab、Platform 树表上方表单）：保存后表单不清空；空语种回填；「保存修改」「重新翻译」「新增下一条」。三语都满时重译需先清空。保存规则 API 不调 DeepSeek。

复查 / 荐词在 CMS 流水入账预览 Drawer（银行和电商都有）。页面流程、规则词冲突、重新识别与整理列表以 [流水入账最终方案](../ledger-intake/README.md) 为准。AI 不写税、不直接改块头。

## 相关文档

- [../ledger-intake/README.md](../ledger-intake/README.md) — 流水入账存储、页面、流转（权威）
- [../tax-return-report-design.md](../tax-return-report-design.md)
- [../cross-client-business-error-handling.md](../cross-client-business-error-handling.md)
