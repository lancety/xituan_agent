# Planned Work Registry（巡检入口）

Last updated: 2026-11-09

**日常巡检：「检查规划」** — 打开本文件；需要细节再进 Entry。

Cursor plan 三桶：草稿 `C:/Users/lance/.cursor/plans/`；待做 / 已完成见 `xituan_module/.cursor/plans_planned|plans_completed/`（随 **xituan_cursor** git）。

---

## 活跃（Active）

| ID | 状态 | 简述 | 目标阶段/触发 | 下一动作 | Entry | Last updated |
|----|------|------|---------------|----------|-------|--------------|
| `delivery-phone-merchant-mask` | `planned` | 履约手机对商户脱敏/中间号；自配送与 AusPost 各路径 | **mid** | 拍场景矩阵；先脱敏+AusPost 直传；中间号后置（勿用 AWS） | [entry](./entries/2026-11-delivery-phone-merchant-mask.md) | 2026-11-08 |
| `multilingual-ai-empty-locale-fill` | `planned` | 长文本空槽 AI 填充 + 数据块挖洞；保存前/语言切换批处理 | **high** | `fillEmptyLocales` + `MULTILINGUAL_TEXT_TRANSLATE` + shouldRunFill | [entry](./entries/2026-11-multilingual-ai-empty-locale-fill.md) | 2026-11-08 |
| `auspost-mypost-dual-track` | `in_progress` | MyPost CSV+API 双轨；CMS+Merchant App | 当前窗口 | 连接 Token、API confirm、App CSV 分享 | [entry](./entries/2026-11-auspost-mypost-dual-track.md) | 2026-11-07 |
| `wechat-c-business-error-i18n` | `planned` | 微信 C 端 code→i18n；禁 toast message | high | 审计 SimpleErrorHandler；「我的网店」不专项做 | [entry](./entries/2026-11-wechat-c-business-error-i18n.md) | 2026-11-07 |
| `app-update-check-ux` | `in_progress` | 硬/soft 按 OS 拆；底部条按钮；OTA reload；4h | high | 真机/发版验收；Platform 填 recommended/apk | [entry](./entries/2026-11-app-update-check-ux.md) | 2026-11-07 |
| `android-apk-sidecar-trust` | `planned` | 官网 APK 同签名/HTTPS/哈希公示（旁路可信实践） | mid | 有无 Play 或要挂包时；下载页+发布清单 | [entry](./entries/2026-11-android-apk-sidecar-trust.md) | 2026-11-07 |
| `category-cache-cross-clients` | `planned` | 分类 sync 契约复用到 CMS/Site/微信/Customer | mid | Merchant App 已完成；其余端待启动 | [entry](./entries/2026-11-category-cache-cross-clients.md) | 2026-11-07 |
| `last-used-delivery-address` | `planned` | 默认地址→最近配送地址 | low | 空窗启动；Gate 后 DROP 见 post-deploy | [entry](./entries/2026-11-last-used-delivery-address.md) | 2026-11-07 |
| `gst-effective-date-cutover` | `blocked` | GST 生效日 D 切齐（**仅 todo，不实施**） | **未决：ATO 的 D** | 等 D；未决项见 entry；SQL 草稿已备勿跑 | [entry](./entries/2026-10-gst-effective-date-cutover.md) | 2026-10-30 |
| `fb-product-reports-enforcement` | `planned` | 商品合规举报 App+S3 备份+Platform 商品 Tab；下架/`pt::`/商户邮件/协议 | Platform 聊天反馈管理页上线后主动启动 | SQL 已在 0373；先实现聊天管理页，再开本 entry | [entry](./entries/2026-10-fb-product-reports-enforcement.md) | 2026-10-20 |
| `platform-feedback-ai-triage` | `planned` | 多类型反馈 AI 预处理 + 自动/人工裁定 | IM 举报/屏蔽上架后主动启动设计 | 先写反馈类型/报告 schema；Phase 1 IM 勿接真模型 | [entry](./entries/2026-10-platform-feedback-ai-triage.md) | 2026-10-20 |
| `async-jobs-retention` | `planned` | `platform.async_jobs` 终态行定期清理 | 统一替换 ECS cron 调度后，或表明显变大前 | 勿加 Backend cron；调度方案落地后再做 purge | [entry](./entries/2026-09-async-jobs-retention.md) | 2026-09-05 |
| `node-runtime-upgrade-22` | `planned` | 全平台 Node 20 → **22 LTS**（本机/CI、Backend ECS、Lambda） | 下次 Backend 发版窗口，或升 AWS SDK / 退出 nodejs20.x 前 | 先本机 22 烟测，再 Dockerfile，再统一改 Lambda runtime；勿长期 ECS22+Lambda20 双轨 | [entry](./entries/2026-09-node-runtime-upgrade-22.md) | 2026-09-17 |
| `openim-attachment-direct-upload` | `planned` | OpenIM 附件全端直传 | 主动启动直传实施时（现维持 multipart） | 用户将专项做；暂不排期 | [entry](./entries/2026-09-openim-attachment-direct-upload.md) | 2026-11-07 |
| `catalog-image-direct-upload` | `planned` | 目录/业务图直传 | 主动启动或与 OpenIM 同窗口 | 用户将专项做；暂不排期 | [entry](./entries/2026-10-catalog-image-direct-upload.md) | 2026-11-07 |
| `openim-voice-message` | `planned` | OpenIM 语音气泡 | 主动启动语音实施时（现暂不排期） | 先 Customer Phase A | [entry](./entries/2026-10-openim-voice-message.md) | 2026-10-13 |

---

## 已归档（Done / Cancelled）

| ID | 状态 | 完成日 | Entry | 备注 |
|----|------|--------|-------|------|
| `merchant-app-account-bind-wechat` | `done` | 2026-11-09 | [entry](./entries/2026-11-merchant-app-account-bind-wechat.md) | 「更多」账号区登录后绑微信；对齐 Customer account-bind |
| `app-release-update-flow` | `done` | 2026-11-07 | [entry](./entries/2026-09-app-release-update-flow.md) | 基建+iOS TF+prod OTA 已验；提示 UX 见 `app-update-check-ux`；自由 channel 未触发 |
| `cms-refund-line-returns` | `done` | 2026-11-07 | [entry](./entries/2026-11-cms-refund-line-returns.md) | CMS+Backend 已上 production；App/微信对等 UI 未触发，另开 entry |
| `image-normalize-full-backfill` | `done` | 2026-09-17 | [entry](./entries/2026-09-image-normalize-full-backfill.md) | 本机全量 IMAGE_NORMALIZE 已跑完；jpeg 主路径下线仍看 post-deploy `sih-format-allowlist-webp-png` |
