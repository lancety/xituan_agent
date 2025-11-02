# AWS 自动部署命令流程 - AI 参考指南 (完整版)

## 🎯 部署概述

**目标**: 在悉尼区域 (ap-southeast-2) 部署简化版 AWS Fargate + RDS PostgreSQL 基础设施  
**成本优化**: 移除 ALB 和 NAT Gateway，节省约 $50-70/月  
**架构**: 单区域、双 AZ 公共子网部署  
**安全方案**: GitHub Actions Secrets + CloudFormation 混合管理

---

## 🔧 环境准备

### 1. AWS CLI 配置检查
```bash
# 检查当前身份和权限
aws sts get-caller-identity
aws configure list
aws configure get region

# 确保有管理员权限或必要的 CloudFormation/ECS/RDS 权限
```

### 2. 环境变量设置
```bash
# PowerShell 环境变量
$env:AWS_REGION="ap-southeast-2"
$env:ENVIRONMENT="production"
$env:PROJECT_NAME="xituan"
$env:AWS_ACCOUNT_ID="你的AWS账户ID"
$env:DB_PASSWORD="Xituan2024Secure"  # ⚠️ 注意：不能包含 @ 符号和其他特殊字符
```

### 3. GitHub Actions Secrets 配置
在 GitHub 仓库设置中添加以下 Secrets：
- `JWT_SECRET`: JWT 密钥
- `WECHAT_APP_SECRET`: 微信小程序密钥
- `AIRWALLEX_API_KEY`: Airwallex API 密钥
- `AIRWALLEX_CLIENT_ID`: Airwallex 客户端 ID
- `AIRWALLEX_WEBHOOK_SECRET`: Airwallex Webhook 密钥
- `GOOGLE_MAPS_API_KEY`: Google Maps API 密钥
- `S3_KEY`: AWS S3 访问密钥
- `S3_SECRET_KEY`: AWS S3 秘密密钥
- `S3_BUCKET`: S3 存储桶名称

---

## 📋 完整部署流程

### 阶段 1: CloudFormation 基础设施部署

#### 步骤 1.1: 部署 VPC 基础设施
```bash
cd xituan_agent/aws-setup

# 部署 VPC (包含 2 个公共子网 - RDS 要求至少 2 个 AZ)
aws cloudformation deploy \
    --template-file vpc.yaml \
    --stack-name xituan-vpc-production \
    --parameter-overrides Environment=production \
    --capabilities CAPABILITY_IAM

# ⚠️ 关键点：
# - RDS DB Subnet Group 要求至少 2 个 Availability Zone
# - 因此需要 PublicSubnet 和 PublicSubnet2 两个子网
# - 虽然只有单区域部署，但子网必须在不同的 AZ
```

**验证**:
```bash
aws cloudformation describe-stacks --stack-name xituan-vpc-production --query 'Stacks[0].Outputs'
```

#### 步骤 1.2: 部署安全组
```bash
aws cloudformation deploy \
    --template-file security-groups.yaml \
    --stack-name xituan-security-groups-production \
    --parameter-overrides \
        Environment=production \
        VPCId=$(aws cloudformation describe-stacks --stack-name xituan-vpc-production --query 'Stacks[0].Outputs[?OutputKey==`VPCId`].OutputValue' --output text) \
    --capabilities CAPABILITY_IAM

# ⚠️ 关键点：
# - ECS 安全组开放 3050 端口入站（backend 服务端口）
# - RDS 安全组只允许来自 ECS 安全组的 5432 端口入站
# - 初始部署时 RDS 公网访问为 false（生产环境安全）
```

