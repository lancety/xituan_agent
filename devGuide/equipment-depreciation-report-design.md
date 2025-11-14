# 设备折旧报表系统设计

## 概述

设备折旧报表系统用于按财年生成设备折旧报表，支持多种折旧方法，符合澳洲ATO政策要求。

## 折旧方法枚举

直接使用新的折旧方法枚举（无需兼容旧数据）：

```typescript
export enum epDepreciationMethod {
  INSTANT_WRITE_OFF = 'instant_write_off',                    // 一次性资产扣除
  STRAIGHT_LINE = 'straight_line',                            // 直线法
  DIMINISHING_BALANCE_STANDARD = 'diminishing_balance_standard',  // 标准递减余额法（> $1,000）
  DIMINISHING_BALANCE_LOW_VALUE_POOL = 'diminishing_balance_low_value_pool',  // 低价值资产池（≤ $1,000）
}
```

## 数据库设计

### equipment 表新增字段

```sql
-- 首次使用的折旧方法（用于ATO合规检查）
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS 
    initial_depreciation_method VARCHAR(50);  -- 记录设备首次使用的折旧方法

-- 更新注释
COMMENT ON COLUMN equipment.initial_depreciation_method IS '首次使用的折旧方法（用于ATO合规检查，一旦有已确认记录，后续必须使用相同方法）';
```

**说明**：
- 当设备首次生成折旧记录时，自动记录到 `initial_depreciation_method`
- 如果设备已有已确认的折旧记录，后续财年必须使用相同的折旧方法（ATO要求）
- 如果设备没有已确认的记录，允许更改折旧方法（但会给出警告）

### equipment_depreciation_records 表（需要添加字段）

**需要添加的字段**（如果不存在）：

```sql
-- 计算初始值（JSON格式，保存计算时的完整信息）
ALTER TABLE equipment_depreciation_records ADD COLUMN IF NOT EXISTS 
    calculated_initial_data JSONB;

-- 报表确认标记
ALTER TABLE equipment_depreciation_records ADD COLUMN IF NOT EXISTS 
    is_committed BOOLEAN DEFAULT false,
    committed_at TIMESTAMP WITH TIME ZONE,
    committed_by UUID,
    commit_note TEXT;

-- 调整记录（如果用户手动修改过）
ALTER TABLE equipment_depreciation_records ADD COLUMN IF NOT EXISTS 
    is_adjusted BOOLEAN DEFAULT false,
    adjustment_reason TEXT,
    adjusted_at TIMESTAMP WITH TIME ZONE;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_equipment_depreciation_committed 
    ON equipment_depreciation_records(is_committed);
```

**关键字段说明**：
- `equipment_id` - 设备ID
- `financial_year` - 财年（如：'2024-25'）
- `depreciation_method` - 使用的折旧方法
- `opening_value` - 期初价值
- `depreciation_amount` - 折旧金额
- `closing_value` - 期末价值
- `calculated_initial_data` - 计算初始值（JSONB），保存完整计算信息
- `is_committed` - 是否已确认用于报表
- `committed_at` - 确认时间
- `committed_by` - 确认人ID
- `commit_note` - 确认备注
- `is_adjusted` - 是否手动调整过
- `adjustment_reason` - 调整原因
- `adjusted_at` - 调整时间

## API 设计

### 1. 生成折旧报表

**Endpoint**: `POST /api/equipment-depreciation/generate-report`

**Request**:
```typescript
{
  financialYear: string;  // 财年，如：'2024-25'
  equipmentIds?: string[];  // 可选，指定设备ID列表，不传则处理所有设备
}
```

**Response**:
```typescript
{
  success: boolean;
  data: {
    financialYear: string;
    records: Array<{
      equipmentId: string;
      equipmentName: string;
      depreciationRecordId?: string;  // 如果已存在记录
      status: 'created' | 'updated' | 'skipped';  // 新建/更新/跳过（已确认）
      openingValue: number;
      depreciationAmount: number;
      closingValue: number;
      depreciationMethod: string;
      isCommitted: boolean;
    }>;
    summary: {
      total: number;
      created: number;
      updated: number;
      skipped: number;  // 已确认的记录数量
    };
  };
}
```

