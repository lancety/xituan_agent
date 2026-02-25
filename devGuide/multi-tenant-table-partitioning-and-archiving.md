# 多商户平台表分区与归档设计文档

> 基于代码分析和业务需求制定的表分区与归档策略

## 📋 概述

本文档描述多商户平台改造中，针对大数据量表的**分区策略**和**归档策略**，以优化查询性能并控制数据量增长。

### 核心目标

1. **分区**：将大数据量表按 `merchant_id` 哈希分区，提升查询性能
2. **归档**：将历史数据归档到归档表，减少主表数据量
3. **性能**：确保单商户查询性能优秀（< 50ms）
4. **可维护性**：归档操作简单，不影响业务

---

## 📊 第一部分：表分区策略

### 1.1 数据量分析（基于代码分析）

#### 核心业务流程：订单创建 → 支付 → 收入

**订单创建流程**（`order.service.ts`）：
- 1条 `order`
- 平均3条 `order_items`（每个订单2-5个商品）
- 每个订单项1条 `inventory_transaction`（预留）
- 1条 `order_status_transition`（初始状态）

**支付流程**（`payment.handler.service.ts`）：
- 1条 `order_payment_record`（每个订单1-3条，平均1.5条）
- 1条 `revenue`（每个支付记录对应1条收入）

**订单状态转换**（`order-status.service.ts`）：
- 每个订单3-6次状态转换（平均4次）

**库存交易**（`inventory-management.service.ts`）：
- 每个订单产生6-15条库存交易（预留+扣减+释放等）

#### 数据量预估（500商户，单商户100万订单）

| 表名 | 与orders的关系 | 单商户数据量 | 总数据量 | 分区后单分区 |
|------|---------------|------------|---------|-------------|
| **orders** | 基准 | 100万 | 5亿 | 1000万 |
| **order_items** | 1:3 | 300万 | 15亿 | 3000万 |
| **order_status_transitions** | 1:4 | 400万 | 20亿 | 4000万 |
| **order_payment_records** | 1:1.5 | 150万 | 7.5亿 | 1500万 |
| **revenues** | ≥1:1.5 | 150-200万 | 7.5-10亿 | 1500-2000万 |
| **inventory_transactions** | 1:8 | 800万 | 40亿 | 8000万 |

### 1.2 分区方案设计

#### 分区策略：按 merchant_id 哈希分区

**统一分区数**：所有按 `merchant_id` 分区的表使用**同一分区数**（同一 modulus），不按表的数据规模区分。这样同一商户在所有表中落在同一分区编号，运维、归档、监控更简单；业务查询不跨商户，分区数按表区分没有实质收益。

**分区数量选择**：

- 预期商户数 N，分区数 P → 每分区约 N/P 个商户；单分区行数 ≈ (N/P) × 单商户该表年增量 × 保留年数。
- 分区过多：元数据与打开分区开销增大；过少：单分区商户多、行数大。常见取 50 或 100，在「单分区行数可控」与「分区数可维护」之间折中。

**示例：cart_items 单商户 1 年行数**

- 假设：1 天 100 个客户，每人创建 2 个 cart，每个 cart 含 3 个产品；cart_items 中每个选中产品一条记录。
- 每日：100 × 2 × 3 = **600** 条 cart_items。
- 1 年：600 × 365 = **219,000** 条/商户/年。

若 500 商户、50 分区、保留 2 年：每分区约 10 商户，约 10 × 219,000 × 2 ≈ **438 万** 行/分区（仅 cart_items）。订单相关表单商户行数更高，需配合归档控制单分区体量。

**推荐**：全库统一 **50 个分区**（modulus 50）。若商户数或单商户数据量显著增大，可再评估改为 100。

#### 需要分区的表清单（统一 50 分区）

##### 高优先级（按 merchant_id 分区，均 50 分区）

| 表名 | 预估数据量 | 说明 |
|------|-----------|------|
| `inventory_transactions` | 40亿行 | 每订单约 8 条 |
| `order_status_transitions` | 20亿行 | 每订单约 4 次状态转换 |
| `order_items` | 15亿行 | 每订单约 3 个商品 |
| `revenues` | 7.5-10亿行 | 每支付记录 1 条等 |
| `order_payment_records` | 7.5亿行 | 每订单约 1.5 条 |
| `orders` | 5亿行 | 核心业务表 |

##### 中优先级（同上，50 分区）

| 表名 | 预估数据量 | 说明 |
|------|-----------|------|
| `expenses` | 500-2500万行 | 与订单表统一分区数，便于同一商户同分区号 |
| `cart_items` | 见上例 | 单商户约 21.9 万/年，统一 50 分区 |

