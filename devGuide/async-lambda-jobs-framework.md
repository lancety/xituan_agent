# Async Lambda Jobs 框架（Phase C1 + C2）

Last updated: 2026-09-05

## 结论

Backend 统一旁路任务：写 `platform.async_jobs` → 按环境投递 → 回写 job 状态。

| 环境 | IMAGE_NORMALIZE 怎么跑 |
|------|------------------------|
| **production** | CFN：SQS → Lambda（Sharp）→ HMAC `PATCH /api/internal/jobs/:jobId` |
| **dev / demo** | **无 CFN**；`JOB_SQS_QUEUE_URL` 空 → Backend **inline** Sharp（同进程，直接 `JobStatusService`） |
| 本地手工 | 可选 `local-invoke.js`（agent handler + HMAC），或走 `dispatch` 触发 inline |

| 阶段 | 状态 |
|------|------|
| **C1** | 表、dispatcher、HMAC、双 key、投递客户端 |
| **C2** | payload + Lambda 代码 + **production-only** CFN；dev/demo inline |
| **C3** | 上传 enqueue（product/news/logo）+ completion 回写 canonical + 删临时；URL 优先 `_w*` |
| C4+ | 存量回填：**桶内全部业务老图**预生成 canonical + `_w*`（**不再排除**活动头图/轮播、新闻、`noteImages` 等） |

## C3 上传接线

上传仍立刻返回**临时/源 path**（写库）→ `imageNormalizeEnqueueUtil` → inline（dev/demo）或 SQS（prod）。

成功后 `imageNormalizeCompletionHook`：

1. 按 `payload.bind` 把业务字段里的 `sourceKey` 换成 `canonicalKey`
2. **暂不删**临时源（避免误删 `_w*` / 前端仍握着旧 path）；用户删图时用 `removeCatalogImageKeysFromS3` 清兄弟 key
3. 展示：`getContentUrlImage` 对 64/128/256 + `.webp`/`.png` 直链 `_w*`

| bind.kind | 实体 |
|-----------|------|
| `product_images` | `products.images[]` |
| `news_images` | `news.images[]` |
| `merchant_logo` / `merchant_logo_rect` | operation settings jsonb（`format: png`） |
| `offer_header_image` / `offer_featured_images` | `offers.header_image` / `featured_images[]` |
| `preorder_header_image` / `preorder_carousel_images` | `preorder_promotes` 头图/轮播 |
| `product_preset_preview` | `product_custom_presets.preview_image_path` |

展示（**过渡期**）：`.webp`/`.png` → 优先直链 `_w*`；`.jpg`/`.jpeg` → 仍走 SIH。  
**不做** 展示层 `onError`→SIH（缺 `_w*` 的短暂 404 可接受；C4 全量预生成后消失，漏网再补预生成）。  
**终态（C4 + Gate）：业务图只保留 webp / png**；不再支持 jpeg/jpg 主路径。见 post-deploy [`sih-format-allowlist-webp-png`](./post-deploy-ledger/entries/2026-09-sih-format-allowlist-webp-png.md)。

## 状态机

| From | To |
|------|-----|
| PENDING | RUNNING / SUCCEEDED / FAILED / DEAD |
| RUNNING | SUCCEEDED / FAILED / DEAD |
| 终态 | 不可再迁出（同状态回调幂等） |

## 信封（投递体）

| 字段 | 说明 |
|------|------|
| `jobId` | `async_jobs.id` |
| `type` | `epJobType`（含 `IMAGE_NORMALIZE`、PDF_* 占位） |
| `delivery` | `ASYNC_QUEUE` \| `SYNC_INVOKE` |
| `callbackBaseUrl` | dispatch 时解析；**生产 Lambda** 只读信封做 HMAC；inline **不走 HTTP** |
| `payload` | 业务 JSON（见下 IMAGE_NORMALIZE） |

## IMAGE_NORMALIZE payload（C2）

