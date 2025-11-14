# Textract OCR 发票识别系统

## 概述

本系统使用 AWS Textract 的 `AnalyzeExpense` API 对收据/发票进行 OCR 识别，主要用于原材料支出（`raw_material` expense type）的自动识别和数据提取。

## 识别流程

### 1. 上传并识别（`uploadAndRecognize`）

**流程**：
1. **上传图片到 S3**：临时文件名格式 `expense_{day}_{hours}_{minutes}_{uuid}.{ext}`
2. **调用 Textract OCR**：使用 `AnalyzeExpense` API 识别收据
3. **OCR 失败处理**：如果识别失败，删除 S3 图片并抛出错误（只有成功的 OCR 才会保留记录）
4. **重命名 S3 文件**：如果识别成功且包含供应商名称，使用规范化后的供应商名称重命名文件
5. **匹配供应商**：根据 OCR 识别的供应商名称匹配现有供应商（通过名称或别名）
6. **处理商品项**：
   - 如果供应商匹配且 `isPriceInclusiveGst=true`，将所有商品项的 `isGstRefundable` 设置为 `true`
   - 转换商品项格式（从 `iRawMaterialReceiptItem` 到 `iExpenseItem`）
   - 标记所有 OCR 识别的商品项为 `isManualEntry: false`（不可删除）
7. **提取发票号**：从 OCR 结果中提取发票/收据号码（`INVOICE_RECEIPT_ID`、`INVOICE_NUMBER` 或 `RECEIPT_NUMBER` 字段）
8. **计算金额**：根据供应商的 GST 设置和商品项计算总金额、GST 金额和净金额
9. **创建数据库记录**：
   - 如果供应商匹配，使用供应商的正式名称（而非 OCR 识别的名称）
   - 保存 `receiptNumber`（OCR 识别的发票/收据号码）
   - 保存 `receiptTotalAmount`（OCR 识别的原始总金额，不会因商品选择而改变）
   - 保存 `items`（JSONB 格式的商品列表）
   - 保存 `ocrRawData`（OCR 原始数据，用于调试和重新分析）

### 2. 重新识别（`reRecognize`）

**用途**：对已存在的支出记录重新进行 OCR 识别（使用 S3 中的原始图片）

**流程**：
1. 从数据库获取支出记录和图片路径
2. 调用 Textract OCR 重新识别
3. 匹配供应商并处理商品项（同 `uploadAndRecognize`）
4. 更新 `ocrRawDataTemp`（临时存储，不覆盖原始 `ocrRawData`）
5. 返回识别结果（不更新数据库，需要用户确认后保存）

### 3. 重新分析（`reAnalyze`）

**用途**：使用已保存的 OCR 原始数据重新分析（不重新调用 Textract API）

**流程**：
1. 从数据库获取支出记录和 `ocrRawData` 或 `ocrRawDataTemp`
2. 解析 OCR 原始数据
3. 匹配供应商并处理商品项（同 `uploadAndRecognize`）
4. 更新 `ocrRawDataTemp`
5. 返回分析结果（不更新数据库，需要用户确认后保存）

### 4. 手动上传（`uploadImageManually`）

**用途**：上传图片但不进行 OCR 识别（适用于中文收据或手动输入模式）

**流程**：
1. 上传图片到 S3（文件名包含 `manual` 标识）
2. 返回图片路径（不创建数据库记录）

## 数据处理

### 商品项转换

**从 `iRawMaterialReceiptItem` 到 `iExpenseItem`**：
```typescript
{
  name: item.itemName,                    // 商品名称
  quantity: item.quantity,                // 数量
  unitPrice: item.unitPrice,              // 单价
  totalPrice: item.lineTotal,             // 总价
  isGstRefundable: item.isGstRefundable,  // 是否有 GST
  gstAmount: item.gstAmount,              // GST 金额（可选）
  isSelected: item.isSelected,             // 是否选中（false = 个人使用）
  isManualEntry: false                    // OCR 识别，不可删除
}
```

### GST 计算逻辑

**前端金额计算**（基于供应商的 `isPriceInclusiveGst` 和选中商品项）：

