# OpenIM AWS 部署（IaC）

## 现状说明：之前 OpenIM EC2 在哪儿？

| 位置 | 用途 | 是否自动部署 |
|------|------|----------------|
| `xituan_backend/deploy/openim/` | **本机开发**：Docker Compose、`npm run im:up` | 否，仅开发者本机 |
| `xituan_agent/aws-setup/07_openim.yaml` | **生产/预发**：EC2 + ALB 规则 | **是**，需执行 `deploy-openim.sh` |
| `02_alb.yaml` | Backend +（更新后）idle timeout 300s、导出 HTTPS Listener ARN | `deploy-phase1.sh` |
| `06_ecs-services.yaml` | Backend 容器环境变量 `OPENIM_*` | `deploy-phase2.sh` |

**结论：OpenIM EC2 以前没有进 AWS 自动部署**；现在用 `07_openim.yaml` + `deploy-openim.sh` 补齐。

## 部署顺序

```bash
cd xituan_agent/aws-setup
chmod +x deploy-phase1.sh deploy-phase2.sh deploy-openim.sh

# 1) 基础设施（含 ALB HTTPS）
./deploy-phase1.sh production

# 2) OpenIM EC2 + im-api/im-ws Listener Rules
./deploy-openim.sh production

# 3) ECS Backend
./deploy-phase2.sh production   # production: SkipEcsServicesCfnDeploy=true → 只建 cluster，ECS 走 GitHub Actions
./deploy-phase2.sh staging      # staging: 填 parameters.staging.json 后由 06 模板部署完整 task env
```

| 环境 | ECS 06 栈 | 密钥来源 |
|------|-----------|----------|
| **production** | 默认 **跳过**（`SkipEcsServicesCfnDeploy=true`） | `xituan_backend` GitHub Actions `deploy.yml` |
| **staging** | `deploy-phase2.sh staging` 更新 `06_ecs-services` | `parameters.staging.json`（gitignore，从 `parameters.staging.example.json` 复制） |

`UPDATE_ROLLBACK_COMPLETE` 的 production 栈可保持不动；勿对 production 再跑 06（除非显式 `SkipEcsServicesCfnDeploy=false` 且 parameters 含全部 Jwt/Stripe 等字段）。

OpenIM EC2：`OPENIM_SECRET` 环境变量 / GitHub Secret。ECS OpenIM：`OpenimApiInternalUrl` + `OpenimApiPublicUrl` 等写入 staging parameters 或 production Actions。

## 模板职责

### `07_openim.yaml`

- EC2（Amazon Linux 2023）+ 数据盘：UserData 安装 Docker、clone `openimsdk/openim-docker` v3.8、启动 compose
- 安全组：ALB → 10001/10002；ECS → 10002（内网调 API 可选）
- Target Group：`im-api` → 10002，`im-ws` → 10001
- **Listener Rules**（优先级 10/11）：按 Host 转发到上述 TG（**不再需控制台手配**）

### `02_alb.yaml`（已更新）

- `idle_timeout.timeout_seconds = 300`（ALB 连接空闲断开，非业务「多久没聊天」）
- 输出 `HTTPSListenerArn` 供 `07_openim` 使用

### DNS（仍须在 Route53 / 备案 DNS 配置，无单独模板）

1. Route53（`xituan.com.au`）：`im-api` / `im-ws` → ALB alias  
2. lancety：`im-api.lancety.com` CNAME → `im-api.xituan.com.au`（与现网 backend 备案方式一致）

### 微信

- request：`https://im-api.lancety.com`（若与 `OPENIM_API_BASE_URL` 一致）
- socket：`wss://im-ws.lancety.com`

## 运维

- 登录 EC2：`aws ssm start-session --target <OpenimInstanceId>`
- 查看 compose：`cd /opt/openim/upstream && docker-compose ps`
- 升级镜像：改 UserData 或 SSM 进机后拉取新 tag 并 `docker-compose up -d`（后续可做 AMI/CodeDeploy）

## 本地开发（不变）

```bash
cd xituan_backend
npm run im:bootstrap
npm run im:up
```

与 AWS EC2 栈相互独立；生产密钥勿使用 `openIM123`。
