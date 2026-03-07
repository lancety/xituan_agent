# System Monitoring — CMS

Details for system monitoring in xituan_cms (merchant-facing). Merchants are the primary owners of their funds; CMS provides the main monitoring UI for their own data.

See also: [System Monitoring — Overview](./System-Monitoring-Overview.md), [System Monitoring — Platform](./System-Monitoring-Platform.md).

---

## 1. Menu Group

- **Group**: 系统监控 (System Monitoring)
- **Group enum**: `epSiteMenuGroupPC.MONITORING` (or equivalent)
- Each monitoring domain is a separate menu item and page — no single page with tabs.

---

## 2. Pages and Routes

| Menu Item | Route | Permission |
|-----------|-------|------------|
| 订单支付监控 | `/monitoring/order-payment` | 支付相关阅读权限（待确认：ORDER_LIST 或新增 PAYMENT_READ） |
| Webhook 监控 | `/monitoring/webhooks` | 同上 |

---

## 3. Order Payment Monitoring (`/monitoring/order-payment`)

### 3.1 Content

- List alerts for the current merchant (alert_orders_payments)
- Commitment payment stats (expired, suspended users, etc.)
- Process expired commitments (for own merchant)

### 3.2 API

- `GET /api/admin/alert-orders-payments` — list alerts (merchant-scoped via X-Merchant-Id)
- `GET /api/admin/alert-orders-payments/user/:userId`
- `GET /api/admin/commitment-payment/stats`
- `POST /api/admin/commitment-payment/process-expired`

All require auth + merchant context (requestContextMiddleware, requireMerchantAccess).

### 3.3 File Structure

```
src/pages/monitoring/
  order-payment.tsx
  webhooks.tsx
```

### 3.4 UI Layout

- **Filter bar**: Independent from table; query and table separated.
- **ResponsiveTable**: Desktop = Table; mobile = Cards. See [responsive-table-solution](./responsive-table-solution.md), skills **responsive-table-mobile-card-styling**, **mainlayout-content-padding-rule**.

### 3.5 API Client

- `src/lib/api/commitment-payment.api.ts` — uses `/admin/alert-orders-payments`, `/admin/commitment-payment/*`
- Backend routes: `alert-orders-payments.routes.ts` (merchant-scoped)

---

## 4. Webhook Monitoring (`/monitoring/webhooks`)

### 4.1 Content

- List webhook events for the current merchant
- Stats (total, received, processing, processed, failed)
- Retry failed events (own merchant only)
- Filter by status, eventType, merchantOrderId, paymentIntentId

### 4.2 API

- `GET /api/admin/webhooks/stats`
- `GET /api/admin/webhooks/events` (with pagination, status, eventType filters)
- `POST /api/admin/webhooks/retry/:eventId`

All require auth + merchant context.

### 4.3 UI Layout

- Same as order-payment: independent filter bar + ResponsiveTable; desktop and mobile layouts.

### 4.4 API Client

- `src/lib/api/webhook.api.ts` — uses `/admin/webhooks/*`
- Backend routes: `webhook-management.routes.ts` (merchant-scoped)

---

## 5. References

- [System Monitoring — Overview](./System-Monitoring-Overview.md)
- [System Monitoring — Platform](./System-Monitoring-Platform.md)
- [Commitment Payment Design](./commitment-payment-design.md)
- [Airwallex Webhook Multi-Tenant](./airwallex-webhook-multi-tenant.md)