**计算步骤**：
1. 筛选选中商品（`isSelected = true`）
2. 计算商品总价（`itemsTotal`）= 所有选中商品的 `totalPrice` 之和
3. 根据供应商的 `isPriceInclusiveGst` 设置计算：

**1. 供应商价格含 GST**（`isPriceInclusiveGst = true`，或未绑定供应商时默认按此处理）：
   - **总金额** = `itemsTotal`（商品总价）
   - **GST 金额** = 所有 `isGstRefundable = true` 的商品项的 `totalPrice / 11` 之和
   - **净金额** = 总金额 - GST 金额

**2. 供应商价格不含 GST**（`isPriceInclusiveGst = false`）：
   - **净金额** = `itemsTotal`（商品总价，作为净金额）
   - **GST 金额** = 所有 `isGstRefundable = true` 的商品项的 `totalPrice / 10` 之和
   - **总金额** = 净金额 + GST 金额

**重要说明**：
- 商品项的 `totalPrice` 是数量 × 单价的结果
- 只有 `isGstRefundable = true` 的商品项才参与 GST 计算
- 只有 `isSelected = true` 的商品项才参与总金额计算（`isSelected = false` 表示个人使用，不参与报税和统计）
- 使用 `priceUtil.round()` 确保所有金额保留 2 位小数

### 供应商匹配

**匹配逻辑**：
1. 使用 OCR 识别的供应商名称
2. 在 `suppliers` 表中查找：
   - 名称完全匹配
   - 或别名（`aliases` 数组）中包含该名称
3. 如果匹配成功：
   - 设置 `supplierId`
   - 使用供应商的正式名称（而非 OCR 识别的名称）
   - 如果供应商的 `isPriceInclusiveGst = true`，自动设置所有商品项的 `isGstRefundable = true`
4. 如果匹配失败：
   - `supplierId = null`
   - 使用 OCR 识别的供应商名称

### 供应商名称规范化

**用途**：将供应商名称规范化后用于 S3 文件名

**规则**：
- 移除特殊字符
- 转换为小写
- 替换空格为下划线
- 限制长度

## 前端使用方式

### 1. 自动识别模式（默认）

**流程**：
1. 用户点击"添加支出"
2. 默认进入自动识别模式
3. 上传收据图片
4. 自动调用 `uploadAndRecognize` API
5. 显示识别结果：
   - 供应商名称（如果匹配，显示正式名称）
   - 支出日期
   - 收据总价（`receiptTotalAmount`）
   - 商品列表（所有商品项标记为 `isManualEntry: false`）
   - 供应商匹配状态（显示下拉菜单供选择或创建新供应商）
6. 用户确认并调整后保存

### 2. 手动输入模式

**流程**：
1. 用户切换到手动输入模式
2. 上传收据图片（可选，调用 `uploadImageManually`）
3. 手动输入：
   - 供应商名称
   - 支出日期
   - 商品列表（手动添加，标记为 `isManualEntry: true`，可以删除）
4. 保存

### 3. 编辑模式

**功能**：
- **图片不可更改**：编辑模式下图片为只读
- **重新识别**：点击"重新识别"按钮，调用 `reRecognize` API
- **重新分析**：点击"重新分析"按钮，调用 `reAnalyze` API
- **字段更新**：
  - 重新识别/分析会更新 OCR 识别的字段（供应商名称、日期、商品列表等）
  - 保留手动输入的字段（备注等）

### 4. 商品项管理

**OCR 识别的商品项**（`isManualEntry: false`）：
- 不可删除（删除按钮不显示或禁用）
- 可以编辑（名称、数量、单价、GST 设置等）
- 在移动端显示为卡片，右上角不显示删除按钮

**手动添加的商品项**（`isManualEntry: true`）：
- 可以删除（显示删除按钮）
- 可以编辑
- 在移动端显示为卡片，右上角显示 X 删除按钮

## 已实施的改进

### 1. 地址清理 (`cleanAddress`)

**改进逻辑**：
```typescript
1. 移除电话号码模式（如 "PH: 02 9308 7376"）
2. 移除门店编号+地名前缀（如 "1160 Gordon"）
3. 提取包含街道名称的部分（优先匹配门牌号+街道名）
4. 清理多余空格和标点
```

**处理示例**：
- 输入：`"1160 Gordon PH: 02 9308 7376808 Pacific Highway"`
- 输出：`"808 Pacific Highway"`

