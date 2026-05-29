#!/usr/bin/env bash
# One-time bootstrap for xituan-backend-demo EC2 (Ubuntu 22.04).
# Run via SSM as root or: sudo bash demo-ec2-bootstrap.sh
# Optional env:
#   GITHUB_TOKEN — clone private xituan_backend (branch demo, fallback master)
#   DEMO_DB_PASSWORD — postgres role password (must match GitHub DATABASE_URL secret)
#   DEMO_APP_DIR — default /opt/xituan/xituan_backend
set -eu

DEMO_APP_DIR="${DEMO_APP_DIR:-/opt/xituan/xituan_backend}"
DEMO_DB_PASSWORD="${DEMO_DB_PASSWORD:-mimaMIMA}"
DEMO_DB_NAME="${DEMO_DB_NAME:-xituan_db}"
REPO_URL="${REPO_URL:-https://github.com/lancety/xituan_backend.git}"
GIT_BRANCH="${GIT_BRANCH:-demo}"
APP_USER="${APP_USER:-ubuntu}"

export DEBIAN_FRONTEND=noninteractive

log() { echo "[demo-bootstrap] $*"; }

log "=== apt base packages ==="
apt-get update -y
apt-get install -y git curl ca-certificates gnupg build-essential postgresql postgresql-contrib jq

log "=== Node.js 20 ==="
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
node -v
npm -v

log "=== pm2 ==="
npm install -g pm2

log "=== Docker (OpenIM / optional) ==="
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
  usermod -aG docker "$APP_USER" || true
  systemctl enable docker
  systemctl start docker
fi

log "=== Caddy ==="
if ! command -v caddy >/dev/null 2>&1; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi
systemctl enable caddy

if [ ! -f /etc/caddy/Caddyfile ] || ! grep -q 'backend-demo.xituan.com.au' /etc/caddy/Caddyfile 2>/dev/null; then
  cat >/etc/caddy/Caddyfile <<'CADDY'
backend-demo.xituan.com.au {
	reverse_proxy 127.0.0.1:3050
}
CADDY
  systemctl reload caddy || systemctl restart caddy
fi

log "=== PostgreSQL ==="
systemctl enable postgresql
systemctl start postgresql
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "ALTER USER postgres WITH PASSWORD '${DEMO_DB_PASSWORD}';"
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DEMO_DB_NAME}'" | grep -q 1; then
  sudo -u postgres createdb "${DEMO_DB_NAME}"
fi
log "DATABASE_URL=postgresql://postgres:${DEMO_DB_PASSWORD}@127.0.0.1:5432/${DEMO_DB_NAME}"

log "=== app directory ==="
mkdir -p "$(dirname "$DEMO_APP_DIR")"
chown -R "${APP_USER}:${APP_USER}" "$(dirname "$DEMO_APP_DIR")"

log "=== git clone ==="
if [ -n "${GITHUB_TOKEN:-}" ]; then
  CLONE_URL="https://${GITHUB_TOKEN}@github.com/lancety/xituan_backend.git"
else
  CLONE_URL="$REPO_URL"
fi

if [ ! -d "${DEMO_APP_DIR}/.git" ]; then
  sudo -u "$APP_USER" git clone --recursive "$CLONE_URL" "$DEMO_APP_DIR" || true
fi

if [ -d "${DEMO_APP_DIR}/.git" ]; then
  cd "$DEMO_APP_DIR"
  sudo -u "$APP_USER" git fetch origin || true
  if sudo -u "$APP_USER" git show-ref --verify --quiet "refs/remotes/origin/${GIT_BRANCH}"; then
    sudo -u "$APP_USER" git checkout "$GIT_BRANCH"
    sudo -u "$APP_USER" git pull origin "$GIT_BRANCH" || true
  else
    log "branch ${GIT_BRANCH} not found; staying on current branch"
  fi
  sudo -u "$APP_USER" git submodule update --init --recursive || true
else
  log "SKIP clone (set GITHUB_TOKEN or clone manually to ${DEMO_APP_DIR})"
fi

log "=== done ==="
log "Next: ensure GitHub demo DATABASE_URL matches postgres password above."
log "Next: push demo branch + Actions writes .env.demo, or cp .env.demo.example on host."
log "Next: cd ${DEMO_APP_DIR} && npm ci && npm run build && npm run migrate:demo"
log "Next: pm2 start npm --name xituan-backend -- run start:demo && pm2 save"
