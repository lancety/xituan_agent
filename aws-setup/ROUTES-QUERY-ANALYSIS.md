# Routes 查询复杂度分析与连接数配置

## 📊 使用模式分析

### 总体分布
- **用户端 API**: 70% 用量，读写比例 **9:1**（90% 读，10% 写）
- **CMS 端 API**: 30% 用量，读写比例 **7:3**（70% 读，30% 写）

### 连接数计算基础

```
总连接数需求 = 读连接数 + 写连接数

读连接数 = (读请求/秒 × 平均查询时间) / 连接复用率
写连接数 = (写请求/秒 × 平均查询时间) / 连接复用率

假设：
- 平均读查询时间：50-100ms（简单到中等）
- 平均写查询时间：100-200ms（包含事务）
- 连接复用率：80-90%
```

---

## 🔍 Routes 查询复杂度分析

### 用户端 API（70% 用量，读写 9:1）

#### 简单查询（< 50ms）- 主要读操作

| Route | 操作 | 复杂度 | 说明 |
|-------|------|--------|------|
| `GET /api/products` | 读 | 简单 | 分页查询，有索引 |
| `GET /api/products/:id` | 读 | 简单 | 单条查询，主键索引 |
| `POST /api/products/batch` | 读 | 简单 | 批量查询，IN 查询 |
| `GET /api/categories` | 读 | 简单 | 列表查询，数据量小 |
| `GET /api/platform-settings` | 读 | 简单 | 单表查询，可缓存 |
| `GET /api/news` | 读 | 简单 | 分页查询 |
| `GET /api/preorder-promotes` | 读 | 简单 | 列表查询 |
| `GET /api/orders/:id/status` | 读 | 简单 | 轻量级状态查询 |
| `GET /api/auth/me` | 读 | 简单 | 用户信息查询 |

**占比**: ~60% 用户端请求

#### 中等查询（50-200ms）- 读操作

| Route | 操作 | 复杂度 | 说明 |
|-------|------|--------|------|
| `GET /api/orders/my` | 读 | 中等 | 用户订单列表，JOIN 查询 |
| `GET /api/orders/:id` | 读 | 中等 | 订单详情，多表 JOIN |
| `GET /api/carts` | 读 | 中等 | 购物车，关联商品信息 |
| `GET /api/offers` | 读 | 中等 | 报价列表，关联商品 |
| `GET /api/preorders` | 读 | 中等 | 预订单列表，JOIN |
| `GET /api/products/:id/option-groups` | 读 | 中等 | 产品选项，多表关联 |

**占比**: ~30% 用户端请求

#### 复杂查询（> 200ms）- 写操作

| Route | 操作 | 复杂度 | 说明 |
|-------|------|--------|------|
| `POST /api/orders/regular` | 写 | 复杂 | 创建订单，事务，多表写入 |
| `POST /api/orders/offer` | 写 | 复杂 | 创建报价订单，事务 |
| `POST /api/orders/preorder` | 写 | 复杂 | 创建预订单，事务 |
| `POST /api/carts` | 写 | 中等 | 更新购物车 |
| `PUT /api/carts/:id` | 写 | 中等 | 更新购物车项 |
| `POST /api/orders/:id/cancel` | 写 | 复杂 | 取消订单，事务，库存回退 |
| `POST /api/auth/register` | 写 | 简单 | 用户注册 |
| `POST /api/auth/login` | 读 | 简单 | 登录验证 |

**占比**: ~10% 用户端请求（写操作）

---

### CMS 端 API（30% 用量，读写 7:3）

#### 简单查询（< 50ms）- 读操作

| Route | 操作 | 复杂度 | 说明 |
|-------|------|--------|------|
| `GET /api/admin/products` | 读 | 简单 | 产品列表，分页 |
| `GET /api/admin/products/:id` | 读 | 简单 | 产品详情 |
| `GET /api/admin/orders` | 读 | 中等 | 订单列表，可能需要 JOIN |
| `GET /api/admin/orders/:id` | 读 | 中等 | 订单详情，多表 JOIN |
| `GET /api/admin/payment-records` | 读 | 中等 | 支付记录，可能复杂过滤 |
| `GET /api/admin/users` | 读 | 简单 | 用户列表 |