#### 步骤 1.3: 部署 RDS 数据库
```bash
# 先检查可用的 PostgreSQL 版本
aws rds describe-db-engine-versions \
    --engine postgres \
    --region ap-southeast-2 \
    --query 'DBEngineVersions[?contains(EngineVersion, `15`)].EngineVersion' \
    --output table

# 部署 PostgreSQL 15.14 (单 AZ 以节省成本)
aws cloudformation deploy \
    --template-file rds.yaml \
    --stack-name xituan-rds-production \
    --parameter-overrides \
        Environment=production \
        VPCId=$(aws cloudformation describe-stacks --stack-name xituan-vpc-production --query 'Stacks[0].Outputs[?OutputKey==`VPCId`].OutputValue' --output text) \
        PublicSubnetId=$(aws cloudformation describe-stacks --stack-name xituan-vpc-production --query 'Stacks[0].Outputs[?OutputKey==`PublicSubnetId`].OutputValue' --output text) \
        PublicSubnet2Id=$(aws cloudformation describe-stacks --stack-name xituan-vpc-production --query 'Stacks[0].Outputs[?OutputKey==`PublicSubnet2Id`].OutputValue' --output text) \
        RDSSecurityGroupId=$(aws cloudformation describe-stacks --stack-name xituan-security-groups-production --query 'Stacks[0].Outputs[?OutputKey==`RDSSecurityGroupId`].OutputValue' --output text) \
        DBPassword=$env:DB_PASSWORD \
    --capabilities CAPABILITY_IAM

# ⚠️ 关键点：
# - 密码必须符合 AWS RDS 要求：不能包含 @, ", /, 空格等特殊字符
# - 使用 15.14 版本（根据区域可用版本调整）
# - PubliclyAccessible: false（初始关闭公网访问，确保安全）
# - DeletionProtection: true（生产环境保护）
```

**验证 RDS 状态**:
```bash
aws rds describe-db-instances \
    --db-instance-identifier xituan-postgres-production \
    --query 'DBInstances[0].{Status:DBInstanceStatus,Endpoint:Endpoint.Address,Port:Endpoint.Port}' \
    --output json
```

#### 步骤 1.4: 部署 ECS 集群
```bash
aws cloudformation deploy \
    --template-file ecs-cluster.yaml \
    --stack-name xituan-ecs-cluster-production \
    --parameter-overrides Environment=production \
    --capabilities CAPABILITY_IAM

# ⚠️ 关键点：
# - 简化配置，只创建 ECS 集群本身
# - 不使用 CapacityProviders 或 DefaultCapacityProviderStrategy，避免服务链接角色问题
```

#### 步骤 1.5: 创建 ECR 仓库
```bash
aws ecr create-repository \
    --repository-name xituan-backend \
    --region ap-southeast-2 \
    --image-scanning-configuration scanOnPush=true

# 获取 ECR 登录命令（用于后续 Docker push）
aws ecr get-login-password --region ap-southeast-2 | docker login --username AWS --password-stdin $env:AWS_ACCOUNT_ID.dkr.ecr.ap-southeast-2.amazonaws.com
```

#### 步骤 1.6: 部署 ECS 服务（初始部署）
```bash
# 初始部署使用测试镜像或占位镜像
aws cloudformation deploy \
    --template-file ecs-services.yaml \
    --stack-name xituan-ecs-services-production \
    --parameter-overrides \
        Environment=production \
        ECSClusterName=$(aws cloudformation describe-stacks --stack-name xituan-ecs-cluster-production --query 'Stacks[0].Outputs[?OutputKey==`ECSClusterName`].OutputValue' --output text) \
        ECSSecurityGroupId=$(aws cloudformation describe-stacks --stack-name xituan-security-groups-production --query 'Stacks[0].Outputs[?OutputKey==`ECSSecurityGroupId`].OutputValue' --output text) \
        PublicSubnetId=$(aws cloudformation describe-stacks --stack-name xituan-vpc-production --query 'Stacks[0].Outputs[?OutputKey==`PublicSubnetId`].OutputValue' --output text) \
        RDSInstanceEndpoint=$(aws cloudformation describe-stacks --stack-name xituan-rds-production --query 'Stacks[0].Outputs[?OutputKey==`RDSInstanceEndpoint`].OutputValue' --output text) \
        RDSInstancePort=$(aws cloudformation describe-stacks --stack-name xituan-rds-production --query 'Stacks[0].Outputs[?OutputKey==`RDSInstancePort`].OutputValue' --output text) \
        DBUsername=xituan_admin \
        DBPassword=$env:DB_PASSWORD \
    --capabilities CAPABILITY_IAM

# ⚠️ 关键点：
# - 环境变量使用 DB_USER（不是 DB_USERNAME），与应用代码配置一致
# - 初始部署时 ECR 镜像可能不存在，可以先部署一个占位任务定义
```

---

### 阶段 2: Docker 镜像构建和推送

