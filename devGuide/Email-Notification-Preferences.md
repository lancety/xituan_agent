# Email notification preferences and SES suppression

## Tables (`platform`)

- `email_notification_preferences` — opt-out rows (`enabled = false`). Missing row means **subscribed**.
- `email_suppression` — bounce/complaint (and soft-bounce cooldown) by email address.

Migration: `xituan_backend/migrations/1710000000321_email_notification_preferences.sql`

## APIs

| Method | Path | Auth |
|--------|------|------|
| GET/PATCH | `/api/auth/notification-email-preferences` | Consumer JWT |
| GET/PATCH | `/api/admin/notification-email-preferences` | CMS + merchant context + `setting:read`/`write` |
| GET/PATCH | `/api/public/notification-email-preferences?token=` | HMAC token |
| POST | `/api/public/email/unsubscribe?token=` | One-click (RFC 8058) |
| POST | `/api/webhooks/ses` | SNS (signature verified) |

## Environment

| Variable | Purpose |
|----------|---------|
| `EMAIL_PREFERENCE_TOKEN_SECRET` | HMAC signing (required for preference links) |
| `API_PUBLIC_ORIGIN` | Optional; public backend host for `List-Unsubscribe` POST (same as OmiPay). If unset: `siteDomain.backend` for current `NODE_ENV` + `/api` |
| `SES_CONFIGURATION_SET` | Optional; attach to raw/simple SES sends for bounce events |

GitHub Actions: add secrets and entries in `xituan_backend/.github/workflows/deploy.yml`.

## AWS manual setup

1. SES **Configuration Set** → event publishing: **Bounce**, **Complaint** → SNS topic.
2. SNS **HTTPS subscription** → `https://{host}/api/webhooks/ses` (confirm subscription).
3. Deploy backend before subscribing so confirmation handler is live.

## UI

- Site: `/user/notification-preferences`, public `/email/notification-preferences?token=`
- WeChat: `pages/profile/notification-preferences`
- CMS: Settings → **通知偏好** tab

## Password reset

`PASSWORD_RESET_REQUESTED` bypasses preference checks; still respects `email_suppression`.
