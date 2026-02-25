# 多用户/多租户系统重构进展分析

基于 agent devGuide、docs 与 xituan_backend 最近 git 提交的回顾，整理当前进度与后续建议。

---

## 一、参考文档位置

| 类型 | 路径 | 说明 |
|------|------|------|
| 实施指南 | `xituan_agent/docs/multi-tenant/multi-tenant-platform-implementation.md` | 多租户改造实施步骤（阶段 1~4） |
| 数据库设计 | `xituan_agent/docs/multi-tenant/multi-tenant-database-design.md` | Schema 分离 vs Tenant ID 方案 |
| 架构分析 | `xituan_agent/docs/multi-tenant/multi-tenant-architecture-analysis.md` | 方案对比与推荐 |
| 优化指南 | `xituan_agent/docs/multi-tenant/database-optimization-guide.md` | 分区与系统级表处理 |
| 发布计划 | `xituan_agent/devGuide/multi-tenant-development-release-plan.md` | 当前为空，未填写 |
| 分区与归档 | `xituan_agent/devGuide/multi-tenant-table-partitioning-and-archiving.md` | 表分区与归档 |

---

## 二、已完成的改造（当前进度）

### 2.1 数据库（阶段 1 基础改造）

- **Schema 拆分**（迁移 `1710000000221_split_schemas_platform_and_merchant.sql`）：
  - 已创建 `platform`、`merchant` schema。
  - `platform.merchants`、`platform.merchant_subscriptions` 已建。
  - `platform_settings`、用户相关表已迁入 `platform`。
  - 业务表已迁入 `merchant` 并添加 `merchant_id`，默认商户 `DEFAULT`（UUID 固定）用于迁移。
- **实体**：Merchant、MerchantSubscription 已存在；各业务实体已带 `merchantId` 字段。
- **1 人 1 商户**：`platform.user_merchants` 表对 `user_id` 有唯一约束，当前业务为**仅 1 人 1 商户**；无需「当前商户」切换与商户选择器，JWT 带唯一 merchantId 即可。**约定**：user_merchants 仅存商户**内部成员**与 user 的关联，不存商户–顾客关系；商户–顾客若需持久化则单独建表。

### 2.2 后端基础设施（阶段 2 代码改造 - 部分）

- **Request Context**：
  - `RequestContext`（merchantId、userId、requestId、timezone、language） + `AsyncLocalStorage`。
  - `request-context.middleware.ts`：从 Header（`X-Merchant-Id`）、query（`merchantId`）、params（`merchantId`）、以及预留的 `req.user.merchantId` 提取 merchantId；`optionalRequestContextMiddleware` 全局，各业务路由再挂 `requestContextMiddleware`。
  - `restoreRequestContextFromReq`：multer 等导致 AsyncLocalStorage 丢失时从 `req.__requestContext` 或 req 重建上下文，已在 news/offer/product/preorder-promotes 等 controller 的 multer 回调中使用。
- **Merchant 过滤**：
  - `MerchantRepositoryHelper`（`merchant-repository.base.ts`）：`applyMerchantFilter`、`requireMerchantId`、`assignMerchantId`、`addMerchantIdToWhere`。
  - 各业务 Repository 在查询中传入 `getMerchantId()` 并调用 Helper 加 `merchant_id` 条件；部分 Service（payment、inventory、alert-orders-payments）在写日志/发事件时使用 `getMerchantId()`。
- **路由与中间件**：
  - 需要商户的路由已挂载 `requestContextMiddleware` + `merchantRequiredMiddleware`（如 admin-news、admin-offer、product、admin-product、order、cart、partner、supplier、expense、revenue、equipment、printTemps、preorder、products-preorderable、tax-return-report、store-address、alert-orders-payments、equipment-depreciation 等）。
  - 全局使用 `optionalRequestContextMiddleware`，未强制所有请求带 merchantId。

### 2.3 测试与文档

- 集成测试：`data-isolation.integration.test.ts`、`migration.integration.test.ts`、news/offer/product 等 API 测试已加入 merchantId 依赖。
- 单元测试：`request-context.unit.test.ts`、`merchant-repository-helper.unit.test.ts`。
- `xituan_agent/devGuide/request-context-multer-workaround.md` 记录了 multer 导致上下文丢失的修复方式。

