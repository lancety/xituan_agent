# android-apk-sidecar-trust

Last updated: 2026-11-07

## 摘要

官网 Android APK **旁路分发**的可信度实践（HTTPS 品牌域、与 Play **同签名**、版本/哈希公示等）。**mid**。  
**不是**商店审核替代；系统不会把官网标成 Play 同级「可信来源」。

与 `app-update-check-ux` 的关系：那边只留 Platform 字段 `apkUrlAndroid` + CTA 回落；**本条**管下载页、包产物、校验与文案。无独立 Cursor plan（实施时按本 entry）。

## 当前掌握的信息

- 旁路安装必走「未知来源 / 安装未知应用」；Play Protect 仍可能扫描。
- 覆盖升级前提：APK 签名与机上已装包一致（Play App Signing 时须用 **分发签名** 产物，不能只用 upload key 冒充商店同款）。
- 版本号与 Expo `version`（`a.b.c` / `a.b.c.d`）及 Platform `recommendedVersionAndroid` 对齐。

### 实施时参考（提高信任度，非官方认证）

1. **同签名**：与 Play 上架包同一 app signing / 分发密钥；可覆盖安装。
2. **HTTPS + 自有品牌域**下载页（勿网盘短链乱跳）。
3. **页上公示**：Expo 版本号、**SHA-256**（可选证书指纹）；可人工核对。
4. **仅正式构建**：同 `applicationId`、正式环境；禁止 debug 包挂官网。
5. **文案**：仅本站提供、需允许未知来源、与 Play 同签名可覆盖。
6. **可选**：企业 MDM / 私有商店；二维码只指向上述 HTTPS。

做不到：系统级「已通过 Google 认证来源」徽章；取消所有未知来源提示。

## 期望目标结果

### 计划要做的

- [ ] 确定托管位置（Site 某页 / 静态资源 / content CDN 前缀）与 customer/merchant 是否分 URL
- [ ] 发布清单：从 Play/正式流水线取出同签名 APK → 算 SHA-256 → 更新下载页 + Platform `apkUrlAndroid`
- [ ] 下载页：版本、哈希、来源说明、安装须知（中英等按站点）
- [ ] 冒烟：Play 安装用户可被官网包覆盖；无 Play 设备可完成安装

### 触发后才做的

- [ ] MDM / 私有商店推送 — 触发：有企业客户明确要求
- [ ] 自动化「打正式包 → 上传 → 写哈希进页」CI — 触发：手工流程稳定且发版频繁

## 触发条件 / 目标窗口

**mid**。有无 Play 用户或明确要官网包时启动；可与 `app-update-check-ux` 同窗口做字段，页与流水线可稍后。
