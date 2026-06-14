# 微信小程序 Bootstrap Gate（分享冷启动）

Last updated: 2026-06-13

## 背景

分享链接冷启动直达活动/商品页时，目标页 JS 与 `app.onLaunch` 里 `await ensureReady()` **并行**加载。若在**模块求值阶段**（static import、`Component({ properties })` 默认值、`pageConfig.data` 初始化）读取 `codebaseBootstrapAccessUtil`，会抛出 `Bootstrap not ready`。

Tab 进首页不易复现，因为不会 eager 加载上述模块链。

## 微信运行时约束（重要）

**`Page()` / `Component()` 必须在 app.json 所列页面的模块初始化阶段同步调用。**

不能在 `Promise.then`、`setTimeout` 或 `require('./xxx.impl')` 的异步回调里注册，否则会出现：

- `Component constructors should be called while initialization`
- `Please do not call Page constructor in files that not listed in "pages" section`
- `wx://not-found`

因此 **entry/impl + 延迟 registerPage/registerComponent 方案不可用**。页面/组件仍保持单文件，末尾同步 `Page(...)` / `Component({...})`。

## 当前方案

| 层 | 做法 |
|----|------|
| 尽早 bootstrap | `app.ts` 模块顶层 `void startBootstrap()`；`onLaunch` `await startBootstrap()` |
| 页面 runtime | `page-mixin` 的 `onLoad` 共用同一 `startBootstrap()`，再调 `onLoadPage` |
| 组件定义阶段 | `properties` / `data` 默认值用 **`lib/wechat-main-constants/`**（manifest sync 自 codebase），不用 `codebaseBootstrapAccessUtil` |
| 组件 runtime | 需 `wechatNavSvgUtil` 等 bootstrap 导出的，在 `attached` / observer 里 `await startBootstrap()` 后再读 |
| import 链 | util 模块顶层 bootstrap 改为 **惰性初始化** |

Gate 文件：`lib/codebase-bootstrap-gate.util.ts`（仅 `startBootstrap()`，不含 Page/Component 队列）。

## 模块顶层 bootstrap 禁令（主包）

禁止在模块顶层读取 `codebaseBootstrapAccessUtil`：

- 顶层 `const x = codebaseBootstrapAccessUtil....`
- `Component({ properties: { value: codebaseBootstrapAccessUtil.... } })`
- `pageConfig.data` 初始化里调用依赖 bootstrap 的函数

**改法：**

1. 常量 / enum → **`lib/wechat-main-constants/`**（manifest 整文件 sync，见 [wechat-subpackage-bootstrap-contract.md](./wechat-subpackage-bootstrap-contract.md)）
2. 业务 util → 惰性 getter / 函数内初始化
3. 需 bootstrap 服务 → `onLoadPage`、`attached`（先 `await startBootstrap()`）

已惰性化的 util：`cart-checkout-validate.wechat.util.ts`、`theme-mode.util.ts`、`cart-page-theme.wechat.util.ts`。

已用 wechat-main-constants 的组件：`nav-icon`、`direct-entry-home-btn`、`custom-page-nav`。

守门：`npm run lint`（verify + ESLint local rules）。

## 验证清单

1. 分享冷启动：`offer-detail`、`preorder-promote`、`product-detail`、`product-custom`
2. 无 `Bootstrap not ready`、无 `wx://not-found`、无 constructor ignored
3. `nav-icon` / `direct-entry-home-btn` 正常渲染
4. Tab 进首页行为不变
5. 活动页加购 / 结算校验正常

## 相关文档

- [wechat-subpackage-bootstrap-contract.md](./wechat-subpackage-bootstrap-contract.md) — manifest sync、ESLint、multirepo 步骤
- `payment-wechat-app-pay.md`
- `wechat-app-multi-tenant-migration-plan.md`
