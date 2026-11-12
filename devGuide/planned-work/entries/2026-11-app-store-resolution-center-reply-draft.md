# App Store Resolution Center reply draft（Merchant App）

Last updated: 2026-11-12

Paste into App Store Connect → Resolution Center (English).  
Replace `[BUILD]` with the build number under review after you upload the build that includes in-app deletion + iOS Stripe unlink.

---

Thank you for the review. We have addressed the issues in build **[BUILD]** as follows.

**Guideline 5.1.1(v) — Account deletion**

The app now provides fully in-app account deletion. Email to support is optional for questions only and is **not** required to delete an account.

How to verify:
1. Sign in with a merchant account.
2. Open **More** (bottom / more menu).
3. Tap **Delete account** and confirm.
4. The account enters a **7-day** pending period. A banner on the **Home** screen shows the deletion due time and a **Cancel** button.
5. Within 7 days the user can cancel; after the grace period we anonymise personal profile data so the account can no longer be used.
6. If the signed-in user is a store **Admin**, confirming deletion also takes that store offline (status inactive). Store content (products, settings, media, etc.) is retained for legal/business records and is not wiped as part of this flow. Non-admin members only delete their own user account and do not take the store offline.

**Guideline 2.1 — PassKit / Apple Pay**

PassKit previously appeared because the Stripe React Native SDK (used for Android subscription wallets) was linked on iOS. **This iOS build no longer links Stripe / Apple Pay.** There is no Apple Pay or PassKit checkout path for digital subscriptions in this build.

**Guideline 2.1(b) — Business model**

1. Paid plans are for **merchant operators** (business users running a store), not for consumers buying digital media or content.
2. In this iOS build, users **cannot purchase** subscriptions in the app. In-app checkout, payment buttons, Stripe / non-IAP payment, and external billing links for plans are removed or unavailable. Plan information is view-only.
3. Previously purchased or externally billed plans may still unlock operational features on the merchant account. There is no consumer digital content library unlocked by payment.
4. We plan to add App Store In-App Purchase for subscriptions in a later update. Until then, this build does not sell or unlock paid digital features via in-app checkout without IAP.

Please let us know if anything else is needed. Thank you.
