# auspost-mypost-dual-track

Last updated: 2026-11-09

## 摘要

AusPost MyPost **CMS MVP**：CSV fallback + Partner API 国内出标（单订单 A）。**high / in_progress**。  
App 同构、OAuth/Pickup 已拆出独立 entry。

Cursor plan：`d:/projects/xituan_module/.cursor/plans_planned/csv_mode_retention_0ed474ac.plan.md`

相关：

- App MVP：[`./2026-11-auspost-mypost-app-mvp.md`](./2026-11-auspost-mypost-app-mvp.md)
- OAuth + Pickup：[`./2026-11-auspost-mypost-oauth-pickup.md`](./2026-11-auspost-mypost-oauth-pickup.md)
- Track 轮询：[`./2026-11-auspost-mpb-track-poll.md`](./2026-11-auspost-mpb-track-poll.md)（算法见 [`../../delivery/auspost-mpb-track-poll-design.md`](../../delivery/auspost-mpb-track-poll-design.md)）
- 统一定时任务：[`./2026-11-backend-internal-cron.md`](./2026-11-backend-internal-cron.md)（[`../../backend-internal-cron-design.md`](../../backend-internal-cron-design.md)）

## 当前掌握的信息

- 已落地：Core、连接表（无 50 分区）、CMS 连接卡、打包台未连 CSV/已连 API、`STORED_PAYMENT` 出标；testbed 连 Token + 出 PDF 已通。
- Flat-rate 箱勿传 weight/dims；`.env` 密码需 `\$` 防 dotenv-expand。
- **不做** S3 备份 PDF（AusPost 链接约 48h；超时回 MyPost 后台）。
- 微信一期仍 CSV；Charge Account 不做。

### 2026-11-09 拍板（报价 / 出标闸门）

| # | 决定 |
|---|------|
| 1 | 报价 UI：**打包台内嵌估价条**（非二次支付 Modal） |
| 2 | 估价失败 → **禁止出标**（估价与建单校验同源；失败仍硬出只会更容易扣款后退款） |
| 3 | 估价展示：**尽量详细**（各包裹 + 运费/税/合计，以 `prices/items` 返回为准） |
| 4 | **信息不足禁止出标**（如 OWN 缺重量/尺寸）；禁止默认猜 0.5kg |
| 5 | PDF layout：**打包台出标前可选 A4 / A6**（见下） |
| 6 | 先做完 **CMS MVP 加固 + 方案 B**，再交 Sign Off / Production Request |

**标签尺寸（已拍板）**

| UI 选项 | API `layout` | 文案说明 |
|---------|--------------|----------|
| **A6** | `A6-1pp` | 出标为 **A6 大小**（一页一标，适合热敏） |
| **A4** | `A4-4pp` | **A4 一页排 4 张**出标信息（非 A4-1pp 整页一标） |

- `Create Labels` 时带所选 layout；返回 URL 为该次固定 PDF。
- 确认出标请求需传 `label_layout`（或等价字段）→ Core preferences。
- **每次出标前可选**；默认：**本地缓存该商户最近一次选择**（无缓存则 A6）；不写服务端。
- 现状代码写死 `A4-1pp`，实现时改为上表映射。

## 期望目标结果

### 计划要做的（CMS MVP 仍缺）

- [x] **报价预览（方案 B）**：内嵌估价条；AP flat-rate 用费率表；OWN 用 `prices/items`；失败禁出标
- [x] **出标闸门**：OWN 强制重量+三边；无默认猜重
- [x] **失败回滚**：出标失败硬删本地 shipment + batch（`LABEL_UNAVAILABLE` 已扣款例外：保留 tracking）
- [x] **`needs_attention` 收窄**：仅 401/403/支付类文案
- [x] **labels 失败**：`AUSPOST_MPB_LABEL_UNAVAILABLE` + 引导 MPB
- [x] **错误码**：QUOTE / PAYMENT / LABEL_UNAVAILABLE / PACKAGING 等
- [x] **绑卡/扣款文案** + 打包台扣款说明
- [x] **标签 layout**：A6 / A4-4pp + 本地缓存最近选择
- [ ] **Sign Off 材料**：工作流/样例 JSON/标签 PDF/错误处理 → Production Request

### 已完成（CMS）

- [x] AuspostMpbShippingCore + Connection subject
- [x] skill `auspost-mpb-api-service`
- [x] CMS 贴 Token 连接 + organisations 校验
- [x] 打包台路径互斥 + API confirm 主链路
- [x] testbed 冒烟出标（flat-rate 修正后）

### 已拆走 / 触发后

- App MVP → `auspost-mypost-app-mvp`
- OAuth + Pickup → `auspost-mypost-oauth-pickup`
- UI 软弃用 CSV — 触发：商户已切 API 生产

## 触发条件 / 目标窗口

当前窗口先收齐上表「仍缺」再交 Sign Off；App / OAuth / Pickup 不挡 CMS 提交包。
