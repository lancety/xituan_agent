#!/bin/bash
# Deploy OpenIM stack (07_openim.yaml): EC2 + ALB im-api/im-ws listener rules.
# Prerequisites: ./deploy-phase1.sh (VPC, ALB with HTTPS + ACM, security groups).
set -e

# Windows Git Bash / AWS CLI: avoid GBK decode errors on UTF-8 templates
export PYTHONUTF8=1
export AWS_CLI_FILE_ENCODING=UTF-8

ENVIRONMENT=${1:-production}
PARAMETER_FILE="parameters.${ENVIRONMENT}.json"

if command -v jq &> /dev/null; then
  AWS_REGION=$(jq -r '.[] | select(.ParameterKey=="AWSRegion") | .ParameterValue' "$PARAMETER_FILE")
  PROJECT_NAME=$(jq -r '.[] | select(.ParameterKey=="ProjectName") | .ParameterValue' "$PARAMETER_FILE")
else
  AWS_REGION=$(node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync('$PARAMETER_FILE','utf8'));console.log(d.find(p=>p.ParameterKey==='AWSRegion')?.ParameterValue||'')")
  PROJECT_NAME=$(node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync('$PARAMETER_FILE','utf8'));console.log(d.find(p=>p.ParameterKey==='ProjectName')?.ParameterValue||'')")
fi

get_param() {
  local key="$1"
  if command -v jq &> /dev/null; then
    jq -r ".[] | select(.ParameterKey==\"$key\") | .ParameterValue" "$PARAMETER_FILE"
  else
    node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync('$PARAMETER_FILE','utf8'));const p=d.find(x=>x.ParameterKey==='$key');console.log(p?p.ParameterValue:'')"
  fi
}

# Avoid empty --parameter-overrides wiping CFN defaults when parameters JSON lacks new keys.
resolve_openim_host_alias() {
  local param_key="$1"
  local fallback="$2"
  local value
  value="$(get_param "$param_key")"
  if [ -n "$value" ] && [ "$value" != "null" ]; then
    echo "$value"
    return
  fi
  echo "$fallback"
}

resolve_openim_api_host_alias() {
  case "$ENVIRONMENT" in
    staging) resolve_openim_host_alias OpenimApiHostHeaderAlias "im-api-staging.xituan.com.au" ;;
    demo) resolve_openim_host_alias OpenimApiHostHeaderAlias "im-api-demo.xituan.com.au" ;;
    *) resolve_openim_host_alias OpenimApiHostHeaderAlias "im-api.xituan.com.au" ;;
  esac
}

resolve_openim_ws_host_alias() {
  case "$ENVIRONMENT" in
    staging) resolve_openim_host_alias OpenimWsHostHeaderAlias "im-ws-staging.xituan.com.au" ;;
    demo) resolve_openim_host_alias OpenimWsHostHeaderAlias "im-ws-demo.xituan.com.au" ;;
    *) resolve_openim_host_alias OpenimWsHostHeaderAlias "im-ws.xituan.com.au" ;;
  esac
}

