# gst-effective-date-cutover

Last updated: 2026-10-30

## 摘要

**仅规划台账（todo），当前不实施。**  
ATO 确认 GST **生效日 D** 后，再对 **业务日 ≥ D** 做收支补拆 / 必要时重算合作票与 PDF。  
权威说明：[`devGuide/gst/gst-effective-date-cutover.md`](../../gst/gst-effective-date-cutover.md)。

## 未决 / 待标（决定不了先挂着）

| 项 | 状态 | 说明 |
|----|------|------|
| 生效日 **D** | **未决** | 尚未拿到 ATO 确认日期 |
| 先跑哪家 `merchant_id` | **未决** | 等 D 后再定（多租户或只 Galaxy） |
| FY 纠错 migrate 是否在 D 前跑 | **未决** | SQL 已写好；须另批批准，可与切齐分开 |
| 合作票 WP-D TS 重算脚本 | **未写** | 有 D + preview 有候选后再实现；禁止手改 JSONB |
| 价内是否变更 | **暂定价内** | 现网默认；若 ATO/产品改价外再改说明书 |

## 当前掌握的信息

| 项 | 内容 |
|----|------|
| 判定 | `gstRegistrationUtil.isRegisteredOnDate`；`eventDate >= D` 才计 GST |
| 价内默认 | total/实付不改，只拆 gst/net；退款保留负号 |
| WP-0 代码 | 未注册强制 gst=0 等 — **已完成** |
| FY 纠错 SQL | `gst-unregister-fy2025-revenues-expenses` — 已写，**未批准不跑** |
| D 切齐 SQL | `gst-effective-date-revenues-expenses`（`__GST_D__` 占位）— 已写，**未批准不跑** |
| development 抽查 | 商户 finance.gst 均为 `isRegistered: false`，无 `registrationDate` |
| 与手续费 | 完全分开（`stripe_fee_auto_expense`） |

### 明确不做（本 entry）

- 在拿到 D 之前做 Gate / 批量切齐  
- `业务日 < D` 强行改含税  
- 手续费 / OmiPay / 站内提现  
- 未批准生产 SQL  

## 期望目标结果

### 现在（不依赖 D）— 文档与 SQL 草稿

- [x] 说明书 + 本 entry + registry  
- [x] D 切齐 data-repair job（占位，不跑）  
- [ ] （可选）FY 纠错 migrate — **未决是否现在批**  

### 有 D 之后才做

| 项 | 触发 |
|----|------|
| 填上表「未决」中的 D / merchant | ATO 确认 D |
| Gate：`isRegistered` + `registrationDate=D` | 同上 |
| 替换 `__GST_D__` → preview →（批准后）migrate 收支 | Gate + 批准 |
| WP-D 票脚本 + PDF | preview 有候选 + 批准 |
| 验收 → entry `done` | 切齐完成 |

## 触发条件 / 目标窗口

- **总触发：** 拿到 ATO 生效日 D。  
- **2026-10-30：** 只维护 todo；**不实施**切齐。

## 相关文档

- [切齐说明书](../../gst/gst-effective-date-cutover.md)
- [gst README](../../gst/README.md)
- [registry](../registry.md)
