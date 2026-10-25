# 媒体 CDN 与 SIH 域名拆分实施清单

Last updated: 2026-10-25

## 已定结论（勿再改写成反方案）

| key | 用途 | DNS 主机（xituan / lancety） | Origin |
|-----|------|------------------------------|--------|
| `media` / `wechatMedia` | **前端展示** | **`media[-env].…`**（代码 canonical）；**目标**：`images[-env].…` 为同 CF 别名 | **S3** 直读 |
| `SIH` / `wechatSIH` | **仅后端** SIH | **`imagesih[-env].…`** | SIH CF → APIGW → Lambda |

- 前端只拼 `media` / `wechatMedia`，**不带** SIH query，**不引用** `SIH` / `wechatSIH`。
- 已废弃 siteDomain key：`images` / `wechatImages`。
- **lancety** 只服务微信小程序。只有 **prod** 有小程序，因此只有 prod 必须配 `*.lancety.com`。非 prod 没有小程序，**不必**配 lancety 别名（demo 未配是对的）。
- **prod `images.*` 现仍挂 SIH**：老数据 URL 兼容，还没改成 media 静态别名。目标仍是摘到 media CF；未迁完前不要当配错去改。
- 新环境 / 已迁完的环境：SIH 只挂 `imagesih-*`，不要把 `images-*` 留给 SIH。

**不是**：把 `media`「留给」SIH。静态与 SIH 主机分离；prod `images.*` 是过渡，不是目标架构。

## 主机名一览

| 环境 | 静态（S3，xituan） | lancety（仅小程序） | SIH |
|------|---------------------|---------------------|-----|
| dev / staging | `media-*.xituan.com.au`（`images-*` 已是同 CF 别名） | 不要求 | `imagesih-*.xituan.com.au` |
| demo | `media-demo.xituan.com.au`（`images-demo` 别名） | 不配（无小程序） | `imagesih-demo.xituan.com.au` |
| prod | `media.xituan.com.au` | **要配** `media.lancety.com` / `content.lancety.com` | `imagesih.*`；`images.*` **暂仍挂 SIH**（老 URL 兼容） |

微信合法域名（prod）含 **`media.lancety.com`**（过渡期可保留 `images.*`）；勿把 `imagesih-*` 配给小程序展示。S3 直读 CF ID / 桶策略见 [s3/README.md](./s3/README.md)。

## 命名：为何用 `media` 而不是拆 audios/videos

**一个静态 CDN + S3 路径区分类型**；不要为每种媒体再拆子域名。

直传 PUT 不走本展示 CDN，也不另开 upload 子域。写入主机、暂存前缀和「为何不按图片/文件拆两套上传」见 [S3 直传约定](../../.cursor/skills/s3-direct-upload/reference.md)。`media` 保持只读。

---

## 目标流量

```text
浏览器 → media[-env].xituan.com.au（S3 CF）
小程序（仅 prod）→ media.lancety.com（同一 S3 CF）
prod 旧 images.* URL → 仍走 SIH CF（兼容，待改为 media 别名）

静态路径 → S3 媒体桶（OAC），无 APIGW / 无 SIH Lambda

后端需要即时变换时
  → imagesih-*（SIH / wechatSIH）
      → SIH CF → APIGW → Lambda → S3

PDF 商户 logo：png canonical → getContentUrl(env, 'media', path)
```

---

## DNS / CF 落地

1. [ ] 静态 CF：alternate domain 含 `media-*` + `images-*`（别名），origin = S3，**无** SIH Function
2. [ ] SIH CF：alternate domain 改为 **`imagesih-*`**（从旧 `images-*` 迁出）；证书覆盖
3. [ ] 微信 download 合法域名：仅 **prod** 配 `media.lancety.com`（过渡可留 `images.lancety.com`）
4. [ ] 验证：静态无 `x-amz-apigw-id`；`imagesih` 仍有 SIH 行为

### Codebase

- [x] `siteDomain.media` / `wechatMedia` → `https://media…`
- [x] `siteDomain.SIH` / `wechatSIH` → `https://imagesih…`
- [x] 各端展示 key → `media` / `wechatMedia`；PDF 静态直链

### 发布顺序

1. [ ] DNS/证书：`media-*` + `images-*` 别名 → S3 CF；`imagesih-*` → SIH CF
2. [ ] 发 codebase + 客户端/后端
3. [ ] 微信合法域名（prod）加 `media.lancety.com`
4. [ ] 验收

| 风险 | 缓解 |
|------|------|
| 代码已指 `media-*` / `imagesih-*` 但 DNS 未好 | 先配 DNS/证书再发版，或短暂回滚 URL |
| 微信未加 `media.lancety.com` | 仅 prod 需要；发版前加合法域名；`images.*` 在迁到 media 别名前不要从 SIH 摘掉 |

---

## `site-domain` 示意

代码里各环境都有 `wechat*` 键；**DNS/CF 只在 prod 必须落到 lancety**（现网唯一有小程序的环境）。

```text
# 浏览器 / CMS（各环境，xituan）
media:       https://media[-env].xituan.com.au
SIH:         https://imagesih[-env].xituan.com.au

# 小程序（prod 才要配 DNS）
wechatMedia: https://media.lancety.com
wechatSIH:   https://imagesih.lancety.com
```

非 prod 的 `images-*` 已是 media 静态别名。prod 的 `images.*` 仍指向 SIH，等老 URL 迁完再改成 media 别名。

---

## 相关文档

- [SIH Phase A / 渐进加载](./sih-image-size-phase-a.md)
- [Async Lambda / IMAGE_NORMALIZE](./async-lambda-jobs-framework.md)
- [C4 全量回填](./planned-work/entries/2026-09-image-normalize-full-backfill.md)
- [S3 直传约定](../../.cursor/skills/s3-direct-upload/reference.md) — 直传写入不放在 media 默认 behavior；不新建 upload 子域
- [S3 桶访问 / 私有前缀](./s3/README.md) — OAC 默认可匿名 GET；私有前缀须 Deny CloudFront
- 按类型预生成尺寸：`IMAGE_NORMALIZE_VARIANT_POLICY`（codebase）；取图用 `getContentUrlImageForKind`；改表 → 预生成/`--prune-orphans` → 再改 UI
