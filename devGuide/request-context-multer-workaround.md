# Request Context 与 Multer 中间件的特殊解决方法

## 问题描述

在使用 `multer` 中间件处理文件上传时，`AsyncLocalStorage` 的 Request Context 会在 multer 的异步回调中丢失，导致后续代码无法获取 `merchantId` 等上下文信息。

### 问题根源

1. **AsyncLocalStorage 的工作原理**：通过 `async_hooks` 跟踪异步操作链
2. **Multer 的异步特性**：使用事件监听器处理文件上传，这些回调在另一个事件循环中执行
3. **上下文丢失**：AsyncLocalStorage 的上下文无法跨越某些异步边界（如事件监听器）

### Multer 处理流程详解

**Multer 的工作流程**：
```
1. 请求到达 → requestContextMiddleware 设置上下文 ✅
2. Multer 中间件开始处理文件上传
   ├─ 解析 multipart/form-data
   ├─ 使用事件监听器处理文件流（在另一个事件循环中）
   └─ 文件处理完成后调用 next() ⚠️ 此时上下文可能已丢失
3. 控制器方法执行
   ├─ 需要访问 Request Context（如 getMerchantId()）
   └─ ❌ 上下文丢失，抛出错误
```

**关键问题点**：
- Multer 使用 Node.js 的 `busboy` 库解析 multipart/form-data
- `busboy` 内部使用事件监听器（`file`、`field` 事件）处理文件流
- 这些事件监听器在**另一个事件循环 tick** 中执行
- AsyncLocalStorage 的上下文**无法跨越事件监听器的异步边界**
- 当 multer 调用 `next()` 时，虽然文件已经处理完成（`req.files` 已设置），但 AsyncLocalStorage 的上下文可能已经丢失

### 错误表现

```
Error: Request context not found. Make sure request context middleware is applied.
    at getRequestContext (request-context.ts:46:11)
    at getMerchantId (request-context.ts:63:19)
    at PreorderPromotesRepository.create (preorder-promotes.repository.ts:32:37)
```

## 解决方案

### 1. 在 Request Context 中间件中保存上下文到 req 对象

**文件**: `xituan_backend/src/shared/middleware/request-context.middleware.ts`

中间件已将 context 写入 `req.__requestContext`，并在 `requestContext.run(context, () => next())` 中执行后续逻辑。Multer 在异步回调中调用 `next()` 后，AsyncLocalStorage 可能已丢失，但 `req.__requestContext` 仍在。

### 2. 在控制器中恢复上下文（推荐：使用 restoreRequestContextFromReq）

**推荐**：统一使用 `restoreRequestContextFromReq(req)`（`xituan_backend/src/shared/infrastructure/request-context.ts`），无需在控制器内手写 `createRequestContext`。

```typescript
async createXxx(req: Request, res: Response): Promise<void> {
  try {
    const { requestContext, restoreRequestContextFromReq } = require('../../../shared/infrastructure/request-context');
    const context = restoreRequestContextFromReq(req);

    if (!context) {
      res.status(400).json({
        success: false,
        error: { code: 'MISSING_MERCHANT_ID', message: 'Merchant ID is required' }
      });
      return;
    }

    if (!requestContext.getStore()) {
      requestContext.run(context, async () => {
        try {
          await this.handleCreateXxx(req, res);
        } catch (error) {
          console.error('Create Xxx failed:', error);
          if (!res.headersSent) {
            res.status(400).json({
              success: false,
              message: 'Create Xxx failed',
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
      });
      return;
    }

    await this.handleCreateXxx(req, res);
  } catch (error) {
    // ...
  }
}

private async handleCreateXxx(req: Request, res: Response): Promise<void> {
  // 实际业务逻辑（校验、调 service/repository、写响应）
}
```

**参考实现**：
- 产品创建/更新（带文件）：`xituan_backend/.../product.controller.ts` — `createProduct` / `updateProduct` + `handleCreateProduct` / `handleUpdateProduct`
- 分类创建/更新（仅 FormData、无文件）：同文件 — `createCategory` / `updateCategory` + `handleCreateCategory` / `handleUpdateCategory`；路由需加 `upload.none()` 才能解析 `req.body`，且同样需在控制器入口恢复 context

## 关键要点

### 1. 为什么需要保存到 req 对象？

- **一致性保证**：确保 `requestId` 和 `timestamp` 等动态生成的值在两次创建时保持一致
- **可靠性**：即使 AsyncLocalStorage 上下文丢失，也能从 req 对象恢复
- **向后兼容**：如果 req 对象上没有上下文，仍会重新创建（兜底方案）

### 2. 数据流程