**占比**: ~50% CMS 端请求（读操作）

#### 中等查询（50-200ms）- 读操作

| Route | 操作 | 复杂度 | 说明 |
|-------|------|--------|------|
| `GET /api/admin/orders/stats` | 读 | 复杂 | 订单统计，聚合查询 |
| `GET /api/admin/equipment-depreciation/report` | 读 | 复杂 | 折旧报表，复杂计算 |
| `GET /api/admin/equipment-depreciation/report/:year/summary` | 读 | 复杂 | 报表汇总，聚合 |

**占比**: ~20% CMS 端请求（读操作）

#### 复杂查询（> 200ms）- 写操作

| Route | 操作 | 复杂度 | 说明 |
|-------|------|--------|------|
| `POST /api/admin/products` | 写 | 复杂 | 创建产品，多表写入，图片上传 |
| `PUT /api/admin/products/:id` | 写 | 复杂 | 更新产品，事务 |
| `PUT /api/admin/orders/:id/status` | 写 | 复杂 | 更新订单状态，事务，库存操作 |
| `POST /api/admin/equipment-depreciation/generate-report` | 写 | 非常复杂 | 生成折旧报表，大量计算和写入 |
| `POST /api/admin/equipment-depreciation/commit-report` | 写 | 复杂 | 提交报表，事务 |
| `POST /api/admin/products/batch-update-stock` | 写 | 复杂 | 批量更新库存，事务 |
| `PUT /api/admin/products/:id/stock` | 写 | 中等 | 更新库存 |

**占比**: ~30% CMS 端请求（写操作）

---

## 📈 连接数需求计算

### 假设场景

**总请求量**: 100 请求/秒（单任务）

**用户端（70 请求/秒）**:
- 读操作: 63 请求/秒（90%）
- 写操作: 7 请求/秒（10%）

**CMS 端（30 请求/秒）**:
- 读操作: 21 请求/秒（70%）
- 写操作: 9 请求/秒（30%）

### 查询时间分布

**用户端**:
- 简单读（60%）：50ms
- 中等读（30%）：100ms
- 写操作（10%）：150ms

**CMS 端**:
- 简单读（50%）：50ms
- 中等读（20%）：150ms
- 复杂读（10%）：300ms
- 写操作（30%）：200ms

### 连接数计算

#### 用户端连接数需求

```
读连接数：
- 简单读: (63 × 0.6 × 0.05) / 0.85 = 2.2 连接
- 中等读: (63 × 0.3 × 0.1) / 0.85 = 2.2 连接
- 总计读连接: ~5 连接

写连接数：
- 写操作: (7 × 0.15) / 0.85 = 1.2 连接

用户端总连接数: ~6-7 连接
```

#### CMS 端连接数需求

```
读连接数：
- 简单读: (21 × 0.5 × 0.05) / 0.85 = 0.6 连接
- 中等读: (21 × 0.2 × 0.15) / 0.85 = 0.7 连接
- 复杂读: (21 × 0.1 × 0.3) / 0.85 = 0.7 连接
- 总计读连接: ~2 连接

写连接数：
- 写操作: (9 × 0.2) / 0.85 = 2.1 连接

CMS 端总连接数: ~4-5 连接
```

#### 综合连接数需求

```
单任务总连接数 = 用户端 + CMS 端
= 6-7 + 4-5
= 10-12 连接

考虑峰值和缓冲: 12-15 连接
```

---

## 🎯 推荐配置

### 方案 1: 统一连接池（当前方案）

**配置**: 所有任务使用相同的连接池大小

```typescript
// database.config.ts
extra: {
  max: 12,  // 从 10 增加到 12
  min: 3,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
}
```

**优点**:
- 简单，易于管理
- 适合混合负载

**缺点**:
- 无法针对不同场景优化

**适用场景**: 当前配置（用户端和 CMS 端共享）

---

### 方案 2: 环境变量配置（推荐）

**配置**: 通过环境变量动态调整连接数

```typescript
// database.config.ts
const env = configUtil.getEnvironment();
const dbConfig = configUtil.getDatabaseConfig();

// 从环境变量读取连接池大小，默认 12
const maxConnections = parseInt(process.env.DB_MAX_CONNECTIONS || '12', 10);
const minConnections = parseInt(process.env.DB_MIN_CONNECTIONS || '3', 10);

const baseConfig: PostgresConnectionOptions = {
  // ... existing config ...
  extra: {
    max: maxConnections,
    min: minConnections,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
};
```

