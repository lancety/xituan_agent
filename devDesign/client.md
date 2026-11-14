# L1 · 客户端总体设计规范

Last updated: 2026-11-14

继承：[`00-platform-wide.md`](./00-platform-wide.md)  
覆盖：`xituan_site` · `xituan_app_customer` · `xituan_wechat_app`

## 用户与任务

| 用户 | 典型任务 |
|------|----------|
| 消费者 | 逛店、活动/预售、下单、支付、查单、售后、与商家沟通 |

## 体验基线（三端一致）

| 项 | 约定 |
|----|------|
| 信息架构 | 店面 → 商品/活动 → 详情 → 结算/订单；路径语义跨端对齐 |
| 视觉语气 | 偏「选购」：价格与主 CTA 清晰，次要信息降噪 |
| 双主题 | **必须** light + dark（见 L0）；切换后店面、购物车、订单、聊天均可用 |
| 触控 | 主操作热区足够；列表卡片宽度见各 L2 |
| 多语言 | 既有 i18n；UI 文案不硬编码 |
| 状态色 | 订单/活动模式强调色跨端语义对齐（如预售/团购/零售头图 tint）；具体值可在 L2 映射 |

## 平台映射

| 端 | 实现 | 主题挂载 | 差异文档 |
|----|------|----------|----------|
| Site | Next · Ant Design · `site-*` CSS | `body[data-theme]` + `theme.css` | [`site.md`](./site.md)（索引 → 专题） |
| Customer App | Expo / RN | App theme context（light/dark） | [`customer-app.md`](./customer-app.md) |
| WeChat | 小程序 | 主题变量 / 类（须覆盖亮暗） | [`wechat-app.md`](./wechat-app.md) |

三端共享 L0 语义；禁止因端不同换品牌主色。色值以 **Site `theme.css` 为客户端参考源**。L2 根文件仅为索引，细节在 `*-theme.md` 等专题。