##### 低优先级（暂不分区）

| 表名 | 预估数据量 | 说明 |
|------|-----------|------|
| `equipment_depreciation_records` | 100-500万行 | 数据量相对较小 |
| `partner_invoices` | 50-500万行 | 频率远低于订单 |

### 1.3 分区实施示例

#### 订单表分区（orders）

```sql
-- 1. 创建分区主表
CREATE TABLE merchant.orders (
    id UUID NOT NULL,
    merchant_id UUID NOT NULL,
    order_number VARCHAR(50) NOT NULL,
    user_id UUID NOT NULL,
    status VARCHAR(30) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    -- ... 其他字段
    
    -- 注意：分区表的主键必须包含分区键（merchant_id）
    PRIMARY KEY (id, merchant_id)
) PARTITION BY HASH (merchant_id);

-- 2. 创建 50 个分区
DO $$
DECLARE
    i INTEGER;
BEGIN
    FOR i IN 0..49 LOOP
        EXECUTE format(
            'CREATE TABLE merchant.orders_part_%s PARTITION OF merchant.orders 
             FOR VALUES WITH (modulus 50, remainder %s)',
            i, i
        );
    END LOOP;
END $$;

-- 3. 创建索引（每个分区自动有独立索引）
CREATE INDEX idx_orders_merchant_created ON merchant.orders(merchant_id, created_at);
CREATE INDEX idx_orders_merchant_status ON merchant.orders(merchant_id, status);
CREATE INDEX idx_orders_order_number ON merchant.orders(order_number);
```

#### 收入表分区（revenues）

```sql
-- revenues 表分区（与 orders 保持一致的分区策略）
CREATE TABLE merchant.revenues (
    id UUID NOT NULL,
    merchant_id UUID NOT NULL,
    revenue_date DATE NOT NULL,
    revenue_type VARCHAR(50) NOT NULL,
    source_id UUID,  -- 订单ID、partner invoice ID等
    source_type VARCHAR(50) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    -- ... 其他字段
    
    -- 主键必须包含分区键
    PRIMARY KEY (id, merchant_id)
) PARTITION BY HASH (merchant_id);

-- 创建 50 个分区
DO $$
DECLARE
    i INTEGER;
BEGIN
    FOR i IN 0..49 LOOP
        EXECUTE format(
            'CREATE TABLE merchant.revenues_part_%s PARTITION OF merchant.revenues 
             FOR VALUES WITH (modulus 50, remainder %s)',
            i, i
        );
    END LOOP;
END $$;

-- 创建索引
CREATE INDEX idx_revenues_merchant_date ON merchant.revenues(merchant_id, revenue_date);
CREATE INDEX idx_revenues_merchant_type ON merchant.revenues(merchant_id, revenue_type);
CREATE INDEX idx_revenues_source ON merchant.revenues(merchant_id, source_type, source_id);
```

### 1.4 分区注意事项

#### 1. 主键约束变化

```sql
-- ❌ 错误：分区表不能使用单列主键
PRIMARY KEY (id)

-- ✅ 正确：主键必须包含分区键（merchant_id）
PRIMARY KEY (id, merchant_id)
```

#### 2. 外键限制

```sql
-- ❌ 错误：分区表不能有外键
ALTER TABLE merchant.order_items 
ADD CONSTRAINT fk_order_items_order 
FOREIGN KEY (order_id) REFERENCES merchant.orders(id);

-- ✅ 正确：其他表可以引用分区表（反过来）
-- 但需要在应用层保证 merchant_id 一致性
```

#### 3. 唯一约束

```sql
-- ✅ 正确：唯一约束必须包含分区键
CREATE UNIQUE INDEX uk_orders_order_number 
ON merchant.orders(merchant_id, order_number);
```

#### 4. 查询性能

```sql
-- ✅ 优秀：包含 merchant_id 的查询（自动路由到对应分区）
SELECT * FROM merchant.orders 
WHERE merchant_id = 'xxx' AND id = 'yyy';

-- ⚠️ 一般：不包含 merchant_id 的查询（需要扫描所有分区）
SELECT * FROM merchant.orders 
WHERE order_number = 'ORD001';
-- 建议：如果经常这样查询，添加 merchant_id 条件
```

### 1.5 实施工作量与流程

#### 范围（统一 50 分区）

| 阶段 | 表 | 说明 |
|------|-----|------|
| 第一批（强依赖 orders） | orders → order_items, order_status_transitions, order_payment_records | orders 先做，再改引用它的 FK；再分区子表 |
| 第二批（独立） | revenues, inventory_transactions | 无引用 orders，可独立分区 |
| 第三批（可选） | expenses, cart_items | 同上，按需排期 |

