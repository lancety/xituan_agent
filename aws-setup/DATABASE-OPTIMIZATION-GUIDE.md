# 数据库优化和扩展指南

## 📊 当前配置分析

### 当前状态
- **实例类型**: `db.t3.micro` (2 vCPU, 1GB RAM)
- **存储**: 20GB
- **Multi-AZ**: 否（单可用区）
- **连接池**: TypeORM 默认配置（未显式配置）
- **最大连接数**: PostgreSQL 默认（约 100，但 t3.micro 受限于内存）

### 瓶颈分析

#### 1. **连接数限制**（最可能先遇到）
```
db.t3.micro 内存限制：
- 每个连接约占用 10-15MB 内存
- 1GB RAM ≈ 最多 60-80 个并发连接
- 如果 3 个 ECS 任务，每个任务 20-30 个连接 = 60-90 个连接
- 接近或超过限制！
```

#### 2. **CPU 性能**
- 2 vCPU 适合小到中等负载
- 复杂查询或高并发时可能成为瓶颈

#### 3. **IOPS 限制**
- 20GB 存储 = 基础 IOPS（约 60 IOPS）
- 高读写场景可能不够

---

## 🚀 优化策略（按优先级）

### 阶段 1: 应用层优化（立即可做，零成本）

#### 1.1 配置连接池（最重要！）

**问题**: TypeORM 默认连接池可能过大，导致连接数耗尽

**解决方案**: 在 `database.config.ts` 中添加连接池配置

```typescript
// xituan_backend/src/shared/infrastructure/database.config.ts

export function getDatabaseConfig(): PostgresConnectionOptions {
  // ... existing code ...
  
  const baseConfig: PostgresConnectionOptions = {
    // ... existing config ...
    
    // 连接池配置
    extra: {
      max: 10,              // 每个应用实例最大连接数（推荐：10-20）
      min: 2,               // 最小连接数
      idleTimeoutMillis: 30000,  // 空闲连接超时（30秒）
      connectionTimeoutMillis: 2000, // 连接超时（2秒）
    },
    
    // 连接选项
    poolSize: 10,           // TypeORM 连接池大小（与 extra.max 保持一致）
  };
  
  return baseConfig;
}
```

**计算示例**:
```
3 个 ECS 任务 × 10 个连接/任务 = 30 个连接
远低于 db.t3.micro 的 60-80 连接限制 ✅
```

#### 1.2 查询优化

**A. 添加索引**（检查慢查询）

```sql
-- 检查缺失索引
SELECT 
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats
WHERE schemaname = 'public'
  AND n_distinct > 100
ORDER BY abs(correlation) DESC;

-- 常见需要索引的字段
-- 1. 外键字段（已有部分索引）
-- 2. 经常用于 WHERE 的字段
-- 3. 经常用于 JOIN 的字段
-- 4. 经常用于 ORDER BY 的字段
```

**B. 避免 N+1 查询**

```typescript
// ❌ 错误：N+1 查询
const orders = await orderRepository.find();
for (const order of orders) {
  const user = await userRepository.findOne({ where: { id: order.userId } });
}

// ✅ 正确：使用 relations
const orders = await orderRepository.find({
  relations: ['user', 'items']
});
```

**C. 使用分页**

```typescript
// ❌ 错误：一次性加载所有数据
const allOrders = await orderRepository.find();

// ✅ 正确：分页查询
const orders = await orderRepository.find({
  take: 20,
  skip: (page - 1) * 20
});
```

#### 1.3 启用查询缓存（可选）

```typescript
// 对于不经常变化的数据，使用缓存
import { Redis } from 'ioredis';

// 示例：缓存平台设置
const cachedSettings = await redis.get('platform_settings');
if (cachedSettings) {
  return JSON.parse(cachedSettings);
}
const settings = await platformSettingRepository.find();
await redis.setex('platform_settings', 3600, JSON.stringify(settings));
```

---

### 阶段 2: 数据库层优化（需要升级 RDS）

#### 2.1 垂直扩展（升级实例类型）

**升级路径**:
```
db.t3.micro (2 vCPU, 1GB) 
  → db.t3.small (2 vCPU, 2GB)      # 2x 内存，更多连接
  → db.t3.medium (2 vCPU, 4GB)     # 4x 内存
  → db.t3.large (2 vCPU, 8GB)      # 8x 内存
  → db.r6g.large (2 vCPU, 16GB)    # 内存优化型
```

**配置更新**:
```json
// parameters.production.json
{
  "ParameterKey": "DBInstanceClass",
  "ParameterValue": "db.t3.small"  // 或 db.t3.medium
}
```

