# Offer 资源清理功能

## 概述

当删除offer时，系统会自动清理S3中与该offer相关的所有资源，包括特色图片、临时文件等。

## 功能特性

- **自动清理**: 删除offer时自动触发资源清理
- **全面覆盖**: 清理所有相关的S3资源
- **错误处理**: 完善的错误处理和日志记录
- **非阻塞**: S3资源清理失败不影响offer删除操作

## 资源类型

### 1. 特色图片
- 路径: `offer/:offerId/featuredImage/`
- 清理内容: 该offer下的所有特色图片文件

### 2. 临时文件
- 路径: `temp/offers/:offerId/`
- 清理内容: 该offer相关的临时文件

## 实现方式

### 核心工具类
- `OfferResourceCleanupUtil`: 负责清理offer相关的S3资源
- `ResourceCleanupError`: 处理资源清理相关的错误

### 集成点
- `OfferService.deleteOffer()`: 删除offer后自动调用资源清理
- 错误处理: 即使S3清理失败，offer删除操作仍会成功

## 使用方法

### 自动清理
```typescript
// 删除offer时会自动清理资源
await offerService.deleteOffer(offerId);
```

### 手动清理
```typescript
// 手动清理特定offer的资源
await OfferResourceCleanupUtil.cleanupOfferResources(offerId);
```

### 检查资源存在性
```typescript
// 检查offer资源是否存在
const exists = await OfferResourceCleanupUtil.checkOfferResourcesExist(offerId);
```

## 错误处理

### 错误类型
- `ResourceCleanupError`: 资源清理失败时抛出的错误
- 包含详细的错误信息和原始错误

### 错误处理策略
- S3资源清理失败不会影响offer删除操作
- 所有错误都会记录到日志中
- 支持错误分类和详细信息

## 配置要求

### 环境变量
- `S3_REGION`: S3区域 (默认: ap-east-1)
- `S3_BUCKET`: S3存储桶名称
- `S3_KEY`: S3访问密钥ID
- `S3_SECRET_KEY`: S3秘密访问密钥

### 权限要求
- S3 ListObjects权限
- S3 DeleteObjects权限

## 日志记录

系统会记录以下操作的详细日志：
- 资源清理开始和完成
- 找到的文件数量和路径
- 删除操作的结果
- 错误信息和异常

## 注意事项

1. **非阻塞操作**: S3资源清理失败不会阻止offer删除
2. **批量删除**: 使用S3的批量删除API提高效率
3. **错误恢复**: 支持部分失败的情况，继续清理其他资源
4. **资源检查**: 提供资源存在性检查功能

## 测试

可以使用提供的测试文件验证功能：
```bash
node test-offer-cleanup.js
```

## 扩展性

该架构支持轻松扩展其他资源类型的清理：
- 添加新的资源类型
- 自定义清理逻辑
- 支持不同的存储后端