每张表要做的事（工作量大致一致）：

1. **Migration SQL**（1 个 migration 文件/表，或 1 个文件多表）：  
   - 删除该表指向 `platform.merchants` 的 FK（分区表不能带出库 FK）。  
   - 若该表引用 `orders`：先等 orders 分区完成，再在迁移里把 FK 改为 `(order_id, merchant_id) REFERENCES orders(id, merchant_id)`（或先删 FK 再建复合 FK）。  
   - 原表 `RENAME TO 表名_old`。  
   - 建分区主表 `PARTITION BY HASH (merchant_id)`，主键 `(id, merchant_id)`，列与原表一致。  
   - 用 `DO $$ ... FOR i IN 0..49` 建 50 个子分区。  
   - `INSERT INTO 新表 SELECT * FROM 表名_old`（可分批以控制锁与时长）。  
   - 建索引：至少 `(merchant_id, created_at)` 或业务日期列。  
   - 校验行数后，视情况保留或 drop `表名_old`。

2. **Entity**（每表 1 个实体文件）：  
   - 主键从单列 `id` 改为复合 `(id, merchant_id)`：`@PrimaryColumn() id` + `@PrimaryColumn() merchantId`，去掉 `@PrimaryGeneratedColumn`，应用层保证插入时带 merchantId。

3. **Repository/查询**：  
   - 所有按 id 查单条的地方改为带 `merchant_id`（如 `findOne({ where: { id, merchantId } })`），避免全分区扫描。  
   - 已有 `getMerchantId()` 过滤的可不动，只补「按 id 查」的调用点。

4. **引用 orders 的表**：  
   - 仅 orders 分区后，需在 migration 里改 order_items / order_status_transitions / order_payment_records / inventory_locks 的 FK 为复合 FK；若当前无 FK 则跳过。

#### 除 SQL 迁移外需配套更新的代码

| 类别 | 位置 | 改动说明 |
|------|------|----------|
| **1. Entity 实体** | 各表对应 `*.entity.ts` | 主键从 `@PrimaryGeneratedColumn('uuid') id` 改为 `@PrimaryColumn() id` + `@PrimaryColumn() merchantId`；去掉 `@PrimaryGeneratedColumn`。`order_number` 等若标了 `unique: true` 改为唯一索引在 `(merchant_id, order_number)` 上（DB 已建则实体可只保留注释）。 |
| **2. 新建实体时 id** | 所有 `repo.save(entity)` 且 entity 为分区表时 | 插入前必须设 `id`（应用层生成 UUID，如 `uuidv4()`）和 `merchantId`；不再依赖数据库默认生成。 |
| **3. 按 id 查单条** | Repository / Service | 凡 `findOne({ where: { id } })` 或 `findOne({ where: { id: orderId } })` 等仅按 id 查分区表的，一律改为带 `merchantId`，例如 `findOne({ where: { id, merchantId } })`，否则会扫 50 个分区。已用 `getMerchantId()` 的列表/条件查询一般不用改。 |
| **4. 关联关系 @JoinColumn** | 引用 orders 的子表实体（order_items, order_status_transitions, order_payment_records 等） | Order 改为复合主键后，子表实体的 `@ManyToOne(() => Order)` 需用复合 JoinColumn，例如 `@JoinColumn([{ name: 'order_id', referencedColumnName: 'id' }, { name: 'merchant_id', referencedColumnName: 'merchantId' }])`，与 migration 中复合 FK 一致。 |
| **5. Raw SQL** | 直接写 `SELECT/UPDATE/DELETE` 分区表的逻辑 | WHERE 中必须带 `merchant_id` 条件（或与带 merchant_id 的子查询 JOIN），避免全分区扫描。例如 `product_barcodes`、`webhooks_events_airwallex` 当前无实体，若日后分区，所有 raw SQL 都要加 merchant_id。 |

**按表需改的代码位置（示例，分区上线前再 grep 确认）**：

- **orders**：Order 实体复合 PK；order.repository / order-status.service / payment-business.service / webhook-airwallex-refund.service / refund.handler / bank-transfer-matching / order-expiry 等所有 `findOne(Order, { where: { id } })` 改为带 `merchantId`；创建 Order 时调用处确保赋 `id`（如 uuid）和 `merchantId`。
- **order_items / order_status_transitions / order_payment_records**：实体复合 PK + 对 Order 的 @JoinColumn 改为复合；各自 repository 及 payment / order 相关 service 里按 id 查的单条改为带 merchantId。
- **revenues**：Revenue 实体复合 PK；revenue.repository 中 `findOne({ where: { id } })` 改为 `findOne({ where: { id, merchantId } })`；创建时赋 id + merchantId。
- **inventory_transactions / expenses / cart_items**：同上模式，实体复合 PK + 按 id 查处带 merchantId + 新建时赋 id。