### 2. 确认报表

**Endpoint**: `POST /api/equipment-depreciation/commit-report`

**Request**:
```typescript
{
  financialYear: string;
  recordIds?: string[];  // 可选，指定要确认的记录ID列表，不传则确认该财年所有记录
  commitNote?: string;  // 确认备注
}
```

**Response**:
```typescript
{
  success: boolean;
  data: {
    committedCount: number;
    financialYear: string;
  };
}
```

### 3. 获取报表数据

**Endpoint**: `GET /api/equipment-depreciation/report`

**Query Parameters**:
- `financialYear` (required) - 财年
- `equipmentId` (optional) - 设备ID过滤
- `isCommitted` (optional) - 是否已确认过滤

**Response**:
```typescript
{
  success: boolean;
  data: {
    financialYear: string;
    records: Array<{
      id: string;
      equipmentId: string;
      equipmentName: string;
      equipmentCategory: string;
      depreciationMethod: string;
      openingValue: number;
      depreciationAmount: number;
      closingValue: number;
      isCommitted: boolean;
      committedAt?: Date;
      committedBy?: string;
      commitNote?: string;
      calculatedInitialData?: any;  // JSON数据
      isAdjusted: boolean;
      adjustmentReason?: string;
    }>;
    summary: {
      totalEquipment: number;
      totalDepreciationAmount: number;
      committedCount: number;
      uncommittedCount: number;
    };
  };
}
```

### 4. 取消确认（可选，未来功能）

**Endpoint**: `POST /api/equipment-depreciation/uncommit-report`

**Request**:
```typescript
{
  recordIds: string[];  // 要取消确认的记录ID列表
  reason?: string;  // 取消原因
}
```

## 后端 Service 层设计

### EquipmentDepreciationReportService

```typescript
class EquipmentDepreciationReportService {
  /**
   * 生成折旧报表
   */
  async generateReport(financialYear: string, equipmentIds?: string[]): Promise<ReportGenerationResult> {
    // 1. 获取设备列表
    // 2. 对每个设备：
    //    - 检查是否存在该财年记录
    //    - 如果存在且 is_committed = true → 跳过
    //    - 如果存在且 is_committed = false → 重新计算
    //    - 如果不存在 → 新建
    // 3. 计算折旧（调用折旧计算工具）
    // 4. 保存或更新记录
  }

  /**
   * 确认报表
   */
  async commitReport(financialYear: string, recordIds?: string[], commitNote?: string): Promise<void> {
    // 1. 批量更新记录 is_committed = true
    // 2. 记录确认时间和确认人
  }

  /**
   * 获取报表数据
   */
  async getReport(financialYear: string, filters?: ReportFilters): Promise<ReportData> {
    // 查询折旧记录，关联设备信息
  }
}
```

### DepreciationCalculationUtil

```typescript
class DepreciationCalculationUtil {
  /**
   * 计算折旧
   */
  static calculateDepreciation(
    method: DepreciationMethod,
    openingValue: number,
    params: CalculationParams
  ): DepreciationResult {
    // 根据折旧方法计算
  }

  /**
   * 确定期初价值
   */
  static async determineOpeningValue(
    equipmentId: string,
    financialYear: string
  ): Promise<OpeningValueInfo> {
    // 查询上一个财年记录或使用设备购买价格
  }
}
```

## 前端 CMS 页面设计

### 1. 设备折旧报表页面

**路径**: `/equipment/depreciation-report`

**功能**:
- 财年选择器
- 生成报表按钮
- 报表数据表格
- 确认报表按钮
- 导出功能（未来）

**页面布局**:
```
┌─────────────────────────────────────────┐
│  设备折旧报表                            │
├─────────────────────────────────────────┤
│  财年: [2024-25 ▼]  [生成报表] [导出]   │
├─────────────────────────────────────────┤
│  汇总信息:                               │
│  总设备数: 10  总折旧额: $25,000         │
│  已确认: 8  未确认: 2                    │
├─────────────────────────────────────────┤
│  报表数据表格:                           │
│  ┌───────────────────────────────────┐ │
│  │设备名称│类别│方法│期初│折旧│期末│状态││
│  ├───────────────────────────────────┤ │
│  │设备1  │烤箱│直线│10000│2000│8000│✅││
│  │设备2  │搅拌│递减│5000 │2500│2500│⏳││
│  └───────────────────────────────────┘ │
├─────────────────────────────────────────┤
│  [确认报表] (仅未确认的记录)             │
└─────────────────────────────────────────┘
```

