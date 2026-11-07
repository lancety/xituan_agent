# app-update-check-ux

Last updated: 2026-11-07

## 摘要

在已有自建 OTA / minVersion 基建上，补齐 **每次打开检测 + 一次性提示 UX**（热更新、最低版本确认/取消、商店新版本）。**high**。

不等于 `app-release-update-flow`（那条是基建与 TF/prod 验收）；本条是产品提示层。

Cursor plan：`d:/projects/xituan_module/.cursor/plans_planned/self-hosted_app_ota_cf87f02d.plan.md`

## 当前掌握的信息

- 冷启动下载、下次冷启动应用；「我的」长按强制更新 — 已有。
- Customer：`ForceUpdateGate`（不可关挡板）已有；Merchant **未挂** Gate。
- 缺：每次打开检测；热更新/商店版「提示一次并记住」；minVersion 确认/取消 toast。

## 期望目标结果

### 计划要做的

- [ ] 每次打开检测热更新 + minVersion + 商店版本（两端）
- [ ] 热更新：提示一次，存 updateId，同 id 不重复提示
- [ ] minVersion：确认/取消 toast；Merchant 接入
- [ ] 商店新版本：提示一次并记住 version，推荐下载

### 触发后才做的

- 自由 OTA channel — 仍见 `app-release-update-flow` 触发项

## 触发条件 / 目标窗口

high；可与下一波 App 发版同窗口。
