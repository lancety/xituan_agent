# 平台 metadata 去掉 CMS/站点/打印可见性列

Last updated: 2026-11-15

| 字段 | 值 |
|------|-----|
| **ID** | `platform-metadata-drop-cms-site-print-vis` |
| **状态** | `planned` |
| **Phase1 版本** | `TBD`（建议目标 `4.4.0`：去三轴 UI/读响应；列恒 true 保留） |
| **可清理版本** | `≥Phase1+1`（例 Phase1@4.4 → cleanup@≥4.5 DROP 三列） |
| **当前已部署** | migration `0404` 刷存量；Platform UI/写类型 Phase 1 尚未收完 |
| **待完成** | 实施 Phase 1 定版号 → Phase N DROP 三列 |
| **Gate** | 含 Phase 1 的统一版本生产全量；无客户端依赖三轴响应 |
| **创建日** | 2026-11-07 |

## 背景

平台退场靠 `RETIRED`/`REPLACED`；CMS/站点/打印展示改由商户分类 metadata 控制。平台侧三轴配置无产品意义，应删除而非仅 UI 隐藏。列 DROP 需等读路径不再依赖后再做。

## Phase 对照

| Phase | 内容 | 部署状态 | 验证 |
|-------|------|----------|------|
| **1** | Platform UI 去掉三轴；create/update 忽略并恒写 true；merge 平台层三轴视为 true；刷存量 migration `0404`；写类型仅 `facetInSite`/`indexInSearch`；读响应 visibility 不再含三轴 | pending | Platform 仅配分面/索引；商户仍可关 CMS/站点/打印 |
| **N** | Migration DROP 三列；INSERT/UPDATE/SELECT 不再引用；删除 coerce 中对列的写入 | pending | Gate 后单独 PR |

## Gate（可验证）

- [ ] Backend + Platform Phase 1 已生产发版
- [ ] 生产 Platform 属性页无 CMS/站点/打印控件；保存后 DB 三列仍为 true（列未 DROP 前）
- [ ] 无监控/脚本依赖 `platform.metadata_attribute` 响应中的 `visibleInCms` / `visibleInSite` / `visibleInPrint`

## 部署后债务（Post-deploy debt）

- [ ] 确认 Phase 1 生产行为（商户 overlay 仍可关展示）
- [ ] Gate 满足后单独 PR：DROP 三列 + 清理 SQL/类型残留
- [ ] DROP 后更新本 entry → `done`，registry 归档
