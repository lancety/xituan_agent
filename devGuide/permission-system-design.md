# 权限系统设计

## 一、设计目标

创建统一的权限管理系统，支持：
1. **前端UI控制**：根据用户角色/权限控制按钮、菜单、页面的显示
2. **后端API控制**：根据配置自动生成中间件，控制API访问权限
3. **统一管理**：所有权限配置集中在一个地方，易于维护

## 二、核心设计

### 2.1 权限验证模式

系统支持两种权限验证模式：

- **角色模式（Role-based）**：基于用户角色（如 admin、super_admin）
- **权限模式（Permission-based）**：基于原子级权限（如 `revenue:create`）
- **混合模式**：同时支持角色和权限，可配置 OR/AND 关系

### 2.2 权限配置接口

```typescript
// 权限验证模式
export enum epPermissionMode {
  OR = 'or',    // 角色或权限满足任一即可
  AND = 'and'  // 必须同时满足角色和权限
}

// 功能权限配置
export interface iFeaturePermission {
  // 允许的角色列表（OR关系）
  roles?: epUserRole[];
  
  // 允许的权限列表（OR关系）
  permissions?: epPermission[];
  
  // 验证模式：'or' | 'and'（默认 'or'）
  mode?: epPermissionMode;
  
  // 是否排除超级管理员（默认false，超级管理员总是通过）
  excludeSuperAdmin?: boolean;
}
```

### 2.3 权限验证逻辑

**验证规则**：
- **仅角色模式**：`roles: [ADMIN, SUPER_ADMIN]` → 检查用户角色是否在列表中
- **仅权限模式**：`permissions: [FEATURE_CREATE]` → 检查用户是否有该权限
- **混合模式（OR）**：`roles: [ADMIN]` OR `permissions: [FEATURE_CREATE]` → 满足任一即可
- **混合模式（AND）**：`roles: [ADMIN]` AND `permissions: [FEATURE_CREATE]` → 必须同时满足

**超级管理员特权**：
- 超级管理员自动通过所有权限检查（除非 `excludeSuperAdmin: true`）

### 2.4 权限配置结构

```typescript
// UI功能标识（用于前端控制显示）
export enum epFeatureKey {
  FEATURE_LIST = 'feature:list',
  FEATURE_CREATE = 'feature:create',
  FEATURE_EDIT = 'feature:edit',
  FEATURE_DELETE = 'feature:delete',
  // ... 其他功能
}

// API端点标识（用于后端路由配置）
export enum epApiEndpoint {
  FEATURE_LIST = 'GET /api/admin/features',
  FEATURE_DETAIL = 'GET /api/admin/features/:id',
  FEATURE_CREATE = 'POST /api/admin/features',
  FEATURE_UPDATE = 'PUT /api/admin/features/:id',
  FEATURE_DELETE = 'DELETE /api/admin/features/:id',
  // ... 其他API
}

// 权限配置映射
export interface iPermissionConfig {
  // UI功能权限配置
  features: Record<epFeatureKey, iFeaturePermission>;
  
  // API端点权限配置
  endpoints: Record<epApiEndpoint, iFeaturePermission>;
}

// 共享权限配置对象
export const permissionConfig: iPermissionConfig = {
  features: {
    [epFeatureKey.FEATURE_LIST]: {
      roles: [epUserRole.ADMIN, epUserRole.SUPER_ADMIN],
      mode: epPermissionMode.OR
    },
    [epFeatureKey.FEATURE_CREATE]: {
      roles: [epUserRole.SUPER_ADMIN],
      permissions: [epPermission.FEATURE_CREATE],
      mode: epPermissionMode.OR
    },
    // ... 其他功能配置
  },
  endpoints: {
    [epApiEndpoint.FEATURE_LIST]: {
      roles: [epUserRole.ADMIN, epUserRole.SUPER_ADMIN],
      mode: epPermissionMode.OR
    },
    [epApiEndpoint.FEATURE_CREATE]: {
      roles: [epUserRole.SUPER_ADMIN],
      permissions: [epPermission.FEATURE_CREATE],
      mode: epPermissionMode.OR
    },
    // ... 其他API配置
  }
};
```

## 三、前端使用

### 3.1 权限检查工具

```typescript
import { epFeatureKey, permissionConfig, iFeaturePermission } from 'path/to/permission-config.type';
import { epUserRole, epPermission } from 'path/to/permission.type';

export const permissionUtil = {
  /**
   * 检查用户是否有权限访问某个功能
   */
  hasFeatureAccess(
    featureKey: epFeatureKey,
    user: iUserInfo | null
  ): boolean {
    if (!user) return false;
    
    const config = permissionConfig.features[featureKey];
    if (!config) return false;
    
    return this.checkPermission(config, user);
  },
  
  /**
   * 检查权限配置
   */
  checkPermission(
    config: iFeaturePermission,
    user: iUserInfo
  ): boolean {
    // 超级管理员总是通过（除非明确排除）
    if (!config.excludeSuperAdmin && user.role === epUserRole.SUPER_ADMIN) {
      return true;
    }
    
    const { roles, permissions, mode = 'or' } = config;
    
    if (mode === 'or') {
      // OR模式：角色或权限满足任一即可
      const hasRole = roles && roles.length > 0 
        ? roles.includes(user.role)
        : false;
      
      const hasPermission = permissions && permissions.length > 0
        ? this.checkUserPermissions(user, permissions)
        : false;
      
      return hasRole || hasPermission;
    } else {
      // AND模式：必须同时满足
      const hasRole = !roles || roles.length === 0 || roles.includes(user.role);
      const hasPermission = !permissions || permissions.length === 0
        || this.checkUserPermissions(user, permissions);
      
      return hasRole && hasPermission;
    }
  },
  
  /**
   * 检查用户是否有指定权限
   */
  checkUserPermissions(
    user: iUserInfo,
    requiredPermissions: epPermission[]
  ): boolean {
    // 超级管理员拥有所有权限
    if (user.role === epUserRole.SUPER_ADMIN) {
      return true;
    }
    
    // 从用户权限列表中检查（需要从后端获取或从用户信息中获取）
    const userPermissions = user.permissions || [];
    return requiredPermissions.some(perm => userPermissions.includes(perm));
  }
};
```

