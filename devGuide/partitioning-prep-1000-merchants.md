# Partitioning Prep for 1000 Merchants (按 merchant_id 拆表提前准备)

Based on the existing analysis in `multi-tenant-table-partitioning-and-archiving.md`, this doc defines **capacity for 1000 merchants** and a **prep-now** approach: create HASH partitions by `merchant_id` in advance so the schema is ready before data grows.

---

## 1. Capacity assumption (与先前分析一致)

- **Per merchant**: Same as before — order-related rows scale with orders (e.g. 100万 orders/merchant as high-water mark).
- **Relations** (from code / existing doc):
  - orders : order_items ≈ 1 : 3
  - orders : order_status_transitions ≈ 1 : 4
  - orders : order_payment_records ≈ 1 : 1.5
  - orders : revenues ≈ 1 : 1.5+
  - orders : inventory_transactions ≈ 1 : 8

---

## 2. Scale to 1000 merchants (按各表增容速度)

Assume **1000 merchants**, each up to **100万 orders** (same as 500-merchant analysis, doubled merchant count).

| 表名 | 与 orders 关系 | 单商户量级 | 1000 商户总数据量 | 分区数 | 目标单分区量级 |
|------|----------------|------------|-------------------|--------|----------------|
| **orders** | 基准 | 100万 | **10亿** | 100 | ~1000万 |
| **order_items** | 1:3 | 300万 | **30亿** | 100 | ~3000万 |
| **order_status_transitions** | 1:4 | 400万 | **40亿** | 100 | ~4000万 |
| **order_payment_records** | 1:1.5 | 150万 | **15亿** | 100 | ~1500万 |
| **revenues** | ≥1:1.5 | 150–200万 | **15–20亿** | 100 | ~1500–2000万 |
| **inventory_transactions** | 1:8 | 800万 | **80亿** | 100 | ~8000万 |

- **分区数 100**：按 `merchant_id` HASH，1000 商户时平均每分区约 10 个商户；单分区行数按上表控制，与先前 500 商户 / 50 分区时「单分区约 1000 万 orders」的思路一致，便于后续监控与归档。
- **主键**：所有分区表主键均需包含 `merchant_id`，例如 `PRIMARY KEY (id, merchant_id)`。
- **外键**：分区表不建指向其他分区表的外键；一致性由应用层 + 写入时带 `merchant_id` 保证。

---

## 3. 需要按 merchant_id 拆分的表（提前准备清单）

以下表建议**提前**做成按 `merchant_id` HASH 分区，容量按 1000 商户准备。

| 优先级 | 表名 (merchant schema) | 分区数 | 说明 |
|--------|------------------------|--------|------|
| 高 | orders | 100 | 核心业务表，先做 |
| 高 | order_items | 100 | 随 orders |
| 高 | order_status_transitions | 100 | 随 orders |
| 高 | order_payment_records | 100 | 随 orders |
| 高 | revenues | 100 | 随订单/支付增长 |
| 高 | inventory_transactions | 100 | 行数最大，随订单 |
| 中 | expenses | 100 或 50 | 按需，可稍后 |

其他表（如 equipment_depreciation_records、partner_invoices 等）按原文档保持「低优先级 / 暂不分区」，等监控到量级再考虑。

---

## 4. 提前准备策略（空分区先建好）

- **目标**：在数据量还不大时，把「按 merchant_id 拆表」的**表结构**建好，避免日后单表过大再迁。
- **做法**：
  1. **新建分区表**（与现表同结构，但主键含 `merchant_id`，`PARTITION BY HASH (merchant_id)`）。
  2. **创建 100 个分区**：`FOR VALUES WITH (modulus 100, remainder 0..99)`，先空分区即可。
  3. **数据迁移**（二选一或分阶段）：
     - **方案 A**：当前无/少量数据时，直接建分区表为空，应用改为写分区表；原表废弃或重命名备份。
     - **方案 B**：当前已有数据，则一次性 `INSERT INTO new_partitioned_table SELECT * FROM old_table`，校验后切表（rename），再下线旧表。
  4. **应用层**：所有按主键或唯一键查询/更新时带 `merchant_id`（request context 已有），Repository 层统一传 `merchant_id`。

这样**容量按 1000 商户、各表增容速度**已提前预留，后续只做监控与归档即可。

---

## 5. 分区表示例（100 分区）

以 **orders** 为例（其他表同理，主键与分区键一致）：

```sql
-- 1. 分区主表（与现有字段一致，主键含 merchant_id）
CREATE TABLE merchant.orders_new (
    id UUID NOT NULL,
    merchant_id UUID NOT NULL,
    -- ... 其他列与现有 orders 一致 ...
    PRIMARY KEY (id, merchant_id)
) PARTITION BY HASH (merchant_id);

-- 2. 创建 100 个分区（提前准备 1000 商户容量）
DO $$
DECLARE i INTEGER;
BEGIN
  FOR i IN 0..99 LOOP
    EXECUTE format(
      'CREATE TABLE merchant.orders_part_%s PARTITION OF merchant.orders_new FOR VALUES WITH (modulus 100, remainder %s)',
      i, i
    );
  END LOOP;
END $$;

-- 3. 索引（与现有查询模式一致）
CREATE INDEX idx_orders_new_merchant_created ON merchant.orders_new(merchant_id, created_at);
CREATE INDEX idx_orders_new_merchant_status ON merchant.orders_new(merchant_id, status);
CREATE UNIQUE INDEX idx_orders_new_merchant_order_number ON merchant.orders_new(merchant_id, order_number);
```

- **切表**：数据迁移并校验通过后，`ALTER TABLE merchant.orders RENAME TO orders_old; ALTER TABLE merchant.orders_new RENAME TO orders;`，应用重启或发版后下线 `orders_old`。

---

## 6. 实施顺序建议

1. **先做表大小监控**（见 `database-optimization-guide.md`），确认当前行数。
2. **选一张表试点**（建议 **orders**）：建分区主表 + 100 分区，迁数据（若有），切表，应用带 `merchant_id` 查询/写入，验证无问题。
3. **其余高优先级表**按同一方式依次做（order_items, order_status_transitions, order_payment_records, revenues, inventory_transactions）。
4. **归档**：等主表分区稳定、数据量上来后，再按 `multi-tenant-table-partitioning-and-archiving.md` 做按时间归档表与定时归档任务。

---

## 7. 参考

- 表分区与归档总览：`devGuide/multi-tenant-table-partitioning-and-archiving.md`
- 分区概念与监控：`docs/multi-tenant/database-optimization-guide.md`
- 优化清单与耗时粗估：`devGuide/database-optimization-checklist.md`
