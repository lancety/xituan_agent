# Site Host-first Storefront（Surface / Tenant）

Last updated: 2026-08-21

主域与商户子域（及后续自有域）用 **Host 定 Surface**，双对外 path 形状 + 双 Layout + 单套业务 View + 唯一 URL 工厂。API Scope 分期叠加，不得破坏小程序跨商户契约。

## 结论表

| 项 | 约定 |
|----|------|
| Surface | `platform`（主域）/ `storefront`（`{code}.m.*` 或已验证自有域） |
| Tenant | storefront：Host→code→merchantId；platform 进店：path `/merchant/{merchantId}` |
| 平台列表进店 | 留主域 `/merchant/{id}/...` |
| 分享/子域 | storefront；地址栏不跳主域 |
| 主域目录 | 不强制搬入 `(platform)/` |
| 旧 `/store/[code]` | 不兼容；禁止再 redirect 到主域 |

## Must-follow（小程序）

1. 平台态跨商户 API 默认行为不得收窄。
2. Scope 只叠加：显式 storefront/`X-Merchant-Id` 等才收紧。
3. 不因 API Scope 改小程序页面结构。
4. 改 cart/orders/messages scope 须回归：桌面无锁冷启动 + 带 merchantId 锁态冷/热启动。

## Surface × Host

| Host | Surface |
|------|---------|
| `xituan.com.au` / `www` / 各环境 website | platform |
| `{code}.` + `merchantStorefront` 基域 | storefront |
| 已验证 custom domain（Phase 4） | storefront |

## 对外 Route map

**Platform**

- `/{locale}` 平台首页
- `/{locale}/merchant/{merchantId}/...` 进店
- `/{locale}/cart`、`/user/orders`、`/user/messages` 等跨商户

**Storefront（浏览器地址，无 `/merchant/{id}`）**

- `/{locale}` 本店首页
- `/{locale}/products|offers|preorder|news/...`
- `/{locale}/cart`、`/user/orders`、`/user/messages` 等仅本店

## 实现注记（单 Next 应用）

storefront Host 上：

- 首页与店铺短 path（`products|offers|preorder|news|cart|user`）rewrite 到 `/_storefront/...`（浏览器 URL 不含此前缀）。
- 内部前缀必须是 **`sf`**（不能用 `_storefront`：Next.js 会把 `_` 开头目录当作 private folder，不参与路由 → 404）。
- `login|checkout|search|payment…` 等共享路由：不 rewrite，只注入 Surface headers；Context 仍为 storefront。
- URL 工厂只生成对外 path；禁止再 `redirect` 到主域 `/merchant/{id}`。

## Host × 树允许矩阵

| Host \ Path | `/merchant/{id}/...` | 短 path `/products/...` | `/_storefront/...` 直链 |
|-------------|----------------------|-------------------------|-------------------------|
| platform | 允许 | 404 | 404 |
| storefront | 404 | 允许（rewrite 内部） | 勿对外暴露（可 404） |

## 分期

- Phase 1–2：Context、middleware、URL 工厂、storefront 树与壳、主域平台首页对齐；UI/请求参数按 tenant 过滤。
- Phase 3：后端 API Scope 叠加。
- Phase 4：CMS 自有域、动态 CORS、分 Host 会话。

## 相关代码

- `xituan_site/src/middleware.ts`
- `xituan_site/src/contexts/StorefrontContext.tsx`
- `xituan_site/src/utils/site-storefront-url.util.ts`
- `xituan_codebase/utils/merchant-storefront.util.ts`

## 相关文档

- 小程序锁态：`xituan_wechat_app/utils/storefront-lock.wechat.util.ts`（概念对齐，非同一套 Host）