**表格列**:
- 设备名称
- 设备类别
- 折旧方法
- 期初价值
- 折旧金额
- 期末价值
- 确认状态（已确认✅ / 未确认⏳）
- 操作（查看详情、编辑-仅未确认）

### 2. 报表详情 Modal

**功能**:
- 显示设备信息
- 显示折旧记录详情
- 显示计算初始值（calculated_initial_data）
- 显示确认信息（如果已确认）
- 编辑功能（仅未确认记录）

### 3. 执行流程

#### 生成报表流程

```
用户操作：选择财年 → 点击"生成报表"

前端：
1. 调用 API: POST /api/equipment-depreciation/generate-report
2. 显示加载状态
3. 接收结果，显示成功/失败消息
4. 刷新报表数据表格

后端：
1. 验证财年格式
2. 获取设备列表（如果指定了equipmentIds则过滤）
3. 对每个设备执行：
   a. 查询是否存在该财年记录
   b. 如果存在且 is_committed = true：
      - 跳过，记录到 skipped 列表
   c. 如果存在且 is_committed = false：
      - 确定期初价值（查询上一年记录或使用购买价格）
      - 获取设备当前折旧方法设置
      - 检查是否有已确认的历史记录，如果有则使用相同的折旧方法
      - 调用折旧计算工具计算
      - 更新记录（包括 calculated_initial_data）
      - 记录到 updated 列表
   d. 如果不存在：
      - 确定期初价值
      - 获取设备折旧方法设置
      - 如果是首次折旧，记录到 initial_depreciation_method
      - 调用折旧计算工具计算
      - 创建新记录（包括 calculated_initial_data）
      - 记录到 created 列表
4. 返回结果（包含 created/updated/skipped 统计）
```

#### 确认报表流程

```
用户操作：查看报表 → 确认无误 → 点击"确认报表"

前端：
1. 显示确认对话框（显示将要确认的记录数量）
2. 用户输入确认备注（可选）
3. 调用 API: POST /api/equipment-depreciation/commit-report
4. 显示加载状态
5. 接收结果，显示成功消息
6. 刷新报表数据表格（状态变为已确认）

后端：
1. 验证财年和记录ID
2. 查询要确认的记录（如果未指定recordIds，则查询该财年所有未确认记录）
3. 批量更新：
   - is_committed = true
   - committed_at = 当前时间
   - committed_by = 当前用户ID
   - commit_note = 用户输入的备注
4. 返回确认数量
```

#### 查看报表流程

```
用户操作：选择财年 → 自动加载报表数据

前端：
1. 调用 API: GET /api/equipment-depreciation/report?financialYear=2024-25
2. 显示加载状态
3. 接收数据，渲染表格
4. 显示汇总信息

后端：
1. 查询折旧记录（关联设备表）
2. 应用过滤条件（equipmentId, isCommitted）
3. 计算汇总信息
4. 返回数据
```

## 折旧计算逻辑

### 期初价值确定

```typescript
async function determineOpeningValue(equipmentId: string, financialYear: string): Promise<{
  openingValue: number;
  source: 'previous_year_record' | 'equipment_purchase_price';
  previousYearRecordId?: string;
}> {
  // 1. 计算上一个财年
  const previousYear = getPreviousFinancialYear(financialYear);
  
  // 2. 查询上一个财年的折旧记录
  const previousRecord = await getDepreciationRecord(equipmentId, previousYear);
  
  if (previousRecord) {
    return {
      openingValue: previousRecord.closingValue,
      source: 'previous_year_record',
      previousYearRecordId: previousRecord.id
    };
  }
  
  // 3. 如果不存在，使用设备购买价格
  const equipment = await getEquipment(equipmentId);
  return {
    openingValue: equipment.purchasePrice,
    source: 'equipment_purchase_price'
  };
}
```

