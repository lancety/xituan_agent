# L1 · 客户端总体设计规范

Last updated: 2026-11-14

继承：[`00-platform-wide.md`](./00-platform-wide.md)  
覆盖：`xituan_site` · `xituan_app_customer` · `xituan_wechat_app`

## 用户与任务

| 用户 | 典型任务 |
|------|----------|
| 消费者 | 逛店、活动/预售、下单、支付、查单、售后入口 |

## 体验基线（三端一致）

| 项 | 约定 |
|----|------|
| 信息架构 | 店面 → 商品/活动 → 详情 → 结算/订单；跨端路径语义对齐 |
| 视觉语气 | 偏「选购」：清晰价格与主 CTA，次要信息降噪 |
| 触控 | 主操作热区足够；列表卡片宽度/间距见各 L2 |
| 多语言 | 与站点/小程序既有 i18n 方案一致；UI 文案不硬编码 |

## 平台映射（仅原则）

| 端 | 实现 | 差异文档 |
|----|------|----------|
| Site | Next + Ant Design + `site-*` CSS | [`site.md`](./site.md) |
| Customer App | Expo / RN | [`customer-app.md`](./customer-app.md) |
| WeChat | 小程序 | [`wechat-app.md`](./wechat-app.md) |

三端共享同一 L0 语义；禁止因端不同而换品牌主色或「另一套美工风」。

## 相关文档

- Site 产品/技术背景：[`../devGuide/xituan-site-design.md`](../devGuide/xituan-site-design.md)
- Site token 现状：[`../devGuide/xituan-site-design-system.md`](../devGuide/xituan-site-design-system.md)
