# 退役 OpenIM 附件 multipart（直传全量后）

Last updated: 2026-11-15

| 字段 | 值 |
|------|-----|
| **ID** | `openim-attachment-multipart-retire` |
| **状态** | `blocked` |
| **Phase1 首次进版** | `v4.3.0`（CMS/backend presign@11-14；微信/Customer/Merchant App@11-14～15） |
| **最早可清理** | `≥4.4.0` |
| **下一可执行** | `≥4.4.0`（等 4.3.0 全量） |
| **当前已部署** | Phase 1 在 4.3.0；multipart 路由仍保留 |
| **待完成** | Phase N 删 OpenIM multipart |
| **Gate** | 五端直传全量；multipart≈0 |
| **创建日** | 2026-11-13 |

**部署尾项:** 本 entry  
**相关:** [openim-attachment-direct-upload](../../planned-work/entries/2026-09-openim-attachment-direct-upload.md)；总图传退役 [multipart-image-upload-retire](./2026-11-multipart-image-upload-retire.md)（目录图等，不含本项细节）

## 背景

OpenIM 聊天附件 as-is：`POST /api/.../openim/customer-merchant/conversations/:id/attachments`（及 admin 前缀）multipart → `OpenimAttachmentService.persistUpload` → S3 `im/conversations/...` + `im.message_attachments` → `iOpenimAttachmentMeta`（含 `cdnUrl`）。

Phase 1：CMS / Site 改为 **presign → PUT upload 写分布 → complete**（同会话鉴权、同正式 key、同 meta）；multipart **必须保留**，供微信 / App 与旧包使用。

## Phase 对照

| Phase | 内容 | 部署状态 | 验证 |
|-------|------|----------|------|
| **1** | 新增 OpenIM `attachments/presign` + `attachments/complete`；CMS/Site `uploadAttachment` 改直传编排；保留 multipart | 待实施 / 待发版 | CMS/Site 无 multipart 收文件；微信/App multipart 仍可用 |
| **N** | 删除 customer + admin 的 multipart `.../attachments` 与 `openim-attachment-multer`；仅保留 presign/complete | pending | 仅 Gate 通过后 |

## 消费者

| Consumer | Phase 1 行为 |
|----------|----------------|
| **CMS** | 直传（本轮） |
| **Site** | 直传（本轮） |
| **WeChat** | 仍 multipart |
| **Customer App / Merchant App** | 仍 multipart |
| **Backend** | 双路径并存直至 Phase N |

## 部署后债务（Post-deploy debt）

### Phase 1 生产确认

- [ ] Backend OpenIM presign/complete 生产可用；**未**删除 multipart `.../attachments`
- [ ] CMS 聊天发图/发文件：直传 + 消息可展示
- [ ] Site 同上
- [ ] Entry 状态 → `active` 或 `blocked`（等微信/App）
- [ ] WeChat / Customer / Merchant 附件直传并全量发布

### Phase N 清理（Gate 通过后）

- [ ] 生产 multipart OpenIM 附件调用≈0
- [ ] 删除 admin + customer `POST .../conversations/:id/attachments`（multer）
- [ ] 删除或停用 `openim-attachment-multer`；`persistUpload` 仅被 complete 路径复用或内联后无 multipart 入口
- [ ] 本 entry → `done`；registry 归档

## 相关链接

- Backend: `domains/openim/services/openim-attachment.service.ts`；`openim-*-customer-merchant.routes.ts`
- CMS: `lib/api/openim-admin.api.ts`；`components/openim/CustomerMerchantChatPanel.tsx`
- Site: `lib/api/site-openim.api.ts`；同名 Panel
- Plan: OpenIM CMS/Site direct-upload（Cursor plans）
