# app-release-update-flow

Last updated: 2026-10-09（本地签名验收完成；当前窗口先 iOS TF；prod OTA 延后）

## 摘要

为 `xituan_app_customer` / `xituan_app_merchant` 落地 **商店原生更新 + 自建 Expo OTA（content CDN）+ Platform 强制更新（minVersion）**。  
**不是** post-deploy Phase N：方案已定稿；**ASC App 已创建 → 实施中（active）**。

Cursor 方案原稿：`self-hosted_app_ota` plan（本机 `.cursor/plans`）。

### 实施钉死（2026-10-08）

| 项 | 决定 |
|----|------|
| `runtimeVersion` | `{ "policy": "appVersion" }`（跟 `expo.version`） |
| channel | 暂维持 `preview` \| `production`；App 用 `updates.requestHeaders["expo-channel-name"]`。自由 channel（`dev` / `dev-a` 等）见下方 **触发后才做的**，未触发前不改枚举 |
| CLI 鉴权 | Header `X-OTA-Publish-Key` = backend env `APP_OTA_PUBLISH_KEY` |
| 强制更新断网 | **fail-open**（查不到 minVersion 不拦） |
| Manifest | CLI complete 时写入完整 Expo manifest JSON；公共 API 原样 multipart 返回 |

## 当前掌握的信息

### 工程现状（as-is）

| 项 | 现状 |
|----|------|
| 栈 | Expo ~57 + EAS Build（`development` / `preview` / `production`） |
| 仓 | customer `au.com.xituan.customer`、merchant `au.com.xituan.merchant` |
| OTA | 已接：`expo-updates` + 自建 manifest；本地 Android 强制更新 + OTA 已验收 |
| 强制更新 | Platform minVersion；App 启动 Gate |
| iOS | ASC App 已创建；待 TestFlight / production 验收 |
| Android | 本地 USB / preview channel 已验 |

### 更新分三层（已定）

| 层 | 覆盖 | 本方案 |
|----|------|--------|
| 商店原生更新 | APK/AAB、IPA、native | Play / App Store 主路径 |
| 自建 OTA | JS bundle + 资源 | **自建**：非 EAS Update MAU；content 子域 + backend 协议 |
| 业务强制更新 | `minVersion` | Platform 配置；与 OTA **同波实现** |

### 已定架构决策

| 项 | 决定 |
|----|------|
| OTA 托管 | 自建；**不用** EAS Update 计费 CDN（可选日后对照） |
| Asset CDN | **`content` 子域**（与 media **同一 S3 桶根**，前缀 `app-ota/...`）；禁止 SIH / IMAGE_NORMALIZE |
| Manifest | 现有 **backend 公共 API**（Expo Updates 协议）；`Cache-Control: no-store`；**不**新开 updates 子域 |
| CLI | **各 App 仓各自** `ota:prepare`（export → presign 直传 S3 → complete）；失败回滚 draft；**不**经 Platform 上传 |
| Platform | **不上传**；OTA 历史 + **手动激活/回滚**；另配 **强制更新 minVersion**（customer / merchant 分开） |
| minVersion 格式 | Expo `version` 字符串 `a.b.c` 或 `a.b.c.d`（纯数字段）；**不是** Android `versionCode` |
| Settings SQL | 强制更新 category **无需** migration 种子；`updateSetting` upsert，Platform 首次保存建行 |
| OTA 表 | 版本历史 **需要** `migrations/` 新表（非 settings） |
| Code signing | **下个商店包带**公钥；私钥发布机本地 / 日后 GHA secret；**不用** Secrets Manager（项目无先例） |
| 强制更新 vs OTA | **同波实现**（强制更新为小改动） |

### 角色流

```text
CLI(每App): expo export → draft+presign → PUT S3 → complete(ready)
Platform: 查看历史 → 激活/回滚 active 指针；配置 minVersion
Backend: 版本表 + 发布鉴权 + 公共 manifest + minVersion 查询
App: updates.url → backend；asset → content CDN；启动比对 minVersion
```

