#!/bin/bash
# Stop OpenIM containers not used by xituan and persist core-only mode across reboots.
# Run on production OpenIM EC2 via SSM. See OPENIM-DEPLOYMENT.md.
set -euo pipefail

OPENIM_DIR="${OPENIM_DIR:-/opt/openim}"
COMPOSE_DIR="${OPENIM_DIR}/upstream"
ENV_FILE="${OPENIM_DIR}/.env"
COMPOSE_FILE="${COMPOSE_DIR}/docker-compose.yaml"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# minio required: openim-server startup check-component probes minio:9000/openim
CORE_SERVICES=(mongo redis kafka etcd minio openim-server)
TRIM_SERVICES=(openim-chat openim-web-front openim-admin-front)

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Missing compose file: $COMPOSE_FILE" >&2
  exit 1
fi

install_core_only_mode() {
  if [[ -f "${SCRIPT_DIR}/openim-ec2-install-core-only-mode.sh" ]]; then
    INCLUDE_MINIO="${1:-0}" bash "${SCRIPT_DIR}/openim-ec2-install-core-only-mode.sh"
    return
  fi
  local include_minio="${1:-0}"
  local override_dst="${COMPOSE_DIR}/docker-compose.override.yaml"
  cat > "$override_dst" <<'EOF'
# xituan OpenIM EC2: optional services excluded from default `docker compose up -d`.
services:
  openim-chat:
    restart: "no"
    profiles: ["full-stack"]
  openim-web-front:
    restart: "no"
    profiles: ["full-stack"]
  openim-admin-front:
    restart: "no"
    profiles: ["full-stack"]
EOF
  if [[ "$include_minio" == "1" ]]; then
    cat >> "$override_dst" <<'EOF'
  minio:
    restart: "no"
    profiles: ["full-stack"]
EOF
  fi
  chmod 644 "$override_dst"
  echo "Installed core-only compose override: $override_dst"
}

if [[ "${STOP_MINIO:-0}" == "1" ]]; then
  echo "WARN: STOP_MINIO=1 ignored — openim-server requires minio at startup (check-component)." >&2
fi
install_core_only_mode 0

cd "$COMPOSE_DIR"
COMPOSE=(docker-compose --env-file "$ENV_FILE" -f docker-compose.yaml)

echo "Stopping unused services: ${TRIM_SERVICES[*]}"
"${COMPOSE[@]}" stop "${TRIM_SERVICES[@]}"

for name in "${TRIM_SERVICES[@]}"; do
  if docker inspect "$name" &>/dev/null; then
    docker update --restart=no "$name"
    echo "Set restart=no on $name"
  fi
done

echo "Ensuring core stack is up: ${CORE_SERVICES[*]}"
"${COMPOSE[@]}" up -d "${CORE_SERVICES[@]}"

echo ""
echo "Core-only mode enabled. Optional services stay off after reboot unless you run:"
echo "  cd $COMPOSE_DIR && docker-compose --env-file $ENV_FILE -f docker-compose.yaml --profile full-stack up -d"
echo ""
"${COMPOSE[@]}" ps