### 2.4 默认权限与商户成员级别（已实现构架，API 按点校验待接入）

- **商户成员级别**：`epMerchantRole`（ADMIN / MANAGER / PRODUCER / DELIVERY）存在 `xituan_codebase/typing_entity/merchant.enum.ts`；`platform.user_merchants.role` 存当前用户在该商户下的角色。
- **默认权限构架**：`shared/constants/merchant-role-permissions.ts` 定义：
  - `MERCHANT_PERMISSION_KEYS`：成员管理、订单、产品、设置等权限 key。
  - `DEFAULT_ROLE_PERMISSIONS`：按 `epMerchantRole` 映射到一组权限（ADMIN 全量，MANAGER/PRODUCER/DELIVERY 逐级减少）。
  - `getEffectivePermissions(role)`、`hasMerchantPermission(role, permission)`：按角色返回/校验权限，目前仅平台默认，无 DB 覆盖。
- **中间件**：`requireMerchantAccessMiddleware`（用户是否可访问该商户）、`requireMerchantAdminMiddleware`（是否商户 admin）已挂到部分路由；**按权限点的校验**（如 `requireMerchantPermission('order:list')`）尚未在路由层全面接入，即「默认权限矩阵已有，API 按成员级别细粒度校验」待后续接入。

### 2.5 最近一次大提交（908b0d7d）

- 提交信息：`migration - multi merchant system structure changes`（约 134 文件，+6583/-1460 行）。
- 内容：上述 schema 迁移、entity/repository/route 的 merchantId 改造、request-context、merchant-repository.base、测试与 multer 恢复上下文等，均在该提交中落地。

---

## 三、尚未完成或待加强的部分

### 3.1 商户识别与登录（高优先级）

- **现状**：merchantId 仅来自 Header/query/params；`req.user.merchantId` 已预留但 **JWT/登录未写入 merchantId**。
- **缺口**：
  - 登录接口未在 token 或 session 中绑定当前操作商户。
  - 用户与商户关系未在「用户-商户」维度建模（如 platform 用户可关联多个商户、当前选中商户）。
- **建议**（与实施指南阶段 2 一致）：
  - 定义「用户-商户」关系（如 `platform.user_merchant` 或通过现有表扩展），支持多商户与“当前商户”。
  - 登录/切换商户时写入 `merchantId` 到 JWT payload 或 session，并让 `request-context.middleware` 优先使用 `req.user.merchantId`。
  - 可选：提供「当前商户」查询接口，供前端存贮并后续请求带 `X-Merchant-Id` 或依赖 token。

### 3.2 前端（CMS）未传 merchantId（高优先级）

- **现状**：在 xituan_cms 中 **未检索到** `x-merchant-id`、`merchantId`、`X-Merchant` 的使用。
- **影响**：所有依赖 request context 的 API 若不经 Header/query/params 传 merchantId，会因 `requestContextMiddleware` 要求 merchantId 而 400，或依赖 optional 时无 merchantId 导致数据/行为异常。
- **建议**：
  - 登录或选择商户后，在前端统一设置 `X-Merchant-Id`（如 axios 拦截器）。
  - 或后端在 JWT 中提供 merchantId，前端仅带 token，由 `request-context.middleware` 从 `req.user.merchantId` 读取（需先完成 3.1）。

### 3.3 默认商户与多商户切换（含「当前商户」与商户选择器）

- **现状**：**目前仅 1 人 1 商户**（`user_merchants.user_id` 唯一）；迁移中仅插入默认商户 `code = 'DEFAULT'`，现有数据均挂在该商户下。
- **「当前商户」查询/切换、商户选择器** 指：① 当前操作商户的查询接口；② 一人多商户时的切换接口；③ CMS 顶栏商户选择器 UI。因当前为 1 人 1 商户，可暂不实现切换与选择器，按需迭代。
- **建议**：商户 CRUD、列表、审核已在 Platform；CMS 侧「当前商户」/选择器待多人多商户时再做。

### 3.4 权限与多租户结合（中优先级）

