# 权限管理方案设计文档

## 一、需求分析

### 1.1 业务需求
- **编辑限制**：收入编辑模式下只能修改收入日期和备注，其他字段不可编辑
- **权限分级**：
  - 普通管理员：按编辑限制逻辑编辑
  - 超级管理员：按编辑限制逻辑编辑 + 可以创建、删除
  - 财会用户分组（未来）：按原子级权限控制编辑、创建、删除功能

### 1.2 权限管理需求
- **混合权限模式**：支持原子级权限（permission）和用户分组级别（role）混合使用
- **灵活配置**：可以同时使用或单独使用两种权限模式
- **示例场景**：
  - 所有CMS API：要求 admin、super_admin、accountant 分组用户可以访问
  - 收入创建/删除：只有 super_admin、accountant 可以，或根据原子级权限设置

## 二、当前权限系统分析

### 2.1 现有权限体系

#### 2.1.1 用户角色（Role）
```typescript
enum epUserRole {
  USER = 'user',           // 普通用户
  ADMIN = 'admin',          // 管理员
  SUPER_ADMIN = 'super_admin' // 超级管理员
}
```

#### 2.1.2 原子级权限（Permission）
```typescript
enum epPermission {
  PRODUCT_VIEW = 'product:view',
  PRODUCT_CREATE = 'product:create',
  // ... 其他权限
}
```

#### 2.1.3 权限检查机制
- **AuthService.hasPermission()**：
  - 超级管理员自动拥有所有权限
  - 普通用户根据角色获取权限列表（硬编码在 `getRolePermissions()` 方法中）

#### 2.1.4 中间件支持
- `requireRole()` / `requireAnyRole()` - 基于角色
- `requirePermission()` / `requireAllPermissions()` / `requireAnyPermission()` - 基于权限
- `requireAdmin()` / `requireSuperAdmin()` - 快捷方法

### 2.2 当前API权限实施情况

#### 2.2.1 使用角色权限的API（大部分）
```typescript
// 示例：revenue.routes.ts
router.use(authMiddleware.authenticate);
router.use(authMiddleware.requireAdmin); // 仅检查是否为管理员

// 示例：platform-setting.routes.ts
router.use(authMiddleware.requireRole([epUserRole.ADMIN, epUserRole.SUPER_ADMIN]));
```

#### 2.2.2 使用原子级权限的API（少数）
```typescript
// 示例：admin-product.routes.ts
router.get('/', 
  requirePermissions([epPermission.PRODUCT_VIEW]), 
  productController.getProducts
);
```

#### 2.2.3 问题分析
1. **权限检查不统一**：有些用角色，有些用权限，没有混合模式
2. **角色权限硬编码**：权限列表写死在 `getRolePermissions()` 方法中，不够灵活
3. **缺少混合验证**：无法同时检查"角色 OR 权限"的组合
4. **缺少字段级权限**：后端没有字段级别的编辑权限控制

## 三、权限管理方案设计

### 3.1 核心设计原则

1. **向后兼容**：保持现有API和中间件可用
2. **灵活配置**：支持角色、权限、混合三种模式
3. **统一接口**：提供统一的权限检查接口
4. **可扩展性**：支持未来新增角色和权限

### 3.2 权限验证逻辑

#### 3.2.1 验证策略
```
验证通过条件 = (
  (角色匹配 OR 权限匹配) AND 
  (如果指定了角色，则必须匹配角色) AND
  (如果指定了权限，则必须匹配权限)
)
```

具体规则：
- **仅角色模式**：`roles: [ADMIN, SUPER_ADMIN]` → 检查用户角色是否在列表中
- **仅权限模式**：`permissions: [REVENUE_CREATE]` → 检查用户是否有该权限
- **混合模式（OR）**：`roles: [ADMIN]` OR `permissions: [REVENUE_CREATE]` → 满足任一即可
- **混合模式（AND）**：`roles: [ADMIN]` AND `permissions: [REVENUE_CREATE]` → 必须同时满足

#### 3.2.2 超级管理员特权
- 超级管理员自动通过所有权限检查（除非明确排除）

### 3.3 新增权限枚举

