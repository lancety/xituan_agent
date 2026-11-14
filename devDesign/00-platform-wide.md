# L0 · 全端统一设计规范

Last updated: 2026-11-14

适用范围：Site、Customer App、WeChat、CMS、Merchant App（及后续同品牌前端）。下级文档只补充任务与平台差异，不另起品牌。

## 原则（摘要）

| 原则 | 说明 |
|------|------|
| 语义色优先 | 文本/背景/边框/成功失败用语义 token（如 `--text-primary`、`--bg-*`），禁止业务正文乱涂品牌色 |
| 一屏一事 | 首屏/主操作区只突出一个主行动；避免标题与主按钮抢视线 |
| 少卡片堆叠 | 默认非卡片；卡片仅用于可交互容器；禁止 card-in-card 装饰 |
| 反 AI 套路 | 禁用紫渐变、AI beige、斜体衬线 hero、状态 chip 汤、无意义 glow / 多层阴影 |
| 状态可区分 | Active / Pending / Disabled 等视觉必须可辨；用既有 badge state / btn 体系 |
| 错误可本地化 | 用户可见错误走 `businessError` code + 客户端 i18n，不展示原料中文 `Error.message` |
| 列表→详情 | 跨端导航与首屏预算遵循既有 list-to-detail / render-budget 约定 |

## 语义色与主题

- Light / Dark（或等价主题）成对定义；固定色值只允许品牌主色等少数例外。
- Web：`body[data-theme]` + CSS 变量；RN / 微信：同一语义映射到主题对象，命名尽量对齐。
- 细则与变量表：Site 现状见 [`../devGuide/xituan-site-design-system.md`](../devGuide/xituan-site-design-system.md)；CMS badge 见 skill `badge-style-conventions`。后续收敛进本文件或 L2。

## 组件与文案

- 同一业务概念跨端用同一套状态文案 key / 语义（订单态、支付态等），展示样式可按端密度调整。
- 密度：客户端偏浏览与转化；商户端偏效率与信息密度——见 L1，不在此拆两套色板。

## 禁止（全端）

- 为「好看」在某一端引入第二套色板或展示字体体系。
- 营销落地页式装饰默认套到 CMS / 履约工具页。
- 用 emoji / 贴纸 / 浮动 badge 堆叠代替真实信息层级。

## 相关文档

- 索引：[`README.md`](./README.md)
- L1：[`client.md`](./client.md) · [`merchant.md`](./merchant.md)
