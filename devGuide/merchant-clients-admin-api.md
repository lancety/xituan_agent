# Merchant clients admin API (`/api/admin/merchant-clients`)

## Purpose

Merchant CMS **客户管理** operates on `merchant.user_client_merchants` (user ↔ merchant client link), not `platform.users` via `/api/admin/users`.

Platform `/api/admin/users` remains **platform super-admin only** (`user.role` = ADMIN | SUPER_ADMIN).

## Permissions (merchant-scoped)

| Key | Roles (default) | Use |
|-----|-----------------|-----|
| `client:list` | merchant ADMIN, MANAGER | List clients |
| `client:read` | ADMIN, MANAGER | Get one client |
| `client:create` | ADMIN, MANAGER | Add client, email lookup |
| `client:update` | ADMIN, MANAGER | Offline payment flags |
| `client:delete` | ADMIN, MANAGER | Remove client link |

Defined in `xituan_backend/src/shared/constants/merchant-role-permissions.ts` (mirrored in CMS `site-menu.config.tsx`).

## Endpoints

Mount: `/api/admin/merchant-clients`  
Middleware: auth → merchant context → merchant access → `requireMerchantPermission` / `requireMerchantAnyPermission`.

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/` | `client:list` | List clients with user email/nickname |
| GET | `/:userId` | `client:read` | Single client |
| POST | `/` | `client:create` | Body: `{ userId? }` or `{ email? }` — links existing platform user |
| DELETE | `/:userId` | `client:delete` | Remove client association only |
| PUT | `/:userId/payment-permissions` | `client:update` | `cashPaymentAllowed`, `bankTransferAllowed` |
| GET | `/lookup?email=&limit=` | `client:create` | Search platform users by email (for add UI) |
| POST | `/batch` | `client:list` **or** `order:list` **or** `payment:read` | Merchant-scoped user display for order/monitoring lists |

### POST `/batch` security

Returns `id`, `username`, `nickname`, `email` only for users who are either:

- a client of the current merchant (`user_client_merchants`), or  
- have at least one order under the current merchant (`merchant.orders`).

Replaces CMS usage of `POST /api/admin/users/batch`.

## CMS

- API client: `xituan_cms/src/lib/api/merchant-client.api.ts`
- Pages: `/clients`, `/clients/[userId]`
- Menu: `CLIENT_LIST`
- Orders / payment monitoring: `userApi.batchGetUsers` → `merchantClientApi.batchUserDisplay`

## Related

- `platform-users-vs-merchant-customers.md`
- Entity: `UserClientMerchant` (`merchant.user_client_merchants`)
