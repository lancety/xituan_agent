# 年度报税报表开发方案和实施步骤

## 开发方案概述

### 核心目标
1. 实现基于时间戳的报表快照机制
2. 实现数据锁定机制（基于 `created_at <= committed_at`）
3. 实现补报和审计比对功能
4. 删除设备折旧报表的 `isCommitted` 字段，统一到报税报表层面

### 技术方案
- **快照机制**：使用 `committed_at` 时间戳，不保存ID列表
- **锁定机制**：所有 `created_at <= committed_at` 的记录被锁定
- **补报识别**：所有 `created_at > 上次committed_at` 的记录自动是新记录
- **审计比对**：基于时间戳自动识别新增/修改/软删除记录

## 开发步骤

### Phase 1: 删除 isCommitted 字段（后端）

#### 1.1 创建 Migration
**文件**：`xituan_backend/migrations/XXXXXX_remove_equipment_depreciation_iscommitted.sql`

```sql
-- 删除 is_committed 相关字段
ALTER TABLE equipment_depreciation_records 
  DROP COLUMN IF EXISTS is_committed,
  DROP COLUMN IF EXISTS committed_at,
  DROP COLUMN IF EXISTS committed_by,
  DROP COLUMN IF EXISTS commit_note;

-- 删除相关索引
DROP INDEX IF EXISTS idx_equipment_depreciation_committed;
```

#### 1.2 更新类型定义
**文件**：
- `xituan_backend/submodules/xituan_codebase/typing_entity/equipment-depreciation.type.ts`
- `xituan_cms/submodules/xituan_codebase/typing_entity/equipment-depreciation.type.ts`
- `xituan_wechat_app/submodules/xituan_codebase/typing_entity/equipment-depreciation.type.ts`

**修改**：
- 从 `iEquipmentDepreciationRecord` 接口中删除 `isCommitted`, `committedAt`, `committedBy`, `commitNote` 字段
- 从 `iEquipmentDepreciationRecordListParams` 中删除 `isCommitted` 参数

#### 1.3 更新 Entity
**文件**：`xituan_backend/src/domains/equipment-depreciation/domain/equipment-depreciation-record.entity.ts`

**修改**：
- 删除 `@Column` 装饰器中的 `isCommitted`, `committedAt`, `committedBy`, `commitNote` 字段

#### 1.4 更新 Repository
**文件**：`xituan_backend/src/domains/equipment-depreciation/infrastructure/equipment-depreciation-record.repository.ts`

**修改**：
- 从 `getDepreciationRecords` 方法中删除 `isCommitted` 参数和对应的 `andWhere` 条件

#### 1.5 更新 Service
**文件**：`xituan_backend/src/domains/equipment-depreciation/services/equipment-depreciation-report.service.ts`

**修改**：
- 删除 `commitReport()` 方法
- 更新 `generateReport()` 方法：删除所有检查 `isCommitted` 的逻辑
- 更新 `getReport()` 方法：删除 `isCommitted` 过滤，合并 `getCommittedReport()` 逻辑
- 删除 `getCommittedReport()` 方法
- 更新 `getReportSummary()` 方法：删除 `committedOnly` 参数和 `committedCount` 统计
- 更新 `updateEquipmentFromCommittedRecords()` 方法：改为基于时间戳或直接更新

#### 1.6 更新 Controller 和 Routes
**文件**：
- `xituan_backend/src/domains/equipment-depreciation/controllers/equipment-depreciation.controller.ts`
- `xituan_backend/src/domains/equipment-depreciation/routes/equipment-depreciation.routes.ts`

**修改**：
- 删除 `commitReport` 方法和相关路由

#### 1.7 更新报税报表 Service
**文件**：`xituan_backend/src/domains/financial/services/tax-return-report.service.ts`

**修改**：
- 更新 `getTaxReturnReport` 方法：不再使用 `committedOnly` 参数
- 更新调用 `depreciationReportService.getReportSummary` 的地方：删除 `committedOnly` 参数
- 更新调用 `depreciationReportService.getReport` 的地方：使用统一的 `getReport` 方法

### Phase 2: 删除 isCommitted 字段（前端）

