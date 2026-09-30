# metadata 解绑 provenance 与迁移批次

Last updated: 2026-09-29

| 字段 | 值 |
|------|-----|
| **ID** | `metadata-rebind-provenance-batch` |
| **状态** | `planned` |
| **当前已部署** | — |
| **待完成** | Phase 1（加表、解绑不再改写 MANUAL、再绑不再删除历史 UNBIND_COPY）→ Phase N（清洗 UNBIND_COPY、override_mask） |
| **Gate** | CMS 批次看板已发版，且生产解绑后抽查 MANUAL 行 origin_tag 仍为 MANUAL |
| **创建日** | 2026-09-29 |

## 背景

解绑 upsert 曾把整份 effective schema（含 MANUAL）打成 `UNBIND_COPY`，再绑按该 tag 删除，自定义字段丢失。Phase 1 改为写入 snapshot、新副本用 `FORK_FROM_PLATFORM`，冲突行保留 MANUAL/OVERLAY。历史 `UNBIND_COPY` 再绑时不删。

## Phase 对照

| Phase | 内容 | 部署状态 | 验证 |
|-------|------|----------|------|
| **1** | 加 snapshot / batch / epoch；解绑保留 MANUAL；再绑只删 `FORK_FROM_PLATFORM` | pending | 解绑后 MANUAL 不变；历史 UNBIND_COPY 仍在 |
| **N** | 清洗历史 UNBIND_COPY、去掉兼容读 | pending | Gate 后单独 PR |

## Gate（可验证）

- [ ] Backend migration `1710000000363_metadata_rebind_batch_snapshot.sql` 已在生产执行
- [ ] CMS 含再绑批次看板的版本已发版
- [ ] 抽查：解绑后原 MANUAL 行 `origin_tag` 仍为 MANUAL

## 部署后债务（Post-deploy debt）

- [ ] 确认生产无「再绑后自定义字段消失」回归
- [ ] Gate 满足后再做 UNBIND_COPY 清洗
