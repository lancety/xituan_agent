# 打印模板系统数据库设计

## 📊 数据库概览

### 数据库名称
`xituan_cms`

### 表前缀
`print_`

### 字符集
`utf8mb4`

### 存储引擎
`InnoDB`

## 🗂️ 表用途概述

### 核心业务表
- **print_temps**: 打印模板主表，存储模板的基本信息、配置数据和元数据
- **print_temp_elements**: 打印模板元素表，存储模板中的具体元素（文本、图片、条形码等）
- **print_temp_usage_logs**: 使用日志表，记录模板的使用情况和统计信息

### 性能优化表
- **print_temp_cache**: 模板缓存表，存储预渲染的HTML和CSS，提升渲染性能

### 表关系
```
print_temps (1) ──→ (N) print_temp_elements
print_temps (1) ──→ (N) print_temp_usage_logs  
print_temps (1) ──→ (1) print_temp_cache
```

## 🗄️ 表结构设计

### 1. print_temps (打印模板主表)

```sql
CREATE TABLE print_temps (
  -- 主键
  id VARCHAR(36) PRIMARY KEY, -- 模板ID
  
  -- 基本信息
  name VARCHAR(255) NOT NULL, -- 模板名称
  description TEXT, -- 模板描述
  category VARCHAR(100) NOT NULL, -- 模板分类
  
  -- 尺寸信息 (单位: mm)
  size_width DECIMAL(8,2) NOT NULL, -- 宽度(mm)
  size_height DECIMAL(8,2) NOT NULL, -- 高度(mm)
  
  -- 模板配置
  template_data JSON NOT NULL, -- 模板配置数据
  
  -- 实体依赖
  entity_type VARCHAR(50) NOT NULL, -- 实体类型
  required_fields JSON, -- 必需字段路径数组
  optional_fields JSON, -- 可选字段路径数组
  
  -- 版本控制
  version INT DEFAULT 1, -- 版本号
  
  -- 状态控制
  is_active BOOLEAN DEFAULT true, -- 是否启用
  
  -- 审计字段
  created_by VARCHAR(36), -- 创建者ID
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 创建时间
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- 更新时间
);

-- 添加表注释
COMMENT ON TABLE print_temps IS '打印模板主表';
COMMENT ON COLUMN print_temps.id IS '模板ID';
COMMENT ON COLUMN print_temps.name IS '模板名称';
COMMENT ON COLUMN print_temps.description IS '模板描述';
COMMENT ON COLUMN print_temps.category IS '模板分类';
COMMENT ON COLUMN print_temps.size_width IS '宽度(mm)';
COMMENT ON COLUMN print_temps.size_height IS '高度(mm)';
COMMENT ON COLUMN print_temps.template_data IS '模板配置数据';
COMMENT ON COLUMN print_temps.entity_type IS '实体类型';
COMMENT ON COLUMN print_temps.required_fields IS '必需字段路径数组';
COMMENT ON COLUMN print_temps.optional_fields IS '可选字段路径数组';
COMMENT ON COLUMN print_temps.version IS '版本号';
COMMENT ON COLUMN print_temps.is_active IS '是否启用';
COMMENT ON COLUMN print_temps.created_by IS '创建者ID';
COMMENT ON COLUMN print_temps.created_at IS '创建时间';
COMMENT ON COLUMN print_temps.updated_at IS '更新时间';

-- 创建索引
CREATE INDEX idx_entity_type ON print_temps(entity_type);
CREATE INDEX idx_category ON print_temps(category);
CREATE INDEX idx_is_active ON print_temps(is_active);
CREATE INDEX idx_created_by ON print_temps(created_by);
CREATE INDEX idx_created_at ON print_temps(created_at);
CREATE INDEX idx_updated_at ON print_temps(updated_at);
```

### 2. print_temp_elements (打印模板元素表)

