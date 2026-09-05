# image-normalize-full-backfill

Last updated: 2026-09-06

## 摘要

Phase C4：对业务 S3 桶内**全部存量图**跑 IMAGE_NORMALIZE（canonical + `_w64/_w128/_w256`）。  
**定案变更（2026-09-06）：取消排除名单** — 活动头图/轮播、新闻、订单/`noteImages` 等**一律纳入**预生成。

## 当前掌握的信息

- C3 已对新上传 product/news/logo enqueue；存量仍为 jpg/png 等，直链 `_w*` 可能 404。**定案不做** onError→SIH；靠 C4 全量预生成消化，漏网再补跑。
- 旧口径曾排除活动头图/轮播/`noteImages`；现改为 **全量回填**。
- 回填可复用现有 normalize 契约（inline 或 production SQS→Lambda）；需扫库字段 +/或 list 桶前缀，避免漏扫。
- 框架文档：[async-lambda-jobs-framework.md](../../async-lambda-jobs-framework.md)

## 期望目标结果

- [ ] 批处理：桶内业务图均有 canonical（**webp** 或 logo **png**）+ `_w64/_w128/_w256`
- [ ] **DB path 回写为 canonical**（`.webp` / `.png`），不再以 `.jpg`/`.jpeg` 作为列表/详情主 path
- [ ] 临时/源 jpg 可在回写后按策略删除（与 C3「暂不删」不同，回填批次可清理）
- [ ] **无**业务类型排除名单
- [ ] 可重跑、幂等（`force` / 已存在可 skip）
- [ ] 回填完成后触发 Gate：SIH / 客户端 **不再需要** 支持 jpeg/jpg 主路径（见 post-deploy `sih-format-allowlist-webp-png`）
- [ ] 本 entry → `done`

## 触发条件 / 目标窗口

C3 新上传链路在 dev/demo 测稳后，再跑全量预生成。

**跑法定案：** 大批量优先用**开发者本机**跑批处理（复用 Backend `imageNormalizeInlineWorker` / agent `handler` 同契约：读/写真实业务桶 + 按需回写 DB），**不**依赖 production Lambda/SQS 扛回填。Lambda 仅服务线上增量 enqueue。

## 实施备忘（可选草稿）

- 候选扫源：`products.images`、`news.images`、offer/preorder header+featured/carousel、merchant logo、cart/order `noteImages`、以及桶 list 校对漏网。
- 本机脚本：限速、断点续跑、幂等 skip（目标已存在且未 `--force`）、日志失败 key。
- 不必为回填单独扩 Lambda 并发；有 AWS 凭证 + `S3_BUCKET` 即可。
