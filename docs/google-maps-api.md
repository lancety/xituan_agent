# Google Maps API 文档

本文档描述了喜团后端服务中集成的Google Maps API功能。

## 环境配置

在环境变量中添加以下配置：

```env
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

## API 端点

所有API端点都需要身份验证。请在请求头中包含有效的JWT token：

```
Authorization: Bearer <your_jwt_token>
```

### 1. 根据坐标获取地址

**端点:** `POST /api/google-maps/address-from-coordinates`

**描述:** 根据给定的经纬度坐标获取详细地址信息

**请求体:**
```json
{
  "lat": -37.8136,
  "lng": 144.9631,
  "language": "en"
}
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "street": "123 Collins Street",
    "suburb": "Melbourne",
    "state": "Victoria",
    "country": "Australia",
    "postCode": "3000",
    "formattedAddress": "123 Collins Street, Melbourne VIC 3000, Australia"
  }
}
```

### 2. 根据地址获取坐标

**端点:** `POST /api/google-maps/coordinates-from-address`

**描述:** 根据给定的地址获取经纬度坐标

**请求体:**
```json
{
  "address": "123 Collins Street, Melbourne VIC 3000, Australia",
  "language": "en"
}
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "lat": -37.8136,
    "lng": 144.9631
  }
}
```

### 3. 计算两点间距离

**端点:** `POST /api/google-maps/distance`

**描述:** 计算两个地点之间的距离

**请求体:**
```json
{
  "origin": {
    "lat": -37.8136,
    "lng": 144.9631
  },
  "destination": "456 Bourke Street, Melbourne VIC 3000, Australia",
  "mode": "driving",
  "units": "km"
}
```

**参数说明:**
- `origin`: 起点，可以是坐标对象或地址字符串
- `destination`: 终点，可以是坐标对象或地址字符串
- `mode`: 出行方式 (`driving`, `walking`, `bicycling`, `transit`)
- `units`: 距离单位 (`km`, `miles`)

**响应示例:**
```json
{
  "success": true,
  "data": {
    "distance": 2.5,
    "duration": 300,
    "unit": "km"
  }
}
```

### 4. 地址自动补全

**端点:** `POST /api/google-maps/address-suggestions`

**描述:** 根据用户输入返回相关地址建议（最多10个）

**请求体:**
```json
{
  "input": "123 Collins",
  "language": "en",
  "region": "au",
  "location": {
    "lat": -37.8136,
    "lng": 144.9631
  },
  "radius": 50000
}
```

**参数说明:**
- `input`: 用户输入的地址关键词
- `language`: 语言代码 (默认: "en")
- `region`: 地区代码 (默认: "au")
- `location`: 可选，用于限制搜索范围的中心点
- `radius`: 可选，搜索半径（米），仅在提供location时有效

**响应示例:**
```json
{
  "success": true,
  "data": [
    {
      "placeId": "ChIJ...",
      "formattedAddress": "123 Collins Street, Melbourne VIC 3000, Australia",
      "addressComponents": {
        "street": "123 Collins Street",
        "suburb": "Melbourne",
        "state": "Victoria",
        "country": "Australia",
        "postCode": "3000",
        "formattedAddress": "123 Collins Street, Melbourne VIC 3000, Australia"
      },
      "coordinates": {
        "lat": -37.8136,
        "lng": 144.9631
      }
    }
  ]
}
```

## 错误处理

所有API都遵循统一的错误响应格式：

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description"
  }
}
```

### 常见错误代码

- `MISSING_COORDINATES`: 缺少坐标参数
- `MISSING_ADDRESS`: 缺少地址参数
- `MISSING_ORIGIN_DESTINATION`: 缺少起点或终点参数
- `MISSING_INPUT`: 缺少输入参数
- `REVERSE_GEOCODING_ERROR`: 反向地理编码失败
- `GEOCODING_ERROR`: 地理编码失败
- `DISTANCE_CALCULATION_ERROR`: 距离计算失败
- `ADDRESS_SUGGESTIONS_ERROR`: 地址建议获取失败

## 使用示例

### JavaScript/TypeScript 客户端示例

```typescript
// 获取地址建议
const getAddressSuggestions = async (input: string) => {
  const response = await fetch('/api/google-maps/address-suggestions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      input,
      language: 'en',
      region: 'au'
    })
  });
  return response.json();
};

// 计算距离
const calculateDistance = async (origin: string, destination: string) => {
  const response = await fetch('/api/google-maps/distance', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      origin,
      destination,
      mode: 'driving',
      units: 'km'
    })
  });
  return response.json();
};
```

## 注意事项

1. 所有API都需要有效的JWT token进行身份验证
2. Google Maps API有使用配额限制，请合理使用
3. 地址自动补全功能返回最多10个建议
4. 距离计算支持多种出行方式
5. 所有坐标使用WGS84标准（GPS坐标）
6. 建议在生产环境中配置适当的错误监控和日志记录
