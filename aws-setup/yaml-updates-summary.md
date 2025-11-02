# YAML 模板更新总结

## 📋 概述

本次更新将所有之前需要通过命令行手动执行的配置整合到 CloudFormation YAML 模板中，实现一次性部署。

---

## ✨ 新增文件

### 1. `ecr.yaml` - ECR Repository 自动创建

**之前**：需要手动运行 `aws ecr create-repository`  
**现在**：通过 CloudFormation 自动创建

**特性**：
- 自动创建 ECR repository
- 配置镜像扫描 (`ScanOnPush`)
- 自动生命周期策略（清理未标记镜像）
- 支持参数化配置（repository 名称、生命周期天数等）

**部署顺序**：在构建 Docker 镜像之前部署

```bash
aws cloudformation deploy \
    --template-file ecr.yaml \
    --stack-name xituan-ecr-production \
    --parameter-overrides Environment=production
```

---

## 🔧 更新的文件

### 2. `rds.yaml` - RDS 公网访问参数化

**之前**：需要手动修改 RDS 实例的 `PubliclyAccessible` 属性  
**现在**：通过参数 `EnablePublicAccess` 控制

**新增参数**：
- `EnablePublicAccess`: `true`/`false`（默认 `false`）
- `DBPassword`: 添加密码格式验证（禁止 `@`, `"`, `/`, 空格）

**使用场景**：
1. 初始部署时临时设为 `true` 进行数据导入
2. 导入完成后更新为 `false` 关闭公网访问

**部署示例**：
```bash
# 临时开启公网访问
aws cloudformation deploy ... --parameter-overrides EnablePublicAccess=true

# 数据导入后关闭
aws cloudformation deploy ... --parameter-overrides EnablePublicAccess=false
```

**输出增强**：添加 `PostDeploymentSteps` 输出，提示安全加固步骤

---

### 3. `security-groups.yaml` - ALB 安全组必需配置

**要求**：`ALBSecurityGroupId` 是必需参数，ALB 必须在安全组之前部署

**配置**：
- ECS 安全组只允许来自 ALB 安全组的 3050 端口访问
- 确保 ECS 服务不会暴露到公网，只能通过 ALB 访问

**部署流程**：
1. 先部署 ALB（获取 ALBSecurityGroupId）
2. 部署安全组，传入 `ALBSecurityGroupId`

---

### 4. `ecs-services.yaml` - 环境变量和 ALB 集成（必需）

**要求**：`BackendTargetGroupArn` 是必需参数，ALB 必须在 ECS 服务之前部署

**新增参数**：
- `CORSOrigin`: CORS 允许的源（默认 `https://www.xituan.com`）
- `LogLevel`: 日志级别（默认 `warn`，可选：`debug`, `info`, `warn`, `error`）
- `SentryEnabled`: 是否启用 Sentry（默认 `true`）

**改进**：
- `SENTRY_ENVIRONMENT`: 使用 `!Ref Environment` 而不是硬编码 `production`
- `S3_REGION`: 使用 `!Ref AWS::Region` 自动适配当前区域
- `LoadBalancers`: 始终配置，直接附加到 ALB Target Group
- 添加 `PostDeploymentSteps` 输出，提供后续步骤指导（包括 Route53 DNS 配置）

**部署要求**：
- ALB 必须在 ECS 服务之前部署
- 部署 ECS 服务时必须提供有效的 `BackendTargetGroupArn`

---

## 📊 部署顺序建议

### 使用统一参数文件部署（推荐）

**新功能**：现在可以使用统一的参数文件来集中管理所有配置：

```bash
# 1. 复制示例参数文件
cp parameters.production.example.json parameters.production.json

# 2. 编辑参数文件，填入实际值（数据库密码、ACM 证书 ARN 等）
# 注意：parameters.production.json 应加入 .gitignore（包含敏感信息）

# 3. 使用自动部署脚本（一次性部署所有资源）
./deploy-with-parameters.sh production
```

**参数文件包含的配置**：
- ✅ 环境配置（Environment, AWSRegion, ProjectName）
- ✅ 数据库配置（DBPassword, DBUsername, DBInstanceClass）
- ✅ ALB 配置（ACMCertificateArn）
- ✅ 应用配置（CORSOrigin, LogLevel, SentryEnabled）

详细说明请参考：`README-PARAMETERS.md`

---

### 手动部署流程（ALB 必需）