### 折旧方法确定

```typescript
async function determineDepreciationMethod(equipmentId: string): Promise<string> {
  // 1. 查询设备是否有已确认的折旧记录
  const committedRecords = await getCommittedDepreciationRecords(equipmentId);
  
  if (committedRecords.length > 0) {
    // 如果有已确认的记录，必须使用相同的折旧方法（ATO要求）
    return committedRecords[0].depreciationMethod;
  }
  
  // 2. 如果没有已确认的记录，使用设备当前设置的折旧方法
  const equipment = await getEquipment(equipmentId);
  return equipment.depreciationMethod;
}
```

### 折旧计算

```typescript
function calculateDepreciation(
  method: string,
  openingValue: number,
  equipment: Equipment,
  previousRecord?: DepreciationRecord
): {
  depreciationAmount: number;
  closingValue: number;
  calculationData: any;
} {
  let depreciationAmount: number;
  let calculationData: any;
  
  switch (method) {
    case 'instant_write_off':
      // 一次性扣除（仅第一年）
      if (previousRecord) {
        // 如果已有记录，说明不是第一年，不应该使用此方法
        throw new Error('一次性扣除只能在第一年使用');
      }
      depreciationAmount = openingValue;
      break;
      
    case 'straight_line':
      // 直线法：使用原始购买价格计算固定折旧额
      const originalPrice = equipment.purchasePrice;
      const usefulLifeYears = equipment.usefulLifeYears;
      if (!usefulLifeYears) {
        throw new Error('直线法需要提供使用年限');
      }
      depreciationAmount = originalPrice / usefulLifeYears;  // 固定值
      break;
      
    case 'diminishing_balance_standard':
      // 标准递减余额法：需要有效使用年限
      const effectiveLife = equipment.usefulLifeYears;  // 或从ATO表查询
      if (!effectiveLife) {
        throw new Error('标准递减余额法需要提供有效使用年限');
      }
      const rate = 200 / effectiveLife;  // 200% / 有效使用年限
      depreciationAmount = openingValue * (rate / 100);
      break;
      
    case 'diminishing_balance_low_value_pool':
      // 低价值资产池
      if (openingValue <= 300) {
        depreciationAmount = openingValue;  // 一次性扣除
      } else {
        // 判断是第一年还是后续年度
        const isFirstYear = !previousRecord;
        if (isFirstYear) {
          depreciationAmount = openingValue * 0.375;  // 37.5%
        } else {
          depreciationAmount = openingValue * 0.1875;  // 18.75%
        }
      }
      break;
  }
  
  const closingValue = openingValue - depreciationAmount;
  
  // 保存计算数据
  calculationData = {
    calculationDate: new Date().toISOString(),
    equipmentSnapshot: {
      id: equipment.id,
      depreciationMethod: method,
      purchasePrice: equipment.purchasePrice,
      usefulLifeYears: equipment.usefulLifeYears
    },
    calculationParams: {
      openingValue,
      method,
      // ... 其他参数
    },
    calculatedResult: {
      depreciationAmount,
      closingValue
    }
  };
  
  return {
    depreciationAmount: Math.round(depreciationAmount * 100) / 100,
    closingValue: Math.round(closingValue * 100) / 100,
    calculationData
  };
}
```

## 前端组件设计

### DepreciationReportPage 组件

```typescript
const DepreciationReportPage: React.FC = () => {
  const [financialYear, setFinancialYear] = useState<string>('');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  
  // 生成报表
  const handleGenerateReport = async () => {
    // 调用API生成报表
  };
  
  // 确认报表
  const handleCommitReport = async () => {
    // 调用API确认报表
  };
  
  return (
    <div>
      {/* 财年选择和操作按钮 */}
      {/* 汇总信息 */}
      {/* 报表表格 */}
      {/* 确认按钮 */}
    </div>
  );
};
```

## 详细执行流程

### 生成报表详细流程