类型：`imageNormalizePayloadUtil` / `iImageNormalizePayload`。

| 字段 | 默认 | 说明 |
|------|------|------|
| `sourceKey` | 必填 | 源 S3 key |
| `bucket` | Backend `S3_BUCKET` / Lambda `MEDIA_BUCKET` | 可覆盖 |
| `format` | `webp` | logo 用 `png` |
| `variants` | `[64,128,256]` | cover 正方形 |
| `maxEdge` | `2048` | canonical 最长边，保比例 |
| `quality` | `80` | |
| `force` | false | true 时覆盖已存在目标 |

命名：源 `…/foo.jpg` → `…/foo.webp` + `…/foo_w64.webp` 等。

成功 `result`：`{ sourceKey, canonicalKey, variants, skipped? }`。

## Env / 部署

| 变量 | 用途 |
|------|------|
| `JOB_CALLBACK_SECRET` | 生产 Lambda HMAC；inline 不需要 |
| `JOB_CALLBACK_SECRET_PREVIOUS` | Backend 轮换验签 |
| `JOB_SQS_QUEUE_URL` | **仅 production**（CFN Output）；dev/demo **留空** |
| `JOB_IMAGE_NORMALIZE_INLINE` | 可选；`true` 强制 inline；默认=无 queue 时 inline |
| `JOB_LAMBDA_FUNCTION_NAME` | 可选 `SYNC_INVOKE` |

### Demo（单 EC2）

- 不部署 `08_async_image_jobs.yaml`
- 不配 `JOB_SQS_QUEUE_URL`
- `dispatch(IMAGE_NORMALIZE, ASYNC_QUEUE)` → `imageNormalizeInlineWorker`（与本地逻辑同契约：读/写同一业务桶）

### Production CFN（人工）

1. 打 Linux zip：[`lambda/image-normalize/README.md`](../lambda/image-normalize/README.md)  
2. 部署 [`aws-setup/08_async_image_jobs.yaml`](../aws-setup/08_async_image_jobs.yaml)（`Environment=production`）  
3. Output `JobQueueUrl` → GHA secret `JOB_SQS_QUEUE_URL`  
4. Lambda 与 Backend 同一 `JOB_CALLBACK_SECRET`

## 本地联调

| 方式 | 说明 |
|------|------|
| `dispatch` + inline | Backend 已跑、queue 空 → 与 demo 相同 |
| Fixture | `node local-invoke.js --fixture` |
| 手工 HMAC | `jobs:create-normalize` + `local-invoke.js --envelope`（验生产 handler.js） |

## HMAC（生产 Lambda）

- `PATCH /api/internal/jobs/:jobId`；签名用 current secret  
- C2 只更新 job；业务 path / 删临时 → C3 `jobCompletionNotifier`

## 代码入口

| 路径 | 作用 |
|------|------|
| `shared/jobs/image-normalize.inline.worker.ts` | dev/demo inline |
| `xituan_agent/lambda/image-normalize/` | 生产 Lambda 源码 |
| `aws-setup/08_async_image_jobs.yaml` | **production only** |
| `migrations/1710000000352_async_jobs.sql` | 表 |

## Retention（延后）

见 [`planned-work`](./planned-work/registry.md) → `async-jobs-retention`。

## 与后续阶段

| 阶段 | 内容 |
|------|------|
| **C3** | 上传 enqueue（product/news/logo）+ completion；`_w*` URL 优先 — 已接线，测稳后再上 production CFN |
| **C4** | 存量回填：本机批处理全量老图 → canonical + `_w*`；DB 对齐 webp/png；**终态不再保留 jpeg/jpg 业务主路径** |
| **D** | PDF 异步 |

## 相关文档

- [SIH Phase A/B](./sih-image-size-phase-a.md)
- [Planned work 台账](./planned-work/README.md)
- [Post-deploy ledger](./post-deploy-ledger/README.md)