#### 步骤 2.1: 构建后端镜像
```bash
cd ../../xituan_backend

# 检查 Dockerfile 关键配置
# - EXPOSE 3050
# - ENV PORT=3050
# - CMD ["npm", "start"] (不是 npm run dev)
# - RUN npm run build (确保 TypeScript 编译)

# 登录 ECR (PowerShell)
$env:AWS_ACCOUNT_ID = "你的账户ID"
aws ecr get-login-password --region ap-southeast-2 | docker login --username AWS --password-stdin "${env:AWS_ACCOUNT_ID}.dkr.ecr.ap-southeast-2.amazonaws.com"

# 构建镜像
docker build -t xituan-backend:latest .

# 标记镜像
docker tag xituan-backend:latest ${env:AWS_ACCOUNT_ID}.dkr.ecr.ap-southeast-2.amazonaws.com/xituan-backend:latest

# 推送镜像
docker push ${env:AWS_ACCOUNT_ID}.dkr.ecr.ap-southeast-2.amazonaws.com/xituan-backend:latest
```

### 步骤 1.7: 部署 ALB 并接入 ECS 服务（启用 80/443 与重定向）
```bash
# 部署/更新 ALB（传入 ACM 证书 ARN 则自动开启 443，并将 80 重定向到 443）
aws cloudformation deploy \
  --template-file alb.yaml \
  --stack-name xituan-alb-production \
  --parameter-overrides \
    Environment=production \
    VPCId=$(aws cloudformation describe-stacks --stack-name xituan-vpc-production --query 'Stacks[0].Outputs[?OutputKey==`VPCId`].OutputValue' --output text) \
    PublicSubnetId=$(aws cloudformation describe-stacks --stack-name xituan-vpc-production --query 'Stacks[0].Outputs[?OutputKey==`PublicSubnetId`].OutputValue' --output text) \
    PublicSubnet2Id=$(aws cloudformation describe-stacks --stack-name xituan-vpc-production --query 'Stacks[0].Outputs[?OutputKey==`PublicSubnet2Id`].OutputValue' --output text) \
    ACMCertificateArn=arn:aws:acm:ap-southeast-2:594332420383:certificate/5a268437-8612-4ce1-aa56-d6f0d98b2aea

# 读取输出
ALB_SG=$(aws cloudformation describe-stacks --stack-name xituan-alb-production --query 'Stacks[0].Outputs[?OutputKey==`ALBSecurityGroupId`].OutputValue' --output text)
TG_ARN=$(aws cloudformation describe-stacks --stack-name xituan-alb-production --query 'Stacks[0].Outputs[?OutputKey==`BackendTargetGroupArn`].OutputValue' --output text)

# 更新安全组（仅 ALB 可访问 ECS 3050）
aws cloudformation deploy \
  --template-file security-groups.yaml \
  --stack-name xituan-security-groups-production \
  --parameter-overrides \
    Environment=production \
    VPCId=$(aws cloudformation describe-stacks --stack-name xituan-vpc-production --query 'Stacks[0].Outputs[?OutputKey==`VPCId`].OutputValue' --output text) \
    ALBSecurityGroupId=$ALB_SG

# 让 ECS 服务挂上 ALB 目标组
aws cloudformation deploy \
  --template-file ecs-services.yaml \
  --stack-name xituan-ecs-services-production \
  --parameter-overrides \
    Environment=production \
    ECSClusterName=$(aws cloudformation describe-stacks --stack-name xituan-ecs-cluster-production --query 'Stacks[0].Outputs[?OutputKey==`ECSClusterName`].OutputValue' --output text) \
    ECSSecurityGroupId=$(aws cloudformation describe-stacks --stack-name xituan-security-groups-production --query 'Stacks[0].Outputs[?OutputKey==`ECSSecurityGroupId`].OutputValue' --output text) \
    PublicSubnetId=$(aws cloudformation describe-stacks --stack-name xituan-vpc-production --query 'Stacks[0].Outputs[?OutputKey==`PublicSubnetId`].OutputValue' --output text) \
    RDSInstanceEndpoint=$(aws cloudformation describe-stacks --stack-name xituan-rds-production --query 'Stacks[0].Outputs[?OutputKey==`RDSInstanceEndpoint`].OutputValue' --output text) \
    RDSInstancePort=$(aws cloudformation describe-stacks --stack-name xituan-rds-production --query 'Stacks[0].Outputs[?OutputKey==`RDSInstancePort`].OutputValue' --output text) \
    DBUsername=xituan_admin \
    DBPassword=$env:DB_PASSWORD \
    BackendTargetGroupArn=$TG_ARN \
  --capabilities CAPABILITY_IAM

# 获取 ALB 域名，Route53 创建 A(别名) 记录指向该域名即可
aws cloudformation describe-stacks --stack-name xituan-alb-production \
  --query 'Stacks[0].Outputs[?OutputKey==`ALBDNSName`].OutputValue' --output text
```

