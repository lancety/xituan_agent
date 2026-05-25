# Redis 铺垫 — 当前现状（as-is）

Last updated: 2026-05-24

**结论**：backend **尚未** 引入 Redis 客户端或 `REDIS_URL`；已通过 **缓存抽象、HTTP 条件 GET、进程内 LRU、运维 reload** 为多实例 ElastiCache 预留切换点。

**开发 / 部署规范（to-be）**：见 [valkey-development.md](./valkey-development.md)。

---

## 1. 共享缓存抽象（可换 Redis 实现）

| 文件 | 说明 |
|------|------|
| `xituan_backend/src/shared/cache/cache-adapter.type.ts` | `ICacheAdapter`: `get` / `set` / `delete`，**全部为 async**，便于 Redis |
| `xituan_backend/src/shared/cache/in-memory-cache.adapter.ts` | 默认实现；条目 TTL **5 分钟** |
| `xituan_backend/src/shared/cache/index.ts` | `getDefaultCache()` 单例，注释写明日后换 Redis adapter |

**`ICacheAdapter` 业务调用方**：

| 服务 | Key | TTL | 说明 |
|------|-----|-----|------|
| `MerchantSettingService` | `{merchantId}` / `{merchantId}:{category}` | 默认 5 min（adapter 默认） | 构造可注入 `ICacheAdapter` |
| `DashboardSectionsService` | `dashboard:v1:{merchantId}` | **90 s** | CMS 仪表盘整包响应缓存 |

Key 规则（商户设置）：

- 全商户列表：`{merchantId}`
- 单分类：`{merchantId}:{category}`（`epMerchantSettingCategory`）

---

## 2. Metadata Schema — 进程 LRU（计划 Redis L2）

**实现**：`ProductMetadataSchemaService`（`product-metadata-schema.service.ts`）

| 参数 | 值 |
|------|-----|
| Key | `{merchantId}:{categoryId}` |
| 容量 | 最多 **200** 条，超出删最旧 |
| TTL | **5 分钟**（`CACHE_TTL_MS`） |
| Value | `{ schemaVersion, fields }` |

**失效**：`ProductMetadataSchemaService.bustCache()` 清空整个 Map。调用方包括：

- 商品 metadata CRUD / 分类迁移（`product.service.ts`）
- 平台 metadata 管理（`platform-metadata-admin.service.ts`）
- Metadata 迁移任务完成（`metadata-migration-task.service.ts`）

**计划 Redis L2**（见 `xituan_backend/todo/metadata-schema-etag-redis-l2.md`）：

- Key 示例：`metadataSchema:{merchantId}:{categoryId}`
- Value 与现 LRU 一致，保证 **`schemaVersion` 与 ETag 一致**
- `REDIS_URL` 有则 Redis，无则保持 LRU（与商品 metadata 总方案一致）

---

## 3. HTTP 条件缓存（ETag / 304）— 与 Redis 正交

**工具**：`http-etag.util.ts`  
注释：**加 Redis 后 HTTP 契约不变**；客户端已发 `If-None-Match`。

**CORS**（`app.ts`）：已允许 `If-None-Match`、`If-Modified-Since`。

### 3.1 已暴露 API

| 方法 | 路径 | 行为 |
|------|------|------|
| GET | `/api/products/metadata-schema?categoryId=` | 公开（需 `X-Merchant-Id`）；`ETag: "{schemaVersion}"`；匹配 → **304** 无 body |
| GET | `/api/admin/products/metadata-schema?categoryId=` | CMS 同上 |
| POST | `/api/admin/products/:id/metadata-category-change-preview` | 设置 `targetSchemaVersion` 的 ETag；正常返回 200 + body |
| GET | `/api/entityFields/:entityType` | 可选 `categoryId`；有 schema 时 ETag/304（打印模板字段元数据） |

`schemaVersion`：合并有效 schema 的 **SHA-256 指纹**（`fingerprintFields`），非 Redis 机制，但是缓存命中/失效的核心依据。

### 3.2 前端已对接条件 GET

| 应用 | 位置 |
|------|------|
| Site | `site-api.util.ts` → `products/metadata-schema` |
| 微信小程序 | `wechat-product-metadata-schema.util.ts` + `product-metadata-schema-cache.util.ts` |
| CMS | 通过 admin products metadata-schema（与 backend 路由一致） |

---

## 4. CMS Dashboard — `ICacheAdapter`（此前 devGuide 未写，代码已存在）

| 方法 | 路径 | 缓存 |
|------|------|------|
| GET | `/api/admin/dashboard` | `DashboardSectionsService.buildDashboard` |

