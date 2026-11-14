# L2 · CMS（`xituan_cms`）差异

Last updated: 2026-11-14

继承：[`00-platform-wide.md`](./00-platform-wide.md) → [`merchant.md`](./merchant.md)

## 本端差异（相对 L1）

| 项 | 约定 |
|----|------|
| 栈 | React · Ant Design · MainLayout / PartnerFacingLayout |
| 主题 | `global.css` CSS 变量 + `body[data-theme]`；组件覆写遵守 ant-design CSS 规则 |
| 表格 | ResponsiveTable；移动卡片样式见对应 skill |
| Badge | `--badge-state-*` / `--badge-btn-*`（codebase + CMS CSS） |
| 表单 | entity FormData / 多语言 / 图片直传等既有框架 |

## 待补

- 从 CMS `global.css` 抽语义色摘要进本节（或链到单一 token 源）。
- 与 Merchant App 订单卡 / 列表的语义对照。