**验证镜像推送**:
```bash
aws ecr describe-images --repository-name xituan-backend --query 'imageDetails[0]' --output json
```

---

### 阶段 3: 数据库初始化和数据导入

#### 步骤 3.1: 临时开启 RDS 公网访问（用于数据导入）
```bash
# ⚠️ 注意：这是临时步骤，导入完成后必须关闭

# 1. 开启 RDS 公网访问
aws rds modify-db-instance \
    --db-instance-identifier xituan-postgres-production \
    --publicly-accessible \
    --apply-immediately

# 等待 RDS 修改完成（约 5-10 分钟）
aws rds wait db-instance-available \
    --db-instance-identifier xituan-postgres-production

# 2. 临时开放 RDS 安全组 5432 端口（仅限你的 IP 或特定 IP）
# 获取你的公网 IP
$MY_IP = (Invoke-WebRequest -Uri "https://api.ipify.org" -UseBasicParsing).Content

# 添加临时入站规则（仅用于数据导入）
$RDS_SG = aws cloudformation describe-stacks --stack-name xituan-security-groups-production --query 'Stacks[0].Outputs[?OutputKey==`RDSSecurityGroupId`].OutputValue' --output text

aws ec2 authorize-security-group-ingress \
    --group-id $RDS_SG \
    --ip-permissions IpProtocol=tcp,FromPort=5432,ToPort=5432,IpRanges="[{CidrIp=${MY_IP}/32,Description='TEMP Open for data import'}]"

# ⚠️ 关键点：
# - 只在数据导入期间开启
# - 导入完成后立即关闭
# - 使用最小权限原则（只开放你的 IP）
```

#### 步骤 3.2: 准备数据库导入（如果需要从旧数据库导入）
```bash
# 选项 1: 使用 pg_dump/pg_restore（需要匹配 PostgreSQL 版本）
# 选项 2: 使用 Docker 容器进行导入（推荐，版本独立）

# 从 Railway 导出数据（示例）
docker run --rm -e PGPASSWORD="railway_password" postgres:17 \
    pg_dump -h railway_host -U postgres -d railway \
    --format=custom \
    -f /tmp/dump.pg_dump

# 导入到 RDS（使用 Docker 容器，确保版本匹配）
docker run --rm \
    -v ${PWD}:/tmp \
    -e PGPASSWORD=$env:DB_PASSWORD \
    postgres:17 \
    pg_restore \
    -h xituan-postgres-production.cj0bdkxpkjnk.ap-southeast-2.rds.amazonaws.com \
    -U xituan_admin \
    -d xituan \
    --no-owner --no-acl \
    /tmp/dump.pg_dump

# ⚠️ 注意事项：
# - pg_restore 可能会报错说缺少扩展（如 pgcrypto）
# - 这些扩展会通过后续的迁移脚本自动创建
# - 部分数据导入失败不影响后续迁移流程
```

#### 步骤 3.3: 运行数据库迁移（本地）
```bash
# 更新 .env.production 文件，确保包含 RDS 连接信息和 SSL 配置
cd xituan_backend

# 编辑 .env.production（必须包含以下内容）:
# DATABASE_URL=postgresql://xituan_admin:Xituan2024Secure@xituan-postgres-production.cj0bdkxpkjnk.ap-southeast-2.rds.amazonaws.com:5432/xituan?sslmode=require
# NODE_TLS_REJECT_UNAUTHORIZED=0
# 
# ⚠️ 重要：即使迁移脚本会尝试自动设置，也必须在 .env.production 中明确设置
# NODE_TLS_REJECT_UNAUTHORIZED=0，否则 node-pg-migrate 可能无法正确连接

# 运行迁移
npm run migrate:prod

# ⚠️ 关键点：
# - run-migrations.js 脚本会自动处理部分 SSL 配置（设置环境变量和添加 sslmode）
# - 但 NODE_TLS_REJECT_UNAUTHORIZED=0 必须在 .env.production 文件中明确设置
# - 对于 pg 库，也可以使用 PGSSLMODE=require 环境变量（可选）
# - 迁移脚本包含 CREATE EXTENSION IF NOT EXISTS pgcrypto;（在 1710000000110 中）
```

