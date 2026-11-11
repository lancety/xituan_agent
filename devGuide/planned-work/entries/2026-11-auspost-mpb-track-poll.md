# auspost-mpb-track-poll

Last updated: 2026-11-11

## 摘要

MyPost **Track Items 轮询** + 挂载 **统一定时任务框架**（`auspost-track-tick`）。  
ETA/前 4h 调度；Q=90 匀速；游标仅活跃、快照 28 天；不用 50 分区；CSV 有号也入池。**high**；代码与 demo 已验，生产 DDL/镜像待窗口。

父项：[./2026-11-auspost-mypost-dual-track.md](./2026-11-auspost-mypost-dual-track.md)  
算法：[../../delivery/auspost-mpb-track-poll-design.md](../../delivery/auspost-mpb-track-poll-design.md)  
定时框架：[../../backend-internal-cron-design.md](../../backend-internal-cron-design.md)  
相关 plan（已完成）：`.cursor/plans_completed/payment_void_track_sync_c9946c62.plan.md`、`track_poll_decisions_e2a652db.plan.md`

## 当前掌握的信息

- 触发：prod = EventBridge → `/api/internal/cron/auspost-track-tick`；dev/demo = 本机 cron 带 `INTERNAL_CRON_API_KEY` 自调。
- 单飞锁保底 **DB**；表不用 50 分区。
- 与统一 cron 第一期「全做」一起落地（存量 cron 同迁）。
- **2026-11-11 demo 验收（与 void/capture 同批）**：
  - 履约态前进 deferred capture：只扣最新 PI，成功后作废其余；新授权挤掉旧 uncaptured
  - Carrier Delivered → shipment DELIVERED；全票送达且无未打包 → 订单 DELIVERED
  - 异常终态（含 undeliverable / Lost / damaged / Return to sender）→ 保持 IN_DELIVERY + 顾客/商家 email&app 警告；轨迹更新仍仅 app

## 期望目标结果

### 计划要做的

- [x] 游标 + 事件快照 DDL（非分区）；出标/CSV 回填写入游标 — migration `0409`
- [x] Track tick service：ETA 阶梯、stretch、匀速 Track、终态删游标、推送
- [x] 注册 `auspost-track-tick` 到 internal cron；prod EB Rule 已建
- [x] 内部物流读接口（不依赖 Partner）；订单详情不拉轨迹
- [x] 商户：查看包裹 Modal → **打开时一次**拉各包裹物流（下方展示）
- [x] 客户：包裹列表 → **点击包裹**再拉该包裹物流
- [x] 全端：物流本地缓存 28 天；先本地后拉服务器增量合并（SWR）
- [x] Delivered / 异常终态与订单同步、异常双通道通知（demo 已验）
- [ ] Quota 健康度指标（后续）
- [ ] 生产：跑 `0408`/`0409` + 部署含 cron 的 Backend 镜像

### 触发后才做的

- [ ] MPB 提额 — 持续打满 Q
- [ ] 商户「已在 MPB 退款」本地作废 — 另项

## 触发条件 / 目标窗口

生产发版窗口：确认 migration + backend 镜像；与 Sign Off / production MPB key 独立，可并行排期。
