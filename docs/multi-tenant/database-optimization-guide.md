# 多租户数据库优化指南：分区与系统级表处理

## 📋 概述

本文档整合了多租户数据库优化的核心内容，包括：
- 表分区详解与实施
- 分区策略与最佳实践
- 分区查询性能优化
- 系统级表处理方案

---

## 📊 第一部分：表分区详解

### 什么是表分区？

表分区是将一个大表**物理分割**成多个小表（分区），但逻辑上仍然是一个表。

#### 简单类比

```
想象一个图书馆：

❌ 不分区：所有书都放在一个巨大的书架上
   - 找书慢（需要扫描整个书架）
   - 维护困难（整理、清理都很慢）

✅ 分区：按类别分成多个书架（历史、文学、科技...）
   - 找书快（直接去对应书架）
   - 维护简单（只需要整理相关书架）
```

#### 数据库中的分区

```sql
-- 原始大表（假设有 1000 万条订单）
orders (10,000,000 rows)
├── 查询某个商户的订单：需要扫描 1000 万行
├── 索引很大：维护成本高
└── VACUUM 操作：耗时很长

-- 分区后（按 merchant_id 分成 10 个分区）
orders (分区表)
├── orders_partition_0 (1,000,000 rows) - merchant_id % 10 = 0
├── orders_partition_1 (1,000,000 rows) - merchant_id % 10 = 1
├── orders_partition_2 (1,000,000 rows) - merchant_id % 10 = 2
└── ... (其他分区)

-- 查询某个商户的订单：只需要扫描对应的分区（100 万行）
-- 性能提升：10 倍！
```

---

### 为什么选择 500 万行作为阈值？

#### 性能测试数据参考

| 表大小 | 单商户查询性能 | 索引维护 | VACUUM 耗时 | 建议 |
|--------|---------------|---------|------------|------|
| < 100 万行 | ✅ 优秀 (< 10ms) | ✅ 快速 | ✅ < 1 分钟 | 不需要分区 |
| 100-500 万行 | ✅ 良好 (10-50ms) | ✅ 正常 | ✅ 1-5 分钟 | 监控，优化索引 |
| 500-1000 万行 | ⚠️ 变慢 (50-200ms) | ⚠️ 变慢 | ⚠️ 5-30 分钟 | **考虑分区** |
| > 1000 万行 | ❌ 很慢 (> 200ms) | ❌ 很慢 | ❌ > 30 分钟 | **强烈建议分区** |

#### 500 万行的实际意义

**对于你的订单表（orders）**：
```
假设：
- 每个订单平均 200 字节
- 500 万行 = 500万 × 200字节 = 1GB（仅数据）
- 加上索引：约 2-3GB

性能影响：
- 单商户查询（有 merchant_id 索引）：仍然较快（20-50ms）
- 全表扫描：很慢（几秒到几十秒）
- 索引维护：开始变慢（每次 INSERT/UPDATE 都要更新大索引）
- VACUUM：需要更长时间（清理死元组）
```

**500 万行是一个经验值**：
- 在这个规模下，PostgreSQL 仍然能良好工作
- 但超过这个规模，性能开始明显下降
- 分区可以显著提升性能（10-100 倍）

---

### 如何监控表大小？

#### 方法 1：SQL 查询（推荐）

```sql
-- 查看所有表的大小（按大小排序）
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 查看表的行数
SELECT 
    schemaname,
    tablename,
    n_live_tup AS row_count,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;

-- 查看特定表的详细信息
SELECT 
    'orders' AS table_name,
    COUNT(*) AS row_count,
    pg_size_pretty(pg_total_relation_size('orders')) AS total_size,
    pg_size_pretty(pg_relation_size('orders')) AS table_size,
    pg_size_pretty(pg_indexes_size('orders')) AS indexes_size
FROM orders;
```

#### 方法 2：创建监控视图