**迁移验证**:
```bash
# 检查迁移记录表（如果迁移成功）
# 迁移脚本会显示 "No migrations to run!" 或类似成功消息
```

#### 步骤 3.4: 关闭 RDS 公网访问和安全组规则
```bash
# 1. 关闭 RDS 公网访问
aws rds modify-db-instance \
    --db-instance-identifier xituan-postgres-production \
    --no-publicly-accessible \
    --apply-immediately

# 2. 移除临时安全组规则
$RDS_SG = aws cloudformation describe-stacks --stack-name xituan-security-groups-production --query 'Stacks[0].Outputs[?OutputKey==`RDSSecurityGroupId`].OutputValue' --output text

aws ec2 revoke-security-group-ingress \
    --group-id $RDS_SG \
    --ip-permissions IpProtocol=tcp,FromPort=5432,ToPort=5432,IpRanges="[{CidrIp=${MY_IP}/32}]"

# ⚠️ 关键点：
# - 生产环境必须关闭公网访问
# - RDS 只能通过 VPC 内的 ECS 任务访问
# - 安全组规则确保只有 ECS 安全组可以访问 RDS
```

---

### 阶段 4: ECS 服务部署和问题排查

#### 步骤 4.1: 更新 ECS 任务定义（如果环境变量或密码更改）
```bash
# ⚠️ 重要：如果 RDS 密码更改或环境变量更新，需要更新任务定义

# 获取当前任务定义
aws ecs describe-task-definition \
    --task-definition xituan-backend-production \
    --query 'taskDefinition' \
    --output json > current-task-def.json

# 编辑 JSON 文件，更新环境变量或密码
# 特别注意：DB_USER（不是 DB_USERNAME）

# 注册新的任务定义版本
aws ecs register-task-definition \
    --cli-input-json file://current-task-def.json

# 获取新的 revision 号
$NEW_REVISION = aws ecs describe-task-definition \
    --task-definition xituan-backend-production \
    --query 'taskDefinition.revision' \
    --output text

Write-Host "New task definition revision: $NEW_REVISION"
```

#### 步骤 4.2: 强制 ECS 服务使用新任务定义
```bash
# 更新 ECS 服务使用新任务定义
aws ecs update-service \
    --cluster xituan-cluster-production \
    --service xituan-backend-service-production \
    --task-definition xituan-backend-production:$NEW_REVISION \
    --force-new-deployment

# 等待服务稳定
aws ecs wait services-stable \
    --cluster xituan-cluster-production \
    --services xituan-backend-service-production

# ⚠️ 关键点：
# - 如果任务启动失败，DeploymentCircuitBreaker 会自动回滚
# - 需要检查 CloudWatch Logs 找出失败原因
# - 常见问题：密码错误、环境变量不匹配、镜像问题
```

#### 步骤 4.3: 排查 ECS 任务启动问题
```bash
# 1. 检查服务状态
aws ecs describe-services \
    --cluster xituan-cluster-production \
    --services xituan-backend-service-production \
    --query 'services[0].{Status:status,Deployments:deployments[*].{TaskDef:taskDefinition,Status:status,Running:runningCount}}' \
    --output json

# 2. 获取运行中的任务 ARN
$TASK_ARN = aws ecs list-tasks \
    --cluster xituan-cluster-production \
    --service-name xituan-backend-service-production \
    --desired-status RUNNING \
    --query 'taskArns[0]' \
    --output text

# 3. 检查任务状态和停止原因
aws ecs describe-tasks \
    --cluster xituan-cluster-production \
    --tasks $TASK_ARN \
    --query 'tasks[0].{LastStatus:lastStatus,StoppedReason:stoppedReason,Containers:containers[0].{LastStatus:lastStatus,Reason:reason,ExitCode:exitCode}}' \
    --output json

# 4. 查看 CloudWatch Logs（最关键）
aws logs tail /ecs/xituan-backend-production --follow --since 5m

# 或获取最近的错误日志
aws logs filter-log-events \
    --log-group-name /ecs/xituan-backend-production \
    --filter-pattern "error" \
    --max-items 50 \
    --query 'events[*].message' \
    --output text

# ⚠️ 常见错误排查：
# - "FATAL 28000 ClientAuthentication" -> 密码错误或用户不存在
#   -> 解决方案：检查任务定义中的 DB_PASSWORD，确保与 RDS 密码一致
#   -> 如果密码更改，需要重启 RDS 实例：aws rds reboot-db-instance
#
# - "Error: Database configuration is incomplete" -> 环境变量缺失
#   -> 解决方案：检查任务定义中的 DB_USER（不是 DB_USERNAME）
#
# - "Cannot find module '/app/dist/src/app.js'" -> 构建问题
#   -> 解决方案：确保 Dockerfile 中有 npm run build 步骤
#
# - "EADDRINUSE" -> 端口冲突
#   -> 解决方案：确保 PORT 环境变量为 3050，且 Dockerfile EXPOSE 3050
```

