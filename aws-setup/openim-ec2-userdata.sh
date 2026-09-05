#!/bin/bash
# CloudFormation UserData: OpenIM docker compose on EC2 (Amazon Linux 2023).
# ${OpenimSecret} is substituted by Fn::Sub in 07_openim.yaml.
set -euxo pipefail
dnf install -y docker git
systemctl enable --now docker
mkdir -p /opt/openim/data
if ! mountpoint -q /opt/openim/data; then
  if [ -b /dev/sdf ] && ! blkid /dev/sdf; then
    mkfs -t xfs /dev/sdf
  fi
  if [ -b /dev/sdf ]; then
    grep -q '/dev/sdf' /etc/fstab || echo '/dev/sdf /opt/openim/data xfs defaults,nofail 0 2' >> /etc/fstab
    mount -a
  fi
fi
COMPOSE_VERSION="v2.24.7"
curl -fsSL "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-x86_64" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
cd /opt/openim
if [ ! -d upstream/.git ]; then
  git clone --depth 1 --branch v3.8 https://github.com/openimsdk/openim-docker.git upstream
fi
cat > .env <<EOF
DATA_DIR=/opt/openim/data/
MONGO_IMAGE=mongo:7.0
REDIS_IMAGE=redis:7.0.0
KAFKA_IMAGE=bitnamilegacy/kafka:3.5.1
MINIO_IMAGE=minio/minio:RELEASE.2024-01-11T07-46-16Z
ETCD_IMAGE=bitnamilegacy/etcd:3.5.13
OPENIM_SERVER_IMAGE=openim/openim-server:v3.11.1-patch.12
OPENIM_CHAT_IMAGE=openim/openim-chat:v1.8.4-patch.2
MONGO_ADDRESS=mongo:27017
MONGO_USERNAME=openIM
MONGO_PASSWORD=openIM123
KAFKA_ADDRESS=kafka:9094
KAFKA_USERNAME=
KAFKA_PASSWORD=
ETCD_ADDRESS=etcd:2379
ETCD_USERNAME=
ETCD_PASSWORD=
REDIS_ADDRESS=redis:6379
REDIS_PASSWORD=openIM123
MINIO_EXTERNAL_ADDRESS=http://127.0.0.1:10005
MINIO_INTERNAL_ADDRESS=minio:9000
MINIO_ACCESS_KEY_ID=root
MINIO_SECRET_ACCESS_KEY=openIM123
OPENIM_SECRET=${OpenimSecret}
OPENIM_API_PORT=10002
OPENIM_MSG_GATEWAY_PORT=10001
OPENIM_WEB_FRONT_IMAGE=openim/openim-web-front:release-v3.11.1
OPENIM_ADMIN_FRONT_IMAGE=openim/openim-admin-front:release-v1.8.4-patch.2
OPENIM_WEB_FRONT_PORT=11001
OPENIM_ADMIN_FRONT_PORT=11002
CHAT_API_PORT=10008
ADMIN_API_PORT=10009
MINIO_PORT=10005
MINIO_CONSOLE_PORT=10004
PROMETHEUS_IMAGE=prom/prometheus:v2.51.2
PROMETHEUS_PORT=19090
ALERTMANAGER_IMAGE=prom/alertmanager:v0.27.0
ALERTMANAGER_PORT=19093
GRAFANA_IMAGE=grafana/grafana:11.0.1
GRAFANA_PORT=13000
NODE_EXPORTER_IMAGE=prom/node-exporter:v1.7.0
NODE_EXPORTER_PORT=19100
GRAFANA_URL=http://127.0.0.1:13000
API_URL=http://openim-server:10002
LOG_IS_STDOUT=true
LOG_LEVEL=4
EOF
cd /opt/openim/upstream
cat > docker-compose.override.yaml <<'OVERRIDE'
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
OVERRIDE
docker-compose --env-file ../.env -f docker-compose.yaml up -d mongo redis kafka etcd minio openim-server
echo "ok" > /var/log/openim-bootstrap.done
