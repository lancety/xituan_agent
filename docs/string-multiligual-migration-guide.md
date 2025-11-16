# 后端Entity字段从String改为iMultilingualContent迁移指南

## 概述

本文档详细说明了将后端entity字段从string类型改为iMultilingualContent多语言类型时需要更新调整的所有文件和步骤。基于产品选项(product options)和选项组(product option groups)的name字段多语言化实现经验总结。

## 完整更新清单

### 1. 数据库层面
- [ ] **创建SQL迁移文件** (`migrations/`)
  - 将字段类型从 `VARCHAR` 改为 `JSONB`
  - 添加GIN索引优化查询性能
  - 迁移现有数据到多语言格式
  - 添加字段注释说明

**示例迁移文件结构：**
```sql
-- 迁移: 更新XXX表支持多语言
-- 时间: YYYY-MM-DD
-- 描述: 将XXX表的name字段改为jsonb类型，支持多语言

-- 1. 备份现有数据
CREATE TEMP TABLE xxx_backup AS SELECT * FROM xxx;

-- 2. 更新表结构
ALTER TABLE xxx ADD COLUMN IF NOT EXISTS name_temp JSONB;

-- 3. 迁移现有数据到新的多语言格式
UPDATE xxx
SET name_temp = jsonb_build_object(
  'intl', true,
  'en', name,
  'zh_cn', name,
  'zh', name
);

-- 4. 删除旧的name字段，重命名新字段
ALTER TABLE xxx DROP COLUMN name;
ALTER TABLE xxx RENAME COLUMN name_temp TO name;

-- 5. 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_xxx_name ON xxx USING GIN (name);

-- 6. 添加注释说明字段用途
COMMENT ON COLUMN xxx.name IS '名称（多语言JSONB格式，包含intl标识）';
```

### 2. 类型定义层面
- [ ] **更新Entity接口** (`submodules/xituan_codebase/typing_entity/`)
  - 将字段类型从 `string` 改为 `iMultilingualContent`
  - 确保导入 `iMultilingualContent` 类型

**示例：**
```typescript
// 更新前
export interface iXxx {
  id: string;
  name: string;
  // ...
}

// 更新后
import { iMultilingualContent } from '../utils/multilingual.type';

export interface iXxx {
  id: string;
  name: iMultilingualContent;
  // ...
}
```

- [ ] **更新API类型定义** (`submodules/xituan_codebase/typing_api/`)
  - 更新相关API请求/响应接口
  - 添加新的专用API请求类型

**示例：**
```typescript
export interface iCreateXxxRequest {
  name: iMultilingualContent;
  // 其他字段...
}

export interface iUpdateXxxRequest {
  name?: iMultilingualContent;
  // 其他字段...
}
```

### 3. 实体类层面
- [ ] **更新TypeORM实体类** (`src/domains/xxx/domain/`)
  - 将 `@Column({ type: 'varchar' })` 改为 `@Column({ type: 'jsonb' })`
  - 字段类型改为 `any` 或 `iMultilingualContent`

**示例：**
```typescript
@Entity('xxx')
export class Xxx {
  // 更新前
  @Column({ type: 'varchar', nullable: false })
  name!: string;

  // 更新后
  @Column({ type: 'jsonb', nullable: false })
  name!: any; // iMultilingualContent type
}
```

### 4. 字段类型分类层面
- [ ] **更新字段类型分类** (`submodules/xituan_codebase/typing_entity/xxx.type.ts`)
  - 将字段从 `xxxString` 移动到 `xxxObj`
  - 确保字段类型分类正确

**示例：**
```typescript
// 更新前
export const xxxString = new Set([
  'id', 'name', 'description'
]);

// 更新后
export const xxxString = new Set([
  'id', 'description'
]);

export const xxxObj = new Set([
  'name'
]);
```

### 5. 控制器层面
- [ ] **更新控制器** (`src/domains/xxx/controllers/`)
  - 添加FormData处理函数（使用 `fieldProcessorUtil`）
  - 更新API方法使用FormData处理
  - 移除字符串验证逻辑（如 `.trim()` 检查）
  - 导入新的字段类型分类

