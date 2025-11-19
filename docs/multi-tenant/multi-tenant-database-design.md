# 多商户平台数据库设计方案

## 📋 概述

本文档描述将现有单用户系统改造成多商户平台的数据库设计方案。包含 Schema 分离架构和 Tenant ID 架构的详细对比和技术实现。

> **注意**：本文档主要描述 Schema 分离架构的技术实现细节。关于方案选择和最终推荐，请参考：
> - [多租户架构方案分析](./multi-tenant-architecture-analysis.md) - 详细的方案对比和最终推荐
> - [多租户平台改造实施指南](../../devGuide/multi-tenant-platform-implementation.md) - 完整的实施指南

---

## 🏗️ 架构方案对比

### 方案一：Schema 分离架构

**核心设计**：
- 每个商户拥有独立的 Schema（如 `merchant_001`, `merchant_002`）
- 共用数据表放在官方 Schema（如 `platform` 或 `public`）
- 通过 Schema 切换实现数据隔离

> **方案选择说明**：虽然 Schema 分离架构在数据隔离和性能方面有优势，但考虑到维护复杂性，**最终推荐使用 Tenant ID 方案**。详细分析请参考 [多租户架构方案分析](./multi-tenant-architecture-analysis.md)。

**Schema 结构**：
```
PostgreSQL Database: xituan_platform
├── platform (官方 Schema)
│   ├── merchants (商户信息表)
│   ├── merchant_subscriptions (商户订阅表)
│   ├── platform_settings (平台设置)
│   ├── system_logs (系统日志)
│   └── shared_templates (共享模板)
│
├── merchant_001 (商户 A 的 Schema)
│   ├── users (用户表)
│   ├── products (产品表)
│   ├── orders (订单表)
│   ├── carts (购物车表)
│   └── ... (所有业务表)
│
├── merchant_002 (商户 B 的 Schema)
│   ├── users
│   ├── products
│   └── ...
│
└── merchant_xxx (其他商户 Schema)
```

---

## ✅ Schema 分离方案的优势

### 1. **数据隔离性强**
- ✅ 每个商户的数据完全物理隔离
- ✅ 避免跨商户数据泄露风险
- ✅ 符合数据合规要求（如 GDPR）
- ✅ 商户可以独立备份和恢复

### 2. **性能优势**
- ✅ 查询时无需添加 `merchant_id` 过滤条件
- ✅ 索引更小，查询更快
- ✅ 每个 Schema 的表结构独立，优化更灵活
- ✅ 减少 JOIN 操作，提升查询性能

### 3. **扩展性好**
- ✅ 商户可以独立迁移到不同数据库
- ✅ 支持按商户进行分库分表
- ✅ 便于实现商户级别的读写分离
- ✅ 可以针对特定商户进行性能优化

### 4. **运维便利**
- ✅ 可以单独备份某个商户的数据
- ✅ 商户数据清理不影响其他商户
- ✅ 支持商户级别的数据导出
- ✅ 便于实现商户数据归档

### 5. **开发友好**
- ✅ 代码逻辑更简单，无需处处添加 `merchant_id`
- ✅ 减少数据误操作风险
- ✅ 测试环境可以轻松复制单个商户 Schema
- ✅ 迁移脚本可以针对单个商户执行

---

## ❌ Schema 分离方案的劣势

### 1. **连接管理复杂**
- ❌ 需要动态切换 Schema 或使用连接池
- ❌ 连接字符串需要包含 Schema 信息
- ❌ 跨 Schema 查询需要特殊处理（使用 `schema.table` 语法）
- ❌ TypeORM 需要配置 Schema 映射

### 2. **迁移脚本复杂**
- ❌ 需要在每个商户 Schema 中执行迁移
- ❌ 迁移脚本需要循环处理所有商户
- ❌ 新增商户时需要初始化 Schema 和表结构
- ❌ 回滚操作需要处理所有商户 Schema

### 3. **跨商户操作困难**
- ❌ 跨商户数据统计需要 UNION 多个 Schema
- ❌ 平台级别的报表需要聚合多个 Schema
- ❌ 跨商户查询性能较差
- ❌ 需要额外的聚合服务

