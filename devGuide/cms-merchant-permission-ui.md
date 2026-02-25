# CMS merchant permission UI (menu and buttons)

Design for filtering CMS menu and CRUD buttons by merchant-scoped permissions. Backend returns effective permissions in auth responses; CMS exposes a single module interface for "can view / can operate".

---

## 1. Backend: permissions in auth response

- **Auth endpoints** that return user (login, register, refreshToken, getCurrentUser/me) include:
  - `user.permissions: string[]` when the user has a merchant context (e.g. `merchantRole`), from `getEffectivePermissions(merchantRole)`.
- **super_admin** is not given a merchant role in response but is treated on the frontend as having all permissions (see below).

---

## 2. CMS: permission module interface

- **Auth context** (`useAuth()`):
  - `can(permission: string): boolean` — true if `user.role === 'super_admin'` or `user.permissions` includes the permission.
  - `canAny(permissions: string[]): boolean` — true if the user has any of the given permissions.
- **Hook** `useMerchantPermissions()`: returns `{ can, canAny, permissions }` (convenience wrapper around auth).
- **Component** `<Can permission="..." [anyOf={[...]}] fallback={null}> {children} </Can>`: renders children only when the user has the required permission(s); otherwise renders `fallback`.

Usage examples:

- Menu: filter items by `can(siteMenuConfig[menuKey].requiredPermission)` (see below).
- Buttons: wrap with `<Can permission="order:update_status"> <Button>改状态</Button> </Can>` or disable with `disabled={!can('product:delete')}`.

---

## 3. Menu filtering

- **site-menu.config**: each menu item has an optional `requiredPermission?: string` (e.g. `order:list`, `product:update`, `setting:read`). If absent, the item is shown to all authenticated users with a merchant.
- **MainLayout**: when building PC and mobile menu entries, filter `menuKeys` with `canSeeMenu(menuKey)` where `canSeeMenu` returns `true` when the item has no `requiredPermission` or `can(config.requiredPermission)`.

---

## 4. Button / CRUD visibility

- Use **`can(permission)`** or **`canAny([...])`** for:
  - Hiding a button: `<Can permission="product:delete" fallback={null}><Button danger>删除</Button></Can>`.
  - Disabling: `disabled={!can('order:update_status')}`.
  - Showing a different label or tooltip when the user cannot perform the action.
- Permission keys align with backend `MERCHANT_PERMISSION_KEYS` (e.g. `order:list`, `order:update_status`, `product:create`, `product:update`, `product:delete`, `setting:read`, `setting:write`, `member:list`, etc.). See `merchant-permission-matrix.md`.

### 4.1 Disabled + tooltip (explain why not clickable)

To show the button as disabled but explain the reason (instead of only `disabled` with no message), use **`<PermissionTooltip>`**:

- **`<PermissionTooltip permission="order:update_status"> <Button>改状态</Button> </PermissionTooltip>`**  
  When the user lacks permission: button is disabled and hover shows default tooltip **"缺少「更新订单状态」权限"** (label from `getPermissionLabel(permission)` in component).
- Optional **`anyOf`**: same as `Can`, require any of the listed permissions.
- Optional **`tooltipTitle`**: override at call site; if not set, component uses default "缺少「{permissionLabel}」权限" per permission.
- Optional **`hideWhenNoPermission`**: if `true`, render nothing when no permission (same as `Can` with fallback null).

Permission key → label is in **`constants/merchant-permission-labels.enum.ts`** (`PERMISSION_LABELS` / `getPermissionLabel()`). Component uses it for the default tooltip; you can still pass custom `tooltipTitle` where needed.

---

## 5. Files

| Layer   | File | Purpose |
|---------|------|--------|
| Backend | auth.controller.ts | Add `permissions` (and where needed `merchantRole`) to login/register/refresh/getCurrentUser response |
| CMS     | auth.api.ts | `iUserInfo.permissions?: string[]` |
| CMS     | auth.context.tsx | `can(permission)`, `canAny(permissions)` |
| CMS     | hooks/useMerchantPermissions.ts | Re-export can/canAny + permissions |
| CMS     | components/common/Can.tsx | `<Can permission="..." fallback={...}>` |
| CMS     | components/common/PermissionTooltip.tsx | Disabled + tooltip with "缺少「xxx」权限" when no permission (tooltipTitle override optional) |
| CMS     | constants/merchant-permission-labels.enum.ts | Permission key → human-readable label for tooltips |
| CMS     | site-menu.config.tsx | `requiredPermission` per menu item |
| CMS     | MainLayout.tsx | Filter menu by `can(requiredPermission)` |
