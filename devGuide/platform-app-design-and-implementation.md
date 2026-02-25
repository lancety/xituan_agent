# Platform App: Design and Implementation

Structured design and implementation rules for the Platform front-end (xituan_platform). See also [System boundaries: Store, CMS, Platform](../docs/system-boundaries-and-platform.md).

---

## 1. Scope: Platform-level data only

- **In scope**
  - **Merchant registration approval**: Approve/reject merchant applications (e.g. merchant-review page). Platform maintains merchant records and status, not merchant-internal business.
  - **Platform-level settings**: Global config that applies to the whole platform (e.g. order expiry, payment expiration thresholds). Stored and edited in Platform; consumed by backend and other apps (CMS, WeChat, etc.).
- **Out of scope (handled in CMS)**
  - Merchant business: member management, products, orders, partners, merchant-scoped settings.
  - Merchant join/apply flows: “申请成为商户”, “加入商户”, and related APIs belong in CMS. Platform does not implement or redirect to merchant-join or registration flows.

---

## 2. Login and account detection

- **Platform login accounts are platform-level admins.** Access is controlled by role (e.g. `super_admin`). These accounts are **not** required to be associated with a merchant.
- **Do not check or use the logged-in user’s `merchantId` in the Platform app.**  
  - No redirects or UI branches based on “user has no merchant” or “user has merchant”.  
  - No “join merchant” or “apply merchant” flows in Platform; those are in CMS.
- **Permission rule**: Only users with platform admin role (e.g. `isSuperAdmin`) may access Platform pages after login. Non–platform-admin users should be redirected to login/home (e.g. `/`).
- **Post-login**: After successful login, redirect to the main Platform entry (e.g. `/merchant-review`). No branching on `merchantId`.

---

## 3. Feature checklist (implementation)

| Feature | Description | Permission |
|--------|-------------|------------|
| Merchant review | List pending merchants; approve/reject. | super_admin |
| Platform settings | View/edit platform-level settings (e.g. order category). | super_admin |
| Reload settings | Reload platform settings from backend (e.g. after config change). | super_admin |

Menu and routes should expose only the above (and any future platform-only features). Do not add CMS-only features (e.g. merchant join, member management) to Platform.

---

## 4. References

- [System boundaries: Store, CMS, Platform](../docs/system-boundaries-and-platform.md) — high-level scope and login.
- Backend: admin merchants API, platform-setting API; auth returns user without requiring merchantId for platform admin use.
