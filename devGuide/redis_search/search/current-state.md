# Search / OpenSearch 铺垫 — 当前现状（as-is）

Last updated: 2026-05-24

**结论**：搜索读路径 **全部为 PostgreSQL**（物化表 + `tsvector` + SQL 聚合 facet）；**未** 部署 OpenSearch/Elasticsearch。通过 **`ProductSearchService` 门面**、**稳定响应类型**、**outbox → projection** 为日后切换搜索引擎预留。

---

## 1. 两条搜索产品线

| 线 | 场景 | 存储 | 对外 API |
|----|------|------|----------|
| **A. 平台首页 / 全局商品名** | Site 首页块、跨商户关键词 | `platform.homepage_promotion_items`、`platform.product_search_index` | `/api/public/homepage/*` |
| **B. 商户店内列表 + metadata facet** | 单商户商品列表、facet 计数 | `merchant.products`（列表）、`merchant.product_metadata_search_index`（投影，facet 逐步对齐） | `GET /api/products` |

OpenSearch 接入时：**B 线** 优先换读实现；**A 线** 可继续 PG 或第二索引，需单独评估。

---

## 2. 数据表与迁移

| 表 | Schema | 迁移参考（stable） | 用途 |
|----|--------|-------------------|------|
| `homepage_promotion_items` | `platform` | `1710000000246_platform_homepage_cache_tables.sql` | 仅 **preorder_promote**、**offer** 块排序列表 |
| `product_search_index` | `platform` | 同上 + `1710000000254_product_search_index_add_updated_at.sql` | 商品名 **`name_tsv`** GIN、分类、商户、`status`、`updated_at` |
| `product_metadata_search_index` | `merchant` | `1710000000282_product_metadata_phase3_core.sql` | metadata 扁平投影（`metadata` jsonb、`effective_schema_revision` 等） |
| `product_metadata_search_index_outbox` | `merchant` | 同上 | 异步刷新投影；状态 PENDING/RUNNING/DONE/FAILED/DEAD |

商品进入平台搜索索引条件（cron）：`is_regular_sale = true` 等（见 `homepage-cache-cron.service.ts` 与 migration `1710000000250`）。

### Visibility 列（索引/facet 语义）

Migration `1710000000286`（及后续）：`visible_in_cms`、`visible_in_site`、`visible_in_print`、`facet_in_site`、`index_in_search`。  
Facet 白名单读取 `facetInSite` + 类型 STRING/ENUM/NUMBER（`getFacetEligibleJsonKeysForProductList`）。

---

## 3. 后台同步（非 HTTP）

| Cron | 周期 | 职责 |
|------|------|------|
| `HomepageCacheCronService` | 启动立即 + **每 15 分钟** | TRUNCATE/INSERT `homepage_promotion_items`；重建 `product_search_index`（约 top 1000，`plainto_tsquery` 用 `simple` 配置） |
| `MetadataSearchIndexCronService` | **每分钟** | `processPending(100)` 消费 outbox |

注册：`app.ts` → `app.start().then(...)`。

### Outbox 写入时机（商品主路径）

`product.service.ts` 在创建/更新/恢复/批量迁移分类等成功后调用 `enqueueMetadataSearchOutbox`：

- 取当前 `getEffectiveMetadataSchema` → `schemaVersion`
- `MetadataSearchIndexOutboxService.enqueue(productId, schemaVersion)`
- **失败只打日志**，不阻塞写库

Worker：`refreshProjection` → `UPSERT merchant.product_metadata_search_index`（占位实现已落地，非 stub 空操作）。

---

## 4. HTTP API（搜索相关）

### 4.1 公开首页（无 auth）

| 方法 | 路径 | 查询参数 | 实现要点 |
|------|------|----------|----------|
| GET | `/api/public/homepage/promotion-items` | `blockType`, `limit`, `offset` | `preorder_promote` / `offer` → `homepage_promotion_items`；`product` → `product_search_index` 再批量拉 merchant.products |
| GET | `/api/public/homepage/search` | `q`, `categoryId?`, `limit` | `name_tsv @@ plainto_tsquery('simple', $1)` + `ts_rank` |

中间件：`clientKindMiddleware`、`merchantCheckoutCapableMiddleware`（过滤不可下单商户）。

**前端**：`xituan_site/src/lib/api/site-api.util.ts`（`public/homepage/search`）。

### 4.2 商户店内列表 + Facet 门面（核心 OpenSearch 预备）

| 方法 | 路径 | 关键参数 | 门面 |
|------|------|----------|------|
| GET | `/api/products` | `page`, `limit`, `categoryId`, `keyword`, `sortBy`, **`includeFacets=true`** | `ProductSearchService.searchStoreProductPageWithOptionalFacets` |

**响应契约**（冻结，见 `product-search.type.ts`）：

```ts
interface iProductSearchFacadeListData<TItem> {
  items: TItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  facets?: iProductMetadataStringFacet[]; // jsonKey + buckets[{ value, count }]
}
```

