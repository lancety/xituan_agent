# Xituan 界面 / UX 设计规范（总索引）

Last updated: 2026-11-15

> **权威目录**：`xituan_agent/devDesign/`（扁平）。  
> **读法**：L0 → L1 → **L2 索引（短）** → **只开 1 个专题 md**。禁止默认灌入某端全部专题。  
> **全端硬规矩**（详见 [`00-platform-wide.md`](./00-platform-wide.md)）：  
> **Mobile first** · 移动 / 平板 / 桌面宽屏 · **亮+暗** · 商标基调 **主青 + 副黄紫 + 棕黑白** · **零售紫 / 团购青 / 预定橙黄** · Badge 功能色谱（见 [`brand.md`](./brand.md) / [`badge.md`](./badge.md)）。

## 继承

| 层级 | 文件 | 说明 |
|------|------|------|
| L0 | [`00-platform-wide.md`](./00-platform-wide.md) | 全端硬约束 |
| L1 | [`client.md`](./client.md) / [`merchant.md`](./merchant.md) | 客户 / 商户侧基线 |
| L2 索引 | `site.md` / `cms.md` / `customer-app.md` / … | **按仓入口，短** |
| 专题 | `site-theme.md`、`badge.md`、… | **按任务打开** |

## L2 索引 → 专题

| 仓索引 | 专题 |
|--------|------|
| [`site.md`](./site.md) | [`site-theme.md`](./site-theme.md) · [`site-platform-home.md`](./site-platform-home.md) · [`site-merchant-trust.md`](./site-merchant-trust.md) |
| [`cms.md`](./cms.md) | [`cms-theme.md`](./cms-theme.md) |
| [`customer-app.md`](./customer-app.md) | [`customer-app-theme.md`](./customer-app-theme.md) |
| [`wechat-app.md`](./wechat-app.md) | [`wechat-app-theme.md`](./wechat-app-theme.md) |
| [`merchant-app.md`](./merchant-app.md) | [`merchant-app-theme.md`](./merchant-app-theme.md) |
| （跨端） | [`brand.md`](./brand.md) · [`badge.md`](./badge.md) |

## 与 Impeccable / 业务 skill

| 层 | 位置 |
|----|------|
| 视觉合同 | 本目录（索引 + 专题） |
| 应用薄入口 | 各仓 `DESIGN.md` / `PRODUCT.md` → 先读 L2 索引再读专题 |
| 按路由策略 | 可选 `.impeccable/surfaces/`（与专题对齐） |
| 功能实现 | `.cursor/skills/*`（勿写入 `skills/impeccable/`） |

`/impeccable document` 长文应回写本目录对应**专题**，不要把整站 thrash 进单文件 `DESIGN.md`。

## 其它文档

| 类型 | 位置 |
|------|------|
| 功能方案 | `devGuide/` |
| 工程契约 | `devStandard/` |
| Site 历史 token 说明 | [`../devGuide/xituan-site-design-system.md`](../devGuide/xituan-site-design-system.md) → 入口改 [`site.md`](./site.md) |
