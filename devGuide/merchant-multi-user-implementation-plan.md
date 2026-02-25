# 商户多用户实施计划

在已有设计与数据模型基础上，把「商户多用户」从设计落到实现的执行计划。设计细节见 `merchant-multi-user-design.md`。

---

## 1. 当前状态

### 1.1 已完成

| 项 | 说明 |
|----|------|
| 数据模型 | `platform.user_merchants` 仅存**商户内部成员**与 user 的关联（含 `user_id`, `merchant_id`, `role`, `is_default`, `created_at`）；约束 `UNIQUE(user_id)`（一用户一商户）。不存商户–顾客关系；若需要则单独建表。 |
| 迁移 | `1710000000225_user_merchants_one_per_user_and_role.sql` 已加 role、一用户一商户 |
| 实体与仓储 | `UserMerchant` 实体、`UserMerchantRepository`（含 `getRoleForUserInMerchant`、`assignUserToMerchant`、`removeUserFromMerchant`） |
| 商户访问校验 | `requireMerchantAccessMiddleware`：非 SUPER_ADMIN 必须有 user_merchants 记录才能访问当前 merchant |
| 登录/注册 | 登录后 session 带 merchantId；注册时分配默认商户（带默认 role） |

### 1.2 未完成

- 商户角色枚举未统一：设计为 admin / manager / producer / delivery，实体与 DB 当前为 `role` 字符串（默认 `user`），需统一为四角色并决定是否保留兼容。
- **requireMerchantAdmin**（或按角色校验）中间件未实现。
- **商户成员 API** 未实现：列表、邀请、改角色、移除。
- **getCurrentUser/me** 未返回当前商户下的 `merchantRole`，前端无法按角色显隐菜单与功能。
- **CMS**：成员管理页、按 merchantRole 的菜单/功能显隐未做。

---

## 2. 实施阶段

### 阶段一：后端基础（角色与权限）

1. **商户角色枚举**
   - 在 xituan_codebase（或 backend 共享类型）中新增商户角色枚举，例如 `epMerchantRole`：`admin` | `manager` | `producer` | `delivery`。
   - 与设计一致：admin=商户管理员，manager=店长/经理，producer=生产/后厨，delivery=配送。
   - 实体 `UserMerchant.role` 改为使用该枚举类型（或字符串 + 校验仅允许枚举值）；若 DB 已有 `user` 等旧值，需在迁移或默认值中约定映射（如 `user` → `manager` 或保留 `user` 为兼容值，文档注明）。

2. **requireMerchantAdmin 中间件**
   - 在 `requireMerchantAccessMiddleware` 之后使用：取当前 `merchantId`（requestContext）、`req.user.id`，调用 `UserMerchantRepository.getRoleForUserInMerchant`。
   - 若 `role === 'admin'` 或 `req.user.role === epUserRole.SUPER_ADMIN` 则放行，否则 403，code 如 `MERCHANT_ADMIN_REQUIRED`。
   - 导出为独立函数，供成员管理相关路由挂载。

3. **（可选）通用 requireMerchantRole(roles: string[])**
   - 若后续需要「仅 manager 及以上可访问」等，可再加按角色列表校验的中间件；成员管理先只用 requireMerchantAdmin 即可。

### 阶段二：商户成员 API

4. **路由与中间件顺序**
   - 路径建议（与设计一致）：  
     - `GET  /api/admin/merchant-members` — 当前商户成员列表  
     - `POST /api/admin/merchant-members/invite` — 邀请（body: `{ email, role? }`）  
     - `PUT  /api/admin/merchant-members/:userId/role` — 修改角色（body: `{ role }`）  
     - `DELETE /api/admin/merchant-members/:userId` — 移除成员  
   - 中间件链：`authMiddleware.authenticate` → `requestContextMiddleware` → `merchantRequiredMiddleware` → `requireMerchantAccessMiddleware` → 成员相关路由再加 `requireMerchantAdmin`（除「移除自己」可单独允许）。

5. **GET 列表**
   - 从 requestContext 取当前 merchantId；查 `user_merchants` 中该 merchant_id 的所有行，join `users` 返回 id、email、nickname、role、createdAt 等（不返回密码等敏感字段）。

6. **POST invite**
   - 校验当前用户为 merchant admin。
   - Body：email 必填，role 可选（默认可用 manager 或设计中的默认）。
   - 按 email 查用户：若不存在，可选「仅支持已注册用户」直接报错，或走邀请注册流程（发邮件/创建未激活用户等，按产品定）。
   - 若存在：查 `user_merchants` 是否已有该 user_id；若有则返回「该用户已属于其他商户」；若无则 `assignUserToMerchant(userId, merchantId, true, role)`。
   - 返回新成员信息或 201。

