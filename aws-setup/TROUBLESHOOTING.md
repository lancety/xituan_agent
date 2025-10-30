# 故障排除（精简版）

## 数据库 SSL / 认证
- 错误：self-signed certificate / no pg_hba.conf entry no encryption
- 处理：DATABASE_URL 加 ?sslmode=require；NODE_TLS_REJECT_UNAUTHORIZED=0（迁移时）；TypeORM 配置 ssl.rejectUnauthorized=false

## 任务失败回滚（Circuit Breaker）
- 原因：环境变量错误/数据库未就绪
- 处理：修复后注册新 TaskDefinition，更新服务，增加 HealthCheckGracePeriodSeconds

## 版本不匹配（pg_dump/pg_restore）
- 处理：使用 postgres:17 容器进行导出/导入

## 缺少 pgcrypto 扩展
- 错误：function digest(text, unknown) does not exist
- 处理：迁移包含 CREATE EXTENSION IF NOT EXISTS pgcrypto;

## IAM 角色无法被 ECS 假设
- 处理：任务定义使用 CloudFormation 输出的角色 ARN

## SubnetId cannot be empty / array items are not unique
- 处理：正确传递来自 VPC 堆栈的两个唯一子网 ID

## ECS Exec: TargetNotConnectedException
- 原因：任务未与 SSM 建立通道或 Exec 未启用/权限不足
- 处理：
  - 模板中开启 `EnableExecuteCommand: true`（已默认）
  - 给任务角色添加 `ssmmessages:*Channel` 四项权限（已默认）
  - 部署后强制新部署并等待：
    ```bash
    aws ecs update-service --cluster <cluster> --service <service> --enable-execute-command --force-new-deployment
    aws ecs wait services-stable --cluster <cluster> --services <service>
    sleep 10
    ```
  - 仍异常时，用一次性任务跑迁移：
    ```bash
    aws ecs run-task --cluster <cluster> --launch-type FARGATE \
      --task-definition xituan-backend-production:<REV> \
      --network-configuration "awsvpcConfiguration={subnets=[<SubnetId>],securityGroups=[<ECSSG>],assignPublicIp=ENABLED}" \
      --overrides '{"containerOverrides":[{"name":"backend","command":["npm","run","migrate:prod"]}]}'
    ```

## 私有子模块 404（submodule clone failed）
- 原因：`GITHUB_TOKEN` 无法访问私有子模块
- 处理：
  - 使用 PAT（`GH_TOKEN`）并赋予 `repo` 读取权限；PAT 账号需对子模块仓库有访问权
  - workflow 的 checkout 步骤使用：
    ```yaml
    - uses: actions/checkout@v4
      with:
        submodules: recursive
        token: ${{ secrets.GH_TOKEN }}
    ```