```
1. 用户选择财年（如：2024-25）并点击"生成报表"

2. 前端调用 API: POST /admin/equipment-depreciation/generate-report
   Request Body: { financialYear: "2024-25" }

3. 后端处理流程：
   
   a. 验证财年格式（YYYY-YY格式）
   
   b. 获取所有设备列表（或根据equipmentIds过滤）
      - 只处理状态为 'active' 的设备
      - 排除已处置（disposed）和已注销（written_off）的设备
   
   c. 对每个设备执行：
      
      i. 查询是否存在该财年的折旧记录
         SELECT * FROM equipment_depreciation_records 
         WHERE equipment_id = ? AND financial_year = ?
      
      ii. 如果记录存在且 is_committed = true：
          - 跳过，不重新计算
          - 记录到 skipped 列表
          - 原因：已确认用于报税，不可修改
      
      iii. 如果记录存在且 is_committed = false：
          - 确定期初价值：
            * 查询上一个财年记录（如：2023-24）
            * 如果存在 → 使用其 closing_value
            * 如果不存在 → 使用设备 purchase_price
          
          - 确定折旧方法：
            * 查询设备是否有已确认的历史折旧记录
            * 如果有 → 使用相同的折旧方法（ATO要求）
            * 如果没有 → 使用设备当前设置的 depreciation_method
          
          - 调用折旧计算工具计算：
            * DepreciationCalculationUtil.calculateDepreciation()
            * 传入：方法、期初价值、设备信息、参数
          
          - 更新记录：
            * 更新 opening_value, depreciation_amount, closing_value
            * 更新 depreciation_method（如果改变了）
            * 更新 calculated_initial_data（保存完整计算信息）
            * 更新 updated_at
          
          - 记录到 updated 列表
      
      iv. 如果记录不存在：
          - 确定期初价值（同上）
          
          - 确定折旧方法：
            * 使用设备当前设置的 depreciation_method
            * 如果是首次折旧，记录到 equipment.initial_depreciation_method
          
          - 调用折旧计算工具计算
          
          - 创建新记录：
            * 插入新记录到 equipment_depreciation_records
            * 保存 calculated_initial_data
            * is_committed = false（未确认）
          
          - 记录到 created 列表
   
   d. 返回结果：
      {
        success: true,
        data: {
          financialYear: "2024-25",
          records: [...],  // 所有处理的记录
          summary: {
            total: 10,
            created: 3,
            updated: 5,
            skipped: 2
          }
        }
      }

4. 前端接收结果：
   - 显示成功消息："成功生成报表：新建3条，更新5条，跳过2条（已确认）"
   - 自动刷新报表数据表格
   - 显示汇总信息
```

### 确认报表详细流程

```
1. 用户查看报表数据，确认无误后点击"确认报表"

2. 前端显示确认对话框：
   - 显示将要确认的记录数量
   - 输入确认备注（可选）
   - 确认按钮

3. 用户点击确认后，前端调用 API: POST /admin/equipment-depreciation/commit-report
   Request Body: {
     financialYear: "2024-25",
     commitNote: "2024-25财年税务报表"
   }

4. 后端处理流程：
   
   a. 验证财年格式
   
   b. 查询该财年所有未确认的记录：
      SELECT * FROM equipment_depreciation_records
      WHERE financial_year = ? AND is_committed = false
   
   c. 批量更新记录：
      UPDATE equipment_depreciation_records
      SET 
        is_committed = true,
        committed_at = CURRENT_TIMESTAMP,
        committed_by = ? (当前用户ID),
        commit_note = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE financial_year = ? AND is_committed = false
   
   d. 返回结果：
      {
        success: true,
        data: {
          committedCount: 8,
          financialYear: "2024-25"
        }
      }

5. 前端接收结果：
   - 显示成功消息："成功确认8条折旧记录"
   - 刷新报表数据表格（状态变为已确认）
   - 禁用编辑功能
```

### 查看报表详细流程

