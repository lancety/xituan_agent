# Merchant Multi-User Design (商户多用户方案细节)

One merchant can have multiple users; each user has one merchant (UNIQUE user_id in user_merchants). This doc details flows, APIs, CMS, and permission.

---

## 1. Model

- **Table**: `platform.user_merchants`
- **Purpose**: Only **merchant internal members** (staff)—not customers. Merchant–customer relationship, if needed, is stored in a separate table.
- **Columns**: `user_id`, `merchant_id`, `role` (e.g. `user`, `admin`), `is_default`, `created_at`
- **Constraints**: `UNIQUE(user_id)` (one user → one merchant); multiple rows can share the same `merchant_id` (one merchant → many users).

**Role in merchant** (选定四类):

| 角色 (role) | 说明 | 典型权限 |
|-------------|------|----------|
| **admin** | 商户管理员 | 成员管理、设置、全部功能 |
| **manager** | 店长/经理（含原 operator 接单、改单、订单与商品操作） | 订单、商品、报表、部分设置；无成员管理 |
| **producer** | 生产/后厨（美食网店厨房、其他行业生产岗位） | 订单/工单列表、生产/出餐状态更新，不碰价格与设置 |
| **delivery** | 配送 | 待配送订单、配送状态更新，不碰价格与设置 |

- 已简化：operator 合并进 manager；kitchen 改为 **producer**，覆盖美食后厨及其他行业生产角色。  
- 存储：`user_merchants.role` 存枚举 `admin` | `manager` | `producer` | `delivery`，权限层按 role 映射到接口与 CMS 菜单。

**Global role** (`platform.users.role`): SUPER_ADMIN is platform-level; for merchant-scoped APIs we use **user_merchants.role** after access is allowed by `requireMerchantAccessMiddleware`.

---

## 2. Flows

### 2.1 Invite user to merchant (邀请用户加入商户)

- **Actor**: Merchant admin (user_merchants.role = admin for this merchant).
- **Input**: Email (and optional role, default `user`).
- **Steps**:
  1. Check: current user is admin for this merchant (user_merchants.role = admin and merchant_id = current).
  2. Find user by email. If not found → optional: create user (invite-to-register flow) or return "user not found".
  3. If user exists: check if they already have a merchant (user_merchants row). If yes → return "user already belongs to another merchant" (business rule: one user one merchant). If no row → insert (user_id, merchant_id, role, is_default=true).
  4. If we created a new user → insert user_merchants (user_id, merchant_id, role, is_default=true).
  5. Optional: send email invite (link to set password / accept invite).
- **Backend**: e.g. `POST /api/admin/merchants/:merchantId/members/invite` body `{ email, role? }`. Auth: requireMerchantAccess + require role=admin in this merchant.

### 2.2 List members (商户成员列表)

- **Actor**: Merchant admin or user (admin sees all, user might see limited).
- **Steps**: Query `user_merchants` where `merchant_id = current_merchant`, join `users` for email/name.
- **Backend**: `GET /api/admin/merchants/:merchantId/members` or `GET /api/admin/merchant-members` (merchantId from context). Return list with user id, email, role, createdAt. Auth: requireMerchantAccess; optionally restrict to admin for this merchant.

### 2.3 Update member role (修改成员角色)

- **Actor**: Merchant admin only.
- **Input**: user_id (member), new role.
- **Steps**: Update `user_merchants` set role where (user_id, merchant_id) and merchant_id = current; ensure current user is admin.
- **Backend**: `PUT /api/admin/merchants/:merchantId/members/:userId/role` body `{ role }`. Auth: requireMerchantAccess + require role=admin in this merchant.

### 2.4 Remove member (移除成员)

- **Actor**: Merchant admin only (or self-remove if allowed).
- **Steps**: Delete row from `user_merchants` where (user_id, merchant_id). That user then has no merchant until invited elsewhere.
- **Backend**: `DELETE /api/admin/merchants/:merchantId/members/:userId`. Auth: requireMerchantAccess + require role=admin (or userId = self).

### 2.5 Who can add/invite

- Only **merchant admin** (user_merchants.role = admin for this merchant) can invite, update role, remove member. SUPER_ADMIN can optionally bypass for platform support.

### 2.6 User apply to join merchant (用户申请绑定商户)

