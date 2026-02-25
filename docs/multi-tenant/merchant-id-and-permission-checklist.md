# 多租户：merchantId 与权限接入检查清单

基于当前代码库检查结果，供后续补齐与验收用。

---

## user_merchants 表用途（约定）

- **platform.user_merchants** 仅保存**商户内部成员**（admin / manager / producer / delivery 等）与 user 的关联，用于：JWT 选商户、requireMerchantAccess 校验、商户下角色与权限。
- **不保存**商户与其**顾客**的关系；商户的顾客（C 端/小程序下单用户）即使有 user 账号也不写入 user_merchants。若业务需要持久化「商户–顾客」关系，会**单独建表**存储，不放在 user_merchants。

---

## 一、登录 / JWT 写入并信任 merchantId、用户–商户关系与「当前商户」

### 已实现

| 项目 | 位置 | 说明 |
|------|------|------|
| JWT payload 含 merchantId | `auth.service.ts` → `createUserSession()` | 登录/注册/刷新 token 时从 `user_merchants` 取 default 或 first merchant，写入 payload `merchantId` |
| 认证时把 JWT merchantId 挂到 req.user | `auth.middleware.ts` → `attachMerchantIdFromToken()` | `authenticate` / `optionalAuthenticate` / `requireAllPermissions` 等均调用，解码 token 后把 `payload.merchantId` 赋给 `req.user` |
| 用户–商户关系 | `user-merchant.repository.ts` | `getDefaultMerchantIdForUser`、`getFirstMerchantIdForUser`、`userHasAccessToMerchant`、`getRoleForUserInMerchant` 等 |
| /me 返回当前商户与角色 | `auth.controller.ts` → getCurrentUser | 优先 DB 的 default merchant，其次 JWT；并返回 `merchantStatus`、`merchantRole`、`permissions` |
| 路由校验「用户是否可访问该商户」 | `merchant-access.middleware.ts` → `requireMerchantAccessMiddleware` | 使用 `userHasAccessToMerchant(userId, merchantId)`，super_admin 可访问任意商户 |

### 可选/后续

- **当前商户切换**：若未来支持「多商户切换」，需：  
  - 前端切换时调用接口更新 default merchant 或传 `X-Merchant-Id`；  
  - 后端可在 refresh 或单独接口中把新 merchantId 写入新 JWT（若采用「当前商户在 JWT 里」方案）。  
  当前为 1 人 1 商户，无切换需求则可不做。
- **新用户无商户**：注册后未分配商户，登录时 JWT 无 merchantId；依赖 Header/query 传或申请入驻后审核通过再分配，逻辑已支持。

---

## 二、前端（CMS）在请求里带 merchantId

### 已实现

- **auth.api.ts**：`getRequestHeaders()` 返回 `Authorization` + 若有则带 `X-Merchant-Id`（来自 `getMerchantId()` → localStorage）；登录/注册/me/refresh 成功后 `setMerchantId(data.data.user.merchantId)`。
- **以下 API 模块** 已使用 `authApi.getRequestHeaders()` 或等价方式，请求会带 merchantId（在 Header 中）：
  - admin-merchant-members, merchant-application, merchant-join-application, offer, payment-records, store, webhook, equipment, platform-setting, partner, news, order, preorder-promotes, products-preorderable, supplier, product, equipment-depreciation, user, tax-return-report, preorder, revenue, expense, commitment-payment

### 已补齐

- **printTemp.api.ts**：已改为使用 `authApi.getRequestHeaders()`（含 Authorization + X-Merchant-Id），后端 printTemp 路由已要求 merchantId，不代会 400。
- **printTempScriptHistory.api.ts**：已改为使用 `authApi.getRequestHeaders()`，与打印模板一致、便于后续后端对 scripts 做商户校验。

### 可选（暂未要求商户）

