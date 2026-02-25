# System boundaries: Store, CMS, Platform

Temporary doc (devDoc). Describes the three front-end systems and the "apply to become a merchant" flow.

## 1. Three systems

| System | Audience | Purpose |
|--------|----------|--------|
| **Store** | End users (customers) | WeChat app + planned web store frontend. Browse, order, pay. |
| **CMS** | Merchants | Merchant staff: after login, users bound to a merchant see that merchant’s operations (products, orders, partners, settings, etc.). Same codebase as today’s CMS. |
| **Platform** | Platform operator | New app (same stack as CMS). Merchant CRUD, platform-level global settings (to be split from CMS settings later). |

- **Store** and **CMS** share the same backend; **Platform** will use the same backend (existing merchant CRUD API and future platform APIs).
- **CMS** and **Platform** use the same architecture (e.g. Next.js + Ant Design); Platform is a separate app/repo.

## 2. Apply to become a merchant (CMS)

- **Flow**: User logs in (e.g. on CMS login page) → a **separate button** leads to a **dedicated CMS page** for “申请成为商户” (apply to become a merchant).
- **Location**: CMS route, e.g. `/apply-merchant`. User must be logged in to submit; the button is shown after login (e.g. on login success or in layout).
- **Backend**: Application submission can be implemented later (e.g. `merchant_applications` table + review flow). For now, the page is a stub/form placeholder.

## 3. Platform (scope and login)

- **Scope — platform-level data only**:
  - **Merchant management**: Merchant registration approval (e.g. approve/reject applications), merchant CRUD. Backend exposes `/api/admin/merchants` etc.
  - **Platform-level settings**: Global settings that apply to the whole platform (e.g. order expiry, payment thresholds); split from CMS “settings”.
  - **Not in Platform (stay in CMS)**: All merchant business is in CMS. Platform does **not** handle merchant-internal operations (e.g. merchant member management, products, orders, partners, merchant-scoped settings). Those are done in CMS by users logged in there with a merchant context.
- **Login and account**:
  - Platform login accounts are **platform-level admins** (e.g. super_admin). They are **not** required to be associated with a merchant.
  - **Do not** check or rely on the logged-in user’s `merchantId` in the Platform app. Platform maintains platform-level data; merchant business is handled in CMS with merchant context.
- **Implementation**: Separate front-end project (same tech stack as CMS); consumes existing backend + platform-only APIs.

## 4. CMS after login

- Users **with** a merchant binding: see current CMS (dashboard, products, orders, etc.) for their merchant.
- Users **without** a merchant (e.g. newly registered): can use the “申请成为商户” entry to open the apply-merchant page and submit an application; after approval and merchant assignment they get merchantId and normal CMS access.

## 5. Summary

- **Store**: customers (WeChat + web).
- **CMS**: merchants; login with merchant context → merchant-scoped features (member management, products, orders, etc.); “申请成为商户” and merchant-join flows in CMS.
- **Platform**: platform admins only; no merchantId check; merchant approval + platform global settings; same architecture as CMS.
