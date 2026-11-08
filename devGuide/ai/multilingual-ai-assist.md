# AI 多语言助手（数据块 + 空槽翻译）

Last updated: 2026-11-08

通用框架：多语言长文本（Markdown / 纯文本）在 **空语言槽** 上做 AI 填充，并用可注册 **数据块** 保护不应被翻译的结构化片段（首块：`product-desc`）。

与流水分类词翻译 [`CLASSIFY_RULE_TRANSLATE`](./ledger-ai-use-cases.md) 并列：短关键词走旧用例；长文 + 块走本框架。

## 本期已落地

| 能力 | 位置 |
|------|------|
| 枚举 / 注册表 / wrap·parse·collapse·expand / product-desc resolver | `xituan_codebase`：`typing_api/ai-ml-block.enum.ts`、`utils/ai-ml-assist.*` |
| CMS 团购描述「插入产品描述」 | `MarkdownEditor` + `InsertProductDescriptionModal`；`OfferForm` 传 `offerId` |
| 单语言手输 | 未改路径；仅可选 props 增加工具栏按钮 |

**未做（已登记 planned / high）：** 真实 AI、`fillEmptyLocales`、保存前自动翻译、语言切换批处理 → [planned-work entry](../planned-work/entries/2026-11-multilingual-ai-empty-locale-fill.md) · Cursor plan `/.cursor/plans_planned/ai_多语言空槽翻译_a1b2c3d4.plan.md`

## 标记约定

```markdown
<!--xituan-product-desc id="<productId>" title="1" bold="1" sep=": "-->
**产品名**: 描述正文
<!--/xituan-product-desc-->
```

| 规则 | 说明 |
|------|------|
| tag | `<!--xituan-{epAiMlBlockType} …-->` 开闭对；禁止嵌套 |
| 缺必填 attr | collapse / expand 时 **整块删除** |
| 未注册 `xituan-*` | **不保护**（当普通正文） |
| `product-desc` 必填 | `id` |
| `title="1"` | 显示同语言产品名 |
| `bold="1"` | 产品名 Markdown 加粗（需 title） |
| `nl="1"` | 名称与描述换行（需 title；此时不用 sep） |
| `sep` | 同行连接符，默认 `: `（需 title 且非 nl） |

**展示：** 编辑源码保留标记；预览 / Site 用 `stripMarkersForDisplay` 去掉注释只留正文（react-markdown 无 rehype-raw 时注释会当纯文本漏出）。

## 管线（后续）

1. `shouldRunFill`：无空槽 / 无源文 / collapse 后源 hash 未变 → **不调 AI**（省 token）
2. `collapseForAi` → AI（只译正文，原样保留 `<!--xituan-` 注释行）→ `expandForLocale`
3. CRUD API **不**内嵌翻译；编排在 CMS 保存前或独立 batch worker

### 源语言优先级

显式 `preferredSource` → 商户内容主语言（若有）→ CMS UI 语言 → 商户启用语言序第一个非空 → 平台回退 `zh_cn` → `zh_tw` → `en`

## 扩展新块类型

1. `epAiMlBlockType` + `AI_ML_BLOCK_TYPE_DEFS` attrs  
2. Resolver + `iAiMlResolveContext` 可选 bag  
3. （可选）CMS 插入入口  
4. 单测 wrap / collapse / expand  

不必改 AI prompt 骨架（保护全部已注册开闭注释即可）。

## 相关文档

- [ledger-ai-use-cases.md](./ledger-ai-use-cases.md) — 分类词 / 复查 / 荐词 AI 契约