- **Actor (applicant)**: Logged-in user (typically with no merchant yet, or after leaving current merchant).
- **Actor (reviewer)**: Merchant admin for the target merchant.
- **Join by merchant code**: User enters **商户码** (merchant code); backend resolves to merchant_id and creates application. No public merchant list/search.
- **Steps**:
  1. User submits an application with merchant code (optional note). Backend resolves code → merchant_id; record stored with status pending.
  2. Merchant admin sees pending applications for their merchant, and either **approve** (and assign a role) or **reject**.
  3. On approve: create/update `user_merchants` (user_id, merchant_id, assigned_role); mark application approved.
  4. On reject: mark application rejected; optionally store reason. User remains without that merchant.
- **Backend**: e.g. `POST /api/merchant-join-applications` body `{ merchantCode }`; `GET /api/admin/merchant-members/applications`; `PATCH .../applications/:id`. See implementation plan for details.

---

## 3. Backend API (建议)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/admin/merchant-members` | List members of current merchant (merchantId from context) | requireMerchantAccess, optional require merchant role=admin for sensitive fields |
| POST | `/api/admin/merchant-members/invite` | Invite by email; body `{ email, role? }` | requireMerchantAccess + merchant role=admin |
| PUT | `/api/admin/merchant-members/:userId/role` | Set member role; body `{ role }` | requireMerchantAccess + merchant role=admin |
| DELETE | `/api/admin/merchant-members/:userId` | Remove member from current merchant | requireMerchantAccess + merchant role=admin (or self) |

- All routes: `requestContextMiddleware` + `merchantRequiredMiddleware` + `requireMerchantAccessMiddleware`.
- Then check "merchant-scoped role": load role from `user_merchants` for (req.user.id, getMerchantId()); if required role is admin, allow only if that role is admin.

---

## 4. Permission check (商户下角色与权限)

- **Where**: After `requireMerchantAccessMiddleware` (user has access to this merchant). For routes that require "merchant admin" (e.g. invite, update role, remove): load role with `UserMerchantRepository.getRoleForUserInMerchant(req.user.id, getMerchantId())`; if role !== 'admin' (and user is not SUPER_ADMIN), return 403.
- **Unified**: For all merchant-scoped APIs, use **merchant role** to resolve effective permissions (see permission model below). Today: platform-defined role→permission matrix in code; later: same resolution with optional merchant overrides so admin can customise per-role permissions without maintaining a full copy.
- **Permission model** (platform default + optional merchant overrides, single resolution path): see **`devGuide/merchant-role-permission-model.md`**.

Suggested helper (backend):

```ts
// e.g. in a middleware or service
async function requireMerchantAdmin(req, res, next) {
  if (req.user.role === epUserRole.SUPER_ADMIN) return next();
  const merchantId = getMerchantId();
  const role = await userMerchantRepo.getRoleForUserInMerchant(req.user.id, merchantId);
  if (role === 'admin') return next();
  return res.status(403).json({ success: false, code: 'MERCHANT_ADMIN_REQUIRED' });
}
```

---

## 5. CMS (前端)

- **Members / 成员管理** (only for merchant admin):
  - Page: e.g. "商户成员" or "Team": list members (email, role, actions).
  - Actions: "修改角色" (dropdown admin/user), "移除成员"; "邀请成员" (input email, choose role, submit).
- **Display**: Use current user’s **merchant role** (from `/auth/me` or dedicated endpoint that returns `merchantRole` for current merchant) to show or hide:
  - "成员管理" menu and page (only for merchant role = admin).
  - Sensitive buttons (e.g. delete product, change settings) by permission derived from merchant role.
- **Auth/me**: Backend can include `merchantRole` in login/me when merchantId is present (e.g. `user_merchants.role` for (userId, merchantId)), so frontend doesn’t need an extra call.

---

## 6. Implementation checklist

- [ ] Backend: `GET/POST/PUT/DELETE` merchant-members endpoints; use `getRoleForUserInMerchant` and `requireMerchantAdmin` where needed.
- [ ] Backend: Login/me response includes `merchantRole` for current (userId, merchantId).
- [ ] CMS: "商户成员" page (list, invite, update role, remove); visible only when merchantRole = admin.
- [ ] CMS: Menu and feature visibility driven by `merchantRole` (and existing permission mapping).
- [ ] Ensure invite flow: either "user must not have a merchant" or "invite creates user and assigns to this merchant".

---

## 7. Reference

- **实施计划**（阶段、任务顺序、API 与 CMS 落地、申请绑定流程）：`devGuide/merchant-multi-user-implementation-plan.md`
- **权限模型**（平台默认 + 商户覆盖、平滑过渡）：`devGuide/merchant-role-permission-model.md`
- Model and repository: `merchant-scoped-role.md`
- Migration: `1710000000225_user_merchants_one_per_user_and_role.sql` (adds role, UNIQUE(user_id))