```sql
CREATE TABLE print_temp_elements (
  -- 主键
  id VARCHAR(36) PRIMARY KEY, -- 元素ID
  template_id VARCHAR(36) NOT NULL, -- 模板ID
  
  -- 元素基本信息
  element_type VARCHAR(20) NOT NULL, -- 元素类型
  name VARCHAR(255), -- 元素名称
  
  -- 位置和尺寸 (单位: mm)
  position_x DECIMAL(8,2) NOT NULL DEFAULT 0, -- X坐标(mm)
  position_y DECIMAL(8,2) NOT NULL DEFAULT 0, -- Y坐标(mm)
  width DECIMAL(8,2) NOT NULL, -- 宽度(mm)
  height DECIMAL(8,2) NOT NULL, -- 高度(mm)
  
  -- 层级
  z_index INT DEFAULT 0, -- 层级顺序
  
  -- 数据绑定配置
  data_binding JSON, -- 数据绑定配置
  
  -- 样式配置
  styles JSON, -- 样式配置
  
  -- 审计字段
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 创建时间
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- 更新时间
);

-- 添加表注释
COMMENT ON TABLE print_temp_elements IS '打印模板元素表';
COMMENT ON COLUMN print_temp_elements.id IS '元素ID';
COMMENT ON COLUMN print_temp_elements.template_id IS '模板ID';
COMMENT ON COLUMN print_temp_elements.element_type IS '元素类型';
COMMENT ON COLUMN print_temp_elements.name IS '元素名称';
COMMENT ON COLUMN print_temp_elements.position_x IS 'X坐标(mm)';
COMMENT ON COLUMN print_temp_elements.position_y IS 'Y坐标(mm)';
COMMENT ON COLUMN print_temp_elements.width IS '宽度(mm)';
COMMENT ON COLUMN print_temp_elements.height IS '高度(mm)';
COMMENT ON COLUMN print_temp_elements.z_index IS '层级顺序';
COMMENT ON COLUMN print_temp_elements.data_binding IS '数据绑定配置';
COMMENT ON COLUMN print_temp_elements.styles IS '样式配置';
COMMENT ON COLUMN print_temp_elements.created_at IS '创建时间';
COMMENT ON COLUMN print_temp_elements.updated_at IS '更新时间';

-- 外键约束
ALTER TABLE print_temp_elements ADD CONSTRAINT fk_print_temp_elements_template_id 
  FOREIGN KEY (template_id) REFERENCES print_temps(id) ON DELETE CASCADE;

-- 唯一性约束
ALTER TABLE print_temp_elements ADD CONSTRAINT uk_template_element_name 
  UNIQUE (template_id, name);

-- 创建索引
CREATE INDEX idx_print_temp_elements_template_id ON print_temp_elements(template_id);
CREATE INDEX idx_element_type ON print_temp_elements(element_type);
CREATE INDEX idx_z_index ON print_temp_elements(z_index);
CREATE INDEX idx_print_temp_elements_template_name ON print_temp_elements(template_id, name);
```

### 3. print_temp_usage_logs (打印模板使用日志表)

```sql
CREATE TABLE print_temp_usage_logs (
  -- 主键
  id VARCHAR(36) PRIMARY KEY, -- 日志ID
  template_id VARCHAR(36) NOT NULL, -- 模板ID
  
  -- 使用信息
  page_route VARCHAR(255) NOT NULL, -- 使用页面路由
  user_id VARCHAR(36), -- 用户ID
  print_count INT DEFAULT 1, -- 打印数量
  
  -- 使用时间
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- 使用时间
);

-- 添加表注释
COMMENT ON TABLE print_temp_usage_logs IS '打印模板使用日志表';
COMMENT ON COLUMN print_temp_usage_logs.id IS '日志ID';
COMMENT ON COLUMN print_temp_usage_logs.template_id IS '模板ID';
COMMENT ON COLUMN print_temp_usage_logs.page_route IS '使用页面路由';
COMMENT ON COLUMN print_temp_usage_logs.user_id IS '用户ID';
COMMENT ON COLUMN print_temp_usage_logs.print_count IS '打印数量';
COMMENT ON COLUMN print_temp_usage_logs.used_at IS '使用时间';

-- 外键约束
ALTER TABLE print_temp_usage_logs ADD CONSTRAINT fk_print_temp_usage_logs_template_id 
  FOREIGN KEY (template_id) REFERENCES print_temps(id) ON DELETE CASCADE;

-- 创建索引
CREATE INDEX idx_print_temp_usage_logs_template_id ON print_temp_usage_logs(template_id);
CREATE INDEX idx_page_route ON print_temp_usage_logs(page_route);
CREATE INDEX idx_user_id ON print_temp_usage_logs(user_id);
CREATE INDEX idx_used_at ON print_temp_usage_logs(used_at);
```

