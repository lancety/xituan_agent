#!/usr/bin/env bash
# Package + deploy EXPENSE_RECEIPT_OCR SQS/Lambda stack (CFN 09).
# Usage:
#   ./deploy-expense-ocr-jobs.sh production [media-bucket] [code-s3-bucket]
# Requires: aws CLI, JOB_CALLBACK_SECRET in env (or pass via CFN param file).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_NAME="${1:-production}"
MEDIA_BUCKET="${2:-xituan}"
CODE_BUCKET="${3:-}"
STACK_NAME="xituan-expense-receipt-ocr-${ENV_NAME}"
LAMBDA_DIR="$ROOT/lambda/expense-receipt-ocr"
ZIP_PATH="$LAMBDA_DIR/expense-receipt-ocr.zip"
TEMPLATE="$ROOT/aws-setup/09_expense_receipt_ocr_jobs.yaml"
REGION="${AWS_REGION:-ap-southeast-2}"

echo "==> Checking AWS identity"
aws sts get-caller-identity >/dev/null

if [[ -z "${JOB_CALLBACK_SECRET:-}" ]]; then
  echo "ERROR: export JOB_CALLBACK_SECRET (same as Backend ECS secret) before deploy."
  exit 1
fi

echo "==> Packaging Lambda from $LAMBDA_DIR"
rm -f "$ZIP_PATH"
(
  cd "$LAMBDA_DIR"
  zip -q -r expense-receipt-ocr.zip handler.js
)

CODE_S3_KEY="lambda/expense-receipt-ocr/${ENV_NAME}/expense-receipt-ocr.zip"
if [[ -z "$CODE_BUCKET" ]]; then
  # Reuse CF template bucket discovery if present; else require explicit arg
  CODE_BUCKET="$(aws s3api list-buckets --query "Buckets[?starts_with(Name, 'cf-templates')].Name | [0]" --output text 2>/dev/null || true)"
  if [[ -z "$CODE_BUCKET" || "$CODE_BUCKET" == "None" ]]; then
    echo "ERROR: pass code S3 bucket as 3rd arg (bucket to upload expense-receipt-ocr.zip)"
    exit 1
  fi
fi

echo "==> Uploading zip to s3://$CODE_BUCKET/$CODE_S3_KEY"
aws s3 cp "$ZIP_PATH" "s3://$CODE_BUCKET/$CODE_S3_KEY" --region "$REGION"

echo "==> Deploying stack $STACK_NAME"
aws cloudformation deploy \
  --region "$REGION" \
  --stack-name "$STACK_NAME" \
  --template-file "$TEMPLATE" \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    "Environment=${ENV_NAME}" \
    "MediaBucketName=${MEDIA_BUCKET}" \
    "JobCallbackSecret=${JOB_CALLBACK_SECRET}" \
    "CodeS3Bucket=${CODE_BUCKET}" \
    "CodeS3Key=${CODE_S3_KEY}"

QUEUE_URL="$(aws cloudformation describe-stacks \
  --region "$REGION" \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='JobExpenseOcrQueueUrl'].OutputValue" \
  --output text)"

echo ""
echo "==> Done."
echo "Set GitHub Actions / ECS secret:"
echo "  JOB_EXPENSE_OCR_SQS_QUEUE_URL=${QUEUE_URL}"
echo "Then redeploy Backend production so notify-uploaded delivers to this queue."
echo "Also ensure ECS TaskRole can sqs:SendMessage on:"
echo "  arn:aws:sqs:${REGION}:ACCOUNT:xituan-expense-receipt-ocr-${ENV_NAME}"
echo "  (see 06_ecs-services.yaml ExpenseReceiptOcrSqsEnqueue; live prod may use put-role-policy)."
