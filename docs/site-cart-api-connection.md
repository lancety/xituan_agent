# Site cart: API connection and activity info

## 1. net::ERR_CONNECTION_REFUSED (产品信息 / 活动信息 都拿不到)

前端所有接口（购物车、活动批量、商品详情、商户信息）都走同一个 API 基地址：

- 默认：`process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3050/api'`
- 若未配置或后端未启动，会出现 **net::ERR_CONNECTION_REFUSED**，表现为：
  - 产品名称/图片显示为 "Product info unavailable"
  - 活动标题只显示默认「团购活动」，没有真实标题和日期
  - Network 里看不到 `POST /carts/activity-info`（因为 GET /carts 先失败，没有 items 就不会发活动批量请求）

**处理步骤：**

1. 启动后端（xituan_backend），并确认监听端口（例如 3050）。
2. 在 site 项目根目录配置 `.env`（可参考 `.env.template`）：
   ```bash
   NEXT_PUBLIC_API_URL=http://localhost:3050/api
   ```
3. 若后端跑在别的机器或端口，改成对应地址，例如：
   ```bash
   NEXT_PUBLIC_API_URL=https://your-backend.example.com/api
   ```
4. 修改 `.env` 后需**重启** site 的 dev server（`next dev`），否则 `NEXT_PUBLIC_*` 不会更新。

## 2. 活动标题和日期 + 批量活动接口

- 活动标题、开始/结束日期来自 **POST /carts/activity-info**，在拉取购物车成功后、且当前有团购/预定商品时才会调用。
- 若 **GET /carts** 因连接失败返回空或失败，则不会发 **POST /carts/activity-info**，界面只会显示默认「团购活动」且无日期。
- 控制台日志（便于排查）：
  - `[Cart API] getCart request: <url>`：当前使用的 API 基地址。
  - `[Cart API] getCart failed: <reason>`：getCart 失败原因（如 connection refused）。
  - `[Cart] Calling POST /carts/activity-info, offers=... promotes=...`：开始请求活动批量接口。
  - `[Cart] activity-info OK, offers=... promotes=...`：活动批量成功，之后列表会显示真实活动标题和日期。

先保证后端可连通、`NEXT_PUBLIC_API_URL` 正确并重启 site，再根据上述日志确认活动批量是否被调用。