```bash
# 1. VPC 基础设施
aws cloudformation deploy --template-file vpc.yaml --stack-name xituan-vpc-production

# 2. ECR Repository
aws cloudformation deploy --template-file ecr.yaml --stack-name xituan-ecr-production

# 3. 部署 ALB（必须在安全组之前）
aws cloudformation deploy --template-file alb.yaml \
    --stack-name xituan-alb-production \
    --parameter-overrides \
        Environment=production \
        VPCId=$(aws cloudformation describe-stacks --stack-name xituan-vpc-production --query 'Stacks[0].Outputs[?OutputKey==`VPCId`].OutputValue' --output text) \
        PublicSubnetId=$(aws cloudformation describe-stacks --stack-name xituan-vpc-production --query 'Stacks[0].Outputs[?OutputKey==`PublicSubnetId`].OutputValue' --output text) \
        PublicSubnet2Id=$(aws cloudformation describe-stacks --stack-name xituan-vpc-production --query 'Stacks[0].Outputs[?OutputKey==`PublicSubnet2Id`].OutputValue' --output text) \
        ACMCertificateArn=arn:aws:acm:ap-southeast-2:594332420383:certificate/5a268437-8612-4ce1-aa56-d6f0d98b2aea

# 4. 安全组（需要 ALBSecurityGroupId）
aws cloudformation deploy --template-file security-groups.yaml \
    --stack-name xituan-security-groups-production \
    --parameter-overrides \
        Environment=production \
        VPCId=$(aws cloudformation describe-stacks --stack-name xituan-vpc-production --query 'Stacks[0].Outputs[?OutputKey==`VPCId`].OutputValue' --output text) \
        ALBSecurityGroupId=$(aws cloudformation describe-stacks --stack-name xituan-alb-production --query 'Stacks[0].Outputs[?OutputKey==`ALBSecurityGroupId`].OutputValue' --output text)

# 5. RDS（临时开启公网访问）
aws cloudformation deploy --template-file rds.yaml \
    --stack-name xituan-rds-production \
    --parameter-overrides \
        Environment=production \
        EnablePublicAccess=true \
        ...

# 6. ECS 集群
aws cloudformation deploy --template-file ecs-cluster.yaml --stack-name xituan-ecs-cluster-production

# 7. ECS 服务（需要 BackendTargetGroupArn）
aws cloudformation deploy --template-file ecs-services.yaml \
    --stack-name xituan-ecs-services-production \
    --parameter-overrides \
        Environment=production \
        ECSClusterName=$(aws cloudformation describe-stacks ...) \
        ECSSecurityGroupId=$(aws cloudformation describe-stacks ...) \
        BackendTargetGroupArn=$(aws cloudformation describe-stacks --stack-name xituan-alb-production --query 'Stacks[0].Outputs[?OutputKey==`BackendTargetGroupArn`].OutputValue' --output text) \
        ...

# 8. 数据导入到 RDS...

# 9. 关闭 RDS 公网访问
aws cloudformation deploy --template-file rds.yaml \
    --stack-name xituan-rds-production \
    --parameter-overrides \
        EnablePublicAccess=false \
        ...

# 10. 配置 Route53 DNS 指向 ALB DNS 名称
```

---

## 🔍 关键改进点

### 1. 消除手动步骤
- ✅ ECR repository 创建 → CloudFormation
- ✅ RDS 公网访问切换 → 参数化
- ✅ ALB 必需集成（确保安全访问）

### 2. 明确架构要求
- ✅ ALB 必需（ECS 服务只能通过 ALB 访问）
- ✅ 环境变量参数化（支持不同环境配置）
- ✅ 区域自动适配（S3_REGION, AWS::Region）

### 3. 增强验证
- ✅ 密码格式验证（防止无效密码）
- ✅ 参数值验证（AllowedValues, ConstraintDescription）
- ✅ 部署步骤提示（PostDeploymentSteps 输出）

### 4. 明确的部署顺序
- ✅ ALB 必须在安全组和 ECS 服务之前部署
- ✅ 所有资源配置都要求 ALB 存在
- ✅ 确保 ECS 服务只能通过 ALB 访问（安全隔离）

---

## 📝 注意事项

### 密码限制
RDS 密码不能包含以下字符：
- `@`
- `"`
- `/`
- 空格

模板已添加 `AllowedPattern` 验证。

### 部署顺序（重要）
**ALB 是必需的**，部署顺序必须遵循：
1. VPC → ECR → **ALB** → 安全组 → RDS → ECS 集群 → ECS 服务
2. ALB 必须在安全组和 ECS 服务之前部署（提供安全组 ID 和目标组 ARN）
3. 数据导入完成后立即关闭 RDS 公网访问
4. 配置 Route53 DNS 指向 ALB DNS 名称

### ALB 必需要求
⚠️ **重要变更**：ALB 现在是架构必需组件：
- `ALBSecurityGroupId` 和 `BackendTargetGroupArn` 都是必需参数
- 不支持无 ALB 的部署方式
- 确保 ECS 服务完全通过 ALB 访问，提供安全隔离

---

## 🚀 下一步建议

1. **测试新模板**：在测试环境验证完整部署流程
2. **更新文档**：更新 `aws-deployment-ai-auto.md` 反映新的部署步骤
3. **CI/CD 集成**：在 GitHub Actions 中使用新的参数化配置
4. **监控和告警**：考虑添加 CloudWatch 告警（参考 `yaml-improvements.md`）

---

## 📚 相关文档

- `aws-deployment-ai-auto.md`: 完整部署指南
- `yaml-improvements.md`: 未来改进建议
- AWS CloudFormation 最佳实践: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/best-practices.html

