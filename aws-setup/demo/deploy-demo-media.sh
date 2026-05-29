#!/usr/bin/env bash
# Deploy demo media: S3 + content CloudFront (ap-southeast-2), SIH v7 (us-east-1),
# images CDN alias, Lambda env, Route53 (xituan.com.au).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MEDIA_STACK="${MEDIA_STACK:-xituan-demo-media}"
SIH_STACK="${SIH_STACK:-xituan-demo-serverlessImageHandler}"
MEDIA_REGION="${MEDIA_REGION:-ap-southeast-2}"
SIH_REGION="${SIH_REGION:-us-east-1}"
ROUTE53_ZONE_ID="${ROUTE53_ZONE_ID:-Z04957681Q52HNHG6LXQT}"
IMAGES_ACM_ARN="${IMAGES_ACM_ARN:-arn:aws:acm:us-east-1:594332420383:certificate/67d4bb81-8175-4e5d-ab42-7ead1714d2e5}"
IMAGES_ALIAS="${IMAGES_ALIAS:-images-demo.xituan.com.au}"
CONTENT_ALIAS="${CONTENT_ALIAS:-content-demo.xituan.com.au}"
SIZE_OPTS="${SIZE_OPTS:-64,100,128,200,256,300,512,600,900,1024}"
SIH_CFN_S3_BUCKET="${SIH_CFN_S3_BUCKET:-cf-templates-nzjxqc7djlsk-us-east-1}"

log() { echo "[deploy-demo-media] $*"; }

json_params_to_overrides() {
  node -e "const p=require(process.argv[1]); process.stdout.write(p.map(x=>x.ParameterKey+'='+x.ParameterValue).join(' '));" "$1"
}

ensure_sih_template() {
  local template="${SCRIPT_DIR}/demo-sih-v7.template.json"
  if [[ ! -f "${template}" ]]; then
    log "Exporting SIH v7 template from ${DEV_SIH_STACK} ..."
    aws cloudformation get-template \
      --region "${SIH_REGION}" \
      --stack-name "${DEV_SIH_STACK}" \
      --query 'TemplateBody' \
      --output json > "${template}"
  fi
  echo "${template}"
}

upsert_route53_cname() {
  local name="$1"
  local target="$2"
  local batch="${SCRIPT_DIR}/.route53-batch.$$.json"
  cat > "${batch}" <<EOF
{
  "Comment": "Demo media CDN",
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "${name}",
      "Type": "CNAME",
      "TTL": 300,
      "ResourceRecords": [{ "Value": "${target}" }]
    }
  }]
}
EOF
  aws route53 change-resource-record-sets \
    --hosted-zone-id "${ROUTE53_ZONE_ID}" \
    --change-batch "file://${batch}"
  rm -f "${batch}"
  log "Route53 UPSERT ${name} -> ${target}"
}

patch_demo_lambda_env() {
  local fn
  fn="$(
    aws lambda list-functions --region "${SIH_REGION}" \
      --query "Functions[?contains(FunctionName, 'xituan-demo-serverlessI') && contains(FunctionName, 'BackEndImageHandlerLambd')].FunctionName | [0]" \
      --output text
  )"
  if [[ -z "${fn}" || "${fn}" == "None" ]]; then
    echo "Could not find demo ImageHandler Lambda under ${SIH_STACK}" >&2
    exit 1
  fi

  log "Patching Lambda env on ${fn} ..."
  local env_file="${SCRIPT_DIR}/.lambda-env.$$.json"
  cat > "${env_file}" <<'EOF'
{
  "Environment": {
    "Variables": {
      "SOURCE_BUCKETS": "xituan-demo",
      "AUTO_WEBP": "Yes",
      "CORS_ENABLED": "Yes",
      "CORS_ORIGIN": "*",
      "ENABLE_SIGNATURE": "No",
      "ENABLE_DEFAULT_FALLBACK_IMAGE": "No",
      "ENABLE_S3_OBJECT_LAMBDA": "No",
      "SIZE_OPTS": "64,100,128,200,256,300,512,600,900,1024",
      "SHARP_SIZE_LIMIT": "",
      "REWRITE_MATCH_PATTERN": "",
      "REWRITE_SUBSTITUTION": "",
      "SECRETS_MANAGER": "",
      "SECRET_KEY": "",
      "DEFAULT_FALLBACK_IMAGE_BUCKET": "",
      "DEFAULT_FALLBACK_IMAGE_KEY": "",
      "SOLUTION_ID": "SO0023",
      "SOLUTION_VERSION": "v7.0.5"
    }
  }
}
EOF
  aws lambda update-function-configuration \
    --region "${SIH_REGION}" \
    --function-name "${fn}" \
    --cli-input-json "file://${env_file}" \
    --output text --query 'FunctionName' >/dev/null
  rm -f "${env_file}"
  log "Lambda env updated (SIZE_OPTS=${SIZE_OPTS})"
}

