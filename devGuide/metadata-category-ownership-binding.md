# 商户分类归属与平台绑定

Last updated: 2026-11-26

现行规则。历史计划里「子类继承同步 `platform_domain_id`」已作废，以本文为准。

## 三种归属（互斥）

编辑分类时的「分类归属」单选决定这一行怎么存。三种不能同时成立。

| 归属 | `parent_id` | `platform_domain_id` / `platform_category_id` | `binding_status` | 属性作用域 |
|------|-------------|-----------------------------------------------|------------------|------------|
| 无归属 | 空 | 都空 | `UNBOUND` | `MERCHANT_PARENT_CATEGORY`（本行 id） |
| 挂在商户父分类 | 指向另一商户分类 | 都空 | `UNBOUND` | `MERCHANT_SUB_CATEGORY`（本行 id） |
| 平台绑定 | 空 | 领域必填；平台分类可选 | 先 `BOUND_NO_MAP`，无阻断冲突再 `BOUND_MAPPED` | `MERCHANT_PARENT_CATEGORY`（本行 id） |

打开编辑时，单选不读 `binding_status`：有 `parent_id` 就选「挂在商户父分类」；否则本行有平台领域或平台分类才选「平台绑定」；否则「无归属」。

保存成「挂在商户父分类」或「无归属」时，清掉本行的平台领域、平台分类，状态写成 `UNBOUND`。有商户父级的行即使还留着自己的 `platform_category_id`，也不算离开平台，不把合并 schema 抄进商户作用域。

保存成「平台绑定」时清掉 `parent_id`。若这一行原来是子分类，把它自己的属性从 `MERCHANT_SUB_CATEGORY` 改到 `MERCHANT_PARENT_CATEGORY`。

## `binding_status` 只属于绑定根

绑定根 = `parent_id` 为空，且 `platform_domain_id` 或 `platform_category_id` 非空。

| 状态 | 含义 |
|------|------|
| `UNBOUND` | 这一行不是平台绑定根 |
| `BOUND_NO_MAP` | 已绑平台，商品字段仍有未知 key 或缺必填，或绑定根上的迁移任务尚未完成 |
| `BOUND_MAPPED` | 已绑平台，且当前没有上述阻断 |

子分类的状态必须是 `UNBOUND`。创建、完成、回滚迁移任务时，只有绑定根才改 `binding_status`。完成映射（`markCategoryBindingMapped`）同样要求 `parent_id IS NULL` 且 `platform_domain_id IS NOT NULL`。

判断「这行是否绑着平台」只看绑定根条件。不要用「状态不是 `UNBOUND`」或「子行上有领域 id」代替。

## 有效 schema 从绑定根追溯

商品或子分类要合并字段时，沿 `parent_id` 走到没有父级的那一行，只用那一行的平台领域和平台分类：

1. 平台行业（由领域推出）
2. 平台领域
3. 平台分类链（绑定根的 `platform_category_id` 从平台树根走到该节点）
4. 绑定根上 `MERCHANT_PARENT_CATEGORY` 的商户属性
5. 若当前分类有商户父级，再加上它自己的 `MERCHANT_SUB_CATEGORY`

挂在商户父分类下不会另取「平台树里同名子分类」的预设属性。平台子分类（例如布丁、果冻）若自有属性，商户子分类不会自动得到它们。要那些属性，该商户分类必须自己成为平台绑定根。

## 子孙不存平台副本

父级绑定或解绑时，子孙只做清空：`platform_domain_id`、`platform_category_id` 置空，`binding_status = UNBOUND`。不要把父级的领域 id 写到子行。

子行上的领域 id 不参与合并，也不表示绑定。平台领域 / 平台分类删除前的商户引用计数只统计 `parent_id IS NULL` 的行。

## 退场 / 替换按绑定世代

绑定根另有两个时刻，只写在这一行上，子孙沿 `parent_id` 共用：

