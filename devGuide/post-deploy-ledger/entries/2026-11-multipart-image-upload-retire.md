# 退役 Backend multipart 收图（直传全量后）

Last updated: 2026-11-13

| 字段 | 值 |
|------|-----|
| **ID** | `multipart-image-upload-retire` |
| **状态** | `planned` |
| **当前已部署** | —（Phase 1：`/direct-upload` 已加；**保留**各业务 multer 收图 + 原更新接口） |
| **待完成** | 各端直传切完并发布 → Phase N 清理 backend `req.files` / multer 收图分支 |
| **Gate** | ① Customer / Merchant / WeChat / Site / CMS 相关图传均走直传 + path 业务保存；② 生产可观测期内 multipart 收图调用可忽略或为 0；③ 无第三方仍依赖旧 multipart 图字段 |
| **创建日** | 2026-11-13 |

**部署尾项:** 本 entry  
**相关:** `.cursor/skills/s3-direct-upload`；customer 头像/购物车备注已直传；merchant 仍 multipart（仅对齐上传前压缩）

## 背景

统一图传为：`presign → PUT putUrl → complete` → 业务保存只带 canonical **path**（原更新接口，不带文件字节）。

旧路径仍是「FormData / multipart 一次请求」：字段更新 + `upload.array` / `upload.single` 收图，在 controller 内写 S3 再改实体。

Phase 1 **禁止**删除 multer 收图：未切完的端（尤其 Merchant App、旧 WeChat/CMS 包）仍依赖。

`complete` **不**复用产品等 Form 更新逻辑（`USER_AVATAR` 特例会写用户表）；产品等仍调原更新接口 + `currentImages` / path 字段。

## Phase 对照

| Phase | 内容 | 部署状态 | 验证 |
|-------|------|----------|------|
| **1** | 保留 `/api` 与 `/api/admin` `direct-upload`；保留各域 multer 收图与原更新接口；客户端逐步改直传 | 进行中（按端） | 旧端 multipart 仍可用；新端直传 + path 保存正常 |
| **N** | 按 bindKind / 路由去掉 backend 收文件分支；业务更新仅接受 path；删除无用 multer 中间件与 S3 写文件辅助 | pending | 仅 Gate 通过后 |

## 消费者（收图 multipart 仍可能存在）

| Consumer | Phase 1 行为 |
|----------|----------------|
| **Customer App** | 头像 / 购物车备注：直传；OpenIM 附件等仍可能 multipart |
| **Merchant App** | 商品 / 活动 / logo：仍 multipart（+ 压缩）；直传待做 |
| **CMS / Site** | 部分已有 transport；产品等编辑器可能仍 FormData+文件 |
| **WeChat** | 多数业务图仍走既有上传，未全量直传 |
| **Backend** | 双路径并存直至 Phase N |

## 部署后债务（Post-deploy debt）

### Phase 1 生产确认（按端勾选）

- [ ] Backend `direct-upload` 生产可用；**未**删除 multipart 收图
- [ ] Customer：头像 / 购物车备注直传生产验证
- [ ] Merchant：商品 / 活动 / logo 改直传 + path 更新并发布
- [ ] CMS：产品 / 活动 / 新闻 / settings 等图传改直传并发布
- [ ] Site：相关图传改直传并发布
- [ ] WeChat：相关图传改直传并全量
- [ ] Entry 状态 → `blocked`（等全量）或 `active`

### Phase N 清理（Gate 通过后）

- [ ] 生产无（或可忽略）multipart 业务收图调用
- [ ] Grep：路由/controller 无未文档化的 `upload.array` / `upload.single` 业务图路径（expense OCR 等若仍例外须在 entry 注明保留）
- [ ] 删除产品 / 头像 / 购物车备注 / 活动 / logo / 新闻等已迁移域的 `req.files` 写 S3 分支
- [ ] 确认更新接口仅 path / `currentImages`（或等价 JSON 字段）
- [ ] 本 entry → `done`；registry 移至已归档

## 相关链接

- Backend: `domains/direct-upload/`；`admin-product.routes.ts` `upload.array('images')`；`auth.routes.ts` `POST /user/avatar`；`merged-user-cart.routes.ts` `upload-images`；merchant-panel / offer / preorder / news / merchant-settings multer
- Skill: `.cursor/skills/s3-direct-upload/SKILL.md`
- Customer: `account-profile.api.ts`、`consumer-cart.api.ts`、`direct-upload-rn.transport.ts`
- Merchant: `direct-upload-rn.transport.ts`（壳未接业务）；`merchant-product.api.ts` multipart