#### 步骤 4.4: 修复 RDS 密码同步问题
```bash
# 如果密码更新但任务仍然认证失败，可能需要重启 RDS

# 1. 确认 RDS 密码已更新
aws rds describe-db-instances \
    --db-instance-identifier xituan-postgres-production \
    --query 'DBInstances[0].MasterUsername' \
    --output text

# 2. 重启 RDS 实例（使密码更改生效）
aws rds reboot-db-instance \
    --db-instance-identifier xituan-postgres-production

# 等待重启完成
aws rds wait db-instance-available \
    --db-instance-identifier xituan-postgres-production

# 3. 重新部署 ECS 服务
aws ecs update-service \
    --cluster xituan-cluster-production \
    --service xituan-backend-service-production \
    --force-new-deployment
```

---

### 阶段 5: 验证和测试

#### 步骤 5.1: 获取服务端点
```bash
# 获取任务 ARN
$TASK_ARN = aws ecs list-tasks \
    --cluster xituan-cluster-production \
    --service-name xituan-backend-service-production \
    --query 'taskArns[0]' \
    --output text

# 获取网络接口 ID
$ENI_ID = aws ecs describe-tasks \
    --cluster xituan-cluster-production \
    --tasks $TASK_ARN \
    --query 'tasks[0].attachments[0].details[?name==`networkInterfaceId`].value' \
    --output text

# 获取公网 IP
$PUBLIC_IP = aws ec2 describe-network-interfaces \
    --network-interface-ids $ENI_ID \
    --query 'NetworkInterfaces[0].Association.PublicIp' \
    --output text

Write-Host "Backend API endpoint: http://${PUBLIC_IP}:3050"
```

#### 步骤 5.2: 测试 API 端点
```bash
# 健康检查
Invoke-WebRequest -Uri "http://${PUBLIC_IP}:3050/health" -UseBasicParsing

# 产品列表 API
Invoke-WebRequest -Uri "http://${PUBLIC_IP}:3050/api/products?limit=5" -UseBasicParsing | ConvertFrom-Json | ConvertTo-Json -Depth 3

# 产品详情 API
Invoke-WebRequest -Uri "http://${PUBLIC_IP}:3050/api/products/{product-id}" -UseBasicParsing
```

---

## 🛡️ 环境变量安全方案

### 安全策略
- **动态配置** (DB_HOST, DB_PASSWORD): CloudFormation 参数管理
- **敏感配置** (JWT_SECRET, API_KEYS): GitHub Actions Secrets 管理
- **Docker 镜像**: 不包含任何敏感信息

### 工作流程
1. **GitHub Actions** 在部署时从 Secrets 获取敏感信息
2. **ECS 服务** 通过环境变量传递这些信息
3. **应用** 在运行时读取环境变量

### 优势
- ✅ 敏感信息不在 Docker 镜像中
- ✅ 敏感信息不在 CloudFormation 模板中
- ✅ 符合 GitHub Actions 工作流程
- ✅ 每次部署时获取最新值

---

## ⚠️ 完整问题排查清单

### 1. YAML 编码问题
**问题**: `'gbk' codec can't decode byte` 或 `Unable to load paramfile`  
**原因**: YAML 文件编码不是 UTF-8  
**解决方案**: 使用 `write_file` 工具重新创建 YAML 文件，确保 UTF-8 编码  
**预防**: 在模板中添加编码检查注释

### 2. RDS AZ 覆盖要求
**问题**: `The DB subnet group doesn't meet Availability Zone (AZ) coverage requirement`  
**原因**: RDS DB Subnet Group 要求至少 2 个不同的 AZ  
**解决方案**: `vpc.yaml` 中添加 `PublicSubnet2`，在第二个 AZ  
**预防**: YAML 模板中已包含两个公共子网

