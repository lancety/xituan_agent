# OpenIM CDN 泳道收敛（clientApp 默认 / CDN 混用清理）

Last updated: 2026-11-13

| 字段 | 值 |
|------|-----|
| **ID** | `openim-cdn-lane-util-cleanup` |
| **状态** | `planned` |
| **当前已部署** | —（Phase 1：增量 `cdnLane` + 上传显式传端；**保留** `buildAttachmentUrl` 可选 `clientApp` 默认 WECHAT） |
| **待完成** | 全端展示/上传调用均显式传 lane 或 clientApp → Phase N 去掉 CDN util 静默默认，对外以 lane 为主 |
| **Gate** | ① codebase 已有 `epOpenimCdnLane`（或等价）+ `cdnLaneFromClientApp`；② 微信 / Site / CMS / App 上传与展示调用均无「依赖默认 WECHAT」；③ grep 无省略 `clientApp`/`lane` 的 CDN 拼 URL 关键路径（测试除外） |
| **创建日** | 2026-11-13 |

**部署尾项:** 本 entry  
**相关:** [openim-attachment-multipart-retire](./2026-11-openim-attachment-multipart-retire.md)；`xituan_codebase/utils/openim-attachment-cdn.util.ts`

## 背景

CDN 实际只有两档：`wechat` → `wechatMedia`/`wechatContent`；其余端 → `media`/`content`（均读各环境 `siteDomain`）。  
`epOpenimClientApp` 仍表示产品端（localStorage / cross-tab），**不应**与 CDN 开关混为一谈。

旧行为：`buildAttachmentUrl(..., clientApp?)` 默认 `WECHAT`，导致 CMS/Site multipart 冻进消息的主机也偏微信 CDN。

## Phase 对照

| Phase | 内容 | 部署状态 | 验证 |
|-------|------|----------|------|
| **1** | codebase：二档 `cdnLane` + 从 `clientApp` 映射；上传 complete/persist **显式**传 CMS/SITE/WECHAT；签名保持可选默认以兼容未改调用方 | 待与 CMS/Site 直传同批 | 旧端 sync codebase 不崩；新上传按端冻正确主机 |
| **N** | 去掉 CDN util 对 `clientApp` 的静默默认；对外拼 URL 以 `lane`（或必填 clientApp）为准；清理遗留省略调用 | pending | Gate 后单独 PR；**不删** `epOpenimClientApp` 枚举本身 |

## 明确保留

- `epOpenimClientApp`（WECHAT/SITE/CMS/PLATFORM）用于非 CDN 场景  
- `siteDomain` 各环境子域定义  
- 微信合法域名约束下的 `wechatMedia` / `wechatContent` 分域（不合并进 `media`）

## 部署后债务（Post-deploy debt）

### Phase 1

- [ ] codebase 合并 `cdnLane` 映射；上传路径显式传端
- [ ] CMS/Site 直传 complete 冻 `xituan`（media/content）
- [ ] multipart OpenIM（若仍存在）按调用端传 clientApp，不再依赖「忘传 → WECHAT」作为 CMS/Site 行为
- [ ] Entry → `active` / `blocked`

### Phase N（Gate 通过后）

- [ ] 全端调用点已显式传 `lane` 或 `clientApp`
- [ ] 移除 `buildAttachmentUrl` / normalize* 的默认 `WECHAT`（或改为仅接受 `lane`）
- [ ] 文档/技能注明：CDN 用 lane；clientApp 仅身份
- [ ] 本 entry → `done`；registry 归档

## 相关链接

- `submodules/xituan_codebase/utils/openim-attachment-cdn.util.ts`
- CMS/Site `openim-message.util.ts`（展示已传 CMS/SITE）
- Backend `openim-attachment.service.ts`（persistUpload / complete）
