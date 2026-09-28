#!/bin/bash
# Start OpenIM core stack for xituan (includes minio — required by openim-server startup checks).
set -euo pipefail

OPENIM_DIR="${OPENIM_DIR:-/opt/openim}"
COMPOSE_DIR="${OPENIM_DIR}/upstream"
ENV_FILE="${OPENIM_DIR}/.env"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

CORE_SERVICES=(mongo redis kafka etcd minio openim-server)

"${SCRIPT_DIR}/openim-ec2-install-core-only-mode.sh"

cd "$COMPOSE_DIR"
COMPOSE_ARGS=(--env-file "$ENV_FILE" -f docker-compose.yaml)
if [[ -f "${COMPOSE_DIR}/docker-compose.webhooks.yaml" ]]; then
  COMPOSE_ARGS+=(-f docker-compose.webhooks.yaml)
fi
docker-compose "${COMPOSE_ARGS[@]}" up -d "${CORE_SERVICES[@]}"
docker-compose "${COMPOSE_ARGS[@]}" ps
