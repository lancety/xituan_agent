#!/bin/bash
# Run on EC2 as root after repo exists at /opt/xituan/xituan_backend
set -eu
DEMO_APP_DIR="${DEMO_APP_DIR:-/opt/xituan/xituan_backend}"
APP_USER="${APP_USER:-ubuntu}"

if [ ! -d "${DEMO_APP_DIR}/.git" ]; then
  echo "ERROR: ${DEMO_APP_DIR}/.git missing — clone repo first"
  exit 1
fi

cd "$DEMO_APP_DIR"

if [ ! -f .env.demo ]; then
  if [ -f .env.demo.example ]; then
    cp .env.demo.example .env.demo
    echo "Created .env.demo from .env.demo.example (GitHub Actions will overwrite on deploy)"
  else
    echo "WARN: no .env.demo — wait for deploy-demo.yml or add manually"
  fi
fi

sudo -u "$APP_USER" npm ci
sudo -u "$APP_USER" npm run build
sudo -u "$APP_USER" npm run migrate:demo

if sudo -u "$APP_USER" pm2 describe xituan-backend >/dev/null 2>&1; then
  sudo -u "$APP_USER" pm2 restart xituan-backend
else
  sudo -u "$APP_USER" pm2 start npm --name xituan-backend --cwd "$DEMO_APP_DIR" -- run start:demo
fi
sudo -u "$APP_USER" pm2 save
env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" | tail -1 | bash || true

curl -sf http://127.0.0.1:3050/ >/dev/null && echo "OK: backend responds on :3050" || echo "WARN: no HTTP on :3050 yet"
pm2 list
