# OpenIM AWS 部署与 WeChat / Site 生产环境配置（调研）

> 状态：调研稿（M4 实施前）。本地 IM 联调已通过；生产侧 **尚未** 在 AWS / ECS 参数中落地 OpenIM。

## 1. 当前实现摘要

| 层级 | 状态 |
|------|------|
| 本地 OpenIM | `xituan_backend/deploy/openim` + `npm run im:*`，上游 [openimsdk/openim-docker](https://github.com/openimsdk/openim-docker) v3.8 |
| 业务库 | PostgreSQL `im` schema（`migrations/1710000000315_openim_foundation.sql`） |
| 消息正文 | OpenIM（Mongo/Redis/Kafka 在 compose 内）；PG 仅存会话映射、预览、附件元数据 |
| 历史消息 | 后端 `search_msg` → `GET .../conversations/:id/messages`；客户端 SDK 历史仅作回退 |
| 未读 | 客户端 OpenIM SDK + 列表后台合并；业务库不存未读 |
| Site 前台 | **尚无** OpenIM 聊天页；`xituan_site` 仅共享 codebase 类型，无 IM API 调用 |
| AWS | `xituan_agent/aws-setup` 仅有 Backend ALB → ECS；**无** `im-api` / `im-ws` 规则与 OpenIM EC2 |

## 2. 配置如何到达客户端（关键）

客户端 **不** 在环境变量里写 OpenIM 地址（小程序 / CMS 均如此）。

1. 调用 xituan 后端：`POST /api/openim/customer-merchant/token`（或 admin 侧 token）。
2. 响应 `iOpenimTokenPayload`：

```ts
{
  token: string;
  openimUserId: string;
  apiBaseUrl: string;   // 来自后端 OPENIM_API_BASE_URL
  wsPublicUrl: string;  // 来自后端 OPENIM_WS_PUBLIC_URL
}
```

3. `@openim/client-sdk` 使用上述 `apiBaseUrl` + `wsPublicUrl` 登录与收消息。

因此 **生产只需在后端（及微信备案域名 / 小程序后台）配对**，Site 未来做 H5/Web 聊天时同样走 token，无需单独的 `NEXT_PUBLIC_OPENIM_*`（除非将来要做静态兜底）。

## 3. 后端环境变量（必须）

定义见 `xituan_backend/src/utils/openim-config.util.ts`。

| 变量 | 用途 | 本地示例 | 生产建议 |
|------|------|----------|----------|
| `OPENIM_API_BASE_URL` | 服务端调 OpenIM REST；**并**下发给 SDK 的 `apiBaseUrl` | `http://127.0.0.1:10002` | `https://im-api.<public-host>` |
| `OPENIM_WS_PUBLIC_URL` | 下发给 SDK 的 WebSocket | `ws://127.0.0.1:10001` | `wss://im-ws.<public-host>` |
| `OPENIM_SECRET` | 与 OpenIM 栈 `OPENIM_SECRET` 一致 | `openIM123`（仅 dev） | **强随机**，与 compose `.env` 同步 |

附件公开 URL **不**使用环境变量：由 `openimAttachmentCdnUtil` 按 MIME 选择 `site-domain.ts` 的 `wechatImages`（图片）或 `wechatContent`（文档）。

未配置上述三项时：`openimConfigUtil.isOpenimConfigured()` 为 false，OpenIM 相关 API 返回 **503**。

参考模板：`deploy/openim/xituan-backend.env.example`、`deploy/openim/README.md`。

### 3.1 内部 URL vs 对外 URL（待产品确认）

当前 **只有一个** `OPENIM_API_BASE_URL`，既给 Axios 又给客户端。生产若 OpenIM 与 ECS 同 VPC，可考虑：

- ECS：`OPENIM_API_BASE_URL=http://<openim-ec2-private-ip>:10002`（更快、不走公网）
- 客户端：需在 token 中返回公网 `apiBaseUrl` → **可能要拆** `OPENIM_API_INTERNAL_URL` / `OPENIM_API_PUBLIC_URL`（代码尚未实现）。

在未拆分前，生产可暂用公网 `https://im-api.*` 统一两端（实现简单，多一跳）。

## 4. AWS 部署架构（IaC 已落地）

**IaC 路径**：`xituan_agent/aws-setup/`

| 文件 | 内容 |
|------|------|
| `07_openim.yaml` | OpenIM **EC2** + ALB **Listener Rules** + Target Groups |
| `deploy-openim.sh` | 部署 OpenIM 栈（在 phase1 之后） |
| `02_alb.yaml` | ALB idle timeout 300s、`HTTPSListenerArn` 输出 |
| `06_ecs-services.yaml` | `OPENIM_*` 环境变量 |
| `OPENIM-DEPLOYMENT.md` | 操作说明 |

**本地开发**仍在 `xituan_backend/deploy/openim/`，**不会**随 `deploy-phase1.sh` 自动部署。

规划要点：

- 与本地 **同一套** Docker Compose 镜像版本（UserData clone openim-docker v3.8）
- **独立 EC2**（`07_openim.yaml`），不与 ECS 混跑
- 与现有 ALB 共用 HTTPS Listener，按 Host 分流

### 4.1 端口与 Target Group

| OpenIM 服务 | 容器端口 | 对外 |
|-------------|----------|------|
| msg gateway (WS) | 10001 | `im-ws.*` → TG，**需支持 WebSocket**（ALB idle timeout ↑，健康检查用 HTTP 或 TCP） |
| openim-server (API) | 10002 | `im-api.*` → TG，HTTP 健康检查 `POST /auth/get_admin_token` 或文档推荐路径 |
| MinIO | 10005 | **不对公网**；附件走 xituan S3 |
| openim-web / admin front | 11001/11002 | 生产可不开公网（运维可选 VPN/SSM 端口转发） |

### 4.2 仍需人工/运维配置的部分

1. **Route53**：`im-api` / `im-ws` `*.xituan.com.au` → ALB（模板不创建记录）
2. **lancety 备案 DNS**：`im-api.lancety.com` CNAME → `im-api.xituan.com.au`
3. **ACM 证书**：须覆盖 Listener 上实际 Host（或 `*.xituan.com.au`）
4. **微信小程序** socket / request 合法域名
5. **`parameters.production.json`**：填写 `OpenimSecret` 等（见 `parameters.production.example.json`）

### 4.3 运维命令（EC2 上）

与本地相同（在 `deploy/openim` 目录）：

```bash
./scripts/bootstrap.sh   # 或从镜像/artifact 携带 upstream
docker compose --env-file .env -f docker-compose.upstream.yaml up -d
```

Windows 开发机已用 `docker-compose.mongo-volumes.yaml` 覆盖 Mongo 卷；Linux EC2 可评估是否仍需要。

上线前验收（与 README 一致）：

```bash
curl -s -X POST https://im-api.<host>/auth/get_admin_token \
  -H "Content-Type: application/json" -H "operationID: ping" \
  -d '{"secret":"<OPENIM_SECRET>","userID":"imAdmin","platformID":2}'
# errCode 应为 0
```

### 4.4 资源与成本粗算

- Compose 含 Mongo、Redis、Kafka、Etcd、MinIO、openim-server：内存建议 **≥ 8GB**
- 持久化：Mongo + Kafka 数据卷（EBS）；需备份策略
- 公网 IP：若 EC2 在公有子网且 `AssignPublicIp`，会占用 IPv4（参见 `docs/aws-public-ipv4-usage-analysis.md`）；更稳妥是私有子网 + ALB 公网入口

## 5. 微信小程序生产配置

### 5.1 API 基址（已有）

`xituan_wechat_app/config/index.ts` → `siteDomain[env].wechatServer + "/api/"`：

| 微信版本 | epDev | wechatServer |
|----------|-------|----------------|
| develop | dev | 开发机 IP:3050（需改 `site-domain.ts`） |
| trial | staging | `https://backend-staging.lancety.com` |
| release | prod | `https://backend.lancety.com` |

OpenIM 业务 API 路径前缀：`/openim/customer-merchant/*`（已挂在同一 backend）。

### 5.2 微信公众平台 → 开发管理

| 配置项 | 生产需加入 |
|--------|------------|
| **request 合法域名** | 已有 `https://backend.lancety.com`；若 token 里 `apiBaseUrl` 指向 `im-api.*`，须 **额外** 添加 `https://im-api.<备案域>` |
| **socket 合法域名** | **必须** 添加 `wss://im-ws.<备案域>`（与 `OPENIM_WS_PUBLIC_URL` 主机一致，不要带路径） |
| **uploadFile / downloadFile** | 若聊天附件直传 S3/CDN，保留现有 `images.lancety.com` / `content.lancety.com` 等 |

备案策略：当前生产 API 走 `backend.lancety.com` 映射澳洲后端；IM 公网域名建议同样使用 **lancety 子域**（如 `im-api.lancety.com`、`im-ws.lancety.com`），与 `site-domain.ts` 中 `wechatServer` 一致，避免小程序只认 `.com.au` 而后端下发 `.lancety.com` 导致校验失败。

### 5.3 构建与依赖

- `npm run im:pack-npm` 提示：发布前在微信开发者工具执行 **构建 npm**（`@openim/client-sdk`）
- `libVersion`：`project.config.json` 当前 `3.8.11`，需满足 SDK 最低基础库要求
- 真机调试：本地 WS 不能用 `127.0.0.1`，需 LAN IP 或 staging 域名（README 已说明）

### 5.4 Platform ID

小程序 token：`enOpenimPlatformId.MINI_PROGRAM`（6）— 与 OpenIM 注册一致。

## 6. Site（xituan_site）生产配置

### 6.1 当前

- 环境变量：`NEXT_PUBLIC_API_URL`（如 `https://backend.xituan.com.au/api`），见 `package.json` `prod` 脚本与 `.env.template`
- **无** 消费者聊天页面；未来若做「网站联系商户」，应：
  - 使用 **JWT** 调 `/api/openim/customer-merchant/*`（与小程序同路由组）
  - `POST .../token` 时 `platformId: enOpenimPlatformId.WEB`（5）
  - 引入 `@openim/client-sdk`（或轻量 WS），逻辑可对齐 `xituan_cms` 的 `openim-client.util.ts`

### 6.2 Site 上线 OpenIM 时的额外项

| 项 | 说明 |
|----|------|
| `NEXT_PUBLIC_API_URL` | 保持指向生产 backend |
| 浏览器 | 无「合法域名」清单，但需 **HTTPS 页面 + wss://**；CORS 由 backend 控制 |
| Cookie / JWT | 与现有 site 登录一致 |
| CDN | 头像/附件 URL 继续用 `siteDomain.production.images` / `content` |

无需改 `site-domain.ts` 即可启动 IM，除非 site 与小程序共用不同 API 主机。

## 7. CMS 生产配置

- `NEXT_PUBLIC_API_URL` → `https://backend.xituan.com.au/api`（或商户 CMS 实际调用的 backend）
- 商户员工：`/api/admin/openim/customer-merchant/*` + `enOpenimPlatformId.WEB`
- 浏览器访问 `wss://im-ws.*`；无小程序式 socket 白名单，需证书有效

## 8. 附件与 S3

- 路径：`im/conversations/{conversationId}/attachments/...`（`openimAttachmentS3Util`）
- **不要** 走 OpenIM 内置 MinIO 给业务附件
- 确保 `wechatImages` / `wechatContent` CloudFront 均能访问 bucket 下 `im/conversations/...` 前缀（图片走 images 变换，文档走 content 原样）

## 9. 数据库与发布顺序建议

1. 在 production Postgres 执行 `1710000000315_openim_foundation.sql`（走既有 migration 流程，**不要** 改 `migrations_stable` 除非人工 promote）
2. 部署 OpenIM EC2 栈并验收 `get_admin_token`
3. 更新 ECS Backend 环境变量 `OPENIM_API_*` / `OPENIM_WS_PUBLIC_URL` / `OPENIM_SECRET`
4. 配置 DNS + ALB + ACM
5. 更新微信 socket/request 域名
6. 发版小程序 / CMS（无需改 OpenIM URL 常量，除非改备案域）
7. Site 聊天功能可独立排期

## 10. 安全清单

- [ ] 生产禁用默认 `openIM123`
- [ ] `OPENIM_SECRET` 存 Secrets Manager，轮换流程
- [ ] `im-api` / `im-ws` 仅 TLS 对外
- [ ] OpenIM EC2 SG 最小化
- [ ] 监控：openim-server 健康、磁盘、Mongo；Backend 503 `OPENIM_NOT_CONFIGURED` 告警

## 11. 待确认问题（实施前与负责人对齐）

1. **公网主机名**：`im-api/im-ws` 用 `*.xituan.com.au` 还是 `*.lancety.com`（微信强烈建议与 `wechatServer` 同备案体系）？
2. **OpenIM 与 Backend 是否同 VPC 内网访问**？若是要拆 internal/public API URL。
3. **单 EC2 还是多 AZ / 将来 K8s**？M4 先单节点可接受否？
4. **Site 消费者聊天** 是否 P1 同批上线，还是仅小程序 + CMS？
5. **历史消息保留 / 合规**（`retention_policy_code`）产品规则是否已定？

## 12. 相关代码路径

| 用途 | 路径 |
|------|------|
| 本地 compose | `xituan_backend/deploy/openim/` |
| 后端配置 | `xituan_backend/src/utils/openim-config.util.ts` |
| Token 下发 | `xituan_backend/src/domains/openim/services/openim-binding.service.ts` |
| 域名常量 | `*/submodules/xituan_codebase/constants/site-domain.ts` |
| 小程序 API | `xituan_wechat_app/lib/openim-chat.api.util.ts` |
| CMS API | `xituan_cms/src/lib/api/openim-admin.api.ts` |
| AWS 模板 | `xituan_agent/aws-setup/` |
| 模块边界 | `.cursor/rules/openim-module-boundary.mdc` |
