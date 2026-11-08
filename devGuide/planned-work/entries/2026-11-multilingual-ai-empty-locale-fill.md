# multilingual-ai-empty-locale-fill

Last updated: 2026-11-08

## 摘要

长文本多语言 **空槽 AI 填充**（Markdown / 纯文本）+ 数据块挖洞回填。**high**。

块工具与团购「插入产品描述」已落地；本 entry **只跟踪 AI 编排与 use case**。

Cursor plan：`d:/projects/xituan_module/.cursor/plans_planned/ai_多语言空槽翻译_a1b2c3d4.plan.md`

设计文档：[../../ai/multilingual-ai-assist.md](../../ai/multilingual-ai-assist.md)

## 当前掌握的信息

- `aiMlAssistUtil`：wrap / collapse / expand / stripMarkersForDisplay；首块 `product-desc`
- CMS 插入 UI 已通；展示层已剥标记
- 已有 `CLASSIFY_RULE_TRANSLATE`（短关键词）；长文需新 use case，payload 为已 collapse 正文
- CRUD **不**内嵌 AI；保存前 / batch 编排
- 自动化 + `shouldRunFill`（空槽 / 源文 collapse-hash / dirty）避免白烧 token
- 源语言优先级与硬约束已写在 plan / multilingual-ai-assist.md

## 期望目标结果

### 计划要做的

- [ ] codebase：`fillEmptyLocales` + `pickSourceLocale` + `shouldRunFill`
- [ ] backend：`MULTILINGUAL_TEXT_TRANSLATE`（或定名）+ prompt；不查产品
- [ ] CMS：保存前自动 fill（过门闩）；会话 meta
- [ ] 商户支持语言变更：批处理空槽 fill + 删弃用键

### 触发后才做的

- [ ] 强制重译 flag（覆盖非空槽）— 触发：产品明确要求「一键重译」
- [ ] meta 持久化到实体 jsonb — 触发：需要跨刷新仍省 token

## 触发条件 / 目标窗口

**high**；块插入已可用后即可排期。可与 DeepSeek / `domains/ai` 扩用例同窗口。
