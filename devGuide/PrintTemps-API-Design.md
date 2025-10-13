# 打印模板系统 API 设计

## 📋 API 概览

### 基础信息
- **基础路径**: `/api/printTemps`
- **版本**: v1.0
- **认证**: 需要用户认证
- **内容类型**: `application/json`

### 响应格式
所有API响应都遵循统一格式：
```json
{
  "success": true,
  "data": {}, // 或 []
  "message": "操作成功",
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "details": "详细错误信息"
  }
}
```

## 🗂️ 路由结构

### 1. 打印模板管理路由

#### 获取打印模板列表
```http
GET /api/printTemps
```

**查询参数**:
- `entityType` (string, optional): 实体类型筛选
- `category` (string, optional): 模板分类筛选  
- `status` (string, optional): 状态筛选 (active/inactive)
- `keyword` (string, optional): 关键词搜索
- `page` (number, optional): 页码，默认1
- `size` (number, optional): 每页数量，默认20
- `sortBy` (string, optional): 排序字段，默认created_at
- `sortOrder` (string, optional): 排序方向，默认desc

**响应示例**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "template_001",
        "name": "产品标签模板",
        "description": "标准产品标签",
        "category": "product_label",
        "entityType": "product",
        "size": { "width": 40, "height": 30 },
        "version": 1,
        "isActive": true,
        "createdAt": "2024-01-20T10:00:00Z",
        "updatedAt": "2024-01-20T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "size": 20,
      "total": 100,
      "totalPages": 5
    }
  },
  "message": "获取模板列表成功"
}
```

#### 创建打印模板
```http
POST /api/printTemps
```

**请求体**:
```json
{
  "name": "新模板",
  "description": "模板描述",
  "category": "product_label",
  "size": { "width": 40, "height": 30 },
  "elements": [
    {
      "type": "text",
      "position": { "x": 5, "y": 5 },
      "size": { "width": 30, "height": 10 },
      "dataBinding": {
        "type": "entity",
        "entityPath": "product.name"
      },
      "styles": {
        "fontFamily": "Arial",
        "fontSize": 12,
        "color": "#000000"
      }
    }
  ],
  "entityType": "product"
}
```

#### 获取单个打印模板
```http
GET /api/printTemps/:id
```

**路径参数**:
- `id` (string): 模板ID

#### 更新打印模板
```http
PUT /api/printTemps/:id
```

**路径参数**:
- `id` (string): 模板ID

**请求体**: 同创建请求体

#### 删除打印模板
```http
DELETE /api/printTemps/:id
```

**路径参数**:
- `id` (string): 模板ID

### 2. 模板操作路由

#### 复制模板
```http
POST /api/printTemps/:id/duplicate
```

**路径参数**:
- `id` (string): 要复制的模板ID

**请求体**:
```json
{
  "name": "复制的模板名称",
  "description": "复制的模板描述"
}
```

#### 批量操作
```http
POST /api/printTemps/batch
```

**请求体**:
```json
{
  "operation": "activate|deactivate|delete",
  "templateIds": ["id1", "id2", "id3"]
}
```

### 3. 统计和分析路由

#### 获取使用统计
```http
GET /api/printTemps/statistics/usage
```

**查询参数**:
- `startDate` (string, optional): 开始日期
- `endDate` (string, optional): 结束日期
- `templateId` (string, optional): 特定模板ID

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "templateId": "template_001",
      "templateName": "产品标签模板",
      "category": "product_label",
      "usageCount": 150,
      "totalPrints": 300,
      "lastUsed": "2024-01-20T15:30:00Z"
    }
  ],
  "message": "获取使用统计成功"
}
```

#### 获取元素统计
```http
GET /api/printTemps/statistics/elements
```

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "type": "text",
      "count": 45,
      "avgWidth": 25.5,
      "avgHeight": 8.2
    },
    {
      "type": "barcode",
      "count": 12,
      "avgWidth": 30.0,
      "avgHeight": 15.0
    }
  ],
  "message": "获取元素统计成功"
}
```

#### 获取筛选选项
```http
GET /api/printTemps/filters
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "entityTypes": ["product", "invoice", "customer"],
    "categories": ["product_label", "invoice_label", "custom_label"],
    "statuses": ["active", "inactive"]
  },
  "message": "获取筛选选项成功"
}
```

### 4. 使用记录路由

#### 记录模板使用
```http
POST /api/printTemps/:id/log-usage
```

**路径参数**:
- `id` (string): 模板ID

**请求体**:
```json
{
  "page_route": "/products/label",
  "print_count": 5
}
```

### 5. 图片管理路由

#### 上传模板图片
```http
POST /api/printTemps/:id/images
Content-Type: multipart/form-data
```

**路径参数**:
- `id` (string): 模板ID

**表单数据**:
- `image` (file): 图片文件 (最大5MB)

**响应示例**:
```json
{
  "success": true,
  "data": {
    "imageUrl": "/uploads/templates/template_001/image_001.jpg",
    "imageId": "img_001"
  },
  "message": "图片上传成功"
}
```

#### 删除模板图片
```http
DELETE /api/printTemps/:id/images
```

**路径参数**:
- `id` (string): 模板ID

**请求体**:
```json
{
  "imageId": "img_001"
}
```

#### 清理模板图片
```http
DELETE /api/printTemps/:id/cleanup-images
```

**路径参数**:
- `id` (string): 模板ID

## 🔧 实体字段路由

### 基础路径
`/api/entityFields`

#### 获取实体字段
```http
GET /api/entityFields/:entityType
```

**路径参数**:
- `entityType` (string): 实体类型 (product/invoice/customer/partner)

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "path": "name",
      "name": "产品名称",
      "type": "string",
      "required": true,
      "description": "产品的显示名称"
    },
    {
      "path": "metadata.barCode",
      "name": "条形码",
      "type": "string",
      "required": false,
      "description": "产品条形码"
    }
  ],
  "message": "获取实体字段成功"
}
```

