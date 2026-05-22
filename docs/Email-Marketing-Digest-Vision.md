# Email marketing digest (future)

This document describes planned marketing email behaviour. **v1 does not send marketing emails.**

## Audience

- End customers who **follow** merchants on the platform.
- Content is **merchant-scoped** marketing composed by the merchant (or platform templates), delivered in a **platform-branded HTML email**.

## Categories (preference keys)

| Key | Description |
|-----|-------------|
| `MARKETING_NEW_ARRIVAL` | New products listed by followed merchants |
| `MARKETING_PROMOTION` | Promotions / discounts |
| `MARKETING_HOT_PICK` | Editorial “hot pick” recommendations |

UI switches exist in Site / WeChat profile and CMS settings but are **disabled** until send pipelines exist.

## Unsubscribe

- Same `email_notification_preferences` table and HMAC preference links as business mail.
- Per-category opt-out; digest emails must include `List-Unsubscribe` and footer link to preference page.

## Open questions

- Per-merchant vs aggregated digest per user per day.
- Whether marketing opt-out is per merchant followed or global per category.