版本维度：`app` × `channel` × `platform` × `runtimeVersion` × `updateId`  
状态：`uploading` → `ready` →（Platform）`active`；另有 `failed`；历史保留可回滚。

### 刻意不做

- 不为开发机 Metro 热重载接 OTA。
- 未触发前不放开自由 channel（见下方触发清单）。

## 期望目标结果

### 计划要做的（当前窗口）

- [x] 书面流程与本 entry 一致；registry → `active`
- [x] Platform：minVersion 配置（两 App）+ OTA 列表/激活
- [x] Backend：OTA 表 migration + draft/presign/complete + 公共 manifest + minVersion API
- [x] 两 App：`expo-updates`、`runtimeVersion`/channel、`updates.url`；启动强制更新弹窗
- [x] 各 App CLI `ota:prepare`；content 前缀 `app-ota/`；manifest `no-store`
- [x] 跑 migration `1710000000365`；本地 Android 强制更新 + OTA（Platform 激活）两 App 已验收
- [x] 本地包嵌入 code signing 公钥；`ota:prepare:local` 签名验收（`code signing: yes` + 冷启动验签）
- [ ] iOS：`build:prod:ios` → App Store Connect / TestFlight（两 App；包内嵌 prod 公钥；**本步不测** prod OTA）
- [ ] 本 entry → `done`（iOS TF 可达 + 下方 prod OTA 验收完成后；自由 channel 触发清单可仍未勾）

### 触发后才做的

- [ ] **production OTA 链路验收**（`ota:prepare:prod` + 生产 Platform 激活 + TF/商店包冷启动）  
  - **触发**：本波相关改动（backend / Platform / 两 App / 签名）**一起上线生产之后**再测；勿在半截发版窗口单独打 prod OTA  
- [ ] **OTA 自由 channel（方案 A）**  
  - **触发**：多人并行本地 OTA 互相抢同一 `preview` active，或明确需要个人 channel（`dev-a` / `dev-b`）  
  - **内容**：放宽 enum/校验为 slug 字符串；local 默认 `preview`→`dev`；App/CLI 读 `EXPO_PUBLIC_OTA_CHANNEL` / `OTA_CHANNEL`；第一次 `ota:prepare` 即出现该 channel；Platform 筛库中已出现 channel；保留 `production` 为唯一生产名；**不**建 channel 登记表  
  - **备注**：改 channel 需重打原生包（写入 `updates.requestHeaders`）；实施时再决定本地已有 `preview` 行 migrate→`dev` 还是弃用

## 触发条件 / 目标窗口

**已触发（2026-10-08）：** ASC customer/merchant App 已创建。实现窗口：首商店包前落地，便于 JS 热修与强制更新。  
**单项触发：** 见上节「触发后才做的」。

## 实施备忘

1. codebase：`app_force_update`（名待定）category + `PLATFORM_ONLY_CATEGORIES`；minVersion 比较 util（3～4 段数字）
2. backend：平台设定读写 + App 可读 minVersion；OTA 表 migration；协议 manifest；presign 到同桶 `app-ota/`
3. Platform：设定页 minVersion；OTA 管理页（无上传）
4. 两 App：expo-updates + 强制更新 UI；每仓 CLI
5. 验收：先 Android 真机（强制更新调 minVersion；OTA 激活/回滚）；iOS 有包后补平台验收

### 相关路径

- `xituan_app_customer` / `xituan_app_merchant`：`app.json`、`eas.json`、CLI
- `xituan_platform`：settings + OTA 管理页
- `xituan_backend`：platform-setting、OTA 域、公共路由
- `xituan_codebase`：`siteDomain.content`、`epPlatformSettingCategory`

## 相关文档

- [planned-work README](../README.md)
- [planned-work registry](../registry.md)
- [media-cdn-sih-domain-split](../../media-cdn-sih-domain-split.md)（content ≠ SIH）
