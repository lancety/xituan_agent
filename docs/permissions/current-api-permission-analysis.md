# 当前API权限实施情况分析

## 一、权限实施方式统计

### 1.1 使用角色权限的API（requireAdmin / requireRole）

#### Revenue模块
- **文件**: `xituan_backend/src/domains/revenue/routes/revenue.routes.ts`
- **当前权限**: `requireAdmin`（所有路由）
- **路由**:
  - `GET /api/revenues` - 查看列表
  - `GET /api/revenues/:id` - 查看详情
  - `POST /api/revenues` - 创建
  - `PUT /api/revenues/:id` - 更新

#### Expense模块
- **文件**: `xituan_backend/src/domains/expense/routes/expense.routes.ts`
- **当前权限**: `requireAdmin`（所有路由）
- **路由**:
  - `GET /api/expenses` - 查看列表
  - `GET /api/expenses/:id` - 查看详情
  - `POST /api/expenses` - 创建
  - `PUT /api/expenses/:id` - 更新
  - `DELETE /api/expenses/:id` - 删除
  - `POST /api/expenses/upload` - 上传识别
  - `POST /api/expenses/:id/re-ocr` - 重新OCR
  - `POST /api/expenses/:id/re-analyze` - 重新分析
  - `POST /api/expenses/upload-manual` - 手动上传

#### Supplier模块
- **文件**: `xituan_backend/src/domains/supplier/routes/supplier.routes.ts`
- **当前权限**: `requireAdmin`（所有路由）
- **路由**:
  - `GET /api/suppliers` - 查看列表
  - `GET /api/suppliers/all` - 查看全部
  - `GET /api/suppliers/:id` - 查看详情
  - `POST /api/suppliers` - 创建
  - `PUT /api/suppliers/:id` - 更新
  - `DELETE /api/suppliers/:id` - 删除

#### Equipment模块
- **文件**: `xituan_backend/src/domains/equipment/routes/equipment.routes.ts`
- **当前权限**: `requireAdmin`（所有路由）
- **路由**:
  - `GET /api/equipment` - 查看列表
  - `GET /api/equipment/:id` - 查看详情
  - `POST /api/equipment` - 创建
  - `PUT /api/equipment/:id` - 更新
  - `DELETE /api/equipment/:id` - 删除

#### Equipment Depreciation模块
- **文件**: `xituan_backend/src/domains/equipment-depreciation/routes/equipment-depreciation.routes.ts`
- **当前权限**: `requireAdmin`（所有路由）
- **路由**:
  - `GET /api/equipment-depreciation-records` - 查看列表
  - `GET /api/equipment-depreciation-records/:id` - 查看详情
  - `POST /api/equipment-depreciation-records` - 创建
  - `PUT /api/equipment-depreciation-records/:id` - 更新
  - `DELETE /api/equipment-depreciation-records/:id` - 删除
  - `POST /api/equipment-depreciation/generate-report` - 生成报告
  - `GET /api/equipment-depreciation/report/:financialYear` - 获取报告
  - `GET /api/equipment-depreciation/report/:financialYear/summary` - 获取报告摘要

#### Financial模块
- **文件**: `xituan_backend/src/domains/financial/routes/tax-return-report.routes.ts`
- **当前权限**: `requireAdmin`（所有路由）
- **路由**:
  - `POST /api/tax-return-report/generate` - 生成报告
  - `GET /api/tax-return-report/id/:id` - 根据ID获取报告
  - `POST /api/tax-return-report/:id/commit` - 提交报告
  - `POST /api/tax-return-report/:id/amend` - 修改报告
  - `GET /api/tax-return-report/:id/audit-logs` - 获取审计日志
  - `GET /api/tax-return-report/:financialYear/versions` - 获取所有版本
  - `GET /api/tax-return-report/:financialYear` - 根据财年获取报告

