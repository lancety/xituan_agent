# Metadata Visibility / Facet / Search Facade 整体方案（稳定版）

Last updated: 2026-04-25

## 1. 目标与结论

- 目标：统一 metadata 在 `CMS / Site / 打印 / 搜索` 的可见与可筛选语义，避免后续接 OpenSearch 时接口返工。
- 结论：现在**不必**立刻完成 OpenSearch 落地，但必须先固定三件事：
  - **统一 façade**（调用入口稳定）
  - **稳定键契约**（`jsonKey/storage_key`、facet key、类型约束稳定）
  - **outbox/projection 对齐**（事件与读模型同步链路稳定）

## 2. 当前状态（2026-04-25）

- 已有：
  - Site 列表支持 `includeFacets`，后端通过 `ProductSearchService` 返回分页 + facet 计数。
  - facet 维度已从硬编码改为平台/商户属性配置：`site_facet_enabled`。
  - `product_metadata_search_index_outbox` 与 `product_metadata_search_index` 表已存在（Phase 3 预留）。
- 未完成：
  - facet 交互筛选（用户点击 bucket 反向过滤列表）。
  - visibility 统一语义（目前等价于“site facet 开关子集”，不是完整 visibility 体系）。
  - OpenSearch 读路径（目前仍 PG）。

## 3. 统一 Visibility 语义（建议定稿）

## 3.1 范围拆分

- `visibleInCms`：CMS 表单/详情可见
- `visibleInSite`：Site 展示可见
- `visibleInPrint`：打印模板字段可见
- `facetInSite`：Site 列表允许 facet 聚合
- `indexInSearch`：是否进入公开搜索索引文档（PG projection/OpenSearch）

> 当前已实现的是 `facetInSite` 的近似字段：`site_facet_enabled`。

## 3.2 数据层策略（兼容演进）

- Phase A（当前）：
  - 保留 `site_facet_enabled` 作为站点 facet 开关。
- Phase B（后续）：
  - 增加统一 visibility 结构（列或 JSON），并定义映射规则：
    - `facetInSite = site_facet_enabled`（迁移期）
    - 逐步替换调用方读取统一 visibility。

## 4. Facade 稳定契约（必须先固定）

## 4.1 后端唯一入口

- 保持 `ProductSearchService` 为唯一搜索聚合入口。
- Controller 只做参数解析与响应包装，不直接写 SQL/DSL。

## 4.2 API 契约（建议冻结）

- 请求：
  - `page/limit/sort/categoryId/keyword`
  - `includeFacets`
  - 预留：`metadataFilters`（后续启用）
- 响应：
  - `items/total/page/pageSize/totalPages`
  - `facets[]`（仅当 `includeFacets=true`）
  - bucket 结构固定：`{ value: string | null, count: number }`

## 4.3 稳定键契约

- facet 维度 key 使用 `jsonKey`（即 `storage_key`）。
- key 必须 camelCase、服务端白名单校验（禁止用户输入直接拼 SQL/DSL key）。
- facet 仅允许类型：`STRING | ENUM | NUMBER`。

## 5. Outbox / Projection 对齐（必须准备）

## 5.1 统一写入时机

- 产品主写成功后，通过 outbox 触发 projection 更新（异步、幂等）。
- projection 更新顺序严格晚于 metadata 迁移稳定态，避免旧 key 污染 facet。

## 5.2 PG 与 OpenSearch 双实现对齐

- PG 实现：读 `products` 或 `product_metadata_search_index`（逐步迁移到 projection）。
- OpenSearch 实现：读取同一 projection 语义字段（同 key、同类型、同 visibility 规则）。
- 同一 façade 返回同一响应结构，调用方无感切换。

## 6. 是否“现在就做”的决策

- 现在必须做（低返工）：
  - 冻结 façade 契约（请求/响应结构）。
  - 冻结键契约（`jsonKey` + 类型 + 校验）。
  - 固化 outbox/projection 更新规范（幂等、失败重试、延迟容忍）。
- 现在可不做（按你当前决策）：
  - 交互式 facet 筛选（等待数据规模成熟）。
  - OpenSearch 接入与索引运维。
  - 完整 visibility 统一字段落库（先保留 `site_facet_enabled`）。

## 7. 分阶段落地清单（执行版）

- P1（当前迭代）
  - [x] 站点 facet 开关配置化（平台+商户）
  - [x] ProductSearchService façade 化
  - [x] 设计冻结：请求/响应与键契约写入 devGuide（本文件）
- P2（数据成熟后）
  - [ ] 开启 `metadataFilters` 请求参数与列表过滤逻辑
  - [ ] facet 点击 -> URL 状态 -> 服务端过滤闭环
  - [ ] `visibility` 统一字段/结构设计并迁移
- P3（搜索升级）
  - [ ] 查询主路径切到 projection（PG）
  - [ ] OpenSearch adapter 上线（灰度）
  - [ ] PG/OpenSearch A/B 对账与回滚预案

## 8. 风险与防返工规则

- 禁止在页面或 controller 直接拼 metadata facet SQL。
- 禁止前端硬编码 facet key 与 value type。
- 禁止在切 OpenSearch 时改 API 返回结构（只能改实现）。
- 任何 visibility 新语义必须在 schema 合并层统一解释，不允许多处各自判断。
