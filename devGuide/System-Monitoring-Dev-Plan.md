# System Monitoring — Development Change Plan

A phased implementation plan for system monitoring features. See [System Monitoring — Overview](./System-Monitoring-Overview.md) for design context.

---

## Phase 1: Backend — PAYMENT_READ Permission

### 1.1 Add PAYMENT_READ

- [x] `xituan_backend/src/shared/constants/merchant-role-permissions.ts`: Add `PAYMENT_READ: 'payment:read'` to `MERCHANT_PERMISSION_KEYS`
- [x] Add `PAYMENT_READ` to `DEFAULT_ROLE_PERMISSIONS` for `epMerchantRole.ADMIN` and `epMerchantRole.MANAGER` (and others as needed)
- [x] `xituan_cms/src/components/layout/site-menu.config.tsx`: Add `PAYMENT_READ` to `MERCHANT_PERMISSION_KEYS`

### 1.2 Switch Routes to PAYMENT_READ

- [x] `xituan_backend/src/domains/order/routes/alert-orders-payments.routes.ts`: Replace `ORDER_LIST` with `PAYMENT_READ`
- [x] `xituan_backend/src/domains/payment/routes/webhook-management.routes.ts`: Add `requireMerchantPermission(PAYMENT_READ)`

---

## Phase 2: CMS — New Monitoring Pages

### 2.1 Menu and Routes

- [ ] `xituan_cms/src/components/layout/site-menu.enum.ts`: Add `epSiteMenuGroupPC.MONITORING`, `epSiteMenu.MONITORING_ORDER_PAYMENT`, `epSiteMenu.MONITORING_WEBHOOKS`
- [ ] `xituan_cms/src/components/layout/site-menu.config.tsx`: Add MONITORING group, configure menu items with `requiredPermission: PAYMENT_READ`

### 2.2 Order Payment Monitoring Page

- [ ] Create `xituan_cms/src/pages/monitoring/order-payment.tsx`
  - Stats cards (commitment payment stats)
  - Independent filter bar (alertType, severity, userId)
  - ResponsiveTable (desktop Table, mobile Cards)
  - Process expired commitments button
  - Use `commitmentPaymentApi` (already calls `/admin/alert-orders-payments`, `/admin/commitment-payment/*`)
  - Layout: MainLayout, cms-main-content-wrapper, cardStyle per mainlayout-content-padding-rule

### 2.3 Webhook Monitoring Page

- [ ] Create `xituan_cms/src/pages/monitoring/webhooks.tsx`
  - Stats cards (total, received, processing, processed, failed)
  - Independent filter bar (status, eventType, merchantOrderId, paymentIntentId)
  - ResponsiveTable with retry action for failed events
  - Use `webhook.api.ts` (already calls `/admin/webhooks/*`)
  - Layout: same as order-payment

### 2.4 API Client

- [ ] Verify `xituan_cms/src/lib/api/commitment-payment.api.ts` uses merchant-scoped paths (`/admin/alert-orders-payments`, etc.)
- [ ] Verify `xituan_cms/src/lib/api/webhook.api.ts` uses merchant-scoped paths (`/admin/webhooks/*`)

---

## Phase 3: Platform — Split Pages and Add Unmatched API

### 3.1 Remove Old Monitoring Page

- [ ] Delete or replace `xituan_platform/src/pages/monitoring.tsx` (single page with tabs)
- [ ] Remove `/monitoring` route (no redirect)

### 3.2 Menu and Routes

- [ ] `xituan_platform/src/components/layout/site-menu.enum.ts`: Replace single `MONITORING` with `MONITORING_ORDER_PAYMENT`, `MONITORING_WEBHOOKS`, `MONITORING_WEBHOOKS_UNMATCHED`, `MONITORING_USERS`
- [ ] `xituan_platform/src/components/layout/site-menu.config.tsx`: Update menu config for new structure

### 3.3 Order Payment Monitoring Page

- [ ] Create `xituan_platform/src/pages/monitoring/order-payment.tsx`
  - Filter bar: merchantId (dropdown, use `GET /api/admin/merchants`)
  - Stats, ResponsiveTable
  - Use `commitmentPaymentApi` (already uses `/admin/platform/*`)

### 3.4 Webhook Monitoring Page

- [ ] Create `xituan_platform/src/pages/monitoring/webhooks.tsx`
  - Filter bar: merchantId, eventId, merchantOrderId, paymentIntentId
  - Stats, ResponsiveTable, retry
  - Use `webhook.api.ts` (already uses `/admin/platform/webhooks/*`)

### 3.5 Unmatched Webhooks — Backend API

- [ ] `WebhookEventService`: Add `getUnmatchedEvents(params)` method (read from `platform.webhook_events_airwallex_unmatched`)
- [ ] Create `PlatformWebhookUnmatchedController` or extend platform webhook controller
- [ ] Add route `GET /api/admin/platform/webhooks-unmatched` (pagination, filters)
- [ ] Register route in `app.ts` before `/api/admin` catch-all

### 3.6 Unmatched Webhooks — Platform Page

- [ ] Create `xituan_platform/src/pages/monitoring/webhooks-unmatched.tsx`
  - Filter bar, ResponsiveTable
  - Add `webhook.api.ts` method for unmatched API

### 3.7 Users Monitoring Placeholder

- [ ] Create `xituan_platform/src/pages/monitoring/users.tsx` (placeholder content)

---

## Phase 4: Verification and Cleanup

### 4.1 Verification

- [ ] CMS: Menu shows 系统监控 with 订单支付监控, Webhook 监控; PAYMENT_READ required
- [ ] Platform: Menu shows 系统监控 with 4 items; no old /monitoring
- [ ] CMS pages: filter + table separated; desktop and mobile layouts
- [ ] Platform pages: merchantId/eventId filters work; unmatched page loads

### 4.2 Cleanup

- [ ] Remove any orphaned imports or routes
- [ ] Update docs/guides if any references to old structure remain

---

## References

- [System Monitoring — Overview](./System-Monitoring-Overview.md)
- [System Monitoring — CMS](./System-Monitoring-CMS.md)
- [System Monitoring — Platform](./System-Monitoring-Platform.md)
- [responsive-table-solution](./responsive-table-solution.md)
- [mainlayout-content-padding-rule](../.cursor/skills/mainlayout-content-padding-rule/SKILL.md) (or MainLayout devGuide)
