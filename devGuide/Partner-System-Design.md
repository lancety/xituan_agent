# 合作伙伴系统设计文档

## 概述

本文档描述了合作伙伴(经销商/分销商)业务功能的完整设计，包括数据库设计、后端API、PDF生成和CMS管理界面。

## 功能特性

### 1. 合作伙伴管理
- 支持三种类型：门店(store)、团购(bulk)、分销商(distributor)
- 多语言名称支持
- 多地址管理
- 灵活的折扣率设置
- 其他联系方式支持(微信、QQ等)

### 2. 发货单管理
- 基于HTML模板的PDF生成
- 自动价格计算
- 产品详情存储
- 扣减计算支持
- 状态跟踪

### 3. 平台设置扩展
- 财务设置(银行信息)
- 运营设置(公司信息、logo等)

## 数据库设计

### 1. 合作伙伴表 (partners)

```sql
CREATE TABLE partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name JSONB NOT NULL,                    -- 多语言名称
    client_code VARCHAR(20) UNIQUE NOT NULL, -- 客户编码 (DL10001, BK10001, DT10001)
    partner_type VARCHAR(20) NOT NULL,      -- 类型: store, bulk, distributor
    discount_rate DECIMAL(5,3) NOT NULL,    -- 折扣率
    abn VARCHAR(20),                        -- ABN/注册号
    phone VARCHAR(20),                      -- 电话
    mobile VARCHAR(20),                     -- 手机
    email VARCHAR(100),                     -- 邮箱
    other_contacts JSONB,                   -- 其他联系方式
    is_active BOOLEAN DEFAULT TRUE,         -- 是否激活
    is_wholesaler BOOLEAN DEFAULT FALSE,    -- 是否批发商
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**索引**:
- `idx_partners_client_code` ON partners(client_code)
- `idx_partners_partner_type` ON partners(partner_type)
- `idx_partners_is_active` ON partners(is_active)

### 2. 合作伙伴地址表 (partner_addresses)

```sql
CREATE TABLE partner_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    contact_name VARCHAR(100) NOT NULL,     -- 联系人姓名
    contact_number VARCHAR(20) NOT NULL,    -- 联系人电话
    street_number VARCHAR(20),
    route VARCHAR(100),
    locality VARCHAR(100),
    administrative_area VARCHAR(100),
    country VARCHAR(100),
    postal_code VARCHAR(20),
    formatted_address VARCHAR(500),
    additional_info VARCHAR(255),
    is_default BOOLEAN DEFAULT FALSE,       -- 是否默认地址
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**索引**:
- `idx_partner_addresses_partner_id` ON partner_addresses(partner_id)
- `idx_partner_addresses_is_default` ON partner_addresses(is_default)
- `idx_partner_addresses_is_deleted` ON partner_addresses(is_deleted)

### 3. 发货单表 (partner_invoices)

```sql
CREATE TABLE partner_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pack_code VARCHAR(20) UNIQUE NOT NULL,  -- 包装代码 (20251002001)
    partner_id UUID NOT NULL REFERENCES partners(id),
    partner_address_id UUID NOT NULL REFERENCES partner_addresses(id),
    issue_date DATE NOT NULL,               -- 开票日期
    due_date DATE,                          -- 到期日期
    total_amount DECIMAL(10,2) NOT NULL,    -- 总金额
    gst_amount DECIMAL(10,2) NOT NULL,      -- GST金额
    discount_rate DECIMAL(5,3) NOT NULL,    -- 折扣率
    discount_amount DECIMAL(10,2) DEFAULT 0, -- 折扣金额
    detail JSONB NOT NULL,                  -- 产品详情
    discount_deduction JSONB,               -- 折扣扣减
    outdated_deduction JSONB,               -- 过期扣减
    discounted_loss DECIMAL(10,2) DEFAULT 0, -- 折扣损失
    outdated_loss DECIMAL(10,2) DEFAULT 0,   -- 过期损失
    total_loss DECIMAL(10,2) DEFAULT 0,     -- 总损失
    total_paid DECIMAL(10,2) DEFAULT 0,     -- 实际收款
    is_email_sent BOOLEAN DEFAULT FALSE,    -- 是否已发送邮件
    is_delivered BOOLEAN DEFAULT FALSE,     -- 是否已配送
    pdf_last_index INTEGER DEFAULT 0,      -- PDF版本索引
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**索引**:
- `idx_partner_invoices_pack_code` ON partner_invoices(pack_code)
- `idx_partner_invoices_partner_id` ON partner_invoices(partner_id)
- `idx_partner_invoices_issue_date` ON partner_invoices(issue_date)
- `idx_partner_invoices_created_at` ON partner_invoices(created_at)

### 4. 产品表更新 (products)

```sql
-- 更新现有产品表，使价格字段可空
ALTER TABLE products 
ALTER COLUMN wholesale_price_20 DROP NOT NULL,
ALTER COLUMN wholesale_price_25 DROP NOT NULL,
ALTER COLUMN wholesale_price_30 DROP NOT NULL,
ALTER COLUMN whole_sale_price DROP NOT NULL;