- `platform_domain_bound_at`：第一次绑上领域，或换成另一个领域时刷新。解绑不清空。再绑回最近一次快照里的同一个领域时保留。行业、领域层的退场 / 替换用这个时刻。
- `platform_category_bound_at`：第一次绑上平台分类，或换成另一个平台分类时刷新。解绑不清空。再绑回最近一次快照里的同一个平台分类时保留。平台分类链各层共用这一个时刻。同一条平台父链里改分类，不刷新领域时刻。

平台属性第一次从 `ACTIVE` 变成 `RETIRED` 或 `REPLACED` 时写入 `template_status_at`。之后在退场和替换之间改状态、或只改 `replacement_key`，不移动这个时刻。改回 `ACTIVE` 时清空它和 `replacement_key`。

合并时，平台层的退场 / 替换 key 只有在对应绑定时刻早于 `template_status_at` 才进入 schema。新 key（替换后的现行字段）和 `ACTIVE` 字段照常合并。被拿掉的旧 key 可以留在商品 jsonb 里，保存时不再当成非法 key，也不删除。其它未知 key 仍按原来的绑定差异和校验处理。

仍绑着、且绑定早于退场时，旧 key 来自平台层，不自动插商户属性行。点平台行弃用时，只给当前这条商户分类写一行 `platform_off_id` 等于该平台属性 id 的弃用，五轴关闭，商品值留下。解绑时，若还没有 `MANUAL` / `OVERLAY` / `UNBIND_COPY` 行，退场或替换的旧 key 写成 `UNBIND_COPY`，并带上 `platform_attribute_id`。解绑后这份副本是商户自己的属性。点商户行弃用只写 `platform_off_id` 为空的那一行，不改 `lifecycle_status`，平台属性 id 保留。绑回同一个领域或同一个平台分类时，删掉对应该来源、且带平台属性 id 的 `UNBIND_COPY`，绑定时间不刷新，旧 key 重新来自平台层。商品值留下。空的商户弃用行不再关掉平台字段，也不拦住改回现行。写成平台属性 id 的那一行还在，平台字段五轴继续关，改回现行继续被拦住。换成另一个领域或平台分类才刷新那一轴的时间，指向旧来源的副本留下。`platform_attribute_id` 为空的 `MANUAL` 和历史 `UNBIND_COPY` 不删。

平台从退场或替换改回 `ACTIVE` 时，下面任一还开着就拒绝：弃用行的 `platform_off_id` 就是这个平台属性 id；或者 `platform_off_id` 为空，且同一商户、同一 `scope_type` + `scope_id`、同一存储键的商户行，其 `platform_attribute_id` 就是这个 id。只是同名、商户行没有挂这个 id 的，不拦。平台错误文案只说分类上已弃用、先回滚弃用。这次不给 `merchant.metadata_attribute` 做分区。

弃用只写当前这条商户分类。父分类范围是 `MERCHANT_PARENT_CATEGORY` 加这个分类 id，子分类范围是 `MERCHANT_SUB_CATEGORY` 加这个分类 id。点哪一侧就写哪一行，不改 `lifecycle_status`。两侧都在、任务又没写明是哪一侧时，创建和执行都拒绝。

| 对象 | 结果 |
|------|------|
| 当前分类上的商户行 | 写 `platform_off_id` 为空的一行 |
| 平台 `RETIRED` / `REPLACED`，并且任务写了这个平台属性 id | 写 `platform_off_id` 为该 id 的一行 |
| 平台 `ACTIVE` | 拒绝平台这一侧 |

合并时下级优先。子分类有自己的同名商户行时，用这一行，不算绑定根的同名行，也不算绑定根对这一行的弃用。子分类没有同名行时，用绑定根的同名行和绑定根上的商户弃用。绑定根也没有同名行时才用平台行；当前分类或绑定根上对这个平台属性 id 的开关开着，五轴关闭。商户行在且它的开关开着，定义仍是商户行，五轴关闭，平台开关不改变这个结果。

