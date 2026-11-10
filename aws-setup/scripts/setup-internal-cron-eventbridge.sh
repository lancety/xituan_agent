#!/usr/bin/env bash
# Create EventBridge Connection + API Destinations + Rules for Backend internal cron.
# Usage:
#   export INTERNAL_CRON_API_KEY='...'
#   export BACKEND_PUBLIC_ORIGIN='https://backend.xituan.com.au'   # optional
#   export AWS_REGION=ap-southeast-2                               # optional
#   bash setup-internal-cron-eventbridge.sh
set -euo pipefail

REGION="${AWS_REGION:-ap-southeast-2}"
ORIGIN="${BACKEND_PUBLIC_ORIGIN:-https://backend.xituan.com.au}"
CONN_NAME="xituan-internal-cron"
ROLE_NAME="xituan-eventbridge-api-destination"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"

if [[ -z "${INTERNAL_CRON_API_KEY:-}" ]]; then
  echo "INTERNAL_CRON_API_KEY is required" >&2
  exit 1
fi

echo "==> IAM role ${ROLE_NAME}"
if ! aws iam get-role --role-name "${ROLE_NAME}" >/dev/null 2>&1; then
  aws iam create-role \
    --role-name "${ROLE_NAME}" \
    --assume-role-policy-document '{
      "Version":"2012-10-17",
      "Statement":[{
        "Effect":"Allow",
        "Principal":{"Service":"events.amazonaws.com"},
        "Action":"sts:AssumeRole"
      }]
    }' >/dev/null
fi
aws iam put-role-policy \
  --role-name "${ROLE_NAME}" \
  --policy-name InvokeApiDestination \
  --policy-document "{
    \"Version\":\"2012-10-17\",
    \"Statement\":[{
      \"Effect\":\"Allow\",
      \"Action\":[\"events:InvokeApiDestination\"],
      \"Resource\":\"arn:aws:events:${REGION}:${ACCOUNT_ID}:api-destination/*\"
    }]
  }" >/dev/null
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

echo "==> Connection ${CONN_NAME}"
if aws events describe-connection --name "${CONN_NAME}" --region "${REGION}" >/dev/null 2>&1; then
  aws events update-connection \
    --name "${CONN_NAME}" \
    --authorization-type API_KEY \
    --auth-parameters "ApiKeyAuthParameters={ApiKeyName=x-cron-api-key,ApiKeyValue=${INTERNAL_CRON_API_KEY}}" \
    --region "${REGION}" >/dev/null
else
  aws events create-connection \
    --name "${CONN_NAME}" \
    --authorization-type API_KEY \
    --auth-parameters "ApiKeyAuthParameters={ApiKeyName=x-cron-api-key,ApiKeyValue=${INTERNAL_CRON_API_KEY}}" \
    --region "${REGION}" >/dev/null
fi

# Wait until connection is AUTHORIZED
for _ in $(seq 1 30); do
  STATE="$(aws events describe-connection --name "${CONN_NAME}" --region "${REGION}" --query ConnectionState --output text)"
  echo "    connection state: ${STATE}"
  if [[ "${STATE}" == "AUTHORIZED" || "${STATE}" == "DEAUTHORIZED" ]]; then
    # API_KEY connections often land AUTHORIZED quickly; DEAUTHORIZED still usable after update in some cases
    break
  fi
  sleep 2
done
CONN_ARN="$(aws events describe-connection --name "${CONN_NAME}" --region "${REGION}" --query ConnectionArn --output text)"

# jobName|scheduleExpression
JOBS=(
  "auspost-track-tick|rate(1 minute)"
  "metadata-search-outbox|rate(1 minute)"
  "inventory-expiry|rate(5 minutes)"
  "homepage-cache-sync|rate(15 minutes)"
  "openim-unread-email|rate(15 minutes)"
  "subscription-expiration|cron(0 16 * * ? *)"
)

for entry in "${JOBS[@]}"; do
  JOB="${entry%%|*}"
  SCHED="${entry#*|}"
  DEST_NAME="xituan-cron-${JOB}"
  RULE_NAME="xituan-cron-${JOB}"
  ENDPOINT="${ORIGIN}/api/internal/cron/${JOB}"

  echo "==> API Destination ${DEST_NAME}"
  if aws events describe-api-destination --name "${DEST_NAME}" --region "${REGION}" >/dev/null 2>&1; then
    aws events update-api-destination \
      --name "${DEST_NAME}" \
      --connection-arn "${CONN_ARN}" \
      --invocation-endpoint "${ENDPOINT}" \
      --http-method POST \
      --invocation-rate-limit-per-second 10 \
      --region "${REGION}" >/dev/null
  else
    aws events create-api-destination \
      --name "${DEST_NAME}" \
      --connection-arn "${CONN_ARN}" \
      --invocation-endpoint "${ENDPOINT}" \
      --http-method POST \
      --invocation-rate-limit-per-second 10 \
      --region "${REGION}" >/dev/null
  fi
  DEST_ARN="$(aws events describe-api-destination --name "${DEST_NAME}" --region "${REGION}" --query ApiDestinationArn --output text)"

  echo "==> Rule ${RULE_NAME} (${SCHED})"
  aws events put-rule \
    --name "${RULE_NAME}" \
    --schedule-expression "${SCHED}" \
    --state ENABLED \
    --description "Xituan internal cron: ${JOB}" \
    --region "${REGION}" >/dev/null

  aws events put-targets \
    --rule "${RULE_NAME}" \
    --region "${REGION}" \
    --targets "Id=1,Arn=${DEST_ARN},RoleArn=${ROLE_ARN},HttpParameters={HeaderParameters={Content-Type=application/json}}" >/dev/null
done

echo "OK: EventBridge internal cron wired to ${ORIGIN}"
aws events list-rules --name-prefix xituan-cron- --region "${REGION}" \
  --query "Rules[].{Name:Name,State:State,Schedule:ScheduleExpression}" --output table
