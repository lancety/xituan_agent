# 媒体 CDN 与 SIH 域名拆分实施清单

Last updated: 2026-09-06

## 已定结论（勿再改写成反方案）

| key | 用途 | DNS 主机（xituan / lancety） | Origin |
|-----|------|------------------------------|--------|
| `media` / `wechatMedia` | **前端展示** | **`media[-env].…`**（代码 canonical）；**`images[-env].…` 为同 CF 别名** | **S3** 直读 |
| `SIH` / `wechatSIH` | **仅后端** SIH | **`imageSIH[-env].…`** | SIH CF → APIGW → Lambda |

- 前端只拼 `media` / `wechatMedia`，**不带** SIH query，**不引用** `SIH` / `wechatSIH`。
- 已废弃 siteDomain key：`images` / `wechatImages`（DNS 上 `images-*` 仍可作 `media` 别名）。
- SIH **不再**挂在 `images-*`；证书与 CF alternate domain 改为 `imageSIH-*`。

**不是**：把 `media`/`images`「留给」SIH。静态与 SIH 主机分离。

## 主机名一览

| 环境 | 静态（S3） | SIH |
|------|------------|-----|
| dev | `media-dev.xituan.com.au` / `media-dev.lancety.com`（`images-dev.*` 别名） | `imageSIH-dev.xituan.com.au` / `imageSIH-dev.lancety.com` |
| staging | `media-staging.*`（`images-staging.*` 别名） | `imageSIH-staging.*` |
| demo | `media-demo.*`（`images-demo.*` 别名） | `imageSIH-demo.*` |
| prod | `media.xituan.com.au` / `media.lancety.com`（`images.*` 别名） | `imageSIH.xituan.com.au` / `imageSIH.lancety.com` |

微信合法域名需含 **`media-*`（及过渡期 `images-*`）**；勿把 `imageSIH-*` 配给小程序展示。

## 命名：为何用 `media` 而不是拆 audios/videos

**一个静态 CDN + S3 路径区分类型**；不要为每种媒体再拆子域名。

---

## 目标流量

```text
浏览器 / 小程序
  → media-* 或 images-*（同 S3 CF）
      → S3 媒体桶（OAC）
      → 无 APIGW / 无 SIH Lambda

后端需要即时变换时
  → imageSIH-*（SIH / wechatSIH）
      → SIH CF → APIGW → Lambda → S3

PDF 商户 logo：png canonical → getContentUrl(env, 'media', path)
```

---

## DNS / CF 落地

1. [ ] 静态 CF：alternate domain 含 `media-*` + `images-*`（别名），origin = S3，**无** SIH Function
2. [ ] SIH CF：alternate domain 改为 **`imageSIH-*`**（从旧 `images-*` 迁出）；证书覆盖
3. [ ] 微信 download 合法域名更新 `media-*`（lancety）
4. [ ] 验证：静态无 `x-amz-apigw-id`；`imageSIH` 仍有 SIH 行为

### Codebase

- [x] `siteDomain.media` / `wechatMedia` → `https://media…`
- [x] `siteDomain.SIH` / `wechatSIH` → `https://imageSIH…`
- [x] 各端展示 key → `media` / `wechatMedia`；PDF 静态直链

### 发布顺序

1. [ ] DNS/证书：`media-*` + `images-*` 别名 → S3 CF；`imageSIH-*` → SIH CF
2. [ ] 发 codebase + 客户端/后端
3. [ ] 微信合法域名加 `media-*`
4. [ ] 验收

| 风险 | 缓解 |
|------|------|
| 代码已指 `media-*` / `imageSIH-*` 但 DNS 未好 | 先配 DNS/证书再发版，或短暂回滚 URL |
| 微信未加 `media-*` | 发版前加合法域名；过渡可保留 `images-*` 别名 |

---

## `site-domain` 示意（dev）

```text
media:       https://media-dev.xituan.com.au
wechatMedia: https://media-dev.lancety.com
SIH:         https://imageSIH-dev.xituan.com.au
wechatSIH:   https://imageSIH-dev.lancety.com
```

（DNS：`images-dev.*` CNAME/别名到与 `media-dev.*` 同一静态 CF。）

---

## 相关文档

- [SIH Phase A / 渐进加载](./sih-image-size-phase-a.md)
- [Async Lambda / IMAGE_NORMALIZE](./async-lambda-jobs-framework.md)
- [C4 全量回填](./planned-work/entries/2026-09-image-normalize-full-backfill.md)
