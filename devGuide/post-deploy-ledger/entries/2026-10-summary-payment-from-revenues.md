# 结算单付款状态改由收入派生

Last updated: 2026-10-30

| Field | Value |
|-------|-------|
| **ID** | `summary-payment-from-revenues` |
| **Status** | `planned` |
| **Deployed** | — |
| **Pending** | Phase 1：读侧/邮件/dashboard/确认收款以收入为准；停用仅翻 isPaid 的 status API；列 dual-write 可选。Phase N：DROP `total_paid` / `is_paid` / `paid_date` |
| **Gate** | CMS + Merchant App 已依赖 API 返回的派生字段（同名）；无人再写三列；生产抽查流水建账与确认收款状态一致 |
| **Created** | 2026-10-30 |

## Background

`partner_invoice_summaries.total_paid` / `is_paid` / `paid_date` 与 `revenues`（`source_type=partner_invoice_summary`）双轨，流水侧建账不会回写结算单，导致「有收入但未付」或确认收款幂等吞账。

真相源改为收入记录；三列 Phase 1 保留（API 仍返回同名字段），Phase N DROP。

## Phase 1

- 批量按 `source_id` 聚合非退款结算单收入 → 派生 `totalPaid` / `isPaid` / `paidDate`
- 列表 / 详情 / 邮件 / dashboard 未收：读派生
- 确认收款：只以收入算剩余并 `createRevenue`；可 dual-write 三列便于旧 SQL，但读路径不依赖列
- `PUT .../status`（仅翻 isPaid）：拒绝，须走确认收款
- **CMS**：确认收款 Modal 不变（读 API 派生字段）；列表「确认收款」按钮以剩余额 `> 0` 为准
- **Merchant App**：去掉 isPaid 开关；未付点徽章打开确认收款 Modal → `confirm-payment`

## Phase N

- DROP 三列及相关索引；删 dual-write；`countPaidSummaries` 等改纯聚合
- Gate：CMS + Merchant App 发版后无 status 开关依赖；邮件/dashboard 已用派生稳定运行

## Checklist

### Pre-deploy

- [x] 登记本 entry + registry 行
- [ ] 部署 backend（CMS 同窗口更佳；Merchant App 可稍后，旧 status 开关会失败）

### Post-deploy

- [ ] 生产：确认收款与流水建账后列表「付款确认成功」一致
- [ ] Gate 后单独 PR DROP 三列 → entry `done`
