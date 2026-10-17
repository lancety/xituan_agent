# catalog-image-direct-upload

Last updated: 2026-10-17

## 摘要

把 **目录/业务实体图片**（团购头图与轮播、预定头图与轮播、商品/新闻等 Form 图）从「经 backend multipart 收文件再写 S3」迁到 **直传**：`presign` → 客户端 PUT → `complete`（sync IMAGE_NORMALIZE）→ 表单只提交 canonical path 文本。  
目的：降低 backend 带宽与内存占用；统一「上传返回 webp canonical、再 submit」契约。  
**多端必须按同一标准分层复用**（codebase 编排 + 薄 Transport/UI），禁止 CMS/微信/Expo 各写一套。标准正文：[`catalog-image-direct-upload-standard.md`](../../catalog-image-direct-upload-standard.md)。  
**不是** post-deploy Phase N；当前生产仍以 Form/multer 过 backend 为主。

## 当前掌握的信息

### as-is（2026-10-11）

| 通道 | 上传形态 | normalize | 落库 path |
|------|----------|-----------|-----------|
| **CMS**（Offer/Product/News/Preorder 等） | 创建/更新 **同一请求 FormData**，图过 backend | save 后 sync enqueue → DB 改成 webp | 终态多为 webp（响应对象可能短暂仍是源 path） |
| **微信商家面板 / Expo 商家** | **两步**：`POST .../images/:kind` multipart → 再 PUT 文本 | upload 内 sync enqueue | 曾回源 `.jpg/.png` 导致 save 盖回；**已修**为回 canonical（止血，仍占 backend 带宽） |
| **支出批量 OCR** | CMS **已直传** S3（`amazonaws.com` PUT） | 另链路 | 与目录图无关，保持 |
| **OpenIM 附件** | 仍 multipart；直传见独立 entry | sync 后回 webp | 见下「相关」 |

展示仍走 `media` / `wechatMedia` 只读 CDN + `_w*`；jpeg 过渡 SIH query 见 post-deploy `sih-format-allowlist-webp-png`。

### 已定方向（与对话对齐，实施前可再收紧）

1. **契约**：`complete`（或等价确认接口）必须在 **IMAGE_NORMALIZE sync 成功后** 只返回 **canonical**（目录图一般为 webp；logo 等按 `IMAGE_NORMALIZE_VARIANT_POLICY`）。  
   表单 submit **只带文本 + canonical path**，禁止再写源 `.jpg/.png`。
2. **CMS / 微信商家 / Expo 商家同一协议**；编排进 codebase，端上只换 Transport + 薄 UI（见标准文档 §3–§6）。
3. **PUT 主机**见 [S3 直传约定](../../../../.cursor/skills/s3-direct-upload/reference.md)：不新建 upload 子域；写入走现有 content 暂存 behavior；`media` 只读。图片 / 视频 / 音频只在展示 URL 上用 media，不因此做第二套上传。CMS/Site/App 也走同一个 `putUrl`。
4. **直传优先于「继续把大图打进 backend」**；本项实施前继续用现有 multipart，但上传 API 必须回 canonical（已对商家面板止血）。
5. 源文件是否在 complete 后删除：与 IMAGE_NORMALIZE「源删延后」策略一并定；本项至少保证 **DB/客户端只认 canonical**。
6. **Backend 一个** `presign`/`complete` service，按 `bindKind` 分支 key；实体 Controller 只收 path，不收文件。

### 明确不做（现在）

- 不在本窗口迁 CMS FormData 全量（先记规划）。
- 不把支出 OCR 的 PUT Host 改到 content behavior（无微信合法域名压力时可后置）。
- 不打开 `media.*` 可写。
- 不与 OpenIM Mongo 历史 `.png` URL 回填混为一谈。

## 期望目标结果

### 计划要做的（启动本项后）

- [ ] 定稿并遵守 [`catalog-image-direct-upload-standard.md`](../../catalog-image-direct-upload-standard.md)（分层 / 契约 / 验收）
- [ ] codebase：`catalog-image-direct-upload` 类型 + `uploadOne`/`uploadMany` + `iCatalogImageUploadTransport`
- [ ] backend：统一 `CatalogImageDirectUploadService` + 单一 presign/complete 路由（按 bindKind）
- [ ] 与 OpenIM 直传对齐：同一条 content 暂存写入 behavior（见直传约定）；两套 key 前缀 / 鉴权，不新建 upload 域名
- [ ] 微信商家：transport + 薄组件；Offer/Preorder 先打通；废弃大图经 backend（或短兼容期）
- [ ] Expo 商家：同一 util，仅换 transport
- [ ] CMS：薄 Upload 组件 + 实体去 FormData 文件字段；skill `cms-form-image-upload` 改直传 checklist
- [ ] 未 complete 对象 TTL/孤儿清理
- [ ] 微信后台：现成 `content*.lancety.com` 加入 **request 合法域名**（与 OpenIM 共用一次配置）
- [ ] 本 entry → `done`，registry 归档

### 触发后才做的

| 项 | 触发条件 |
|----|----------|
| 删旧 multipart `.../images/:kind` 与 CMS FormData 收文件路由 | 各端已发版且无流量；另开 post-deploy |
| Product/News 等其余实体批量迁完 | Offer/Preorder 商家链路稳定后 |
| 源 `.jpg/.png` 上传对象统一 purge | Gate：DB 主 path 均为 canonical 且无客户端再写源 path |

## 触发条件 / 目标窗口

- **主动启动**「目录图直传」或「减轻 backend 上传带宽」时实施。  
- **建议依赖**：直传约定里的 **content 暂存写入 behavior** 已落地，或本项与 OpenIM **同窗口共建**（避免两套 PUT Host）。  
- **现在不实施**（2026-10：仅修好商家面板回 canonical；CMS 仍 FormData）。

## 实施备忘

标准与分层以 [`catalog-image-direct-upload-standard.md`](../../catalog-image-direct-upload-standard.md) 为准。  
控制面参考：`expense-batch.service.ts`（presign 形状）+ [S3 直传约定](../../../../.cursor/skills/s3-direct-upload/reference.md)（PUT 主机）+ 现商家面板（canonical 回传）。  
CMS as-is：[`FormData-Image-Management-System.md`](../../FormData-Image-Management-System.md)。

## 相关文档

- **[S3 直传约定](../../../../.cursor/skills/s3-direct-upload/reference.md)** — PUT 主机与安全约束（权威）
- **[标准](../../catalog-image-direct-upload-standard.md)** — 契约、MVC 分层、codebase/backend/端上复用
- [openim-attachment-direct-upload](./2026-09-openim-attachment-direct-upload.md) — 附件直传；共用同一条 content 写入 behavior
- [async-lambda-jobs-framework](../../async-lambda-jobs-framework.md) — IMAGE_NORMALIZE
- [media-cdn-sih-domain-split](../../media-cdn-sih-domain-split.md) — media 只读 vs SIH
- [post-deploy `sih-format-allowlist-webp-png`](../../post-deploy-ledger/entries/2026-09-sih-format-allowlist-webp-png.md) — jpeg 展示过渡清理
- Skill：`cms-form-image-upload`、`image-normalize-variant-policy`
