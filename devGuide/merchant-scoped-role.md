# Merchant-Scoped Role (商户下角色)

User–merchant association includes a **role** so that CMS and API can decide what to show and allow per (user, merchant).

## Model

- **Table**: `platform.user_merchants`
- **Purpose**: Only stores **merchant internal members** (staff) association with users—admin, manager, producer, delivery. Does **not** store merchant–customer relationships; those would use a separate table if needed.
- **Columns**: `user_id`, `merchant_id`, **role**, `is_default`, `created_at`
- **Constraint**: One user can only be associated with one merchant (`UNIQUE(user_id)`).

**Role** (选定): `admin` | `manager` | `producer` | `delivery`. 详见 `merchant-multi-user-design.md` 角色表。One merchant can have many users; each has a role for that merchant.

## Backend

- **Entity**: `UserMerchant.role` (string, default `'user'`).
- **Repository**: `UserMerchantRepository.getRoleForUserInMerchant(userId, merchantId)` returns the role or null.
- **Assign**: `assignUserToMerchant(userId, merchantId, isDefault, role)`; set `role` to one of `admin` | `manager` | `producer` | `delivery` (default e.g. `manager` for new invites).

Permission checks that are **merchant-scoped** (after `requireMerchantAccessMiddleware`) should use this role instead of (or in addition to) the global `user.role` when deciding access. Example: resolve `(userId, getMerchantId())` → role from `user_merchants`, then map role to permissions (e.g. same as existing `epUserRole` → `epPermission` mapping) and allow/deny.

## CMS / API

- **Display**: Use the role for the current user in the current merchant to show or hide menus, buttons, and pages (e.g. admin-only features when role is `admin`).
- **Operations**: Backend APIs that are merchant-scoped should enforce permission using the role from `user_merchants` for the request’s (userId, merchantId), so that “商户下的角色” consistently controls both UI and API.

## Migration

- **1710000000225_user_merchants_one_per_user_and_role.sql**: Adds `role` column and `UNIQUE(user_id)`. Run only after backup and in a maintenance window if needed.

## Reference

- **Detailed flows, API, CMS, permission**: `devGuide/merchant-multi-user-design.md` (商户多用户方案细节)