### 4. **资源消耗**
- ❌ 每个 Schema 都有独立的表结构
- ❌ 索引和约束在每个 Schema 中重复
- ❌ 数据库元数据占用更多空间
- ❌ 连接池可能需要更多连接

### 5. **工具支持**
- ❌ 某些数据库管理工具对多 Schema 支持不完善
- ❌ 需要自定义工具来管理多 Schema
- ❌ 监控和日志需要特殊处理

---

## 🔄 替代方案对比

### 方案二：单 Schema + tenant_id 字段

**设计**：所有表添加 `merchant_id` 字段，通过 WHERE 条件过滤

**优势**：
- ✅ 连接管理简单
- ✅ 迁移脚本简单
- ✅ 跨商户查询方便
- ✅ 工具支持好

**劣势**：
- ❌ 数据隔离性弱（容易误操作）
- ❌ 查询性能较差（需要大量索引）
- ❌ 代码中需要处处添加 `merchant_id` 过滤
- ❌ 数据泄露风险高

### 方案三：独立数据库

**设计**：每个商户使用独立的数据库实例

**优势**：
- ✅ 完全隔离
- ✅ 可以独立扩展
- ✅ 故障隔离

**劣势**：
- ❌ 资源消耗大
- ❌ 管理成本高
- ❌ 跨商户操作非常困难

---

## 🎯 方案选择说明

### 最终推荐：Tenant ID 方案

基于维护复杂性和性能的权衡，**最终推荐使用 Tenant ID 方案**（单 Schema + merchant_id 字段）。

**详细分析请参考**：[多租户架构方案分析](./multi-tenant-architecture-analysis.md)

### Schema 分离架构（备选方案）

以下内容描述 Schema 分离架构的技术实现，可作为备选方案参考：

### 核心原则

1. **商户业务数据** → 独立 Schema（完全隔离）
2. **平台共用数据** → 官方 Schema（共享）
3. **跨商户统计** → 通过聚合服务处理

### Schema 分类

#### 官方 Schema (`platform`)

存放所有商户共用的数据和配置：

```sql
-- 商户管理
CREATE TABLE platform.merchants (
    id UUID PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,  -- 商户编码
    name VARCHAR(255) NOT NULL,
    schema_name VARCHAR(63) UNIQUE NOT NULL,  -- 对应 Schema 名称
    status VARCHAR(20) NOT NULL,
    subscription_plan VARCHAR(50),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- 商户订阅
CREATE TABLE platform.merchant_subscriptions (
    id UUID PRIMARY KEY,
    merchant_id UUID REFERENCES platform.merchants(id),
    plan_type VARCHAR(50),
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    is_active BOOLEAN
);

-- 平台设置（全局）
CREATE TABLE platform.platform_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB,
    description TEXT
);

-- 系统日志（跨商户）
CREATE TABLE platform.system_logs (
    id UUID PRIMARY KEY,
    merchant_id UUID,
    log_type VARCHAR(50),
    content JSONB,
    created_at TIMESTAMP
);

-- 共享模板（可选）
CREATE TABLE platform.shared_templates (
    id UUID PRIMARY KEY,
    template_type VARCHAR(50),
    content JSONB,
    is_public BOOLEAN
);
```

#### 商户 Schema (`merchant_xxx`)

每个商户的独立 Schema，包含所有业务表：

```sql
-- 示例：merchant_001 Schema
CREATE SCHEMA merchant_001;

-- 用户表
CREATE TABLE merchant_001.users (
    id UUID PRIMARY KEY,
    username VARCHAR(50),
    email VARCHAR(255),
    -- ... 其他字段（无 merchant_id）
);

-- 产品表
CREATE TABLE merchant_001.products (
    id UUID PRIMARY KEY,
    name VARCHAR(255),
    price DECIMAL(10,2),
    -- ... 其他字段
);

-- 订单表
CREATE TABLE merchant_001.orders (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES merchant_001.users(id),
    total_amount DECIMAL(10,2),
    -- ... 其他字段
);

-- ... 所有其他业务表
```

---

## 🔧 技术实现方案

### 1. 数据库连接管理

#### 方案 A：动态 Schema 切换（推荐）

