# Payment expiration (platform order settings)

**Deprecated:** `cashExpirationMinutes` and `bankTransferExpirationMinutes` were removed from `iOrderSettings` and from platform admin UI.

Cash and bank transfer pending orders are **not** auto-expired by platform cron (`InventoryCronService` excludes these methods). Merchants manage stock release (e.g. CMS **库存占用检查**, **cancel-by-merchant**).

Technical `inventory_locks.expires_at` uses a long fixed offset from `OrderExpiryService.OFFLINE_PAYMENT_EXPIRY_OFFSET_MINUTES` (not a customer-facing deadline).

Migration `1710000000307_remove_order_offline_expiration_threshold_keys.sql` strips legacy keys from `platform.platform_settings` where `category = 'order'`.
