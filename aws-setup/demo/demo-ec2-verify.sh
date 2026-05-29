#!/bin/bash
echo "=== versions ==="
node -v 2>/dev/null || echo no-node
npm -v 2>/dev/null || echo no-npm
pm2 -v 2>/dev/null || echo no-pm2
docker -v 2>/dev/null || echo no-docker
caddy version 2>/dev/null | head -1 || echo no-caddy
echo "=== postgres xituan_db ==="
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='xituan_db'" 2>/dev/null || echo pg-check-failed
echo "=== repo ==="
ls -la /opt/xituan/xituan_backend/.git 2>/dev/null || echo no-git-repo
echo "=== bootstrap summary ==="
grep -E '^\[demo-bootstrap\]' /var/log/demo-ec2-bootstrap.log 2>/dev/null | tail -20
echo "=== services ==="
systemctl is-active caddy postgresql docker 2>/dev/null || true