- **现状**：`permission-system-design.md` 描述角色/权限；merchant-access 中间件已按「用户是否属于该商户」做越权防护。
- **决策**：权限与商户的结合**依赖商户成员级别**（用户在某商户下的角色）。**当前阶段**：仅设定默认权限（按角色给固定权限），不做「用户×商户×可配置权限」的细粒度建模。**后续**：需要时再在 CMS 增加商户内部权限管理页，由商户自行配置成员权限。
- **建议**：保持现有「角色 + 商户成员」的默认权限即可；跨商户越权已由 merchantAccessMiddleware 等保证。

**API 按权限校验工作量估算**（在路由层接入 `hasMerchantPermission`，按商户成员角色返回 403）：

| 事项 | 工作量 | 说明 |
|------|--------|------|
| 新增中间件 `requireMerchantPermission(permissionKey)` | 0.5 人日 | 在 requireMerchantAccess 之后取 `user_merchants.role`，调 `hasMerchantPermission(role, permissionKey)`；super_admin 放行。与现有 requireMerchantAdminMiddleware 同构，复用 getRoleForUserInMerchant。 |
| 权限与路由映射 | 0.5～1 人日 | 为每个使用 requireMerchantAccess 的路由/路由组指定一个 MERCHANT_PERMISSION_KEYS。当前约 12 个 key（member/order/product/setting）；部分领域（revenue、expense、partner、equipment、printTemps、tax 等）需约定归属（如 SETTING_READ/SETTING_WRITE 或新增 key）。 |
| 在各路由文件挂载中间件 | 1～1.5 人日 | 约 20 个路由文件、约 120+ 个路由方法；多数可按「路由组」挂同一 permission（如整组 order 用 order:list，仅改状态用 order:update_status），实际约每文件 1～3 处改动。 |
| 联调与用例 | 0.5 人日 | 跑通现有集成测试；补充「无权限角色请求返回 403」的用例。 |
| **合计** | **约 2.5～3.5 人日** | 首次全量接入；若只先接订单/产品/成员/设置等核心，可缩到约 1.5～2 人日。 |

### 3.5 平台表与 PlatformRepository（已完成）

- **现状**：**已完成**。`PlatformRepositories`（`shared/infrastructure/platform.repository.ts`）统一提供 merchantRepository、userMerchantRepository、merchantJoinApplicationRepository、platformSettingRepository、userPermissionRepository；auth.service、merchant.service、merchant-member、platform-setting、UserPermissionService 等均经此入口访问 platform 表，无业务代码直接 getRepository(platform 表)。
- **决策**：platform schema 表均经 PlatformRepositories 访问，与「带 merchant_id 的业务 Repository」明确区分。

### 3.6 分区与性能（阶段 4，需要做）

- **现状**：当前为单表 + merchant_id 索引，未做分区。
- **决策**：分区**需要做**。按 `database-optimization-guide.md` 与 `multi-tenant-table-partitioning-and-archiving.md` 规划分区策略（如按 merchant_id 或时间），在约定阈值或规划节点实施。

### 3.7 devGuide 发布计划文档为空

- **现状**：`devGuide/multi-tenant-development-release-plan.md` 为空。
- **建议**：在后续规划中把「阶段划分、迭代顺序、验收标准」写进该文档，便于与实施指南对应。

---

## 四、接下来建议的优先级

| 顺序 | 事项 | 说明 |
|------|------|------|
| 1 | **前端 CMS 传 merchantId** | 在 CMS 登录/选商户后，所有请求带 `X-Merchant-Id`（或统一 query/params），确保现有 API 可用。若暂时只支持单商户，可前端写死默认商户 ID（与迁移中的 DEFAULT 一致）。 |
| 2 | **登录/JWT 与商户绑定** | 定义用户-商户关系；登录或切换商户时把 merchantId 写入 JWT（或 session）；中间件优先从 `req.user.merchantId` 取，减少前端显式传 Header。 |
| 3 | **商户管理 API 与“当前商户”** | 商户 CRUD、列表、当前商户查询/切换（含 CMS 商户选择器），按需迭代。 |
| 4 | **权限与 merchant 结合** | 当前采用默认权限（商户成员角色）；后续需时在 CMS 做商户内权限管理。 |
| 5 | **平台表与 PlatformRepository** | 有必要，目前优先迁移；抽象 PlatformRepository，platform schema 表统一经其访问。 |
| 6 | **补全发布计划文档** | 已完成。 |
| 7 | **分区** | 需要做；按优化指南与分区归档文档规划并实施。 |

