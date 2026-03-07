# System Monitoring — Platform

Details for system monitoring in xituan_platform (platform-facing). Platform supports merchants; monitoring is used to view anomalies and filter by merchant or event_id when assisting.

See also: [System Monitoring — Overview](./System-Monitoring-Overview.md), [System Monitoring — CMS](./System-Monitoring-CMS.md).

---

## 1. Menu Group

- **Group**: 系统监控 (System Monitoring)
- **Group enum**: `epPlatformMenuGroupPC.MONITORING` (or equivalent)
- Each monitoring domain is a separate menu item and page — no single page with tabs.

---

## 2. Pages and Routes

| Menu Item | Route | Permission |
|-----------|-------|------------|
| 订单支付监控 | `/monitoring/order-payment` | platform role (ADMIN/SUPER_ADMIN) |
| Webhook 监控 | `/monitoring/webhooks` | platform role |
| 未匹配 Webhook | `/monitoring/webhooks-unmatched` | platform role |
| 用户监控 | `/monitoring/users` | platform role (placeholder) |

---

## 3. Order Payment Monitoring (`/monitoring/order-payment`)

### 3.1 Content

- List alerts for all merchants; optional `?merchantId=` filter
- Commitment payment stats (all or filtered)
- Process expired commitments (all merchants or filtered)

### 3.2 API

- `GET /api/admin/platform/alert-orders-payments` — all merchants; `?merchantId=` optional
- `GET /api/admin/platform/alert-orders-payments/user/:userId`
- `GET /api/admin/platform/commitment-payment/stats`
- `POST /api/admin/platform/commitment-payment/process-expired`

No merchant context required; platform role only.

### 3.3 UI Layout

- Independent filter bar (merchantId, etc.) + ResponsiveTable; desktop and mobile.

### 3.5 File Structure

```
src/pages/monitoring/
  order-payment.tsx
  webhooks.tsx
  webhooks-unmatched.tsx
  users.tsx  (placeholder)
```

### 3.6 API Client

- `src/lib/api/commitment-payment.api.ts` — uses `/admin/platform/*` prefix

---

## 4. Webhook Monitoring (`/monitoring/webhooks`)

### 4.1 Content

- List webhook events for all merchants
- Filter by `?merchantId=`, `?eventId=`, `?merchantOrderId=`, `?paymentIntentId=`
- Stats and retry failed events

### 4.2 API

- `GET /api/admin/platform/webhooks/stats`
- `GET /api/admin/platform/webhooks/events`
- `GET /api/admin/platform/webhooks/details/:eventId`
- `POST /api/admin/platform/webhooks/retry/:eventId`

### 4.3 Filter Bar and Table Layout

- **Filter bar**: Independent from table; query and table separated. Supports merchantId, eventId, merchantOrderId filters.
- **ResponsiveTable**: Desktop = Table; mobile = Cards. See [responsive-table-solution](./responsive-table-solution.md), skills **responsive-table-mobile-card-styling**, **mainlayout-content-padding-rule**.
- Implement both desktop and mobile layouts.

### 4.4 Filtering for Support

- **merchantId** — narrow to one merchant (dropdown or search; use `GET /api/admin/merchants`)
- **eventId** — locate specific event (cross-merchant)
- **merchantOrderId** — locate by order ID

---

## 5. Unmatched Webhooks (`/monitoring/webhooks-unmatched`)

### 5.1 Content

- List events from `platform.webhook_events_airwallex_unmatched`
- These are webhook events that could not be resolved to a merchant (e.g. missing metadata)
- Platform-only; no merchant can see these

### 5.2 API (step 3 — to be implemented)

- `GET /api/admin/platform/webhooks-unmatched` — list unmatched events (pagination, filters)
- Backend: `WebhookEventService` has `saveUnmatchedWebhookEvent`, `isEventInUnmatched`; read API to be added

### 5.3 UI Layout

- Same as other monitoring pages: independent filter bar + ResponsiveTable.

### 5.4 Reference

- [Airwallex Webhook Multi-Tenant](./airwallex-webhook-multi-tenant.md) — unmatched table design

---

## 6. References

- [System Monitoring — Overview](./System-Monitoring-Overview.md)
- [System Monitoring — CMS](./System-Monitoring-CMS.md)
- [Platform App Design](./platform-app-design-and-implementation.md)
- [Airwallex Webhook Multi-Tenant](./airwallex-webhook-multi-tenant.md)
