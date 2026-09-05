# SIH 图片尺寸契约（Phase A / B）

Last updated: 2026-09-05

## 结论

| 项 | 约定 |
|----|------|
| SIH 查询允许边长 | **64 / 128 / 256 / 512 / 1024**（`SITE_IMAGE_SIH_ALLOWED_EDGES`） |
| **大图 / lightbox** | **直链原图（canonical）**，`getContentUrl` / `getPreviewImageUrl`，**不带** `?width=` |
| `s2048` 枚举 | 表示 canonical / 业务大图边长概念，**不是** SIH query |
| 4096 | 仅客户端上传上限（Phase B），不是 SIH 档 |
| `fit` | **不进 SIH URL**（样本 Lambda 亦忽略）；UI 用 CSS / 微信 `mode` |
| `format` | 跟源路径扩展名；SIH 样本仅允许 jpeg/png/webp |
| 渐进加载 | ~512→SIH 64+512；~1024/~2048→SIH 128 缩略 + **原图**大图 |

权威实现：`site-config.enum.ts`、`content.util.ts`、`site-image-display.util.ts`；Site `site-image.util.ts`；微信 `image-preview.wechat.util.ts`。

## 调用约定

1. 缩略 / 中栏：`getContentUrlImage` + `enSiteImageSize.s64|s128|s256|s512`（必要时 `s1024`）。
2. 点开大图：`getPreviewImageUrl` / `getOriginalUrl` / 微信 `toPreviewUrl`（**无 SIH**）。
3. 不要对大图拼 `?width=2048`（现网 SIZE_OPTS 也可能拒；新方案本就不该走 SIH）。
4. 需要裁切且必须走 SIH：显式传 `fit`（PDF 等）；日常展示不要。

## 客户端上传压缩（Phase B）

| 项 | 约定 |
|----|------|
| 最大长边 | **4096**（`CLIENT_IMAGE_UPLOAD_MAX_EDGE`） |
| CMS / Site / Platform | codebase `clientImageCompressUtil` |
| 微信 | `utils/image-compress.wechat.util.ts`（不进 codebase） |

## 详情页 Gallery（现状）

| 用途 | Site / 微信 | 是否 SIH |
|------|-------------|----------|
| 页内主图 | **512** | 是 |
| 页内缩略 | **128** | 是 |
| 点开大图 / lightbox / `wx.previewImage` | **原图 URL** | **否** |

## SIH Lambda 样本

`xituan_agent/lambda/content.util.sample.dev.js` / `.prod.js`：

- `SIZE_OPTS`：新方案日常 **64–1024**；**完全切完前**可暂时保留 **2048** 给未升级老客户端
- 忽略 query `fit`；`format` 仅 jpeg/png/webp
- prod 有长缓存；dev 无

## 与后续阶段

- **Phase C**：Normalize 写 canonical + `_w64/128/256` 后，大图仍直链 canonical；小图优先 `_w*`，缺档再 SIH 降级。
- **部署尾项（format 白名单 + Lambda env）**：[`post-deploy-ledger/entries/2026-09-sih-format-allowlist-webp-png.md`](./post-deploy-ledger/entries/2026-09-sih-format-allowlist-webp-png.md) — format 收紧本期不动；**部署 SIH 样本时提醒手动更新 `SIZE_OPTS`**。