### 3.2 在组件中使用

```typescript
import { permissionUtil } from '../../utils/permission.util';
import { epFeatureKey } from 'path/to/permission-config.type';
import { useAuth } from '../../contexts/auth.context';

const FeatureListPage: React.FC = () => {
  const { user } = useAuth();
  
  const canCreate = permissionUtil.hasFeatureAccess(epFeatureKey.FEATURE_CREATE, user);
  const canDelete = permissionUtil.hasFeatureAccess(epFeatureKey.FEATURE_DELETE, user);
  
  return (
    <div>
      {canCreate && (
        <Button onClick={handleCreate}>创建</Button>
      )}
      {canDelete && (
        <Button onClick={handleDelete}>删除</Button>
      )}
    </div>
  );
};
```

## 四、后端使用

### 4.1 权限中间件生成器

```typescript
import { 
  epApiEndpoint, 
  permissionConfig, 
  iFeaturePermission
} from 'path/to/permission-config.type';
import { AuthService } from 'path/to/auth.service';

export class PermissionMiddleware {
  private authService: AuthService;

  constructor(authService: AuthService) {
    this.authService = authService;
  }

  /**
   * 根据API端点配置生成权限检查中间件
   */
  requireEndpoint = (endpoint: epApiEndpoint) => {
    return (req: iAuthenticatedRequest, res: Response, next: NextFunction): void => {
      // 认证检查
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: '用户未认证',
          code: 'USER_NOT_AUTHENTICATED'
        });
        return;
      }

      // 获取端点权限配置
      const config = permissionConfig.endpoints[endpoint];
      if (!config) {
        res.status(403).json({
          success: false,
          message: '访问被拒绝',
          code: 'ACCESS_DENIED'
        });
        return;
      }

      // 权限检查
      if (!this.checkPermission(config, req.user)) {
        res.status(403).json({
          success: false,
          message: '权限不足',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
        return;
      }

      next();
    };
  };

  /**
   * 检查权限配置
   */
  private checkPermission(
    config: iFeaturePermission,
    user: iUser
  ): boolean {
    // 超级管理员总是通过（除非明确排除）
    if (!config.excludeSuperAdmin && user.role === epUserRole.SUPER_ADMIN) {
      return true;
    }

    const { roles, permissions, mode = 'or' } = config;

    if (mode === 'or') {
      // OR模式：角色或权限满足任一即可
      const hasRole = roles && roles.length > 0 
        ? roles.includes(user.role)
        : false;
      
      const hasPermission = permissions && permissions.length > 0
        ? this.authService.hasAnyPermission(user, permissions)
        : false;
      
      return hasRole || hasPermission;
    } else {
      // AND模式：必须同时满足
      const hasRole = !roles || roles.length === 0 || roles.includes(user.role);
      const hasPermission = !permissions || permissions.length === 0
        || this.authService.hasAllPermissions(user, permissions);
      
      return hasRole && hasPermission;
    }
  }
}
```

### 4.2 在路由中使用

```typescript
import { PermissionMiddleware } from 'path/to/permission.middleware';
import { epApiEndpoint } from 'path/to/permission-config.type';

const permissionMiddleware = new PermissionMiddleware(authService);

// 使用配置化的权限中间件
router.get(
  '/features',
  permissionMiddleware.requireEndpoint(epApiEndpoint.FEATURE_LIST),
  controller.getFeatures
);

router.post(
  '/features',
  permissionMiddleware.requireEndpoint(epApiEndpoint.FEATURE_CREATE),
  controller.createFeature
);
```

## 五、实施步骤

1. **创建共享配置文件**
   - 在 `xituan_codebase/typing_api/permission-config.type.ts` 中定义类型和配置
   - 定义 `epFeatureKey` 和 `epApiEndpoint` 枚举
   - 创建 `permissionConfig` 配置对象

2. **前端实施**
   - 创建 `permissionUtil` 工具函数
   - 在组件中使用权限检查控制UI显示
   - 更新菜单和路由的权限控制

3. **后端实施**
   - 创建 `PermissionMiddleware` 类
   - 在路由中使用配置化的权限中间件
   - 更新现有API的权限检查

## 六、优势

1. **统一管理**：所有权限配置集中在一个地方，易于维护
2. **前后端一致**：使用相同的配置，确保前后端权限逻辑一致
3. **灵活配置**：支持角色、权限、混合三种模式
4. **类型安全**：使用 TypeScript 枚举和接口，编译时检查
5. **易于扩展**：新增功能只需添加配置，无需修改代码

## 七、注意事项

1. **向后兼容**：保持现有API和中间件可用，逐步迁移
2. **性能考虑**：权限检查应快速，避免影响API响应时间
3. **安全性**：后端权限检查是必须的，前端检查仅用于UI控制
4. **配置同步**：确保前后端使用相同的配置版本

