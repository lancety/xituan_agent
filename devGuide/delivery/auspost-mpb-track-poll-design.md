# AusPost MPB Track 轮询设计

Last updated: 2026-11-10 (impl in progress: cron+tick+push+read APIs+CMS/Site/Customer/WeChat/Merchant App UI; EB prod rules + run migrations 0408/0409 pending)

## 目标

- Backend **独占**打 AusPost Track；CMS/App/Site/微信 **只读内部**包裹/物流快照（与商户是否绑 Partner **无关**——只要包裹有 `tracking_number` / 已有快照即可展示）。
- 调度挂在统一定时任务框架：`auspost-track-tick`（见 [backend-internal-cron-design.md](../backend-internal-cron-design.md)）。
- 间隔由 **前 4h 规则 + ETA/普特快** 决定；越近预估送达越密；压力下 **stretch** 拉长间隔守住限额。
- **客户端按需拉物流**（对齐多数电商平台）：订单详情页**不**自动拉物流态；点进包裹再读内部物流接口。
## 限流

| 项 | 值 |
|----|-----|
| 接口 | `GET /track?tracking_ids=` |
| 凭证 | 平台 API Key **共桶** |
| 公开 | ~10 req/min × 最多 10 IDs |
| **Q** | **90** 运单号/分钟（≈9 次请求，留 1 次余量） |
| 发速 | **匀速**约每 6–7 秒一次 Track（在 ECS 进程内控速） |

触发：production 由 EventBridge **每分钟**敲 `POST /api/internal/cron/auspost-track-tick`（快 ACK）；dev/demo 本机 cron 带 `INTERNAL_CRON_API_KEY` 调同一接口。

## 入池

- 有 `tracking_number` 的 AusPost 包裹（**api 出标或 CSV 回填**）都进游标。
- **不要求**商户已绑 Partner；落地验证平台 Key / 平台自有 token 头能否 Track。

## 间隔算法

### 出标后前 4 小时

- 默认约第 1/2/3/4 小时各查；首查 `label_booked_at + 1h`。
- 早期窗口内已有 **≥3** 条物流事件 → **跳过第 2、3 小时**，满 4h 再查，之后走 ETA 阶梯。

### ETA

| 类型 | eta_days |
|------|----------|
| 普通 PP | 默认 **3** |
| 特快 EXP | **1–2**（`auspost-transit-estimate.util`；无邮编保守 2） |

国内 ETA **不靠** MPB `prices/items`（`estimated_delivery` 仅国际）。

### remaining → 基础间隔（age ≥ 4h）

硬范围 **[10 min, 4 h]**：

| remaining | 间隔 |
|-----------|------|
| > 48h | 4 h |
| 24–48h | 2 h |
| 12–24h | 1 h |
| 6–12h | 40 min |
| 0–6h | 20 min |
| 逾期 | 10 min |

**已废弃**：纯龄期升频主驱动；5↔15 交替。

### 压力 stretch

`load = Σ(N_i / T_i)`，`stretch = max(1, load/Q)`，`effective = min(4h, base * stretch)`。只拉长不压低档位相对疏密。

### Worker 两阶段

1. 票选 `next_poll_at <= now`（最多 Q）  
2. 顺序每 **10** 个打 Track（与间隔无关，可混装）

## 终态（删游标、停轮询）

官方 Article：**Delivered** / **Cancelled** / **Cannot be delivered**。  
退回无单独 status → Cannot be delivered + event 文案补充。  
非终态含 In transit、Awaiting collection、Article damaged 等（详见 statuses 页）。

## 推送

- 买家：物流任意更新即推。  
- 商户：仅送达或其他终态。

## 存储

| 层 | 生命周期 |
|----|----------|
| 游标表 | **仅活跃**；终态立刻删 |
| 事件快照 | 终态起 **28 天**清 |
| shipments | 业务主数据；可反规范化展示字段 |

**不用** HASH 50 分区。排期字段以游标为准。

## Quota 健康度

分档在途、`load`/`stretch`、欠账、429；用于预警。

## 容量粗算（Q=90）

- 全 10m 档约 **900** 件（stretch=1）。  
- 健康履约约日均 **~2.8k** / 在途 **~5.3k** 打满额度；更高靠 stretch。

## 前端展示约定（商户 / 客户）

数据源：内部 API（游标 status + 事件快照），**禁止**端上直打 AusPost；**不依赖** Partner 连接状态。

| 端 | 订单详情 | 包裹入口 | 物流时间线 |
|----|----------|----------|------------|
| **商户**（CMS / Merchant App） | 只展示订单与打包动作；**不**在进详情时拉物流 | 打包按钮组 → **查看包裹** → 包裹详情 Modal | **打开 Modal 时一次**请求 Modal 内各包裹物流；每包裹下方展示 |
| **客户**（Site / 微信 / Customer App） | 可拉**包裹列表**（无事件） | **点击某一包裹**进入查看 | **仅此时**拉该包裹内部物流详情 |

**客户端本地缓存（28 天）**：物流为服务端增量更新。端上可按 `shipmentId` 缓存轨迹 **最多 28 天**（与快照清理对齐）。打开/查看时：**先渲染本地缓存**，同时请求内部 API，用返回增量**合并更新**本地缓存再刷新 UI（stale-while-revalidate）。无缓存则只等网络。

原则：订单详情不刷轨迹；Worker 后台写库；UI 延后读 + 本地缓存减重复拉取。全端（CMS / Merchant App / Site / 微信 / Customer App）同一契约。
## 非目标

- Track 同步支付退款（无退款状态码）。  
- 本期不突破公开限流（提额另议）。  
- 订单详情首屏批量拉全部包裹轨迹。

## 相关

- 定时框架：[../backend-internal-cron-design.md](../backend-internal-cron-design.md)
- planned-work：`auspost-mpb-track-poll`、父项 `auspost-mypost-dual-track`
- Skill：`.cursor/skills/backend-internal-cron/SKILL.md`、`.cursor/skills/auspost-mpb-api-service/SKILL.md`