#### 建议流程

1. **准备**：在测试/预发用生产副本或大表造数，验证 migration 脚本（单表 orders 试点）。  
2. **orders 试点**：写 migration（rename → 建分区表 + 50 分区 → 拷数据 → 索引）→ 改 Order 实体复合 PK → 改所有引用 orders 的 FK 为 (order_id, merchant_id) → 改按 id 查 orders 的代码带 merchantId → 部署并验证。  
3. **子表**：按依赖顺序 order_items → order_status_transitions → order_payment_records（再 revenues、inventory_transactions），每表一个 migration + 实体 + 必要查询改动，分批上线。  
4. **expenses / cart_items**：同模式，排期在核心订单表之后。

#### 工作量粗估

| 项 | 数量 | 说明 |
|----|------|------|
| Migration 脚本 | 8 个表 ≈ 8 个文件（或 2～3 个文件分批写） | 每表约 80～150 行 SQL，含建表、分区、拷贝、索引 |
| Entity 改动 | 8 个 | 每表改为主键 (id, merchant_id)，约 5～10 分钟/表 |
| 按 id 查询排查 | 全库 | grep `findOne.*id` / `findByPk` 等，逐处加 merchantId，约 0.5～1 天 |
| 联调与回归 | — | 订单创建/支付/列表/详情、报表、归档脚本等，约 1～2 天 |
| **合计** | — | 开发约 3～5 人天（视表数量与是否分批）；生产执行需停机或低峰窗口，每表拷贝时间取决于数据量 |

生产执行注意：拷贝阶段可分批 `INSERT ... SELECT ... WHERE id IN (SELECT id FROM 表_old ORDER BY id LIMIT 10000 OFFSET ...)` 减少长锁；或停机一次性拷贝。执行前务必备份并准备回滚（保留 _old 表至验证通过）。

### 1.6 全部 40 张表的分批与顺序（完整计划）

以下按 **表间依赖** 与 **业务优先级** 排定顺序；同一批内表之间无依赖，可同一次上线。

**每批一起完成（同一次发布）**：  
① **Migration**：该批所有表的 DDL（删 merchant FK → rename → 建 50 分区 → 拷数据 → 索引；若有引用已分区表则改复合 FK）。  
② **ORM 实体**：该批所有表对应 Entity 改为复合主键 `(id, merchantId)`，引用已分区表的子表改好 `@JoinColumn` 复合外键。  
③ **后端代码**：该批所有表相关的「按 id 查」、按 orderId/offerId 等查的调用补上 `merchantId`（见 readiness 文档 6.1～6.7 清单）；新建实体时赋 `id` + `merchantId`。  

三部分一起合并、测试、上线，避免只跑 SQL 不改代码导致查询全分区扫描或报错。

**测试**：每批改完后必须跑完该批相关的 **集成测试** 与 **单元测试**，失败则修复后再进入下一批；避免技术债累积。

**版本管理**：每完成一批（Migration + Entity + 后端代码，测试通过后）做一次 **git commit**，便于按批回滚与追溯。

| 批次 | 表（merchant schema） | 数量 | 依赖说明 |
|------|------------------------|------|----------|
| **1** | orders | 1 | 根表；子表 FK 指向 orders(id, merchant_id)，必须先做 |
| **2** | order_items, order_status_transitions, order_payment_records, inventory_locks, alert_orders_payments | 5 | 依赖 orders；第 1 批已改好复合 FK |
| **3** | revenues, inventory_transactions, expenses | 3 | 无依赖其他 merchant 表 |
| **4** | categories, carts, partners, suppliers, store_addresses, equipment, merchant_settings, news, offers, preorders, print_temps, tax_return_reports, webhooks_events_airwallex, product_barcodes | 14 | 无依赖（或仅 platform/用户）；根表 |
| **5** | products, partner_addresses, equipment_depreciation_records, tax_return_report_audit_logs, print_temp_elements, print_temp_cache, print_temp_script_history, print_temp_usage_logs | 8 | products→categories；partner_addresses→partners；equipment_depreciation→equipment；audit_logs→tax_return_reports；print_temp_*→print_temps |
| **6** | partner_invoice_summaries | 1 | 依赖 partners, partner_addresses |
| **7** | partner_invoices, product_inventory, product_option_groups, offer_products, cart_items, preorder_promotes | 6 | partner_invoices→partner, address, summary；product_inventory/product_option_groups/offer_products→products；cart_items→carts+products；preorder_promotes→preorders |
| **8** | product_options, products_preorderable | 2 | product_options→product_option_groups；products_preorderable→products（及 preorder_promotes） |