-- 添加批发价格字段（如果不存在）
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS whole_sale_price DECIMAL(10,2);

-- 更新现有数据
UPDATE products 
SET wholesale_price_20 = NULL, wholesale_price_25 = NULL, wholesale_price_30 = NULL, sale_price = NULL
WHERE wholesale_price_20 IS NOT NULL OR wholesale_price_25 IS NOT NULL OR wholesale_price_30 IS NOT NULL OR sale_price IS NOT NULL;
```

## 业务逻辑设计

### 1. 合作伙伴类型和价格计算

#### 分销商 (distributor)
- 默认 `discount_rate = 0`
- 价格计算：`basePrice * (1 - discount_rate)`

#### 门店/团购 (store/bulk)
- 默认 `discount_rate = 0.2`
- 价格计算：根据 `discount_rate` 选择对应价格
  - `0.2` → `wholesalePrice20`，如果为空则用 `basePrice`
  - `0.25` → `wholesalePrice25`，如果为空则用 `basePrice`
  - `0.3` → `wholesalePrice30`，如果为空则用 `basePrice`

### 2. 发货单创建流程

1. 选择合作伙伴
2. 自动选择默认地址（`is_default = true`）
3. 选择产品并计算价格
4. 生成 `pack_code`（格式：`YYYYMMDD + 3位序号`）
5. 保存发货单数据
6. 生成PDF到S3：`/dealer/delivery_invoice/{pack_code}_{pdfLastIndex}.pdf`

### 3. PDF生成策略

- 使用 `@react-pdf/renderer` 生成PDF
- 每次保存发货单时自动生成新版本PDF
- PDF文件名包含版本索引，便于版本管理
- 支持复杂的样式和布局，复现Google Sheets的视觉效果

## API设计

### 1. 合作伙伴管理API

#### 获取合作伙伴列表
```
GET /api/admin/partners
Query: page, limit, partner_type, search
```

#### 创建合作伙伴
```
POST /api/admin/partners
Body: {
  name: iMultilingualContent,
  partner_type: 'store' | 'bulk' | 'distributor',
  discount_rate: number,
  abn?: string,
  phone?: string,
  mobile?: string,
  email?: string,
  other_contacts?: object
}
```

#### 更新合作伙伴
```
PUT /api/admin/partners/:id
Body: 同创建接口
```

#### 删除合作伙伴
```
DELETE /api/admin/partners/:id
```

### 2. 合作伙伴地址管理API

#### 获取合作伙伴地址列表
```
GET /api/admin/partners/:partnerId/addresses
```

#### 创建地址
```
POST /api/admin/partners/:partnerId/addresses
Body: {
  contact_name: string,
  contact_number: string,
  street_number?: string,
  route?: string,
  locality?: string,
  administrative_area?: string,
  country?: string,
  postal_code?: string,
  formatted_address?: string,
  additional_info?: string,
  is_default?: boolean
}
```

#### 更新地址
```
PUT /api/admin/partners/:partnerId/addresses/:addressId
Body: 同创建接口
```

#### 删除地址
```
DELETE /api/admin/partners/:partnerId/addresses/:addressId
```

### 3. 发货单管理API

#### 获取发货单列表
```
GET /api/admin/partner-invoices
Query: page, limit, partner_id, date_from, date_to, status
```

#### 创建发货单
```
POST /api/admin/partner-invoices
Body: {
  partner_id: string,
  partner_address_id: string,
  issue_date: string,
  due_date?: string,
  discount_rate: number,
  items: Array<{
    product_id: string,
    mode?: string,
    mode_instance_id?: string,
    mode_product_id?: string,
    quantity: number
  }>
}
```

#### 更新发货单
```
PUT /api/admin/partner-invoices/:id
Body: 同创建接口
```

#### 获取发货单详情
```
GET /api/admin/partner-invoices/:id
```

#### 生成PDF
```
POST /api/admin/partner-invoices/:id/generate-pdf
```

#### 更新扣减信息
```
PUT /api/admin/partner-invoices/:id/deductions
Body: {
  discount_deduction: Array<[string, number, number]>, // [product_name, quantity, rate]
  outdated_deduction: Array<[string, number]> // [product_name, quantity]
}
```

## 平台设置扩展

### 1. 财务设置 (finance)

```typescript
interface iFinanceSettings {
  bank: {
    forPartnerInvoice: {
      bankName: string;        // 银行名称
      accountName: string;     // 账户名称
      bsb: string;            // BSB
      accountNumber: string;   // 账户号码
    };
  };
}
```

### 2. 运营设置 (operation)

```typescript
interface iOperationSettings {
  logo: string;              // logo URL (S3路径)
  contactName: string;       // 联系人姓名
  contactNumber: string;     // 联系电话
  contactEmail: string;      // 联系邮箱
  website: string;           // 网站
  businessName: string;      // 公司名称
  businessNumber: string;    // 公司注册号/ABN
}
```

## CMS界面设计

### 1. 合作伙伴管理页面

#### 合作伙伴列表
- 表格显示：名称、类型、客户编码、折扣率、状态、操作
- 筛选：按类型、状态筛选
- 搜索：按名称、客户编码搜索
- 操作：创建、编辑、删除、查看地址

#### 合作伙伴详情/编辑
- 基本信息：多语言名称、类型、折扣率、联系方式
- 地址管理：地址列表、添加/编辑/删除地址
- 其他联系方式：JSON编辑器

### 2. 发货单管理页面

#### 发货单列表
- 表格显示：包装代码、合作伙伴、开票日期、总金额、状态、操作
- 筛选：按合作伙伴、日期范围、状态筛选
- 操作：创建、编辑、查看、生成PDF、更新扣减

#### 发货单详情/编辑
- 基本信息：合作伙伴、地址、日期、折扣率
- 产品列表：选择产品、数量、自动计算价格
- 扣减管理：折扣扣减、过期扣减
- PDF预览：实时预览生成的PDF

### 3. 设置页面扩展

#### 财务设置
- 银行信息编辑表单
- 用于发货单PDF的银行信息显示

#### 运营设置
- 公司信息编辑表单
- Logo上传功能
- 用于发货单PDF的公司信息显示

## 技术实现要点

### 1. PDF生成
- 使用 `@react-pdf/renderer` 生成PDF
- 支持中文字体
- 复现Google Sheets的视觉效果
- 响应式布局适配

### 2. 价格计算
- 根据合作伙伴类型和折扣率动态计算
- 支持产品价格字段为空的情况
- 缓存计算结果提高性能

### 3. 数据验证
- 合作伙伴类型和折扣率的组合验证
- 地址信息的完整性验证
- 发货单数据的业务规则验证

### 4. 权限控制
- 超级管理员：完全权限
- 普通管理员：发货单查看和编辑权限
- 基于角色的访问控制

## 部署和迁移

### 1. 数据库迁移
- 创建新的表结构
- 更新现有产品表字段
- 添加必要的索引

### 2. 数据初始化
- 创建默认的平台设置
- 初始化财务和运营设置

### 3. 文件存储
- 配置S3存储路径
- 设置PDF文件权限

## 性能优化

### 1. 数据库优化
- 合理使用索引
- 分页查询优化
- 查询语句优化

### 2. PDF生成优化
- 异步生成PDF
- 缓存生成的PDF
- 批量生成优化

### 3. 前端优化
- 虚拟滚动处理大量数据
- 懒加载和分页
- 缓存API响应

## 安全考虑

### 1. 数据安全
- 敏感信息加密存储
- 访问日志记录
- 数据备份策略

### 2. 文件安全
- PDF文件访问控制
- 文件上传验证
- 恶意文件检测

### 3. API安全
- 请求频率限制
- 输入验证和清理
- 错误信息脱敏

## 监控和日志

### 1. 业务监控
- 发货单生成量统计
- PDF生成成功率
- 合作伙伴活跃度

### 2. 性能监控
- API响应时间
- PDF生成时间
- 数据库查询性能

### 3. 错误日志
- 详细错误信息记录
- 异常堆栈跟踪
- 用户操作日志

## 未来扩展

### 1. 功能扩展
- 邮件发送功能
- 物流跟踪集成
- 财务报表生成

### 2. 集成扩展
- 第三方支付集成
- 会计系统集成
- 库存管理系统集成

### 3. 移动端支持
- 移动端管理界面
- 移动端PDF查看
- 推送通知功能