商品 jsonb 在绑定、解绑、再绑、弃用整条链上都不改、不删。删除商户属性定义要先打开商户行开关。删除时清掉该分类上 `platform_off_id` 为空的弃用行，平台那条弃用和已完成的迁移任务留下。商户行和空弃用行都没了之后，这一条不再拦住平台改回现行。

对齐只在本地行和继承字段完全一致时删本地行。退场副本的文案或枚举经常已经和平台不一致，所以同一来源的删除放在再绑清理 SQL 里，不靠对齐。

`UNBIND_ONLY` 在清空平台 id 之前也写一条字段列表为空的 `metadata_binding_snapshot`，否则再绑对不上上一次来源。抄写路径在清 id 之前写带字段的快照。

已经再绑过、绑定时间被刷成现在的分类，原来的时刻不在库里。本地烘焙分类做过一次手工回拨，不是迁移。生产上的同类回拨还没做。回拨之前若按新规则再解绑再绑同一来源，删掉副本后这些键不会从平台层回来，jsonb 里的值还在。

## 解绑抄写

只有这一行自己是绑定根，并且这次保存离开平台绑定时，才考虑把当时的合并 schema 写入商户作用域（`COPY_SCHEMA_TO_MERCHANT`）。

改挂到已知商户父分类时，先取该父分类的完整 schema，再和本行当前平台合并结果按字段 key 比。父分类已经有的 key 视为重叠，不抄到本分类，改挂后继续从父分类继承。只抄父分类 schema 里没有的字段（例如平台子分类多出来的属性）。没有父分类、变成无归属时，仍抄整份合并 schema。

抄写规则：

- 新行来源为 `FORK_FROM_PLATFORM`。当时 schema 里仍是平台 `RETIRED` / `REPLACED` 的旧 key，来源为 `UNBIND_COPY`，并写入 `platform_attribute_id`。作用域是该分类作为根时的 `MERCHANT_PARENT_CATEGORY`。
- 已有 `MANUAL`、`OVERLAY`、`UNBIND_COPY` 行不改定义、不改 `origin_tag`。
- 不改商品 jsonb 里的值。弃用字段或改商品值走迁移任务，不靠这次抄写。
- 若该键当时已被弃用，抄出来的显示开关是关的；弃用表记录保持 `ACTIVE`。

有 `parent_id` 的分类编辑列表只显示 `MERCHANT_SUB_CATEGORY`。若把抄写行写成 `MERCHANT_PARENT_CATEGORY` 留在子分类上，界面看不见，之后再改成平台绑定会撞唯一约束 `(merchant_id, scope_type, scope_id, storage_key)`。

## 编辑列表、迁移列表、保存提示

分类属性编辑读的是 breakdown，不是缓存的有效 schema。平台层只套平台属性 id 那条弃用。商户层只套 `platform_off_id` 为空的那条。breakdown 带上该键最近一条已完成的 `DEPRECATE_ONLY` 任务 id（`merchantDeprecateTaskId`）。

「被覆盖」只写在**状态**列，不写进**平台状态**列。平台状态仍是现行、退场或替换。存储键、显示名、平台状态、类型和该行其余文字加删除线。状态列这一格写成「被覆盖」，不加删除线。操作整列隐藏。本分类自己的行不会被标成「被覆盖」。上一级的同名商户行删掉后，这一行恢复自己的状态和操作。

谁被覆盖，只看更下一级有没有同名商户行（含已弃用）：

| 看的表 | 状态列写成「被覆盖」 | 按这一行自己的开关显示 |
|--------|----------------------|------------------------|
| 行业、领域、平台分类链 | 本分类或绑定根有同名商户行 | 两边都没有。状态是「正常」或「弃用」 |
| 子分类页面上的绑定根 | 子分类有同名商户行 | 子分类没有。状态是「正常」或「弃用」 |

CMS 与商户 App 的商户行：

