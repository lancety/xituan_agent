# 商户角色与权限模型（平台默认 + 可选商户自定义）

当前：系统级固定权限（不可调）。目标：后续可平滑过渡到商户 admin 自定义权限，且实现不繁琐。推荐采用「平台默认 + 商户覆盖」单一路径解析，无需双轨存储。

---

## 1. 目标

- **现阶段**：按角色（admin / manager / producer / delivery）使用**平台统一**的权限矩阵，不在库中为每个商户存一份完整权限。
- **后续**：商户 admin 可对某角色做**局部调整**（增加或收回部分权限），平台默认仍作为基准，只存**差异**。
- **解析方式**：始终用同一套逻辑——先取「该角色的默认权限」，再叠加「该商户对该角色的覆盖」——得到最终权限。无需「先判断用默认还是用自定义再读不同表」。

---

## 2. 成熟做法：默认 + 覆盖（单源解析）

很多 SaaS / B2B 产品的做法是：

- **平台维护「角色 → 权限」的默认映射**（代码里的常量表或平台配置表，如 `platform.role_default_permissions(role_key, permission_key)`）。
- **商户可选地存「覆盖」**：仅记录和默认不一致的项，例如 `merchant.role_permission_overrides(merchant_id, role_key, permission_key, allowed)`。  
  - `allowed = true` 表示在默认基础上「增加」该权限；  
  - `allowed = false` 表示「收回」该权限。  
  不存在的 (merchant_id, role_key, permission_key) 即表示「用平台默认」。
- **解析「用户在某商户下的有效权限」**：  
  1. 取平台默认：该用户在该商户的 role → 默认权限集合。  
  2. 取该商户、该角色的所有 override 行。  
  3. 合并：默认集合 + override 中 allowed=true 的加入、allowed=false 的移除。  
  得到的结果就是「最终权限集合」，API/前端只认这一份，不区分「来自默认还是来自自定义」。

这样做的效果：

- 不繁琐：不需要「为每个商户复制一整份角色权限」，也不需要「二选一：读默认或读自定义」。
- 平滑过渡：第一版可以不建 override 表，解析时只走默认；上线 override 表与 UI 后，解析逻辑只是多了一步「叠加覆盖」，代码路径不变。
- 存储小：只有被商户改过的权限才占一行。

---

## 3. 建议的数据与代码结构

### 3.1 角色与权限定义（平台级）

- **角色**：`admin` | `manager` | `producer` | `delivery`（与 merchant-multi-user-design 一致）。
- **权限**：粒度建议用「权限键」字符串，例如：
  - `member:list`, `member:invite`, `member:update_role`, `member:remove`（成员管理）
  - `order:list`, `order:update_status`, `order:cancel`（订单）
  - `product:create`, `product:update`, `product:delete`（商品）
  - `setting:read`, `setting:write`（设置）
  - 等等，按业务在代码或配置中列成清单。

- **默认矩阵**：  
  平台维护「每个角色默认拥有哪些权限」，存在代码中（如常量 `DEFAULT_ROLE_PERMISSIONS: Record<MerchantRole, string[]>`）或平台表 `platform.role_default_permissions(role_key, permission_key)`。  
  第一版用代码常量即可，后续若要平台运营可配置再迁到表。

### 3.2 商户覆盖（可选，后续上线）

- 表：例如 `merchant.role_permission_overrides`（或放在 platform 的 `merchant_role_permission_overrides(merchant_id, role_key, permission_key, allowed boolean)`）。
- 只存「相对默认的差异」：某商户、某角色、某权限、允许/禁止。  
  不存在的 (merchant_id, role_key, permission_key) = 使用平台默认。
- 商户 admin 在「角色权限设置」页只能看到「在默认基础上勾选增加/取消某权限」，不维护一整张矩阵。

### 3.3 解析接口（统一入口）

- 服务方法如：`getEffectivePermissions(userId: string, merchantId: string): Promise<Set<string>>`。  
  1. 查该用户在该商户的 role（user_merchants；该表仅存商户内部成员，不存商户–顾客关系）。  
  2. 取该 role 的**平台默认权限**（常量或 platform 表）。  
  3. 查该 merchant、该 role 的**所有 override**。  
  4. 默认集合 + allowed=true 的加入、allowed=false 的移除，返回 Set。  
- API 与前端：只依赖「有效权限集合」，不关心来自默认还是覆盖。  
- 第一版：第 3 步无表则跳过，直接返回默认集合，实现简单。

### 3.4 与现有中间件的关系

- `requireMerchantAccessMiddleware`：只校验「能否进该商户」。
- 具体接口再按「所需权限」校验：  
  - 要么在路由上挂 `requireMerchantPermission('member:invite')` 这类中间件（内部调 `getEffectivePermissions` 再判断）；  
  - 要么在 controller 内取 `getEffectivePermissions` 判断。  
- 这样：今天用「写死的角色→权限」，明天加上 override 表和 UI，只是 `getEffectivePermissions` 多查一张表，路由和业务代码不用改。

---

## 4. 小结

| 问题 | 做法 |
|------|------|
| 是否要「平台默认角色权限」？ | 要。作为唯一基准，代码常量或 platform 表。 |
| 商户自定义是否另存一份完整权限？ | 不。只存**覆盖**（差异）：(merchant_id, role_key, permission_key, allowed)。 |
| 系统如何决定用默认还是自定义？ | 不二选一。始终「默认 + 覆盖」合并成一份有效权限，统一读取。 |
| 如何平滑过渡？ | 第一版不建 override 表，解析只返回默认；后续加表和 UI，解析逻辑只多一步合并，调用方不变。 |

这样就不需要「两套存储、两套读取逻辑」，实现和扩展都更简单，也符合常见的 RBAC + 租户覆盖的成熟方案。

---

## 5. 参考

- 角色定义与流程：`devGuide/merchant-multi-user-design.md`
- 实施顺序：`devGuide/merchant-multi-user-implementation-plan.md`
