# AWS CLI 部署命令和步骤指导 - 悉尼区域简化版 (环境变量安全方案)

## 前置条件

### 1. 安装和配置 AWS CLI
```bash
# 安装 AWS CLI (如果未安装)
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# 配置 AWS CLI
aws configure
# 输入你的 AWS Access Key ID, Secret Access Key, Region (ap-southeast-2), Output format (json)
```

### 2. 设置环境变量
```bash
# PowerShell 环境变量设置
$env:AWS_REGION="ap-southeast-2"
$env:ENVIRONMENT="production"
$env:PROJECT_NAME="xituan"
$env:AWS_ACCOUNT_ID="你的AWS账户ID"
$env:DB_PASSWORD="Xituan2024Secure"  # 注意：不能包含 @ 符号
```

### 3. GitHub Actions Secrets 配置
在 GitHub 仓库设置中添加以下 Secrets：
- `JWT_SECRET`: JWT 密钥
- `WECHAT_APP_SECRET`: 微信小程序密钥
- `GOOGLE_MAPS_API_KEY`: Google Maps API 密钥
- `S3_KEY`: AWS S3 访问密钥
- `S3_SECRET_KEY`: AWS S3 秘密密钥
- `S3_BUCKET`: S3 存储桶名称

### 4. 检查 AWS 身份
```bash
# 确认当前 AWS 账户
aws sts get-caller-identity

# 检查配置
aws configure list
```

## 环境变量安全方案

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

## 部署步骤

### 步骤 1: 部署 VPC 基础设施
```bash
cd xituan_agent/aws-setup

# 部署 VPC (包含 2 个公共子网，支持 RDS 多 AZ)
aws cloudformation deploy \
    --template-file vpc.yaml \
    --stack-name xituan-vpc-production \
    --parameter-overrides Environment=production \
    --capabilities CAPABILITY_IAM
```

### 步骤 2: 部署安全组
```bash
# 部署安全组 (ECS: 3050端口, RDS: 5432端口)
aws cloudformation deploy \
    --template-file security-groups.yaml \
    --stack-name xituan-security-groups-production \
    --parameter-overrides \
        Environment=production \
        VPCId=$(aws cloudformation describe-stacks --stack-name xituan-vpc-production --query 'Stacks[0].Outputs[?OutputKey==`VPCId`].OutputValue' --output text) \
    --capabilities CAPABILITY_IAM
```

### 步骤 3: 部署 RDS 数据库
```bash
# 部署 PostgreSQL 15.14 (单 AZ，双公共子网)
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
```

### 步骤 4: 部署 ECS 集群
```bash
# 部署 Fargate 集群
aws cloudformation deploy \
    --template-file ecs-cluster.yaml \
    --stack-name xituan-ecs-cluster-production \
    --parameter-overrides Environment=production \
    --capabilities CAPABILITY_IAM
```

### 步骤 5: 创建 ECR 仓库
```bash
# 创建后端镜像仓库
aws ecr create-repository \
    --repository-name xituan-backend \
    --region ap-southeast-2

# 获取 ECR 登录命令
aws ecr get-login-password --region ap-southeast-2 | docker login --username AWS --password-stdin $env:AWS_ACCOUNT_ID.dkr.ecr.ap-southeast-2.amazonaws.com
```

### 步骤 6: 构建和推送 Docker 镜像
```bash
# 构建后端镜像
cd ../../xituan_backend
docker build -t xituan-backend:latest .
docker tag xituan-backend:latest $env:AWS_ACCOUNT_ID.dkr.ecr.ap-southeast-2.amazonaws.com/xituan-backend:latest
docker push $env:AWS_ACCOUNT_ID.dkr.ecr.ap-southeast-2.amazonaws.com/xituan-backend:latest
```

### 步骤 7: 部署 ECS 服务
```bash
# 回到 aws-setup 目录
cd ../xituan_agent/aws-setup

# 部署后端服务
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
```

### 步骤 8: 验证部署
```bash
# 获取服务公网 IP
$TASK_ARN = aws ecs list-tasks --cluster xituan-cluster-production --service-name xituan-backend-service-production --query 'taskArns[0]' --output text
$ENI_ID = aws ecs describe-tasks --cluster xituan-cluster-production --tasks $TASK_ARN --query 'tasks[0].attachments[0].details[?name==`networkInterfaceId`].value' --output text
$PUBLIC_IP = aws ec2 describe-network-interfaces --network-interface-ids $ENI_ID --query 'NetworkInterfaces[0].Association.PublicIp' --output text

echo "Backend API endpoint: http://$PUBLIC_IP:3050"

# 测试后端 API
Invoke-WebRequest -Uri "http://$PUBLIC_IP:3050/health" -UseBasicParsing
```

