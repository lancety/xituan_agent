# 流水手工创建写入 ledger_block_id

Last updated: 2026-10-30

| Field | Value |
|-------|-------|
| **ID** | `ledger-intake-manual-ledger-block-id` |
| **Status** | `planned` |
| **Deployed** | — |
| **Pending** | Phase 1：流水单行/批量新建写 `ledger_block_id`；删块预览列表；无 Phase N DROP |
| **Gate** | CMS 流水入账页含本行为已发版；生产确认删块只带走带该列的账 |
| **Created** | 2026-10-30 |

## Background

此前 `ledger_block_id` 仅计入/电商**自动入账**写入，删块 CASCADE 只删自动账。流水界面手工「创建」故意不写该列。

产品改为：流水界面**新建**（单行与批量）也写当前已保存块的 `ledger_block_id`，以便删块时一并带走。绑定已有账、OCR、收支管理手工创建仍不写。无新列；旧手工账该列为空，不会被误删。

## Phase 1（增量）

- 单行/批量创建请求带 `ledgerBlockId`（仅已保存块）
- 删块前 `GET .../blocks/:id/linked-books` 展开列表，确认后 CASCADE 删除
- 相关单据查重：已有带 `ledger_block_id` 且同额同日 → 不新建
- 文档/skill：更正「手工账禁止写 ledger_block_id」为「绑定/OCR 禁止写」

## Phase N

无。无需 DROP 或兼容层清理。

## Checklist

### Pre-deploy

- [x] 登记本 entry + registry 行
- [ ] 部署 backend + CMS（同窗口）

### Post-deploy

- [ ] 生产确认：流水新建账有 `ledger_block_id`；绑定/OCR 仍为空
- [ ] 生产确认：删块列表与 CASCADE 范围一致
- [ ] 本 entry → `done`；registry 归档