```sql
-- 创建监控视图
CREATE OR REPLACE VIEW table_size_monitor AS
SELECT 
    schemaname,
    tablename,
    n_live_tup AS row_count,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes,
    CASE 
        WHEN n_live_tup > 5000000 THEN '⚠️ 需要分区'
        WHEN n_live_tup > 1000000 THEN '⚠️ 监控中'
        ELSE '✅ 正常'
    END AS status
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;

-- 查询监控视图
SELECT * FROM table_size_monitor;
```

#### 方法 3：定时任务监控

```typescript
// 监控脚本：monitor-table-sizes.ts
import { DataSource } from 'typeorm';

async function monitorTableSizes(dataSource: DataSource) {
  const result = await dataSource.query(`
    SELECT 
      tablename,
      n_live_tup AS row_count,
      pg_size_pretty(pg_total_relation_size('public.' || tablename)) AS size
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY n_live_tup DESC
  `);

  console.log('📊 表大小监控报告:');
  result.forEach((row: any) => {
    const rowCount = parseInt(row.row_count);
    const status = rowCount > 5000000 ? '⚠️ 需要分区' : 
                   rowCount > 1000000 ? '⚠️ 监控中' : '✅ 正常';
    
    console.log(`${row.tablename}: ${row.row_count} 行, ${row.size} - ${status}`);
    
    // 发送告警（如果超过阈值）
    if (rowCount > 5000000) {
      console.warn(`⚠️ 警告: ${row.tablename} 超过 500 万行，建议考虑分区！`);
    }
  });
}

// 可以设置为定时任务（每天执行一次）
```

---

### PostgreSQL 分区类型

PostgreSQL 支持三种分区方式：

#### 1. 范围分区（Range Partitioning）

按值的范围分区，适合时间序列数据。

```sql
-- 示例：按创建时间分区（每月一个分区）
CREATE TABLE orders (
    id UUID PRIMARY KEY,
    merchant_id UUID NOT NULL,
    order_number VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    -- ... 其他字段
) PARTITION BY RANGE (created_at);

-- 创建分区
CREATE TABLE orders_2024_01 PARTITION OF orders
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE orders_2024_02 PARTITION OF orders
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- 查询时自动路由到对应分区
SELECT * FROM orders 
WHERE merchant_id = 'xxx' 
AND created_at >= '2024-01-01' 
AND created_at < '2024-02-01';
-- PostgreSQL 自动只查询 orders_2024_01 分区
```

#### 2. 列表分区（List Partitioning）

按值的列表分区，适合固定值。

```sql
-- 示例：按订单状态分区
CREATE TABLE orders (
    id UUID PRIMARY KEY,
    merchant_id UUID NOT NULL,
    status VARCHAR(30) NOT NULL,
    -- ... 其他字段
) PARTITION BY LIST (status);

-- 创建分区
CREATE TABLE orders_active PARTITION OF orders
    FOR VALUES IN ('pending_payment', 'paid', 'processing');

CREATE TABLE orders_completed PARTITION OF orders
    FOR VALUES IN ('delivered', 'cancelled', 'refunded');
```

#### 3. 哈希分区（Hash Partitioning）⭐ **推荐用于多租户**

按哈希值分区，数据均匀分布。

```sql
-- 示例：按 merchant_id 哈希分区（推荐！）
CREATE TABLE orders (
    id UUID PRIMARY KEY,
    merchant_id UUID NOT NULL,
    order_number VARCHAR(50) NOT NULL,
    -- ... 其他字段
) PARTITION BY HASH (merchant_id);

-- 创建 10 个分区（可以根据商户数量调整）
CREATE TABLE orders_partition_0 PARTITION OF orders
    FOR VALUES WITH (modulus 10, remainder 0);

CREATE TABLE orders_partition_1 PARTITION OF orders
    FOR VALUES WITH (modulus 10, remainder 1);

-- ... 创建其他分区（remainder 2-9）

-- 查询时自动路由
SELECT * FROM orders WHERE merchant_id = 'xxx';
-- PostgreSQL 自动计算哈希，只查询对应分区
```

---

### 分区的优缺点