7. **PUT role**
   - 校验当前用户为 merchant admin；目标 userId 必须属于当前 merchant（即 user_merchants 中一条记录同时满足 user_id=params.userId, merchant_id=current）。
   - 更新该行的 role；返回 200。

8. **DELETE 移除成员**
   - 校验：当前用户为 merchant admin，或目标 userId 为当前用户本人（允许自己退出）。
   - 从 `user_merchants` 删除对应行（当前模型下一用户只有一条记录，即 DELETE WHERE user_id = :userId 且 merchant_id = current）。注意：删除后该用户将「无商户」，后续登录/访问商户需另行处理（如要求重新选择商户或引导申请）。

### 阶段三：登录/me 返回 merchantRole

9. **getCurrentUser 增加 merchantRole**
   - 当且仅当已解析出 `merchantId`（如 getDefaultMerchantIdForUser 或 JWT 中的 merchantId）时，查询 `getRoleForUserInMerchant(req.user.id, merchantId)`，在响应 data.user 中增加 `merchantRole`（字符串或枚举值）。
   - 前端据此显隐「成员管理」菜单及敏感操作（如删除商品、设置等）。

### 阶段四：CMS 前端

10. **成员管理页**
    - 仅当 `merchantRole === 'admin'` 时显示「成员管理」或「团队」菜单入口及页面。
    - 页面：列表（邮箱、昵称、角色、加入时间）；操作：邀请（弹窗/表单：email + 角色选择）、修改角色（下拉）、移除（二次确认）。
    - 调用上述 GET/POST/PUT/DELETE 接口；错误提示（如「用户已属于其他商户」「无权限」）。

11. **菜单与功能按 merchantRole 显隐**
    - 除成员管理仅 admin 外，可按设计对 manager/producer/delivery 做功能裁剪（例如 producer 只看订单/生产相关，delivery 只看配送相关）；具体权限矩阵可在设计 doc 或本文档后续补充。
    - 第一版可只做：成员管理仅 admin；其余功能仍按「有商户访问权即可」，后续再按角色细粒度控制。

### 阶段五：用户申请绑定商户（admin 审批设角）

12. **业务规则**
    - 用户可**主动申请**加入某个商户（未绑定任何商户的已注册用户，或希望「换绑」时先解绑再申请）。
    - 商户 **admin** 在后台看到待处理申请列表，可**通过并设置角色**或**拒绝**；通过后写入 `user_merchants`，该用户即绑定该商户并拥有所设角色。

13. **数据模型（申请表）**
    - 建议表：`platform.merchant_join_applications`（或 `merchant.merchant_join_applications` 若希望按 schema 隔离）。
    - 字段建议：`id`, `user_id`, `merchant_id`, `status`（pending / approved / rejected）, `applied_at`, `reviewed_at`, `reviewed_by` (user_id), `assigned_role`（审批通过时写入，供写入 user_merchants 时使用）, 可选 `note`（申请备注/拒绝原因）。
    - 约束：同一 (user_id, merchant_id) 在 status=pending 时只保留一条；或允许重复申请但只处理最新一条，视产品而定。

14. **API**
    - **用户侧**：`POST /api/merchant-join-applications`（或 `POST /api/admin/merchant-join-applications`）  
      - Body：`{ merchantCode }`（商户码，后端据此解析 merchant_id）。  
      - 校验：已登录、当前用户未绑定商户（或产品允许「申请换绑」则先校验状态）；商户码有效且对应商户存在。  
      - 创建一条 status=pending 的申请（merchant_id 由商户码解析得到）。
    - **商户 admin 侧**：  
      - `GET /api/admin/merchant-members/applications` — 当前商户的待处理申请列表（含申请人 email、nickname、applied_at）。  
      - `PATCH /api/admin/merchant-members/applications/:applicationId` — 审批；body `{ status: 'approved' | 'rejected', role? }`（approved 时必传 role）。  
      - 通过时：插入或更新 `user_merchants`（该 user_id 对应 merchant_id + assigned_role），并将申请置为 approved、记录 reviewed_at/reviewed_by；拒绝时仅更新申请状态。

