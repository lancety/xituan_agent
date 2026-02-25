# Merchant Schema 分区实施细节（暂不执行，数据量上来后再做）

本文档描述对 `merchant` schema 中 6 张表按 `merchant_id` 做 HASH 分区的**完整实施细节**，供后续数据量上来后按此落地。**当前不创建或执行任何 migration。**

- 容量与分区数依据：`devGuide/partitioning-prep-500-merchants.md`
- 策略：新建分区表 → 建空分区与索引 → 重命名切表（不跑大批量数据迁移）

---

## 1. 范围与分区数

| 表名 | 分区数 | 说明 |
|------|--------|------|
| orders | 10 | 主键含 merchant_id；需 UNIQUE(merchant_id, order_number)、UNIQUE(id) 供子表 FK |
| order_items | 30 | 主键含 merchant_id；无唯一约束需改 |
| order_status_transitions | 40 | 主键含 merchant_id |
| order_payment_records | 15 | 主键含 merchant_id |
| revenues | 20 | 主键含 merchant_id |
| inventory_transactions | 80 | 主键含 merchant_id |

分区键统一：`PARTITION BY HASH (merchant_id)`。主键统一：`PRIMARY KEY (id, merchant_id)`。

---

## 2. 约束与 FK 处理

- **分区表主键**：必须包含分区键，即 `(id, merchant_id)`。
- **唯一约束**：若原表有唯一约束，分区表上必须把 `merchant_id` 放进唯一键：
  - **orders**：`UNIQUE (merchant_id, order_number)`（替代原 order_number 唯一）。
- **外键**：
  - 分区表**不建**指向其他分区表的外键（PG 限制与复杂度）。
  - 子表（order_items、order_status_transitions、order_payment_records）当前 FK 指向 `merchant.orders(id)`。切表后它们会指向新的 `orders`（分区表）。分区表上 **orders** 需有 `UNIQUE(id)`，否则 PG 不允许 `order_items.order_id` 引用 `orders(id)`。因此 **orders 分区表**除 `PRIMARY KEY (id, merchant_id)` 外，还要建 `UNIQUE(id)`。
- 其他表（revenues、inventory_transactions）无依赖 orders 的 FK，按上述主键/唯一即可。

---

## 3. 实施步骤（执行时顺序）

对每张表：

1. **建新分区主表**：表名 `merchant.<table>_new`，列定义与现表一致，主键 `(id, merchant_id)`，`PARTITION BY HASH (merchant_id)`。
2. **建空分区**：按上表分区数用 `FOR VALUES WITH (modulus N, remainder 0..N-1)` 创建 N 个分区。
3. **建索引**：包括业务需要的 (merchant_id, created_at)、(merchant_id, status) 等；orders 额外建 `UNIQUE(merchant_id, order_number)` 和 `UNIQUE(id)`。
4. **切表**：`ALTER TABLE merchant.<table> RENAME TO <table>_old;`，`ALTER TABLE merchant.<table>_new RENAME TO <table>;`。

建议实施顺序：先 **orders**（并加 UNIQUE(id)），再 **order_items**、**order_status_transitions**、**order_payment_records**（依赖 orders），最后 **revenues**、**inventory_transactions**。

---

## 4. 各表 DDL 要点（列与索引）

以下为与当前实体一致的列类型要点；枚举列在库中若已存在 enum 类型则用该类型，否则用 `VARCHAR(length)` 兼容。

### 4.1 orders_new

- **列**：id UUID, merchant_id UUID NOT NULL, order_number VARCHAR(50), user_id UUID, status / mode / delivery_option（enum 或 VARCHAR(50)）, mode_instance_id UUID, total_amount / delivery_fee / final_amount DECIMAL(10,2), delivery_address_snapshot JSONB, note / cancel_reason / refund_reason TEXT, created_at / updated_at / paid_at / delivered_at / cancelled_at / refunded_at TIMESTAMPTZ, payment_method / payment_status VARCHAR(50), payment_reference VARCHAR(10)。
- **主键**：`(id, merchant_id)`。
- **分区**：`PARTITION BY HASH (merchant_id)`，10 个分区。
- **索引**：`UNIQUE(merchant_id, order_number)`；`UNIQUE(id)`（供 order_items 等 FK）；`(merchant_id, created_at)`；`(merchant_id, status)`；保留 `idx_orders_merchant_id` 等价物（若未包含在上述组合索引中可单独建）。

### 4.2 order_items_new

- **列**：id UUID, merchant_id UUID NOT NULL, order_id UUID, product_id UUID, product_name JSONB, quantity INT, unit_price / base_price / total_extra_price / subtotal DECIMAL(10,2), selected_options JSONB, note TEXT, note_images TEXT[], mode_product_id UUID, created_at / updated_at TIMESTAMPTZ。
- **主键**：`(id, merchant_id)`。
- **分区**：HASH(merchant_id)，30 个分区。
- **索引**：`(merchant_id, order_id)`；`(merchant_id, created_at)`；其他业务常用查询列按需。