```
requestContextMiddleware
  ↓
创建上下文（包含 requestId, timestamp）
  ↓
保存到 req.__requestContext ✅
  ↓
保存到 AsyncLocalStorage
  ↓
multer 中间件（AsyncLocalStorage 上下文丢失）
  ↓
控制器方法
  ↓
从 req 恢复上下文（restoreRequestContextFromReq）✅
  ↓
requestContext.run(context, () => handleXxx) 重新设置到 AsyncLocalStorage
```

### 3. 为什么不能只使用包装函数？

尝试过在路由中包装 multer 中间件：

```typescript
function wrapMulterWithContext(multerMiddleware: any) {
  return (req: Request, res: Response, next: NextFunction) => {
    const currentContext = requestContext.getStore();
    if (currentContext) {
      requestContext.run(currentContext, () => {
        multerMiddleware(req, res, next);
      });
    }
  };
}
```

**问题**：multer 内部使用事件监听器处理文件上传，这些事件监听器在另一个事件循环中执行，AsyncLocalStorage 的上下文无法跨越这些异步边界。

## 适用场景

此解决方法适用于以下情况：

1. ✅ 使用 `multer` 处理文件上传的路由（`upload.array()`、`upload.fields()`）
2. ✅ 使用 **`upload.none()`** 解析纯 FormData（无文件）的路由——若不使用 multer，`req.body` 不会被解析，为空；使用后同样需在控制器入口恢复 context
3. ✅ 需要访问 Request Context（如 `getMerchantId()`）的控制器方法或其调用的 service/repository
4. ✅ 其他可能导致 AsyncLocalStorage 上下文丢失的中间件

### 不同对象的创建/更新流程对比

#### 1. **Product (产品)** - 创建/更新均需在控制器入口恢复 context

**创建流程**：Multer → 控制器（恢复 context）→ 处理图片 → createProduct(需要 merchantId)。

**更新流程**：Multer → 控制器（恢复 context）→ getProductById(需要 merchantId) → 处理图片 → updateProduct。

**参考**：`product.controller.ts` 的 createProduct / updateProduct 已采用 restoreRequestContextFromReq + handleCreateProduct / handleUpdateProduct。

#### 2. **Category (分类)** - 仅 FormData，无文件

路由使用 `upload.none()` 解析 body；控制器同样需恢复 context，否则 createCategory/updateCategory 内 getMerchantId() 会失败。参考：同文件 createCategory / updateCategory。

#### 3. **Preorder Promotes / News / Offer**

先创建或先获取记录（需要 merchantId），再处理图片。必须在控制器入口恢复 context。参考：preorder-promotes 等已应用相同方案。

### 关键差异总结

| 对象 | 流程特点 | 何时需要 merchantId | 解决方式 |
|------|---------|---------------------|----------|
| **Product (创建/更新)** | 带文件上传 | 创建/获取/更新时 | 控制器入口 restore + handleXxx |
| **Category (创建/更新)** | 仅 FormData，upload.none() | 创建/更新时 | 同上 |
| **Preorder Promotes / News / Offer** | 先创建或先获取再传图 | 创建/获取时 | 同上 |

## 相关文件（backend）

- `xituan_backend/src/shared/middleware/request-context.middleware.ts` - Request Context 中间件（写入 `req.__requestContext`）
- `xituan_backend/src/shared/infrastructure/request-context.ts` - `restoreRequestContextFromReq(req)`、`requestContext.run`
- `xituan_backend/src/domains/product/controllers/product.controller.ts` - 推荐实现：createProduct/updateProduct、createCategory/updateCategory
- `xituan_backend/src/domains/product/routes/admin-product.routes.ts` - 分类路由使用 `upload.none()` 示例
- `xituan_backend/src/domains/preorder-promotes/controllers/admin-preorder-promotes.controller.ts` - 使用示例
- `xituan_backend/tests/integration/preorder-promotes/preorder-promotes-api.integration.test.ts` - 测试用例

## 相关文档

- **Agent Skill**：`.cursor/skills/request-context-multer/SKILL.md`

## 测试验证

相关测试文件：`xituan_backend/tests/integration/preorder-promotes/preorder-promotes-api.integration.test.ts`（例如：应该成功创建带图片上传的预订单推广）。

## 注意事项

1. **性能影响**：将上下文保存到 req 对象会增加少量内存开销，但可以忽略不计
2. **类型安全**：使用 `(req as any).__requestContext` 需要类型断言，因为 Express 的 Request 类型没有这个属性
3. **未来改进**：如果 Express 或 Node.js 改进了 AsyncLocalStorage 对事件监听器的支持，可以考虑移除这个 workaround

## 更新历史

- **2024-XX-XX**: 初始版本，解决 multer 中间件导致 Request Context 丢失的问题
- **2024-XX-XX**: 改进方案，将上下文保存到 req 对象以确保一致性
- **2025-02**: 推荐统一使用 `restoreRequestContextFromReq(req)`；补充 `upload.none()` 与分类创建/更新场景；文档迁入 devGuide，tests/docs 仅保留指向说明