- `includeFacets=false`：仅分页列表（仍经门面，内部 `getProducts` + 多语言处理）。
- `includeFacets=true`：在同一 filter  scope 下 SQL 聚合 facet（**不**分页截断 facet 统计）；维度 key = **`jsonKey`** 白名单。

**类型共享**：`xituan_codebase/typing_api/products.type.ts` → `includeFacets?: boolean`（site/cms/wechat 子模块已同步）。

**前端**：

- Site：`site-api.util.ts` 商品列表传 `includeFacets`
- 微信小程序 / CMS：子模块含 `includeFacets` 类型；列表是否传参以实现为准

### 4.3 Metadata schema（搜索辅助，非搜索引擎）

| GET | `/api/products/metadata-schema` | facet 维度来源、展示 schema |

### 4.4 CMS 运维 — search index outbox

挂载：`/api/admin/metadata-migrations`（需商户 PRODUCTS 订阅特性）

| 方法 | 路径 | Body |
|------|------|------|
| POST | `/search-index-outbox` | `{ productId, effectiveSchemaRevision? }` |
| POST | `/search-index-outbox/process` | `{ limit?: number }` 默认 100 |

### 4.5 尚未走搜索门面

| API | 说明 |
|-----|------|
| `GET /api/admin/products` | 直接 `productService.getProducts`，无 `includeFacets` |
| 交互式 `metadataFilters` | **未实现**；TODO 延后至 metadata 数据成熟 |

---

## 5. 服务层结构

```
ProductController.getProducts
  └─ ProductSearchService.searchStoreProductPageWithOptionalFacets
       ├─ ProductService.getProducts + processMultilingualData  → list
       └─ (if includeFacets)
            ├─ ProductMetadataSchemaService.getFacetEligibleJsonKeysForProductList
            └─ ProductRepository.aggregateMetadataStringFacetsForListing

HomepageCacheController
  └─ HomepageCacheService
       ├─ getPromotionItems → platform 表 + merchant 批量详情
       └─ searchProducts → product_search_index + 批量详情

MetadataSearchIndexOutboxService
  └─ enqueue / processPending / refreshProjection
```

**原则**（devGuide [metadata_visibility_facet_facade](../metadata_visibility_facet_facade_整体方案_2026-04-25.md)）：

- Controller 不直接写搜索 DSL/SQL 片段（facet 聚合在 repository，仍经门面编排）。
- 换 OpenSearch 时只换 `ProductSearchService`（及可选 homepage 读实现），**不改** `iProductSearchFacadeListData`。

---

## 6. 与 OpenSearch 的差异（规划备忘）

| 能力 | 当前 PG | 未来 OpenSearch |
|------|---------|-----------------|
| 店内列表排序/筛选 | `products` 表查询 | 索引文档 + 同一 filter 语义 |
| Facet 计数 | SQL `aggregateMetadataStringFacetsForListing` | 索引 aggregation，bucket 形状不变 |
| 全局关键词 | `product_search_index.name_tsv` | 索引 `text` 字段 + 相关性 |
| Metadata 筛选 | 未对外暴露 `metadataFilters` | 索引 mapping 对齐 `jsonKey` 类型 |
| 文档 ID | `merchant_id` + `product_id` | 建议 `_id = productId`，查询必带 `merchantId` |

**明确不做的事（当前阶段）**：

- 在 controller 散落 OpenSearch DSL
- 破坏 `items/total/page/pageSize/totalPages/facets` 外形
- 在 metadata 迁移未完成前大量写入错误 projection

---

## 7. 待办（与 backend todo / devGuide 对齐）

| 项 | 状态 |
|----|------|
| `ProductSearchService` 门面 + `includeFacets` | 已上线 |
| `product_metadata_search_index` + outbox + cron | 已上线（投影字段随 visibility 演进） |
| 交互式 facet 过滤（`metadataFilters`） | 延后 |
| OpenSearch 运行时 / 索引运维 | 延后 |
| CMS 列表接入门面 | 可选，未做 |

来源：`xituan_backend/todo/metadata-schema-etag-redis-l2.md`（P1 OpenSearch readiness）、[metadata_visibility_facet_facade](../metadata_visibility_facet_facade_整体方案_2026-04-25.md)。

---

## 8. 关键代码索引

```
xituan_backend/src/domains/product/services/product-search.service.ts
xituan_backend/src/domains/product/types/product-search.type.ts
xituan_backend/src/domains/homepage-cache/
xituan_backend/src/domains/metadata/services/metadata-search-index-outbox.service.ts
xituan_backend/src/domains/metadata/services/metadata-search-index-cron.service.ts
xituan_backend/migrations_stable/1710000000246_platform_homepage_cache_tables.sql
xituan_backend/migrations_stable/1710000000282_product_metadata_phase3_core.sql
```