```typescript
// database.manager.ts
import { DataSource, DataSourceOptions } from 'typeorm';
import { getDatabaseConfig } from './database.config';

class DatabaseManager {
  private connections: Map<string, DataSource> = new Map();
  private defaultConnection: DataSource;

  async initialize(): Promise<void> {
    // 初始化默认连接（连接到 platform schema）
    const defaultConfig = getDatabaseConfig();
    this.defaultConnection = new DataSource({
      ...defaultConfig,
      schema: 'platform'
    });
    await this.defaultConnection.initialize();
  }

  // 获取商户连接
  async getMerchantConnection(merchantCode: string): Promise<DataSource> {
    // 从缓存获取
    if (this.connections.has(merchantCode)) {
      return this.connections.get(merchantCode)!;
    }

    // 查询商户 Schema 名称
    const merchant = await this.defaultConnection
      .getRepository('Merchant')
      .findOne({ where: { code: merchantCode } });

    if (!merchant) {
      throw new Error(`Merchant not found: ${merchantCode}`);
    }

    // 创建新连接
    const config = getDatabaseConfig();
    const connection = new DataSource({
      ...config,
      schema: merchant.schemaName,
      name: `merchant_${merchantCode}` // 连接名称
    });

    await connection.initialize();
    this.connections.set(merchantCode, connection);

    return connection;
  }

  // 获取平台连接
  getPlatformConnection(): DataSource {
    return this.defaultConnection;
  }
}

export const dbManager = new DatabaseManager();
```

#### 方案 B：连接字符串切换

```typescript
// 在连接字符串中指定 Schema
const connectionString = `postgresql://user:pass@host:port/db?schema=merchant_001`;

// TypeORM 配置
const config: PostgresConnectionOptions = {
  type: 'postgres',
  url: connectionString,
  // 或者
  schema: 'merchant_001'
};
```

### 2. 中间件：商户识别

```typescript
// merchant.middleware.ts
import { Request, Response, NextFunction } from 'express';

export interface MerchantRequest extends Request {
  merchantId?: string;
  merchantCode?: string;
  merchantSchema?: string;
}

export const merchantMiddleware = async (
  req: MerchantRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // 从多种方式识别商户
  // 1. 子域名: merchant001.xituan.com
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
  const platformConn = dbManager.getPlatformConnection();
  const merchant = await platformConn
    .getRepository('Merchant')
    .findOne({ where: { code: merchantCode } });

  if (!merchant || merchant.status !== 'ACTIVE') {
    res.status(403).json({ error: 'Merchant not found or inactive' });
    return;
  }

  // 附加到请求对象
  req.merchantId = merchant.id;
  req.merchantCode = merchant.code;
  req.merchantSchema = merchant.schemaName;

  next();
};
```

### 3. Repository 模式改造

```typescript
// base.repository.ts
import { DataSource, Repository, EntityTarget } from 'typeorm';
import { dbManager } from '../infrastructure/database.manager';

export class BaseRepository<T> {
  protected repository: Repository<T>;

  constructor(
    private entity: EntityTarget<T>,
    private merchantCode: string
  ) {
    // 延迟初始化，在需要时获取连接
  }

  protected async getRepository(): Promise<Repository<T>> {
    if (!this.repository) {
      const connection = await dbManager.getMerchantConnection(this.merchantCode);
      this.repository = connection.getRepository(this.entity);
    }
    return this.repository;
  }

  async findOne(id: string): Promise<T | null> {
    const repo = await this.getRepository();
    return repo.findOne({ where: { id } as any });
  }

  // ... 其他方法
}
```

### 4. Service 层改造

```typescript
// product.service.ts
import { BaseRepository } from '../repositories/base.repository';
import { Product } from '../entities/product.entity';

export class ProductService {
  private productRepo: BaseRepository<Product>;

  constructor(private merchantCode: string) {
    this.productRepo = new BaseRepository(Product, merchantCode);
  }

  async getProduct(id: string): Promise<Product> {
    // 自动使用正确的 Schema
    return await this.productRepo.findOne(id);
  }
}