- 未弃用：显示「正常」。可以「弃用迁移」，预填本分类、`DEPRECATE_ONLY`、该存储键，并标明是商户行（`merchantOff`）。不显示删除。
- 已弃用：badge 状态样式（caution），文案「弃用」。旁边是「弃用回滚」和删除。没有任务 id 时显示「无关联迁移任务」。未弃用不能删，接口返回 `PRODUCT_METADATA_ATTRIBUTE_DELETE_REQUIRES_DEPRECATE`。
- 平台层未弃用且平台状态是退场或替换：显示「弃用迁移」，并带上该平台属性 id（`platformOffId`）。平台现行不提供这一侧的弃用。

本分类「已弃用」是本作用域 `platform_off_id` 为空且仍为 `ACTIVE` 的弃用行。旧数据里 `lifecycle_status = DEPRECATED` 的行同样算已弃用。

迁移列表标题先写识别键，动作名放次要位置。单步弃用、对齐、保留自定义写源存储键；改名写「源键 → 目标键」。再绑批次先写涉及到的存储键。CMS `MetadataMigrationBatchBoard` 与商户 App `MetadataMigrationsScreen` 都这样。

离开平台绑定时，说明写明会把合并 schema 写入商户作用域，并给出两个入口：本分类的弃用迁移，以及 Metadata 分层。

保存分类时：

- 同名属性还在使用且类型和平台不一致：拦住，不保存。提示先迁到新的自定义属性再弃用，或先弃用再绑定。
- 已弃用的同名属性类型不同：确认后删除这些定义，并清掉本分类及下级商品里该键的已填值。要留值就取消，先用属性迁移搬走。确认提交带 `confirmDiscardDeprecatedValues`。

## 实现位置

- 归属保存：`xituan_backend/src/domains/product/services/product.service.ts`（`configureMerchantCategory`、`categoryHasPlatformBinding`）
- 子孙清空、完成映射：`xituan_backend/src/domains/product/infrastructure/product.repository.ts`（`applyBindingDescendantsCascadeUsingQuery`）
- 合并：`xituan_backend/src/domains/metadata/services/product-metadata-schema.service.ts`（`loadMerchantParentCategory`）
- 迁移任务改状态：`xituan_backend/src/domains/metadata/services/metadata-migration-task.service.ts`（`updateCategoryBindingStatus`）
- 删除依赖：`xituan_backend/src/domains/metadata/utils/platform-metadata-delete-guard.util.ts`
- 同一来源清理与绑定时间：`product.repository.ts` 的 `rebindCopiedAttributeCleanupSql`、`platformBindingClockAssignmentSql`
- CMS 单选与离开平台提示：`xituan_cms/src/components/forms/CategoryEditorModal.tsx`、`xituan_cms/src/utils/category-configure-save.util.tsx`
- CMS 属性列表与迁移列表：`xituan_cms/src/pages/category-metadata.tsx`、`xituan_cms/src/components/metadata/MetadataMigrationBatchBoard.tsx`
- 商户端同一判定与编辑、迁移、保存确认：`xituan_app_merchant/src/utils/merchant-category-binding.util.ts`、`CategoryMetadataScreen.tsx`、`MetadataMigrationsScreen.tsx`、`CategoryEditScreen.tsx`

## 相关文档

- 历史总框架（其中子类继承领域 id 的句子以本文为准）：[商品_metadata_通用化_70835335.plan.md](./商品_metadata_通用化_70835335.plan.md)
- 开发约束清单：[`.cursor/skills/metadata-category-inheritance/SKILL.md`](../../.cursor/skills/metadata-category-inheritance/SKILL.md)
- 弃用与平台退场用词：[`.cursor/skills/product-metadata-schema/SKILL.md`](../../.cursor/skills/product-metadata-schema/SKILL.md)
- 该条 post-deploy 已关闭，不再洗历史副本：[post-deploy `metadata-rebind-provenance-batch`](./post-deploy-ledger/entries/2026-09-metadata-rebind-provenance-batch.md)