```
1. 用户选择财年，页面自动加载报表数据

2. 前端调用 API: GET /admin/equipment-depreciation/report?financialYear=2024-25

3. 后端处理流程：
   
   a. 查询折旧记录，关联设备信息：
      SELECT 
        r.*,
        e.name as equipment_name,
        e.category as equipment_category
      FROM equipment_depreciation_records r
      LEFT JOIN equipment e ON r.equipment_id = e.id
      WHERE r.financial_year = ?
      ORDER BY e.name, r.financial_year
   
   b. 计算汇总信息：
      - 总设备数
      - 总折旧金额（SUM(depreciation_amount)）
      - 已确认数量（COUNT WHERE is_committed = true）
      - 未确认数量（COUNT WHERE is_committed = false）
   
   c. 返回数据

4. 前端渲染：
   - 显示汇总信息卡片
   - 渲染报表数据表格
   - 根据 is_committed 状态显示不同的操作按钮
```

## 前端 CMS 页面详细设计

### 1. 设备折旧报表页面

**文件路径**: `xituan_cms/src/pages/equipment/depreciation-report.tsx`

**组件结构**:
```typescript
const DepreciationReportPage: React.FC = () => {
  const [financialYear, setFinancialYear] = useState<string>('');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [committing, setCommitting] = useState(false);
  
  // 生成报表
  const handleGenerateReport = async () => {
    // 调用API
  };
  
  // 确认报表
  const handleCommitReport = async () => {
    // 调用API
  };
  
  // 加载报表数据
  const loadReportData = async () => {
    // 调用API
  };
  
  return (
    <PageContainer>
      {/* 页面标题和操作栏 */}
      {/* 汇总信息卡片 */}
      {/* 报表数据表格 */}
      {/* 确认报表按钮 */}
    </PageContainer>
  );
};
```

**页面布局详细设计**:

```
┌─────────────────────────────────────────────────────────────┐
│  设备折旧报表                                                │
├─────────────────────────────────────────────────────────────┤
│  [财年选择: 2024-25 ▼]  [生成报表] [导出Excel] [刷新]      │
├─────────────────────────────────────────────────────────────┤
│  汇总信息卡片:                                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │总设备数  │ │总折旧额  │ │已确认    │ │未确认    │      │
│  │   10     │ │ $25,000  │ │   8      │ │   2      │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
├─────────────────────────────────────────────────────────────┤
│  报表数据表格:                                               │
│  ┌───────────────────────────────────────────────────────┐ │
│  │[筛选: 全部▼] [搜索设备名称...]                        │ │
│  ├───────────────────────────────────────────────────────┤ │
│  │设备名称│类别│方法│期初价值│折旧金额│期末价值│状态│操作││
│  ├───────────────────────────────────────────────────────┤ │
│  │烤箱   │设备│直线│$10,000│$2,000 │$8,000 │✅已确认│查看││
│  │搅拌机 │设备│递减│$5,000 │$2,500 │$2,500 │⏳未确认│编辑││
│  │冰箱   │设备│直线│$8,000 │$1,600 │$6,400 │⏳未确认│编辑││
│  └───────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  [确认报表] (将确认2条未确认的记录)                          │
└─────────────────────────────────────────────────────────────┘
```

**表格列详细设计**:

| 列名 | 字段 | 宽度 | 说明 |
|------|------|------|------|
| 设备名称 | equipmentName | 150px | 可点击查看设备详情 |
| 设备类别 | equipmentCategory | 100px | 显示类别标签 |
| 折旧方法 | depreciationMethod | 120px | 显示方法标签（带颜色） |
| 期初价值 | openingValue | 120px | 货币格式显示 |
| 折旧金额 | depreciationAmount | 120px | 货币格式显示，加粗 |
| 期末价值 | closingValue | 120px | 货币格式显示 |
| 确认状态 | isCommitted | 100px | 已确认✅ / 未确认⏳ |
| 操作 | - | 150px | 查看详情 / 编辑（仅未确认） |

### 2. 报表详情/编辑 Modal

**组件**: `DepreciationRecordDetailModal`

**功能**:
- 显示设备基本信息
- 显示折旧记录详情
- 显示计算初始值（calculated_initial_data）的JSON数据
- 显示确认信息（如果已确认）
- 编辑功能（仅未确认记录）

