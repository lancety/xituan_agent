# System Monitoring — Overview

High-level design for system monitoring features in CMS and Platform. Each monitoring domain has its own page under a dedicated "系统监控" (System Monitoring) menu group — not a single page with tabs.

---

## 1. Responsibility Model (Airwallex Payment for SaaS)

| Role | Responsibility | Data Scope |
|------|----------------|------------|
| **Merchant (CMS)** | Primary: view and manage own funds, alerts, webhooks. Proactive daily ops. | Own merchant only |
| **Platform** | Support: view anomalies when assisting merchants. Filter by merchant or event_id. | All merchants or filtered |

Merchants have their own funding pool accounts; they own monitoring. Platform assists with cross-merchant views and filtering.

---

## 2. Menu and Page Structure

### 2.1 Menu Group

Both CMS and Platform use a **系统监控** (System Monitoring) menu group. Each monitoring domain is a separate menu item and page.

### 2.2 CMS Pages

| Menu Item | Route | Content |
|-----------|-------|---------|
| 订单支付监控 | `/monitoring/order-payment` | Own merchant alerts, commitment-payment stats, process expired |
| Webhook 监控 | `/monitoring/webhooks` | Own merchant webhook events, stats, retry failed |

### 2.3 Platform Pages

| Menu Item | Route | Content |
|-----------|-------|---------|
| 订单支付监控 | `/monitoring/order-payment` | All merchants; filter by `?merchantId=` |
| Webhook 监控 | `/monitoring/webhooks` | All merchants; filter by `?merchantId=`, `?eventId=` |
| 未匹配 Webhook | `/monitoring/webhooks-unmatched` | `platform.webhook_events_airwallex_unmatched` (platform-only) |
| 用户监控 | `/monitoring/users` | Placeholder for future |

---

## 3. Backend API Split

| API Prefix | Auth | Scope | Used By |
|------------|------|-------|---------|
| `/api/admin/alert-orders-payments` | auth + merchantId | Merchant | CMS |
| `/api/admin/webhooks/*` | auth + merchantId | Merchant | CMS |
| `/api/admin/platform/alert-orders-payments` | auth + platform role | All (optional `?merchantId=`) | Platform |
| `/api/admin/platform/webhooks/*` | auth + platform role | All (optional `?merchantId=`, `?eventId=`) | Platform |

Unmatched webhooks: Platform-only API (to be added) for `platform.webhook_events_airwallex_unmatched`.

---

## 4. Filtering for Platform Support

Platform monitoring pages should support:

- **merchantId** — filter to a specific merchant
- **eventId** — locate a specific event across merchants
- **merchantOrderId** — locate by order ID

---

## 5. API Summary

### 5.1 Unused or No Longer Applicable APIs

| API | Status | Note |
|-----|--------|------|
| *(none)* | — | Existing merchant and platform APIs remain in use. Old Platform single `/monitoring` page will be removed; API endpoints unchanged. |

### 5.2 New APIs to Add

| API | Purpose |
|-----|---------|
| `GET /api/admin/platform/webhooks-unmatched` | List events from `platform.webhook_events_airwallex_unmatched`; support pagination and filters. Implement in step 3. |

### 5.3 Existing APIs (unchanged)

- Merchant: `/api/admin/alert-orders-payments`, `/api/admin/commitment-payment/*`, `/api/admin/webhooks/*`
- Platform: `/api/admin/platform/alert-orders-payments`, `/api/admin/platform/commitment-payment/*`, `/api/admin/platform/webhooks/*`

---

## 6. Implementation Decisions

| Item | Decision |
|------|----------|
| Old Platform `/monitoring` | Remove (no redirect). New structure fully replaces. |
| Unmatched Webhook | Implement in step 3 (after CMS and Platform split). |
| CMS permission | 支付相关阅读权限 (to be confirmed: use ORDER_LIST or add PAYMENT_READ). |
| Platform permission | platform role (ADMIN/SUPER_ADMIN) — agreed. |
| Filter / Table layout | Independent filter bar (query and table separated); ResponsiveTable; desktop and mobile layouts. See [ResponsiveTable Solution](./responsive-table-solution.md), skill **responsive-table-mobile-card-styling**, **mainlayout-content-padding-rule**. |

---

## 7. References

- [System Monitoring — CMS](./System-Monitoring-CMS.md) — CMS pages and implementation
- [System Monitoring — Platform](./System-Monitoring-Platform.md) — Platform pages and implementation
- [Airwallex Webhook Multi-Tenant](./airwallex-webhook-multi-tenant.md) — webhook merchant resolution, unmatched table
- [Airwallex Webhook Dev Setup](./airwallex-webhook-dev-setup.md) — local dev setup; section 5.5.3 / 7 reference monitoring pages
- [Commitment Payment Design](./commitment-payment-design.md) — commitment payment logic and alerts
- [Responsive Table Solution](./responsive-table-solution.md) — filter + table layout, desktop/mobile
