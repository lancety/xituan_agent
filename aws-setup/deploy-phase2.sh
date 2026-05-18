#!/bin/bash

# Phase 2: Application - ECS Cluster, ECS Service, and optional DB migration
set -e

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

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log() { echo -e "${GREEN}[INFO]${NC} $1"; }
step() { echo -e "${BLUE}[STEP]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

get_output() {
  aws cloudformation describe-stacks --stack-name "$1" --region "$AWS_REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='$2'].OutputValue" --output text
}

get_param() {
  local key="$1"
  if command -v jq &> /dev/null; then
    jq -r ".[] | select(.ParameterKey==\"$key\") | .ParameterValue" "$PARAMETER_FILE"
  else
    node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync('$PARAMETER_FILE','utf8'));const p=d.find(x=>x.ParameterKey==='$key');console.log(p?p.ParameterValue:'')"
  fi
}

get_param_with_default() {
  local value
  value=$(get_param "$1" 2>/dev/null || true)
  echo "${value:-$2}"
}

if [ ! -f "$PARAMETER_FILE" ]; then echo "Parameter file not found: $PARAMETER_FILE"; exit 1; fi

VPC_STACK="${PROJECT_NAME}-vpc-${ENVIRONMENT}"
ALB_STACK="${PROJECT_NAME}-alb-${ENVIRONMENT}"
SG_STACK="${PROJECT_NAME}-security-groups-${ENVIRONMENT}"
RDS_STACK="${PROJECT_NAME}-rds-${ENVIRONMENT}"
ECS_CLUSTER_STACK="${PROJECT_NAME}-ecs-cluster-${ENVIRONMENT}"
ECS_SERVICES_STACK="${PROJECT_NAME}-ecs-services-${ENVIRONMENT}"

ECS_SG=$(get_output "$SG_STACK" ECSSecurityGroupId)
PUB_SUBNET_A=$(get_output "$VPC_STACK" PublicSubnetId)
RDS_ENDPOINT=$(get_output "$RDS_STACK" RDSInstanceEndpoint)
RDS_PORT=$(get_output "$RDS_STACK" RDSInstancePort)
TARGET_GROUP_ARN=$(get_output "$ALB_STACK" BackendTargetGroupArn)

step "Deploying 05_ecs-cluster"
aws cloudformation deploy --template-file 05_ecs-cluster.yaml --stack-name "$ECS_CLUSTER_STACK" \
  --parameter-overrides Environment="$ENVIRONMENT" --region "$AWS_REGION" --capabilities CAPABILITY_IAM

ECS_CLUSTER_NAME=$(get_output "$ECS_CLUSTER_STACK" ECSClusterName)

SKIP_ECS_CFN=$(get_param_with_default SkipEcsServicesCfnDeploy "false")
if [ "$SKIP_ECS_CFN" = "true" ] || [ "$SKIP_ECS_CFN" = "True" ]; then
  warn "SkipEcsServicesCfnDeploy=true — not updating $ECS_SERVICES_STACK."
  warn "Production: use xituan_backend GitHub Actions deploy.yml for ECS task env + image."
  log "=== Phase 2 Complete (ECS cluster only) ==="
  exit 0
fi

if [ "$ENVIRONMENT" = "staging" ]; then
  for required in JwtSecret DatabaseUrl S3Key S3SecretKey S3Bucket; do
    val=$(get_param "$required" 2>/dev/null || true)
    if [ -z "$val" ]; then
      echo "staging requires $required in $PARAMETER_FILE (copy from parameters.staging.example.json)"
      exit 1
    fi
  done
fi

step "Deploying 06_ecs-services (full task env from $PARAMETER_FILE)"
chmod +x scripts/build-ecs-cfn-overrides.sh
CFN_OVERRIDES=$(bash scripts/build-ecs-cfn-overrides.sh "$ENVIRONMENT" \
  "ECSClusterName=$ECS_CLUSTER_NAME" \
  "ECSSecurityGroupId=$ECS_SG" \
  "PublicSubnetId=$PUB_SUBNET_A" \
  "RDSInstanceEndpoint=$RDS_ENDPOINT" \
  "RDSInstancePort=$RDS_PORT" \
  "BackendTargetGroupArn=$TARGET_GROUP_ARN" \
  "Environment=$ENVIRONMENT")

# shellcheck disable=SC2086
aws cloudformation deploy --template-file 06_ecs-services.yaml --stack-name "$ECS_SERVICES_STACK" \
  --parameter-overrides $CFN_OVERRIDES \
  --region "$AWS_REGION" --capabilities CAPABILITY_IAM

log "ECS Service deployed via CloudFormation"

if [ "$2" = "--migrate" ]; then
  step "Running migrations via ECS Exec"
  TASK_ARN=$(aws ecs list-tasks --cluster "$ECS_CLUSTER_NAME" --service-name "xituan-backend-service-${ENVIRONMENT}" --region "$AWS_REGION" --query 'taskArns[0]' --output text)
  if [ "$TASK_ARN" = "None" ] || [ -z "$TASK_ARN" ]; then
    warn "No running task found to exec into. Skipping migration."
  else
    aws ecs execute-command --cluster "$ECS_CLUSTER_NAME" --task "$TASK_ARN" --container backend \
      --region "$AWS_REGION" --interactive --command "npm run migrate:prod"
  fi
fi

log "=== Phase 2 Complete ==="
