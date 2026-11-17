# 流水手工创建写入 ledger_block_id

Last updated: 2026-11-16

| Field | Value |
|-------|-------|
| **ID** | `ledger-intake-manual-ledger-block-id` |
| **Status** | `done` |
| **Phase1 版本** | 已在当前代码（随流水入账） |
| **可清理版本** | 无 Phase N |
| **Deployed** | 见下方「实际行为」 |
| **Pending** | 无。本条不再作为 todo |
| **Gate** | 已满足：新建写列、绑定不写、删块预览与税锁已在 |
| **Created** | 2026-10-30 |

## 实际行为（2026-11-16 核对）

- 银行行、电商行的单笔新建，以及批量新建，请求带当前已保存块的 `ledgerBlockId`，backend 写入 `revenues` / `expenses.ledger_block_id`。
- 绑定已有账不写该列。不计入账本的支出绑定只补 bank-row link。
- 收支管理页单独新建只有调用方带了 `ledgerBlockId` 才写（从流水页打开才会带）。
- 带 `ledgerBlockId` 的创建会做相关单据查重。
- 删块前 `GET .../linked-books`；税期锁定则拒绝。删块后这些账靠 `ledger_block_id` CASCADE 带走。自动入账同步不会改这些手工账。

没有未做的产品项。本条关闭。

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
- [x] backend + CMS 行为已在代码中（2026-11-16 核对）

### Post-deploy

- [x] 代码核对：新建有 `ledger_block_id`；绑定不写
- [x] 删块列表与 CASCADE 范围在 `deleteBlock` / `getLinkedBooks`
- [x] 本 entry → `done`；registry 归档
