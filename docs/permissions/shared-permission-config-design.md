# 共享权限配置系统设计

## 一、设计目标

创建一个共享的权限配置系统，可以同时用于：
1. **前端UI控制**：根据用户角色/权限控制按钮、菜单、页面的显示
2. **后端API控制**：根据配置自动生成中间件，控制API访问权限
3. **统一管理**：所有权限配置集中在一个地方，易于维护

## 二、核心设计

### 2.1 权限配置结构

在 `xituan_codebase/typing_api/permission-config.type.ts` 中定义：

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
  
  // 验证模式：'or' | 'and'
  mode?: epPermissionMode;
  
  // 是否排除超级管理员（默认false，超级管理员总是通过）
  excludeSuperAdmin?: boolean;
}

// UI功能标识（用于前端控制显示）
export enum epFeatureKey {
  // Revenue相关
  REVENUE_LIST = 'revenue:list',
  REVENUE_CREATE = 'revenue:create',
  REVENUE_EDIT = 'revenue:edit',
  REVENUE_DELETE = 'revenue:delete',
  
  // Tax Report相关
  TAX_REPORT_VIEW = 'tax_report:view',
  TAX_REPORT_GENERATE = 'tax_report:generate',
  TAX_REPORT_COMMIT = 'tax_report:commit',
  
  // 其他功能...
}

// API端点标识（用于后端路由配置）
export enum epApiEndpoint {
  // Revenue API
  REVENUE_LIST = 'GET /api/admin/revenues',
  REVENUE_DETAIL = 'GET /api/admin/revenues/:id',
  REVENUE_CREATE = 'POST /api/admin/revenues',
  REVENUE_UPDATE = 'PUT /api/admin/revenues/:id',
  REVENUE_DELETE = 'DELETE /api/admin/revenues/:id',
  
  // Tax Report API
  TAX_REPORT_GENERATE = 'POST /api/admin/tax-return-report/generate',
  TAX_REPORT_GET = 'GET /api/admin/tax-return-report/:financialYear',
  TAX_REPORT_COMMIT = 'POST /api/admin/tax-return-report/:id/commit',
  
  // 其他API...
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
    // Revenue功能权限
    [epFeatureKey.REVENUE_LIST]: {
      roles: [epUserRole.ADMIN, epUserRole.SUPER_ADMIN],
      mode: epPermissionMode.OR
    },
    [epFeatureKey.REVENUE_CREATE]: {
      roles: [epUserRole.ADMIN, epUserRole.SUPER_ADMIN],
      mode: epPermissionMode.OR
    },
    [epFeatureKey.REVENUE_EDIT]: {
      roles: [epUserRole.ADMIN, epUserRole.SUPER_ADMIN],
      mode: epPermissionMode.OR
    },
    [epFeatureKey.REVENUE_DELETE]: {
      roles: [epUserRole.SUPER_ADMIN],
      mode: epPermissionMode.OR
    },
    