#### ✅ 优点

1. **查询性能大幅提升**
   - 单商户查询：从扫描 5000 万行 → 只扫描 500 万行（10 倍提升）
   - 索引更小：每个分区的索引独立，维护更快

2. **维护操作更快**
   - VACUUM：可以按分区执行，不影响其他分区
   - 备份：可以按分区备份
   - 删除：可以快速删除整个分区（比如删除旧数据）

3. **扩展性好**
   - 可以轻松添加新分区
   - 可以将分区迁移到不同磁盘（如果硬件支持）

#### ❌ 缺点

1. **复杂性增加**
   - 表结构更复杂
   - 需要管理多个分区
   - 迁移脚本需要处理分区

2. **跨分区查询变慢**
   - 如果查询涉及多个分区，性能可能不如单表
   - 但你的场景主要是单商户查询，影响不大

3. **主键约束变化**
   - 分区键（merchant_id）必须在主键中
   - 应用层查询主键时需要包含 merchant_id

4. **外键限制**
   - 分区表不能有外键（但可以反过来，其他表引用分区表）

---

### 分区的动态扩展

#### 关键问题：分区是一次性的吗？

**答案：不是！但扩展方式取决于分区类型。**

#### 1. 哈希分区（Hash Partitioning）的扩展 ⚠️

**问题：哈希分区扩展困难**

```sql
-- 初始：10 个分区
CREATE TABLE orders PARTITION BY HASH (merchant_id);
CREATE TABLE orders_part_0 PARTITION OF orders
    FOR VALUES WITH (modulus 10, remainder 0);
-- ... 其他 9 个分区

-- ❌ 不能直接添加新分区！
-- 因为哈希算法是基于 modulus（模数）的
-- 如果从 10 个分区扩展到 20 个分区，modulus 从 10 变成 20
-- 所有现有数据的哈希值会改变，需要重新分布！
```

**扩展哈希分区的方案**

**方案 A：重新创建表（推荐用于小数据量）**

```sql
-- 1. 创建新的分区表（20 个分区）
CREATE TABLE orders_new (
    -- ... 表结构
) PARTITION BY HASH (merchant_id);

-- 创建 20 个新分区
CREATE TABLE orders_new_part_0 PARTITION OF orders_new
    FOR VALUES WITH (modulus 20, remainder 0);
-- ... 创建其他 19 个分区

-- 2. 迁移数据（会重新分布）
INSERT INTO orders_new SELECT * FROM orders;

-- 3. 切换表名
ALTER TABLE orders RENAME TO orders_old;
ALTER TABLE orders_new RENAME TO orders;

-- 4. 删除旧表
DROP TABLE orders_old;
```

**方案 B：预先规划足够的分区数**

```sql
-- 一开始就创建足够多的分区（比如 20-50 个）
-- 即使现在数据少，每个分区空着也没关系
-- 这样就不需要后续扩展了
```

#### 2. 范围分区（Range Partitioning）的扩展 ✅

**优势：可以轻松添加新分区**

```sql
-- 初始：按月分区
CREATE TABLE orders PARTITION BY RANGE (created_at);
CREATE TABLE orders_2024_01 PARTITION OF orders
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
CREATE TABLE orders_2024_02 PARTITION OF orders
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- ✅ 轻松添加新分区（不需要迁移数据）
CREATE TABLE orders_2024_03 PARTITION OF orders
    FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');

-- ✅ 甚至可以添加未来分区
CREATE TABLE orders_2024_04 PARTITION OF orders
    FOR VALUES FROM ('2024-04-01') TO ('2024-05-01');
```

**自动添加分区的函数**

