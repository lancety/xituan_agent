# backend-internal-cron

Last updated: 2026-11-10

## 摘要

Backend **统一定时任务**：`/api/internal/cron/:jobName` + `INTERNAL_CRON_API_KEY`；prod EventBridge；dev/demo 本机 cron HTTP 自调；单飞锁 **DB 保底**；存量 ECS `node-cron` **第一期全迁** + 新增 `auspost-track-tick`。**high / planned**。

设计：[../../backend-internal-cron-design.md](../../backend-internal-cron-design.md)  
Skill：`.cursor/skills/backend-internal-cron/SKILL.md`  
关联业务：[./2026-11-auspost-mpb-track-poll.md](./2026-11-auspost-mpb-track-poll.md)、[./2026-09-async-jobs-retention.md](./2026-09-async-jobs-retention.md)  
Cursor plan：`d:/projects/xituan_module/.cursor/plans_planned/track_poll_decisions_e2a652db.plan.md`

## 期望目标结果

- [x] cron API 模块（验 key、DB 单飞、202、分发）— `src/shared/cron/*`；migration `1710000000408`
- [x] 迁移：5 个旧 cron 改为 registry handler；app 不再多 Task 各挂 node-cron；dev/demo `inprocessCronScheduler` HTTP 自调
- [x] 新增：`auspost-track-tick` 真逻辑（见 track-poll）
- [x] production：EB Rules + API Destinations + Connection（脚本 `aws-setup/scripts/setup-internal-cron-eventbridge.sh`；Connection=`xituan-internal-cron`；6 条 `xituan-cron-*` Rule ENABLED）
- [x] ECS task `:299` 已注入 `INTERNAL_CRON_API_KEY`（与 `.env.production` 对齐）
- [ ] **待部署**：含 `/api/internal/cron` 的 Backend 镜像上线后，EB 才不会落到 merchant middleware（现网仍 400 Merchant ID）
- [ ] **待跑 migration**：`0408` cron locks、`0409` track tables
- [x] production 不启 in-process；dev/demo 自调 + `publicApiBaseUtil`

## 触发条件 / 目标窗口

**high**；与 Track 轮询同窗口实施。
