#!/usr/bin/env bash
# Attach custom domain aliases to the SIH images CloudFront distribution (us-east-1).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

SIH_REGION="${SIH_REGION:-us-east-1}"
SIH_STACK="${SIH_STACK:-xituan-demo-serverlessImageHandler}"
IMAGES_ACM_ARN="${IMAGES_ACM_ARN:-arn:aws:acm:us-east-1:594332420383:certificate/67d4bb81-8175-4e5d-ab42-7ead1714d2e5}"
IMAGES_ALIASES="${IMAGES_ALIASES:-images-demo.xituan.com.au}"

IMAGES_ENDPOINT="$(
  aws cloudformation describe-stacks \
    --region "${SIH_REGION}" \
    --stack-name "${SIH_STACK}" \
    --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" \
    --output text
)"

if [[ -z "${IMAGES_ENDPOINT}" || "${IMAGES_ENDPOINT}" == "None" ]]; then
  echo "Could not read ApiEndpoint from stack ${SIH_STACK} (${SIH_REGION})" >&2
  exit 1
fi

CF_DOMAIN="${IMAGES_ENDPOINT#https://}"
CF_DOMAIN="${CF_DOMAIN%%/*}"

DIST_ID="$(
  aws cloudfront list-distributions \
    --query "DistributionList.Items[?DomainName=='${CF_DOMAIN}'].Id | [0]" \
    --output text
)"

if [[ -z "${DIST_ID}" || "${DIST_ID}" == "None" ]]; then
  echo "No CloudFront distribution found for domain ${CF_DOMAIN}" >&2
  exit 1
fi

ETAG="$(aws cloudfront get-distribution-config --id "${DIST_ID}" --query ETag --output text)"
aws cloudfront get-distribution-config --id "${DIST_ID}" --query DistributionConfig --output json > cf-config.json

node -e "
const fs=require('fs');
const aliases='${IMAGES_ALIASES}'.split(',').filter(Boolean);
const cfg=JSON.parse(fs.readFileSync('cf-config.json','utf8'));
cfg.Aliases={Quantity:aliases.length,Items:aliases};
cfg.ViewerCertificate={
  ACMCertificateArn:'${IMAGES_ACM_ARN}',
  Certificate:'${IMAGES_ACM_ARN}',
  CertificateSource:'acm',
  CloudFrontDefaultCertificate:false,
  MinimumProtocolVersion:'TLSv1.2_2021',
  SSLSupportMethod:'sni-only'
};
fs.writeFileSync('cf-config-new.json', JSON.stringify(cfg));
"

aws cloudfront update-distribution \
  --id "${DIST_ID}" \
  --if-match "${ETAG}" \
  --distribution-config file://cf-config-new.json

echo "Updated CloudFront ${DIST_ID}: aliases=${IMAGES_ALIASES} -> ${CF_DOMAIN}"