#### 2.1 更新设备折旧报表页面
**文件**：`xituan_cms/src/pages/equipment/depreciation-report.tsx`

**修改**：
- 删除"确认报表"按钮和相关功能
- 删除显示 `isCommitted` 状态的代码
- 删除 `committedCount` 和 `uncommittedCount` 的统计显示

#### 2.2 更新设备编辑模态框
**文件**：`xituan_cms/src/components/equipment/EquipmentEditModal.tsx`

**修改**：
- 删除检查 `isCommitted` 的逻辑
- 删除相关提示信息（如"已确认的记录不允许修改"等）
- 删除 `committedRecords` 相关的过滤逻辑

#### 2.3 更新年度报税报表页面
**文件**：`xituan_cms/src/pages/financial/tax-return-report.tsx`

**修改**：
- 删除显示 `isCommitted` 状态的代码（如果还有的话）

#### 2.4 更新 API 文件
**文件**：`xituan_cms/src/lib/api/equipment-depreciation.api.ts`

**修改**：
- 删除 `commitDepreciationReport` 方法

### Phase 3: 创建数据库表

#### 3.1 创建报税报表表
**文件**：`xituan_backend/migrations/XXXXXX_create_tax_return_reports.sql`

```sql
CREATE TABLE tax_return_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_year VARCHAR(10) NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  
  overview_data JSONB NOT NULL,
  
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  is_committed BOOLEAN DEFAULT FALSE,
  committed_at TIMESTAMP WITH TIME ZONE,
  committed_by UUID,
  
  version INTEGER DEFAULT 1,
  parent_report_id UUID REFERENCES tax_return_reports(id),
  amendment_reason TEXT,
  is_amendment BOOLEAN DEFAULT FALSE,
  
  generated_at TIMESTAMP WITH TIME ZONE,
  generated_by UUID,
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tax_return_reports_financial_year ON tax_return_reports(financial_year);
CREATE INDEX idx_tax_return_reports_status ON tax_return_reports(status);
CREATE INDEX idx_tax_return_reports_committed_at ON tax_return_reports(committed_at);
```

#### 3.2 报表快照表（不需要）
**说明**：不需要单独的快照表，`committed_at` 直接保存在 `tax_return_reports` 表中。

#### 3.3 创建审计日志表
**文件**：`xituan_backend/migrations/XXXXXX_create_tax_return_report_audit_logs.sql`

```sql
CREATE TABLE tax_return_report_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES tax_return_reports(id),
  
  action VARCHAR(50) NOT NULL,
  description TEXT,
  changes JSONB,
  
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tax_return_report_audit_logs_report_id ON tax_return_report_audit_logs(report_id);
CREATE INDEX idx_tax_return_report_audit_logs_created_at ON tax_return_report_audit_logs(created_at);
```

### Phase 4: 创建 Entity 和 Repository

#### 4.1 创建 TaxReturnReport Entity
**文件**：`xituan_backend/src/domains/financial/domain/tax-return-report.entity.ts`

**内容**：
- 定义 `TaxReturnReport` entity
- 包含所有字段的 `@Column` 装饰器
- 包含索引定义

#### 4.2 报表快照 Entity（不需要）
**说明**：不需要单独的快照 Entity，`committed_at` 在 `TaxReturnReport` Entity 中。

#### 4.3 创建 TaxReturnReportAuditLog Entity
**文件**：`xituan_backend/src/domains/financial/domain/tax-return-report-audit-log.entity.ts`

#### 4.4 创建 Repository
**文件**：
- `xituan_backend/src/domains/financial/infrastructure/tax-return-report.repository.ts`
- `xituan_backend/src/domains/financial/infrastructure/tax-return-report-audit-log.repository.ts`

**方法**：
- `findByFinancialYear()`
- `findById()`
- `save()`
- `update()`
- 等等

### Phase 5: 创建类型定义

#### 5.1 后端类型定义
**文件**：`xituan_backend/submodules/xituan_codebase/typing_entity/tax-return-report.type.ts`

**内容**：
- `iTaxReturnReport`
- `iTaxReturnReportAuditLog`
- `iTaxReturnReportStatus`
- 等等

