# app-update-check-ux

Last updated: 2026-11-07（**in_progress**：代码已落地，待发版/真机验）

## 摘要

在已有自建 OTA / minVersion 基建上，补齐 **每次打开检测 + 一次性提示 UX**，并采用 **硬 min + soft 推荐** 双档；**版本按 iOS/Android × customer/merchant 分字段**（审核节奏不同）。**high / in_progress**。

不等于 `app-release-update-flow`（基建已 done）；本条是产品提示层。

Cursor plan：`d:/projects/xituan_module/.cursor/plans_planned/self-hosted_app_ota_cf87f02d.plan.md`

## 当前掌握的信息

- 冷启动下载、下次冷启动应用；「我的」版本号长按强制 fetch+reload — 已有。
- Customer + Merchant：`ForceUpdateGate` + `AppUpdatePromptHost` 已挂根；toast Viewport 支持 actions。
- Platform：按 OS 拆 min/recommended + `apkUrlAndroid`（旧 `minVersion` normalize 双写）。
- **2026-11-07 已拍板并实现**（含下表 + CTA）；待真机/发版验收。

### 已拍板产品语义

| 项 | 决定 |
|----|------|
| 版本双档 | **硬 min** 挡死门；**soft 推荐** 确认/取消、提示一次 |
| 按平台拆字段 | customer / merchant：`minVersionIos\|Android`、`recommendedVersionIos\|Android` |
| 版本号格式 | Expo `a.b.c` / `a.b.c.d` |
| soft 比较 | 仅 `current < recommended` 提示；**空 / 无效 / `recommended <= current`（含忘改 Platform）不提示** |
| Platform 校验 | 同平台 `recommendedVersion* >= minVersion*` |
| 旧 min 迁移 | 单一 `minVersion` → normalize 成 iOS/Android **同值** |
| OTA | 提示一次；确认：已下载则 **只 `reload`**，否则 `fetch`+`reload`；取消记 `updateId` |
| 优先级 | 硬 min → OTA → soft；同屏不叠 |
| 检测频率 | 冷启动必查；回前台 **4h**（含硬 min，暂定） |
| 两端 | Customer + Merchant **同波** |
| soft / OTA UI | **底部条 + 确认/取消**（扩展 AppToast Viewport；两端强制 Viewport，不用系统 Toast） |
| 商店 CTA | `storeUrl*` → `Linking.openURL` |
| Android apk | 可选 `apkUrlAndroid`；CTA 见下 |

### Android CTA（保证能去官网）

单靠 `openURL(Play)`「失败再跳」**不可靠**（常「成功」打开浏览器坏页，Promise 不 reject）。

| 配置 | 行为 |
|------|------|
| 仅 `storeUrlAndroid` | 主按钮开商店 |
| 仅 `apkUrlAndroid` | 主按钮开官网 APK 页 |
| **两者都有** | **主按钮**开 Play URL；条上（或硬 Gate 上）**固定次要「官网下载」** → 直接 `openURL(apkUrl)`，不依赖失败回调 |
| `openURL(商店)` catch | 若有 `apkUrl` → 自动再开官网；并仍保留次要入口 |

官网页可信实践 → mid [`android-apk-sidecar-trust`](./2026-11-android-apk-sidecar-trust.md)。

### Platform 配置面（每 App）

| 字段 | 用途 |
|------|------|
| `minVersionIos` / `minVersionAndroid` | 硬门槛 |
| `recommendedVersionIos` / `recommendedVersionAndroid` | soft；过审后手改；≤ 本机则不提示 |
| `storeUrlIos` / `storeUrlAndroid` | 商店页 |
| `apkUrlAndroid`（可选） | 官网 APK/下载页 |

### App 检测流

```text
读本机 Expo version → GET 配置 → 按 OS 取字段
→ 硬 min？Gate
→ else OTA 可更新？底部条（确认 reload / 取消记 id）
→ else soft（current < recommended）？底部条（主商店 [+ 次要官网] / 取消记 version）
```

## 期望目标结果

### 计划要做的

- [x] 扩展两端 toast Viewport：确认/取消（及 Android 次要「官网下载」）
- [x] Platform：拆 min/recommended；`apkUrlAndroid`；recommended≥min；兼容旧 minVersion
- [x] 公共 API + 两端：冷启动 + 4h；硬 Gate；OTA reload；soft；Merchant 挂根
- [x] Android CTA：双 URL 主商店 + 常驻官网；open 失败回落 apk
- [x] 优先级硬 → OTA → soft
- [ ] 真机 / 发版验收

### 触发后才做的

- 自由 OTA channel — `app-release-update-flow`
- Play In-App Updates 增强
- 官网 APK 页 / 哈希 — [`android-apk-sidecar-trust`](./2026-11-android-apk-sidecar-trust.md)

## 触发条件 / 目标窗口

high；代码已落地，验收后标 done。