### 4. print_temp_cache (打印模板缓存表)

```sql
CREATE TABLE print_temp_cache (
  template_id VARCHAR(36) PRIMARY KEY, -- 模板ID
  rendered_css TEXT, -- 渲染的CSS
  rendered_html TEXT, -- 渲染的HTML
  cache_version INT DEFAULT 1, -- 缓存版本
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 创建时间
  expires_at TIMESTAMP -- 过期时间
);

-- 添加表注释
COMMENT ON TABLE print_temp_cache IS '打印模板缓存表';
COMMENT ON COLUMN print_temp_cache.template_id IS '模板ID';
COMMENT ON COLUMN print_temp_cache.rendered_css IS '渲染的CSS';
COMMENT ON COLUMN print_temp_cache.rendered_html IS '渲染的HTML';
COMMENT ON COLUMN print_temp_cache.cache_version IS '缓存版本';
COMMENT ON COLUMN print_temp_cache.created_at IS '创建时间';
COMMENT ON COLUMN print_temp_cache.expires_at IS '过期时间';

-- 外键约束
ALTER TABLE print_temp_cache ADD CONSTRAINT fk_print_temp_cache_template_id 
  FOREIGN KEY (template_id) REFERENCES print_temps(id) ON DELETE CASCADE;

-- 创建索引
CREATE INDEX idx_expires_at ON print_temp_cache(expires_at);
```

## 📋 枚举值定义

### 1. 实体类型 (entity_type)
```sql
-- 实体类型枚举
-- 'product'     - 产品
-- 'invoice'     - 发票
-- 'customer'    - 客户
-- 'partner'     - 合作伙伴
```

### 2. 模板分类 (category)
```sql
-- 模板分类枚举
-- 'product_label'   - 产品标签
-- 'invoice_label'   - 发票标签
-- 'barcode_label'   - 条形码标签
-- 'shipping_label'  - 运输标签
-- 'custom_label'    - 自定义标签
```

### 3. 元素类型 (element_type)
```sql
-- 元素类型枚举
-- 'text'    - 文本
-- 'image'   - 图片
-- 'barcode' - 条形码
-- 'shape'   - 形状
```

## 🔧 JSON字段结构

### 1. template_data 字段结构
```json
{
  "elements": [
    {
      "id": "element_001",
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
      },
      "zIndex": 1
    }
  ],
  "settings": {
    "gridEnabled": true,
    "snapToGrid": true,
    "gridSize": 1
  }
}
```

### 2. required_fields 字段结构
```json
[
  "name",
  "metadata.barCode",
  "basePrice"
]
```

### 3. optional_fields 字段结构
```json
[
  "storageType",
  "metadata.ingredient",
  "salePrice"
]
```

### 4. data_binding 字段结构
```json
{
  "type": "entity",
  "entityPath": "product.name",
  "multilingual": {
    "enabled": true,
    "fallbackLanguage": "zh_cn"
  }
}
```

### 5. styles 字段结构
```json
{
  "fontFamily": "Arial",
  "fontSize": 12,
  "fontWeight": "bold",
  "fontStyle": "normal",
  "textAlign": "center",
  "verticalAlign": "middle",
  "lineHeight": 1.2,
  "letterSpacing": 0,
  "wordSpacing": 0,
  "textIndent": 0,
  "color": "#000000",
  "backgroundColor": "#ffffff",
  "textDecoration": "none",
  "textShadow": "none",
  "padding": {
    "top": 2,
    "right": 2,
    "bottom": 2,
    "left": 2
  },
  "margin": {
    "top": 0,
    "right": 0,
    "bottom": 0,
    "left": 0
  }
}
```

## 📊 索引策略

### 1. 主键索引
- `PRIMARY KEY (id)` - 所有表的主键

### 2. 外键索引
- `INDEX idx_template_id (template_id)` - 元素表关联模板表