    // Tax Report功能权限
    [epFeatureKey.TAX_REPORT_VIEW]: {
      roles: [epUserRole.SUPER_ADMIN],
      mode: epPermissionMode.OR
    },
    [epFeatureKey.TAX_REPORT_GENERATE]: {
      roles: [epUserRole.SUPER_ADMIN],
      mode: epPermissionMode.OR
    },
    [epFeatureKey.TAX_REPORT_COMMIT]: {
      roles: [epUserRole.SUPER_ADMIN],
      mode: epPermissionMode.OR
    },
  },
  
  endpoints: {
    // Revenue API权限
    [epApiEndpoint.REVENUE_LIST]: {
      roles: [epUserRole.ADMIN, epUserRole.SUPER_ADMIN],
      mode: epPermissionMode.OR
    },
    [epApiEndpoint.REVENUE_DETAIL]: {
      roles: [epUserRole.ADMIN, epUserRole.SUPER_ADMIN],
      mode: epPermissionMode.OR
    },
    [epApiEndpoint.REVENUE_CREATE]: {
      roles: [epUserRole.ADMIN, epUserRole.SUPER_ADMIN],
      mode: epPermissionMode.OR
    },
    [epApiEndpoint.REVENUE_UPDATE]: {
      roles: [epUserRole.ADMIN, epUserRole.SUPER_ADMIN],
      mode: epPermissionMode.OR
    },
    [epApiEndpoint.REVENUE_DELETE]: {
      roles: [epUserRole.SUPER_ADMIN],
      mode: epPermissionMode.OR
    },
    
    // Tax Report API权限
    [epApiEndpoint.TAX_REPORT_GENERATE]: {
      roles: [epUserRole.SUPER_ADMIN],
      mode: epPermissionMode.OR
    },
    [epApiEndpoint.TAX_REPORT_GET]: {
      roles: [epUserRole.SUPER_ADMIN],
      mode: epPermissionMode.OR
    },
    [epApiEndpoint.TAX_REPORT_COMMIT]: {
      roles: [epUserRole.SUPER_ADMIN],
      mode: epPermissionMode.OR
    },
  }
};
```

## 三、前端使用方案

### 3.1 创建权限检查工具

在 `xituan_cms/src/utils/permission.util.ts` 中：

```typescript
import { epFeatureKey, permissionConfig, iFeaturePermission } from '../../submodules/xituan_codebase/typing_api/permission-config.type';
import { epUserRole, epPermission } from '../../submodules/xituan_codebase/typing_api/permission.type';
import { iUserInfo } from '../lib/api/auth.api';

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
      
      // 如果有权限列表，需要检查用户是否有对应权限
      // 这里简化处理，假设权限检查通过角色判断
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
   * 检查用户是否有指定权限（简化版，实际应该从后端获取用户权限列表）
   */
  checkUserPermissions(
    user: iUserInfo,
    requiredPermissions: epPermission[]
  ): boolean {
    // 超级管理员拥有所有权限
    if (user.role === epUserRole.SUPER_ADMIN) {
      return true;
    }
    
    // 这里可以根据实际需求实现权限检查逻辑
    // 如果前端需要精确的权限检查，可以从后端API获取用户权限列表
    // 目前简化处理，通过角色判断
    return false;
  }
};
```

### 3.2 在组件中使用

```typescript
import { permissionUtil } from '../../utils/permission.util';
import { epFeatureKey } from '../../../submodules/xituan_codebase/typing_api/permission-config.type';
import { useAuth } from '../../contexts/auth.context';

