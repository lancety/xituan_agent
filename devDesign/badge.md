# 全端 · Badge 视觉合同

Last updated: 2026-11-15

继承：[`00-platform-wide.md`](./00-platform-wide.md) · 品牌基调 [`brand.md`](./brand.md)  
实现入口（瘦 skill）：`.cursor/skills/badge-style-conventions/SKILL.md`

功能色谱须覆盖：**红橙黄绿青蓝紫黑白灰**（与品牌青紫可对齐，语义优先）。

> **本文件只定「用哪种、长什么样」**。className / util / 改 codebase 步骤见 skill。

## 两种模式（必须先分清）

| 模式 | 消费侧语义 | 视觉 | 类名约定 | CSS 变量 |
|------|------------|------|----------|----------|
| **状态** | 只读状态、低打扰 | Soft pill：淡底、低对比 | `.badge-state` + `--{tone}` | `--badge-state-{tone}-{fg\|bg\|border}` |
| **按钮** | 强调 / 可点击标签 | Filled：饱和底、浅字 | `.badge-btn` + `--{color}` | `--badge-btn-{color}-{fg\|bg\|border}` |

未指明时：表格只读状态列 → **状态**；发布态 / 可点 CTA → **按钮**。  
**禁止**用 Ant Design `Tag` 充当 badge 按钮。

## Tone / Color（语义名，跨端对齐）

**状态 tone**：`positive` | `caution` | `danger` | `neutral` | `muted`  
（旧别名：`success→positive`，`warning→caution`，`error→danger`）

**按钮 color**：`blue` | `green` | `orange` | `red` | `default` | `cyan` | `purple`

## 亮 / 暗

- 变量必须在 light / dark **成对**定义（Web：`[data-theme]` / `body[data-theme]`）。
- **状态**：底比旧 pill **更淡**（亮色浅纯色底；暗色低透明度 rgba）。
- **按钮**：bg/border 保持饱和；fg 用浅字保证对比（含暗色）。
- 组件内**禁止**写死 `#fff` / `#1e3a8a` 等当 badge 色。

## 选用规则（产品）

| 场景 | 用 |
|------|----|
| 订单/支付只读态 | 状态 |
| 承诺支付可点确认、发布状态可点 | 按钮 |
| 商户信任档（普通店 / 品牌店）等列表徽标 | 优先 **状态**（软）；高信任档可略醒目，仍走同一套变量 |

订单卡元素与支付可点细则：业务 skill `cms-order-card`（视觉仍服从本文）。

## 遗留（视觉层）

| 旧 | 新 |
|----|-----|
| `.cms-semantic-pill--*` / `--cms-semantic-pill-*` | `.badge-state--*` / `--badge-state-*` |
| `.status-tag-outlined` | `.badge-btn--*` |

新功能禁止再引入旧 pill 变量名或硬编码色块。

## 实现源（Web）

| 端 | CSS（权威色值） |
|----|-----------------|
| CMS | `xituan_cms/src/styles/badge-style.css` |
| Site | `xituan_site/src/styles/badge-style.css`（应对齐同一语义） |

运行时：`xituan_codebase` → `badge-style.enum.ts` / `badge-style-css-vars.enum.ts` / `badge-style.util.ts`