#### Partner模块
- **文件**: `xituan_backend/src/domains/partner/routes/partner.routes.ts`
- **当前权限**: `requireAnyRole([ADMIN, SUPER_ADMIN])`（所有路由）
- **路由**:
  - `GET /api/partner-invoice-summaries` - 查看结算单列表
  - `POST /api/partner-invoice-summaries` - 创建结算单
  - `GET /api/partner-invoice-summaries/unsettled-invoices` - 查看未结算发票
  - `GET /api/partner-invoice-summaries/:id` - 查看结算单详情
  - `PUT /api/partner-invoice-summaries/:id` - 更新结算单
  - `DELETE /api/partner-invoice-summaries/:id` - 删除结算单
  - `GET /api/partner-invoice-summaries/:id/generate-pdf` - 生成PDF
  - `GET /api/partners` - 查看合作伙伴列表
  - `GET /api/partners/:id` - 查看合作伙伴详情
  - `POST /api/partners` - 创建合作伙伴
  - `PUT /api/partners/:id` - 更新合作伙伴
  - `DELETE /api/partners/:id` - 删除合作伙伴
  - `GET /api/partners/:partnerId/addresses` - 查看地址列表
  - `GET /api/partners/:partnerId/addresses/:addressId` - 查看地址详情
  - `POST /api/partners/:partnerId/addresses` - 创建地址
  - `PUT /api/partners/:partnerId/addresses/:addressId` - 更新地址
  - `DELETE /api/partners/:partnerId/addresses/:addressId` - 删除地址
  - `GET /api/partner-invoices` - 查看发票列表
  - `GET /api/partner-invoices/:id` - 查看发票详情
  - `POST /api/partner-invoices` - 创建发票
  - `PUT /api/partner-invoices/:id` - 更新发票
  - `DELETE /api/partner-invoices/:id` - 删除发票
  - `PUT /api/partner-invoices/:id/deductions` - 更新扣减
  - `PUT /api/partner-invoices/:id/status` - 更新状态
  - `POST /api/partner-invoices/:id/generate-pdf` - 生成PDF
  - `POST /api/partner-invoice-summaries/:id/confirm-payment` - 确认付款
  - `POST /api/partners/batch` - 批量获取合作伙伴
  - `POST /api/partner-addresses/localities/batch` - 批量获取地址

#### Platform Setting模块
- **文件**: `xituan_backend/src/domains/platform-setting/routes/platform-setting.routes.ts`
- **当前权限**: `requireRole([ADMIN, SUPER_ADMIN])`（所有路由）
- **路由**:
  - `GET /api/platform-settings` - 获取所有设置
  - `GET /api/platform-settings/:category` - 获取指定分类设置
  - `PUT /api/platform-settings/:category` - 更新设置
  - `POST /api/platform-settings/reload` - 重新加载设置
  - `GET /api/platform-settings/cache-status` - 获取缓存状态

#### Store Address模块
- **文件**: `xituan_backend/src/domains/store/routes/store-address.routes.ts`
- **当前权限**: 
  - 公开路由：`GET /api/stores/*`
  - 管理路由：`requireAnyRole([ADMIN, SUPER_ADMIN])`
- **路由**:
  - `GET /api/stores` - 查看所有门店（公开）
  - `GET /api/stores/default` - 查看默认门店（公开）
  - `GET /api/stores/:id` - 查看门店详情（公开）
  - `POST /api/admin/stores` - 创建门店（管理员）
  - `PUT /api/admin/stores/:id` - 更新门店（管理员）
  - `DELETE /api/admin/stores/:id` - 删除门店（管理员）
  - `POST /api/admin/stores/:id/set-default` - 设置默认门店（管理员）

### 1.2 使用原子级权限的API（requirePermissions）

#### Product模块（部分）
- **文件**: `xituan_backend/src/domains/product/routes/admin-product.routes.ts`
- **当前权限**: 使用 `requireAllPermissions([epPermission.XXX])`
- **路由示例**:
  - `GET /api/admin/products` - `requireAllPermissions([PRODUCT_VIEW])`
  - `POST /api/admin/products` - `requireAllPermissions([PRODUCT_CREATE])`
  - `PUT /api/admin/products/:id` - `requireAllPermissions([PRODUCT_UPDATE])`
  - `DELETE /api/admin/products/:id` - `requireAllPermissions([PRODUCT_DELETE])`
  - 等等...

### 1.3 混合使用权限的API

#### User Management模块
- **文件**: `xituan_backend/src/domains/user/routes/admin-user-management.routes.ts`
- **当前权限**: 
  - 用户端路由：仅 `authenticate`
  - 管理员路由：`requireAnyRole([ADMIN, SUPER_ADMIN])`
- **路由**:
  - `GET /api/auth/user/cash-payment-permission` - 用户端（仅认证）
  - `GET /api/auth/user/profile` - 用户端（仅认证）
  - `GET /api/auth/user/payment-permissions` - 用户端（仅认证）
  - `GET /api/auth/user/bank-transfer-permission` - 用户端（仅认证）
  - `GET /api/admin/users` - 管理员端
  - `POST /api/admin/users/batch` - 管理员端
  - `GET /api/admin/users/:id` - 管理员端
  - `PUT /api/admin/users/:id/role` - 管理员端
  - `PUT /api/admin/users/:id/status` - 管理员端
  - 等等...

## 二、权限实施问题分析

### 2.1 问题总结

1. **权限检查不统一**
   - 大部分API使用角色权限（`requireAdmin`）
   - 少数API使用原子级权限（`requireAllPermissions`）
   - 没有混合使用两种权限的API

2. **权限粒度不够细**
   - 所有Revenue API都使用相同的权限（`requireAdmin`）
   - 无法区分查看、创建、更新、删除的权限
   - 无法实现字段级权限控制

