#!/bin/bash
# Build --parameter-overrides for 06_ecs-services.yaml from parameters.<env>.json
# Usage: build-ecs-cfn-overrides.sh <environment> [extra Key=Value ...]
set -euo pipefail

ENVIRONMENT="${1:?environment}"
shift || true
PARAMETER_FILE="parameters.${ENVIRONMENT}.json"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
AWS_SETUP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$AWS_SETUP_DIR"

if [ ! -f "$PARAMETER_FILE" ]; then
  echo "Missing $PARAMETER_FILE" >&2
  exit 1
fi

node -e "
const fs = require('fs');
const env = process.argv[1];
const extra = process.argv.slice(2);
const params = JSON.parse(fs.readFileSync('parameters.' + env + '.json', 'utf8'));
const cfnKeys = new Set([
  'Environment','ECSClusterName','ECSSecurityGroupId','PublicSubnetId',
  'RDSInstanceEndpoint','RDSInstancePort','BackendTargetGroupArn',
  'DBUsername','DBPassword','DBName','CORSOrigin','LogLevel','SentryEnabled',
  'EcrImageTag','DatabaseUrl','JwtSecret','S3Key','S3SecretKey','S3Bucket',
  'WechatAppId','WechatAppSecret','PaymentConfigEncryptionKey',
  'PaymentConfigEncryptionKeyPrevious','GoogleMapsApiKey',
  'StripeSecretKey','StripePublishableKey','StripeWebhookSecret',
  'StripeSubscriptionWebhookSecret','OmiMNumber','OmiKey',
  'MultilingualSortIcu','ZhHansSortIcuCollation',
  'OpenimApiInternalUrl','OpenimApiPublicUrl','OpenimWsPublicUrl',
  'OpenimSecret',
  'MailEnabled','MailFrom','MailReplyTo','PlatformNotifyEmails',
  'MerchantContactEmail','AwsSesRegion',
  'MinTaskCount','MaxTaskCount','TargetCPUUtilization','TargetMemoryUtilization'
]);
const skip = new Set(['SkipEcsServicesCfnDeploy','AWSRegion','AWSAccountId','ProjectName',
  'ACMCertificateArn','EnableRDSPublicAccess','DBInstanceClass','DBAllocatedStorage',
  'FargateCpu','FargateMemory','OpenimApiHostHeader','OpenimWsHostHeader',
  'OpenimInstanceType','OpenimKeyName','OpenimDataVolumeSizeGb']);
const map = new Map();
for (const p of params) {
  if (skip.has(p.ParameterKey) || !cfnKeys.has(p.ParameterKey)) continue;
  map.set(p.ParameterKey, p.ParameterValue ?? '');
}
for (const e of extra) {
  const i = e.indexOf('=');
  if (i > 0) map.set(e.slice(0, i), e.slice(i + 1));
}
const parts = [];
for (const [k, v] of map) {
  const escaped = String(v).replace(/\"/g, '\\\\\"');
  parts.push(k + '=\"' + escaped + '\"');
}
process.stdout.write(parts.join(' '));
" "$ENVIRONMENT" "$@"