需要在 `epPermission` 中添加收入相关权限：

```typescript
// 收入权限
REVENUE_VIEW = 'revenue:view',
REVENUE_CREATE = 'revenue:create',
REVENUE_UPDATE = 'revenue:update',
REVENUE_UPDATE_FULL = 'revenue:update:full', // 完整编辑权限
REVENUE_DELETE = 'revenue:delete',
```

### 3.4 新增用户角色

需要在 `epUserRole` 中添加财会角色：

```typescript
ACCOUNTANT = 'accountant', // 财会用户
```

### 3.5 权限配置接口设计

```typescript
interface iAccessControl {
  // 允许的角色列表（OR关系）
  roles?: epUserRole[];
  
  // 允许的权限列表（OR关系，如果指定了多个权限）
  permissions?: epPermission[];
  
  // 验证模式：'or' | 'and'
  // 'or': 角色或权限满足任一即可（默认）
  // 'and': 必须同时满足角色和权限
  mode?: 'or' | 'and';
  
  // 是否排除超级管理员（默认false，超级管理员总是通过）
  excludeSuperAdmin?: boolean;
}
```

### 3.6 新增中间件

```typescript
// 混合权限检查中间件
requireAccess = (accessControl: iAccessControl) => {
  return (req: iAuthenticatedRequest, res: Response, next: NextFunction): void => {
    // 1. 认证检查
    if (!req.user) {
      res.status(401).json({ ... });
      return;
    }
    
    // 2. 超级管理员检查（除非明确排除）
    if (!accessControl.excludeSuperAdmin && req.user.isSuperAdmin()) {
      next();
      return;
    }
    
    // 3. 根据mode进行验证
    const { roles, permissions, mode = 'or' } = accessControl;
    
    if (mode === 'or') {
      // OR模式：角色或权限满足任一即可
      const hasRole = roles && roles.some(role => this.authService.hasRole(req.user!, role));
      const hasPermission = permissions && permissions.some(perm => 
        this.authService.hasPermission(req.user!, perm)
      );
      
      if (!hasRole && !hasPermission) {
        res.status(403).json({ ... });
        return;
      }
    } else {
      // AND模式：必须同时满足
      const hasRole = !roles || roles.some(role => this.authService.hasRole(req.user!, role));
      const hasPermission = !permissions || permissions.some(perm => 
        this.authService.hasPermission(req.user!, perm)
      );
      
      if (!hasRole || !hasPermission) {
        res.status(403).json({ ... });
        return;
      }
    }
    
    next();
  };
};
```

## 四、实施计划

### 4.1 阶段一：扩展权限体系

#### 4.1.1 更新权限枚举
- [ ] 在 `epPermission` 中添加收入相关权限
- [ ] 在 `epUserRole` 中添加 `ACCOUNTANT` 角色

#### 4.1.2 更新权限分配逻辑
- [ ] 修改 `AuthService.getRolePermissions()` 方法，支持动态配置
- [ ] 为各角色分配收入相关权限：
  - ADMIN: `REVENUE_VIEW`, `REVENUE_UPDATE`
  - SUPER_ADMIN: 所有权限
  - ACCOUNTANT: `REVENUE_VIEW`, `REVENUE_CREATE`, `REVENUE_UPDATE`, `REVENUE_UPDATE_FULL`, `REVENUE_DELETE`

### 4.2 阶段二：实现混合权限中间件

- [ ] 在 `AuthMiddleware` 中添加 `requireAccess()` 方法
- [ ] 更新 `iAccessControl` 接口定义

### 4.3 阶段三：更新Revenue API权限

