# SIH 图片尺寸契约（Phase A）

Last updated: 2026-09-05

## 结论

| 项 | 约定 |
|----|------|
| SIH 允许边长 | **64 / 128 / 256 / 512 / 1024 / 2048** |
| 1024 | 保留档，**不是**商品默认展示档 |
| 旧枚举名 | 已删除；调用点一律用六档 `s64/s128/s256/s512/s1024/s2048` |
| `fit` | **默认不进 SIH URL**；UI 用 CSS `object-fit` / 微信 `mode`；仅 PDF logo 等显式传 `enSiteImageFit` |
| `format` | **跟源路径扩展名**（webp/png/jpeg）；调用方勿再强制 format |
| 渐进加载 | ~512→64+512；~1024→128+2048；~2048→256+2048 |

权威实现：`xituan_codebase/constants/site-config.enum.ts`、`utils/content.util.ts`、`utils/site-image-display.util.ts`。

## 调用约定

1. 宽高优先用 `enSiteImageSize.s*`，禁止随意硬编码非六档数字。
2. 列表缩略图常用 `s64` / `s128`；卡片/中栏 `s256` / `s512`；大图预览 `s2048`（Site `siteImageUtil.getPreviewImageUrl`、微信 `imagePreviewWechatUtil`）。
3. 需要渐进：`siteImageDisplayUtil.getProgressivePair` 或 Site `siteImageUtil.getProgressiveUrls`。
4. 需要裁切/完整装入且走 SIH：显式传 `fit`（例：CMS `ExpenseEditModal` 的 `inside`、打印/PDF）。

## 查漏 checklist（改枚举或改 SIH 配置后重跑）

在 monorepo 根或各 app 内：

```text
# 旧枚举名不得再出现
rg -n "enSiteImageSize\.s(100|200|300|600|900)" --glob "*.{ts,tsx}"

# 硬编码边长（应改为 enum）
rg -n "getContentUrlImage\([^)]*,\s*\d+\s*,\s*\d+" --glob "*.{ts,tsx}"

# 默认塞 fit= 的包装层（应去掉，除显式业务）
rg -n "fit=|enSiteImageFit\." --glob "*.{ts,tsx}"
```

## 详情页 Gallery 尺寸（现状）

### Site（产品 / 团购 offer / 预售 promote 等共用 `ImageGalleryPreview`）

与微信页内 gallery 对齐：**主图 512 / 缩略 128 / 点开 2048**。桌面主图 CSS：`max` 512px，容器内顶部水平居中（`object-fit: contain`）。

| 用途 | 字段 | 尺寸 |
|------|------|------|
| 页内主图（桌面 / 移动） | `fullImage` / `fullImageMobile` | **512** |
| 页内缩略条 | `thumbnail` | **128** |
| 点开 lightbox 大图 | `previewImage`（`getPreviewImageUrl`） | **2048** |
| lightbox 底栏小图 | `previewThumb` | **128** |

### 微信

| 场景 | 用途 | 尺寸 |
|------|------|------|
| 产品详情 | 页内轮播主图 `prodImagesMap` | **512** |
| 产品详情 | 页内缩略 `prodThumbImagesMap` | **128** |
| 产品 / 活动点开 | `wx.previewImage`（`toPreviewUrl`） | **2048** |
| 活动 offer/promote 页内主图 | `getContentUrlImage` / featured | **512** |
| 活动缩略条 | `pathsToThumbUrls` | **128** |
| 活动点开原生预览 | `pathsToPreviewUrls` / `openPage` | **2048** |

运维：AWS Serverless Image Handler 的 `SIZE_OPTS` / 允许宽度与六档对齐，避免拒未知 `width`。

## 与后续阶段关系

- **Phase B**：客户端上传压缩（最大边 4096 等）— 不在本文。
- **Phase C+**：Normalize Lambda、S3 `_w*`、异步 job — 见计划与后续 `async-lambda-jobs-framework.md`。

## 相关文档

- `FormData-Image-Management-System.md` — FormData 留图与 `getContentUrlImage` 展示
- Cursor plan：`lambda_job_framework`（全链路压图 / job 框架）
