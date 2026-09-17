# image-normalize-full-backfill

Last updated: 2026-09-17

## 摘要

Phase C4：对业务 S3 桶内**全部存量图**跑 IMAGE_NORMALIZE（canonical + `_w64/_w128/_w256/_w512`）。
**定案变更（2026-09-06）：取消排除名单** — 活动头图/轮播、新闻、订单/`noteImages` 等**一律纳入**预生成。

**状态：`done`（2026-09-17）** — 开发者确认本机全量批处理已跑完。

## 当前掌握的信息

- C3 已对新上传 product/news/logo/offer/preorder/preset **以及** cart/order noteImages、user avatar、expense 收据、printTemp 图 enqueue；存量靠 C4 本机回填。**定案不做** onError→SIH。
- 回填复用 normalize 契约；脚本：`xituan_backend/scripts/backfill-image-normalize.ts`（`npm run jobs:backfill-normalize`）。
- **跑法定案：** 大批量用本机批处理，**不**走 production Lambda/SQS；Lambda 仅服务线上增量。
- 框架文档：[async-lambda-jobs-framework.md](../../async-lambda-jobs-framework.md)

## 期望目标结果

- [x] 本机扫库脚本：`scripts/backfill-image-normalize.ts`（`npm run jobs:backfill-normalize`）
- [x] 批处理：按 `IMAGE_NORMALIZE_VARIANT_POLICY` 生成 canonical + 该 kind 允许的 `_w*`（expense 仅 `_w256`）
- [x] **DB path 回写为 canonical**（`.webp` / `.png`），不再以 `.jpg`/`.jpeg` 作为列表/详情主 path
- [x] 临时/源 jpg 可在回写后按策略删除（脚本 `--delete-source`）
- [x] 表外 `_w*` 可用 `--prune-orphans` 清理
- [x] **无**业务类型排除名单（printTemp JSON 嵌 path 仍靠上传链路；可选桶 list 二期）
- [x] 可重跑、幂等（`force` / 已存在可 skip）
- [x] 全量本机回填已执行完成（开发者确认 2026-09-17）
- [ ] 回填完成后触发 Gate：SIH / 客户端 **不再需要** 支持 jpeg/jpg 主路径（见 post-deploy `sih-format-allowlist-webp-png`）— **属 post-deploy，不阻塞本 entry 关闭**
- [x] 本 entry → `done`

## 触发条件 / 目标窗口

已满足：C3 测稳后执行本机全量预生成。

## 本机脚本（已落地）

路径：`xituan_backend/scripts/backfill-image-normalize.ts`  
命令：`npm run jobs:backfill-normalize -- --env development --dry-run`

- 扫库：product/news/offer/preorder/preset/logo/logoRect/cart note/order note/avatar/expense/openim image（**不含** printTemp 嵌在模板 JSON 的 path）
- **variants / format**：一律读 codebase `IMAGE_NORMALIZE_VARIANT_POLICY`
- 处理：inline Sharp + completion 回写 DB；`--delete-source` / `--prune-orphans` / `--force` 等见脚本帮助

### 改尺寸工作流（可信配置）

1. 改 `xituan_codebase` `IMAGE_NORMALIZE_VARIANT_POLICY`（及 Lambda `VARIANT_POLICY` 同步）
2. 跑预生成 / 或 `--kinds …`；删档则 `--prune-orphans`
3. 再用 `getContentUrlImageForKind` / progressive(+kind) 接 UI；未配置边长会 **throw**

## 收尾备注

- jpeg/jpg 主路径下线仍跟踪 post-deploy：`sih-format-allowlist-webp-png`（检查 Gate 后再做 Phase N）。
- 桶 list 校对漏网对象仍可作为运维可选二期，不单开 planned-work，除非再次发现大面积漏扫。
