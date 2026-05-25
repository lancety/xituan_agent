#!/bin/bash
# Install docker-compose.override.yaml so reboot / docker restart keeps optional OpenIM services off.
# Used by UserData, trim script, and start-core script.
set -euo pipefail

OPENIM_DIR="${OPENIM_DIR:-/opt/openim}"
COMPOSE_DIR="${OPENIM_DIR}/upstream"
OVERRIDE_DST="${COMPOSE_DIR}/docker-compose.override.yaml"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OVERRIDE_SRC="${SCRIPT_DIR}/openim-docker-compose.override.yaml"
INCLUDE_MINIO="${INCLUDE_MINIO:-0}"

write_override() {
  cat > "$OVERRIDE_DST" <<'EOF'
# xituan OpenIM EC2: optional services excluded from default `docker compose up -d`.
# To start them: docker-compose --profile full-stack up -d
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
  if [[ "$INCLUDE_MINIO" == "1" ]]; then
    cat >> "$OVERRIDE_DST" <<'EOF'
  minio:
    restart: "no"
    profiles: ["full-stack"]
EOF
  fi
}

if [[ -f "$OVERRIDE_SRC" ]] && [[ "$INCLUDE_MINIO" != "1" ]]; then
  cp "$OVERRIDE_SRC" "$OVERRIDE_DST"
elif [[ -f "$OVERRIDE_SRC" ]] && [[ "$INCLUDE_MINIO" == "1" ]]; then
  write_override
else
  write_override
fi

chmod 644 "$OVERRIDE_DST"
echo "Installed core-only compose override: $OVERRIDE_DST"