| 文件 | 说明 |
|------|------|
| **entityFields.api.ts** | 后端 `createEntityFieldsRoutes()` 未挂 requestContext/鉴权，当前为平台级或公开元数据。若日后接口按商户区分或需登录，再补 `getRequestHeaders()`。 |

### 说明

- 公开接口（如 `public-news.api.ts`、`public-preorder-promotes.api.ts`）无需 merchantId，可不改。
- `google-maps.api.ts` 若为平台级或与商户无关，可不带 merchantId；否则再补。

---

## 三、按权限点的细粒度校验在路由层全面接入

### 已接入 requireMerchantPermission 的路由（商户角色权限矩阵）

- **merchant-member.routes.ts**：MEMBER_LIST, MEMBER_REMOVE, invite/updateRole/listApplications/review 用 ADMIN 或对应权限。
- **admin-order.routes.ts**：ORDER_LIST, ORDER_UPDATE_STATUS。
- **admin-order-status.routes.ts**：ORDER_LIST, ORDER_UPDATE_STATUS。
- **alert-orders-payments.routes.ts**：ORDER_LIST。
- **cart.routes.ts**：ORDER_LIST。
- **admin-offer.routes.ts**：PRODUCT_CREATE/UPDATE/DELETE。
- **store-address.routes.ts**：SETTING_WRITE。
- **admin-products-preorderable.routes.ts**：PRODUCT_CREATE/UPDATE/DELETE。
- **admin-product.routes.ts**：PRODUCT_VIEW/CREATE/UPDATE/DELETE, STOCK_UPDATE, CATEGORY_*, PRODUCT_OPTION_UPDATE 等（与 epPermission 组合）。
- **platform-setting.routes.ts**：SETTING_WRITE。
- **admin-preorder.routes.ts**：ORDER_LIST, ORDER_UPDATE_STATUS。

权限定义与默认角色矩阵：`shared/constants/merchant-role-permissions.ts`（MERCHANT_PERMISSION_KEYS、getEffectivePermissions、hasMerchantPermission）。

### 已用「setting 读/写」的路由（requireMerchantSettingByMethod）

默认已有 **SETTING_READ** / **SETTING_WRITE**（`merchant-role-permissions.ts`），且以下路由已挂 **requireMerchantSettingByMethod()**：GET/HEAD 校验 `setting:read`，其它方法校验 `setting:write`。即已按权限点（设置类读写）做校验：

- admin-news、partner、expense、revenue、supplier、equipment、equipment-depreciation、tax-return-report、admin-preorder-promotes、printTemp

### 运费路由（shipping-fee）与 user_merchants 的适用范围

- **user_merchants**：仅表示**商户内部成员**与 user 的关联（管理员、店长、生产、配送等），不包含商户的**客户**。商户客户即使要存关系也不会放在 user_merchants。
- **requireMerchantAccessMiddleware**：校验「当前 user 是否在该商户的 user_merchants 里」，即是否为该商户**成员**。适用于 CMS/管理端（登录的是商户成员）。
- **运费计算**（/shipping/calculate 等）可能由**商户客户**调用（如小程序/C 端下单选地址时算运费），客户不在 user_merchants，故**不应**在运费路由上挂 requireMerchantAccessMiddleware，否则会误拒客户。当前仅 requestContext + merchantRequired（保证请求带 merchantId）即可；merchantId 由调用方根据当前门店/会话传入。

当前策略：订单/产品/成员/offer/预购等用专用权限 key；平台设置、门店地址用 SETTING_*；新闻/伙伴/费用/收入/供应商/设备/报表/预购推广/打印模板用 **setting 读/写**（requireMerchantSettingByMethod）。**shipping-fee** 刻意不挂 requireMerchantAccess，以支持客户端算运费。

---

## 四、客户端路由与 user_merchants 校验（只应对「商户成员」做）

**原则**：`requireMerchantAccessMiddleware` 校验「当前 user 是否在 user_merchants 里」，即**仅适用于商户成员**。商户的**客户**（C 端/小程序下单、加购、看商品等）不在 user_merchants，若路由挂该中间件会把客户请求拒掉。

