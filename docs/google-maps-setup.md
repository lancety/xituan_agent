# Google Maps API 设置指南

## 1. 获取 Google Maps API 密钥

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择现有项目
3. 启用以下 API：
   - Geocoding API
   - Reverse Geocoding API
   - Distance Matrix API
   - Places API
   - Geolocation API
4. 创建 API 密钥
5. 配置 API 密钥限制（推荐）

## 2. 环境变量配置

在 `.env` 文件中添加以下配置：

```env
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

## 3. API 密钥限制设置

为了安全起见，建议为 API 密钥设置以下限制：

### 应用限制
- 选择 "HTTP referrers (web sites)"
- 添加你的域名：
  - `http://localhost:3050/*` (开发环境)
  - `https://backend.xituan.com.au/*` (生产环境)
  - `https://backend-staging.xituan.com.au/*` (测试环境)

### API 限制
选择以下 API：
- Geocoding API
- Reverse Geocoding API
- Distance Matrix API
- Places API
- Geolocation API

## 4. 测试 API

使用提供的测试脚本测试 API：

```bash
# 确保服务器正在运行
npm run dev

# 在另一个终端运行测试
node test-google-maps.js
```

## 5. 费用说明

Google Maps API 按使用量收费，请查看 [Google Maps Platform 定价](https://cloud.google.com/maps-platform/pricing) 了解详细费用。

### 免费配额（每月）
- Geocoding API: 40,000 次请求
- Reverse Geocoding API: 40,000 次请求
- Distance Matrix API: 40,000 次请求
- Places API: 40,000 次请求
- Geolocation API: 40,000 次请求

## 6. 监控和限制

建议设置以下监控：
1. 在 Google Cloud Console 中设置配额限制
2. 监控 API 使用量
3. 设置预算警报

## 7. 故障排除

### 常见错误

1. **INVALID_API_KEY**: API 密钥无效或未正确配置
2. **OVER_QUERY_LIMIT**: 超出配额限制
3. **REQUEST_DENIED**: API 未启用或密钥被限制
4. **ZERO_RESULTS**: 未找到匹配的结果

### 调试步骤

1. 检查 API 密钥是否正确配置
2. 确认相关 API 已启用
3. 检查 API 密钥限制设置
4. 查看 Google Cloud Console 中的使用统计
5. 检查网络连接和防火墙设置
