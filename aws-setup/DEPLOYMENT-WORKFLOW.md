# 完整部署流程指南

## 📋 概述

本文档说明从零开始的完整部署流程，包括首次部署和后续更新。关键原则：镜像构建与配置解耦；基础设施与应用分两阶段部署。

---

## 🎯 正确的部署顺序

```
A. 准备 → B. 构建镜像 → C. 阶段1(基础设施) → D. 阶段2(应用+迁移)
```

---

## 📝 详细步骤

### 阶段 A: 准备（首次部署或更新配置）

1) 配置 Dockerfile

- EXPOSE 3050
- ENV PORT=3050
- RUN npm run build
- CMD ["npm", "start"]
- COPY submodules/ ./submodules/

2) 配置 GitHub Actions Workflow

- 触发 production 分支
- ECR 仓库/Region 正确
- submodules: recursive（私有子模块需要 PAT：`GH_TOKEN`）

3) 配置 GitHub Secrets（最少）

- AWS_ACCOUNT_ID, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
- DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD（RDS 完成后更新 DB_HOST/DB_PORT）
- 业务相关密钥（JWT、WeChat、Airwallex、S3 等）

4) 配置参数文件（parameters.production.json）

- 参考 parameters.production.example.json
- 详情见 parameters.md

---

### 阶段 B: 构建镜像（先完成）

1) 推送代码触发构建

```bash
cd xituan_backend
git add .
git commit -m "Prepare for deployment"
git push origin production
```

2) 确认镜像已推送到 ECR（latest 标签）

---

### 阶段 C: 部署基础设施（Phase 1）

使用两阶段脚本（推荐）：

```bash
cd xituan_agent/aws-setup
chmod +x deploy-phase1.sh deploy-phase2.sh

# 阶段1：部署 00-04：ECR, VPC, ALB, 安全组, RDS
./deploy-phase1.sh production
```

阶段1完成后，脚本会打印：
- ALB DNS
- RDS Endpoint/Port
- 下一步操作提示：
  - 在 GitHub Secrets 中设置 DB_HOST/DB_PORT/DB_USER/DB_PASSWORD
  - 推送代码触发镜像构建（如未完成）

---

### 阶段 D: 部署应用与迁移（Phase 2）

```bash
# 阶段2：部署 05-06：ECS Cluster, ECS Services；可选执行迁移
./deploy-phase2.sh production --migrate
```

- 部署后通过 ECS Exec 自动执行 `npm run migrate:prod`（当提供 --migrate）
- 迁移使用运行时环境变量（DB_* 来自任务定义），与镜像构建解耦
- 模板默认开启 Exec（`EnableExecuteCommand: true`），无需手工勾选
- 如 Exec 临时不可用，可用一次性任务 `ecs run-task` 覆盖命令跑迁移（见故障排除）

---

## 🔄 后续更新流程

### 更新应用代码

- 推送到 production 分支 → GitHub Actions 构建并推送镜像 → 更新 ECS 服务（滚动更新）

### 更新基础设施配置

- 更新 parameters.production.json
- 运行阶段脚本（通常 phase1 只在需要改基础设施时运行；应用层改动运行 phase2）

```bash
./deploy-phase1.sh production   # 仅当改动到 00-04 资源时
./deploy-phase2.sh production --migrate
```

---

## 📊 流程检查清单

### 首次部署

- [ ] Dockerfile 正确
- [ ] GitHub Actions workflow 正确
- [ ] GitHub Secrets 配置完成（至少必需项）
- [ ] parameters.production.json 配置完成
- [ ] 代码已推送 production 分支
- [ ] ECR 存在 latest 镜像
- [ ] Phase1 部署完成（00-04）
- [ ] 更新 DB_HOST/DB_PORT 到 GitHub Secrets
- [ ] Phase2 部署完成（05-06）
- [ ] 迁移已执行（migrate:prod）
- [ ] RDS 公网访问已关闭（如曾开启）
- [ ] Route53 DNS 指向 ALB DNS

### 后续更新

- [ ] 代码推送并构建成功
- [ ] ECS 服务滚动更新完成
- [ ] 健康检查通过

---

## 🚨 常见问题

- 见 TROUBLESHOOTING.md（SSL/pgcrypto/回滚/版本等问题的精简处理）

---

## 📚 相关文档

- `parameters.md`: 参数文件说明
- `UPDATE-CONFIGURATION.md`: 配置更新对 ECS/RDS 的影响
- `TROUBLESHOOTING.md`: 常见问题精简指引
- 归档参考：`docs_depreciated/aws-setup/`

