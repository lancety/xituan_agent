# category-cache-cross-clients

Last updated: 2026-11-07

## 摘要

Merchant App 分类本地缓存 + admin sync 已落地。其余端复用同一 sync 契约。**mid** 优先。

Cursor plan：`d:/projects/xituan_module/.cursor/plans_planned/category_cache_manager_4e059f17.plan.md`

## 当前掌握的信息

- Backend admin `categories/sync` + 软删 purge（平台手动、≥45 天）已有。
- `merchantCategoryCacheUtil` 已接条码/分类列表/编辑/迁移等。
- 待复用：CMS、Site public sync、微信 panel、Customer（若需要离线/筛选）。

## 期望目标结果

### 计划要做的

- [ ] 定各端是否需要本地缓存或仅拉取 sync
- [ ] CMS / Site / WeChat / Customer 按同一契约接入（能复用 util 则复用）

### 触发后才做的

- （无）主动启动即可

## 触发条件 / 目标窗口

mid；分类相关性能/离线需求出现时启动。
