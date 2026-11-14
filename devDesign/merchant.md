# L1 · 商户端总体设计规范

Last updated: 2026-11-14

继承：[`00-platform-wide.md`](./00-platform-wide.md)  
覆盖：`xituan_cms` · `xituan_app_merchant`

## 用户与任务

| 用户 | 典型任务 |
|------|----------|
| 店主 / 店员 | 上架、活动、订单履约、账目、设置、扫码/现场操作 |

## 体验基线（两端一致）

| 项 | 约定 |
|----|------|
| 信息密度 | 高于客户端；表格/列表优先，少营销装饰 |
| 布局 | CMS：MainLayout + 标准内容宽与 padding（见 skill `mainlayout-content-padding-rule`） |
| 状态 | badge state（软）vs badge btn（实心）分工明确；见 `badge-style-conventions` |
| 表单 | 实体编辑走既有 FormData / 多语言编辑框架；勿另造一套视觉表单 |
| 错误 | A/B/AB business error；集合接口用 `lineErrors` |

## 平台映射（仅原则）

| 端 | 实现 | 差异文档 |
|----|------|----------|
| CMS | React + Ant Design | [`cms.md`](./cms.md) |
| Merchant App | Expo / RN | [`merchant-app.md`](./merchant-app.md) |

CMS 与 Merchant App 共享商户侧信息架构与状态语义；App 可简化导航与触控尺寸，不改品牌与状态含义。

## 相关文档

- Ant Design 主题色：工作区规则 `ant-design-component-custom-css-rules`
- ResponsiveTable / 订单卡片等：对应 `.cursor/skills`
