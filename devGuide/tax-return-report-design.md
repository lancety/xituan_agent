# 年度报税报表设计方案

## 设计理念

**用时间戳代替ID列表**：快照不保存各个对象记录的ID列表，而是记录 `committed_at` 时间戳。所有 `created_at <= committed_at` 的记录都被锁定，不能更改。新添加的（`created_at > committed_at`）可以作为补报。

### 核心优势

1. **简化存储**：不需要存储大量ID，只需要一个时间戳
2. **简化对比**：不需要复杂的ID对比，只需要比较 `created_at` 和 `committed_at`
3. **自动识别补报**：新记录自动识别为补报
4. **性能优化**：时间戳查询比ID列表查询更高效
5. **逻辑清晰**：时间戳作为唯一判断标准

## 数据库设计

### 1. 报税报表表

```sql
CREATE TABLE tax_return_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_year VARCHAR(10) NOT NULL UNIQUE,  -- e.g., '2024-25'
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  
  -- 汇总数据（快照）
  overview_data JSONB NOT NULL,  -- 存储 iTaxReturnReportOverview
  
  -- 状态
  status VARCHAR(20) NOT NULL DEFAULT 'draft',  -- draft, generated, committed, superseded
  is_committed BOOLEAN DEFAULT FALSE,
  committed_at TIMESTAMP WITH TIME ZONE,  -- ⭐ 关键：记录确认时间，用于锁定记录
  committed_by UUID,  -- user_id
  
  -- 修正相关
  version INTEGER DEFAULT 1,
  parent_report_id UUID REFERENCES tax_return_reports(id),
  amendment_reason TEXT,
  is_amendment BOOLEAN DEFAULT FALSE,
  
  -- 元数据
  generated_at TIMESTAMP WITH TIME ZONE,
  generated_by UUID,  -- user_id
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tax_return_reports_financial_year ON tax_return_reports(financial_year);
CREATE INDEX idx_tax_return_reports_status ON tax_return_reports(status);
CREATE INDEX idx_tax_return_reports_committed_at ON tax_return_reports(committed_at);  -- ⭐ 用于锁定检查
```

### 2. 报表快照表（不需要）

**说明：**
- 不需要单独的快照表
- `committed_at` 时间戳直接保存在 `tax_return_reports` 表中
- 锁定检查直接使用 `tax_return_reports.committed_at`
- 审计比对时，如果需要原始数据，可以从数据库实时查询（基于时间戳）

### 3. 审计日志表

```sql
CREATE TABLE tax_return_report_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES tax_return_reports(id),
  
  action VARCHAR(50) NOT NULL,  -- generate, commit, amend, unlock, etc.
  description TEXT,
  changes JSONB,  -- 记录变更详情
  
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tax_return_report_audit_logs_report_id ON tax_return_report_audit_logs(report_id);
CREATE INDEX idx_tax_return_report_audit_logs_created_at ON tax_return_report_audit_logs(created_at);
```

## 数据锁定机制

### 锁定逻辑

**核心规则：** 所有 `created_at <= committed_at` 的记录都被锁定，不允许修改/删除。

```typescript
/**
 * 检查记录是否被已确认的报表锁定
 * @param recordCreatedAt 记录的created_at时间
 * @param recordType 记录类型：'revenue' | 'expense' | 'depreciation'
 * @returns 是否被锁定
 */
async function isRecordLocked(
  recordCreatedAt: Date,
  recordType: 'revenue' | 'expense' | 'depreciation'
): Promise<boolean> {
  // 获取所有已确认的报表
  const committedReports = await taxReturnReportRepository.find({
    where: { isCommitted: true },
    order: { committedAt: 'DESC' }
  });
  
  // 检查记录的created_at是否在任何已确认报表的committed_at之前或等于
  for (const report of committedReports) {
    if (report.committedAt && recordCreatedAt <= report.committedAt) {
      // 检查记录是否在报表的日期范围内
      if (await isRecordInReportRange(recordCreatedAt, report, recordType)) {
        return true;  // 记录被锁定
      }
    }
  }
  
  return false;
}
```

### 锁定检查时机

- **修改记录时**：检查 `created_at <= committed_at`
- **删除记录时**：检查 `created_at <= committed_at`
- **软删除时**：如果影响新快照统计，需要先 commit 报表

### 软删除处理