### 2. 条形码验证 (`validateBarcode`)

**验证规则**：
- ✅ 纯数字，长度8-20位
- ✅ 或主要包含数字（至少80%是数字）
- ❌ 排除包含常见单词（如 "pacific", "highway"）
- ❌ 排除包含3个以上连续字母

**处理示例**：
- `"808PacificHighway"` → 被拒绝（包含单词）
- `"1234567890123"` → 通过验证
- `"ABC123456789"` → 被拒绝（字母过多）

### 3. 单价智能计算

**改进逻辑**：
```typescript
1. 优先使用 Textract 的 PRICE 字段
2. 检查：如果 PRICE ≈ EXPENSE_AMOUNT（总价），说明识别错误
3. 重新计算：单价 = 总价 / 数量
4. 如果单价为0，也用总价/数量计算
```

**处理示例**：
- 数量=4，Textract PRICE=$23.20，EXPENSE_AMOUNT=$23.20
- 检测到单价=总价 → 重新计算：单价 = $23.20 / 4 = $5.80

## 进一步改进建议

### 1. 地址提取优化

**当前方案**：基于正则表达式匹配街道名称
**改进方向**：
- 使用更智能的地址解析库（如 `address-parser`）
- 识别并移除更多无关前缀模式
- 支持多种地址格式（澳大利亚、中国等）

**示例代码**：
```typescript
// 可以添加更多地址清理规则
- 移除 "Store No."、"Shop" 等前缀
- 识别并保留邮政编码
- 区分门店地址和总部地址
```

### 2. 条形码识别优化

**当前方案**：格式验证 + 排除常见单词
**改进方向**：
- 尝试从收据底部区域提取（条形码通常在底部）
- 使用 Textract 的 `DetectDocumentText` API 获取原始文本位置
- 分析文本位置，优先选择底部区域的数字字符串

**示例代码**：
```typescript
// 可以结合 AnalyzeDocument 获取文本位置信息
// 优先选择位于收据底部（Y坐标较大）的数字字符串
```

### 3. 单价识别优化

**当前方案**：检测单价=总价后重新计算
**改进方向**：
- 分析 Textract 返回的所有价格字段
- 检查 `QUANTITY` 字段的准确性
- 如果数量=1，单价应该等于总价（这是正常的）
- 如果数量>1，单价应该小于总价

**示例代码**：
```typescript
// 更智能的单价提取逻辑
if (quantity === 1) {
  // 数量为1时，单价可能等于总价，这是正常的
  unitPrice = lineTotal;
} else if (quantity > 1) {
  // 数量>1时，如果单价>=总价，说明识别错误
  if (unitPrice >= lineTotal) {
    unitPrice = lineTotal / quantity;
  }
}
```

### 4. 使用 AnalyzeDocument API 作为补充

#### AnalyzeExpense vs AnalyzeDocument 的区别

**当前使用的 AnalyzeExpense API**：
- ✅ **专门为收据/发票设计**，返回结构化数据
- ✅ **自动识别字段类型**：VENDOR_NAME, VENDOR_ADDRESS, LINE_ITEMS, TOTAL 等
- ✅ **直接返回解析好的数据**，无需手动解析
- ❌ **不提供文本位置信息**（X, Y坐标）
- ❌ **字段识别可能不准确**（如地址包含无关内容）
- ❌ **无法获取原始文本布局**

**AnalyzeDocument API**：
- ✅ **提供原始文本和位置信息**（每个文本块都有 X, Y 坐标）
- ✅ **可以分析文档结构**：Forms（表单字段）、Tables（表格）
- ✅ **可以获取完整的文本内容**，包括所有识别到的文本
- ✅ **可以分析文本的布局关系**（哪些文本在同一行、同一列）
- ❌ **需要手动解析和映射字段**（不像 AnalyzeExpense 那样自动识别）
- ❌ **不专门针对收据/发票**，是通用文档分析

#### 如何结合使用

**方案1：AnalyzeExpense 为主，AnalyzeDocument 为辅（推荐）**
```typescript
1. 先用 AnalyzeExpense 获取结构化数据（当前方式）
2. 如果识别结果有问题（如地址包含无关内容），调用 AnalyzeDocument
3. 使用 AnalyzeDocument 的文本位置信息来：
   - 验证和清理地址（找到真正的地址行）
   - 找到条形码位置（通常在收据底部）
   - 验证单价和总价的关系（通过文本位置判断）
```

