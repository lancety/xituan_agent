# app-release-update-flow

Last updated: 2026-09-18

## 摘要

为 `xituan_app_customer` / `xituan_app_merchant` 制定正式上架后的 **发布与更新流程**（商店原生包 + Expo OTA + 可选强制更新）。  
**不是** post-deploy Phase N：尚未实施；当前仍在 Expo 开发/内部分发阶段。

## 当前掌握的信息

### 工程现状（as-is）

| 项 | 现状 |
|----|------|
| 栈 | Expo ~57 + EAS Build（`eas.json` 已有 `development` / `preview` / `production`） |
| 仓 | `xituan_app_customer`（`au.com.xituan.customer`）、`xituan_app_merchant`（`au.com.xituan.merchant`） |
| 多仓对齐 | 已纳入 **`xituan-multirepo-codebase-sync`** / **`xituan-batch-deploy`**：与其它主仓一起 bump `submodules/xituan_codebase` 并 `push origin master`；两 App 的 Git `production` 存 EAS 生产配置，批量部署会 `merge master` 后 `push origin production`。商店包仍走 EAS Build/Submit，不是 ECS CI |
| OTA | **未接**：无 `expo-updates` 依赖，`app.json` 无 `updates` / `runtimeVersion` |
| 内测 | `preview` / `development` 为 `distribution: internal`，Android `buildType: apk` |
| 结论 | 发版后用户端 **不会** 自动拉 JS 热更新；内测 APK 也不走商店自动更新 |

### 更新分三层（已对齐的产品认知）

商店原生包 **不能保证** 所有用户立刻装上（系统自动更新可关、可延迟）。紧急修复若只靠商店，总会有一批旧版本。

| 层 | 覆盖什么 | 用户体验 | 适用 |
|----|----------|----------|------|
| **商店原生更新** | APK/AAB、IPA；原生模块、权限、SDK、Expo native 依赖 | Play / App Store 在用户开启自动更新时后台安装；不能强制立刻装 | 任何 native 变更；正式上架后的主路径 |
| **Expo OTA（EAS Update）** | JS bundle + 资源 | 下次打开（或下完立刻重启）静默切 bundle，不必再走商店审核 | 页面、业务逻辑、文案；**不能**绕过审核做大功能 |
| **业务强制更新** | 后端 `minVersion` / `forceUpdate`，App 启动比对 | 弹窗引导去商店（可做成关不掉） | 支付/协议/安全等「旧包不能再用」；**不是**系统替你装包 |

OTA **不能**热更：原生代码、新权限、新 native 依赖、改 RN / Expo SDK 版本。这些仍要 `eas build` 并上架。

Apple / Google 允许 JS OTA，但禁止用来规避审核或大幅改应用行为。

### 内测 vs 正式

- **开发/内测包**（当前 `development` / `preview`）：同事每次原生改动后重新打包装；**无**商店自动更新。
- **正式上架包**（`production`）：才可能被系统自动更新；仍无法 100% 覆盖所有设备。

### 刻意不做（现在）

- 不在开发期接 `expo-updates` 或做强制更新弹窗。
- 等确认要上架、且有「旧包不能再用」的接口契约时，再设计最低版本检查。

## 期望目标结果

- [ ] 书面流程：何时走商店发版、何时走 EAS Update、何时强制跳商店
- [ ] 两仓接好 `expo-updates`：`runtimeVersion`、channel 与 EAS `production` / 内测 channel 对齐
- [ ] 日常 JS 修复可通过 OTA 到达已安装的正式包，无需每次商店审核
- [ ] Native / 权限 / SDK 变更仍走商店；发版 checklist 写清
- [ ] 可选：后端下发最低版本 + App 启动拦截（仅在确认有不兼容旧包时落地）
- [ ] 内测包如何通知/分发（internal APK / TestFlight）写清，避免和商店自动更新混为一谈
- [ ] 本 entry → `done`，registry 归档；定稿方案可另落 `devGuide` 专题（本 entry 不替代 runbook）

## 触发条件 / 目标窗口

建议在以下**任一更早者**启动设计（实施可分阶段）：

1. 准备第一次向 Google Play / App Store **提交 production** 之前；或  
2. 正式包已在少量用户设备上，且需要不走审核的 JS 热修；或  
3. 后端即将做破坏性 API，旧 App 不能继续用。

**刻意不做：** 仅为开发机热重载去接 OTA；不为日常小改立刻做强制更新。

## 实施备忘（可选草稿）

### 推荐落地顺序（以后实施时）

1. 定 `runtimeVersion` 策略（native 变了必须升 runtime，旧包收不到不兼容 OTA）
2. 两仓加 `expo-updates` + EAS Update channel（production / preview 分开）
3. 写发版 checklist：JS-only → `eas update`；native → `eas build` + store submit
4. 若需要强制更新：后端最低版本字段 + 启动比对 + 商店链接（按业务错误码 / i18n，不写死中文文案）
5. 定稿 devGuide runbook（本 planned entry 只保留规划，不复制成长文）

### 相关路径

- `xituan_app_customer/package.json`、`app.json`、`eas.json`
- `xituan_app_merchant/package.json`、`app.json`、`eas.json`

## 相关文档

- [planned-work README](../README.md)
- [planned-work registry](../registry.md)
