#!/bin/bash
# Production OpenIM EC2: point beforeOfflinePush at xituan backend SNS/FCM.
# Requires the same OPENIM_CALLBACK_PATH_TOKEN as GitHub Environment production
# (injected into ECS by xituan_backend/.github/workflows/deploy.yml).
#
# Example (SSM session on OpenIM instance):
#   export OPENIM_CALLBACK_PATH_TOKEN='...'
#   export BACKEND_PUBLIC_ORIGIN='https://backend.xituan.com.au'
#   bash openim-ec2-enable-offline-push-webhook.sh
set -euo pipefail

OPENIM_DIR="${OPENIM_DIR:-/opt/openim}"
COMPOSE_DIR="${OPENIM_DIR}/upstream"
ENV_FILE="${OPENIM_DIR}/.env"
CONFIG_DIR="${OPENIM_DIR}/config"
WEBHOOKS_DST="${CONFIG_DIR}/webhooks.yml"
COMPOSE_WEBHOOKS_DST="${COMPOSE_DIR}/docker-compose.webhooks.yaml"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE="${SCRIPT_DIR}/openim-webhooks.yml.template"
COMPOSE_SRC="${SCRIPT_DIR}/docker-compose.webhooks.yaml"

TOKEN="${OPENIM_CALLBACK_PATH_TOKEN:-}"
ORIGIN="${BACKEND_PUBLIC_ORIGIN:-https://backend.xituan.com.au}"
ORIGIN="${ORIGIN%/}"

if [[ -z "$TOKEN" ]]; then
  echo "OPENIM_CALLBACK_PATH_TOKEN is required" >&2
  exit 1
fi
if [[ ! -f "$TEMPLATE" ]]; then
  echo "Missing template: $TEMPLATE" >&2
  exit 1
fi
if [[ ! -f "$COMPOSE_SRC" ]]; then
  echo "Missing compose overlay: $COMPOSE_SRC" >&2
  exit 1
fi
if [[ ! -f "${COMPOSE_DIR}/docker-compose.yaml" ]]; then
  echo "Missing ${COMPOSE_DIR}/docker-compose.yaml" >&2
  exit 1
fi

CALLBACK_URL="${ORIGIN}/api/openim/callback/${TOKEN}"
mkdir -p "$CONFIG_DIR"
# Replace placeholder only; do not print CALLBACK_URL (contains the path token).
sed "s|{{OPENIM_CALLBACK_URL}}|${CALLBACK_URL}|" "$TEMPLATE" > "$WEBHOOKS_DST"
chmod 644 "$WEBHOOKS_DST"
cp "$COMPOSE_SRC" "$COMPOSE_WEBHOOKS_DST"
chmod 644 "$COMPOSE_WEBHOOKS_DST"

cd "$COMPOSE_DIR"
/usr/local/bin/docker-compose --env-file "$ENV_FILE" \
  -f docker-compose.yaml \
  -f docker-compose.webhooks.yaml \
  up -d --force-recreate --no-deps openim-server

echo "openim-server recreated with beforeOfflinePush webhook (origin=${ORIGIN})"