```sql
CREATE OR REPLACE FUNCTION create_monthly_partition()
RETURNS void AS $$
DECLARE
    next_month DATE;
    partition_name TEXT;
BEGIN
    -- 计算下个月
    next_month := DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month';
    partition_name := 'orders_' || TO_CHAR(next_month, 'YYYY_MM');
    
    -- 检查分区是否已存在
    IF NOT EXISTS (
        SELECT 1 FROM pg_class WHERE relname = partition_name
    ) THEN
        -- 创建分区
        EXECUTE format(
            'CREATE TABLE %I PARTITION OF orders FOR VALUES FROM (%L) TO (%L)',
            partition_name,
            next_month,
            next_month + INTERVAL '1 month'
        );
        RAISE NOTICE 'Created partition: %', partition_name;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 可以设置为定时任务（每月执行一次）
```

---

## 📊 第二部分：分区策略总结

### 推荐方案：主表 + 归档表（推荐）⭐

#### 主表（orders）：按 merchant_id 哈希分区

```sql
-- 主表：存储最近 N 个月的数据（比如 12 个月）
CREATE TABLE orders (
    id UUID NOT NULL,
    merchant_id UUID NOT NULL,
    order_number VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    -- ... 其他字段
    PRIMARY KEY (id, merchant_id)
) PARTITION BY HASH (merchant_id);

-- 创建 50 个分区（足够支持 500 个商户）
DO $$
DECLARE
    i INTEGER;
BEGIN
    FOR i IN 0..49 LOOP
        EXECUTE format(
            'CREATE TABLE orders_part_%s PARTITION OF orders 
             FOR VALUES WITH (modulus 50, remainder %s)',
            i, i
        );
    END LOOP;
END $$;

-- 优势：
-- ✅ 每个分区数据量可控（每个分区约 100 万订单）
-- ✅ 查询性能优秀
-- ✅ 不需要后续扩展
```

#### 归档表（orders_archive）：按时间范围分区

```sql
-- 归档表：存储历史数据（12 个月以前的数据）
CREATE TABLE orders_archive (
    id UUID NOT NULL,
    merchant_id UUID NOT NULL,
    order_number VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    -- ... 其他字段（和主表完全一致）
    PRIMARY KEY (id, merchant_id, created_at)  -- 注意：包含 created_at
) PARTITION BY RANGE (created_at);

-- 按月创建分区（可以轻松添加）
CREATE TABLE orders_archive_2023_01 PARTITION OF orders_archive
    FOR VALUES FROM ('2023-01-01') TO ('2023-02-01');

CREATE TABLE orders_archive_2023_02 PARTITION OF orders_archive
    FOR VALUES FROM ('2023-02-01') TO ('2023-03-01');

-- ... 可以无限添加新月份分区

-- 优势：
-- ✅ 可以轻松添加新分区（不需要迁移数据）
-- ✅ 可以轻松删除旧分区（归档到冷存储）
-- ✅ 查询历史数据时性能好
```

---

### 数据归档流程

#### 定期归档任务（每月执行一次）

```sql
-- 归档函数：将 12 个月前的数据从主表移到归档表
CREATE OR REPLACE FUNCTION archive_old_orders()
RETURNS void AS $$
DECLARE
    archive_date DATE;
    affected_rows INTEGER;
BEGIN
    -- 计算归档日期（12 个月前）
    archive_date := DATE_TRUNC('month', CURRENT_DATE - INTERVAL '12 months');
    
    -- 确保归档表有对应的月份分区
    PERFORM create_archive_partition_if_not_exists(archive_date);
    
    -- 迁移数据
    INSERT INTO orders_archive
    SELECT * FROM orders
    WHERE created_at < archive_date;
    
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    
    -- 删除主表中的旧数据
    DELETE FROM orders
    WHERE created_at < archive_date;
    
    RAISE NOTICE 'Archived % rows to orders_archive', affected_rows;
END;
$$ LANGUAGE plpgsql;

-- 自动创建归档分区（如果不存在）
CREATE OR REPLACE FUNCTION create_archive_partition_if_not_exists(partition_date DATE)
RETURNS void AS $$
DECLARE
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
BEGIN
    start_date := DATE_TRUNC('month', partition_date);
    end_date := start_date + INTERVAL '1 month';
    partition_name := 'orders_archive_' || TO_CHAR(start_date, 'YYYY_MM');
    
    -- 检查分区是否已存在
    IF NOT EXISTS (
        SELECT 1 FROM pg_class WHERE relname = partition_name
    ) THEN
        -- 创建分区
        EXECUTE format(
            'CREATE TABLE %I PARTITION OF orders_archive 
             FOR VALUES FROM (%L) TO (%L)',
            partition_name, start_date, end_date
        );
        RAISE NOTICE 'Created archive partition: %', partition_name;
    END IF;
END;
$$ LANGUAGE plpgsql;
```

