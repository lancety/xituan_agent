# User address: last-used delivery (replace default address)

Last updated: 2026-06-02

| 字段 | 值 |
|------|-----|
| **ID** | `user-address-last-used-delivery` |
| **状态** | `planned` |
| **当前已部署** | — |
| **待完成** | Phase 1（增量）→ Phase 3（清理） |
| **Gate（Phase 3 放行条件）** | WeChat 小程序新版本（读 `lastUsedDeliveryAt`、去掉「设为默认」）审核通过并 **全量**；可选：监控 7 天无 `PUT auth/user/address/set-default` |
| **创建日** | 2026-06-02 |

## 背景

WeChat / Site 用户地址「默认地址」改为「最后使用的配送地址」；自提不更新 last-used。因 **backend 先于 WeChat 审核** 部署，Phase 1 须保留 `is_default` 与 `set-default` API，Phase 3 再删除。

## Phase 对照

| Phase | 内容 | 部署状态 | 验证 |
|-------|------|----------|------|
| **1** | Migration 0331：ADD `last_used_delivery_at`；从 `is_default` 回填；**保留** `is_default` | pending | GET 含 `isDefault` + `lastUsedDeliveryAt`；配送下单双写 `is_default`；旧 WeChat 预填仍正常 |
| **1** | 下单 hook：`DELIVER` 成功 → `markLastUsedDeliveryAddress` + 双写 default | pending | 配送下单后旧版 WeChat 结账仍选该地址 |
| **1** | Site 可用新 UI（读 last-used） | pending | Site 不依赖删列 |
| **3** | Migration 0332：`DROP is_default` | pending | 仅 Gate 通过后 |
| **3** | 删 `PUT set-default`；停双写；codebase 用户地址类型去掉 `isDefault` | pending | 新 WeChat 已全量 |

## 部署后债务（Post-deploy debt）

Phase 1 上线后勾选「生产确认」；Phase 3 完成后勾选清理项。

### Phase 1 生产确认

- [ ] Migration `1710000000331_user_addresses_last_used_delivery.sql` 已在生产执行
- [ ] 配送下单后 `last_used_delivery_at` 更新
- [ ] 旧版 WeChat：结账预填、`设为默认` 仍可用
- [ ] Entry 状态 → `blocked`；registry 更新 deployed 日期

### Phase 3 清理（Gate 通过后）

- [ ] Migration `1710000000332_user_addresses_drop_is_default.sql`（序号以当时 migrations 文件夹为准）
- [ ] 移除 `set-default` 路由与 repository 双写
- [ ] `iUserAddress` 改为 `Omit<iAddressBase, 'isDefault'>` + `lastUsedDeliveryAt`
- [ ] WeChat / Site 前端已全量（无读 `isDefault` 依赖）
- [ ] 本 entry → `done`；registry 移至已归档

## 相关链接

- Cursor plan: `last_used_delivery_address`（三阶段兼容 §5）
- Backend entity: `xituan_backend/src/domains/user/domain/user-address.entity.ts`
- WeChat 预填: `xituan_wechat_app/components/user-address-selector/userAddressSelector.ts`
