# Offer特色图片数量限制修复

## 问题描述

在CMS页面编辑现有offer时，用户可以持续添加多于三个图片，这与创建offer时限制3张图片的规则不一致。

## 问题分析

### 创建Offer时
- 通过multer中间件限制：`upload.array('featuredImages', 3)`
- 前端Upload组件限制：`maxCount={3}`

### 编辑Offer时
- 后端`addFeaturedImage`方法缺少图片数量检查
- 前端`FeaturedImageUploader`组件没有禁用上传功能
- 用户可以无限上传图片，直到达到其他限制

## 修复方案

### 1. 后端修复

#### 修复`addFeaturedImage`方法
```typescript
// 在添加图片前检查数量限制
if (featuredImages.length >= 3) {
  throw new Error('特色图片最多只能上传3张');
}
```

#### 修复`addMultipleFeaturedImages`方法
```typescript
// 在批量添加前检查总数限制
if (featuredImages.length + imagePaths.length > 3) {
  throw new Error('特色图片最多只能上传3张');
}
```

### 2. 前端修复

#### 修复`FeaturedImageUploader`组件
- 当图片数量达到3张时禁用上传功能
- 添加图片数量限制提示信息
- 动态显示上传区域状态

## 修复后的行为

### 创建Offer
- 最多上传3张特色图片 ✅
- 前端和后端都有数量限制 ✅

### 编辑Offer
- 最多上传3张特色图片 ✅
- 前端和后端都有数量限制 ✅
- 达到限制时禁用上传功能 ✅
- 显示清晰的提示信息 ✅

## 技术细节

### 后端验证
- 在service层添加业务逻辑验证
- 错误信息清晰明确
- 保持与创建offer时的一致性

### 前端体验
- 实时反馈图片数量状态
- 友好的提示信息
- 防止用户误操作

## 测试验证

已通过以下测试场景：
1. 当前0张图片，添加1张 → 成功
2. 当前1张图片，添加1张 → 成功  
3. 当前2张图片，添加1张 → 成功
4. 当前3张图片，添加1张 → 失败（达到限制）
5. 当前2张图片，批量添加2张 → 失败（总数超限）

## 总结

通过这次修复，现在创建和编辑offer时的特色图片数量限制完全一致，都限制为最多3张图片。用户体验也得到了改善，在达到限制时会收到清晰的提示信息。