#### 验证字段路径
```http
POST /api/entityFields/validate
```

**请求体**:
```json
{
  "entityType": "product",
  "fieldPath": "metadata.barCode"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "fieldType": "string",
    "description": "产品条形码"
  },
  "message": "字段路径验证成功"
}
```

### 元数据路由

#### 获取实体类型
```http
GET /api/entityFields/meta/entity-types
```

#### 获取模板分类
```http
GET /api/entityFields/meta/print-temp-categories
```

#### 获取元素类型
```http
GET /api/entityFields/meta/element-types
```

## 📊 数据模型

### 打印模板 (iPrintTemp)
```typescript
interface iPrintTemp {
  id: string;
  name: string;
  description: string;
  category: epPrintTempCategory;
  size: { width: number; height: number }; // 单位：mm
  elements: iPrintTempElement[];
  entityType: epEntityType;
  requiredFields: string[];
  optionalFields: string[];
  version: number;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### 模板元素 (iPrintTempElement)
```typescript
interface iPrintTempElement {
  id: string;
  type: epPrintTempElementType;
  position: { x: number; y: number }; // 单位：mm
  size: { width: number; height: number }; // 单位：mm
  dataBinding: iPrintTempDataBinding;
  styles: iPrintTempElementStyles;
  zIndex: number;
}
```

### 数据绑定 (iPrintTempDataBinding)
```typescript
interface iPrintTempDataBinding {
  type: 'fixed' | 'entity' | 'calculated' | 'date' | 'time';
  value?: string; // 固定值
  entityPath?: string; // 实体属性路径
  calculation?: iPrintTempCalculation; // 计算规则
  dateTimeConfig?: iPrintTempDateTimeConfig; // 日期时间配置
}
```

## 🔒 错误处理

### 常见错误码
- `GET_PRINT_TEMPS_FAILED`: 获取模板列表失败
- `CREATE_PRINT_TEMP_FAILED`: 创建模板失败
- `UPDATE_PRINT_TEMP_FAILED`: 更新模板失败
- `DELETE_PRINT_TEMP_FAILED`: 删除模板失败
- `TEMPLATE_NOT_FOUND`: 模板不存在
- `INVALID_TEMPLATE_DATA`: 模板数据无效
- `MISSING_TEMPLATE_ID`: 缺少模板ID
- `MISSING_PAGE_ROUTE`: 缺少页面路由
- `UPLOAD_IMAGE_FAILED`: 图片上传失败
- `LOG_USAGE_FAILED`: 记录使用统计失败

### 错误响应示例
```json
{
  "success": false,
  "error": {
    "code": "TEMPLATE_NOT_FOUND",
    "message": "模板不存在",
    "details": "ID为 template_001 的模板未找到"
  }
}
```

## 🚀 性能优化

### 分页参数
- 默认每页20条记录
- 最大每页100条记录
- 支持按创建时间、更新时间、名称排序

### 缓存策略
- 模板列表缓存5分钟
- 单个模板缓存10分钟
- 统计数据缓存1小时

### 批量操作
- 支持批量激活/禁用模板
- 支持批量删除模板
- 单次最多操作50个模板

## 📝 使用示例

### 创建产品标签模板
```javascript
const createProductLabel = async () => {
  const response = await fetch('/api/printTemps', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({
      name: '产品标签模板',
      description: '标准产品标签模板',
      category: 'product_label',
      size: { width: 40, height: 30 },
      elements: [
        {
          type: 'text',
          position: { x: 5, y: 5 },
          size: { width: 30, height: 10 },
          dataBinding: {
            type: 'entity',
            entityPath: 'product.name'
          },
          styles: {
            fontFamily: 'Arial',
            fontSize: 12,
            color: '#000000',
            textAlign: 'center'
          },
          zIndex: 1
        }
      ],
      entityType: 'product'
    })
  });
  
  const result = await response.json();
  console.log('创建结果:', result);
};
```

### 获取模板列表
```javascript
const getTemplates = async (entityType = 'product') => {
  const response = await fetch(`/api/printTemps?entityType=${entityType}&page=1&size=20`, {
    headers: {
      'Authorization': 'Bearer ' + token
    }
  });
  
  const result = await response.json();
  return result.data.items;
};
```

### 记录模板使用
```javascript
const logTemplateUsage = async (templateId, pageRoute, printCount = 1) => {
  await fetch(`/api/printTemps/${templateId}/log-usage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({
      page_route: pageRoute,
      print_count: printCount
    })
  });
};
```

---

**文档版本**: v1.0  
**创建日期**: 2024-01-20  
**最后更新**: 2024-01-20  
**维护者**: 后端团队