**连接数提升**:
```
db.t3.micro:   ~60-80 连接
db.t3.small:   ~120-160 连接
db.t3.medium:  ~240-320 连接
```

#### 2.2 启用 Multi-AZ（高可用）

**配置**:
```yaml
# 04_rds.yaml
RDSInstance:
  Properties:
    MultiAZ: true  # 启用多可用区
```

**优势**:
- 自动故障转移（< 60秒）
- 数据同步复制
- 提高可用性（99.95% → 99.99%）

**成本**: 约增加 2x 费用（因为运行两个实例）

#### 2.3 启用 Performance Insights（监控）

```yaml
# 04_rds.yaml
RDSInstance:
  Properties:
    EnablePerformanceInsights: true
    PerformanceInsightsRetentionPeriod: 7  # 保留 7 天
```

**用途**:
- 识别慢查询
- 监控数据库负载
- 优化建议

---

### 阶段 3: 架构扩展（大规模场景）

#### 3.1 读写分离（Read Replicas）

**场景**: 读多写少（如报表、查询接口）

**架构**:
```
主库 (Primary)     → 写操作
  ↓ 异步复制
只读副本 (Replica) → 读操作（可多个）
```

**实现方案 A: AWS RDS Read Replica**

```yaml
# 创建只读副本
ReadReplica:
  Type: AWS::RDS::DBInstanceReadReplica
  Properties:
    SourceDBInstanceIdentifier: !Ref RDSInstance
    DBInstanceClass: db.t3.small
    PubliclyAccessible: false
```

**实现方案 B: 应用层读写分离**

```typescript
// database.config.ts
const readConfig = {
  ...baseConfig,
  host: process.env.DB_READ_REPLICA_HOST || dbConfig.host,
  // 只读连接池
  extra: {
    max: 20,  // 读操作可以更多连接
  }
};

const writeConfig = {
  ...baseConfig,
  host: dbConfig.host,
  // 写连接池
  extra: {
    max: 10,
  }
};
```

#### 3.2 连接池代理（PgBouncer）

**问题**: 即使有连接池，每个应用实例仍需要多个连接

**解决方案**: 使用 PgBouncer 作为连接池代理

```
应用 (30 连接) → PgBouncer (10 连接) → RDS
```

**AWS 方案**: RDS Proxy（托管服务）

```yaml
# 创建 RDS Proxy
RDSProxy:
  Type: AWS::RDS::DBProxy
  Properties:
    DBProxyName: xituan-db-proxy
    EngineFamily: POSTGRESQL
    Auth:
      - AuthScheme: SECRETS
        SecretArn: !Ref DBSecretArn
    TargetGroups:
      - DBClusterIdentifiers: []
        DBInstanceIdentifiers:
          - !Ref RDSInstance
    VpcSubnetIds:
      - !Ref PublicSubnetId
      - !Ref PublicSubnet2Id
```

**优势**:
- 连接复用（减少实际数据库连接）
- 自动故障转移
- 连接池管理

#### 3.3 缓存层（Redis/ElastiCache）

**场景**: 频繁读取但不常变化的数据

**实现**:
```yaml
# 创建 ElastiCache Redis
RedisCache:
  Type: AWS::ElastiCache::ReplicationGroup
  Properties:
    ReplicationGroupId: xituan-redis
    Engine: redis
    CacheNodeType: cache.t3.micro
    NumCacheClusters: 2
    AutomaticFailoverEnabled: true
```

**应用层使用**:
```typescript
// 缓存策略
const cacheKey = `product:${productId}`;
let product = await redis.get(cacheKey);
if (!product) {
  product = await productRepository.findOne({ where: { id: productId } });
  await redis.setex(cacheKey, 3600, JSON.stringify(product)); // 缓存 1 小时
}
```

#### 3.4 分库分表（超大规模）

**场景**: 单表数据量 > 千万级

**策略**:
- 按业务模块分库（订单库、用户库、商品库）
- 按时间分表（按月/年）
- 按哈希分表（按用户ID）

**AWS 方案**: Aurora Serverless（自动扩展）

---

## 📈 扩展路径规划

### 小规模（当前）
```
配置:
- RDS: db.t3.micro
- ECS: 1-3 任务
- 连接池: 10/任务

支持:
- 并发用户: 100-500
- 请求/秒: 50-200
```

### 中等规模
```
配置:
- RDS: db.t3.small + Multi-AZ
- ECS: 1-10 任务
- 连接池: 10/任务
- 缓存: Redis (可选)

支持:
- 并发用户: 500-2000
- 请求/秒: 200-1000
```