## 常用管理命令

### 查看服务状态
```bash
# 查看 ECS 集群状态
aws ecs describe-clusters --clusters xituan-cluster-$ENVIRONMENT

# 查看服务状态
aws ecs describe-services \
    --cluster xituan-cluster-$ENVIRONMENT \
    --services xituan-backend-service-$ENVIRONMENT

# 查看任务状态
aws ecs list-tasks --cluster xituan-cluster-$ENVIRONMENT
```

### 更新服务
```bash
# 强制新部署
aws ecs update-service \
    --cluster xituan-cluster-$ENVIRONMENT \
    --service xituan-backend-service-$ENVIRONMENT \
    --force-new-deployment

# 更新任务定义
aws ecs update-service \
    --cluster xituan-cluster-$ENVIRONMENT \
    --service xituan-backend-service-$ENVIRONMENT \
    --task-definition xituan-backend-$ENVIRONMENT:NEW_REVISION
```

### 查看日志
```bash
# 查看后端日志
aws logs describe-log-streams \
    --log-group-name /ecs/xituan-backend-$ENVIRONMENT \
    --order-by LastEventTime \
    --descending
```

### 数据库迁移
```bash
# 运行数据库迁移
$TASK_ARN = aws ecs list-tasks --cluster xituan-cluster-production --service-name xituan-backend-service-production --query 'taskArns[0]' --output text

aws ecs execute-command \
    --cluster xituan-cluster-production \
    --task $TASK_ARN \
    --container backend \
    --interactive \
    --command "npm run migrate:prod"
```

## 清理资源
```bash
# 删除所有 CloudFormation 堆栈 (按依赖顺序)
aws cloudformation delete-stack --stack-name xituan-ecs-services-production
aws cloudformation delete-stack --stack-name xituan-ecs-cluster-production
aws cloudformation delete-stack --stack-name xituan-rds-production
aws cloudformation delete-stack --stack-name xituan-security-groups-production
aws cloudformation delete-stack --stack-name xituan-vpc-production

# 删除 ECR 仓库
aws ecr delete-repository --repository-name xituan-backend --force
```

## 故障排除

### 常见问题
1. **ECS 任务无法启动**: 检查安全组配置和子网设置
2. **数据库连接失败**: 验证 RDS 安全组和网络配置
3. **服务无法访问**: 检查公网 IP 和安全组规则
4. **镜像拉取失败**: 验证 ECR 权限和镜像标签
5. **YAML 编码问题**: 重新创建文件确保 UTF-8 编码
6. **PostgreSQL 版本问题**: 使用可用版本如 15.14
7. **密码格式问题**: 密码不能包含 @ 符号
8. **ECS 服务链接角色**: 创建服务链接角色或简化配置
9. **依赖删除问题**: 按正确顺序删除堆栈

### 调试命令
```bash
# 查看 ECS 任务详情
aws ecs describe-tasks \
    --cluster xituan-cluster-production \
    --tasks $(aws ecs list-tasks --cluster xituan-cluster-production --query 'taskArns[0]' --output text)

# 查看 CloudFormation 事件
aws cloudformation describe-stack-events --stack-name xituan-ecs-services-production

# 查看服务公网 IP
aws ecs describe-tasks \
    --cluster xituan-cluster-production \
    --tasks $(aws ecs list-tasks --cluster xituan-cluster-production --query 'taskArns[0]' --output text) \
    --query 'tasks[0].attachments[0].details[?name==`networkInterfaceId`].value' \
    --output text
```

## 成本优化说明

### 简化配置节省的成本
1. **移除 ALB**: 节省 ~$20/月
2. **移除 NAT Gateway**: 节省 ~$35/月
3. **单区域部署**: 节省跨 AZ 流量费用
4. **单 RDS 实例**: 节省 Multi-AZ 费用 (~$15/月)
5. **简化监控**: 关闭 Performance Insights 节省费用

### 预估月成本 (悉尼区域)
- **ECS Fargate**: ~$15-25/月 (1 个服务, 0.5 vCPU, 1GB RAM)
- **RDS PostgreSQL**: ~$15-25/月 (db.t3.micro, 单 AZ)
- **其他**: ~$5/月 (CloudWatch 等)

**总计**: 约 $35-55/月 (相比原方案节省约 $50-70/月)

## 🚀 GitHub Actions 集成

**触发条件**: 推送到 `production` 分支
**自动流程**:
1. 构建 Docker 镜像
2. 推送到 ECR
3. 更新 ECS 服务
4. 运行数据库迁移
5. 输出服务端点

**配置文件**: `xituan_backend/.github/workflows/deploy.yml`