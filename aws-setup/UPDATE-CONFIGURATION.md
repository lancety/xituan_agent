# 更新配置说明 - CloudFormation 对 ECS 的影响

## 📋 概述

当你更新 `parameters.production.json` 并运行部署脚本时，CloudFormation 会更新相关资源。本文档说明不同配置变更对 ECS 服务的影响。

---

## 🔄 更新流程

```bash
# 1. 更新参数文件
# 编辑 parameters.production.json，修改需要更新的值

# 2. 运行部署脚本（只更新相关堆栈）
./deploy-with-parameters.sh production
```

**关键点**：
- ✅ 部署脚本会检测堆栈变化，只更新有变更的堆栈
- ✅ ECS 相关变更会触发任务定义更新和服务滚动部署
- ✅ **容器内容是 ECR 镜像，不是"挂载"的**（详见下方说明）

---

## 📊 不同配置变更的影响

### 1. **ECS 硬件配置变更**（CPU/Memory）

**示例**：将 `FargateCpu` 从 `512` 改为 `1024`

**发生什么**：
1. CloudFormation 创建新的**任务定义 revision**（任务定义不可变）
2. ECS 服务检测到新任务定义
3. **滚动更新开始**：
   - 启动新容器（使用新硬件：1 vCPU + 2 GB）
   - 等待新容器健康检查通过
   - 停止旧容器（0.5 vCPU + 1 GB）

**时间**：约 2-5 分钟（取决于应用启动时间）

**影响**：
- ✅ **零停机**（如果配置了健康检查和滚动更新）
- ✅ **应用代码不变**（使用相同的 ECR 镜像）
- ⚠️ **短暂的服务中断**（如果只有一个实例）
- ✅ **自动回滚**（如果新容器持续失败，Circuit Breaker 会回滚）

---

### 2. **环境变量变更**（DBPassword, CORSOrigin, LogLevel 等）

**示例**：更新 `DBPassword` 或 `CORSOrigin`

**发生什么**：
1. 创建新的任务定义 revision（包含新的环境变量）
2. ECS 服务滚动更新
3. 新容器启动时使用新的环境变量
4. **应用需要重启**才能使用新配置

**影响**：
- ✅ 配置立即生效（新容器使用新值）
- ⚠️ 需要应用支持环境变量热更新（部分应用需要重启）
- ✅ Node.js 应用通常需要重启才能读取新的环境变量

---

### 3. **RDS 配置变更**（DBInstanceClass, DBAllocatedStorage）

**示例**：将 `DBInstanceClass` 从 `db.t3.micro` 改为 `db.t3.small`

**发生什么**：
1. RDS 实例**修改类型**（modify）
2. **RDS 重启**（约 5-10 分钟）
3. 数据库连接短暂中断
4. ECS 容器会自动重连（如果应用有重试机制）

**影响**：
- ⚠️ **RDS 短暂不可用**（5-10 分钟）
- ⚠️ **ECS 服务可能受影响**（如果数据库连接中断）
- ✅ **容器和数据都不变**（只是硬件升级）

---

### 4. **ALB 配置变更**（ACMCertificateArn）

**示例**：更新 ACM 证书 ARN

**发生什么**：
1. ALB HTTPS 监听器更新证书
2. **不影响 ECS 服务**（ALB 是外部负载均衡器）
3. 可能有几秒钟的证书切换

**影响**：
- ✅ **零影响**ECS 容器
- ✅ 更新完成即可

---

## 🎯 关键概念说明

### ❌ **不是"挂载"概念**

ECS Fargate 使用**容器镜像**，不是"挂载硬盘"：

```
容器启动流程：
1. ECS 从 ECR 拉取 Docker 镜像
2. 创建新的容器实例（基于镜像）
3. 应用代码在容器内部运行
4. 容器停止后，所有内容都消失（除了日志）

❌ 不是：
[旧硬盘] --挂载--> [新容器]

✅ 实际是：
[ECR 镜像] --> [新容器实例] --> [运行应用]
[旧容器] --> [停止并删除]
```

### ✅ **滚动更新机制**

根据 `ecs-services.yaml` 中的配置：

```yaml
DeploymentConfiguration:
  MaximumPercent: 200        # 最多 200% 任务（如 DesiredCount=1，最多 2 个）
  MinimumHealthyPercent: 50  # 至少 50% 健康（如 DesiredCount=1，至少 1 个）
  DeploymentCircuitBreaker:
    Enable: true
    Rollback: true            # 失败自动回滚
```

