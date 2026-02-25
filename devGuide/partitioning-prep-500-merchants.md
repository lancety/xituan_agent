# Partitioning Prep for 500 Merchants (按 merchant_id 拆表提前准备)

基于 `multi-tenant-table-partitioning-and-archiving.md` 的分析，按 **500 商户** 容量提前建好按 `merchant_id` 的 HASH 分区。**当前数据很少时，直接建新分区表并切到新表写，无需大批量数据迁移。**

---

## 1. 容量假设（与先前分析一致）

- **单商户**：按 **20 万订单/商户** 做表扩充（不再按 100 万）。
- **比例关系**（与先前分析一致）：
  - orders : order_items ≈ 1 : 3
  - orders : order_status_transitions ≈ 1 : 4
  - orders : order_payment_records ≈ 1 : 1.5
  - orders : revenues ≈ 1 : 1.5+
  - orders : inventory_transactions ≈ 1 : 8

---

## 2. 500 商户 × 20 万单/商户（按比例做表扩充）

单商户 **20 万单**，500 商户总订单 **1 亿**。各表按上述比例推算总行数，**分区数按表总数据量单独定**，目标单分区约 500万～1000 万行，不统一扩到 50。

| 表名 | 与 orders 关系 | 单商户量级(20万单) | 500 商户总数据量 | 分区数 | 目标单分区量级 |
|------|----------------|--------------------|------------------|--------|----------------|
| **orders** | 基准 | 20万 | **1亿** | 10 | ~1000万 |
| **order_items** | 1:3 | 60万 | **3亿** | 30 | ~1000万 |
| **order_status_transitions** | 1:4 | 80万 | **4亿** | 40 | ~1000万 |
| **order_payment_records** | 1:1.5 | 30万 | **1.5亿** | 15 | ~1000万 |
| **revenues** | ≥1:1.5 | 30–40万 | **1.5–2亿** | 20 | ~1000万 |
| **inventory_transactions** | 1:8 | 160万 | **8亿** | 80 | ~1000万 |

- **分区数**：按「总行数 ÷ 目标单分区行数」得出，上表按单分区约 1000 万行取整；各表分区数不同，不都扩到 50。
- **主键**：分区表主键需包含 `merchant_id`，例如 `PRIMARY KEY (id, merchant_id)`。
- **外键**：分区表不建外键；一致性由应用层与写入时 `merchant_id` 保证。

---

## 3. 需要按 merchant_id 拆分的表（提前准备清单）

| 优先级 | 表名 (merchant schema) | 分区数 | 说明 |
|--------|------------------------|--------|------|
| 高 | orders | 10 | 先做 |
| 高 | order_items | 30 | 随 orders |
| 高 | order_status_transitions | 40 | 随 orders |
| 高 | order_payment_records | 15 | 随 orders |
| 高 | revenues | 20 | 随订单/支付 |
| 高 | inventory_transactions | 80 | 行数最大 |
| 中 | expenses | 10 或 20 | 按需，按实际量估算 |

其他表保持低优先级或暂不分区。

---

## 4. 数据很少时：直接切到新分区表（无大批量迁移）

- **前提**：当前表数据量很小（可接受手工或一次性小量导入，或直接弃用）。
- **做法**：
  1. **新建分区表**：与现表结构一致，主键含 `merchant_id`，`PARTITION BY HASH (merchant_id)`，按上表**各表自己的分区数**创建空分区（如 orders 10 个，order_items 30 个，依此类推）。
  2. **不跑大批量 INSERT**：不执行从旧表到新表的大规模数据迁移。
  3. **切表**：将应用改为读写新分区表（例如把原表改名为 `orders_old`，新分区表命名为 `orders`；或改应用配置指向新表名）。
  4. **应用层**：所有访问带 `merchant_id`（request context 已有），Repository 统一传 `merchant_id`。

若有极少量历史数据需要保留，可单独写一次性脚本插入新分区表后再切表；主体策略是**直接切到新分区表**，不做大规模迁移。

---

## 5. 分区表示例（按表分区数：orders 用 10）

以 **orders**（10 分区）为例；其他表把 `modulus`/分区个数换成该表对应的分区数即可：

