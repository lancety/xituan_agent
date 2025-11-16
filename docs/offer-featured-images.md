# 报价特色图片功能

## 功能概述

为CMS offers页面添加特色图片功能，支持图片上传到S3并存储在数据库中。

## 数据库变更

### 新增字段
- `offers.featured_images`: TEXT[] 类型，存储特色图片路径数组
- 约束：不能为空数组，至少需要一张图片

### 迁移文件
- `1710000000036_add_featured_images_to_offers.sql`

## API接口

### 上传特色图片
```
POST /api/admin/offers/:offerId/featured-images
Content-Type: multipart/form-data
Authorization: Bearer <token>

Body:
- image: 图片文件
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "imagePath": "offer/123/featuredImage/123456.jpg",
    "featuredImages": [
      "offer/123/featuredImage/123456.jpg"
    ]
  },
  "message": "特色图片上传成功"
}
```

### 删除特色图片
```
DELETE /api/admin/offers/:offerId/featured-images/:imagePath
Authorization: Bearer <token>
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "featuredImages": []
  },
  "message": "特色图片删除成功"
}
```

## S3存储结构

```
s3://bucket/
├── offer/
│   └── :offerId/
│       └── featuredImage/
│           ├── 123456.jpg
│           ├── 789012.png
│           └── ...
└── default/
    └── (已移除默认图片，前端创建时会要求上传)
```

## 文件命名规则

- 文件名：6位随机数字 + 原文件扩展名
- 路径格式：`/offer/:offerId/featuredImage/{random_6_digits}.{ext}`

## 验证规则

### 文件类型
- 支持：JPG、PNG、GIF、WebP
- 拒绝：其他类型文件

### 文件大小
- 最大：5MB
- 超过限制会返回错误

### 业务规则
- 创建报价时特色图片可以为空
- 发布报价前必须上传至少一张特色图片
- 删除图片时会检查剩余数量，确保不为空

## 前端集成

### CMS组件
- `FeaturedImageUploader.tsx`: 特色图片上传组件
- 支持拖拽上传
- 实时预览
- 删除确认

### 表单集成
- 在OfferForm中添加特色图片上传区域
- 创建报价后自动显示上传组件
- 编辑模式下显示现有图片

## 环境配置

### 必需的环境变量
```bash
S3_REGION=ap-east-1
S3_BUCKET=your-bucket-name
S3_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
```

### 安装依赖
```bash
npm install multer @types/multer
```

## 使用说明

### 1. 运行数据库迁移
```bash
npm run migrate
```

### 2. 上传默认图片（已移除）
```bash
# 不再需要上传默认图片，前端创建报价时会要求用户上传特色图片
```

### 3. 重启后端服务
```bash
npm run dev
```

### 4. 在CMS中使用
- 创建新报价后，会自动显示特色图片上传区域
- 支持拖拽或点击上传图片
- 可以删除不需要的图片（保持至少一张）

## 注意事项

1. **图片存储**: 所有图片存储在S3中，确保S3配置正确
2. **文件大小**: 限制5MB，避免存储成本过高
3. **图片格式**: 只支持常见图片格式，确保兼容性
4. **数据一致性**: 删除图片时会验证业务规则
5. **错误处理**: 上传失败时会显示具体错误信息
6. **业务逻辑**: 创建报价时特色图片可以为空，但发布前必须上传图片

## 故障排除

### 常见问题

1. **上传失败**
   - 检查S3配置
   - 验证文件类型和大小
   - 查看后端日志

2. **图片不显示**
   - 检查S3权限
   - 验证图片路径
   - 确认CDN配置

3. **数据库错误**
   - 运行迁移脚本
   - 检查字段约束
   - 验证数据类型

## 未来改进

1. **图片压缩**: 自动压缩大图片
2. **缩略图**: 生成不同尺寸的缩略图
3. **批量上传**: 支持多图片同时上传
4. **图片编辑**: 基础图片编辑功能
5. **CDN集成**: 优化图片加载速度 