**合计**：8 批、40 张表。顺序不可颠倒（被依赖表所在批必须早于依赖表）。  
**建议**：先做完第 1～4 批（订单链 + 收入/费用/库存 + 根表），验证稳定后再做第 5～8 批（商品/合作方/打印/预购等）。

---

## 📦 第二部分：数据归档策略

### 归档维度与索引约定

- **按创建日期归档**：归档条件统一按 `created_at`（或业务日期如 `revenue_date`）做时间 cutoff，例如「主表只保留最近 12 个月，更早的迁入归档表」。归档表可按 `created_at` 做 RANGE 分区（如按月），便于按时间段管理和清理。
- **索引**：主表与归档表都建议建 **`(merchant_id, created_at)`** 索引（或对应业务日期列），便于：
  - 归档任务按时间范围扫描/迁移时走索引；
  - 后续按「某商户 + 创建日期范围」查询主表或归档表时走索引，查询性能稳定。

### 2.1 归档表分类

#### 1. 订单相关表（高优先级归档）

归档条件：已完成/已取消/已退款/已删除的订单，且超过12个月

| 表名 | 归档条件 | 保留时间 | 归档频率 |
|------|---------|----------|----------|
| `orders` | `status IN ('delivered', 'cancelled', 'refunded', 'deleted')` AND `created_at < NOW() - INTERVAL '12 months'` | 主表保留12个月 | 1年1次 |
| `order_items` | 跟随订单归档（通过 `order_id` 关联） | 主表保留12个月 | 1年1次 |
| `order_status_transitions` | 已完成订单的状态转换（通过 `order_id` 关联） | 主表保留12个月 | 1年1次 |
| `order_payment_records` | 已完成订单的支付记录（通过 `order_id` 关联） | 主表保留12个月 | 1年1次 |

**归档原因**：
- ✅ 已完成订单查询频率低
- ✅ 数据量大，归档可显著减少主表数据量（减少80-90%）
- ✅ 归档后仍可查询历史数据

#### 2. 财务相关表（中优先级归档）

归档条件：超过2-3年的历史数据（财务数据通常需要保留更久）

| 表名 | 归档条件 | 保留时间 | 归档频率 |
|------|---------|----------|----------|
| `revenues` | `revenue_date < NOW() - INTERVAL '2 years'` | 主表保留2年 | 1年1次 |
| `expenses` | `expense_date < NOW() - INTERVAL '2 years'` | 主表保留2年 | 1年1次 |

**归档原因**：
- ✅ 财务数据需要长期保留（税务要求可能7年）
- ✅ 但近期数据查询频率高，远期数据可以归档
- ✅ 归档后仍可查询历史报表

#### 3. 库存交易表（中优先级归档）

归档条件：已完成订单相关的库存交易，且超过12个月

| 表名 | 归档条件 | 保留时间 | 归档频率 |
|------|---------|----------|----------|
| `inventory_transactions` | `order_id IS NOT NULL` AND `created_at < NOW() - INTERVAL '12 months'` AND 关联订单已完成 | 主表保留12个月 | 1年1次 |

**归档原因**：
- ✅ 订单相关的库存交易在订单完成后很少查询
- ✅ 手动调整等操作需要保留在主表

#### 4. 设备折旧表（低优先级归档）

归档条件：已完成折旧的设备记录（设备已报废/出售）

| 表名 | 归档条件 | 保留时间 | 归档频率 |
|------|---------|----------|----------|
| `equipment_depreciation_records` | 关联设备状态为已报废/已出售，且折旧完成 | 主表保留所有活跃设备 | 1年1次 |

**归档原因**：
- ✅ 已完成折旧的设备记录查询频率低
- ✅ 但数据量相对较小，优先级较低

### 2.2 归档表设计

#### 归档表命名规范

```
主表名_archive
例如：
- orders → orders_archive
- order_items → order_items_archive
- revenues → revenues_archive
```

#### 归档表结构（按时间分区）

