# Site · 主题 / Token / 栅格

Last updated: 2026-11-15

索引：[`site.md`](./site.md) · 继承 L0 → [`client.md`](./client.md)

## 栈与命名（改色 / 新样式时）

| 项 | 约定 |
|----|------|
| 主题挂载 | `body[data-theme='light']` / `dark`；源码 `src/styles/theme.css` |
| Badge CSS | `src/styles/badge-style.css`；语义见 [`badge.md`](./badge.md) |
| 全局 | `globals.css`、`storefront-layout.css` |
| 类名 | `site-` 前缀 |
| 规则 | 只用语义变量；禁止写死仅适亮色的灰阶 |

## 气质摘要 + 品牌债

目标主色角色 = 商标**主青**（约 `#18C0C8`），副黄/紫点缀——见 [`brand.md`](./brand.md)。

| | Light（目标） | Dark（目标） |
|--|-------|------|
| 画布 | 浅灰/白分层，主青出现在 CTA/链接/选中 | 蓝灰分层（非纯黑糊底），主青用 **暗色微调** 后仍用于 CTA/链接 |
| 正文 | 高对比中性字 | 高对比浅字 |

**品牌青 token（已加）**：`--xituan-brand-cyan` / `-fill` / `-hover`（亮暗成对，见 `brand.md` 暗色微调）。  
**现状债**：`--color-primary` 仍为 `#0969da` / `#316dca` 系；演进应把 primary 收敛到品牌青，勿再扩 GitHub 蓝皮。

完整变量以 `theme.css` 为准；改色前先读 `brand.md`。

## 文本与表面

- 正文层级：`--text-primary` / `secondary` / `tertiary`；勿用 primary 刷大段字  
- 主按钮字：`--text-on-primary`  
- 抬起面：`--bg-raised` / `block` / `input`

## 字号与间距

最小 **14px**（`theme.css`；旧「13px」作废）。

| Token | 值 |
|-------|-----|
| `--font-size-xs`…`md` | 14px |
| `lg` / `xl` | 15 / 16px |
| spacing xs…2xl | 4 → 24px |
| radius sm/md/lg | 4 / 6 / 8px |

## 店面卡片栅格

`.site-card-grid`：flex wrap；`--site-max-width: 1600px`。

| 断点 | 卡宽 |
|------|------|
| &lt; 768px | ~140–160px |
| ≥ 768px | ~216–253px |

## 业务强调色（已有变量）

订单/活动模式（与微信 `theme-mode.util` / [`brand.md`](./brand.md) 一致）：

| Token | 模式 | 色 |
|-------|------|-----|
| `--mode-retail` / `--card-product` / `--order-accent-regular` | 零售 | 亮紫 `#8B5CF6`；暗见 brand |
| `--mode-offer` / `--card-offer` / `--order-accent-offer` | 团购 | 亮青 `#06B6D4`；暗降饱和 |
| `--mode-preorder` / `--card-preorder` / `--order-accent-preorder` | 预定 | 亮琥珀 `#F59E0B`；暗 `#C98512` 级 |

列表卡文本区：`--card-*-info-bg`（亮色淡 wash；暗色低饱和混入 block），勿用顶边色条。  
活动详情：结算 CTA / 面板强调字走 `--site-activity-cta-accent`（= mode）；暗色勿用霓虹黄/青实心。

另有 `--order-header-*`、`--site-product-card-*`（暗色低库存用 secondary）、`--card-news|merchant`。

## 检查清单

1. 语义变量？ 2. light+dark？ 3. `site-` 前缀？ 4. ≥14px？ 5. 错误走 businessError i18n？

## 相关

- 历史：[`../devGuide/xituan-site-design-system.md`](../devGuide/xituan-site-design-system.md)  
- 产品/技术：[`../devGuide/xituan-site-design.md`](../devGuide/xituan-site-design.md)
