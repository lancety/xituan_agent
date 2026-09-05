# async-jobs-retention

Last updated: 2026-09-05

## 摘要

为 `platform.async_jobs` 增加终态行定期清理，避免队列表无限增长。  
**不是** post-deploy Phase N：C1 故意未上兼容债，只是功能尚未做到自动 purge。

## 当前掌握的信息

- 表：`platform.async_jobs`（migration `1710000000352_async_jobs.sql`）；已有索引 `(status, finished_at)`。
- C1 **已定不做**：Backend ECS `node-cron`（多实例各跑一份）、Platform 手动 purge API。
- 读图 / 业务不依赖历史 job 行（canonical 在业务表与 S3）。
- 现网其它 cron 仍在 ECS 进程内；以后应 **统一换调度**（EventBridge / 单 worker / 分布式锁等）再挂 retention。
- 框架文档：[async-lambda-jobs-framework.md](../../async-lambda-jobs-framework.md)

## 期望目标结果

- [ ] 终态自动清理：`SUCCEEDED` 超过约定天数、`FAILED`/`DEAD` 超过约定天数可 `DELETE`（批量 LIMIT）
- [ ] **不**删 `PENDING` / `RUNNING`
- [ ] 触发方式不依赖「每个 ECS 任务各跑一份 node-cron」
- [ ] 表行数长期可运维（远低于「百万无人管」风险）
- [ ] 本 entry → `done`，registry 归档

## 触发条件 / 目标窗口

任一生效即可启动实施：

1. Backend 定时任务已迁出「每实例 node-cron」的统一方案落地；或  
2. `async_jobs` 行数 / 表体积达到运维认为需要瘦表的量级。

## 实施备忘（可选草稿）

- 候选：EventBridge → Lambda/SQS → 调 Backend internal purge；或单 leader worker。  
- 默认天数草案（未定案）：SUCCEEDED 7 天；FAILED/DEAD 30 天。  
- 复用索引 `idx_async_jobs_status_finished`。