#### 4.3.1 路由权限配置
```typescript
// revenue.routes.ts
router.get('/revenues', 
  authMiddleware.requireAccess({
    roles: [epUserRole.ADMIN, epUserRole.SUPER_ADMIN, epUserRole.ACCOUNTANT],
    permissions: [epPermission.REVENUE_VIEW]
  }),
  revenueController.getRevenues
);

router.post('/revenues', 
  authMiddleware.requireAccess({
    roles: [epUserRole.SUPER_ADMIN, epUserRole.ACCOUNTANT],
    permissions: [epPermission.REVENUE_CREATE]
  }),
  revenueController.createRevenue
);

router.put('/revenues/:id', 
  authMiddleware.requireAccess({
    roles: [epUserRole.ADMIN, epUserRole.SUPER_ADMIN, epUserRole.ACCOUNTANT],
    permissions: [epPermission.REVENUE_UPDATE]
  }),
  revenueController.updateRevenue
);

router.delete('/revenues/:id', 
  authMiddleware.requireAccess({
    roles: [epUserRole.SUPER_ADMIN, epUserRole.ACCOUNTANT],
    permissions: [epPermission.REVENUE_DELETE]
  }),
  revenueController.deleteRevenue
);
```

#### 4.3.2 字段级权限控制
- [ ] 在 `RevenueController.updateRevenue()` 中检查字段编辑权限
- [ ] 普通管理员只能修改 `revenueDate` 和 `notes`
- [ ] 拥有 `REVENUE_UPDATE_FULL` 权限的用户可以修改所有字段

### 4.4 阶段四：前端权限适配

- [ ] 前端根据用户权限动态显示/隐藏创建、删除按钮
- [ ] 前端根据用户权限动态禁用字段编辑
- [ ] 添加权限检查工具函数

### 4.5 阶段五：其他API迁移（可选）

- [ ] 逐步将其他API迁移到新的权限系统
- [ ] 保持向后兼容，旧的中间件继续可用

## 五、代码变更清单

### 5.1 后端变更

#### 5.1.1 类型定义
- `xituan_backend/submodules/xituan_codebase/typing_api/permission.type.ts`
  - 添加 `ACCOUNTANT` 角色
  - 添加收入相关权限枚举
  - 更新 `iAccessControl` 接口

#### 5.1.2 权限服务
- `xituan_backend/src/domains/user/services/auth.service.ts`
  - 更新 `getRolePermissions()` 方法，添加ACCOUNTANT角色权限

#### 5.1.3 中间件
- `xituan_backend/src/shared/middleware/auth.middleware.ts`
  - 添加 `requireAccess()` 方法

#### 5.1.4 Revenue模块
- `xituan_backend/src/domains/revenue/routes/revenue.routes.ts`
  - 更新路由权限配置
- `xituan_backend/src/domains/revenue/controllers/revenue.controller.ts`
  - 添加字段级权限检查逻辑

### 5.2 前端变更

#### 5.2.1 Revenue组件
- `xituan_cms/src/components/revenues/RevenueEditModal.tsx`
  - 根据用户权限动态控制字段编辑
  - 根据用户权限显示/隐藏创建按钮

#### 5.2.2 权限工具
- 创建权限检查工具函数（可在context或util中）

## 六、数据库变更

### 6.1 用户角色枚举更新
- 需要在数据库中添加 `accountant` 角色支持
- 可能需要迁移脚本更新现有用户的角色

### 6.2 权限表（如果使用数据库存储）
- 如果未来需要将权限存储在数据库中，需要创建权限表

## 七、测试计划

### 7.1 单元测试
- [ ] 测试 `requireAccess()` 中间件的各种场景
- [ ] 测试字段级权限检查逻辑

### 7.2 集成测试
- [ ] 测试不同角色用户访问Revenue API
- [ ] 测试权限组合场景

### 7.3 前端测试
- [ ] 测试不同权限下UI的显示/隐藏
- [ ] 测试字段编辑限制

## 八、风险评估

### 8.1 兼容性风险
- **风险**：现有API可能受影响
- **缓解**：保持旧中间件可用，逐步迁移

### 8.2 性能风险
- **风险**：权限检查可能增加响应时间
- **缓解**：权限检查逻辑简单，影响可忽略

### 8.3 安全性风险
- **风险**：权限配置错误可能导致越权访问
- **缓解**：充分测试，代码审查

## 九、后续优化

1. **权限缓存**：缓存用户权限信息，减少重复查询
2. **权限管理界面**：提供UI界面管理用户权限
3. **权限审计**：记录权限变更和访问日志
4. **动态权限配置**：支持从数据库读取权限配置

