#!/bin/bash

# Phase 1: Foundation - ECR, VPC, ALB, Security Groups, RDS
set -e

ENVIRONMENT=${1:-production}
PARAMETER_FILE="parameters.${ENVIRONMENT}.json"

# Use Node.js to parse JSON if jq is not available
if command -v jq &> /dev/null; then
  AWS_REGION=$(jq -r '.[] | select(.ParameterKey=="AWSRegion") | .ParameterValue' "$PARAMETER_FILE")
  PROJECT_NAME=$(jq -r '.[] | select(.ParameterKey=="ProjectName") | .ParameterValue' "$PARAMETER_FILE")
else
  # Fallback to Node.js
  AWS_REGION=$(node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync('$PARAMETER_FILE','utf8'));console.log(d.find(p=>p.ParameterKey==='AWSRegion')?.ParameterValue||'')")
  PROJECT_NAME=$(node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync('$PARAMETER_FILE','utf8'));console.log(d.find(p=>p.ParameterKey==='ProjectName')?.ParameterValue||'')")
fi

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log() { echo -e "${GREEN}[INFO]${NC} $1"; }
step() { echo -e "${BLUE}[STEP]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

get_output() {
  aws cloudformation describe-stacks --stack-name "$1" --region "$AWS_REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='$2'].OutputValue" --output text
}

# Get parameter value from JSON file (supports both jq and Node.js)
get_param() {
  local key="$1"
  if command -v jq &> /dev/null; then
    jq -r ".[] | select(.ParameterKey==\"$key\") | .ParameterValue" "$PARAMETER_FILE"
  else
    node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync('$PARAMETER_FILE','utf8'));const p=d.find(x=>x.ParameterKey==='$key');console.log(p?p.ParameterValue:'')"
  fi
}

if [ ! -f "$PARAMETER_FILE" ]; then echo "Parameter file not found: $PARAMETER_FILE"; exit 1; fi

# 00 ECR
step "00/04 Deploy ECR"
aws cloudformation deploy --template-file 00_ecr.yaml --stack-name "${PROJECT_NAME}-ecr-${ENVIRONMENT}" \
  --parameter-overrides Environment="$ENVIRONMENT" --region "$AWS_REGION"

# 01 VPC
step "01/04 Deploy VPC"
aws cloudformation deploy --template-file 01_vpc.yaml --stack-name "${PROJECT_NAME}-vpc-${ENVIRONMENT}" \
  --parameter-overrides Environment="$ENVIRONMENT" --region "$AWS_REGION" --capabilities CAPABILITY_IAM
VPC_ID=$(get_output "${PROJECT_NAME}-vpc-${ENVIRONMENT}" VPCId)
PUB_SUBNET_A=$(get_output "${PROJECT_NAME}-vpc-${ENVIRONMENT}" PublicSubnetId)
PUB_SUBNET_B=$(get_output "${PROJECT_NAME}-vpc-${ENVIRONMENT}" PublicSubnet2Id)

# 02 ALB
step "02/04 Deploy ALB"
aws cloudformation deploy --template-file 02_alb.yaml --stack-name "${PROJECT_NAME}-alb-${ENVIRONMENT}" \
  --parameter-overrides Environment="$ENVIRONMENT" VPCId="$VPC_ID" PublicSubnetId="$PUB_SUBNET_A" PublicSubnet2Id="$PUB_SUBNET_B" \
  ACMCertificateArn="$(get_param ACMCertificateArn)" --region "$AWS_REGION"
ALB_SG=$(get_output "${PROJECT_NAME}-alb-${ENVIRONMENT}" ALBSecurityGroupId)
ALB_DNS=$(get_output "${PROJECT_NAME}-alb-${ENVIRONMENT}" ALBDNSName)
TG_ARN=$(get_output "${PROJECT_NAME}-alb-${ENVIRONMENT}" BackendTargetGroupArn)

# 03 Security Groups
step "03/04 Deploy Security Groups"
aws cloudformation deploy --template-file 03_security-groups.yaml --stack-name "${PROJECT_NAME}-security-groups-${ENVIRONMENT}" \
  --parameter-overrides Environment="$ENVIRONMENT" VPCId="$VPC_ID" ALBSecurityGroupId="$ALB_SG" \
  --region "$AWS_REGION" --capabilities CAPABILITY_IAM
ECS_SG=$(get_output "${PROJECT_NAME}-security-groups-${ENVIRONMENT}" ECSSecurityGroupId)
RDS_SG=$(get_output "${PROJECT_NAME}-security-groups-${ENVIRONMENT}" RDSSecurityGroupId)

# 04 RDS
step "04/04 Deploy RDS"
aws cloudformation deploy --template-file 04_rds.yaml --stack-name "${PROJECT_NAME}-rds-${ENVIRONMENT}" \
  --parameter-overrides Environment="$ENVIRONMENT" VPCId="$VPC_ID" PublicSubnetId="$PUB_SUBNET_A" PublicSubnet2Id="$PUB_SUBNET_B" \
  RDSSecurityGroupId="$RDS_SG" DBPassword="$(get_param DBPassword)" DBUsername="$(get_param DBUsername)" \
  DBInstanceClass="$(get_param DBInstanceClass)" DBAllocatedStorage="$(get_param DBAllocatedStorage)" \
  EnablePublicAccess="$(get_param EnableRDSPublicAccess)" --region "$AWS_REGION" --capabilities CAPABILITY_IAM
RDS_ENDPOINT=$(get_output "${PROJECT_NAME}-rds-${ENVIRONMENT}" RDSInstanceEndpoint)
RDS_PORT=$(get_output "${PROJECT_NAME}-rds-${ENVIRONMENT}" RDSInstancePort)

# Summary and manual next steps
echo ""
echo "=== Phase 1 Complete ==="
log "ALB DNS: $ALB_DNS"
log "RDS Endpoint: $RDS_ENDPOINT:$RDS_PORT"
if [ "$(get_param EnableRDSPublicAccess)" = "true" ]; then
  warn "⚠️  RDS 公网访问已开启，请确保在 RDS 安全组入站规则中添加本地 IP（端口 5432）"
  warn "   否则无法从本地连接数据库。详细步骤请参考 aws-deployment-ai-auto.md"
fi
warn "Next:"
echo "1) 在 GitHub Secrets 设置 DB_HOST=$RDS_ENDPOINT, DB_PORT=$RDS_PORT, DB_USER, DB_PASSWORD"
echo "2) 推送代码到 production 分支，触发 GitHub Actions 构建镜像并推送到 ECR"
echo "3) 运行 ./deploy-phase2.sh $ENVIRONMENT 部署 ECS 与服务，并自动运行迁移（可选）"