const RevenueListPage: React.FC = () => {
  const { user } = useAuth();
  
  // 检查是否可以删除
  const canDelete = permissionUtil.hasFeatureAccess(
    epFeatureKey.REVENUE_DELETE,
    user
  );
  
  return (
    <>
      {/* 删除按钮 - 只对超级管理员显示 */}
      {canDelete && (
        <Popconfirm
          title="确认删除"
          onConfirm={() => handleDelete(record.id)}
        >
          <Button danger icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      )}
    </>
  );
};
```

### 3.3 菜单权限控制

```typescript
// 在菜单配置中使用
const menuItems = [
  {
    key: 'revenue',
    label: '收入管理',
    // 检查是否有查看权限
    visible: permissionUtil.hasFeatureAccess(
      epFeatureKey.REVENUE_LIST,
      currentUser
    )
  },
  {
    key: 'tax-report',
    label: '报税报表',
    // 只对超级管理员显示
    visible: permissionUtil.hasFeatureAccess(
      epFeatureKey.TAX_REPORT_VIEW,
      currentUser
    )
  }
].filter(item => item.visible);
```

## 四、后端使用方案

### 4.1 创建权限中间件生成器

在 `xituan_backend/src/shared/middleware/permission.middleware.ts` 中：

```typescript
import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../../domains/user/services/auth.service';
import { 
  epApiEndpoint, 
  permissionConfig, 
  iFeaturePermission,
  epPermissionMode
} from '../../../submodules/xituan_codebase/typing_api/permission-config.type';
import { epUserRole, epPermission } from '../../../submodules/xituan_codebase/typing_api/permission.type';
import { iAuthenticatedRequest } from './auth.middleware';

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
      // 先进行认证
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
        // 如果没有配置，默认拒绝访问
        res.status(403).json({
          success: false,
          message: '访问被拒绝',
          code: 'ACCESS_DENIED'
        });
        return;
      }

      // 检查权限
      if (!this.checkPermission(config, req.user)) {
        res.status(403).json({
          success: false,
          message: '权限不足',
          code: 'INSUFFICIENT_PERMISSION'
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
    user: any
  ): boolean {
    // 超级管理员总是通过（除非明确排除）
    if (!config.excludeSuperAdmin && user.isSuperAdmin()) {
      return true;
    }

    const { roles, permissions, mode = epPermissionMode.OR } = config;

    if (mode === epPermissionMode.OR) {
      // OR模式：角色或权限满足任一即可
      const hasRole = roles && roles.length > 0
        ? roles.some(role => this.authService.hasRole(user, role))
        : false;

      const hasPermission = permissions && permissions.length > 0
        ? permissions.some(perm => this.authService.hasPermission(user, perm))
        : false;

      return hasRole || hasPermission;
    } else {
      // AND模式：必须同时满足
      const hasRole = !roles || roles.length === 0
        || roles.some(role => this.authService.hasRole(user, role));

      const hasPermission = !permissions || permissions.length === 0
        || permissions.every(perm => this.authService.hasPermission(user, perm));

      return hasRole && hasPermission;
    }
  }
}
```

### 4.2 在路由中使用

```typescript
import { PermissionMiddleware } from '../../../shared/middleware/permission.middleware';
import { epApiEndpoint } from '../../../../submodules/xituan_codebase/typing_api/permission-config.type';

export function createRevenueRoutes(
  authMiddleware: AuthMiddleware,
  permissionMiddleware: PermissionMiddleware
): Router {
  const router = Router();
  const revenueController = new RevenueController();

  // 所有路由都需要认证
  router.use(authMiddleware.authenticate);

  // 使用配置化的权限检查
  router.get('/revenues', 
    permissionMiddleware.requireEndpoint(epApiEndpoint.REVENUE_LIST),
    revenueController.getRevenues
  );

  router.get('/revenues/:id', 
    permissionMiddleware.requireEndpoint(epApiEndpoint.REVENUE_DETAIL),
    revenueController.getRevenueById
  );

  router.post('/revenues', 
    permissionMiddleware.requireEndpoint(epApiEndpoint.REVENUE_CREATE),
    revenueController.createRevenue
  );

  router.put('/revenues/:id', 
    permissionMiddleware.requireEndpoint(epApiEndpoint.REVENUE_UPDATE),
    revenueController.updateRevenue
  );

  router.delete('/revenues/:id', 
    permissionMiddleware.requireEndpoint(epApiEndpoint.REVENUE_DELETE),
    revenueController.deleteRevenue
  );

  return router;
}
```

## 五、实施步骤

### 5.1 创建共享配置文件

1. 在 `xituan_codebase/typing_api/permission-config.type.ts` 中定义配置
2. 导出配置对象和类型

### 5.2 前端实施

1. 创建 `permission.util.ts` 工具函数
2. 在组件中使用权限检查
3. 更新菜单配置使用权限检查

### 5.3 后端实施

1. 创建 `PermissionMiddleware` 类
2. 更新路由使用配置化的权限检查
3. 逐步迁移现有路由

## 六、优势

1. **统一管理**：所有权限配置在一个地方，易于维护
2. **类型安全**：TypeScript类型检查，避免配置错误
3. **前后端一致**：使用相同的配置，确保前后端权限一致
4. **易于扩展**：添加新功能只需在配置中添加条目
5. **灵活配置**：支持角色、权限、混合模式

## 七、注意事项

1. **权限同步**：前端权限检查是UI层面的，后端API必须也要有对应的权限检查
2. **性能考虑**：权限检查应该快速，避免影响性能
3. **缓存策略**：可以考虑缓存用户权限信息
4. **向后兼容**：保留现有的权限检查方式，逐步迁移

