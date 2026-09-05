# IMAGE_NORMALIZE Lambda (Phase C2)

Last updated: 2026-09-05

Sharp worker for **production** CFN (SQS → Lambda → HMAC callback).

**Dev / demo:** do **not** deploy this stack. Backend runs the same contract via `imageNormalizeInlineWorker` when `JOB_SQS_QUEUE_URL` is empty.

## Env (Lambda)

| Variable | Required | Notes |
|----------|----------|--------|
| `JOB_CALLBACK_SECRET` | yes | Sign callbacks (current only) |
| `MEDIA_BUCKET` | yes | Default bucket |
| `AWS_REGION` | set by Lambda | |

## Local optional checks

```bash
npm install
node local-invoke.js --fixture
# optional HMAC path against local Backend — see async-lambda-jobs-framework.md
```

Prefer day-to-day: Backend `dispatch` with empty queue URL (inline).

## Build zip (production CFN)

Linux x64 `sharp` required:

```bash
docker run --rm -v "$PWD":/var/task -w /var/task public.ecr.aws/lambda/nodejs:20 \
  bash -lc 'rm -rf node_modules && npm ci --omit=dev && zip -r /var/task/image-normalize.zip handler.js package.json package-lock.json node_modules'
```

Deploy only via [`../../aws-setup/08_async_image_jobs.yaml`](../../aws-setup/08_async_image_jobs.yaml) (`Environment=production`).