---

## 五、简要结论

- **已完成**：数据库 schema 拆分、merchant_id 落地、Request Context + 中间件、MerchantRepositoryHelper、各业务路由与 Repository/Service 的 merchant 过滤、multer 上下文恢复、以及相关测试。多用户系统重构的「数据与请求上下文」基础已经就绪。
- **当前卡点**：前端未传 merchantId，且登录/用户-商户关系未与 JWT 打通，导致实际请求无法稳定带上商户上下文。
- **建议下一步**：先让 CMS 在请求中携带 merchantId（如 `X-Merchant-Id`），保证现有后台功能可测、可用；再实现登录/JWT 与商户绑定及商户管理，最后补权限与系统级表规范。

---

## 六、事项检查结果（代码现状）

| 顺序 | 事项 | 状态 | 说明 |
|------|------|------|------|
| 1 | 前端 CMS 传 merchantId | **已完成** | CMS auth.api 提供 getRequestHeaders()（含 X-Merchant-Id）；offer/product/order/news/platform-setting/merchant-application 等均使用；login/refresh/me 成功后将 user.merchantId 写入 localStorage。 |
| 2 | 登录/JWT 与商户绑定 | **已完成** | 注册时分配默认商户；createUserSession 从 user_merchants 取 default/first merchantId 写入 JWT；auth 中间件将 payload.merchantId 挂到 req.user；login/register/me 响应均带 user.merchantId。 |
| 3 | 商户管理 API 与「当前商户」 | **部分完成** | 目前仅 1 人 1 商户，无需切换/选择器；Platform 商户审核已实现。 |
| 4 | 权限与 merchant 结合 | **已完成** | 默认权限构架 + API 按权限点校验已接入：requireMerchantPermission 中间件；各路由已挂载对应 MERCHANT_PERMISSION_KEYS（member/order/product/setting）；后续需时在 CMS 做商户内权限管理。 |
| 5 | 平台表与 PlatformRepository | **已完成** | PlatformRepositories 统一入口：merchantRepository、userMerchantRepository、merchantJoinApplicationRepository、platformSettingRepository、userPermissionRepository；auth.service、UserPermissionService 等均经此访问 platform 表。 |
| 6 | 补全发布计划文档 | **已完成** | devGuide/multi-tenant-development-release-plan.md 已填写阶段与里程碑。 |
| 7 | 分区 | **迁移脚本已就绪** | 0227–0234 共 8 个分区迁移已落地；本地已执行，服务器端待执行。 |

**说明**：merchantId 权限检查与商户越权防护已在**系统级**实现（requestContextMiddleware、merchantRequiredMiddleware、merchantAccessMiddleware、MerchantRepositoryHelper），无需各 API 单独写校验，避免遗漏。

---

## 七、术语与决策摘要

| 术语/事项 | 含义或决策 |
|-----------|------------|
| **目前仅 1 人 1 商户** | `platform.user_merchants` 对 `user_id` 唯一，业务上每用户仅绑一商户；无需「当前商户」切换与商户选择器。 |
| **「当前商户」查询/切换、商户选择器** | 后端：当前操作商户查询、切换商户接口；CMS：顶栏商户选择器 UI。1 人 1 商户阶段可暂不实现。 |
| **默认权限与商户成员级别** | **商户成员级别**：epMerchantRole（ADMIN/MANAGER/PRODUCER/DELIVERY），存于 user_merchants.role。**默认权限构架**：merchant-role-permissions.ts 中 DEFAULT_ROLE_PERMISSIONS 按角色映射权限 key，getEffectivePermissions/hasMerchantPermission 已实现；API 层按权限点校验（如 requireMerchantPermission）尚未全面接入。后续需时在 CMS 做商户内权限管理。 |
| **PlatformRepository** | **已完成**。PlatformRepositories 统一提供 merchant/userMerchant/merchantJoinApplication/platformSetting/userPermission 等 repository；platform schema 表均经此入口访问。 |
| **分区** | 迁移脚本 0227–0234 已就绪；本地已执行，服务器端待执行。 |
