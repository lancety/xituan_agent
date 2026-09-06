# image-normalize-full-backfill

Last updated: 2026-09-06

## 摘要

Phase C4：对业务 S3 桶内**全部存量图**跑 IMAGE_NORMALIZE（canonical + `_w64/_w128/_w256/_w512`）。
**定案变更（2026-09-06）：取消排除名单** — 活动头图/轮播、新闻、订单/`noteImages` 等**一律纳入**预生成。

## 当前掌握的信息

- C3 已对新上传 product/news/logo/offer/preorder/preset **以及** cart/order noteImages、user avatar、expense 收据、printTemp 图 enqueue；存量仍靠 C4。**定案不做** onError→SIH。
- 旧口径曾排除活动头图/轮播/`noteImages`；现改为 **全量回填**。
- 回填可复用现有 normalize 契约（inline 或 production SQS→Lambda）；需扫库字段 +/或 list 桶前缀，避免漏扫。
- 框架文档：[async-lambda-jobs-framework.md](../../async-lambda-jobs-framework.md)

## 期望目标结果

- [x] 本机扫库脚本：`scripts/backfill-image-normalize.ts`（`npm run jobs:backfill-normalize`）
- [ ] 批处理：按 `IMAGE_NORMALIZE_VARIANT_POLICY` 生成 canonical + 该 kind 允许的 `_w*`（expense 仅 `_w256`）
- [ ] **DB path 回写为 canonical**（`.webp` / `.png`），不再以 `.jpg`/`.jpeg` 作为列表/详情主 path
- [ ] 临时/源 jpg 可在回写后按策略删除（脚本 `--delete-source`）
- [ ] 表外 `_w*` 可用 `--prune-orphans` 清理
- [ ] **无**业务类型排除名单（printTemp JSON 嵌 path 仍靠上传链路；可选桶 list 二期）
- [ ] 可重跑、幂等（`force` / 已存在可 skip）
- [ ] 回填完成后触发 Gate：SIH / 客户端 **不再需要** 支持 jpeg/jpg 主路径（见 post-deploy `sih-format-allowlist-webp-png`）
- [ ] 本 entry → `done`

## 触发条件 / 目标窗口

C3 新上传链路在 dev/demo 测稳后，再跑全量预生成。

**跑法定案：** 大批量优先用**开发者本机**跑批处理（复用 Backend `imageNormalizeInlineWorker` / agent `handler` 同契约：读/写真实业务桶 + 按需回写 DB），**不**依赖 production Lambda/SQS 扛回填。Lambda 仅服务线上增量 enqueue。

## 本机脚本（已落地）

路径：`xituan_backend/scripts/backfill-image-normalize.ts`  
命令：`npm run jobs:backfill-normalize -- --env development --dry-run`

- 扫库：product/news/offer/preorder/preset/logo/logoRect/cart note/order note/avatar/expense/openim image（**不含** printTemp 嵌在模板 JSON 的 path）
- **variants / format**：一律读 codebase `IMAGE_NORMALIZE_VARIANT_POLICY`（与新图 enqueue 同源）；expense_receipt → `[256]` + webp
- 处理：inline Sharp（同 `imageNormalizeInlineWorker`）+ completion 回写 DB；variant `withoutEnlargement`
- 删源：默认 `--delete-source`（源 key ≠ canonical 时删）；`--no-delete-source` 保留；production 需 `--confirm-prod`
- 清理表外档：`--prune-orphans`（可先 `--dry-run`）
- 幂等：canonical+policy `_w*` 已齐则 skip 编码，仍会尝试 DB 回写；`--force` 强制重压
- 先 `--dry-run` / `--limit 20`，确认后再全量

### 改尺寸工作流（可信配置）

1. 改 `xituan_codebase` `IMAGE_NORMALIZE_VARIANT_POLICY`（及 Lambda `VARIANT_POLICY` 同步）
2. 跑预生成 / 或 `--kinds …`；删档则 `--prune-orphans`
3. 再用 `getContentUrlImageForKind` / progressive(+kind) 接 UI；未配置边长会 **throw**

## 实施备忘

- 不必为回填单独扩 Lambda 并发；有 AWS 凭证 + 桶配置即可。
- 桶 list 校对漏网可作第二阶段（库扫不到的孤儿对象）。
