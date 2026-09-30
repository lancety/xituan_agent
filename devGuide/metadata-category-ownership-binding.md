# 商户分类归属与平台绑定

Last updated: 2026-09-30

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

## 解绑抄写

只有这一行自己是绑定根，并且这次保存离开平台绑定时，才把当时的合并 schema 写入商户作用域（`COPY_SCHEMA_TO_MERCHANT`）。

抄写规则：

- 新行来源为 `FORK_FROM_PLATFORM`，作用域是该分类作为根时的 `MERCHANT_PARENT_CATEGORY`。
- 已有 `MANUAL`、`OVERLAY` 行不改定义、不改 `origin_tag`。
- 不改商品 jsonb 里的值。弃用字段或改商品值走迁移任务，不靠这次抄写。

有 `parent_id` 的分类编辑列表只显示 `MERCHANT_SUB_CATEGORY`。若把抄写行写成 `MERCHANT_PARENT_CATEGORY` 留在子分类上，界面看不见，之后再改成平台绑定会撞唯一约束 `(merchant_id, scope_type, scope_id, storage_key)`。

## 实现位置

- 归属保存：`xituan_backend/src/domains/product/services/product.service.ts`（`configureMerchantCategory`、`categoryHasPlatformBinding`）
- 子孙清空、完成映射：`xituan_backend/src/domains/product/infrastructure/product.repository.ts`（`applyBindingDescendantsCascadeUsingQuery`）
- 合并：`xituan_backend/src/domains/metadata/services/product-metadata-schema.service.ts`（`loadMerchantParentCategory`）
- 迁移任务改状态：`xituan_backend/src/domains/metadata/services/metadata-migration-task.service.ts`（`updateCategoryBindingStatus`）
- 删除依赖：`xituan_backend/src/domains/metadata/utils/platform-metadata-delete-guard.util.ts`
- CMS 单选：`xituan_cms/src/components/forms/CategoryEditorModal.tsx`、`xituan_cms/src/utils/category-binding-snapshot.util.ts`
- 商户端同一判定：`xituan_app_merchant/src/utils/merchant-category-binding.util.ts`

## 相关文档

- 历史总框架（其中子类继承领域 id 的句子以本文为准）：[商品_metadata_通用化_70835335.plan.md](./商品_metadata_通用化_70835335.plan.md)
- 开发约束清单：[`.cursor/skills/metadata-category-inheritance/SKILL.md`](../../.cursor/skills/metadata-category-inheritance/SKILL.md)