```sql=-=-
-- 1. 分区主表（与现有字段一致，主键含 merchant_id）
CREATE TABLE merchant.orders_new (
    id UUID NOT NULL,
    merchant_id UUID NOT NULL,
    -- ... 其他列与现有 orders 一致 ...
    PRIMARY KEY (id, merchant_id)
) PARTITION BY HASH (merchant_id);

-- 2. 创建 10 个分区（500 商户 × 20万单，orders 总约 1 亿行，目标单分区 ~1000 万）
DO $$
DECLARE i INTEGER;
BEGIN
  FOR i IN 0..9 LOOP
    EXECUTE format(
      'CREATE TABLE merchant.orders_part_%s PARTITION OF merchant.orders_new FOR VALUES WITH (modulus 10, remainder %s)',
      i, i
    );
  END LOOP;
END $$;

-- 3. 索引
CREATE INDEX idx_orders_new_merchant_created ON merchant.orders_new(merchant_id, created_at);
CREATE INDEX idx_orders_new_merchant_status ON merchant.orders_new(merchant_id, status);
CREATE UNIQUE INDEX idx_orders_new_merchant_order_number ON merchant.orders_new(merchant_id, order_number);
```

**切表**：应用改为使用新表后，`ALTER TABLE merchant.orders RENAME TO orders_old; ALTER TABLE merchant.orders_new RENAME TO orders;`，或通过配置让应用指向 `orders_new` 后废弃旧表。

**其他表**：order_items 用 modulus 30、order_status_transitions 用 40、order_payment_records 用 15、revenues 用 20、inventory_transactions 用 80，创建对应个数的分区。

---

## 5.1 分区会不会增加数据库大小或带来负面影响？

**不会明显增加数据库总占用。**

- **数据量**：分区是把**同一份数据**按分区键拆到多张物理子表里，行数和总数据体积与不分区时一致（迁移时是「挪到新分区表」再删旧表，不是复制一份）。总磁盘占用不会因为分区而翻倍。
- **额外开销**：每个分区是一张子表，会有少量元数据（表名、统计信息等），通常可忽略；索引总大小也大致等于「一张大表建同样索引」的大小，只是分散到各分区。整体多出的空间一般 < 几个百分点。

**可能的负面影响（可控）：**

| 方面 | 说明 | 缓解 |
|------|------|------|
| **查询计划** | 不带分区键的查询会扫多个分区，计划器可能选到更慢的计划 | 查询尽量带 `merchant_id`（我们 request context 已带） |
| **DDL/维护** | 分区多，表/索引对象多；加列、建索引会作用到所有分区 | 用「分区表」统一 DDL 即可，PG 会级联到子分区；VACUUM/ANALYZE 可分区执行 |
| **规划/运维** | 分区数量、命名需要事先定好 | 按本文档分区数执行即可，后续扩容见优化指南 |

结论：在「按 merchant_id 分区、查询带 merchant_id」的前提下，**分区不会多占不必要空间**，也不会带来不可接受的负面影响；主要收益是单分区数据量变小，查询与维护更稳。

---

## 6. 实施顺序建议

1. 做一次表大小监控，确认当前行数。
2. 选一张表试点（建议 **orders**）：建分区主表 + **10** 分区，直接切到新表写（数据很少，不迁或仅小量导入）。
3. 其余高优先级表按**各自分区数**依次做（order_items 30、order_status_transitions 40、order_payment_records 15、revenues 20、inventory_transactions 80）。
4. 归档在数据量上来后，再按 `multi-tenant-table-partitioning-and-archiving.md` 做。

---

## 7. 实施细节（延后执行）

具体建表、分区数、索引、切表步骤与 DDL 要点已写入 **`devGuide/merchant-schema-partition-implementation.md`**。当前不创建或执行任何 migration，待数据量上来后再按该文档落地。

---

## 8. 参考

- 分区实施细节（DDL、约束、执行顺序）：`devGuide/merchant-schema-partition-implementation.md`
- 表分区与归档总览：`devGuide/multi-tenant-table-partitioning-and-archiving.md`
- 分区概念与监控：`docs/multi-tenant/database-optimization-guide.md`
- 优化清单：`devGuide/database-optimization-checklist.md`
- 若需 1000 商户容量：见 `devGuide/partitioning-prep-1000-merchants.md`（分区数 100，表清单相同）
