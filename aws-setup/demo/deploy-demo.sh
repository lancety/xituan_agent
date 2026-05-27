#!/usr/bin/env bash
# Deploy demo EC2 stack (CloudFormation only — does not configure Caddy, app, or DNS).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STACK_NAME="${STACK_NAME:-xituan-demo-ec2}"
TEMPLATE="${SCRIPT_DIR}/demo-ec2-stack.yaml"
PARAMS_FILE="${PARAMS_FILE:-${SCRIPT_DIR}/parameters.demo.example.json}"

if [[ ! -f "${PARAMS_FILE}" ]]; then
  echo "Missing parameters file: ${PARAMS_FILE}" >&2
  echo "Copy parameters.demo.example.json and fill VpcId, SubnetId, KeyName, AdminCidr." >&2
  exit 1
fi

aws cloudformation deploy \
  --stack-name "${STACK_NAME}" \
  --template-file "${TEMPLATE}" \
  --parameters "file://${PARAMS_FILE}" \
  --capabilities CAPABILITY_IAM \
  --no-fail-on-empty-changeset

aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --query 'Stacks[0].Outputs' \
  --output table