#### 定时任务设置

```typescript
// 可以设置为每月 1 号凌晨执行
// 使用 cron 或 PostgreSQL 的 pg_cron 扩展

-- 使用 pg_cron（如果已安装）
SELECT cron.schedule(
    'archive-old-orders',
    '0 2 1 * *',  -- 每月 1 号凌晨 2 点
    'SELECT archive_old_orders();'
);
```

---

### 如果主表还是太大怎么办？

#### 方案 1：缩短主表保留时间

```sql
-- 从 12 个月缩短到 6 个月
-- 主表数据量减半：3000 万订单
-- 50 个分区 = 每个分区 60 万订单
-- 性能：✅ 优秀
```

#### 方案 2：增加主表分区数

```sql
-- 从 50 个分区增加到 100 个分区
-- 6000 万订单 ÷ 100 分区 = 每个分区 60 万订单
-- 性能：✅ 优秀
```

#### 方案 3：混合分区（主表也按时间分区）

```sql
-- 主表：先按时间分区，再按 merchant_id 子分区
-- 这样时间分区可以轻松添加，不需要迁移数据
CREATE TABLE orders PARTITION BY RANGE (created_at);

-- 每月一个分区
CREATE TABLE orders_2024_01 PARTITION OF orders
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01')
    PARTITION BY HASH (merchant_id);

-- 每个月份分区再按 merchant_id 分成 10 个子分区
CREATE TABLE orders_2024_01_part_0 PARTITION OF orders_2024_01
    FOR VALUES WITH (modulus 10, remainder 0);
-- ... 其他子分区

-- 优势：
-- ✅ 时间分区可以轻松添加（每月自动添加）
-- ✅ 每个月份分区内部按商户哈希，性能好
-- ✅ 可以轻松删除旧月份分区（移到归档表）
```

---

## 📊 第三部分：分区查询性能优化

### 核心答案：SQL 查询没有区别！

PostgreSQL 的分区是**透明的**，应用层代码完全不需要知道底层有分区。

---

### 混合分区（时间+哈希）的查询复杂度

#### 场景对比

**方案 A：单层哈希分区**

```sql
-- 表结构
CREATE TABLE orders PARTITION BY HASH (merchant_id);
CREATE TABLE orders_part_0 PARTITION OF orders ...;
CREATE TABLE orders_part_1 PARTITION OF orders ...;

-- 应用层查询（完全正常）
SELECT * FROM orders WHERE merchant_id = 'xxx';
```

**方案 B：混合分区（时间+哈希）**

```sql
-- 表结构
CREATE TABLE orders PARTITION BY RANGE (created_at);
CREATE TABLE orders_2024_01 PARTITION OF orders
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01')
    PARTITION BY HASH (merchant_id);
CREATE TABLE orders_2024_01_part_0 PARTITION OF orders_2024_01 ...;
CREATE TABLE orders_2024_01_part_1 PARTITION OF orders_2024_01 ...;

-- 应用层查询（完全一样！）
SELECT * FROM orders WHERE merchant_id = 'xxx';
```

#### 关键点：PostgreSQL 自动路由

```sql
-- 你的查询（应用层）
SELECT * FROM orders 
WHERE merchant_id = 'xxx' 
AND created_at >= '2024-01-01' 
AND created_at < '2024-02-01';

-- PostgreSQL 内部执行（自动优化）
-- 1. 根据 created_at 条件，只查询 orders_2024_01 分区
-- 2. 根据 merchant_id 哈希，只查询 orders_2024_01_part_X 子分区
-- 3. 只扫描一个子分区，性能最优！

-- 你完全不需要知道底层有分区！
```