get_output() {
  aws cloudformation describe-stacks --stack-name "$1" --region "$AWS_REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='$2'].OutputValue" --output text
}

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log() { echo -e "${GREEN}[INFO]${NC} $1"; }
step() { echo -e "${BLUE}[STEP]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

if [ ! -f "$PARAMETER_FILE" ]; then
  echo "Parameter file not found: $PARAMETER_FILE"
  exit 1
fi

VPC_STACK="${PROJECT_NAME}-vpc-${ENVIRONMENT}"
ALB_STACK="${PROJECT_NAME}-alb-${ENVIRONMENT}"
SG_STACK="${PROJECT_NAME}-security-groups-${ENVIRONMENT}"
OPENIM_STACK="${PROJECT_NAME}-openim-${ENVIRONMENT}"

VPC_ID=$(get_output "$VPC_STACK" VPCId)
PUB_SUBNET_A=$(get_output "$VPC_STACK" PublicSubnetId)
ALB_SG=$(get_output "$ALB_STACK" ALBSecurityGroupId)
ECS_SG=$(get_output "$SG_STACK" ECSSecurityGroupId)
ALB_DNS=$(get_output "$ALB_STACK" ALBDNSName)

# Same value as GitHub Actions secret OPENIM_SECRET (xituan_backend or xituan_agent repo). Not stored in parameters JSON.
if [ -z "${OPENIM_SECRET:-}" ] || [ "$OPENIM_SECRET" = "null" ]; then
  warn "Export OPENIM_SECRET before running (e.g. from GitHub Actions secret OPENIM_SECRET)."
  warn "Local: OPENIM_SECRET='...' ./deploy-openim.sh $ENVIRONMENT"
  warn "Do not use openIM123 in production."
  exit 1
fi

step "Update ALB (idle timeout 300s + HTTPSListenerArn output)"
aws cloudformation deploy --template-file 02_alb.yaml --stack-name "$ALB_STACK" \
  --parameter-overrides Environment="$ENVIRONMENT" VPCId="$VPC_ID" PublicSubnetId="$PUB_SUBNET_A" \
  PublicSubnet2Id="$(get_output "$VPC_STACK" PublicSubnet2Id)" \
  ACMCertificateArn="$(get_param ACMCertificateArn)" --region "$AWS_REGION" --no-fail-on-empty-changeset

HTTPS_LISTENER_ARN=$(get_output "$ALB_STACK" HTTPSListenerArn)
if [ -z "$HTTPS_LISTENER_ARN" ] || [ "$HTTPS_LISTENER_ARN" = "None" ]; then
  ALB_ARN=$(get_output "$ALB_STACK" ALBArn)
  HTTPS_LISTENER_ARN=$(aws elbv2 describe-listeners --load-balancer-arn "$ALB_ARN" --region "$AWS_REGION" \
    --query "Listeners[?Port==\`443\`].ListenerArn | [0]" --output text)
fi
if [ -z "$HTTPS_LISTENER_ARN" ] || [ "$HTTPS_LISTENER_ARN" = "None" ]; then
  warn "No HTTPS:443 listener on ALB. Set ACMCertificateArn in $PARAMETER_FILE and redeploy ALB."
  exit 1
fi
log "HTTPS listener: $HTTPS_LISTENER_ARN"

step "Deploy 07_openim (EC2 + listener rules)"
aws cloudformation deploy --template-file 07_openim.yaml --stack-name "$OPENIM_STACK" \
  --parameter-overrides \
    Environment="$ENVIRONMENT" \
    VPCId="$VPC_ID" \
    PublicSubnetId="$PUB_SUBNET_A" \
    ALBSecurityGroupId="$ALB_SG" \
    ECSSecurityGroupId="$ECS_SG" \
    HTTPSListenerArn="$HTTPS_LISTENER_ARN" \
    OpenimApiHostHeader="$(get_param OpenimApiHostHeader)" \
    OpenimApiHostHeaderAlias="$(resolve_openim_api_host_alias)" \
    OpenimWsHostHeader="$(get_param OpenimWsHostHeader)" \
    OpenimWsHostHeaderAlias="$(resolve_openim_ws_host_alias)" \
    InstanceType="$(get_param OpenimInstanceType)" \
    KeyName="$(get_param OpenimKeyName 2>/dev/null || echo '')" \
    OpenimSecret="$OPENIM_SECRET" \
    DataVolumeSizeGb="$(get_param OpenimDataVolumeSizeGb 2>/dev/null || echo '80')" \
  --region "$AWS_REGION" --capabilities CAPABILITY_IAM

OPENIM_IP=$(get_output "$OPENIM_STACK" OpenimPrivateIp)
OPENIM_INSTANCE=$(get_output "$OPENIM_STACK" OpenimInstanceId)

echo ""
echo "=== OpenIM stack deployed ==="
log "EC2 instance: $OPENIM_INSTANCE (private IP $OPENIM_IP)"
log "ALB DNS (for Route53 alias): $ALB_DNS"
warn "Wait 3–5 minutes for docker compose on EC2, then verify:"
echo "  curl -s -X POST https://$(get_param OpenimApiHostHeader)/auth/get_admin_token \\"
echo "    -H 'Content-Type: application/json' -H 'operationID: ping' \\"
echo "    -d '{\"secret\":\"<OPENIM_SECRET>\",\"userID\":\"imAdmin\",\"platformID\":2}'"
warn "DNS: Route53 im-api/im-ws.*.xituan.com.au → ALB; lancety CNAME as planned."
warn "ECS: GitHub secret OPENIM_* + push production, or OPENIM_SECRET=... ./patch-ecs-openim-env.sh $ENVIRONMENT"