#### 5.2 API 类型定义
**文件**：
- `xituan_backend/submodules/xituan_codebase/typing_api/tax-return-report.type.ts`
- `xituan_cms/submodules/xituan_codebase/typing_api/tax-return-report.type.ts`

**内容**：
- `iGenerateTaxReturnReportRequest`
- `iGenerateTaxReturnReportResponse`
- `iCommitTaxReturnReportRequest`
- `iCommitTaxReturnReportResponse`
- `iAmendTaxReturnReportRequest`
- `iAmendTaxReturnReportResponse`
- `iAuditComparison`
- 等等

### Phase 6: 实现 Service 层

#### 6.1 创建 TaxReturnReportService
**文件**：`xituan_backend/src/domains/financial/services/tax-return-report-new.service.ts`

**方法**：
1. `generateReport(financialYear, userId)` - 生成报表
2. `commitReport(reportId, userId)` - 确认报表
3. `amendReport(originalReportId, amendmentReason, userId)` - 创建补报
4. `commitAmendmentReport(amendmentReportId, userId)` - 确认补报
5. `getReport(financialYear)` - 获取报表概览
6. `getReportRevenues(financialYear, page, limit)` - 获取收入明细
7. `getReportExpenses(financialYear, page, limit)` - 获取支出明细
8. `getReportDepreciation(financialYear, page, limit)` - 获取折旧明细
9. `isRecordLocked(recordCreatedAt, recordType)` - 检查记录是否被锁定
10. `compareReportsByTimestamp(originalReport, newReport)` - 审计比对

#### 6.2 实现数据锁定检查
**文件**：`xituan_backend/src/domains/financial/services/record-lock.service.ts`

**方法**：
- `isRecordLocked(recordId, recordType)` - 检查记录是否被锁定
- `checkRecordLockBeforeUpdate(recordId, recordType)` - 更新前检查
- `checkRecordLockBeforeDelete(recordId, recordType)` - 删除前检查

#### 6.3 更新现有 Service
**文件**：
- `xituan_backend/src/domains/revenue/services/revenue.service.ts`
- `xituan_backend/src/domains/expense/services/expense.service.ts`
- `xituan_backend/src/domains/equipment-depreciation/services/equipment-depreciation-report.service.ts`

**修改**：
- 在 `update` 和 `delete` 方法中添加锁定检查
- 调用 `recordLockService.checkRecordLockBeforeUpdate/Delete`

### Phase 7: 实现 Controller 和 Routes

#### 7.1 创建 Controller
**文件**：`xituan_backend/src/domains/financial/controllers/tax-return-report-new.controller.ts`

**路由**：
- `POST /api/admin/financial/tax-return-report/generate` - 生成报表
- `POST /api/admin/financial/tax-return-report/:id/commit` - 确认报表
- `GET /api/admin/financial/tax-return-report/:financialYear` - 获取报表概览
- `GET /api/admin/financial/tax-return-report/:financialYear/revenues` - 获取收入明细
- `GET /api/admin/financial/tax-return-report/:financialYear/expenses` - 获取支出明细
- `GET /api/admin/financial/tax-return-report/:financialYear/depreciation` - 获取折旧明细
- `POST /api/admin/financial/tax-return-report/:id/amend` - 创建补报
- `POST /api/admin/financial/tax-return-report/:id/commit-amendment` - 确认补报
- `GET /api/admin/financial/tax-return-report/:id/comparison` - 获取审计比对结果

#### 7.2 创建 Routes
**文件**：`xituan_backend/src/domains/financial/routes/tax-return-report-new.routes.ts`

**配置**：
- 注册所有路由
- 添加权限中间件
- 添加验证中间件

### Phase 8: 前端实现

#### 8.1 创建 API 客户端
**文件**：`xituan_cms/src/lib/api/tax-return-report-new.api.ts`

**方法**：
- `generateTaxReturnReport(financialYear, notes?)`
- `commitTaxReturnReport(reportId, notes?)`
- `getTaxReturnReport(financialYear)`
- `getTaxReturnReportRevenues(financialYear, page, limit)`
- `getTaxReturnReportExpenses(financialYear, page, limit)`
- `getTaxReturnReportDepreciation(financialYear, page, limit)`
- `amendTaxReturnReport(reportId, amendmentReason, notes?)`
- `commitAmendmentReport(reportId, notes?)`
- `getTaxReturnReportComparison(reportId)`