---

### 查询性能对比

#### 场景：查询某个商户 1 月份的订单

**单层哈希分区**

```sql
-- 表：orders（5000 万行，50 个分区）
-- 查询
SELECT * FROM orders 
WHERE merchant_id = 'xxx' 
AND created_at >= '2024-01-01' 
AND created_at < '2024-02-01';

-- PostgreSQL 执行：
-- 1. 根据 merchant_id 哈希，定位到 orders_part_X 分区
-- 2. 扫描该分区（100 万行）
-- 3. 过滤 created_at 条件
-- 性能：扫描 100 万行，过滤后得到 1 万行
```

**混合分区（时间+哈希）**

```sql
-- 表：orders（5000 万行）
--    - 主分区：按月（12 个）
--    - 子分区：按 merchant_id（每个月份 10 个子分区）
-- 查询
SELECT * FROM orders 
WHERE merchant_id = 'xxx' 
AND created_at >= '2024-01-01' 
AND created_at < '2024-02-01';

-- PostgreSQL 执行：
-- 1. 根据 created_at 条件，只查询 orders_2024_01 分区
-- 2. 根据 merchant_id 哈希，只查询 orders_2024_01_part_X 子分区
-- 3. 扫描该子分区（50 万行）
-- 性能：扫描 50 万行，直接得到 1 万行（性能更好！）
```

#### 性能对比表

| 场景 | 单层哈希分区 | 混合分区（时间+哈希） |
|------|------------|---------------------|
| **有时间条件** | 扫描 100 万行 | 扫描 50 万行（快 2 倍）✅ |
| **无时间条件** | 扫描 100 万行 | 扫描所有月份（可能更慢）❌ |
| **查询复杂度** | 简单 | 简单（SQL 一样）✅ |
| **扩展性** | 困难 | 容易（时间分区可添加）✅ |

---

### 归档表查询 API 设计

#### 推荐方案：统一接口 + 智能路由（推荐）⭐

```typescript
// 单个 API，自动路由到主表或归档表
GET /api/orders?merchantId=xxx&startDate=2023-01-01&endDate=2024-01-01

// Service 层自动判断
class OrderService {
  async findOrders(params: {
    merchantId: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const now = new Date();
    const archiveDate = subMonths(now, 12); // 12 个月前
    
    // 如果查询范围包含归档数据
    if (params.startDate && params.startDate < archiveDate) {
      // 查询归档表
      const archivedOrders = await this.orderArchiveRepo.find({
        where: {
          merchantId: params.merchantId,
          createdAt: Between(params.startDate, archiveDate)
        }
      });
      
      // 查询主表
      const recentOrders = await this.orderRepo.find({
        where: {
          merchantId: params.merchantId,
          createdAt: Between(archiveDate, params.endDate || now)
        }
      });
      
      // 合并结果
      return [...archivedOrders, ...recentOrders];
    } else {
      // 只查询主表
      return await this.orderRepo.find({
        where: {
          merchantId: params.merchantId,
          createdAt: params.startDate 
            ? Between(params.startDate, params.endDate || now)
            : undefined
        }
      });
    }
  }
}
```

**优势**：
- ✅ 用户体验好：一个接口查询所有数据
- ✅ 代码简单：自动判断，不需要前端区分
- ✅ 维护方便：逻辑集中

---

## 📊 第四部分：系统级表处理方案

### 问题描述

使用 `MerchantRepository` 强制过滤 `merchant_id` 时，对于**系统级表**（没有 `merchant_id` 字段）会出现什么问题？

---

### 系统级表识别

系统级表是指**平台级别**的表，不属于任何商户，不需要 `merchant_id` 字段：

#### 1. 商户管理表