**示例：**
```typescript
import { fieldProcessorUtil } from '../../../../submodules/xituan_codebase/utils/form.fieldProcessor.util';
import { xxxObj, xxxString, xxxNum, xxxBool } from '../../../../submodules/xituan_codebase/typing_entity/xxx.type';

// 添加FormData处理函数
const processXxxFormData = (body: any) => {
  return fieldProcessorUtil.processFormDataFields(
    body,
    xxxString,  // stringSet
    xxxNum,     // numSet
    xxxBool,    // boolSet
    undefined,  // dateSet
    xxxObj      // objSet
  );
};

// 更新API方法
createXxx = async (req: Request, res: Response): Promise<void> => {
  try {
    const processedData = processXxxFormData(req.body);
    const { name, ...otherFields } = processedData;
    
    // 移除字符串验证
    if (!name) {
      res.status(400).json({ success: false, message: '名称不能为空' });
      return;
    }
    
    // 使用处理后的数据
    const result = await this.xxxService.createXxx({ name, ...otherFields });
    // ...
  } catch (error) {
    // ...
  }
};
```

### 6. 服务层层面
- [ ] **更新服务层** (`src/domains/xxx/services/`)
  - 更新方法签名使用新的API类型
  - 更新验证逻辑适配多语言对象
  - 导入 `iMultilingualContent` 类型

**示例：**
```typescript
import { iMultilingualContent } from '../../../../submodules/xituan_codebase/utils/multilingual.type';
import { iCreateXxxRequest, iUpdateXxxRequest } from '../../../../submodules/xituan_codebase/typing_api/xxx.type';

export class XxxService {
  async createXxx(data: iCreateXxxRequest): Promise<Xxx> {
    // 验证多语言对象
    if (!data.name) {
      throw new Error('名称不能为空');
    }
    
    return this.xxxRepository.createXxx(data);
  }

  async updateXxx(id: string, data: iUpdateXxxRequest): Promise<Xxx | null> {
    return this.xxxRepository.updateXxx(id, data);
  }
}
```

### 7. 仓储层层面
- [ ] **更新仓储层** (`src/domains/xxx/infrastructure/`)
  - 添加多语言工具导入
  - 更新方法签名使用新的API类型
  - 添加多语言键提取辅助方法
  - 更新业务逻辑中的字符串比较为多语言对象比较
  - 在TypeORM `update` 方法中使用 `as any` 类型断言

**示例：**
```typescript
import { multilingualUtil } from '../../../../submodules/xituan_codebase/utils/multilingual.util';
import { iMultilingualContent } from '../../../../submodules/xituan_codebase/utils/multilingual.type';

export class XxxRepository {
  // 添加多语言键提取方法
  private getMultilingualKey(content: any): string {
    if (multilingualUtil.isMultilingual(content)) {
      return multilingualUtil.getLocalizedText(content, 'en', ['zh_cn', 'zh']) ||
             Object.values(content).find(v => typeof v === 'string' && v !== 'true') as string || '';
    }
    return typeof content === 'string' ? content : '';
  }

  async updateXxx(id: string, data: iUpdateXxxRequest): Promise<Xxx | null> {
    // 使用类型断言绕过TypeORM的严格类型检查
    await this.xxxRepository.update(id, data as any);
    return this.findXxxById(id);
  }

  async findXxxByName(name: iMultilingualContent): Promise<Xxx | null> {
    const nameKey = this.getMultilingualKey(name);
    // 使用多语言键进行查询
    // ...
  }
}
```

### 8. 业务逻辑层面
- [ ] **更新相关业务逻辑**
  - 搜索功能：更新数据库查询条件
  - 排序功能：更新排序字段引用
  - 验证逻辑：更新字段验证
  - 错误处理：使用 `multilingualUtil.getLocalizedText()` 获取显示文本

