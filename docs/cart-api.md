# 购物车 API 文档

## 概述

购物车API提供了完整的购物车管理功能，包括添加商品、更新数量、删除商品、清空购物车等操作。所有API都需要用户认证。

## 基础信息

- **基础URL**: `/api/carts`
- **认证方式**: Bearer Token (JWT)
- **内容类型**: `application/json`

## API 端点

### 1. 获取用户购物车

获取当前用户的购物车信息，包括所有购物车项。

```http
GET /api/carts
```

**请求头**:
```
Authorization: Bearer <jwt_token>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "cart-uuid",
    "userId": "user-uuid",
    "metadata": {},
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "items": [
      {
        "id": "cart-item-uuid",
        "cartId": "cart-uuid",
        "productId": "product-uuid",
        "quantity": 2,
        "selectedOptions": [
          {
            "name": "size",
            "value": "large",
            "extraPrice": 500
          }
        ],
        "addedAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z",
        "product": {
          "id": "product-uuid",
          "name": "蛋糕",
          "basePrice": 2500,
          "salePrice": 2000
        }
      }
    ]
  }
}
```

### 2. 添加商品到购物车

向购物车添加新商品或更新现有商品数量。

```http
POST /api/carts/items
```

**请求头**:
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**请求体**:
```json
{
  "productId": "product-uuid",
  "quantity": 2,
  "selectedOptions": [
    {
      "name": "size",
      "value": "large",
      "extraPrice": 500
    }
  ]
}
```

**字段说明**:
- `productId` (必需): 产品ID
- `quantity` (必需): 数量，必须大于0
- `selectedOptions` (可选): 定制选项数组

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "cart-item-uuid",
    "cartId": "cart-uuid",
    "productId": "product-uuid",
    "quantity": 2,
    "selectedOptions": [
      {
        "name": "size",
        "value": "large",
        "extraPrice": 500
      }
    ],
    "addedAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 3. 更新购物车项

更新购物车中特定商品的数量和选项。

```http
PUT /api/carts/items/{cartItemId}
```

**请求头**:
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**路径参数**:
- `cartItemId`: 购物车项ID

**请求体**:
```json
{
  "productId": "product-uuid",
  "quantity": 3,
  "selectedOptions": [
    {
      "name": "size",
      "value": "medium",
      "extraPrice": 300
    }
  ]
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "cart-item-uuid",
    "cartId": "cart-uuid",
    "productId": "product-uuid",
    "quantity": 3,
    "selectedOptions": [
      {
        "name": "size",
        "value": "medium",
        "extraPrice": 300
      }
    ],
    "addedAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 4. 从购物车移除商品

从购物车中删除特定商品。

```http
DELETE /api/carts/items/{cartItemId}
```

**请求头**:
```
Authorization: Bearer <jwt_token>
```

**路径参数**:
- `cartItemId`: 购物车项ID

**响应示例**:
```json
{
  "success": true,
  "message": "商品已从购物车移除"
}
```

### 5. 清空购物车

删除购物车中的所有商品。

```http
DELETE /api/carts
```

**请求头**:
```
Authorization: Bearer <jwt_token>
```

**响应示例**:
```json
{
  "success": true,
  "message": "购物车已清空"
}
```

### 6. 获取购物车统计信息

获取购物车的统计信息，包括商品数量、总数量、总金额等。

```http
GET /api/carts/stats
```

**请求头**:
```
Authorization: Bearer <jwt_token>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "itemCount": 3,
    "totalQuantity": 5,
    "totalAmount": 15000
  }
}
```

## 错误处理

### 常见错误响应

**401 未认证**:
```json
{
  "success": false,
  "error": {
    "message": "用户未认证"
  }
}
```

**400 请求参数错误**:
```json
{
  "success": false,
  "error": {
    "message": "商品ID不能为空"
  }
}
```

**400 库存不足**:
```json
{
  "success": false,
  "error": {
    "message": "库存不足: 当前库存 5，需要 10"
  }
}
```

**404 资源不存在**:
```json
{
  "success": false,
  "error": {
    "message": "购物车项不存在"
  }
}
```

**500 服务器错误**:
```json
{
  "success": false,
  "error": {
    "message": "获取购物车失败"
  }
}
```

## 业务规则

1. **用户认证**: 所有购物车操作都需要用户登录
2. **库存检查**: 添加商品时会检查库存是否充足
3. **商品合并**: 添加相同商品时会自动合并数量
4. **数据验证**: 所有输入数据都会进行验证
5. **权限控制**: 用户只能操作自己的购物车

## 使用示例

### JavaScript/TypeScript 示例

```typescript
// 获取购物车
const getCart = async () => {
  const response = await fetch('/api/carts', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  return response.json();
};

// 添加商品到购物车
const addToCart = async (productId: string, quantity: number) => {
  const response = await fetch('/api/carts/items', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      productId,
      quantity,
      selectedOptions: []
    })
  });
  return response.json();
};

// 更新购物车项
const updateCartItem = async (cartItemId: string, quantity: number) => {
  const response = await fetch(`/api/carts/items/${cartItemId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      productId: 'product-uuid',
      quantity,
      selectedOptions: []
    })
  });
  return response.json();
};

// 删除购物车项
const removeFromCart = async (cartItemId: string) => {
  const response = await fetch(`/api/carts/items/${cartItemId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
};

// 清空购物车
const clearCart = async () => {
  const response = await fetch('/api/carts', {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
};
```

### cURL 示例

```bash
# 获取购物车
curl -X GET "http://localhost:3050/api/carts" \
  -H "Authorization: Bearer your-jwt-token"

# 添加商品到购物车
curl -X POST "http://localhost:3050/api/carts/items" \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "product-uuid",
    "quantity": 2,
    "selectedOptions": []
  }'

# 更新购物车项
curl -X PUT "http://localhost:3050/api/carts/items/cart-item-uuid" \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "product-uuid",
    "quantity": 3,
    "selectedOptions": []
  }'

# 删除购物车项
curl -X DELETE "http://localhost:3050/api/carts/items/cart-item-uuid" \
  -H "Authorization: Bearer your-jwt-token"

# 清空购物车
curl -X DELETE "http://localhost:3050/api/carts" \
  -H "Authorization: Bearer your-jwt-token"
```

## 注意事项

1. 所有金额都以分为单位（整数）
2. 购物车项会自动关联产品信息
3. 支持产品定制选项
4. 购物车数据会定期清理过期项目
5. 建议在客户端实现适当的错误处理和重试机制 