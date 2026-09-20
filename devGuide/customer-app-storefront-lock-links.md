# 客户 App 锁店深链

Last updated: 2026-09-20

系统相机扫 **Web 店码**（HTTPS `{code}.m.*`）可在关联域验证通过后唤起客户 App 并内存锁店。微信内置浏览器 **不会**自动走 Universal Link，Site 店面显示「打开喜团 App」。

## 结论表

| 项 | 约定 |
|----|------|
| 店链 | 不新造；Web 码仍是 `merchantStorefrontUtil.buildStorefrontOrigin` |
| 锁态 | 仅内存；杀进程后从图标打开 = 平台首页 |
| 环境 | host 解析出的 `environment` 必须等于当前 App `EXPO_PUBLIC_APP_ENV`（正式包默认 prod） |
| 调试 | `xituancustomer://storefront?code=` 或 `merchantId=`（不依赖 AASA） |
| 微信扫 Web 码 | 内置浏览器 + 顶栏按钮；太阳码仍进小程序 |

## 启动顺序

1. 重置密码 `token=` 优先，不锁店
2. 解析店链；未登录则 pending，登录后再 `apply`
3. 无店链时才看 OpenIM push
4. 先上锁再进 `HomeScreen`，避免闪平台首页

## 验证文件

必须能在 **店面子域** 拉到（不是只挂主站）：

- `https://{code}.m.xituan.com.au/.well-known/apple-app-site-association`
- `https://{code}.m.xituan.com.au/.well-known/assetlinks.json`

文件已占位：`TEAMID`、`SHA256_PLACEHOLDER_*`。未替换前系统相机 App Link 验不过。Play 还没上传 AAB 时没有 App signing 页。

## 相关代码

- `xituan_app_customer/src/utils/storefront-entry-url.util.ts`
- `xituan_app_customer/src/utils/storefront-lock.util.ts`
- `xituan_app_customer/App.tsx`
- `xituan_site/src/components/layout/OpenCustomerAppBanner.tsx`
- `xituan_wechat_app/utils/storefront-lock.wechat.util.ts`

## 相关文档

- [site-host-storefront-surface.md](./site-host-storefront-surface.md)