**方案2：AnalyzeDocument 为主（适用于复杂收据）**
```typescript
1. 使用 AnalyzeDocument 获取所有文本和位置
2. 根据文本位置和布局关系，手动解析：
   - 地址：通常在顶部，包含街道名称
   - 条形码：通常在底部，是纯数字
   - 商品列表：在中间，是表格结构
3. 使用 Forms 和 Tables 功能提取结构化数据
```

#### 实际应用示例

**使用 AnalyzeDocument 改进地址提取**：
```typescript
// 1. AnalyzeExpense 返回：VENDOR_ADDRESS = "1160 Gordon PH: 02 9308 7376808 Pacific Highway"
// 2. 调用 AnalyzeDocument 获取文本位置
// 3. 找到包含 "Highway" 或 "Street" 的文本行（通常是地址）
// 4. 提取该行的完整文本作为地址
```

**使用 AnalyzeDocument 改进条形码提取**：
```typescript
// 1. AnalyzeDocument 返回所有文本块及其位置
// 2. 找到位于收据底部（Y坐标较大）的文本
// 3. 在这些文本中查找符合条形码格式的纯数字字符串
// 4. 优先选择底部区域的条形码
```

**使用 AnalyzeDocument 改进单价提取**：
```typescript
// 1. AnalyzeDocument 返回表格结构
// 2. 分析表格列：商品名、数量、单价、总价
// 3. 通过列位置关系，准确区分单价和总价
// 4. 如果数量列和总价列在同一行，用总价/数量计算单价
```

### 5. 机器学习后处理

**建议**：对于常见供应商（如 Woolworths, Coles），可以建立识别规则库
- 存储已知的地址格式、条形码位置等
- 针对特定供应商优化识别逻辑
- 使用历史数据训练识别模型

## 测试建议

### 测试用例

1. **地址清理测试**：
   - `"1160 Gordon PH: 02 9308 7376808 Pacific Highway"` → `"808 Pacific Highway"`
   - `"Store 123, 456 Main Street"` → `"456 Main Street"`
   - `"Shop 5, 789 King Road, Sydney NSW 2000"` → `"789 King Road, Sydney NSW 2000"`

2. **条形码验证测试**：
   - `"1234567890123"` → ✅ 通过
   - `"808PacificHighway"` → ❌ 拒绝
   - `"ABC123456789"` → ❌ 拒绝（字母过多）

3. **单价计算测试**：
   - 数量=4，PRICE=$23.20，EXPENSE_AMOUNT=$23.20 → 单价=$5.80
   - 数量=1，PRICE=$6.50，EXPENSE_AMOUNT=$6.50 → 单价=$6.50（正常）
   - 数量=2，PRICE=$7.70，EXPENSE_AMOUNT=$15.40 → 单价=$7.70（正常）

## 监控和日志

**建议添加**：
- 记录原始识别结果和清理后的结果
- 记录单价重新计算的次数和原因
- 记录条形码验证失败的候选值
- 定期分析识别准确率，识别常见错误模式

## 相关文件

### 后端
- `xituan_backend/src/domains/expense/services/expense.service.ts` - 支出服务（OCR 识别逻辑）
- `xituan_backend/src/domains/expense/services/textract-ocr.service.ts` - Textract OCR 服务（如果存在）
- `xituan_backend/src/domains/expense/controllers/expense.controller.ts` - 支出控制器（API 端点）
- `xituan_backend/src/domains/expense/routes/expense.routes.ts` - 支出路由

### 前端
- `xituan_cms/src/components/expenses/ExpenseEditModal.tsx` - 支出编辑模态框（OCR 识别 UI）
- `xituan_cms/src/lib/api/expense.api.ts` - 支出 API 客户端

### 类型定义
- `xituan_backend/submodules/xituan_codebase/typing_entity/expense.type.ts` - 支出类型定义（包括 `iExpenseItem`）
- `xituan_backend/submodules/xituan_codebase/typing_entity/supplier.type.ts` - 供应商类型定义