**布局**:
```
┌─────────────────────────────────────┐
│  折旧记录详情                    [×] │
├─────────────────────────────────────┤
│  设备信息:                           │
│  名称: 烤箱                           │
│  类别: 设备                           │
│  购买价格: $10,000                    │
│  购买日期: 2023-01-15                │
├─────────────────────────────────────┤
│  折旧信息:                           │
│  财年: 2024-25                       │
│  折旧方法: 直线法                     │
│  期初价值: $10,000                    │
│  折旧金额: $2,000                     │
│  期末价值: $8,000                     │
├─────────────────────────────────────┤
│  确认状态: ✅ 已确认                  │
│  确认时间: 2025-01-15 10:30:00       │
│  确认人: 张三                         │
│  确认备注: 2024-25财年税务报表        │
├─────────────────────────────────────┤
│  计算初始值:                          │
│  [展开JSON数据]                       │
├─────────────────────────────────────┤
│  [关闭]                              │
└─────────────────────────────────────┘
```

### 3. 财年选择器组件

**功能**:
- 自动生成财年列表（如：2020-21, 2021-22, ..., 2024-25）
- 默认选择当前财年
- 财年格式：YYYY-YY（如：2024-25）

**实现**:
```typescript
const getFinancialYear = (date: Date): string => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  
  // 澳洲财年：7月1日 - 次年6月30日
  if (month >= 7) {
    // 7月-12月：当前年份-下一年份
    return `${year}-${String(year + 1).slice(-2)}`;
  } else {
    // 1月-6月：上一年份-当前年份
    return `${year - 1}-${String(year).slice(-2)}`;
  }
};

const getFinancialYearList = (startYear: number, endYear: number): string[] => {
  const years: string[] = [];
  for (let year = startYear; year <= endYear; year++) {
    years.push(`${year}-${String(year + 1).slice(-2)}`);
  }
  return years.reverse(); // 最新的在前
};
```

## 实施步骤

### 阶段1：数据库迁移 ✅

1. **创建迁移文件**: `1710000000201_add_equipment_depreciation_report_fields.sql` ✅ 已完成
   - 添加 `equipment.initial_depreciation_method` 字段
   - 添加 `equipment_depreciation_records` 表的确认和计算相关字段
   - 添加索引
   - **注意**：已恢复原有migration文件，所有新字段都在新文件中添加

### 阶段2：更新类型定义

1. **更新枚举**: `equipment.type.ts` ✅ 已完成
   - 已更新 `epDepreciationMethod` 枚举为新的四种折旧方法
   - 已更新前端和后端的枚举定义
   
2. **更新接口**: `equipment-depreciation.type.ts`
   - 添加报表生成相关的请求/响应接口
   - 添加计算初始数据的类型定义
   - 添加 `initial_depreciation_method` 字段到 `iEquipment` 接口

### 阶段3：后端实现

1. **创建折旧计算工具**: `depreciationCalculation.util.ts`
   - 实现四种折旧方法的计算逻辑
   - 实现期初价值确定逻辑
   - 实现折旧方法确定逻辑（检查已确认记录）

2. **创建报表服务**: `equipment-depreciation-report.service.ts`
   - 实现报表生成逻辑
   - 实现报表确认逻辑
   - 实现报表查询逻辑

3. **更新Controller**: `equipment-depreciation.controller.ts`
   - 添加生成报表接口
   - 添加确认报表接口
   - 添加获取报表接口

4. **更新Routes**: `equipment-depreciation.routes.ts`
   - 添加新的路由

### 阶段4：前端实现

1. **创建API客户端**: `equipment-depreciation-report.api.ts`
   - 实现报表生成API调用
   - 实现报表确认API调用
   - 实现报表查询API调用

2. **创建报表页面**: `pages/equipment/depreciation-report.tsx`
   - 实现页面布局
   - 实现报表生成功能
   - 实现报表确认功能
   - 实现表格显示

3. **创建详情Modal**: `components/equipment/DepreciationRecordDetailModal.tsx`
   - 实现详情显示
   - 实现编辑功能（仅未确认）

### 阶段5：测试

1. 测试各种折旧方法的计算准确性
2. 测试报表生成流程
3. 测试报表确认流程
4. 测试已确认记录的锁定机制
5. 测试折旧方法一致性检查