// 在 Controller 中使用
export class ProductController {
  async getProduct(req: MerchantRequest, res: Response) {
    const service = new ProductService(req.merchantCode!);
    const product = await service.getProduct(req.params.id);
    res.json(product);
  }
}
```

---

## 📊 数据迁移策略

### 1. 现有数据迁移

```sql
-- 步骤 1: 创建平台 Schema
CREATE SCHEMA IF NOT EXISTS platform;

-- 步骤 2: 迁移商户信息
INSERT INTO platform.merchants (id, code, name, schema_name, status)
VALUES 
  (gen_random_uuid(), 'default', '默认商户', 'merchant_default', 'ACTIVE');

-- 步骤 3: 创建商户 Schema
CREATE SCHEMA merchant_default;

-- 步骤 4: 迁移现有表到商户 Schema
-- 方式 A: 重命名现有表（如果原来在 public schema）
ALTER TABLE public.users SET SCHEMA merchant_default;
ALTER TABLE public.products SET SCHEMA merchant_default;
-- ... 其他表

-- 方式 B: 复制数据（如果原来在 public schema，想保留备份）
CREATE TABLE merchant_default.users AS SELECT * FROM public.users;
CREATE TABLE merchant_default.products AS SELECT * FROM public.products;
-- ... 其他表

-- 步骤 5: 迁移平台共用表
CREATE TABLE platform.platform_settings AS SELECT * FROM public.platform_settings;
```

### 2. 新增商户初始化

```sql
-- 创建新商户 Schema
CREATE SCHEMA merchant_002;

-- 执行迁移脚本（在商户 Schema 中）
SET search_path TO merchant_002;

-- 运行所有迁移脚本
\i migrations/001_init.sql
\i migrations/002_add_auth_tables.sql
-- ... 其他迁移

-- 重置 search_path
SET search_path TO public;
```

### 3. 迁移脚本改造

```typescript
// migration.util.ts
export async function runMigrationForAllMerchants(
  migrationScript: string
): Promise<void> {
  const platformConn = dbManager.getPlatformConnection();
  
  // 获取所有活跃商户
  const merchants = await platformConn
    .getRepository('Merchant')
    .find({ where: { status: 'ACTIVE' } });

  for (const merchant of merchants) {
    console.log(`Running migration for merchant: ${merchant.code}`);
    
    const merchantConn = await dbManager.getMerchantConnection(merchant.code);
    
    // 设置 Schema
    await merchantConn.query(`SET search_path TO ${merchant.schemaName}`);
    
    // 执行迁移
    await merchantConn.query(migrationScript);
    
    console.log(`Migration completed for merchant: ${merchant.code}`);
  }
}
```

---

## 🔐 安全考虑

### 1. Schema 权限控制

```sql
-- 为每个商户创建专用数据库用户
CREATE USER merchant_001_user WITH PASSWORD 'secure_password';

-- 授予 Schema 访问权限
GRANT USAGE ON SCHEMA merchant_001 TO merchant_001_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA merchant_001 TO merchant_001_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA merchant_001 TO merchant_001_user;

-- 禁止访问其他商户 Schema
REVOKE ALL ON SCHEMA merchant_002 FROM merchant_001_user;
```

### 2. 应用层安全

- ✅ 中间件验证商户身份
- ✅ JWT Token 包含 `merchant_id`
- ✅ API 路由包含商户代码验证
- ✅ 防止 Schema 注入攻击

---

## 📈 性能优化建议

### 1. 连接池管理

```typescript
// 为每个商户维护独立的连接池
const merchantConnectionPools = new Map<string, DataSource>();

// 连接池配置
const poolConfig = {
  max: 10,        // 每个商户最多 10 个连接
  min: 2,         // 最少保持 2 个连接
  idleTimeoutMillis: 30000
};
```

### 2. 缓存策略

```typescript
// 缓存商户 Schema 映射
const merchantSchemaCache = new Map<string, string>();

// 缓存商户连接
const connectionCache = new Map<string, DataSource>();
```

### 3. 跨商户聚合

```typescript
// 使用消息队列或定时任务进行跨商户统计
// 避免实时跨 Schema 查询

