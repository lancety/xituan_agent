# 参数文件使用说明（parameters.{env}.json）

## 结构
- parameters.production.json（实际值，已加入 .gitignore）
- parameters.production.example.json（示例模板）

## 核心参数
- Environment: production/staging/development
- AWSRegion: ap-southeast-2
- AWSAccountId: 12位账户ID
- ProjectName: xituan
- DBUsername / DBPassword / DBName
- DBInstanceClass / DBAllocatedStorage / EnableRDSPublicAccess（⚠️ 开启后需在 RDS 安全组添加本地 IP）
- ACMCertificateArn
- LogLevel / SentryEnabled
- FargateCpu / FargateMemory（1 vCPU = 1024 units；512=0.5 vCPU）

## 使用
```bash
# Phase 1（基础设施）
./deploy-phase1.sh production
# 设置 GitHub Secrets：DATABASE_URL（及 deploy.yml 其余运行时密钥）
# 推送代码触发 GitHub Actions 构建镜像

# Phase 2（应用层）
./deploy-phase2.sh production --migrate  # 附带自动迁移
```

## 注意
- 密码不能包含 @ " / 空格
- 镜像构建不依赖 DATABASE_URL，运行时由 ECS / GitHub Actions 注入 DATABASE_URL