```sql
-- 订单归档表（示例）
CREATE TABLE merchant.orders_archive (
    -- 和主表完全相同的结构
    id UUID NOT NULL,
    merchant_id UUID NOT NULL,
    order_number VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    -- ... 其他字段
    
    -- 主键包含 created_at（用于时间分区）
    PRIMARY KEY (id, merchant_id, created_at)
) PARTITION BY RANGE (created_at);

-- 商户 + 创建日期 索引，便于按商户、时间范围查询归档数据
CREATE INDEX idx_orders_archive_merchant_created ON merchant.orders_archive(merchant_id, created_at);

-- 按月创建分区
CREATE TABLE merchant.orders_archive_2023_01 PARTITION OF merchant.orders_archive
    FOR VALUES FROM ('2023-01-01') TO ('2023-02-01');

CREATE TABLE merchant.orders_archive_2023_02 PARTITION OF merchant.orders_archive
    FOR VALUES FROM ('2023-02-01') TO ('2023-03-01');

-- ... 可以无限添加新月份分区
```

### 2.3 归档实施

#### 归档条件总结

| 表名 | 归档条件 | 保留时间 | 数据量减少 |
|------|---------|----------|-----------|
| `orders` | 已完成订单 + 12个月 | 12个月 | 减少80-90% |
| `order_items` | 跟随订单 | 12个月 | 减少80-90% |
| `order_status_transitions` | 跟随订单 | 12个月 | 减少80-90% |
| `order_payment_records` | 跟随订单 | 12个月 | 减少80-90% |
| `inventory_transactions` | 订单相关 + 12个月 | 12个月 | 减少60-70% |
| `revenues` | 2年前数据 | 2年 | 减少50-60% |
| `expenses` | 2年前数据 | 2年 | 减少50-60% |

#### 归档频率和时机

- **频率**：1年1次
- **时机**：建议在业务低峰期（如年初或年中）
- **执行方式**：定时任务（PostgreSQL pg_cron 或应用层定时任务）

#### 订单归档函数

```sql
-- 归档已完成订单（12个月前）
CREATE OR REPLACE FUNCTION archive_completed_orders()
RETURNS TABLE(archived_orders INTEGER, archived_items INTEGER, archived_transitions INTEGER, archived_payments INTEGER) AS $$
DECLARE
    archive_date TIMESTAMP WITH TIME ZONE;
    order_count INTEGER;
    item_count INTEGER;
    transition_count INTEGER;
    payment_count INTEGER;
BEGIN
    -- 计算归档日期（12个月前）
    archive_date := NOW() - INTERVAL '12 months';
    
    -- 1. 归档订单项
    INSERT INTO merchant.order_items_archive
    SELECT oi.*, o.created_at
    FROM merchant.order_items oi
    INNER JOIN merchant.orders o ON oi.order_id = o.id
    WHERE o.status IN ('delivered', 'cancelled', 'refunded', 'deleted')
      AND o.created_at < archive_date;
    GET DIAGNOSTICS item_count = ROW_COUNT;
    
    -- 2. 归档状态转换
    INSERT INTO merchant.order_status_transitions_archive
    SELECT ost.*, o.created_at
    FROM merchant.order_status_transitions ost
    INNER JOIN merchant.orders o ON ost.order_id = o.id
    WHERE o.status IN ('delivered', 'cancelled', 'refunded', 'deleted')
      AND o.created_at < archive_date;
    GET DIAGNOSTICS transition_count = ROW_COUNT;
    
    -- 3. 归档支付记录
    INSERT INTO merchant.order_payment_records_archive
    SELECT opr.*, o.created_at
    FROM merchant.order_payment_records opr
    INNER JOIN merchant.orders o ON opr.order_id = o.id
    WHERE o.status IN ('delivered', 'cancelled', 'refunded', 'deleted')
      AND o.created_at < archive_date;
    GET DIAGNOSTICS payment_count = ROW_COUNT;
    
    -- 4. 归档订单（最后归档，因为有外键依赖）
    INSERT INTO merchant.orders_archive
    SELECT * FROM merchant.orders
    WHERE status IN ('delivered', 'cancelled', 'refunded', 'deleted')
      AND created_at < archive_date;
    GET DIAGNOSTICS order_count = ROW_COUNT;
    
    -- 5. 删除主表中的归档数据
    DELETE FROM merchant.order_items
    WHERE order_id IN (
        SELECT id FROM merchant.orders_archive
        WHERE created_at < archive_date
    );
    
    DELETE FROM merchant.order_status_transitions
    WHERE order_id IN (
        SELECT id FROM merchant.orders_archive
        WHERE created_at < archive_date
    );
    
    DELETE FROM merchant.order_payment_records
    WHERE order_id IN (
        SELECT id FROM merchant.orders_archive
        WHERE created_at < archive_date
    );
    
    DELETE FROM merchant.orders
    WHERE id IN (
        SELECT id FROM merchant.orders_archive
        WHERE created_at < archive_date
    );
    
    RETURN QUERY SELECT order_count, item_count, transition_count, payment_count;
END;
$$ LANGUAGE plpgsql;
```