### 3. 查询索引
- `INDEX idx_entity_type (entity_type)` - 按实体类型查询
- `INDEX idx_category (category)` - 按分类查询
- `INDEX idx_is_active (is_active)` - 按状态查询
- `INDEX idx_created_by (created_by)` - 按创建者查询

### 4. 时间索引
- `INDEX idx_created_at (created_at)` - 按创建时间查询
- `INDEX idx_updated_at (updated_at)` - 按更新时间查询
- `INDEX idx_used_at (used_at)` - 按使用时间查询

### 5. 复合索引
```sql
-- 常用查询组合
CREATE INDEX idx_template_query ON print_temps(entity_type, category, is_active);
CREATE INDEX idx_element_query ON print_temp_elements(template_id, element_type, z_index);
CREATE INDEX idx_usage_query ON print_temp_usage_logs(template_id, used_at);
```

## 🔒 约束和规则

### 1. 主键约束
- 所有表使用UUID作为主键
- 主键不可为空且唯一

### 2. 外键约束
- `print_temp_elements.template_id` → `print_temps.id`
- `print_temp_usage_logs.template_id` → `print_temps.id`
- `print_temp_cache.template_id` → `print_temps.id`
- 使用CASCADE删除，确保数据一致性

### 3. 非空约束
- `print_temps.name` - 模板名称必填
- `print_temps.category` - 模板分类必填
- `print_temps.entity_type` - 实体类型必填
- `print_temps.size_width` - 宽度必填
- `print_temps.size_height` - 高度必填
- `print_temp_elements.template_id` - 模板ID必填
- `print_temp_elements.element_type` - 元素类型必填

### 4. 默认值
- `version` 默认为 1
- `is_active` 默认为 true
- `z_index` 默认为 0
- `print_count` 默认为 1
- `cache_version` 默认为 1
- 时间字段使用 `CURRENT_TIMESTAMP`

### 5. 数据验证规则
```sql
-- 尺寸验证
ALTER TABLE print_temps ADD CONSTRAINT chk_size_width CHECK (size_width > 0 AND size_width <= 1000);
ALTER TABLE print_temps ADD CONSTRAINT chk_size_height CHECK (size_height > 0 AND size_height <= 1000);

-- 版本验证
ALTER TABLE print_temps ADD CONSTRAINT chk_version CHECK (version > 0);

-- 元素尺寸验证
ALTER TABLE print_temp_elements ADD CONSTRAINT chk_element_width CHECK (width > 0 AND width <= 1000);
ALTER TABLE print_temp_elements ADD CONSTRAINT chk_element_height CHECK (height > 0 AND height <= 1000);

-- 打印数量验证
ALTER TABLE print_temp_usage_logs ADD CONSTRAINT chk_print_count CHECK (print_count > 0);
```

### 6. 触发器
```sql
-- 创建触发器函数用于自动更新 updated_at 字段
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为相关表添加触发器
CREATE TRIGGER update_print_temps_updated_at 
  BEFORE UPDATE ON print_temps 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_print_temp_elements_updated_at 
  BEFORE UPDATE ON print_temp_elements 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## 📈 性能优化

### 1. 分区策略
```sql
-- 按时间分区使用日志表
ALTER TABLE print_temp_usage_logs 
PARTITION BY RANGE (YEAR(used_at)) (
  PARTITION p2024 VALUES LESS THAN (2025),
  PARTITION p2025 VALUES LESS THAN (2026),
  PARTITION p2026 VALUES LESS THAN (2027),
  PARTITION p_future VALUES LESS THAN MAXVALUE
);
```

### 2. 查询优化
```sql
-- 常用查询视图
CREATE VIEW v_active_templates AS
SELECT 
  pt.id,
  pt.name,
  pt.category,
  pt.entity_type,
  pt.size_width,
  pt.size_height,
  pt.version,
  pt.created_at,
  pt.updated_at,
  COUNT(pte.id) as element_count
FROM print_temps pt
LEFT JOIN print_temp_elements pte ON pt.id = pte.template_id
WHERE pt.is_active = true
GROUP BY pt.id;

-- 模板使用统计视图
CREATE VIEW v_template_usage_stats AS
SELECT 
  pt.id,
  pt.name,
  pt.category,
  COUNT(ptul.id) as usage_count,
  SUM(ptul.print_count) as total_prints,
  MAX(ptul.used_at) as last_used