### 大规模
```
配置:
- RDS: db.t3.medium + Read Replica
- ECS: 1-20 任务
- 连接池: 10/任务
- RDS Proxy: 启用
- 缓存: ElastiCache Redis

支持:
- 并发用户: 2000-10000
- 请求/秒: 1000-5000
```

### 超大规模
```
配置:
- RDS: Aurora Serverless 或 db.r6g.xlarge
- 读写分离: 多个 Read Replicas
- ECS: 多区域部署
- 缓存: Redis Cluster
- CDN: CloudFront

支持:
- 并发用户: 10000+
- 请求/秒: 5000+
```

---

## 🔧 实施步骤

### 立即优化（阶段 1）

1. **配置连接池**（最重要）
   ```bash
   # 修改 database.config.ts
   # 添加 extra.max = 10
   ```

2. **检查慢查询**
   ```sql
   -- 启用慢查询日志
   ALTER DATABASE xituan SET log_min_duration_statement = 1000; -- 1秒
   ```

3. **添加缺失索引**
   ```sql
   -- 根据查询模式添加索引
   CREATE INDEX idx_orders_user_id ON orders(user_id);
   CREATE INDEX idx_orders_created_at ON orders(created_at);
   ```

### 短期优化（1-3个月）

1. **升级 RDS 实例**
   ```bash
   # 更新 parameters.production.json
   "DBInstanceClass": "db.t3.small"
   
   # 部署
   npm run deploy:infra
   ```

2. **启用 Performance Insights**
   ```yaml
   # 更新 04_rds.yaml
   EnablePerformanceInsights: true
   ```

3. **监控数据库指标**
   - CloudWatch: CPU, Memory, Connections
   - Performance Insights: 慢查询分析

### 中期优化（3-6个月）

1. **添加 Redis 缓存**
   - 部署 ElastiCache
   - 应用层集成缓存

2. **启用 Multi-AZ**
   - 提高可用性
   - 自动故障转移

### 长期优化（6-12个月）

1. **读写分离**
   - 创建 Read Replica
   - 应用层路由读写

2. **RDS Proxy**
   - 连接池管理
   - 自动故障转移

---

## 📊 监控指标

### 关键指标

1. **连接数**
   ```
   告警阈值: > 80% max_connections
   监控: CloudWatch → DatabaseConnections
   ```

2. **CPU 使用率**
   ```
   告警阈值: > 80%
   监控: CloudWatch → CPUUtilization
   ```

3. **慢查询**
   ```
   告警阈值: > 1秒
   监控: Performance Insights
   ```

4. **IOPS**
   ```
   告警阈值: > 80% 基础 IOPS
   监控: CloudWatch → ReadIOPS, WriteIOPS
   ```

### 监控查询

```sql
-- 当前连接数
SELECT count(*) FROM pg_stat_activity;

-- 按数据库的连接数
SELECT datname, count(*) 
FROM pg_stat_activity 
GROUP BY datname;

-- 慢查询（需要启用 log_min_duration_statement）
SELECT query, duration 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;
```

---

## 💰 成本估算

### 当前配置（db.t3.micro）
- **月费用**: ~$15-20 USD
- **存储**: 20GB 包含

### 升级到 db.t3.small
- **月费用**: ~$30-35 USD
- **提升**: 2x 内存，更多连接

### 升级到 db.t3.medium + Multi-AZ
- **月费用**: ~$120-140 USD
- **提升**: 4x 内存，高可用

### 添加 Read Replica
- **额外费用**: 主实例的 50-100%
- **提升**: 读性能 2x

---

## 🎯 总结

### 优先级排序

1. **立即做**（零成本）:
   - ✅ 配置连接池（extra.max = 10）
   - ✅ 优化查询（添加索引，避免 N+1）
   - ✅ 启用慢查询日志

2. **短期做**（低成本）:
   - ✅ 升级到 db.t3.small
   - ✅ 启用 Performance Insights
   - ✅ 监控数据库指标

3. **中期做**（中等成本）:
   - ✅ 添加 Redis 缓存
   - ✅ 启用 Multi-AZ

4. **长期做**（高成本，大规模）:
   - ✅ 读写分离
   - ✅ RDS Proxy
   - ✅ 考虑 Aurora

### 关键建议

- **连接池是第一步**：立即配置，避免连接数耗尽
- **监控优先**：先监控，再优化
- **渐进式扩展**：根据实际负载逐步升级
- **成本平衡**：在性能和成本之间找到平衡点

