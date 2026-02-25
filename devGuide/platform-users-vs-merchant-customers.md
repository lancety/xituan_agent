# Platform Users API vs Merchant 客户管理 (Customers)

## Summary

| 概念 | 数据 | API | 使用方 |
|------|------|-----|--------|
| **Platform 用户管理** | `platform.users` 表 | `/api/admin/users`（平台 admin 专用） | 仅 platform 管理员 (user.role = ADMIN \| SUPER_ADMIN) |
| **商户成员管理** | `user_merchants`（商户与用户的成员/角色关系） | `/api/admin/merchant-members` | 商户管理员（merchant 权限 member:list 等） |
| **商户客户管理** | 未来 `merchant_clients` 表 | 未来商户客户相关 API | 商户侧（客户级别、标签等） |

## /api/admin/users 给谁用？

**仅给 platform 管理员用。**

- 挂载路径：`/api/admin/users`
- 权限：`requireAnyRole([epUserRole.ADMIN, epUserRole.SUPER_ADMIN])`，即 **platform 的 user.role**，与商户角色无关。
- 数据：基于 **platform.users** 表，列表为全平台用户；用于平台侧的用户管理（角色、状态、支付权限等）。
- 商户的 CMS、运营后台等 **不应** 调用此 API。

## 商户的“客户管理”与 users 表

- **platform.users** 表：平台级账号，不是为“商户直接管理客户”设计的。
- **商户客户管理**（客户列表、客户级别、标签等）应基于：
  - 未来新建的 **merchant_clients** 表（或等价结构），存储：
    - 商户 id（merchant_id）
    - 用户 id（user_id，关联 platform.users）
    - 商户侧客户级别、标签等扩展信息
  - 以及对应的 **商户维度的客户管理 API**（按 merchant_id 过滤，仅操作本商户客户数据）。

因此：**商户的客户管理功能不应调用基于 users 表的 `/api/admin/users`**；应等 merchant_clients 及商户客户 API 就绪后，只调用后者。

## 当前与未来的边界

- **现在**：商户客户管理若在 CMS 有入口，前端不应请求 `/api/admin/users`；可先做占位/空状态，或仅展示“功能即将开放”。
- **未来**：实现 `merchant_clients` 及商户客户 API 后，商户客户页只调用这些 API，继续不依赖 `/api/admin/users`。

## 相关代码

- 平台用户管理路由与权限：`xituan_backend/src/domains/user/routes/admin-user-management.routes.ts`（文件头注释已说明受众与商户客户边界）。