实现要点（`dashboard-sections.service.ts`）：

- `getDefaultCache()`，key **`dashboard:v1:${merchantId}`**，TTL **`CACHE_TTL_MS = 90_000`（90 秒）**
- 命中则直接返回 `iDashboardResponse`；未命中则 `buildDashboardUncached` 后 `set`
- **无** 按业务事件的 `cache.delete`；仅依赖 TTL 过期（订单/结算/消息变更后最多 90s 内可能仍为旧数据）
- 区块权限仍依赖 **`SubscriptionFeatureCacheService`**（进程内 60s，与 Redis 无关）

响应类型注释见 `xituan_codebase/typing_api/dashboard.type.ts`（`iDashboardSectionEnvelope` 为 cache-friendly 分段结构）。

换 Redis 时：与商户设置相同，换 `getDefaultCache()` 实现即可在多 ECS 任务间共享 dashboard 快照；若需更实时，需另加 invalidate（订单完成、结算、OpenIM 未读等）或缩短 TTL。

---

## 5. 商户 / 平台设置缓存

### 5.1 商户设置 — `ICacheAdapter`

| 方法 | 路径 | 缓存 |
|------|------|------|
| GET | `/api/merchant-settings` | `getAllByMerchantId` |
| GET | `/api/merchant-settings/:category` | `getByMerchantAndCategory` |
| GET | `/api/admin/merchant-settings` | 管理端读库（列表/单类响应结构） |
| PUT | `/api/admin/merchant-settings/:category` | 写后 invalidate |
| POST | `/api/admin/merchant-settings/reload` | `invalidateCache(merchantId, category?)` |

CMS API 封装：`xituan_cms/src/lib/api/merchant-setting.api.ts`（`reload`）。

### 5.2 平台设置 — 单例内存 Map

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/platform-settings` | 公开读 ORDER 等 |
| GET | `/api/admin/platform-settings` | 平台角色 |
| GET | `/api/admin/platform-settings/cache-status` | 各分类是否已加载到内存 |
| POST | `/api/admin/platform-settings/reload` | `reloadSetting` / `reloadAllSettings` |

**未** 使用 `ICacheAdapter`；多实例时各 ECS 任务各自一份 Map（与 schema LRU 相同问题）。

---

## 6. 其他进程内缓存（非 Redis 主线）

| 组件 | 用途 | 是否计划 Redis |
|------|------|----------------|
| `SubscriptionFeatureCacheService` | 订阅功能码 60s TTL | 否（middleware 热路径，可后续评估） |
| `addressGeocodeLruCacheUtil` | Google 地理编码 | 否（省外部 API） |
| `activityFulfillmentRouteLruCacheUtil` | 活动配送路线 | 否 |
| `PlatformSettingService.globalSettings` | 平台 ORDER / PSP | 可与商户设置一并评估 |

相关 CMS API（LRU 说明见响应类型注释）：

- `GET /api/admin/orders/activity-fulfillment-driving-route`
- `POST /api/admin/orders/geocode-delivery-addresses`

---

## 7. 依赖与运维

- `package-lock.json` 中 TypeORM 可选 peer 含 `ioredis` / `redis`，**应用代码未引用**。
- 本地开发（方案文档）：`redis:7-alpine` + `REDIS_URL=redis://127.0.0.1:6379`；生产 **Amazon ElastiCache**（如 `ap-southeast-2`）。
- 部署：当前 **无** Redis 相关 env 注入（对比 OpenIM 栈内 Redis 与业务缓存无关）。

---

## 8. 待办（backend todo 摘要）

来源：`xituan_backend/todo/metadata-schema-etag-redis-l2.md`

| 优先级 | 项 |
|--------|-----|
| P0 | Redis L2 挂在 `getEffectiveMetadataSchema` |
| P0 | 绑定/模板/属性变更时失效策略（delete vs TTL vs write-through） |
| — | `ICacheAdapter` Redis 实现 + `getDefaultCache()` 按 env 选择 |

---

## 9. 关键代码索引

```
xituan_backend/src/shared/cache/
xituan_backend/src/shared/utils/http-etag.util.ts
xituan_backend/src/domains/metadata/services/product-metadata-schema.service.ts
xituan_backend/src/domains/merchant/services/merchant-setting.service.ts
xituan_backend/src/domains/dashboard/services/dashboard-sections.service.ts
xituan_backend/src/domains/dashboard/routes/admin-dashboard.routes.ts
xituan_backend/src/domains/platform-setting/services/platform-setting.service.ts
xituan_backend/todo/metadata-schema-etag-redis-l2.md
```