**滚动更新过程**（DesiredCount=1）：
1. 启动新任务（总数 = 2，超过 DesiredCount=1）
2. 等待新任务健康检查通过
3. 停止旧任务（总数 = 1）
4. 更新完成

---

## ⚠️ 注意事项

### 1. **CPU/Memory 变更不会改变应用代码**

- 容器镜像来自 ECR（需要单独更新）
- 更新硬件配置 ≠ 更新应用代码
- 要更新应用代码，需要：
  ```bash
  # 1. 构建新镜像
  docker build -t xituan-backend:new-version .
  
  # 2. 推送到 ECR
  docker push <ECR_URI>:new-version
  
  # 3. 更新 ECS 任务定义中的镜像标签
  # （通过 GitHub Actions 或手动更新）
  ```

### 2. **环境变量变更需要应用重启**

- Node.js 应用在启动时读取环境变量
- 变更环境变量后，容器会自动重启
- 部分应用支持热更新（通过信号或 API），但大部分需要重启

### 3. **数据库配置变更需要计划停机**

- RDS 类型变更需要重启实例
- 建议在低峰期进行
- 提前通知用户（如果有 SLA 要求）

---

## 📋 最佳实践

### 更新硬件配置（CPU/Memory）

```bash
# 1. 更新参数文件
# FargateCpu: "512" -> "1024"
# FargateMemory: "1024" -> "2048"

# 2. 运行部署（只更新 ecs-services 堆栈）
./deploy-with-parameters.sh production

# 3. 监控 CloudWatch Logs
aws logs tail /ecs/xituan-backend-production --follow
```

### 更新应用代码（需要额外步骤）

```bash
# 1. 更新参数文件（如果需要）
# （例如：更新 CORSOrigin, LogLevel 等）

# 2. 部署基础设施（如果参数文件有变更）
./deploy-with-parameters.sh production

# 3. 单独更新应用代码（不在部署脚本中）
cd ../../xituan_backend
docker build -t xituan-backend:latest .
docker tag xituan-backend:latest <ECR_URI>:latest
docker push <ECR_URI>:latest

# 4. 强制 ECS 服务使用新镜像（通过 GitHub Actions 或手动）
aws ecs update-service \
    --cluster xituan-cluster-production \
    --service xituan-backend-service-production \
    --force-new-deployment
```

---

## 🔍 如何检查更新状态

```bash
# 检查 ECS 服务状态
aws ecs describe-services \
    --cluster xituan-cluster-production \
    --services xituan-backend-service-production \
    --query 'services[0].{Status:status,RunningCount:runningCount,DesiredCount:desiredCount,Deployments:deployments}'

# 检查任务定义版本
aws ecs describe-task-definition \
    --task-definition xituan-backend-production \
    --query 'taskDefinition.{Revision:revision,Cpu:cpu,Memory:memory}'

# 检查 CloudFormation 堆栈状态
aws cloudformation describe-stacks \
    --stack-name xituan-ecs-services-production \
    --query 'Stacks[0].StackStatus'
```

---

## 📚 总结

| 配置类型 | 是否影响 ECS | 是否需要重启 | 影响范围 |
|---------|-------------|--------------|---------|
| FargateCpu/Memory | ✅ 是 | ✅ 是（滚动更新） | 零停机 |
| 环境变量 | ✅ 是 | ✅ 是（自动重启） | 零停机 |
| DBInstanceClass | ⚠️ 间接 | ⚠️ 间接（RDS 重启） | 5-10 分钟停机 |
| ALB 证书 | ❌ 否 | ❌ 否 | 零影响 |
| **应用代码（ECR 镜像）** | ⚠️ 需要单独更新 | ✅ 是 | 零停机 |

---

## 💡 关键要点

1. ✅ **更新参数文件 + 运行部署脚本** = 更新基础设施配置（CPU、Memory、环境变量等）
2. ⚠️ **应用代码更新** = 需要单独构建和推送 Docker 镜像
3. ✅ **硬件配置变更** = 容器会重新创建（使用相同的镜像），不是"挂载"
4. ✅ **滚动更新机制** = 确保零停机（在配置正确的情况下）