### 已检查：不应挂 requireMerchantAccess 的客户端路由（已修复）

| 路由 | 挂载路径 | 说明 | 处理 |
|------|----------|------|------|
| **product.routes** | /api/products, /api/categories 等 | 客户看商品列表/详情/分类，不在 user_merchants | 已移除 requireMerchantAccessMiddleware，保留 requestContext + merchantRequired |
| **order.routes** | /api/orders | 客户下单、查我的订单、取消等 | 已移除 requireMerchantAccessMiddleware |
| **cart.routes** | /api/carts | 客户加购、改车、清空；原还有 requireMerchantPermission(ORDER_LIST) 也会拒客户 | 已移除 requireMerchantAccessMiddleware 与 requireMerchantPermission(ORDER_LIST) |
| **preorder.routes** | /api/preorders | 客户创建/查询/取消预订单 | 已移除 requireMerchantAccessMiddleware |

以上路由仍保留 **authMiddleware.authenticate**（客户需登录）及 **requestContextMiddleware + merchantRequiredMiddleware**（请求必须带 merchantId，按商户做数据隔离），仅不再要求「当前 user 在 user_merchants 里」。

### 仅商户成员调用的路由（保留 requireMerchantAccess）

以下均挂在 /api/admin 或明确为管理端，仅 CMS/商户成员使用，保留 requireMerchantAccessMiddleware 合理：

- merchant-member、admin-order、admin-order-status、alert-orders-payments、admin-offer、admin-product、admin-preorder、admin-products-preorderable、admin-preorder-promotes、admin-news、platform-setting、partner、expense、revenue、supplier、equipment、equipment-depreciation、tax-return-report、printTemp、store-address 的 /admin/stores 子路径

### 无需 auth / 已区分公开与后台的

- **store-address**：GET /api/stores、/api/stores/default、/api/stores/:id 无 auth、无 requireMerchantAccess，客户可读；增删改在 /admin/stores 下并带 requireMerchantAccess。✓
- **products-preorderable**（非 admin）：GET /api/products-preorderable 等无 auth、无 requireMerchantAccess，面向客户。✓
- **shipping-fee**：见第三节，不挂 requireMerchantAccess。✓

---

## 五、客户端 routes 与 admin routes 分离检查

**原则**：有「客户访问」且「管理端增删改」的领域，应拆成客户端 routes（不挂 requireMerchantAccess）与 admin routes（挂 requireMerchantAccess + 权限）。仅管理端使用的领域可只保留 admin 路由。

### 已分离（独立文件：客户端 + admin）

| 领域 | 客户端/公开路由 | Admin 路由 | 挂载 |
|------|-----------------|------------|------|
| **product** | product.routes | admin-product.routes | /api vs /api/admin/products |
| **order** | order.routes | admin-order.routes, admin-order-status.routes | /api/orders vs /api/admin/orders |
| **cart** | cart.routes | （无 admin 购物车） | /api/carts，仅客户端 |
| **offer** | offer.routes | admin-offer.routes | /api/offers vs /api/admin/offers |
| **preorder** | preorder.routes | admin-preorder.routes | /api/preorders vs /api/admin/preorders |
| **products-preorderable** | products-preorderable.routes | admin-products-preorderable.routes | /api vs /api/admin/products-preorderable |
| **news** | news.routes | admin-news.routes | /api/news vs /api/admin/news |
| **preorder-promotes** | preorder-promotes.routes | admin-preorder-promotes.routes | /api/preorder-promotes vs /api/admin/preorder-promotes |

### 同一文件内按路径区分（公开 vs 管理端）

| 领域 | 说明 |
|------|------|
| **store-address** | 单文件：GET /stores、/stores/default、/stores/:id 为公开（无 auth）；POST/PUT/DELETE /admin/stores* 为管理端（auth + requireMerchantAccess + SETTING_WRITE）。✓ |