#### 收入归档函数

```sql
-- 归档历史收入（2年前）
CREATE OR REPLACE FUNCTION archive_old_revenues()
RETURNS INTEGER AS $$
DECLARE
    archive_date DATE;
    archived_count INTEGER;
BEGIN
    -- 计算归档日期（2年前）
    archive_date := CURRENT_DATE - INTERVAL '2 years';
    
    -- 归档数据
    INSERT INTO merchant.revenues_archive
    SELECT * FROM merchant.revenues
    WHERE revenue_date < archive_date;
    
    GET DIAGNOSTICS archived_count = ROW_COUNT;
    
    -- 删除主表中的归档数据
    DELETE FROM merchant.revenues
    WHERE revenue_date < archive_date;
    
    RETURN archived_count;
END;
$$ LANGUAGE plpgsql;
```

#### 库存交易归档函数

```sql
-- 归档订单相关的库存交易（12个月前）
CREATE OR REPLACE FUNCTION archive_order_inventory_transactions()
RETURNS INTEGER AS $$
DECLARE
    archive_date TIMESTAMP WITH TIME ZONE;
    archived_count INTEGER;
BEGIN
    -- 计算归档日期（12个月前）
    archive_date := NOW() - INTERVAL '12 months';
    
    -- 归档订单相关的库存交易
    INSERT INTO merchant.inventory_transactions_archive
    SELECT it.*, it.created_at
    FROM merchant.inventory_transactions it
    INNER JOIN merchant.orders o ON it.order_id = o.id
    WHERE it.order_id IS NOT NULL
      AND o.status IN ('delivered', 'cancelled', 'refunded', 'deleted')
      AND it.created_at < archive_date;
    
    GET DIAGNOSTICS archived_count = ROW_COUNT;
    
    -- 删除主表中的归档数据
    DELETE FROM merchant.inventory_transactions
    WHERE id IN (
        SELECT id FROM merchant.inventory_transactions_archive
        WHERE created_at < archive_date
    );
    
    RETURN archived_count;
END;
$$ LANGUAGE plpgsql;
```

### 2.4 归档后的查询策略

#### 联合查询主表和归档表

```typescript
// 查询订单（包含归档数据）
async getOrderById(id: string, merchantId: string, includeArchived: boolean = false) {
  if (includeArchived) {
    // 先查主表
    let order = await this.orderRepo.findOne({ where: { id, merchantId } });
    
    // 如果主表没有，查归档表
    if (!order) {
      order = await this.orderArchiveRepo.findOne({ where: { id, merchantId } });
    }
    
    return order;
  } else {
    // 只查主表
    return await this.orderRepo.findOne({ where: { id, merchantId } });
  }
}

// 查询历史报表（需要联合查询）
async getRevenueReport(startDate: Date, endDate: Date, merchantId: string) {
  // 查询主表
  const mainRevenues = await this.revenueRepo.find({
    where: {
      merchantId,
      revenueDate: Between(startDate, endDate)
    }
  });
  
  // 查询归档表（如果需要）
  const archivedRevenues = await this.revenueArchiveRepo.find({
    where: {
      merchantId,
      revenueDate: Between(startDate, endDate)
    }
  });
  
  return [...mainRevenues, ...archivedRevenues];
}
```

---

## 🎯 第三部分：实施计划

### 3.1 阶段划分

#### Phase 1: Schema 拆分（当前阶段）

1. 创建 `platform` schema
2. 创建 `merchant` schema
3. 迁移平台表到 `platform` schema
4. 迁移商户表到 `merchant` schema
5. 为所有商户表添加 `merchant_id` 字段

#### Phase 2: 表分区（后续阶段）

1. 为高优先级表创建分区表结构
2. 迁移数据到分区表
3. 更新应用层代码（主键包含 merchant_id）
4. 测试查询性能

#### Phase 3: 数据归档（后续阶段）

1. 创建归档表结构
2. 实现归档函数
3. 设置定时任务
4. 实现联合查询逻辑

### 3.2 分区实施步骤

#### 步骤1：创建分区表结构

