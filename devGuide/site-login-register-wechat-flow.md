# Site Login, Register and WeChat Web Login – Design

## 1. Overview

- **Site (xituan_site)**: Consumer-facing web. Auth uses **normal login API** (`POST /api/auth/login`). JWT does **not** include `merchantId` (unlike CMS).
- **CMS**: Uses `POST /api/auth/cms/login` and JWT includes merchant context.
- **WeChat miniprogram**: Uses `POST /api/auth/wechat/login` with `code` from `wx.login()`; backend uses `jscode2session`. This is **not** used by the website.
- **WeChat website (PC)**: Uses **WeChat Open Platform “网站应用”** flow: QR code or redirect → user scans → callback with `code` → backend uses `sns/oauth2/access_token` (different API from miniprogram). Optional phase: add `/api/auth/wechat-web/login` and frontend QR/redirect.

## 2. Top Bar (Main Layout Right)

| State    | Right-side links |
|----------|-------------------|
| **Not logged in** | 账号登录, 购物车 |
| **Logged in**     | 我的, 订单, 地址管理, 购物车 |

- “账号登录” links to login page (e.g. `/[locale]/login`).
- Cart is always shown (guest cart supported).
- “我的” → `/user/profile`, “订单” → `/user/orders`, “地址管理” → `/user/addresses`, “购物车” → `/cart`.

## 3. Login Page

- **Route**: e.g. `/[locale]/login` (or `/login` with locale in path).
- **Content**:
  - **Login**: Email (or username) + password. Call `POST /api/auth/login` with `{ email, password }`. On success, store token and user in auth store, then redirect (e.g. home or `redirect` query).
  - **Register**: Email + password (and optional username). Call `POST /api/auth/register`. If backend returns 400 with message indicating email already exists (e.g. “邮箱已被注册”), show: “该邮箱已存在，可使用邮箱/用户名登录，或扫码微信登录。”
  - **WeChat (website)**: Optional. Either redirect to WeChat OAuth URL, or embed QR using official wxLogin.js; callback receives `code` and calls backend; backend uses **website** WeChat API (`sns/oauth2/access_token`), not `jscode2session`.

JWT from `/api/auth/login` and `/api/auth/register` for site: no `merchantId` (consumer context only).

## 4. Registration Flows

- **Email + password**: Existing `POST /api/auth/register` with `email`, `password`, optional `username`. Backend already checks email/phone existence and returns clear error (e.g. “邮箱已被注册”).
- **WeChat**: “WeChat register” = first-time WeChat login (backend creates user with `wechatOpenid`). No separate register form; after WeChat callback, if user is new, backend creates account (same as wechat-app flow but using website code exchange).

## 5. WeChat-Only Users: Password and Email Login

- If a user registered only via WeChat, they may have **no password** and placeholder email (e.g. `xxx@placeholder.com`).
- **Set password**: Backend to provide an endpoint (e.g. `POST /api/auth/me/set-password` or `PUT /api/auth/user/password`) for **authenticated** users who currently have no password (e.g. `registeredVia === WECHAT` and no `passwordHash`). Request body: `{ password }`. After setting, user can log in with email + password on site.
- **Email conflict on register**: If user tries to register with an email that already exists, show: “该邮箱已存在，可使用邮箱/用户名登录，或扫码微信登录。” No backend change needed if message is already “邮箱已被注册”; frontend maps that to the above copy.

## 6. WeChat Website Login (QR Code) – Flow

- **WeChat Open Platform** (网站应用), not miniprogram:
  - Doc: https://developers.weixin.qq.com/doc/oplatform/Website_App/WeChat_Login/Wechat_Login.html
  - Step 1 – Get code:
    - **Redirect**: Open `https://open.weixin.qq.com/connect/qrconnect?appid=APPID&redirect_uri=REDIRECT_URI&response_type=code&scope=snsapi_login&state=STATE#wechat_redirect`. User scans; WeChat redirects to `redirect_uri?code=xxx&state=xxx`.
    - **Embedded QR**: Load `http://res.wx.qq.com/connect/zh_CN/htmledition/js/wxLogin.js`, instantiate WxLogin with same params; QR appears in page; callback receives `code` via JS (no full redirect if using callback URL that returns HTML/JS to post message).
  - Step 2 – Backend: Receive `code` (and `state`) from frontend (e.g. callback page or postMessage). Call WeChat `https://api.weixin.qq.com/sns/oauth2/access_token?appid=APPID&secret=SECRET&code=CODE&grant_type=authorization_code` to get `openid` (and optionally `access_token` for userinfo). **This is different from miniprogram** which uses `sns/jscode2session`.
  - Step 3 – Find or create user by `openid`, create session and JWT (same as wechat miniprogram logic), return to site (no merchantId in JWT).
- **Backend**: New route, e.g. `POST /api/auth/wechat-web/login` with body `{ code, state }`. Use **website** WeChat app credentials and `oauth2/access_token` API. Reuse existing “find or create user by wechat openid” and session creation; do **not** use `jscode2session` (miniprogram only).
- **Config**: Website WeChat app may use different AppID/Secret from miniprogram; backend should support separate config for “wechat_web” (e.g. `WECHAT_WEB_APP_ID`, `WECHAT_WEB_APP_SECRET`) if applicable.

## 7. Summary Table

| Client        | Login API                    | Code exchange              | JWT content   |
|---------------|------------------------------|----------------------------|---------------|
| Site (email)   | `POST /api/auth/login`       | N/A                        | No merchantId |
| Site (WeChat web) | `POST /api/auth/wechat-web/login` (optional) | `sns/oauth2/access_token` | No merchantId |
| CMS           | `POST /api/auth/cms/login`   | N/A                        | With merchantId |
| WeChat app    | `POST /api/auth/wechat/login`| `sns/jscode2session`        | No merchantId |

## 8. Implementation Order

1. **Top bar**: Use auth context; show “账号登录” + “购物车” when guest, “我的” + “订单” + “地址管理” + “购物车” when logged in.
2. **Site auth service**: Wrapper for `POST /api/auth/login` and `POST /api/auth/register` (base URL from env), then update auth store.
3. **Login page**: Route + form (login + register tabs/sections); handle “email already exists” message; optional “WeChat login” entry (redirect or QR) when backend is ready.
4. **Backend**: Ensure register returns clear code/message for “email already exists”; add `set-password` for authenticated WeChat users without password.
5. **WeChat web (optional)**: Backend `wechat-web/login` + frontend redirect or wxLogin.js QR; config for website app credentials.
