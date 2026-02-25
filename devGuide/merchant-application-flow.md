# Merchant Application Flow (商户申请与平台审核)

## Overview

- **CMS**: User submits application on "申请成为商户" page → backend creates a row in `platform.merchants` with `status='pending'` and links user via `user_merchants` (staff-only table; merchant–customer relation if needed uses a separate table).
- **Backend**: `merchants` table stores application data (audit fields + contact). Status: `pending` (待审), `active` (已开通), `rejected` (已拒绝).
- **Platform (xituan_platform)**: Admin (SUPER_ADMIN) logs in, lists merchants with `status=pending`, approves (→ `active`) or rejects (→ `rejected`).

## Flow

1. User (CMS) fills form → `POST /api/merchant-applications` (auth required) → backend creates merchant (status=pending, code=unique, name=legal_name, abn, legal_entity_type, acn, legal_name, contact_name, contact_phone, application_remark), assigns user to merchant → returns merchant.
2. Platform admin opens "商户审核" → `GET /api/admin/merchants?status=pending` → table of pending applications.
3. Admin clicks "通过" → `PUT /api/admin/merchants/:id` body `{ status: 'active' }`.
4. Admin clicks "拒绝" → `PUT /api/admin/merchants/:id` body `{ status: 'rejected' }`.

## Backend Changes

- `merchants`: add columns `contact_name`, `contact_phone`, `application_remark` (application contact info). Status allowed: `pending`, `active`, `rejected`, `inactive`, `suspended`.
- `POST /api/merchant-applications`: auth required; body: legal_name, legal_entity_type, abn, acn?, contact_name, contact_phone, remark?; creates merchant (code from uuid or slug), status=pending, assigns current user; SUPER_ADMIN not required.
- `GET /api/admin/merchants?status=pending`: add query param filter (super_admin only for admin list).
- `PUT /api/admin/merchants/:id`: already supports status; allow `active` and `rejected` (super_admin only).

## CMS Changes

- apply-merchant page: call `POST /api/merchant-applications` with form values; on success show message and optionally redirect.

## Platform Project (xituan_platform)

- Next.js (same stack as CMS: Next 14, TypeScript, Ant Design).
- Auth: login page → same backend `/api/auth/login`; only SUPER_ADMIN can use platform (or allow ADMIN for view-only; approve/reject = SUPER_ADMIN only).
- Page: 商户审核 — table of pending merchants (GET ?status=pending), actions 通过 / 拒绝 calling PUT with status.

### Platform setup

- In `xituan_platform`: run `git submodule update --init --recursive` to pull `submodules/xituan_codebase`.
- Set `.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:3050/api` (or your backend base + `/api`).
- `npm install` then `npm run dev` (dev server port 3020). Backend CORS allows `http://localhost:3020`.