- 已锁定的记录不允许软删除
- 在生成报表时，只包含 `isDeleted = false` 的记录
- 如果记录在报表确认后被软删除，应该阻止（因为记录已被锁定）

## 业务流程

### 1. 生成报表

```typescript
async function generateReport(
  financialYear: string,
  userId: string
): Promise<TaxReturnReport> {
  // 1. 计算日期范围
  const { startDate, endDate } = getFinancialYearDates(financialYear);
  
  // 2. 自动生成设备折旧记录（如果还没有生成）
  await depreciationService.generateDepreciationRecords(financialYear);
  
  // 3. 收集所有数据
  const revenues = await revenueService.getRevenues({
    startDate,
    endDate,
  });
  
  const expenses = await expenseService.getExpenses({
    startDate,
    endDate,
  });
  
  const depreciation = await depreciationService.getDepreciationRecords({
    financialYear,
  });
  
  // 4. 计算汇总数据
  const overview = calculateOverview(revenues, expenses, depreciation);
  
  // 5. 保存报表（不设置committed_at，所以记录还未锁定）
  const report = await taxReturnReportRepository.save({
    financialYear,
    startDate,
    endDate,
    overviewData: overview,
    status: 'generated',
    generatedAt: new Date(),
    generatedBy: userId,
  });
  
  // 记录审计日志
  await auditLogRepository.save({
    reportId: report.id,
    action: 'generate',
    description: 'Report generated',
    userId,
  });
  
  return report;
}
```

### 2. 确认报表

```typescript
async function commitReport(
  reportId: string,
  userId: string
): Promise<TaxReturnReport> {
  const report = await taxReturnReportRepository.findOne({ where: { id: reportId } });
  
  if (!report) {
    throw new Error('Report not found');
  }
  
  if (report.isCommitted) {
    throw new Error('Report already committed');
  }
  
  // ⭐ 关键：设置committed_at时间戳
  // 所有created_at <= committed_at的记录将被锁定
  const commitTime = new Date();
  
  report.isCommitted = true;
  report.committedAt = commitTime;
  report.committedBy = userId;
  report.status = 'committed';
  
  await taxReturnReportRepository.save(report);
  
  // 记录审计日志
  await auditLogRepository.save({
    reportId,
    action: 'commit',
    description: 'Report committed',
    userId,
  });
  
  return report;
}
```

### 3. 补报流程

```typescript
async function amendReport(
  originalReportId: string,
  amendmentReason: string,
  userId: string
): Promise<TaxReturnReport> {
  const originalReport = await taxReturnReportRepository.findOne({
    where: { id: originalReportId }
  });
  
  if (!originalReport || !originalReport.isCommitted) {
    throw new Error('Original report must be committed');
  }
  
  // 1. 重新收集所有数据（包括新添加的）
  const { startDate, endDate } = {
    startDate: originalReport.startDate,
    endDate: originalReport.endDate,
  };
  
  // ⭐ 关键：收集所有数据，包括新添加的（created_at > originalReport.committedAt）
  const revenues = await revenueService.getRevenues({
    startDate,
    endDate,
  });
  
  const expenses = await expenseService.getExpenses({
    startDate,
    endDate,
  });
  
  const depreciation = await depreciationService.getDepreciationRecords({
    financialYear: originalReport.financialYear,
  });
  
  // 2. 计算汇总数据
  const overview = calculateOverview(revenues, expenses, depreciation);
  
  // 3. 创建修正报表
  const amendmentReport = await taxReturnReportRepository.save({
    financialYear: originalReport.financialYear,
    startDate,
    endDate,
    overviewData: overview,
    status: 'amendment_generated',
    version: originalReport.version + 1,
    parentReportId: originalReportId,
    amendmentReason,
    isAmendment: true,
    generatedAt: new Date(),
    generatedBy: userId,
  });
  
  // 4. 自动生成审计比对（基于时间戳）
  const comparison = await compareReportsByTimestamp(originalReport, amendmentReport);
  await saveComparison(amendmentReport.id, comparison);
  
  // 记录审计日志
  await auditLogRepository.save({
    reportId: amendmentReport.id,
    action: 'amend',
    description: `Amendment created: ${amendmentReason}`,
    userId,
  });
  
  return amendmentReport;
}
```

### 4. 确认补报

