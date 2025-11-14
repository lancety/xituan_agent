# 设备报表与年度退税报表关系说明

## 一、设备折旧报表与年度退税报表的关系

### 1.1 整体关系

**设备折旧报表** 是 **年度退税报表** 的重要组成部分之一。

```
年度退税报表（Annual Tax Return Report）
├── 支出汇总报表（Expense Summary Report）
│   ├── 原材料支出
│   ├── 服务支出
│   ├── 设备支出（购买成本）
│   ├── 租金支出
│   └── 其他支出
├── GST报表（GST Report）
│   ├── 可退税的GST汇总
│   └── 已支付的GST汇总
├── 设备折旧报表（Equipment Depreciation Report）⭐ 已实现
│   ├── 按财年生成
│   ├── 折旧金额汇总
│   └── 用于税务抵扣
└── 财务报表（Financial Statements）
    ├── 损益表（Profit & Loss）
    └── 资产负债表（Balance Sheet）
```

### 1.2 设备折旧报表的作用

1. **税务抵扣**：设备折旧金额可以作为税务抵扣项，减少应纳税收入
2. **财年汇总**：按财年（如 2024-25）汇总所有设备的折旧金额
3. **数据确认**：确认后的折旧记录用于年度退税申报，不可修改
4. **合规性**：符合澳洲ATO（Australian Tax Office）的折旧政策要求

### 1.3 年度退税报表的组成

年度退税报表应该包含以下部分：

1. **收入汇总**（Revenue Summary）- ⏳ 待实现
   - 产品销售收入
   - 服务收入
   - 其他收入

2. **支出汇总**（Expense Summary）- ⏳ 待实现
   - 按类型汇总（原材料、服务、设备、租金等）
   - 按供应商汇总
   - 按日期范围汇总

3. **GST报表**（GST Report）- ⏳ 待实现
   - 可退税的GST（从供应商处支付的GST）
   - 已收取的GST（从客户处收取的GST）
   - GST净额（需要支付或可退回的金额）

4. **设备折旧报表**（Equipment Depreciation Report）- ✅ 已实现
   - 按财年生成
   - 折旧金额汇总
   - 确认机制（已确认的记录不可修改）

5. **财务报表**（Financial Statements）- ⏳ 待实现
   - 损益表（Profit & Loss Statement）
   - 资产负债表（Balance Sheet）

## 二、已设计的方案

### 2.1 设备折旧报表系统 ✅ 已实现

**设计文档**：`equipment-depreciation-report-design.md`

**核心功能**：
- ✅ 按财年生成折旧报表
- ✅ 支持4种折旧方法（一次性扣除、直线法、标准递减余额法、低价值资产池）
- ✅ 报表确认机制（已确认的记录不可修改）
- ✅ 可重复生成（未确认的记录可以重新计算）
- ✅ 计算数据保存（calculated_initial_data）用于审计

**API端点**：
- ✅ `POST /api/equipment-depreciation/generate-report` - 生成报表
- ✅ `POST /api/equipment-depreciation/commit-report` - 确认报表
- ✅ `GET /api/equipment-depreciation/report/:financialYear` - 获取报表
- ✅ `GET /api/equipment-depreciation/report/:financialYear/summary` - 获取汇总

**前端页面**：
- ✅ `/equipment/depreciation-report` - 折旧报表页面

### 2.2 财务管理系统整体设计 ✅ 已设计

**设计文档**：`financial-management-system.md`

**核心表结构**：
- ✅ `suppliers` - 供应商表
- ✅ `expenses` - 支出表
- ✅ `equipment` - 设备表
- ✅ `equipment_depreciation_records` - 设备折旧记录表

**已实现功能**：
- ✅ 支出管理（所有类型）
- ✅ 设备管理
- ✅ 供应商管理
- ✅ GST管理（自动计算）
- ✅ 设备折旧计算

### 2.3 设备管理功能 ✅ 已实现

**核心功能**：
- ✅ 设备列表（CRUD）
- ✅ 设备编辑Modal（包含折旧设置）
- ✅ 折旧记录查看
- ✅ 设备状态管理（使用中/已处置/已注销）

**前端页面**：
- ✅ `/equipment` - 设备列表页面
- ✅ `EquipmentEditModal` - 设备编辑Modal

## 三、设备功能待实现项

### 3.1 设备处置功能 ⏳ 待实现

**需求**：
- 记录设备处置日期和处置价值
- 计算处置损益（disposal gain/loss）
- 更新设备状态为"已处置"
- 停止后续财年的折旧计算