### 4.3 order_status_transitions_new

- **列**：id UUID, merchant_id UUID NOT NULL, order_id UUID, from_status / to_status VARCHAR(50), transition_type（enum 或 VARCHAR）, operator_id UUID, reason TEXT, amount DECIMAL(10,2), payment_transaction_id VARCHAR(100), created_at TIMESTAMPTZ, metadata JSONB。
- **主键**：`(id, merchant_id)`。
- **分区**：HASH(merchant_id)，40 个分区。
- **索引**：`(merchant_id, order_id)`；`(merchant_id, created_at)`；按需。

### 4.4 order_payment_records_new

- **列**：id UUID, merchant_id UUID NOT NULL, parent_payment_id / order_id / user_id UUID, payment_type / payment_method / status（enum 或 VARCHAR）, amount DECIMAL(10,2), currency VARCHAR(3), transaction_id VARCHAR(100), reason TEXT, refunded_amount / refunded_amount_received DECIMAL(10,2), operator_id VARCHAR(36), created_at / processed_at TIMESTAMPTZ, metadata JSONB, needs_manual_review BOOLEAN, manual_review_reason VARCHAR(500), match_result JSONB。
- **主键**：`(id, merchant_id)`。
- **分区**：HASH(merchant_id)，15 个分区。
- **索引**：`(merchant_id, order_id)`；`(merchant_id, created_at)`；按需。

### 4.5 revenues_new

- **列**：id UUID, merchant_id UUID NOT NULL, revenue_date DATE, revenue_type / source_type / payment_type VARCHAR, source_id VARCHAR(255), source_reference VARCHAR(100), original_payment_record_id / parent_payment_record_id UUID, is_refund BOOLEAN, total_amount / gst_amount / net_amount DECIMAL(10,2), financial_year VARCHAR(10), notes TEXT, created_at / updated_at TIMESTAMPTZ。
- **主键**：`(id, merchant_id)`。
- **分区**：HASH(merchant_id)，20 个分区。
- **索引**：与现表一致（如 revenue_date、revenue_type、source_id、source、payment_record、is_refund、financial_year、created_at），前缀加 merchant_id 或保持单列按需。

### 4.6 inventory_transactions_new

- **列**：id UUID, merchant_id UUID NOT NULL, product_id UUID, order_id UUID, transaction_type / status（enum 或 VARCHAR）, mode VARCHAR(20), mode_instance_id / mode_product_id UUID, quantity INT, before_stock / after_stock INT, reference_id VARCHAR(100), reason TEXT, operator_id VARCHAR(100), metadata JSONB, created_at TIMESTAMPTZ。
- **主键**：`(id, merchant_id)`。
- **分区**：HASH(merchant_id)，80 个分区。
- **索引**：`(merchant_id, product_id)`；`(merchant_id, order_id)`；`(merchant_id, created_at)`；按需。

---

## 5. 枚举列处理

- 若当前库中已有对应 enum 类型（如 order 的 status/mode/delivery_option），DDL 中直接使用该类型。
- 若不存在或不确定，分区表建表时使用 `VARCHAR(50)`（或与实体 length 一致）避免依赖未创建的 enum，应用层行为不变。

---

## 6. 应用与 TypeORM 注意点

- **查询**：所有访问必须带 `merchant_id`（request context 已有），以利用分区裁剪。
- **主键**：分区表主键为 `(id, merchant_id)`。若 TypeORM 仍按单列 `id` 主键使用，需在适当时机改为复合主键 `@PrimaryColumn() id` + `@PrimaryColumn() merchantId`，否则与分区表定义一致且便于扩展。
- **切表后**：应用直接读写 `merchant.orders` 等（重命名后即为分区表），无需改表名配置；旧表为 `*_old`，可择机备份后删除。

---

## 7. 迁移文件与执行约定

- **不在此创建或执行任何 SQL migration**。待数据量上来、决定执行时：
  - 在 `xituan_backend/migrations/` 下按当前最大 index 递增新建迁移（例如下一号为 `1710000000226_merchant_partition_by_merchant_id.sql`）。
  - 将上述建分区主表、建分区、建索引、重命名切表语句写入该迁移。
  - 执行前需经确认（遵守 `.cursor/rules/migration-sql.mdc`）。

---

## 8. 参考

- 容量与分区数：`devGuide/partitioning-prep-500-merchants.md`
- 表分区与归档总览：`devGuide/multi-tenant-table-partitioning-and-archiving.md`
