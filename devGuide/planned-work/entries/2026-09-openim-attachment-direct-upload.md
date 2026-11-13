# openim-attachment-direct-upload

Last updated: 2026-11-13（CMS+Site 直传落地）

## 摘要

把 OpenIM 聊天附件从「经 backend multipart 收文件再写 S3」迁到 **全端直传**：申请签名 → 客户端 PUT → 确认后转码并回 canonical URL。  
**进度**：CMS + Site 已走 OpenIM 域 `attachments/presign` → PUT → `complete`；微信 / App 仍 multipart。multipart 下线与 CDN util 清理见 post-deploy。

## 当前掌握的信息

### as-is（2026-11-13）

| 项 | 现状 |
|----|------|
| OpenIM 上传 | **CMS/Site**：`POST .../attachments/presign|complete` + PUT upload 分布；微信/App：`POST .../attachments` multipart；落库仍经 `OpenimAttachmentService` → `im/conversations/...` |
| 小程序 | `wx.uploadFile` → 已备案 `backend.lancety.com`（合法域名） |
| 转 webp | IMAGE_NORMALIZE **sync** 完成后，接口返回 **canonical webp** `s3Key` / `cdnUrl` / `mimeType`（避免 OpenIM Mongo `pictureElem` 冻住 `.png` 名） |
| 展示 CDN | `media[-env].lancety.com` → CloudFront → S3（OAC）；**只读**：AllowedMethods `GET/HEAD/OPTIONS`，桶策略仅 `s3:GetObject` |
| 支出批量 OCR | CMS **已直传**，但是 `s3UploadManager.getSignedPutUrl` → 浏览器 PUT **`amazonaws.com`**，**不走 media** |

曾做 OpenIM S3 预签名直传（含 `confirmed_at`、孤儿清理、小程序 PUT S3），因微信无法把 AWS 主机加入合法域名、且当时不打算大改，**已全部回退**。

### 已定决策（本轮确认）

1. **所有端同一套直传协议**（CMS / Site / 微信 / 原生 App + backend）：`presign` → PUT `putUrl` → `complete`（HEAD、enqueue IMAGE_NORMALIZE、回 webp `cdnUrl`）。聊天业务（会话权限、附件表、转码、OpenIM 落 URL）**不按端拆分**。
2. **`putUrl` 对客户端不透明**。不要 `if (wechat) 签 lancety else 签 S3`，也不要 CMS 走 S3、小程序走另一套接口。
3. **PUT 主机是 upload 写分布**（2026-11-09 已建）。规则见 [S3 直传约定](../../../../.cursor/skills/s3-direct-upload/reference.md)。`media` / `content` 保持只读。图片 / 视频 / 音频的**展示**仍用 media，其它文件用 content。
4. **不能**把 S3 SigV4 URL 改 Host 再转发（签名绑定 Host）。`putUrl` 由 upload 写分布自己签发。
5. **仅小程序**受合法域名约束；CMS / Site / 原生可以直连 S3，但 OpenIM **故意不**走双 Host，以免全仓 if/else。支出 OCR **保持**现有 S3 直传，与本项无关。
6. 各端仅 HTTP 封装不同（`fetch` / `wx.request` PUT / RN）；小程序 PUT 走 **request 合法域名**，不是 `wx.uploadFile`。
7. `complete` 之前的对象要有 **孤儿 TTL 清理**（申请了但未确认）。
8. 历史 OpenIM Mongo 里已冻住的 `.png` URL **不回填**；本项只管新上传。

### 明确不做（现在）

- 不在 `media` 展示 CDN 上开写。content 只加暂存前缀的写入 behavior，不改默认读 behavior。
- 不为微信单独做一套附件业务或 backend 分支。
- 不把支出 OCR 的 PUT Host 改到 content behavior（无必要）。

## 期望目标结果

- [x] upload 写分布已建（见直传约定）。业务侧 OpenIM presign 签 `upload-incoming/.../openim/`；`media` / `content` 保持只读
- [x] backend OpenIM 域 `presign` / `complete`（admin + customer）；`putUrl` Host 为 `upload`（微信端仍可走 wechatUpload）
- [x] **CMS / Site** 已改为该协议；发消息仍用 complete 返回的 canonical webp URL
- [ ] 微信 / 顾客与商家 App 改为该协议
- [x] 未 complete 对象可按 TTL 清理（通用 upload-incoming TTL；OpenIM 失败删除 best-effort）
- [x] 微信后台：`upload.lancety.com` 已加入 **request 合法域名**（2026-11-09）
- [ ] 旧 multipart `POST .../attachments` 的下线 → post-deploy [`openim-attachment-multipart-retire`](../../post-deploy-ledger/entries/2026-11-openim-attachment-multipart-retire.md)
- [ ] CDN util 默认 WECHAT / clientApp 混用收敛 → post-deploy [`openim-cdn-lane-util-cleanup`](../../post-deploy-ledger/entries/2026-11-openim-cdn-lane-util-cleanup.md)（Phase 1 已增量 `epOpenimCdnLane`）
- [ ] 本 entry → `done`，registry 归档（待微信/App 迁完）

## 触发条件 / 目标窗口

主动启动「OpenIM 附件直传」实施时（通用直传框架已在）。  
**本轮范围**：CMS + Site 直传（OpenIM 域 presign/complete）；微信/App 仍 multipart。  
**Cursor plan**：OpenIM CMS/Site direct-upload；总清单 [`direct_upload_business_migration_2026-11.plan.md`](../../../../.cursor/plans_planned/direct_upload_business_migration_2026-11.plan.md)。  
**部署尾项:** [openim-attachment-multipart-retire](../../post-deploy-ledger/entries/2026-11-openim-attachment-multipart-retire.md)；[openim-cdn-lane-util-cleanup](../../post-deploy-ledger/entries/2026-11-openim-cdn-lane-util-cleanup.md)。

## 实施备忘（可选草稿）

控制面可对标 CMS 支出：`expense-batch.service.ts` 的 presign + notify，但 OpenIM 的 `putUrl` 按 [S3 直传约定](../../../../.cursor/skills/s3-direct-upload/reference.md) 签 upload 分布，不签 `amazonaws.com`。  
上传面总表与差异：[image-upload-surface-inventory.md](../../image-upload-surface-inventory.md)。  
展示仍用现有 `openimAttachmentCdnUtil` → `media` / `wechatMedia`。  
相关：[`media-cdn-sih-domain-split.md`](../../media-cdn-sih-domain-split.md)、[`docs/openim-aws-and-production-config.md`](../../../docs/openim-aws-and-production-config.md)。  
目录/业务 Form 图直传（同一条 upload 分布）：[`catalog-image-direct-upload`](./2026-10-catalog-image-direct-upload.md)；多端分层标准：[`catalog-image-direct-upload-standard.md`](../../catalog-image-direct-upload-standard.md)。主机约定：[S3 直传约定](../../../../.cursor/skills/s3-direct-upload/reference.md)。
