# 多租户平台改造实施指南

## 📋 概述

本文档描述将现有单用户系统改造成多商户平台的完整实施方案。包括架构选择、数据库设计、代码改造和实施步骤。

---

## 🎯 核心决策

### 推荐方案：Tenant ID + 分区表

基于以下考虑：
- **维护复杂性**（最敏感）：优先选择维护简单的方案
- **数据库性能**（第二敏感）：通过分区优化性能

**详细分析请参考**：[多租户架构方案分析](../../docs/multi-tenant/multi-tenant-architecture-analysis.md)

---

## 🏗️ 架构设计

### 核心设计原则

1. **业务表添加 `merchant_id` 字段**（系统级表除外）
2. **通过 WHERE 条件过滤商户数据**
3. **对大数据量表进行分区**（超过 500 万行时）
4. **使用中间件强制过滤**（防止数据泄露）
5. **系统级表使用独立的 Repository**（不添加 merchant_id 过滤）

> **注意**：系统级表（如 `merchants`、`platform_settings`）不需要 `merchant_id` 字段。详细处理方案请参考：[数据库优化指南](./database-optimization-guide.md#第四部分系统级表处理方案)

### 数据库设计

#### 商户管理表

```sql
-- 商户表
CREATE TABLE merchants (
    id UUID PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,  -- 商户编码
    name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### 业务表改造

所有业务表需要添加 `merchant_id` 字段：

```sql
-- 示例：产品表
ALTER TABLE products ADD COLUMN merchant_id UUID NOT NULL;
ALTER TABLE products ADD CONSTRAINT fk_products_merchant 
    FOREIGN KEY (merchant_id) REFERENCES merchants(id);

-- 创建索引
CREATE INDEX idx_products_merchant_id ON products(merchant_id);
CREATE INDEX idx_products_merchant_code ON products(merchant_id, code);
```

**详细数据库设计方案请参考**：[多商户平台数据库设计方案](../../docs/multi-tenant/multi-tenant-database-design.md)

---

## 📊 表分区策略

### 分区方案

对于大数据量表（如 `orders`），采用以下分区策略：

1. **主表**：按 `merchant_id` 哈希分区（50 个分区）
2. **归档表**：按时间范围分区（按月分区，可无限扩展）

**详细分区策略请参考**：[数据库优化指南](./database-optimization-guide.md#第二部分分区策略总结)

### 分区实施

#### 何时需要分区？

- **表大小 < 100 万行**：不需要分区
- **表大小 100-500 万行**：监控，优化索引
- **表大小 500-1000 万行**：考虑分区
- **表大小 > 1000 万行**：强烈建议分区

**详细分区说明请参考**：[数据库优化指南](./database-optimization-guide.md#第一部分表分区详解)

#### 分区查询

PostgreSQL 分区对应用层是透明的，SQL 查询没有区别。

**详细查询说明请参考**：[数据库优化指南](./database-optimization-guide.md#第三部分分区查询性能优化)

---

## 🔧 技术实现

### 1. 商户识别中间件

```typescript
// merchant.middleware.ts
import { Request, Response, NextFunction } from 'express';

export interface MerchantRequest extends Request {
  merchantId?: string;
  merchantCode?: string;
}

export const merchantMiddleware = async (
  req: MerchantRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // 从多种方式识别商户
  // 1. 子域名: merchant001.xituan.com.au
  // 2. 路径: /api/merchant/merchant001/...
  // 3. Header: X-Merchant-Code
  // 4. JWT Token 中的 merchant_id

  const merchantCode = 
    req.headers['x-merchant-code'] as string ||
    req.subdomains[0] ||
    extractFromPath(req.path);

  if (!merchantCode) {
    res.status(400).json({ error: 'Merchant code required' });
    return;
  }

  // 查询商户信息
  const merchant = await merchantRepo.findOne({ 
    where: { code: merchantCode, status: 'ACTIVE' } 
  });

  if (!merchant) {
    res.status(403).json({ error: 'Merchant not found or inactive' });
    return;
  }

  // 附加到请求对象
  req.merchantId = merchant.id;
  req.merchantCode = merchant.code;

  next();
};
```

### 2. Repository 架构设计

#### 2.1 商户级 Repository（有 merchant_id 的表）

```typescript
// repositories/merchant.repository.ts
import { Repository } from 'typeorm';

/**
 * 商户级 Repository
 * 用于有 merchant_id 字段的业务表
 */
export class MerchantRepository<T> {
  constructor(
    private repository: Repository<T>,
    private merchantId: string  // 必须提供
  ) {
    if (!merchantId) {
      throw new Error('MerchantRepository requires merchantId');
    }
  }

  async findOne(id: string): Promise<T | null> {
    return this.repository.findOne({ 
      where: { id, merchantId: this.merchantId } as any 
    });
  }

  createQueryBuilder(alias: string) {
    const qb = this.repository.createQueryBuilder(alias);
    qb.where(`${alias}.merchantId = :merchantId`, { 
      merchantId: this.merchantId 
    });
    return qb;
  }

  async find(options?: any): Promise<T[]> {
    return this.repository.find({
      ...options,
      where: {
        ...options?.where,
        merchantId: this.merchantId
      }
    });
  }
}
```

#### 2.2 系统级 Repository（没有 merchant_id 的表）

```typescript
// repositories/system.repository.ts
import { Repository } from 'typeorm';

/**
 * 系统级 Repository
 * 用于没有 merchant_id 字段的系统表
 * 例如：merchants, platform_settings 等
 */
export class SystemRepository<T> {
  constructor(private repository: Repository<T>) {}

  async findOne(id: string | number, where?: any): Promise<T | null> {
    const whereClause = where || { id };
    return this.repository.findOne({ where: whereClause as any });
  }

  createQueryBuilder(alias: string) {
    // 不添加 merchant_id 过滤
    return this.repository.createQueryBuilder(alias);
  }

  async find(options?: any): Promise<T[]> {
    return this.repository.find(options);
  }

  async save(entity: T): Promise<T> {
    return this.repository.save(entity);
  }

  async delete(id: string | number): Promise<void> {
    await this.repository.delete(id);
  }
}
```

> **重要**：系统级表处理方案请参考：[数据库优化指南](./database-optimization-guide.md#第四部分系统级表处理方案)

### 3. Service 层改造

#### 3.1 商户级 Service（使用 MerchantRepository）

```typescript
// product.service.ts
import { MerchantRepository } from '../repositories/merchant.repository';
import { Product } from '../entities/product.entity';

export class ProductService {
  private productRepo: MerchantRepository<Product>;

  constructor(private merchantId: string) {
    const repo = dataSource.getRepository(Product);
    this.productRepo = new MerchantRepository(repo, merchantId);
  }

  async getProduct(id: string): Promise<Product> {
    // 自动使用正确的 merchant_id 过滤
    return await this.productRepo.findOne(id);
  }

  async getProducts(filters: any): Promise<Product[]> {
    const qb = this.productRepo.createQueryBuilder('product');
    
    if (filters.categoryId) {
      qb.andWhere('product.categoryId = :categoryId', { 
        categoryId: filters.categoryId 
      });
    }
    
    return qb.getMany();
  }
}
```

#### 3.2 系统级 Service（使用 SystemRepository）

```typescript
// platform-setting.service.ts
import { SystemRepository } from '../repositories/system.repository';
import { PlatformSetting } from '../entities/platform-setting.entity';

export class PlatformSettingService {
  private settingRepo: SystemRepository<PlatformSetting>;

  constructor() {
    const repo = dataSource.getRepository(PlatformSetting);
    // 系统级表不需要 merchantId
    this.settingRepo = new SystemRepository(repo);
  }

  async getSetting(category: string): Promise<PlatformSetting | null> {
    // 不添加 merchant_id 过滤
    return await this.settingRepo.findOne({ category } as any);
  }

  async getAllSettings(): Promise<PlatformSetting[]> {
    // 返回所有设置（全局）
    return await this.settingRepo.find();
  }
}
```

> **重要**：系统级表处理方案请参考：[数据库优化指南](./database-optimization-guide.md#第四部分系统级表处理方案)

### 4. Controller 层改造

```typescript
// product.controller.ts
import { MerchantRequest } from '../middleware/merchant.middleware';

export class ProductController {
  async getProduct(req: MerchantRequest, res: Response) {
    const service = new ProductService(req.merchantId!);
    const product = await service.getProduct(req.params.id);
    res.json({ success: true, data: product });
  }
}
```

---

## 📋 实施步骤

### 阶段 1：基础改造（1-2 周）

#### 1.1 创建商户管理表

```sql
-- 创建 merchants 表
CREATE TABLE merchants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 创建默认商户（用于现有数据）
INSERT INTO merchants (id, code, name, status)
VALUES (
    gen_random_uuid(),
    'default',
    '默认商户',
    'ACTIVE'
);
```

#### 1.2 为所有业务表添加 merchant_id

```sql
-- 为所有业务表添加 merchant_id 字段
ALTER TABLE users ADD COLUMN merchant_id UUID;
ALTER TABLE products ADD COLUMN merchant_id UUID;
ALTER TABLE orders ADD COLUMN merchant_id UUID;
ALTER TABLE carts ADD COLUMN merchant_id UUID;
-- ... 其他业务表

-- 设置默认值（使用默认商户）
UPDATE users SET merchant_id = (SELECT id FROM merchants WHERE code = 'default');
UPDATE products SET merchant_id = (SELECT id FROM merchants WHERE code = 'default');
UPDATE orders SET merchant_id = (SELECT id FROM merchants WHERE code = 'default');
-- ... 其他表

-- 设置为 NOT NULL
ALTER TABLE users ALTER COLUMN merchant_id SET NOT NULL;
ALTER TABLE products ALTER COLUMN merchant_id SET NOT NULL;
-- ... 其他表

-- 添加外键约束
ALTER TABLE users ADD CONSTRAINT fk_users_merchant 
    FOREIGN KEY (merchant_id) REFERENCES merchants(id);
ALTER TABLE products ADD CONSTRAINT fk_products_merchant 
    FOREIGN KEY (merchant_id) REFERENCES merchants(id);
-- ... 其他表
```

#### 1.3 创建索引

```sql
-- 为所有表的 merchant_id 创建索引
CREATE INDEX idx_users_merchant_id ON users(merchant_id);
CREATE INDEX idx_products_merchant_id ON products(merchant_id);
CREATE INDEX idx_orders_merchant_id ON orders(merchant_id);
-- ... 其他表

-- 创建复合索引（根据查询模式）
CREATE INDEX idx_products_merchant_code ON products(merchant_id, code);
CREATE INDEX idx_orders_merchant_status ON orders(merchant_id, status);
-- ... 其他常用查询组合
```

### 阶段 2：代码改造（2-3 周）

#### 2.1 实现商户识别中间件

参考上面的 `merchant.middleware.ts` 实现。

#### 2.2 改造 Repository 层

- 创建 `MerchantRepository` 类（用于有 merchant_id 的表）
- 创建 `SystemRepository` 类（用于系统级表）
- 根据表类型选择正确的 Repository
- 确保商户级表的所有查询都包含 `merchant_id` 过滤

> **重要**：系统级表处理方案请参考：[数据库优化指南](./database-optimization-guide.md#第四部分系统级表处理方案)

#### 2.3 改造 Service 层

- 商户级 Service 接收 `merchantId` 参数，使用 `MerchantRepository`
- 系统级 Service 不使用 `merchantId`，使用 `SystemRepository`
- 更新所有业务逻辑

#### 2.4 更新 Controller

- 使用 `merchantMiddleware` 识别商户
- 从 `req.merchantId` 获取商户 ID
- 传递给 Service 层

### 阶段 3：安全加固（1 周）

#### 3.1 实现强制过滤机制

- 确保 `MerchantRepository` 强制添加 `merchant_id` 过滤
- 系统级表使用 `SystemRepository`（不添加 merchant_id 过滤）
- 添加单元测试覆盖所有查询场景
- 代码审查检查遗漏

> **重要**：系统级表处理方案请参考：[数据库优化指南](./database-optimization-guide.md#第四部分系统级表处理方案)

#### 3.2 添加测试

```typescript
// 测试：确保查询不会返回其他商户的数据
describe('ProductRepository', () => {
  it('should only return products for the specified merchant', async () => {
    const merchant1 = await createMerchant('merchant1');
    const merchant2 = await createMerchant('merchant2');
    
    const product1 = await createProduct(merchant1.id);
    const product2 = await createProduct(merchant2.id);
    
    const repo1 = new ProductRepository(merchant1.id);
    const products = await repo1.findAll();
    
    expect(products).toContain(product1);
    expect(products).not.toContain(product2);
  });
});
```

### 阶段 4：性能优化（按需）

#### 4.1 监控表大小

```sql
-- 创建监控查询
SELECT 
    tablename,
    n_live_tup AS row_count,
    CASE 
        WHEN n_live_tup > 5000000 THEN '🔴 需要分区'
        WHEN n_live_tup > 2000000 THEN '🟡 接近阈值'
        ELSE '🟢 正常'
    END AS status
FROM pg_stat_user_tables
WHERE schemaname = 'public'
    AND tablename IN ('orders', 'order_items', 'products')
ORDER BY n_live_tup DESC;
```

#### 4.2 实施分区（如果需要）

当表超过 500 万行时，考虑实施分区。

**详细分区实施步骤请参考**：[数据库优化指南](./database-optimization-guide.md)

---

## 🚨 关键风险点

### 1. 数据泄露风险（最高优先级）

**风险**：忘记添加 `merchant_id` 过滤，可能返回其他商户的数据。

**防护措施**：
- ✅ 使用 `BaseRepository` 强制过滤
- ✅ 代码审查必须检查所有查询
- ✅ 单元测试覆盖边界情况
- ✅ 考虑使用数据库 RLS（Row Level Security）

### 2. 性能退化（中等优先级）

**风险**：表变大后查询性能下降。

**防护措施**：
- ⚠️ 监控表大小，超过阈值考虑分区
- ⚠️ 定期优化索引
- ⚠️ 考虑读写分离（如果商户数量很大）

### 3. 维护成本（低优先级）

**风险**：新增表时忘记添加 `merchant_id`。

**防护措施**：
- ✅ 建立代码审查流程
- ✅ 迁移脚本模板化
- ✅ 文档化最佳实践

---

## 📚 相关文档

### 架构和设计文档

- [多租户架构方案分析](../../docs/multi-tenant/multi-tenant-architecture-analysis.md)
  - Tenant ID 方案深度分析
  - Schema 分离方案对比
  - 性能阈值参考
  - 最终建议

- [多商户平台数据库设计方案](../../docs/multi-tenant/multi-tenant-database-design.md)
  - Schema 分离架构详细设计
  - 技术实现方案
  - 数据迁移策略
  - 安全考虑

### 数据库优化文档

- [数据库优化指南](./database-optimization-guide.md) - **必读**
  - **第一部分**：表分区详解（什么是分区、为什么选择 500 万行、如何监控、如何实施）
  - **第二部分**：分区策略总结（主表+归档表策略、数据归档流程、查询策略）
  - **第三部分**：分区查询性能优化（混合分区查询、归档表 API 设计）
  - **第四部分**：系统级表处理方案（系统级表识别、Repository 架构设计、最佳实践）

---

## 🎯 总结

### 核心方案

1. **使用 Tenant ID 方案**（维护简单）
2. **对大数据量表进行分区**（解决性能问题）
3. **使用中间件强制过滤**（防止数据泄露）

### 关键要点

1. **维护简单**：迁移脚本简单，工具支持好
2. **性能足够**：中小型平台，数据量不会太大
3. **安全可控**：通过 Base Repository 强制过滤

### 性能预期

```
表大小 < 100 万行：性能优秀
表大小 100-500 万行：性能良好，需要优化索引
表大小 500-1000 万行：考虑分区
表大小 > 1000 万行：强烈建议分区
```

**你的平台预计规模**：
- 商户：10-500 个
- 单商户产品：1 万-10 万
- 单商户订单：10 万-100 万
- **总数据量预计 < 5000 万行**

**结论：Tenant ID 方案完全够用，性能不会有问题。**

---

## 📝 下一步行动

1. ✅ 阅读 [多租户架构方案分析](./multi-tenant-architecture-analysis.md) 了解详细对比
2. ✅ 阅读 [数据库优化指南](./database-optimization-guide.md) 了解分区策略和系统级表处理
3. ✅ 开始实施阶段 1：基础改造
4. ✅ 定期监控表大小，准备分区（如果需要）

