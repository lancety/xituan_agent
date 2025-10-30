#!/bin/bash

# Phase 2: Application - ECS Cluster, ECS Service, and optional DB migration
set -e

ENVIRONMENT=${1:-production}
PARAMETER_FILE="parameters.${ENVIRONMENT}.json"
AWS_REGION=$(jq -r '.[] | select(.ParameterKey=="AWSRegion") | .ParameterValue' "$PARAMETER_FILE")
PROJECT_NAME=$(jq -r '.[] | select(.ParameterKey=="ProjectName") | .ParameterValue' "$PARAMETER_FILE")

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log() { echo -e "${GREEN}[INFO]${NC} $1"; }
step() { echo -e "${BLUE}[STEP]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

get_output() {
  aws cloudformation describe-stacks --stack-name "$1" --region "$AWS_REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='$2'].OutputValue" --output text
}
get_param() { jq -r ".[] | select(.ParameterKey==\"$1\") | .ParameterValue" "$PARAMETER_FILE"; }

if [ ! -f "$PARAMETER_FILE" ]; then echo "Parameter file not found: $PARAMETER_FILE"; exit 1; fi

VPC_STACK="${PROJECT_NAME}-vpc-${ENVIRONMENT}"
ALB_STACK="${PROJECT_NAME}-alb-${ENVIRONMENT}"
SG_STACK="${PROJECT_NAME}-security-groups-${ENVIRONMENT}"
RDS_STACK="${PROJECT_NAME}-rds-${ENVIRONMENT}"

# Resolve outputs
ECS_SG=$(get_output "$SG_STACK" ECSSecurityGroupId)
PUB_SUBNET_A=$(get_output "$VPC_STACK" PublicSubnetId)
RDS_ENDPOINT=$(get_output "$RDS_STACK" RDSInstanceEndpoint)
RDS_PORT=$(get_output "$RDS_STACK" RDSInstancePort)
ECS_CLUSTER_STACK="${PROJECT_NAME}-ecs-cluster-${ENVIRONMENT}"
TARGET_GROUP_ARN=$(get_output "$ALB_STACK" BackendTargetGroupArn)

# 05 ECS Cluster
step "Deploying 05_ecs-cluster"
aws cloudformation deploy --template-file 05_ecs-cluster.yaml --stack-name "$ECS_CLUSTER_STACK" \
  --parameter-overrides Environment="$ENVIRONMENT" --region "$AWS_REGION" --capabilities CAPABILITY_IAM

ECS_CLUSTER_NAME=$(get_output "$ECS_CLUSTER_STACK" ECSClusterName)

# 06 ECS Services
step "Deploying 06_ecs-services"
aws cloudformation deploy --template-file 06_ecs-services.yaml --stack-name "${PROJECT_NAME}-ecs-services-${ENVIRONMENT}" \
  --parameter-overrides Environment="$ENVIRONMENT" ECSClusterName="$ECS_CLUSTER_NAME" ECSSecurityGroupId="$ECS_SG" \
  PublicSubnetId="$PUB_SUBNET_A" RDSInstanceEndpoint="$RDS_ENDPOINT" RDSInstancePort="$RDS_PORT" \
  DBUsername="$(get_param DBUsername)" DBPassword="$(get_param DBPassword)" BackendTargetGroupArn="$TARGET_GROUP_ARN" \
  CORSOrigin="$(get_param CORSOrigin)" LogLevel="$(get_param LogLevel)" SentryEnabled="$(get_param SentryEnabled)" \
  --region "$AWS_REGION" --capabilities CAPABILITY_IAM

log "ECS Service deployed"

# Optional: run migration via ECS Exec
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