### 3. PostgreSQL 版本不可用
**问题**: `Cannot find version 15.4 for postgres`  
**原因**: 指定的版本在区域中不可用  
**解决方案**: 使用 `aws rds describe-db-engine-versions` 查找可用版本（15.14）  
**预防**: 在 YAML 注释中说明如何检查和更新版本

### 4. RDS 密码格式问题
**问题**: `MasterUserPassword is not a valid password`  
**原因**: 密码包含禁止字符（@, ", /, 空格等）  
**解决方案**: 使用符合 AWS 要求的密码（如 `Xituan2024Secure`）  
**预防**: 在文档中明确列出密码要求

### 5. ECS 服务链接角色问题
**问题**: `Unable to assume the service linked role`  
**原因**: ECS 集群配置过于复杂，触发了服务链接角色创建问题  
**解决方案**: 简化 `ecs-cluster.yaml`，移除 `CapacityProviders` 等配置  
**预防**: 使用最小化配置

### 6. Dockerfile 构建错误
**问题**: `ERROR: process "/bin/sh -c npm run build" did not complete successfully`  
**原因**: TypeScript 类型定义缺失或构建错误  
**解决方案**: 确保 `npm ci` 安装所有依赖，`npm run build` 成功  
**预防**: 在 Dockerfile 中添加构建验证步骤

### 7. 环境变量名称不匹配
**问题**: `Error: Database configuration is incomplete`  
**原因**: 任务定义中使用 `DB_USERNAME`，但应用代码期望 `DB_USER`  
**解决方案**: 在 `ecs-services.yaml` 中使用 `DB_USER`  
**预防**: 检查 `config.util.ts` 确认正确的环境变量名称

### 8. RDS 密码同步问题
**问题**: `FATAL 28000 ClientAuthentication`  
**原因**: RDS 密码更改后未重启实例，或任务定义中密码未更新  
**解决方案**: 
  1. 更新任务定义中的 `DB_PASSWORD`
  2. 注册新任务定义 revision
  3. 更新 ECS 服务
  4. 如仍失败，重启 RDS 实例
**预防**: 密码更改后同时更新任务定义并重启 RDS

### 9. 任务定义 ARN 错误
**问题**: `ECS was unable to assume the role`  
**原因**: 任务定义中引用了错误的或已删除的 IAM 角色 ARN  
**解决方案**: 从 CloudFormation 堆栈输出获取正确的角色 ARN  
**预防**: 使用 CloudFormation 自动管理 IAM 角色

### 10. 部署电路熔断器触发
**问题**: `ECS Deployment Circuit Breaker was triggered`  
**原因**: 新任务持续失败，导致自动回滚到旧版本  
**解决方案**: 
  1. 检查 CloudWatch Logs 找出失败原因
  2. 修复问题（密码、环境变量、镜像等）
  3. 创建新的任务定义 revision
  4. 更新服务
**预防**: 在更新前验证任务定义配置

### 11. SSL 连接配置问题
**问题**: `no pg_hba.conf entry for host ... no encryption` 或 `self-signed certificate`  
**原因**: RDS 要求 SSL，但客户端未正确配置  
**实际情况**: 
  - `DATABASE_URL` 中的 `sslmode=require` **可能不够**，因为 `node-pg-migrate` 使用的 `pg` 库可能不解析 URL 中的 SSL 参数
  - `NODE_TLS_REJECT_UNAUTHORIZED=0` **必须**在 `.env.production` 文件中明确设置，而不仅仅是在迁移脚本中设置
  
**实际有效的解决方案**: 
  1. **在 `.env.production` 文件中明确设置**:
     ```
     NODE_TLS_REJECT_UNAUTHORIZED=0
     DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
     ```
  2. **或使用 `PGSSLMODE` 环境变量**（`pg` 库的标准方式）:
     ```
     PGSSLMODE=require
     NODE_TLS_REJECT_UNAUTHORIZED=0
     ```
  3. **运行时应用（TypeORM）使用**:
     - 在 `database.config.ts` 中配置 `ssl: { rejectUnauthorized: false }`
     - 这是 TypeORM 的配置方式，与应用代码一致
  
**迁移脚本当前做法**（已包含但可能需要补充）:
  - `run-migrations.js` 自动设置 `NODE_TLS_REJECT_UNAUTHORIZED='0'`
  - 自动在 `DATABASE_URL` 中添加 `sslmode=require`
  - 但仍建议在 `.env.production` 中明确设置以确保生效
  
