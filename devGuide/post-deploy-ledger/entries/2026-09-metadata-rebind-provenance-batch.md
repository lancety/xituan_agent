# metadata 解绑 provenance 与迁移批次

Last updated: 2026-11-25

| 字段 | 值 |
|------|-----|
| **ID** | `metadata-rebind-provenance-batch` |
| **状态** | `done` |
| **Phase1 首次进版** | `v4.0.0`（migration `0363`） |
| **最早可清理** | — |
| **完成日** | `2026-11-25` |
| **当前已部署** | Phase 1 自 4.0。没有后续数据清洗 |
| **待完成** | — |
| **Gate** | ✅ 关闭。原 Phase N 清洗按最终方案取消 |
| **创建日** | 2026-09-29 |

## 背景

解绑 upsert 曾把整份 effective schema（含 MANUAL）打成 `UNBIND_COPY`，再绑按该 tag 删除，自定义字段丢失。Phase 1 改为写入 snapshot、新副本用 `FORK_FROM_PLATFORM`，冲突行保留 MANUAL/OVERLAY。没有平台属性 id 的历史 `UNBIND_COPY` 再绑仍不删。带平台属性 id 且再绑回同一来源的，由现行清理删除。

## Phase 对照

| Phase | 内容 | 部署状态 | 验证 |
|-------|------|----------|------|
| **1** | 加 snapshot / batch / epoch；解绑保留 MANUAL；再绑删 `FORK_FROM_PLATFORM`。同一来源再绑另删带 `platform_attribute_id` 的 `UNBIND_COPY` | 已在 4.0 起，再绑删除规则随后续版本 | 解绑后 MANUAL 不变 |
| **N** | 原计划：清洗历史 `UNBIND_COPY`、去掉兼容读、`override_mask` | 取消 | 见下方关闭说明 |

## 关闭说明（2026-11-25）

原 Phase N 不执行。

- 没有 `platform_attribute_id` 的历史 `UNBIND_COPY` 是旧解绑误标，行本身是商户自己的属性，不能删，也不改标签。
- 带平台属性 id、再绑回同一来源的退场/替换副本，由现行再绑清理删除，不另做迁移。
- 代码里没有 `override_mask`，也没有为这种旧行留的兼容读。
- 现行手动、覆盖、解绑都不会再写出没有平台属性 id 的 `UNBIND_COPY`。

生产上「绑定时间已被刷晚」的回拨不在本条，仍另案。

## Gate（可验证）

- [x] Backend migration `1710000000363_metadata_rebind_batch_snapshot.sql` 随 `v4.0.0` 进版（registry 已记）
- [x] CMS 再绑批次看板随 Phase 1 进版
- [x] 解绑保留原 `MANUAL` 行，这是现行写入规则，不再单列清洗

## 部署后债务（Post-deploy debt）

- [x] 不再做「再绑后自定义字段消失」的专项回补。现行再绑只删 `FORK_FROM_PLATFORM` 和同一来源且带平台属性 id 的 `UNBIND_COPY`
- [x] 取消 `UNBIND_COPY` 清洗。没有平台属性 id 的历史行留下。带平台属性 id、且再绑回同一来源的退场/替换副本由再绑清理删除