### 仅 Admin（无客户端管理需求，不拆）

| 领域 | 挂载 | 说明 |
|------|------|------|
| partner, supplier, expense, revenue, equipment, equipment-depreciation, tax-return-report | /api/admin | 伙伴/供应商/费用/收入/设备/税务仅管理端 |
| printTemp, printTempScriptHistory | /api/printTemps, /api/printTemps/scripts | 打印模板仅管理端 |
| platform-setting | /api/admin/platform-settings | 平台设置仅管理端 |
| merchant, merchant-member | /api/admin/merchants, merchant-members | 商户/成员仅管理端 |
| payment-records, webhook-management, alert-orders-payments | /api/admin | 支付记录/Webhook/订单监控仅管理端 |

### 仅客户端或混合（无独立 admin 文件）

| 领域 | 说明 |
|------|------|
| **payment** | payment.routes：客户创建/确认支付、webhook；管理端看记录用 payment-records。✓ |
| **shipping** | shipping-fee.routes：算运费，客户与管理端都可能调，无增删改。✓ |
| **google-maps** | 无数据增删改，仅调用。✓ |
| **auth** | 登录/注册，无「客户端 vs admin」拆分需求。✓ |
| **entityFields, public-platform-setting** | 只读/公开。✓ |

**结论**：当前所有「既有客户访问又有管理端增删改」的领域都已做客户端 vs admin 分离（独立文件或同文件按路径）；仅管理端使用的领域仅保留 admin 路由。无需新增拆分。

---

## 六、requireMerchantAccess 按分类核对结果

**规则**：仅 **admin 使用** 的路由（商户成员操作）应挂 `requireMerchantAccessMiddleware`；**单客户端** 或 **客户端与管理员都可访问** 的路由不应挂（客户不在 user_merchants）。

### 仅 Admin 使用且已挂 requireMerchantAccess ✓

merchant-member, admin-offer, admin-order, admin-order-status, alert-orders-payments, admin-preorder, admin-product, admin-products-preorderable, admin-news, admin-preorder-promotes, platform-setting, partner, expense, revenue, supplier, equipment, equipment-depreciation, tax-return-report, printTemp；store-address 的 `/admin/stores*` 子路径。

### 仅 Admin 使用但原先缺少 requireMerchantAccess（已补）

| 路由 | 说明 |
|------|------|
| **payment-records.routes** | service 使用 getMerchantId()，需按商户隔离。已补 requestContext + merchantRequired + requireMerchantAccess。 |
| **webhook-management.routes** | webhook-event.service 使用 getMerchantId()。已补 requestContext + merchantRequired + requireMerchantAccess。 |

### 单客户端 / 客户端+管理员 访问（不应挂，已确认无）

offer.routes, news.routes, preorder-promotes.routes, products-preorderable.routes, payment.routes（客户支付）, shipping-fee.routes；product.routes, order.routes, cart.routes, preorder.routes（此前已移除 requireMerchantAccess）。以上均未挂 requireMerchantAccess。✓

### 平台级 Admin（不按商户，不挂 requireMerchantAccess）

**merchant.routes**（/api/admin/merchants）：平台管理商户列表/创建/更新，无 requestContext/merchantId，仅 authenticate。✓

---

## 四、总结

| 项 | 状态 | 待办 |
|----|------|------|
| 登录/JWT 写入并信任 merchantId、用户–商户关系、当前商户 | 已实现 | 可选：多商户切换时刷新 JWT 或接口约定。 |
| 前端带 merchantId | 大部分已带 | 补齐：printTemp.api、printTempScriptHistory.api、entityFields.api 使用 getRequestHeaders()（及鉴权）。 |
| 按权限点细粒度校验 | 部分接入 | 可选：为 news/partner/expense/revenue/supplier/equipment/tax/preorder-promotes/shipping/printTemp 等定义权限 key 并挂 requireMerchantPermission。 |