15. **CMS**
    - **未绑定商户时的落地页**：当前未绑定 merchant 的账号会被提示「注册商户」；需改为同时提供「加入已有商户」入口。布局要求：
      - **桌面端**：左右两个容器块——**左侧「注册商户」**、**右侧「加入商户」**（申请绑定已有商户），并排展示。
      - **移动端**：两个块各占一行，上下排列（先注册商户块，再加入商户块，或按产品定顺序）。
    - **加入商户方式**：通过**商户码**加入。用户在右侧块内输入商户码，提交后创建对该商户的加入申请；并展示「我的申请」状态（待审批/已通过/已拒绝）。后端根据商户码解析 merchant_id 再创建 application 记录。
    - 商户 admin：在成员管理页增加「待审批申请」Tab 或区块，列表 + 通过（选角色）/ 拒绝 操作。

### 阶段六：策略与兼容

16. **邀请策略**
    - 明确：仅支持「已注册用户」邀请，还是支持「输入邮箱发邀请、未注册则发邮件注册」；若后者，需与注册/激活流程打通。

17. **历史 role 兼容**
    - 若 DB 或旧代码中存在 `user` 等非四角色值，决定映射规则（如视为 manager）或做一次性数据迁移统一为四角色之一。

---

## 3. 权限管理（角色权限与后续商户自定义）

- **当前**：系统级固定权限——在代码中维护「角色 → 权限」默认矩阵（如 `admin` 拥有全部，`manager` 少成员管理，`producer`/`delivery` 仅各自范围），接口与菜单按该矩阵判断，**不落库**。
- **后续平滑过渡**：采用「平台默认 + 商户覆盖」单一路径——只存**差异**（某商户、某角色、某权限的允许/收回），解析时「默认权限 ∪ 覆盖」得到有效权限。无需「平台一份、商户再存一份完整」或「二选一读默认或读自定义」。
- 详细设计（默认矩阵、覆盖表结构、解析接口、与中间件关系）：见 **`devGuide/merchant-role-permission-model.md`**。
- 实施时可先做：角色枚举 + 代码内默认权限矩阵 + 按角色做接口/菜单显隐；再单独排期：`getEffectivePermissions(userId, merchantId)`（先只读默认）、可选 override 表与 CMS 配置页。

---

## 4. 建议实现顺序与依赖

| 顺序 | 任务 | 依赖 | 说明 |
|------|------|------|------|
| 1 | 商户角色枚举 + 实体/类型统一 | 无 | 必须先有 epMerchantRole，后续中间件与 API 才统一 |
| 2 | requireMerchantAdmin 中间件 | 1 | 依赖角色枚举与 getRoleForUserInMerchant |
| 3 | GET/POST/PUT/DELETE 商户成员 API | 2 | 成员路由需挂载 requireMerchantAdmin |
| 4 | getCurrentUser 返回 merchantRole | 1 | 与 3 可并行；依赖 1 保证返回值为枚举一致 |
| 5 | CMS 成员管理页 + 仅 admin 可见 | 3、4 | 需有成员 API 与 me 中的 merchantRole |
| 6 | 权限：平台默认角色→权限矩阵 + 按角色显隐菜单/接口 | 1、4 | 矩阵用角色枚举，前端显隐依赖 merchantRole |
| 7 | 用户申请绑定商户：申请表 + 用户提交/admin 审批 API + CMS | 2、5 | 后端审批需 requireMerchantAdmin；admin 端「待审批」在成员管理页内，故依赖 5 |
| 8 | （可选）按 merchantRole 细粒度接口权限（requireMerchantPermission） | 6 | 依赖权限矩阵与解析逻辑 |
| 9 | （后续）商户自定义权限：override 表 + getEffectivePermissions + CMS 配置页 | 6 | 在默认矩阵基础上加覆盖层 |

**依赖关系简图**（拓扑序）：

- 1 → 2 → 3  
- 1 → 4  
- 3、4 → 5  
- 1、4 → 6  
- 2、5 → 7（7 与 6 无依赖，可与 6 并行或 5 后先做 7 再做 6）  
- 6 → 8、9  

**可并行**：2 与 4 均在 1 后，可并行；3 与 4 可并行（3 依赖 2，4 依赖 1）；5 与 6 在 3、4 完成后可并行；7 与 6 无依赖，可按排期先 7 或先 6。

---

## 5. 参考

- 流程、API 建议、权限与 CMS 说明：`devGuide/merchant-multi-user-design.md`
- **权限模型（平台默认 + 商户覆盖）**：`devGuide/merchant-role-permission-model.md`
- 迁移：`xituan_backend/migrations/1710000000225_user_merchants_one_per_user_and_role.sql`
- 仓储与访问校验：`UserMerchantRepository`、`requireMerchantAccessMiddleware`