**实现建议**：
```typescript
// 在 equipment 表中已有字段：
- status: 'active' | 'disposed' | 'written_off'
- disposal_date?: Date
- disposal_value?: number

// 需要实现：
1. 设备编辑Modal中添加"处置"功能
2. 处置时记录处置日期和处置价值
3. 计算处置损益 = 处置价值 - 账面价值（closing_value）
4. 更新设备状态为 'disposed'
5. 生成折旧报表时，跳过已处置的设备（或只计算到处置日期）
```

### 3.2 设备折旧记录编辑功能 ⏳ 部分实现

**现状**：
- ✅ 可以查看折旧记录
- ⏳ 未确认的记录可以手动调整（需要实现）

**需要实现**：
- 在设备编辑Modal中，允许编辑未确认的折旧记录
- 记录调整原因（adjustment_reason）
- 标记为已调整（is_adjusted = true）

### 3.3 设备折旧历史追踪 ⏳ 部分实现

**现状**：
- ✅ 可以查看历史折旧记录
- ⏳ 缺少折旧趋势图表

**建议实现**：
- 在设备详情页面添加折旧趋势图表
- 显示每年折旧金额、账面价值变化
- 累计折旧可视化

### 3.4 设备批量操作 ⏳ 待实现

**需求**：
- 批量更新设备状态
- 批量设置折旧方法
- 批量生成折旧报表（已实现，但可以优化）

### 3.5 设备导入/导出 ⏳ 待实现

**需求**：
- 从Excel导入设备列表
- 导出设备列表和折旧记录
- 导出折旧报表为PDF/Excel

## 四、年度退税报表待实现项

### 4.1 支出汇总报表 ⏳ 待实现

**功能需求**：
- 按支出类型汇总（原材料、服务、设备、租金等）
- 按供应商汇总
- 按日期范围汇总
- 按业务类型汇总（个人/公司）
- 导出为Excel/PDF

**API设计建议**：
```
GET /api/expenses/summary
Query Parameters:
  - startDate: string
  - endDate: string
  - expenseType?: string
  - supplierId?: string
  - businessType?: string
  - groupBy: 'type' | 'supplier' | 'date' | 'month'
```

### 4.2 GST报表 ⏳ 待实现

**功能需求**：
- 汇总可退税的GST（从供应商处支付的GST）
- 汇总已收取的GST（从客户处收取的GST）
- 计算GST净额
- 按财年汇总
- 导出为Excel/PDF

**数据来源**：
- `expenses` 表中的 `gst_amount`（可退税的GST）
- `revenues` 表中的 `gst_amount`（已收取的GST，待实现收入管理）

### 4.3 财务报表 ⏳ 待实现

**功能需求**：
- **损益表（Profit & Loss Statement）**：
  - 收入汇总
  - 支出汇总
  - 折旧费用
  - 净利润/亏损
- **资产负债表（Balance Sheet）**：
  - 资产（设备账面价值、库存等）
  - 负债
  - 所有者权益

**数据来源**：
- 收入：`revenues` 表（待实现）
- 支出：`expenses` 表
- 折旧：`equipment_depreciation_records` 表
- 设备资产：`equipment` 表（账面价值）

### 4.4 年度退税报表整合页面 ⏳ 待实现

**功能需求**：
- 选择财年
- 显示所有报表汇总：
  - 收入汇总
  - 支出汇总
  - GST汇总
  - 设备折旧汇总
  - 财务报表
- 一键生成所有报表
- 导出完整退税报表（PDF/Excel）

**页面路径建议**：`/financial/tax-return-report`

## 五、实施优先级建议

### 高优先级（核心功能）
1. ✅ **设备折旧报表** - 已完成
2. ⏳ **支出汇总报表** - 年度退税必需
3. ⏳ **GST报表** - 年度退税必需
4. ⏳ **设备处置功能** - 完善设备管理

### 中优先级（增强功能）
5. ⏳ **收入管理** - 财务报表必需
6. ⏳ **财务报表** - 完整财务分析
7. ⏳ **设备折旧记录编辑** - 灵活性需求

### 低优先级（优化功能）
8. ⏳ **设备折旧历史追踪图表** - 可视化增强
9. ⏳ **设备批量操作** - 效率提升
10. ⏳ **设备导入/导出** - 数据迁移

## 六、总结

### 已完成 ✅
- 设备折旧报表系统（核心功能）
- 设备管理（CRUD）
- 折旧计算逻辑（4种方法）
- 报表确认机制

### 待实现 ⏳
- 年度退税报表整合页面
- 支出汇总报表
- GST报表
- 财务报表（损益表、资产负债表）
- 设备处置功能
- 收入管理（与订单系统集成）

### 关系说明
**设备折旧报表** 是 **年度退税报表** 的一个子模块，专门处理设备资产的折旧计算和汇总。年度退税报表需要整合多个数据源（收入、支出、GST、折旧），生成完整的税务申报数据。