```typescript
async function commitAmendmentReport(
  amendmentReportId: string,
  userId: string
): Promise<TaxReturnReport> {
  const amendmentReport = await taxReturnReportRepository.findOne({
    where: { id: amendmentReportId },
    relations: ['parentReport']
  });
  
  if (!amendmentReport || !amendmentReport.isAmendment) {
    throw new Error('Report is not an amendment');
  }
  
  // 1. 确认修正报表
  const commitTime = new Date();
  amendmentReport.isCommitted = true;
  amendmentReport.committedAt = commitTime;
  amendmentReport.committedBy = userId;
  amendmentReport.status = 'amendment_committed';
  await taxReturnReportRepository.save(amendmentReport);
  
  // 2. 原始报表状态变为被取代
  if (amendmentReport.parentReport) {
    amendmentReport.parentReport.status = 'superseded';
    await taxReturnReportRepository.save(amendmentReport.parentReport);
  }
  
  // 3. 保存快照
  await snapshotRepository.save({
    reportId: amendmentReport.id,
    committedAt: commitTime,
    generatedBy: userId,
  });
  
  // 记录审计日志
  await auditLogRepository.save({
    reportId: amendmentReport.id,
    action: 'commit_amendment',
    description: 'Amendment report committed',
    userId,
  });
  
  return amendmentReport;
}
```

## 审计比对逻辑

### 比对算法

```typescript
interface AuditComparison {
  added: {
    revenues: Array<{id: string, data: any, amount: number, createdAt: Date}>;
    expenses: Array<{id: string, data: any, amount: number, createdAt: Date}>;
    depreciation: Array<{id: string, data: any, amount: number, createdAt: Date}>;
  };
  modified: {
    revenues: Array<{id: string, original: any, current: any, changes: any}>;
    expenses: Array<{id: string, original: any, current: any, changes: any}>;
    depreciation: Array<{id: string, original: any, current: any, changes: any}>;
  };
  softDeleted: {
    revenues: Array<{id: string, data: any, amount: number}>;
    expenses: Array<{id: string, data: any, amount: number}>;
    depreciation: Array<{id: string, data: any, amount: number}>;
  };
  impact: {
    revenueChange: number;
    expenseChange: number;
    depreciationChange: number;
    gstChange: number;
    profitChange: number;
  };
}

async function compareReportsByTimestamp(
  originalReport: TaxReturnReport,
  newReport: TaxReturnReport
): Promise<AuditComparison> {
  if (!originalReport.committedAt) {
    throw new Error('Original report must be committed');
  }
  
  const committedAt = originalReport.committedAt;
  
  // ⭐ 关键：基于时间戳过滤
  // 新增记录：created_at > committedAt
  // 已锁定记录：created_at <= committedAt（不应该被修改）
  
  // 1. 获取所有收入记录
  const allRevenues = await revenueService.getRevenues({
    startDate: originalReport.startDate,
    endDate: originalReport.endDate,
  });
  
  // 2. 识别新增记录（created_at > committedAt）
  const addedRevenues = allRevenues.filter(r => r.createdAt > committedAt);
  
  // 3. 识别已锁定记录（created_at <= committedAt）
  const lockedRevenues = allRevenues.filter(r => r.createdAt <= committedAt);
  
  // 4. 检查已锁定记录是否有修改（通过对比原始报表生成时的数据和当前数据）
  const modifiedRevenues = [];
  for (const lockedRevenue of lockedRevenues) {
    // 从原始报表快照获取原始数据（如果有）
    const originalData = await getOriginalRecordData(lockedRevenue.id, originalReport);
    if (originalData && hasChanges(originalData, lockedRevenue)) {
      modifiedRevenues.push({
        id: lockedRevenue.id,
        original: originalData,
        current: lockedRevenue,
        changes: getChanges(originalData, lockedRevenue)
      });
    }
  }
  
  // 5. 识别软删除记录（created_at <= committedAt 但 isDeleted = true）
  const softDeletedRevenues = lockedRevenues.filter(r => r.isDeleted);
  
  // 6. 同样处理支出和折旧记录...
  
  // 7. 计算影响
  const revenueChange = calculateChange(addedRevenues, softDeletedRevenues, modifiedRevenues);
  // ...
  
  return {
    added: { revenues: addedRevenues, expenses: addedExpenses, depreciation: addedDepreciation },
    modified: { revenues: modifiedRevenues, expenses: modifiedExpenses, depreciation: modifiedDepreciation },
    softDeleted: { revenues: softDeletedRevenues, expenses: softDeletedExpenses, depreciation: softDeletedDepreciation },
    impact: {
      revenueChange,
      expenseChange,
      depreciationChange,
      gstChange,
      profitChange
    }
  };
}
```