# --- 1. S3 + content CloudFront ---
PARAMS_FILE="${PARAMS_FILE:-${SCRIPT_DIR}/parameters.demo-media.json}"
[[ -f "${PARAMS_FILE}" ]] || PARAMS_FILE="${SCRIPT_DIR}/parameters.demo-media.example.json"

if grep -q 'REPLACE_ME' "${PARAMS_FILE}" 2>/dev/null; then
  echo "Fill ContentAcmCertificateArn in ${PARAMS_FILE}" >&2
  exit 1
fi

log "Step 1/5: ${MEDIA_STACK} in ${MEDIA_REGION}"
MEDIA_OVERRIDES="$(json_params_to_overrides "${PARAMS_FILE}")"
# shellcheck disable=SC2086
aws cloudformation deploy \
  --region "${MEDIA_REGION}" \
  --stack-name "${MEDIA_STACK}" \
  --template-file "${SCRIPT_DIR}/demo-media-stack.yaml" \
  --parameter-overrides ${MEDIA_OVERRIDES} \
  --capabilities CAPABILITY_IAM \
  --no-fail-on-empty-changeset

CONTENT_CF_DOMAIN="$(
  aws cloudformation describe-stacks \
    --region "${MEDIA_REGION}" \
    --stack-name "${MEDIA_STACK}" \
    --query "Stacks[0].Outputs[?OutputKey=='ContentDistributionDomainName'].OutputValue" \
    --output text
)"

# --- 2. SIH v7 (same template as dev) ---
SIH_TEMPLATE="$(ensure_sih_template)"
log "Step 2/5: ${SIH_STACK} in ${SIH_REGION}"
SIH_OVERRIDES="$(json_params_to_overrides "${SCRIPT_DIR}/parameters.demo-sih.json")"
# shellcheck disable=SC2086
aws cloudformation deploy \
  --region "${SIH_REGION}" \
  --stack-name "${SIH_STACK}" \
  --template-file "${SIH_TEMPLATE}" \
  --s3-bucket "${SIH_CFN_S3_BUCKET}" \
  --parameter-overrides ${SIH_OVERRIDES} \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND \
  --no-fail-on-empty-changeset

IMAGES_ENDPOINT="$(
  aws cloudformation describe-stacks \
    --region "${SIH_REGION}" \
    --stack-name "${SIH_STACK}" \
    --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" \
    --output text
)"
IMAGES_CF_DOMAIN="${IMAGES_ENDPOINT#https://}"
IMAGES_CF_DOMAIN="${IMAGES_CF_DOMAIN%%/*}"

# --- 3. Images CloudFront custom domain ---
log "Step 3/5: attach ${IMAGES_ALIAS} to SIH CloudFront"
IMAGES_ACM_ARN="${IMAGES_ACM_ARN}" \
  IMAGES_ALIASES="${IMAGES_ALIAS}" \
  SIH_STACK="${SIH_STACK}" \
  SIH_REGION="${SIH_REGION}" \
  "${SCRIPT_DIR}/configure-demo-images-cdn.sh"

# --- 4. Lambda SIZE_OPTS + SOURCE_BUCKETS ---
log "Step 4/5: patch ImageHandler Lambda env"
patch_demo_lambda_env

# --- 5. Route53 xituan.com.au ---
log "Step 5/5: Route53 CNAME records"
upsert_route53_cname "${CONTENT_ALIAS}" "${CONTENT_CF_DOMAIN}"
upsert_route53_cname "${IMAGES_ALIAS}" "${IMAGES_CF_DOMAIN}"

echo ""
aws cloudformation describe-stacks \
  --region "${MEDIA_REGION}" \
  --stack-name "${MEDIA_STACK}" \
  --query 'Stacks[0].Outputs' \
  --output table

echo ""
log "Done."
log "  content: https://${CONTENT_ALIAS}/"
log "  images:  https://${IMAGES_ALIAS}/"
log "  S3 bucket: xituan-demo (${MEDIA_REGION})"
log "  SIH stack: ${SIH_STACK} (${SIH_REGION})"
log "  lancety.com DNS: configure manually if needed"
