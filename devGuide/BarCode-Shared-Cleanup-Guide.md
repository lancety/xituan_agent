# 条形码共享字段清理指南

## 概述

此文档说明如何清理现有的 `barCodeShared` 字段数据，使其符合新的条形码管理逻辑。

## 清理逻辑

### 保留条件

以下情况会保留 `barCodeShared` 值：

1. **其他产品依赖**：如果其他产品的 `barCodeShared` 等于当前产品的 `barCode`
   ```sql
   EXISTS (
     SELECT 1 FROM products p2 
     WHERE p2.bar_code_shared = p1.bar_code 
     AND p2.id != p1.id
   )
   ```

2. **引用其他产品**：如果 `barCodeShared` 不等于自身的 `barCode`
   ```sql
   p1.bar_code_shared != p1.bar_code
   ```

### 清理条件

以下情况会将 `barCodeShared` 设置为 `NULL`：

- `barCodeShared` 等于自身的 `barCode` 且没有其他产品依赖

## 清理脚本说明

### 文件位置
`xituan_backend/migrations/1710000000169_cleanup_barcode_shared_values.sql`

### 执行步骤

#### 测试脚本 (1710000000167)
1. **数据分析**：分析当前 `barCodeShared` 的分布情况
2. **保留分析**：分析哪些产品需要保留
3. **影响统计**：统计清理的影响范围
4. **问题检查**：检查潜在的数据问题
5. **错误验证**：如果发现关键问题，抛出错误并停止 migration

#### 清理脚本 (1710000000169)
1. **创建临时表**：存储需要保留的 `barCodeShared` 值
2. **统计信息**：显示清理前后的数据统计
3. **执行清理**：将不符合条件的数据设置为 `NULL`
4. **验证结果**：确保清理后的数据符合逻辑
5. **清理临时表**：删除临时数据

### 统计信息

脚本会显示以下统计信息：

- 清理前总产品数（有 `barCodeShared` 值）
- 需要保留的产品数
- 需要清理的产品数
- 清理后的数据统计

## 示例数据

### 清理前

| 产品ID | barCode | barCodeShared | 被引用情况 | 说明 |
|--------|---------|---------------|------------|------|
| P1 | ABC123 | ABC123 | 被P2引用 | 自身引用，有被引用 → 保留 |
| P2 | DEF456 | ABC123 | 无 | 引用其他产品 → 保留 |
| P3 | GHI789 | GHI789 | 无 | 自身引用，无被引用 → 清理 |
| P4 | JKL012 | GHI789 | 无 | 引用其他产品 → 保留 |

### 清理后

| 产品ID | barCode | barCodeShared | 说明 |
|--------|---------|---------------|------|
| P1 | ABC123 | ABC123 | 保留（被其他产品引用） |
| P2 | DEF456 | ABC123 | 保留（引用其他产品） |
| P3 | GHI789 | NULL | 已清理（自身引用且无被引用） |
| P4 | JKL012 | GHI789 | 保留（引用其他产品） |

## 执行前检查

在运行清理脚本前，建议先检查数据：

```sql
-- 检查当前 barCodeShared 的分布情况
SELECT 
  CASE 
    WHEN bar_code_shared IS NULL THEN 'NULL'
    WHEN bar_code_shared = '' THEN 'EMPTY'
    WHEN bar_code_shared = bar_code THEN 'SELF_REFERENCE'
    ELSE 'OTHER_REFERENCE'
  END as shared_type,
  COUNT(*) as count
FROM products 
WHERE bar_code_shared IS NOT NULL 
GROUP BY 1
ORDER BY 2 DESC;
```

## 执行后验证

清理完成后，可以运行以下查询验证结果：

```sql
-- 验证清理结果
SELECT 
  p1.id,
  p1.bar_code,
  p1.bar_code_shared,
  CASE 
    WHEN p1.bar_code_shared IS NULL THEN 'CLEANED'
    WHEN p1.bar_code_shared != p1.bar_code THEN 'OTHER_REFERENCE'
    WHEN EXISTS (
      SELECT 1 FROM products p2 
      WHERE p2.bar_code_shared = p1.bar_code 
      AND p2.id != p1.id
    ) THEN 'HAS_DEPENDENCIES'
    ELSE 'INVALID'
  END as status
FROM products p1
WHERE p1.bar_code_shared IS NOT NULL 
AND p1.bar_code_shared != ''
ORDER BY status, p1.id;
```

## 错误处理机制

### 测试脚本错误检查

测试脚本会进行以下检查，如果发现问题会抛出错误并停止 migration：

1. **关键问题检查**：
   - 如果发现产品自身引用但有其他产品依赖的情况
   - 这种情况不应该发生，会抛出 `EXCEPTION` 并停止执行

2. **数据量检查**：
   - 如果没有找到需要处理的产品数据，会发出 `WARNING`
   - 如果需要清理的产品数量超过总数的 80%，会发出 `WARNING`

3. **警告问题检查**：
   - 如果发现 `barCodeShared` 为空字符串，会发出 `WARNING`

### 错误类型

- **EXCEPTION**：关键问题，会停止 migration 执行
- **WARNING**：警告信息，不会停止执行但需要关注
- **NOTICE**：正常信息，显示执行状态

## 注意事项

1. **备份数据**：执行前请备份数据库
2. **测试环境**：建议先在测试环境执行
3. **监控日志**：注意观察脚本输出的统计信息和错误信息
4. **验证结果**：执行后验证数据是否符合预期
5. **错误处理**：如果测试脚本抛出错误，请先解决数据问题再继续

## 回滚方案

如果需要回滚，可以：

1. 从备份恢复数据
2. 或者重新设置 `barCodeShared` 值（需要根据业务逻辑确定）

---

*最后更新: 2024年12月*