**ECS 任务定义**:
```yaml
# 用户端任务（如果分离部署）
Environment:
  - Name: DB_MAX_CONNECTIONS
    Value: "10"  # 用户端：读多写少，10 个足够

# CMS 端任务（如果分离部署）
Environment:
  - Name: DB_MAX_CONNECTIONS
    Value: "8"   # CMS 端：写操作多，但总量少，8 个足够
```

**优点**:
- 灵活，可根据实际负载调整
- 支持不同环境不同配置

**缺点**:
- 需要监控和调优

---

### 方案 3: 读写分离（未来优化）

**配置**: 为读操作和写操作使用不同的连接池

```typescript
// 读连接池（用于查询）
const readConfig = {
  ...baseConfig,
  extra: {
    max: 10,  // 读操作连接池
  }
};

// 写连接池（用于写入）
const writeConfig = {
  ...baseConfig,
  extra: {
    max: 5,   // 写操作连接池
  }
};
```

**优点**:
- 精确控制读写连接
- 可以指向 Read Replica（读）和 Primary（写）

**缺点**:
- 需要应用层路由
- 架构更复杂

---

## 📊 最终推荐

### 当前配置优化

**推荐连接数**: **12 个连接/任务**

**理由**:
1. 用户端（70%）：需要 6-7 个连接
2. CMS 端（30%）：需要 4-5 个连接
3. 总计：10-12 个连接
4. 考虑峰值和缓冲：12 个连接

**配置更新**:

```typescript
// xituan_backend/src/shared/infrastructure/database.config.ts
extra: {
  max: 12,                    // 从 10 增加到 12（基于分析）
  min: 3,                     // 从 2 增加到 3
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
}
```

### 监控指标

部署后监控以下指标：

1. **连接数使用率**
   ```
   目标: < 80% (即 < 10 个连接在使用)
   告警: > 90% (即 > 11 个连接在使用)
   ```

2. **查询等待时间**
   ```
   目标: < 50ms (平均)
   告警: > 200ms (平均)
   ```

3. **连接等待队列**
   ```
   目标: 0 个等待
   告警: > 5 个等待
   ```

### 扩展建议

**如果连接数经常满载（> 90%）**:
1. 优化慢查询（添加索引，优化 JOIN）
2. 增加连接数到 15
3. 考虑升级 RDS（db.t3.small）

**如果查询慢（> 200ms）**:
1. 分析慢查询日志
2. 添加缺失索引
3. 优化复杂查询
4. 考虑添加缓存（Redis）

---

## 🔧 实施步骤

### 1. 更新连接池配置

```typescript
// xituan_backend/src/shared/infrastructure/database.config.ts
extra: {
  max: 12,  // 更新为 12
  min: 3,   // 更新为 3
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
}
```

### 2. 部署并监控

```bash
# 部署新配置
npm run deploy:app

# 监控连接数
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name DatabaseConnections \
  --dimensions Name=DBInstanceIdentifier,Value=xituan-postgres-production \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average,Maximum
```

### 3. 根据监控数据调整

- 如果连接数 < 8：可以减少到 10
- 如果连接数 > 11：需要增加到 15 或优化查询

---

## 📝 总结

### 分析结果

| 场景 | 连接数需求 | 推荐配置 |
|------|-----------|---------|
| **用户端（70%）** | 6-7 连接 | 10 连接（含缓冲） |
| **CMS 端（30%）** | 4-5 连接 | 8 连接（含缓冲） |
| **综合（当前）** | 10-12 连接 | **12 连接** ✅ |

### 关键发现

1. **用户端主要是读操作**（90%），查询相对简单，连接需求较低
2. **CMS 端写操作较多**（30%），但总量少，连接需求中等
3. **当前 10 个连接可能略紧**，建议增加到 12 个
4. **查询复杂度是关键**：优化慢查询可以减少连接需求

### 下一步

1. ✅ 更新连接池配置为 12
2. ✅ 部署并监控
3. ⏳ 根据实际数据调整
4. ⏳ 优化慢查询（如果发现）