**预防**: 
  - 确保 `.env.production` 中包含 `NODE_TLS_REJECT_UNAUTHORIZED=0`
  - 使用迁移脚本自动处理（已在代码中实现）
  - 运行时应用通过 TypeORM 的 `ssl` 配置处理

### 12. 数据库扩展缺失
**问题**: `pg_restore: error: function digest(text, unknown) does not exist`  
**原因**: `pgcrypto` 扩展未创建  
**解决方案**: 迁移脚本 `1710000000110_add_preorder_support.sql` 中包含 `CREATE EXTENSION IF NOT EXISTS pgcrypto;`，运行迁移即可  
**预防**: 迁移脚本会自动创建所需扩展

---

## 📊 关键步骤的重要意义

### 1. 临时开启 RDS 公网访问
**意义**: 
- 允许从本地或 CI/CD 环境进行数据库初始化和数据导入
- **风险**: 临时降低安全性
- **缓解**: 
  - 只开放特定 IP 的安全组规则
  - 导入完成后立即关闭
  - 使用最小权限原则

### 2. 正确的任务定义 Revision 管理
**意义**: 
- ECS 使用不可变的任务定义版本
- 环境变量或配置更改必须创建新 revision
- **影响**: 
  - 错误的 revision 会导致服务无法启动
  - 必须显式更新服务以使用新 revision

### 3. RDS 密码同步和重启
**意义**: 
- RDS 密码更改可能需要在实例级别生效
- 有时需要重启实例使更改生效
- **影响**: 
  - 重启会导致短暂服务中断（单 AZ）
  - 但确保密码一致性是关键

### 4. SSL 连接配置
**意义**: 
- RDS 生产环境默认要求 SSL
- 客户端必须正确配置 SSL 参数
- **关键发现**: 
  - `DATABASE_URL` 中的 `sslmode=require` 可能不够（`pg` 库可能不解析）
  - `NODE_TLS_REJECT_UNAUTHORIZED=0` **必须**在 `.env.production` 文件中明确设置
  - 迁移脚本会自动设置，但建议在配置文件中也明确设置以确保生效
- **影响**: 
  - 未配置 SSL 会导致连接失败（`no pg_hba.conf entry for host ... no encryption`）
  - 迁移脚本需要特别处理 SSL
  - 运行时应用通过 TypeORM 的 `ssl: { rejectUnauthorized: false }` 配置

### 5. 环境变量命名一致性
**意义**: 
- 应用代码期望特定的环境变量名称
- CloudFormation 和 ECS 任务定义必须匹配
- **影响**: 
  - 不匹配会导致配置读取失败
  - 应用无法连接到数据库

---

## 🚀 GitHub Actions 集成

**触发条件**: 推送到 `production` 分支  
**自动流程**:
1. 构建 Docker 镜像
2. 推送到 ECR
3. 更新 ECS 服务（通过任务定义）
4. 等待服务稳定
5. 运行数据库迁移（通过 `aws ecs execute-command`）
6. 输出服务端点

**配置**: `xituan_backend/.github/workflows/deploy.yml`

---

## 🧹 清理资源

### 删除所有堆栈（按依赖顺序）
```bash
aws cloudformation delete-stack --stack-name xituan-ecs-services-production
aws cloudformation delete-stack --stack-name xituan-ecs-cluster-production
aws cloudformation delete-stack --stack-name xituan-rds-production
# ⚠️ 注意：RDS 有 DeletionProtection，需要先关闭
aws rds modify-db-instance --db-instance-identifier xituan-postgres-production --no-deletion-protection
aws cloudformation delete-stack --stack-name xituan-security-groups-production
aws cloudformation delete-stack --stack-name xituan-vpc-production

# 删除 ECR 仓库
aws ecr delete-repository --repository-name xituan-backend --force
```

---

## 📊 成本估算

**月成本** (悉尼区域):
- ECS Fargate (512 CPU, 1024 MB): ~$15-25/月
- RDS PostgreSQL (db.t3.micro, 20GB): ~$15-25/月
- ECR 存储: ~$1-2/月
- CloudWatch Logs: ~$2-5/月
- 数据传输: ~$2-5/月
- **总计**: ~$35-60/月

**节省**: 移除 ALB (~$20/月) + NAT Gateway (~$35/月) = ~$55/月
