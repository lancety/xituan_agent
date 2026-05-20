#!/bin/bash
# Add or update OPENIM_* on the current ECS task definition without CloudFormation.
# CFN template 06_ecs-services.yaml omits JWT/Stripe/S3 secrets that production uses on :136+;
# never run deploy-phase2.sh against production until that template is aligned.
set -e

export PYTHONUTF8=1
export AWS_CLI_FILE_ENCODING=UTF-8

ENVIRONMENT=${1:-production}
PARAMETER_FILE="parameters.${ENVIRONMENT}.json"
SERVICE_NAME="xituan-backend-service-${ENVIRONMENT}"
TASK_FAMILY="xituan-backend-${ENVIRONMENT}"
OPENIM_STACK="xituan-openim-${ENVIRONMENT}"

if [ ! -f "$PARAMETER_FILE" ]; then
  echo "Parameter file not found: $PARAMETER_FILE"
  exit 1
fi

get_param() {
  local key="$1"
  if command -v jq &> /dev/null; then
    jq -r ".[] | select(.ParameterKey==\"$key\") | .ParameterValue" "$PARAMETER_FILE"
  else
    node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync('$PARAMETER_FILE','utf8'));const p=d.find(x=>x.ParameterKey==='$key');console.log(p?p.ParameterValue:'')"
  fi
}

AWS_REGION=$(get_param AWSRegion)
ECS_CLUSTER=$(get_param ProjectName)
ECS_CLUSTER="${ECS_CLUSTER}-cluster-${ENVIRONMENT}"

OPENIM_INTERNAL="$(get_param OpenimApiInternalUrl 2>/dev/null || true)"
if [ -z "$OPENIM_INTERNAL" ]; then
  OPENIM_IP=$(aws cloudformation describe-stacks --stack-name "$OPENIM_STACK" --region "$AWS_REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='OpenimPrivateIp'].OutputValue" --output text 2>/dev/null || true)
  if [ -n "$OPENIM_IP" ] && [ "$OPENIM_IP" != "None" ]; then
    OPENIM_INTERNAL="http://${OPENIM_IP}:10002"
  else
    OPENIM_INTERNAL="$(get_param OpenimApiPublicUrl)"
  fi
fi

OPENIM_WS="$(get_param OpenimWsPublicUrl)"

if [ -z "${OPENIM_SECRET:-}" ]; then
  echo "Set OPENIM_SECRET env (same GitHub Actions secret as xituan_backend deploy.yml)"
  exit 1
fi

CURRENT_ARN=$(aws ecs describe-services --cluster "$ECS_CLUSTER" --services "$SERVICE_NAME" --region "$AWS_REGION" \
  --query 'services[0].taskDefinition' --output text)
echo "Base task definition: $CURRENT_ARN"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TMP_JSON="${SCRIPT_DIR}/.patch-ecs-td-$$.json"
trap 'rm -f "$TMP_JSON"' EXIT

aws ecs describe-task-definition --task-definition "$CURRENT_ARN" --region "$AWS_REGION" \
  --query 'taskDefinition' --output json > "$TMP_JSON"

node -e "
const fs = require('fs');
const td = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
const upsert = {
  OPENIM_API_BASE_URL: process.argv[2],
  OPENIM_API_PUBLIC_URL: process.argv[3],
  OPENIM_WS_PUBLIC_URL: process.argv[4],
  OPENIM_SECRET: process.argv[5]
};
const env = (td.containerDefinitions[0].environment || []).filter(
  (e) => e.name !== 'OPENIM_CHAT_FILES_CDN_BASE'
);
for (const [name, value] of Object.entries(upsert)) {
  const i = env.findIndex((e) => e.name === name);
  if (i >= 0) env[i].value = value;
  else env.push({ name, value });
}
td.containerDefinitions[0].environment = env;
for (const k of ['taskDefinitionArn','revision','status','requiresAttributes','compatibilities','registeredAt','registeredBy','deregisteredAt']) {
  delete td[k];
}
fs.writeFileSync(process.argv[1], JSON.stringify(td));
" "$TMP_JSON" "$OPENIM_INTERNAL" "$(get_param OpenimApiPublicUrl)" "$OPENIM_WS" "$OPENIM_SECRET"

# AWS CLI on Windows needs file://D:/... not file:///d/...
if command -v pwd >/dev/null 2>&1 && pwd -W >/dev/null 2>&1; then
  WIN_DIR=$(cd "$SCRIPT_DIR" && pwd -W | sed 's|\\|/|g')
  TMP_JSON_AWS="${WIN_DIR}/$(basename "$TMP_JSON")"
else
  TMP_JSON_AWS="${TMP_JSON//\\//}"
fi
NEW_ARN=$(aws ecs register-task-definition --cli-input-json "file://${TMP_JSON_AWS}" --region "$AWS_REGION" \
  --query 'taskDefinition.taskDefinitionArn' --output text)

echo "Registered: $NEW_ARN"
aws ecs update-service --cluster "$ECS_CLUSTER" --service "$SERVICE_NAME" --task-definition "$NEW_ARN" \
  --region "$AWS_REGION" --query 'service.deployments[0].{status:status,taskDef:taskDefinition}' --output json

echo "OPENIM_API_BASE_URL=$OPENIM_INTERNAL (ECS -> OpenIM; clients use $(get_param OpenimApiPublicUrl))"
