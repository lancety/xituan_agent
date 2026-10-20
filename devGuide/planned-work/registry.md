# Planned Work Registry（巡检入口）

Last updated: 2026-10-20

**日常巡检：「检查规划」** — 打开本文件；需要细节再进 Entry。

---

## 活跃（Active）

| ID | 状态 | 简述 | 目标阶段/触发 | 下一动作 | Entry | Last updated |
|----|------|------|---------------|----------|-------|--------------|
| `fb-product-reports-enforcement` | `planned` | 商品合规举报 App+S3 备份+Platform 商品 Tab；下架/`pt::`/商户邮件/协议 | Platform 聊天反馈管理页上线后主动启动 | SQL 已在 0373；先实现聊天管理页，再开本 entry | [entry](./entries/2026-10-fb-product-reports-enforcement.md) | 2026-10-20 |
| `platform-feedback-ai-triage` | `planned` | 多类型反馈 AI 预处理 + 自动/人工裁定 | IM 举报/屏蔽上架后主动启动设计 | 先写反馈类型/报告 schema；Phase 1 IM 勿接真模型 | [entry](./entries/2026-10-platform-feedback-ai-triage.md) | 2026-10-20 |
| `async-jobs-retention` | `planned` | `platform.async_jobs` 终态行定期清理 | 统一替换 ECS cron 调度后，或表明显变大前 | 勿加 Backend cron；调度方案落地后再做 purge | [entry](./entries/2026-09-async-jobs-retention.md) | 2026-09-05 |
| `node-runtime-upgrade-22` | `planned` | 全平台 Node 20 → **22 LTS**（本机/CI、Backend ECS、Lambda） | 下次 Backend 发版窗口，或升 AWS SDK / 退出 nodejs20.x 前 | 先本机 22 烟测，再 Dockerfile，再统一改 Lambda runtime；勿长期 ECS22+Lambda20 双轨 | [entry](./entries/2026-09-node-runtime-upgrade-22.md) | 2026-09-17 |
| `app-release-update-flow` | `active` | 自建 OTA（content CDN）+ Platform 强制更新 minVersion + 商店包 | 本地签名已验；先 iOS TF；prod OTA 整波上线后再测 | `build:prod:ios` → TestFlight；prod OTA / 自由 channel 见 entry 触发清单 | [entry](./entries/2026-09-app-release-update-flow.md) | 2026-10-09 |
| `openim-attachment-direct-upload` | `planned` | OpenIM 附件全端直传（一套 presign/PUT/complete，不按端拆业务） | 主动启动直传实施时（现维持 multipart） | PUT 主机见 [直传约定](../../../.cursor/skills/s3-direct-upload/reference.md)；勿在 media 上开写；不新建 upload 子域 | [entry](./entries/2026-09-openim-attachment-direct-upload.md) | 2026-10-17 |
| `catalog-image-direct-upload` | `planned` | 目录/业务图直传：统一标准分层（codebase 编排+薄 UI）；presign→PUT→complete→只交 canonical | 主动启动或与 OpenIM 共用 content 写入 behavior 同窗口；现维持 multipart | 实施按 [标准](../catalog-image-direct-upload-standard.md)；PUT 主机见 [直传约定](../../../.cursor/skills/s3-direct-upload/reference.md)；勿开 media 可写 | [entry](./entries/2026-10-catalog-image-direct-upload.md) | 2026-10-17 |
| `openim-voice-message` | `planned` | OpenIM 语音气泡：Customer 先收播再录音发送；Merchant/WeChat 至少能播后再互通 | 主动启动语音实施时（现暂不排期） | 先 Customer Phase A（map + 气泡播放）；勿在对端不能播时单独开跨端发送 | [entry](./entries/2026-10-openim-voice-message.md) | 2026-10-13 |

---

## 已归档（Done / Cancelled）

| ID | 状态 | 完成日 | Entry | 备注 |
|----|------|--------|-------|------|
| `image-normalize-full-backfill` | `done` | 2026-09-17 | [entry](./entries/2026-09-image-normalize-full-backfill.md) | 本机全量 IMAGE_NORMALIZE 已跑完；jpeg 主路径下线仍看 post-deploy `sih-format-allowlist-webp-png` |
