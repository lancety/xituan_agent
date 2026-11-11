# App Store Resolution Center reply draft（Merchant 4.x）

Last updated: 2026-11-11

Paste into App Store Connect Resolution Center (English). Adjust build number after shipping account-deletion + iOS Stripe unlink.

---

Thank you for the review.

**Guideline 5.1.1(v) — Account deletion**

The app provides in-app account deletion (More → Delete account). The user confirms, then enters a 7-day pending period with a home banner showing the due time and a Cancel button. After the grace period we anonymise personal profile data. Merchant admins also take the store offline (`inactive`); store content is kept. Email to support is optional for questions only and is not required to delete.

**Guideline 2.1 — PassKit / Apple Pay**

PassKit previously appeared via the Stripe React Native dependency used for Android subscription wallets. This iOS build no longer links Stripe/Apple Pay for subscriptions. Subscription purchase UI remains disabled on iOS pending a future In-App Purchase update. There is no Apple Pay checkout for digital subscriptions in this build.

**Guideline 2.1(b) — Business model**

1. Users of paid plans are merchant operators (business users), not consumers of digital media.
2. In this iOS build, users cannot purchase subscriptions in the app. Checkout, payment buttons, Stripe/non-IAP payment, and external billing links for plans are removed. Plan info is view-only. We plan App Store IAP in a later update.
3. Previously purchased / externally billed plans may still unlock operational features associated with the merchant account. There is no consumer digital content library.
4. This build does not sell or unlock paid digital features via in-app checkout without IAP.

Please let us know if anything else is needed.