#### 8.2 更新报税报表页面
**文件**：`xituan_cms/src/pages/financial/tax-return-report.tsx`

**修改**：
1. 添加"生成报表"按钮（如果报表不存在）
2. 添加"确认报表"按钮（如果报表已生成但未确认）
3. 添加"创建补报"按钮（如果报表已确认）
4. 添加"确认补报"按钮（如果是补报且未确认）
5. 更新数据获取逻辑：
   - 概览数据从新 API 获取
   - 明细数据分页获取
6. 添加审计比对结果显示
7. 添加报表状态和版本显示

#### 8.3 创建报表生成/确认模态框
**文件**：`xituan_cms/src/components/financial/TaxReturnReportModal.tsx`

**功能**：
- 生成报表确认对话框
- 确认报表对话框
- 创建补报对话框（包含修正原因输入）
- 确认补报对话框

#### 8.4 创建审计比对结果组件
**文件**：`xituan_cms/src/components/financial/TaxReturnReportComparison.tsx`

**功能**：
- 显示新增记录列表
- 显示修改记录列表（前后对比）
- 显示软删除记录列表
- 显示影响分析（金额变化）

### Phase 9: 测试

#### 9.1 单元测试
**文件**：
- `xituan_backend/src/domains/financial/services/__tests__/tax-return-report-new.service.test.ts`
- `xituan_backend/src/domains/financial/services/__tests__/record-lock.service.test.ts`

**测试内容**：
- 生成报表逻辑
- 确认报表逻辑
- 锁定检查逻辑
- 补报逻辑
- 审计比对逻辑

#### 9.2 集成测试
**文件**：`xituan_backend/src/domains/financial/__tests__/tax-return-report.integration.test.ts`

**测试内容**：
- 完整的报表生成和确认流程
- 补报流程
- 数据锁定功能
- API 端点测试

#### 9.3 E2E 测试
**测试内容**：
- 前端完整流程测试
- 用户交互测试

### Phase 10: 迁移现有数据

#### 10.1 数据迁移脚本
**文件**：`xituan_backend/migrations/XXXXXX_migrate_existing_tax_reports.sql`

**内容**：
- 如果有现有的报表数据，需要迁移到新表结构
- 处理历史数据的 `committed_at` 时间戳

## 开发顺序建议

### 第一阶段（基础功能）
1. Phase 1: 删除 isCommitted 字段（后端）
2. Phase 2: 删除 isCommitted 字段（前端）
3. Phase 3: 创建数据库表
4. Phase 4: 创建 Entity 和 Repository
5. Phase 5: 创建类型定义

### 第二阶段（核心功能）
6. Phase 6: 实现 Service 层
   - 先实现 `generateReport` 和 `commitReport`
   - 再实现数据锁定检查
   - 最后实现补报和审计比对

### 第三阶段（API 和前端）
7. Phase 7: 实现 Controller 和 Routes
8. Phase 8: 前端实现
   - 先实现 API 客户端
   - 再更新页面
   - 最后添加新功能（生成、确认、补报）

### 第四阶段（测试和优化）
9. Phase 9: 测试
10. Phase 10: 迁移现有数据（如果需要）

## 注意事项

1. **向后兼容**：在删除 `isCommitted` 字段前，确保没有其他地方依赖它
2. **数据迁移**：如果有现有数据，需要制定迁移计划
3. **权限控制**：确保所有 API 都有适当的权限检查
4. **错误处理**：添加完善的错误处理和用户提示
5. **性能优化**：确保时间戳查询有适当的索引
6. **测试覆盖**：确保关键功能有充分的测试覆盖

## 预计工作量

- **Phase 1-2**（删除 isCommitted）：2-3 天
- **Phase 3-5**（数据库和类型）：2-3 天
- **Phase 6**（Service 层）：5-7 天
- **Phase 7**（API）：2-3 天
- **Phase 8**（前端）：5-7 天
- **Phase 9**（测试）：3-5 天
- **Phase 10**（数据迁移）：1-2 天

**总计**：约 20-30 个工作日