## API 设计

### 1. 生成报表

```
POST /api/admin/financial/tax-return-report/generate
Body: {
  financialYear: "2024-25",
  notes?: string
}
Response: {
  success: true,
  data: {
    id: string,
    financialYear: string,
    status: "generated",
    overview: iTaxReturnReportOverview,
    generatedAt: string
  }
}
```

### 2. 确认报表

```
POST /api/admin/financial/tax-return-report/:id/commit
Body: {
  notes?: string
}
Response: {
  success: true,
  data: {
    id: string,
    status: "committed",
    committedAt: string
  }
}
```

### 3. 获取报表概览

```
GET /api/admin/financial/tax-return-report/:financialYear
Response: {
  success: true,
  data: {
    id: string,
    financialYear: string,
    status: "generated" | "committed",
    overview: iTaxReturnReportOverview,
    isCommitted: boolean
  }
}
```

### 4. 获取报表明细（分页）

```
GET /api/admin/financial/tax-return-report/:financialYear/revenues?page=1&limit=20
GET /api/admin/financial/tax-return-report/:financialYear/expenses?page=1&limit=20
GET /api/admin/financial/tax-return-report/:financialYear/depreciation?page=1&limit=20
```

### 5. 创建补报

```
POST /api/admin/financial/tax-return-report/:id/amend
Body: {
  amendmentReason: "发现遗漏的支出记录",
  notes?: string
}
Response: {
  success: true,
  data: {
    id: string,
    financialYear: string,
    status: "amendment_generated",
    version: number,
    comparison: AuditComparison
  }
}
```

### 6. 确认补报

```
POST /api/admin/financial/tax-return-report/:id/commit-amendment
Body: {
  notes?: string
}
Response: {
  success: true,
  data: {
    id: string,
    status: "amendment_committed",
    committedAt: string
  }
}
```

## 设备折旧报表重新定位

### 设计决策

1. **删除 `isCommitted` 字段**：不再在设备折旧记录层面进行确认
2. **统一确认机制**：确认在年度报税报表层面统一进行
3. **设备折旧报表定位**：
   - **管理工具**：用于生成、查看、调整折旧记录
   - **不需要单独的确认流程**：确认在年度报税报表层面统一进行
   - **生成时机**：可以在生成年度报税报表时自动生成（如果还没有）

### 工作流程

```
财年结束 
→ 生成年度报税报表 
  → 自动生成设备折旧记录（如果还没有）
  → 收集所有数据（收入、支出、折旧）
  → 计算汇总
→ 审核报表
→ 确认报表（保存 committed_at 时间戳，锁定所有 created_at <= committed_at 的记录）
```

## 实施步骤

### Phase 1: 删除 isCommitted 字段

1. 创建 Migration 删除字段
2. 更新后端代码（Entity、Repository、Service、Controller）
3. 更新前端代码（删除确认功能和相关显示）

### Phase 2: 创建数据库表

1. 创建 `tax_return_reports` 表
2. 创建 `tax_return_report_snapshots` 表（可选）
3. 创建 `tax_return_report_audit_logs` 表
4. 创建 migration 文件

### Phase 3: 实现核心功能

1. 实现 `generateReport()` 方法
2. 实现 `commitReport()` 方法（设置 `committed_at`）
3. 实现 `isRecordLocked()` 方法（基于时间戳）
4. 实现数据锁定检查（在修改/删除记录时）

### Phase 4: 实现补报功能

1. 实现 `amendReport()` 方法
2. 实现 `compareReportsByTimestamp()` 方法
3. 实现审计比对报告生成

### Phase 5: 前端适配

1. 添加"生成报表"按钮
2. 添加"确认报表"按钮
3. 添加"修正报表"按钮
4. 显示审计比对结果
5. 显示报表状态和版本

## 注意事项

1. **时区问题**：确保 `created_at` 和 `committed_at` 使用相同的时区（都使用 `timestamp with time zone`）
2. **并发问题**：如果多个用户同时生成报表，需要处理并发（使用数据库唯一约束）
3. **性能优化**：时间戳查询需要索引支持
4. **数据完整性**：确保所有表都有 `created_at` 字段
5. **软删除支持**：检查收入、支出、折旧表是否支持软删除