FROM print_temps pt
LEFT JOIN print_temp_usage_logs ptul ON pt.id = ptul.template_id
GROUP BY pt.id;
```

### 3. 缓存策略
```sql
-- 创建缓存表
CREATE TABLE print_temp_cache (
  template_id VARCHAR(36) PRIMARY KEY,
  rendered_css TEXT,
  rendered_html TEXT,
  cache_version INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  
  FOREIGN KEY (template_id) REFERENCES print_temps(id) ON DELETE CASCADE,
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='打印模板缓存表';
```

## 🔄 数据迁移

### 1. 初始数据
```sql
-- 插入默认分类数据
INSERT INTO print_temps (id, name, description, category, size_width, size_height, template_data, entity_type, required_fields, optional_fields, created_by) VALUES
('default_product_label', '默认产品标签', '系统默认产品标签模板', 'product_label', 40, 30, '{}', 'product', '["name", "metadata.barCode"]', '["storageType", "metadata.ingredient"]', 'system'),
('default_invoice_label', '默认发票标签', '系统默认发票标签模板', 'invoice_label', 50, 30, '{}', 'invoice', '["invoiceNumber", "totalAmount"]', '["notes"]', 'system');
```

### 2. 版本升级脚本
```sql
-- 版本升级示例
-- 从v1.0升级到v1.1
ALTER TABLE print_temps ADD COLUMN template_version VARCHAR(20) DEFAULT '1.0' AFTER version;
UPDATE print_temps SET template_version = '1.0' WHERE template_version IS NULL;

-- 从v1.1升级到v1.2
ALTER TABLE print_temps ADD COLUMN tags JSON AFTER category;
```

## 📊 监控和统计

### 1. 性能监控查询
```sql
-- 模板使用频率统计
SELECT 
  pt.name,
  pt.category,
  COUNT(ptul.id) as usage_count,
  AVG(ptul.print_count) as avg_print_count
FROM print_temps pt
LEFT JOIN print_temp_usage_logs ptul ON pt.id = ptul.template_id
WHERE ptul.used_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY pt.id
ORDER BY usage_count DESC;

-- 元素类型使用统计
SELECT 
  element_type,
  COUNT(*) as count,
  AVG(width) as avg_width,
  AVG(height) as avg_height
FROM print_temp_elements
GROUP BY element_type;

-- 模板大小分布
SELECT 
  CASE 
    WHEN size_width * size_height <= 1200 THEN '小尺寸'
    WHEN size_width * size_height <= 2400 THEN '中尺寸'
    ELSE '大尺寸'
  END as size_category,
  COUNT(*) as count
FROM print_temps
GROUP BY size_category;
```

### 2. 数据清理脚本
```sql
-- 清理过期使用日志（保留1年）
DELETE FROM print_temp_usage_logs 
WHERE used_at < DATE_SUB(NOW(), INTERVAL 1 YEAR);

-- 清理过期缓存
DELETE FROM print_temp_cache 
WHERE expires_at < NOW();
```

## 🔧 维护脚本

### 1. 数据备份
```bash
#!/bin/bash
# 备份打印模板相关表
mysqldump -u username -p xituan_cms \
  print_temps \
  print_temp_elements \
  print_temp_usage_logs \
  print_temp_cache > print_temps_backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. 数据恢复
```bash
#!/bin/bash
# 恢复打印模板数据
mysql -u username -p xituan_cms < print_temps_backup_20240120_120000.sql
```

### 3. 性能检查
```sql
-- 检查表大小
SELECT 
  table_name,
  ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size (MB)'
FROM information_schema.tables
WHERE table_schema = 'xituan_cms'
  AND table_name LIKE 'print_%'
ORDER BY (data_length + index_length) DESC;

-- 检查索引使用情况
SELECT 
  table_name,
  index_name,
  cardinality,
  sub_part,
  packed,
  nullable,
  index_type
FROM information_schema.statistics
WHERE table_schema = 'xituan_cms'
  AND table_name LIKE 'print_%'
ORDER BY table_name, seq_in_index;
```

---

**文档版本**: v1.0  
**创建日期**: 2024-01-20  
**最后更新**: 2024-01-20  
**维护者**: 数据库团队


