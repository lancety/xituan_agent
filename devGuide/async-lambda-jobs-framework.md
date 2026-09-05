# Async Lambda Jobs 框架（Phase C1）

Last updated: 2026-09-05

## 结论

Backend 统一旁路任务：写 `platform.async_jobs` → 按 `delivery` 投递 SQS 或 `Lambda.invoke` → Worker HMAC 回调 `PATCH /api/internal/jobs/:jobId`。  
**本阶段不含** IMAGE_NORMALIZE Sharp、上传接线、回填、retention 自动清理。

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
| `callbackBaseUrl` | **dispatch 时** `publicApiBaseUtil.resolveBackendPublicOrigin()`；Lambda **只读信封** |
| `payload` | 业务 JSON |
| `merchantId` / `idempotencyKey` | 可选 |

## Env / 部署

| 变量 | 用途 |
|------|------|
| `JOB_CALLBACK_SECRET` | HMAC **签名用 / 验签 current**；未配置则 internal jobs 返回 503 |
| `JOB_CALLBACK_SECRET_PREVIOUS` | 可选；轮换窗口内验签仍接受旧签名（空值忽略，对齐支付双 key） |
| `JOB_SQS_QUEUE_URL` | `ASYNC_QUEUE` → SQS `SendMessage`；缺则 job `FAILED` |
| `JOB_LAMBDA_FUNCTION_NAME` | `SYNC_INVOKE` → Lambda `Invoke`；缺则 job `FAILED` |
| `API_PUBLIC_ORIGIN` / `siteDomain.backend` | `callbackBaseUrl` |
| `AWS_REGION` / `AWS_DEFAULT_REGION` | 投递客户端区域，默认 `ap-southeast-2` |

**密钥轮换（对齐 `PAYMENT_CONFIG_ENCRYPTION_KEY`）：**

1. 新值 → `JOB_CALLBACK_SECRET`；旧值 → `JOB_CALLBACK_SECRET_PREVIOUS`  
2. Backend 验签：current **或** previous 任一通过；**签名 / Lambda 只用 current**  
3. 双端（Backend + Lambda）都切到 current 后，清空 previous  

**生产注入：**

1. GitHub secrets：`JOB_CALLBACK_SECRET`（必填）、`JOB_CALLBACK_SECRET_PREVIOUS`（轮换时）  
2. [`deploy.yml`](../../xituan_backend/.github/workflows/deploy.yml) → ECS（production）  
3. demo：[`deploy-demo.yml`](../../xituan_backend/.github/workflows/deploy-demo.yml) → `.env.demo`  
4. staging/dev CFN：`JobCallbackSecret` / `JobCallbackSecretPrevious` → 容器 env  

C2 Lambda **签名只用 current**；Backend 在过渡期仍认 previous。

## HMAC 回调

- Secret：`JOB_CALLBACK_SECRET`（必填）+ 可选 `JOB_CALLBACK_SECRET_PREVIOUS`（轮换验签）
- Headers：`X-Job-Timestamp`（ms）、`X-Job-Signature`（hex）
- 签名：`HMAC-SHA256(secret, `${jobId}.${timestamp}.${rawBody}`)`（签名用 current）
- 验签：current 或 previous 任一匹配
- 路由：`GET|PATCH /api/internal/jobs/:jobId`（raw body，鉴权仅 HMAC）
- C1 回调**只**更新 job 行；业务回写 / 删临时 S3 经 `jobCompletionNotifier`（C3 注册）

## 代码入口

| 路径 | 作用 |
|------|------|
| `xituan_backend/src/shared/jobs/` | 枚举、信封、dispatcher、status、HMAC、投递 |
| `JobDispatcherService.dispatch` | **唯一**对外投递入口 |
| `migrations/1710000000352_async_jobs.sql` | 表 DDL（**勿自动跑**，需你确认后 migrate） |

## Retention（延后）

C1 **不做** ECS cron / Platform 手搓 purge。见规划台账：[`planned-work`](./planned-work/registry.md) → `async-jobs-retention`。

## 与后续阶段

| 阶段 | 内容 |
|------|------|
| C2 | IMAGE_NORMALIZE Lambda + CloudFormation（SQS/DLQ/IAM） |
| C3 | 上传 enqueue + completion 回写 canonical |
| C4 | 存量回填（排除头图/轮播/`noteImages`） |
| D | PDF 异步 + 多端轮询 |

## 相关文档

- [SIH Phase A/B](./sih-image-size-phase-a.md)
- [Planned work 台账](./planned-work/README.md)
- [Post-deploy ledger](./post-deploy-ledger/README.md)（本框架 C1 **不是** Phase N 债）