```sql
-- merchants 表本身
CREATE TABLE merchants (
    id UUID PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL,
    -- 没有 merchant_id 字段
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### 2. 平台设置表

```sql
-- platform_settings 表
CREATE TABLE platform_settings (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) UNIQUE NOT NULL,
    settings JSONB NOT NULL,
    -- 没有 merchant_id 字段（全局设置）
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 3. 其他系统级表

- `merchant_subscriptions`（商户订阅）- 平台管理表
- `system_logs`（系统日志）- 如果设计为全局
- `news`（新闻公告）- 如果设计为全局
- `shared_templates`（共享模板）- 如果设计为全局

---

### 问题场景

#### 场景 1：直接使用 MerchantRepository 查询系统级表

```typescript
// ❌ 错误示例
const platformSettingRepo = new MerchantRepository(
  dataSource.getRepository(PlatformSetting),
  merchantId  // 传入 merchantId
);

// 尝试查询平台设置
const setting = await platformSettingRepo.findOne('shipping');
// 生成的 SQL：
// SELECT * FROM platform_settings 
// WHERE id = 'shipping' AND merchant_id = 'xxx'
// ❌ 错误：platform_settings 表没有 merchant_id 字段！
// PostgreSQL 会报错：column "merchant_id" does not exist
```

---

### 解决方案：混合 Repository 架构

#### 架构设计

```typescript
// repositories/merchant.repository.ts
/**
 * 商户级 Repository
 * 用于有 merchant_id 字段的业务表
 */
export class MerchantRepository<T> {
  constructor(
    private repository: Repository<T>,
    private merchantId: string  // 必须提供
  ) {
    if (!merchantId) {
      throw new Error('MerchantRepository requires merchantId');
    }
  }

  async findOne(id: string): Promise<T | null> {
    return this.repository.findOne({ 
      where: { id, merchantId: this.merchantId } as any 
    });
  }

  createQueryBuilder(alias: string) {
    const qb = this.repository.createQueryBuilder(alias);
    qb.where(`${alias}.merchantId = :merchantId`, { 
      merchantId: this.merchantId 
    });
    return qb;
  }

  async find(options?: any): Promise<T[]> {
    return this.repository.find({
      ...options,
      where: {
        ...options?.where,
        merchantId: this.merchantId
      }
    });
  }
}

// repositories/system.repository.ts
/**
 * 系统级 Repository
 * 用于没有 merchant_id 字段的系统表
 */
export class SystemRepository<T> {
  constructor(private repository: Repository<T>) {}

  async findOne(id: string | number, where?: any): Promise<T | null> {
    const whereClause = where || { id };
    return this.repository.findOne({ where: whereClause as any });
  }

  createQueryBuilder(alias: string) {
    // 不添加 merchant_id 过滤
    return this.repository.createQueryBuilder(alias);
  }

  async find(options?: any): Promise<T[]> {
    return this.repository.find(options);
  }

  async save(entity: T): Promise<T> {
    return this.repository.save(entity);
  }

  async delete(id: string | number): Promise<void> {
    await this.repository.delete(id);
  }
}
```

#### 使用示例

```typescript
// 商户级表：使用 MerchantRepository
export class ProductService {
  private productRepo: MerchantRepository<Product>;

  constructor(merchantId: string) {
    const repo = dataSource.getRepository(Product);
    this.productRepo = new MerchantRepository(repo, merchantId);
  }

  async getProduct(id: string): Promise<Product> {
    // 自动过滤 merchant_id
    return await this.productRepo.findOne(id);
  }
}

// 系统级表：使用 SystemRepository
export class PlatformSettingService {
  private settingRepo: SystemRepository<PlatformSetting>;

  constructor() {
    const repo = dataSource.getRepository(PlatformSetting);
    this.settingRepo = new SystemRepository(repo);
  }

  async getSetting(category: string): Promise<PlatformSetting | null> {
    // 不添加 merchant_id 过滤
    return await this.settingRepo.findOne({ category } as any);
  }
}
```

---

### 表分类清单

#### 需要 merchant_id 的表（使用 MerchantRepository）

