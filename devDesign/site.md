# L2 · Site 索引（`xituan_site`）

Last updated: 2026-11-15

继承：[`00-platform-wide.md`](./00-platform-wide.md) → [`client.md`](./client.md)

## 全站硬约束（极短）

- **Mobile first**；移动 / 平板 / 桌面宽屏均可完成关键任务  
- 双主题 light/dark，且**两套都须用上主青（及副黄紫点缀）**——见 [`brand.md`](./brand.md)  
- 零售/团购/预定活动 UI 套用模式色（紫/青/琥珀）——见 [`brand.md`](./brand.md)  
- 语义变量；`site-`；≥14px；Operate 不换皮；businessError i18n  
- Badge：[`badge.md`](./badge.md)

## 按任务只读一篇

| 改什么 | 打开 |
|--------|------|
| 品牌色 / 活动模式色 / 亮暗用色债 | [`brand.md`](./brand.md) |
| 色 / token / 栅格 / 字号 | [`site-theme.md`](./site-theme.md) |
| 平台首页推荐轨 / 搜索 / 首屏 / 小程序 A·B | [`site-platform-home.md`](./site-platform-home.md) |
| 商户卡普通店·品牌店 | [`site-merchant-trust.md`](./site-merchant-trust.md) |
| Badge 通用 | [`badge.md`](./badge.md) |

**禁止**默认把上表全部灌进 context。

## 栈（一行）

Next.js · Ant Design · next-intl · FA5 · `theme.css` + `badge-style.css`

## Impeccable

仓内薄 [`../../xituan_site/DESIGN.md`](../../xituan_site/DESIGN.md)：先读本索引，再按表面打开对应专题；可选 `.impeccable/surfaces/` 与专题对齐。