3. **缺少新角色支持**
   - 当前只有 USER、ADMIN、SUPER_ADMIN 三种角色
   - 没有 ACCOUNTANT（财会）角色
   - 无法为财会人员分配特定权限

4. **权限配置硬编码**
   - 角色对应的权限列表写死在 `getRolePermissions()` 方法中
   - 无法动态配置权限
   - 添加新权限需要修改代码

5. **缺少字段级权限**
   - 后端没有字段级别的编辑权限检查
   - 前端虽然限制了编辑，但后端没有验证
   - 存在安全风险

## 三、需要变更的API列表

### 3.1 高优先级（Revenue模块）

#### Revenue API
- **文件**: `xituan_backend/src/domains/revenue/routes/revenue.routes.ts`
- **变更内容**:
  - 替换 `requireAdmin` 为 `requireAccess` 混合权限
  - 添加字段级权限检查
  - 区分查看、创建、更新、删除权限

**建议权限配置**:
```typescript
// 查看列表和详情 - 所有管理员和财会人员
GET /api/revenues
GET /api/revenues/:id
→ requireAccess({
    roles: [ADMIN, SUPER_ADMIN, ACCOUNTANT],
    permissions: [REVENUE_VIEW]
  })

// 创建 - 仅超级管理员和财会人员
POST /api/revenues
→ requireAccess({
    roles: [SUPER_ADMIN, ACCOUNTANT],
    permissions: [REVENUE_CREATE]
  })

// 更新 - 所有管理员和财会人员（但字段级权限不同）
PUT /api/revenues/:id
→ requireAccess({
    roles: [ADMIN, SUPER_ADMIN, ACCOUNTANT],
    permissions: [REVENUE_UPDATE]
  })
// 在Controller中检查字段级权限：
// - ADMIN: 只能修改 revenueDate 和 notes
// - SUPER_ADMIN / ACCOUNTANT with REVENUE_UPDATE_FULL: 可以修改所有字段

// 删除 - 仅超级管理员和财会人员
DELETE /api/revenues/:id (需要添加)
→ requireAccess({
    roles: [SUPER_ADMIN, ACCOUNTANT],
    permissions: [REVENUE_DELETE]
  })
```

### 3.2 中优先级（其他财务相关模块）

#### Expense API
- **文件**: `xituan_backend/src/domains/expense/routes/expense.routes.ts`
- **建议**: 可以保持 `requireAdmin`，或迁移到混合权限模式

#### Financial API
- **文件**: `xituan_backend/src/domains/financial/routes/tax-return-report.routes.ts`
- **建议**: 可以保持 `requireAdmin`，或迁移到混合权限模式

#### Equipment Depreciation API
- **文件**: `xituan_backend/src/domains/equipment-depreciation/routes/equipment-depreciation.routes.ts`
- **建议**: 可以保持 `requireAdmin`，或迁移到混合权限模式

### 3.3 低优先级（其他模块）

#### Supplier API
- **文件**: `xituan_backend/src/domains/supplier/routes/supplier.routes.ts`
- **建议**: 保持 `requireAdmin`，暂不迁移

#### Equipment API
- **文件**: `xituan_backend/src/domains/equipment/routes/equipment.routes.ts`
- **建议**: 保持 `requireAdmin`，暂不迁移

#### Partner API
- **文件**: `xituan_backend/src/domains/partner/routes/partner.routes.ts`
- **建议**: 保持 `requireAnyRole([ADMIN, SUPER_ADMIN])`，暂不迁移

## 四、实施建议

### 4.1 分阶段实施

**阶段一：Revenue模块（必须）**
1. 添加收入相关权限枚举
2. 添加ACCOUNTANT角色
3. 实现混合权限中间件
4. 更新Revenue API权限配置
5. 实现字段级权限检查
6. 更新前端权限控制

**阶段二：其他财务模块（可选）**
- Expense、Financial、Equipment Depreciation 模块可以逐步迁移

**阶段三：其他模块（可选）**
- 其他模块保持现状，或根据需求逐步迁移

### 4.2 向后兼容策略

1. **保留旧中间件**：`requireAdmin`、`requireRole` 等继续可用
2. **渐进式迁移**：新API使用新权限系统，旧API逐步迁移
3. **双重检查**：迁移时可以同时使用新旧两种方式，确保安全

### 4.3 测试策略

1. **单元测试**：测试新的权限中间件
2. **集成测试**：测试不同角色用户访问API
3. **回归测试**：确保现有API功能不受影响

## 五、总结

当前系统主要使用角色权限（`requireAdmin`），缺少：
1. 原子级权限的广泛应用
2. 混合权限模式
3. 字段级权限控制
4. 新角色（ACCOUNTANT）支持

**建议优先实施Revenue模块的权限升级**，因为：
1. 业务需求明确（编辑限制、创建删除权限）
2. 影响范围可控
3. 可以作为其他模块的参考实现

