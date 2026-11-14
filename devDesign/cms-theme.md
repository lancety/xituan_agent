# CMS · 主题 / 布局挂载

Last updated: 2026-11-15

索引：[`cms.md`](./cms.md) · 继承 L0 → [`merchant.md`](./merchant.md)

## 约定

| 项 | 约定 |
|----|------|
| 主题 | **必须** light + dark：`[data-theme]` / `body[data-theme]` + `global.css` 成对变量 |
| Ant Design | 覆写遵守工作区 `ant-design-component-custom-css-rules`；色走变量 |
| 布局 | MainLayout / PartnerFacingLayout；padding 见 skill `mainlayout-content-padding-rule` |
| Badge | [`badge.md`](./badge.md) + skill `badge-style-conventions` |
| 表格外观 | 实现 skill `responsive-table*`；视觉密度服从商户端 L1 |

## 待补

- 从 `global.css` 抽语义色摘要（对齐 Site `theme.css` 命名处尽量同名）  
- 与 Merchant App 主题映射表  
