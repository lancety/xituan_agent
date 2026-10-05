# app-release-update-flow

Last updated: 2026-10-04

## 摘要

为 `xituan_app_customer` / `xituan_app_merchant` 落地 **商店原生更新 + 自建 Expo OTA（content CDN）+ Platform 强制更新（minVersion）**。  
**不是** post-deploy Phase N：方案已定稿，**实施等待 iOS 开发者 App 创建完成**后再开工。

Cursor 方案原稿：`self-hosted_app_ota` plan（本机 `.cursor/plans`）。

## 当前掌握的信息

### 工程现状（as-is）

| 项 | 现状 |
|----|------|
| 栈 | Expo ~57 + EAS Build（`development` / `preview` / `production`） |
| 仓 | customer `au.com.xituan.customer`、merchant `au.com.xituan.merchant` |
| OTA | **未接**：无 `expo-updates`；无自建 manifest |
| 强制更新 | **未做** |
| iOS | **商店/开发者 App 尚未创建** → 本项实施 **blocked**，等创建后再开 |
| Android | 可本地/preview 验收；不阻塞方案定稿 |

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

### 刻意不做（触发前）

- 不为开发机 Metro 热重载接 OTA。
- **在 iOS 开发者 App 创建完成前不开始写实现代码**（方案与台账可先定稿）。

## 期望目标结果

- [ ] 书面流程与本 entry 一致；registry 在实施完成后归档
- [ ] Platform：minVersion 配置（两 App）+ OTA 列表/激活/回滚
- [ ] Backend：OTA 表 + draft/presign/complete + 公共 Expo Updates manifest + minVersion API
- [ ] 两 App：`expo-updates`、`runtimeVersion`/channel、`updates.url`；启动强制更新弹窗（商店链接 i18n）
- [ ] 各 App CLI 发布准备脚本；content 前缀隔离；manifest 禁缓存
- [ ] 下个商店包带 code signing 公钥；Android / iOS 均可验收（实施启动后）
- [ ] 本 entry → `done`

## 触发条件 / 目标窗口

**开工条件（硬）：** iOS 侧开发者 App（App Store Connect / Apple Developer 应用记录）**已为 customer / merchant 创建完成**（与 Android 包名策略对齐后），再启动实现。

实现启动后建议窗口：首次向商店提交 production 前，或需要 JS 热修 / 破坏性 API 前。

**刻意不做：** 触发前不接 `expo-updates`、不写 OTA/强制更新生产代码。

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