- ✅ `users` - 用户表
- ✅ `products` - 产品表
- ✅ `categories` - 分类表
- ✅ `orders` - 订单表
- ✅ `order_items` - 订单项表
- ✅ `carts` - 购物车表
- ✅ `offers` - 团购表
- ✅ `preorders` - 预约表
- ✅ `partners` - 合作伙伴表
- ✅ `suppliers` - 供应商表
- ✅ `expenses` - 支出表
- ✅ `equipment` - 设备表
- ✅ `revenues` - 收入表
- ✅ `print_temps` - 打印模板表
- ✅ ... 所有业务表

#### 不需要 merchant_id 的表（使用 SystemRepository）

- ❌ `merchants` - 商户表本身
- ❌ `platform_settings` - 平台设置表
- ❌ `merchant_subscriptions` - 商户订阅表（平台管理）
- ❌ `system_logs` - 系统日志表（如果设计为全局）
- ❌ `news` - 新闻表（如果设计为全局）
- ❌ `shared_templates` - 共享模板表（如果设计为全局）

---

### 安全考虑

#### 系统级表的访问控制

系统级表通常需要**管理员权限**才能访问：

```typescript
// platform-setting.controller.ts
export class PlatformSettingController {
  // 需要管理员权限
  @RequireRole([epUserRole.ADMIN, epUserRole.SUPER_ADMIN])
  async getSettings(req: Request, res: Response) {
    const service = new PlatformSettingService();
    const settings = await service.getAllSettings();
    res.json({ success: true, data: settings });
  }
}
```

#### 商户级表的访问控制

商户级表需要**商户隔离 + 用户权限**：

```typescript
// product.controller.ts
export class ProductController {
  // 需要商户中间件 + 用户权限
  @UseMiddleware(merchantMiddleware)
  @RequireAuth()
  async getProduct(req: MerchantRequest, res: Response) {
    const service = new ProductService(req.merchantId!);
    const product = await service.getProduct(req.params.id);
    res.json({ success: true, data: product });
  }
}
```

---

## 🎯 总结与最佳实践

### 分区策略总结

1. **主表**：按 `merchant_id` 哈希分区，创建 50 个分区（足够支持 500 个商户）
2. **归档表**：按时间范围分区，可以无限添加新月份分区
3. **定期归档**：每月将 12 个月前的数据移到归档表
4. **监控**：定期检查主表分区大小，如果超过 200 万行，考虑缩短保留时间或增加分区数

### 性能预期

```
主表（50 个分区，每个分区 120 万订单）：
- 单商户查询：20-50ms ✅
- 索引维护：快速 ✅
- VACUUM：2-5 分钟 ✅

归档表（按月分区，每个分区 500 万订单）：
- 历史数据查询：30-100ms ✅
- 可以轻松添加新分区 ✅
- 可以轻松删除旧分区（归档到冷存储）✅
```

### 系统级表处理总结

1. **明确分类**：在文档中明确列出哪些表是系统级的
2. **类型安全**：使用不同的 Repository 类型，避免混用
3. **代码审查**：确保系统级表使用 SystemRepository
4. **单元测试**：测试系统级表的查询不会添加 merchant_id 过滤
5. **权限控制**：系统级表需要管理员权限

---

## 📚 相关文档

- [多租户平台改造实施指南](../devGuide/multi-tenant-platform-implementation.md) - 完整实施指南
- [多租户架构方案分析](./multi-tenant-architecture-analysis.md) - 方案对比
- [多商户平台数据库设计方案](./multi-tenant-database-design.md) - 数据库设计

---

## 🔗 参考资源

- PostgreSQL 分区文档：https://www.postgresql.org/docs/current/ddl-partitioning.html
- 分区性能测试：https://www.postgresql.org/docs/current/ddl-partitioning.html#DDL-PARTITIONING-PERFORMANCE
- 分区扩展最佳实践：https://www.postgresql.org/docs/current/ddl-partitioning.html#DDL-PARTITIONING-MAINTENANCE