// 示例：每日统计任务
async function generateDailyStats() {
  const merchants = await getAllActiveMerchants();
  
  for (const merchant of merchants) {
    const conn = await getMerchantConnection(merchant.code);
    const stats = await calculateStats(conn);
    
    // 写入平台 Schema 的统计表
    await saveStatsToPlatform(merchant.id, stats);
  }
}
```

---

## 🚀 实施步骤

### 阶段 1: 准备阶段（1-2 周）

1. ✅ 创建平台 Schema 和商户管理表
2. ✅ 设计商户识别机制（子域名/路径/Header）
3. ✅ 实现数据库连接管理器
4. ✅ 编写商户中间件

### 阶段 2: 数据迁移（1 周）

1. ✅ 备份现有数据库
2. ✅ 创建默认商户 Schema
3. ✅ 迁移现有数据到商户 Schema
4. ✅ 验证数据完整性

### 阶段 3: 代码改造（2-3 周）

1. ✅ 改造 Repository 层支持多 Schema
2. ✅ 改造 Service 层传递商户信息
3. ✅ 更新 Controller 使用商户中间件
4. ✅ 更新迁移脚本支持多 Schema

### 阶段 4: 测试和优化（1-2 周）

1. ✅ 单元测试
2. ✅ 集成测试
3. ✅ 性能测试
4. ✅ 安全测试

### 阶段 5: 上线和监控（持续）

1. ✅ 灰度发布
2. ✅ 监控数据库连接数
3. ✅ 监控查询性能
4. ✅ 准备回滚方案

---

## 📝 注意事项

### 1. TypeORM Schema 配置

```typescript
// entity 定义时需要指定 Schema
@Entity({ name: 'users', schema: 'merchant_001' })
export class User {
  // ...
}

// 或者在连接配置中指定
const config: PostgresConnectionOptions = {
  schema: 'merchant_001',
  // ...
};
```

### 2. 迁移脚本管理

- 使用版本控制管理迁移脚本
- 为每个商户记录迁移历史
- 支持迁移回滚

### 3. 监控和日志

- 监控每个 Schema 的连接数
- 记录跨 Schema 操作日志
- 设置 Schema 级别的性能指标

### 4. 备份策略

- 平台 Schema 单独备份
- 每个商户 Schema 独立备份
- 支持按商户恢复数据

---

## 🎯 总结

### Schema 分离方案适合以下场景

- ✅ 需要强数据隔离
- ✅ 商户数量中等（< 1000）
- ✅ 跨商户操作较少
- ✅ 需要独立备份和恢复
- ✅ 对性能要求较高

### 最终推荐方案

**对于你的场景（维护敏感 + 性能第二敏感）**，推荐使用 **Tenant ID 方案**。

**详细分析请参考**：
- [多租户架构方案分析](./multi-tenant-architecture-analysis.md) - 完整的方案对比和最终建议
- [多租户平台改造实施指南](../../devGuide/multi-tenant-platform-implementation.md) - 实施步骤和代码示例

### 分区策略

如果采用 Tenant ID 方案，当表超过 500 万行时，考虑实施分区：

- [数据库优化指南](./database-optimization-guide.md) - 完整的分区指南，包括：
  - 表分区详解（概念、监控、实施）
  - 分区策略总结（主表+归档表策略）
  - 分区查询性能优化（查询性能和 API 设计）
  - 系统级表处理方案

---

## 📚 相关文档

### 核心文档

- [多租户架构方案分析](./multi-tenant-architecture-analysis.md) - **必读**：方案对比和最终推荐
- [多租户平台改造实施指南](../../devGuide/multi-tenant-platform-implementation.md) - **必读**：完整实施指南

### 数据库优化文档

- [数据库优化指南](./database-optimization-guide.md) - **必读**
  - 表分区详解（概念、监控、实施）
  - 分区策略总结（主表+归档表最佳实践）
  - 分区查询性能优化（查询性能和 API 设计）
  - 系统级表处理方案

### 参考资料

- PostgreSQL Schema 文档: https://www.postgresql.org/docs/current/ddl-schemas.html
- TypeORM Schema 配置: https://typeorm.io/entities#entity-schema
- 多租户架构模式: https://docs.microsoft.com/en-us/azure/sql-database/saas-tenancy-app-design-patterns