**示例：**
```typescript
// 搜索功能更新
private buildSearchCondition(keyword: string): string {
  return `jsonb_path_exists(xxx.name, '$.* ? (@ like_regex "${keyword}" flag "i")')`;
}

// 排序功能更新
queryBuilder.orderBy('xxx.name->>\'zh\'', 'ASC');

// 错误处理更新
const nameText = multilingualUtil.getLocalizedText(xxx.name, 'zh_cn', ['en', 'zh']);
errors.push(`名称错误: ${nameText}`);
```

### 9. 关联实体层面
- [ ] **更新关联实体的使用**
  - 购物车/订单中的相关字段
  - 其他引用该字段的地方
  - 错误消息中的字段引用

**示例：**
```typescript
// 更新iSelectedOption接口
export interface iSelectedOption {
  groupId: string;
  groupName: iMultilingualContent;  // 从string改为iMultilingualContent
  optionId: string;
  optionName: iMultilingualContent; // 从string改为iMultilingualContent
  extraPrice: number;
}

// 更新错误处理
const optionNameText = multilingualUtil.getLocalizedText(selectedOption.optionName, 'zh_cn', ['en', 'zh']);
errors.push(`产品选项不存在: ${optionNameText}`);
```

### 10. 工具函数层面
- [ ] **添加必要的工具函数**
  - 导入 `multilingualUtil`
  - 添加多语言文本提取方法
  - 更新字符串处理逻辑

## 具体文件示例

```
📁 数据库迁移
├── migrations/XXXXXX_update_xxx_multilingual.sql

📁 类型定义
├── submodules/xituan_codebase/typing_entity/xxx.type.ts
├── submodules/xituan_codebase/typing_api/xxx.type.ts

📁 实体类
├── src/domains/xxx/domain/xxx.entity.ts

📁 控制器
├── src/domains/xxx/controllers/xxx.controller.ts

📁 服务层
├── src/domains/xxx/services/xxx.service.ts

📁 仓储层
├── src/domains/xxx/infrastructure/xxx.repository.ts

📁 业务逻辑
├── src/domains/order/services/order.service.ts
├── src/domains/order/services/cart.service.ts
├── src/utils/xxx-validation.util.ts
```

## 关键注意事项

### 1. 类型安全
- 确保所有类型定义都正确使用 `iMultilingualContent`
- 在TypeORM实体中使用 `any` 类型，在接口中使用 `iMultilingualContent`
- 使用 `as any` 类型断言绕过TypeORM的严格类型检查

### 2. 向后兼容
- 考虑现有数据的迁移和兼容性
- 确保迁移脚本能够正确处理现有数据
- 添加数据完整性验证

### 3. 性能优化
- 为JSONB字段添加GIN索引
- 使用合适的查询条件优化搜索性能
- 考虑缓存策略

### 4. 错误处理
- 更新所有错误消息使用多语言工具
- 确保错误消息的可读性和多语言支持
- 使用 `multilingualUtil.getLocalizedText()` 获取显示文本

### 5. 测试覆盖
- 确保所有相关功能都经过测试
- 测试多语言数据的创建、更新、查询
- 测试错误处理的多语言支持

## 实施步骤建议

1. **准备阶段**：创建SQL迁移文件，备份现有数据
2. **类型定义**：更新所有相关的类型定义
3. **实体类**：更新TypeORM实体类
4. **字段分类**：更新字段类型分类
5. **控制器**：添加FormData处理，更新API方法
6. **服务层**：更新方法签名和验证逻辑
7. **仓储层**：添加多语言工具，更新业务逻辑
8. **业务逻辑**：更新搜索、排序、验证等功能
9. **关联实体**：更新所有引用该字段的地方
10. **测试验证**：全面测试所有相关功能

## 参考实现

本指南基于以下实际实现经验：
- 产品选项组(product_option_groups)的name字段多语言化
- 产品选项(product_options)的name字段多语言化
- 购物车和订单系统中的多语言支持

具体实现细节可以参考：
- `migrations/1710000000052_update_product_options_multilingual.sql`
- `src/domains/product/controllers/product.controller.ts`
- `src/domains/product/services/product.service.ts`
- `src/domains/product/infrastructure/product.repository.ts`
