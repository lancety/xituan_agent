# Xituan 界面 / UX 设计规范（索引）

Last updated: 2026-11-14

> **权威目录**：`xituan_agent/devDesign/`（扁平，无子文件夹）。  
> 各 `xituan_*` 应用仓不另建平行「总规范」；产品差异只写本目录对应的 L2 文件。

## 继承（读文档顺序）

| 层级 | 文件 | 范围 |
|------|------|------|
| **L0** | [`00-platform-wide.md`](./00-platform-wide.md) | 全端统一（客户端 + 商户端） |
| **L1** | [`client.md`](./client.md) / [`merchant.md`](./merchant.md) | 客户端总体 / 商户端总体 |
| **L2** | 各项目文件 | 仅写与上两层的**差异**与平台实现映射 |

Agent 改 UI：先 L0 → 再对应 L1 → 再对应 L2，再动代码。下级**不得推翻**上级；重复内容删掉、改链接。

## 文件一览

| 文件 | 层级 | 覆盖项目 |
|------|------|----------|
| [`00-platform-wide.md`](./00-platform-wide.md) | L0 | 全部前端表面 |
| [`client.md`](./client.md) | L1 | site · customer app · wechat |
| [`merchant.md`](./merchant.md) | L1 | cms · merchant app |
| [`site.md`](./site.md) | L2 | `xituan_site` |
| [`customer-app.md`](./customer-app.md) | L2 | `xituan_app_customer` |
| [`wechat-app.md`](./wechat-app.md) | L2 | `xituan_wechat_app` |
| [`cms.md`](./cms.md) | L2 | `xituan_cms` |
| [`merchant-app.md`](./merchant-app.md) | L2 | `xituan_app_merchant` |

`xituan_platform`：暂未单列；适用 L0，有独立视觉需求时再加 `platform.md`（L2）。

## 与其他文档

| 类型 | 位置 |
|------|------|
| 本目录 | **UI / UX / 视觉合同**（跨仓权威） |
| `devGuide/` | 功能方案、实施、runbook |
| `devStandard/` | API / JSON / 错误码等工程契约 |
| `xituan_codebase` | 运行时共享代码（badge util、主题常量等） |

历史 Site token 说明仍见 [`../devGuide/xituan-site-design-system.md`](../devGuide/xituan-site-design-system.md)；逐步收敛到 [`site.md`](./site.md)，以本目录为入口。

## Impeccable / Cursor

- 不在无 git 的 workspace 根放总 `DESIGN.md`。
- 各应用仓若需要 Impeccable 入口：薄 `DESIGN.md` 只指向本目录对应文件（L0+L1+L2），或靠 Cursor skill 强制阅读本路径。
- `/impeccable document` 产出应回写本目录对应层级，避免第三套真相。
