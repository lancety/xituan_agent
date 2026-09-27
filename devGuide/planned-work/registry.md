# Planned Work Registry（巡检入口）

Last updated: 2026-09-20

**日常巡检：「检查规划」** — 打开本文件；需要细节再进 Entry。

---

## 活跃（Active）

| ID | 状态 | 简述 | 目标阶段/触发 | 下一动作 | Entry | Last updated |
|----|------|------|---------------|----------|-------|--------------|
| `async-jobs-retention` | `planned` | `platform.async_jobs` 终态行定期清理 | 统一替换 ECS cron 调度后，或表明显变大前 | 勿加 Backend cron；调度方案落地后再做 purge | [entry](./entries/2026-09-async-jobs-retention.md) | 2026-09-05 |
| `node-runtime-upgrade-22` | `planned` | 全平台 Node 20 → **22 LTS**（本机/CI、Backend ECS、Lambda） | 下次 Backend 发版窗口，或升 AWS SDK / 退出 nodejs20.x 前 | 先本机 22 烟测，再 Dockerfile，再统一改 Lambda runtime；勿长期 ECS22+Lambda20 双轨 | [entry](./entries/2026-09-node-runtime-upgrade-22.md) | 2026-09-17 |
| `app-release-update-flow` | `planned` | 用户/商家 App 上架后的发布更新流程（商店包 + OTA + 可选强制更新） | 第一次 Play / App Store 提交 production 前，或需要 JS 热修时 | 现不接 expo-updates；上架前再定 channel / runtimeVersion / 是否强制更新 | [entry](./entries/2026-09-app-release-update-flow.md) | 2026-09-18 |
| `openim-attachment-direct-upload` | `planned` | OpenIM 附件全端直传（统一中继 PUT，不按小程序拆业务） | 主动启动直传实施时（现维持 multipart） | 勿在 media 展示 CDN 开写；实施时一套 presign/complete，putUrl 一律 upload 域名 | [entry](./entries/2026-09-openim-attachment-direct-upload.md) | 2026-09-20 |

---

## 已归档（Done / Cancelled）

| ID | 状态 | 完成日 | Entry | 备注 |
|----|------|--------|-------|------|
| `image-normalize-full-backfill` | `done` | 2026-09-17 | [entry](./entries/2026-09-image-normalize-full-backfill.md) | 本机全量 IMAGE_NORMALIZE 已跑完；jpeg 主路径下线仍看 post-deploy `sih-format-allowlist-webp-png` |
