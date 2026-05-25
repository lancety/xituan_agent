# Agent / 开发全局规则清单（AI 与人工共用）

> **用途**：跨子项目（backend / CMS / platform / site / wechat）的 **统一约定**；领域专项（如商品 metadata）在其 **Skill + devGuide 计划** 中补充，本清单不重复长篇设计。  
> **维护**：新增全仓级规则时更新本文件；各 **`.cursor/skills/*/SKILL.md`** 在 Authority 节 **引用本文件** 即可。

---

## 1. 文档与产出物

| 规则 | 说明 |
|------|------|
| 未定稿调研 / 讨论记录 | 放在 **`xituan_agent/docs/`**（或团队约定的 `docs/`） |
| 已定稿方案、实施计划、接口契约 | 放在 **`xituan_agent/devGuide/`** |
| **编写 devGuide 的流程与去重** | 遵循 **`.cursor/skills/devguide-documentation/SKILL.md`**（中文、选目录、扫重复、更新引用） |
| **跨项目规范/契约**（如 metadata JSON 形状表） | 放在 **`xituan_agent/devStandard/`**；运行时共用 **代码** 放 **`xituan_codebase`** |
| 不要随意新建 `.md`** | 除非用户或任务明确要求 |
| 与用户对话语言 | 工作区规则：**中文**（chat） |

---

## 2. 数据库迁移

| 规则 | 说明 |
|------|------|
| 新迁移脚本目录 | 仅 **`xituan_backend/migrations/`**，文件名取 **下一数字序号** |
| **`migrations_stable/`** | **禁止**由 AI 创建或编辑；由人工晋升 |
| 执行 SQL | **未经用户明确许可不连接数据库执行迁移** |

---

## 3. TypeScript / 代码风格（仓库常见约定）

| 规则 | 说明 |
|------|------|
| 禁止 `any` | 使用明确类型或 `unknown` + 收窄 |
| 枚举 | **禁止**魔法字符串；使用 **枚举成员引用** |
| 注释语言 | **英文** |
| 纯工具文件 | 以 **`xxxxUtil`** 聚合导出，扩展名 **`.util.ts`** |
| `interface` 命名 | 前缀 **`i`**，如 `iProduct` |
| 枚举文件 | 前缀 **`e` / `ep` / `en` / `eb`**（按团队约定），文件名 **`.enum.ts`** |
| 类型接口文件 | 文件名 **`.type.ts`** |

---

## 4. 日期与时间（前后端传输）

| 规则 | 说明 |
|------|------|
| **仅日期**（DB `date`） | 前后端传 **`YYYY-MM-DD` 字符串**；禁止用带时区偏移随意 `new Date(string)` 解析业务日期 |
| **含时刻**（`timestamptz`） | 按项目既有 **`timeZoneToUtc` / `utcToTimeZone`** 等工具 |

---

## 5. API 与权限分层

| 规则 | 说明 |
|------|------|
| 路由分组 | 遵循 **`.cursor/skills/api-route-groups/SKILL.md`**：public / CMS merchant / platform / partner 等 **勿混用** |
| 商户能力 | **CMS** 侧仅用 **merchant RBAC**；**禁止** CMS 前端直接调用 **platform admin** 专用 API |

---

## 6. UI / Ant Design 自定义样式

| 规则 | 说明 |
|------|------|
| 颜色 | **`.cursor/rules/ant-design-component-custom-css-rules.mdc`**：主题变量、`body[data-theme]`，避免硬编码 `#fff` 等 |
| 站点基线 | 涉及 `globals.css` / 排版时参考 **`.cursor/skills/css-style-baseline/SKILL.md`** |

---

## 7. 依赖与运行环境

| 规则 | 说明 |
|------|------|
| Node | **v20**（及项目锁定的 React/TS/Webpack 版本族） |
| **`node_modules`** | **未经许可不删除、不全量重装** |

---

## 8. 子模块与多仓

| 规则 | 说明 |
|------|------|
| 共享类型 | **`xituan_codebase`** 为单一真源；改类型后按团队流程同步各 consumer |
| 复杂同步流程 | 参考 **`.cursor/skills/xituan-multirepo-codebase-sync/SKILL.md`** |

---

## 9. 领域专项（引用即可）

| 主题 | 权威文档 |
|------|----------|
| 商品 metadata / 平台模板 / 绑定 / 合并 / 打印 | **`.cursor/skills/product-metadata-schema/SKILL.md`** + **`xituan_agent/devGuide/product_metadata_开发计划_b162e071.plan.md`** + **`xituan_agent/devGuide/商品_metadata_通用化_70835335.plan.md`** |

---

## 10. Phase 3 相关全局补充（metadata）

- **`metadata_audit_log` 全量写入** 与 **CMS「最近变更」**：**后置**到 Phase 3 核心闭环之后（见分阶段计划）。
- **乐观锁**：绑定/任务等并发敏感表使用 **行级 `version`**（或等价）；`UPDATE … WHERE id=? AND version=?`，成功则递增；失败则提示刷新（见分阶段计划「Phase 3 已确认决策」）。

---

*文件版本：与仓库 `.cursor/rules` 及用户约定对齐；冲突时以工作区 `.cursor/rules` 原文为准。*