```sql
-- 1. 创建新的分区表（orders 示例）
CREATE TABLE merchant.orders_new (
    -- 和原表相同的结构，但主键包含 merchant_id
    PRIMARY KEY (id, merchant_id)
) PARTITION BY HASH (merchant_id);

-- 2. 创建分区
-- ... 创建50个分区

-- 3. 迁移数据
INSERT INTO merchant.orders_new 
SELECT * FROM merchant.orders;

-- 4. 重命名
ALTER TABLE merchant.orders RENAME TO orders_old;
ALTER TABLE merchant.orders_new RENAME TO orders;
```

#### 步骤2：应用层适配

```typescript
// Repository 查询需要包含 merchant_id
async findOne(id: string, merchantId: string) {
  return this.repository.findOne({ 
    where: { id, merchantId }  // 必须同时提供
  });
}
```

### 3.3 归档实施步骤

#### 步骤1：创建归档表

```sql
-- 创建归档表（按月分区）
CREATE TABLE merchant.orders_archive (
    -- 和主表相同的结构
    PRIMARY KEY (id, merchant_id, created_at)
) PARTITION BY RANGE (created_at);
```

#### 步骤2：实现归档函数

```sql
-- 创建归档函数
CREATE OR REPLACE FUNCTION archive_completed_orders() ...
```

#### 步骤3：设置定时任务

```typescript
// 应用层定时任务（每年执行一次）
// 建议在年初或年中业务低峰期执行
cron.schedule('0 2 1 1 *', async () => {
  await archiveCompletedOrders();
});
```

---

## 📊 第四部分：收益总结

### 4.1 分区收益

| 表名 | 分区前单分区数据量 | 分区后单分区数据量 | 性能提升 |
|------|------------------|------------------|---------|
| `orders` | 5亿 | 1000万 | 5倍 |
| `order_items` | 15亿 | 3000万 | 5倍 |
| `order_status_transitions` | 20亿 | 4000万 | 5倍 |
| `revenues` | 7.5-10亿 | 1500-2000万 | 5倍 |
| `inventory_transactions` | 40亿 | 8000万 | 5倍 |

### 4.2 归档收益

| 表名 | 归档前数据量 | 归档后数据量 | 减少比例 |
|------|------------|------------|---------|
| `orders` | 5亿 | 5000万-1亿 | 80-90% |
| `order_items` | 15亿 | 1.5亿-3亿 | 80-90% |
| `order_status_transitions` | 20亿 | 2亿-4亿 | 80-90% |
| `order_payment_records` | 7.5亿 | 7500万-1.5亿 | 80-90% |
| `inventory_transactions` | 40亿 | 12亿-16亿 | 60-70% |
| `revenues` | 7.5-10亿 | 3-5亿 | 50-60% |

### 4.3 综合收益

**分区 + 归档后**：
- 主表数据量减少：80-90%
- 单分区数据量：从5亿减少到100-200万
- 查询性能提升：10-20倍
- 维护成本降低：VACUUM、索引维护时间大幅减少

---

## 📝 第五部分：注意事项

### 5.1 分区注意事项

1. **主键必须包含分区键**：所有分区表的主键必须包含 `merchant_id`
2. **外键限制**：分区表不能有外键，需要在应用层保证数据一致性
3. **唯一约束**：唯一约束必须包含分区键
4. **查询优化**：尽量在查询中包含 `merchant_id`，避免跨分区查询

### 5.2 归档注意事项

1. **归档时机**：选择业务低峰期执行，避免影响业务
2. **数据一致性**：归档时需要保证关联表的数据一致性
3. **查询兼容**：需要实现联合查询逻辑，支持查询归档数据
4. **备份策略**：归档前需要备份数据，确保可以恢复

### 5.3 监控建议

1. **分区监控**：定期检查分区数据量，确保单分区不超过1000万行
2. **归档监控**：监控归档执行时间和影响的数据量
3. **性能监控**：监控查询性能，确保分区和归档后性能提升

---

## 📚 相关文档

- [多租户平台改造实施指南](./multi-tenant-development-release-plan.md)
- [多租户数据库设计方案](../docs/multi-tenant/multi-tenant-database-design.md)
- [数据库优化指南](../docs/multi-tenant/database-optimization-guide.md)

---

## 🎯 总结

### 分区策略

- 需分区的表**统一 50 分区**（同一 modulus，同一商户在各表落在同一分区编号）
- 分区后单分区数据量配合归档控制在可接受范围内（如千万行量级）

### 归档策略

- **4张表**立即实施归档（订单相关）
- **3张表**后续实施归档（财务和库存）
- 归档频率：1年1次
- 归档后主表数据量减少80-90%

### 实施顺序

1. **当前阶段**：Schema 拆分
2. **后续阶段**：表分区
3. **后续阶段**：数据归档



