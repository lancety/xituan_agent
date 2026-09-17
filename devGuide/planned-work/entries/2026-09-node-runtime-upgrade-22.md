# node-runtime-upgrade-22

Last updated: 2026-09-17

## 摘要

全平台 Node 运行时从 **20** 升级到 **22 LTS**（本机、Backend ECS 镜像、相关 Lambda），消掉 AWS SDK「≥22」警告，并结束 Node 20 上游/Lambda 安全补丁断档。  
**不是** post-deploy Phase N：尚未实施的规划升级，无已上线兼容债要收。

## 当前掌握的信息

- 本机 / 开发：Node **v20.19.0**；`@aws-sdk/*` 已提示 2027-01 后新版本要求 Node ≥22。
- Backend：`xituan_backend/Dockerfile` → `FROM node:20-alpine`；`package.json` `engines.node` ≥20。
- Lambda（示例）：
  - `xituan_agent/aws-setup/08_async_image_jobs.yaml` → `nodejs20.x`
  - `xituan_agent/aws-setup/09_expense_receipt_ocr_jobs.yaml` → `nodejs20.x`
  - SIH CloudFormation（demo）部分仍为 `nodejs20.x`，少量已是 `nodejs22.x`
- ECS/Fargate 自管容器镜像；Lambda 用托管 runtime 标识，两端需**同批或紧随**对齐。
- Node 上游：20 已 EOL（约 2026-04-30）；22 安全维护至约 2027-04；24 至约 2028-04。
- **已定目标版本（本期）：Node 22 LTS**（最新 22.x patch）。暂不跳 24，避免与现有部分 `nodejs22.x` Lambda / CI 再分叉；若以后要更长跑道可另开 entry 升 24。
- Expo / RN App、微信小程序 **不在**本次范围（不跑后端 Node）。

## 期望目标结果

- [ ] 开发机与 CI 使用 Node **22.x**；`node -v` / CI matrix 一致
- [ ] `xituan_backend`：`Dockerfile` → `node:22-alpine`；`engines` → `>=22`
- [ ] Backend 本地：`npm ci`、`tsc_lint`、核心 API / 推送 SNS 冒烟通过
- [ ] 生产 Backend ECS 镜像已切 22 并滚动发布成功
- [ ] 所有仍用 `nodejs20.x` 的 Lambda / CFN / SAM 模板改为 `nodejs22.x`（含 image jobs、OCR、SIH 等）并完成各环境部署
- [ ] 终端不再出现 AWS SDK NodeVersionSupportWarning（本机跑 SDK 调用路径）
- [ ] 本 entry → `done`，registry 归档

## 触发条件 / 目标窗口

建议在以下任一窗口安排（越早越好）：

1. 下次 Backend 常规发版窗口；或  
2. 计划升级 `@aws-sdk/*` 大版本之前；或  
3. Lambda / 安全审计要求退出 `nodejs20.x` 时。

**刻意不做：** 仅为消除 warning 当天无回归地大爆炸升 24；不混升「部分 ECS 22 + 大量 Lambda 仍 20」长期双轨。

## 实施备忘（可选草稿）

### 推荐顺序

1. 本机装 Node 22 → Backend `npm ci` → `tsc_lint` + 烟测  
2. 改 `Dockerfile` + `engines` → 构建镜像 → staging/demo → production  
3. 改 aws-setup / CFN 中全部 `nodejs20.x` → `nodejs22.x` → 按环境更新 Lambda  
4. 扫其它 repo（若有 Node 服务脚本、CI `setup-node`）一并改 22  

### 风险核对（升级时复查）

| 项 | 注意 |
|----|------|
| native 模块 | `bcrypt` 等需在 22 下重装；Docker 多阶段 build 勿缓存旧 `.node` |
| OpenSSL / undici | 关注 HTTPS、fetch、代理相关回归 |
| Lambda | runtime 与 handler 依赖版本；冷启动体积可略变 |
| 锁文件 | 尽量同一 Node 主版本生成 `package-lock` |

### 相关路径

- `xituan_backend/Dockerfile`
- `xituan_backend/package.json` → `engines`
- `xituan_agent/aws-setup/08_async_image_jobs.yaml`
- `xituan_agent/aws-setup/09_expense_receipt_ocr_jobs.yaml`
- `xituan_agent/aws-setup/demo/demo-sih-v7*.template.json`

## 相关文档

- [planned-work README](../README.md)
- [async-lambda-jobs-framework](../../async-lambda-jobs-framework.md)
