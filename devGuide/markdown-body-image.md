# 正文 Markdown 图片

Last updated: 2026-11-27

CMS 正文可以插入图片。阅读端按 `dw` 显示，并且不超过所在容器。商家 App 和微信商户编辑器目前不上传正文图，插图另开任务。

## 语法

```text
![图片](merchant/.../ab12.webp "dw=480")
```

`dw` 是希望的显示宽度，单位 px，范围 64–1200，按 8 对齐。不写 `dw` 时，图在容器里最多到 100% 宽。编辑器里改尺寸只改这个属性，不重新上传。

## CMS 插入

入口是 `xituan_cms/src/components/news/MarkdownEditor.tsx`。调用方传入 `imageUpload: { bindKind, entityId? }` 才启用上传；不传时，图片按钮仍插入 URL 占位符。

| 页面 | 已有实体 id | 尚无实体 id |
|------|-------------|-------------|
| 团购描述 | `offer_description_images` | `body_image_pending` |
| 预定描述 | `preorder_description_images` | `body_image_pending` |
| 新闻正文 | `news_images`（须 `retainPending: true`，避免误标图库图） | `body_image_pending` |

流程：选图 → 裁剪工作室（裁切、旋转、翻转、亮度 / 对比度 / 饱和度，导出长边不超过 2048 的 webp）→ 直传 `waitNormalize: false`、`retainPending: true` → 插入带 `dw` 的 Markdown。预览里拖图片右缘、下缘或右下角改 `dw`，比例锁定。编辑器和重新打开文档时始终加载导出的大图，不用 `_w*`。

「产品描述」按钮只属于团购，用来插入产品说明，不属于图片上传。

保存时后端把仍被引用的 `body-image-pending` 对象拷进正式目录并改写 Markdown，去掉仍在正文里的对象的 `xt-retain=pending`，删掉从旧正文消失的正式对象。未保存对象靠该标签在 7 天后过期。生命周期脚本在仓库里，未对桶执行。

路径：

- 待定：`merchant/{merchantId}/body-image-pending/{16hex}.webp`
- 团购：`merchant/{merchantId}/offer/{id}/description/{16hex}.webp`
- 预定：`merchant/{merchantId}/preorder-promotes/{id}/description/{16hex}.webp`
- 新闻：`merchant/{merchantId}/news/{id}/images/{16hex}.webp`（与图库同一目录；删除正文图时，仍在 `news.images` 里的 key 保留）

## 阅读端

同一套规则：

- 单张图：宽为 `dw`，并且 `max-width` / `max-height` 都不超过所在容器的 100%，避免把容器撑开。高度随比例。
- 源码里两张图之间没有换行：显示时也在同一行，按各自的 `dw` 从左贴齐，中间不额外留缝。两张加起来超过容器时一起缩小，不拆成上下两行。
- 源码里有换行：上下分开。
- 加载哪张文件：按 `dw` 在 `_w64` / `_w128` / `_w256` / `_w512` / 原图里选最近一档；`dw` 大于 512 用原图。失败则回退原图。编辑器预览不走分档。

| 端 | 展示 | 插入 |
|----|------|------|
| CMS 预览 | 大图 + 拖拽改 `dw` | 工作室 + 直传 |
| Site | `SiteMarkdownBody` | 无 |
| 顾客 App | `MarkdownBody` | 无 |
| 商家 App | `MarkdownBody` 只读展示 | 图片按钮仍是 URL 占位，不上传 |
| 微信顾客 | 活动简介 `activity-description-panel`、新闻详情，先改写成 CDN 地址再交给 wemark | 无 |
| 微信商户编辑 | 团购 / 预定描述仍是 textarea | 无插图按钮 |

微信商户活动详情和顾客活动简介共用 `activity-description-panel`，所以商户查看活动时也会看到同一套展示。这不是编辑器插图。

## 还没做

- 正文图改成最小 / 最大宽度和左中右对齐、以及添加图组：见 `.cursor/plans_planned/正文图_flex_布局_444970db.plan.md`。当前线上属性仍是 `dw`。
- 商家 App、微信商户在手机上插入正文图：见 [planned-work/entries/2026-11-mobile-markdown-body-image-insert.md](./planned-work/entries/2026-11-mobile-markdown-body-image-insert.md)。

## 相关文档

- [图片上传面清单](./image-upload-surface-inventory.md)
- [目录图直传标准](./catalog-image-direct-upload-standard.md)
- Skill：`.cursor/skills/markdown-body-image/SKILL.md`
