# PDF产品名称多语言实现

## 概述

本文档描述了在PDF生成器中实现批量获取产品名称和多语言支持的实现方案。

## 实现内容

### 1. 添加依赖服务

在 `PdfGeneratorService` 中添加了以下依赖：
- `ProductService`: 用于批量获取产品信息
- `MultilingualService`: 用于处理多语言文本
- `iLanguageRequest`: 语言请求接口

### 2. 批量获取产品名称方法

```typescript
private async getProductNames(invoice: iPartnerInvoice, languageRequest: iLanguageRequest): Promise<Map<string, string>> {
  const productIds = invoice.detail.map(item => item.productId);
  const products = await this.productService.getProductsByIds(productIds);
  
  const productNameMap = new Map<string, string>();
  
  for (const product of products) {
    const productName = MultilingualService.getBestLocalizedText(product.name, languageRequest);
    productNameMap.set(product.id, productName || product.id);
  }
  
  return productNameMap;
}
```

### 3. 更新PDF生成方法

- 在 `generateInvoicePdf` 方法中添加了可选的 `languageRequest` 参数
- 在生成PDF前批量获取产品名称映射
- 将产品名称映射传递给 `drawProductTable` 方法

### 4. 更新产品表格绘制

- 修改 `drawProductTable` 方法，添加 `productNameMap` 参数
- 使用实际的产品名称替代产品ID显示
- 如果无法获取产品名称，则回退到显示产品ID

### 5. 更新控制器

- 在 `partner.controller.ts` 中传递语言请求参数
- 确保语言中间件处理的语言偏好能够传递到PDF生成器

## 使用方式

### 1. 通过API调用

```typescript
// 请求头包含语言偏好
Accept-Language: zh-CN,zh;q=0.9,en;q=0.8

// 调用PDF生成API
POST /api/partner-invoices/:id/generate-pdf
```

### 2. 直接调用服务

```typescript
const pdfGeneratorService = new PdfGeneratorService();
const languageRequest = req as iLanguageRequest; // 从Express请求获取

const pdfBuffer = await pdfGeneratorService.generateInvoicePdf(
  invoice, 
  partner, 
  partnerAddress, 
  languageRequest
);
```

## 多语言支持

### 语言优先级

系统按照以下优先级获取产品名称：
1. 用户首选语言（从Accept-Language头部解析）
2. 备用语言（根据语言变体规则）
3. 默认语言（中文、英文）
4. 产品ID（作为最后备用）

### 支持的语言

- 中文简体 (zh_cn)
- 中文繁体 (zh_tw)
- 英文 (en)
- 其他语言变体

## 性能优化

### 批量获取

- 使用 `ProductService.getProductsByIds()` 一次性获取所有需要的产品
- 避免在循环中逐个查询产品信息

### 缓存机制

- 产品名称映射在PDF生成过程中缓存
- 避免重复查询相同产品

## 错误处理

### 产品不存在

- 如果产品不存在，使用产品ID作为显示文本
- 不会中断PDF生成过程

### 多语言内容缺失

- 如果指定语言的内容不存在，自动回退到备用语言
- 如果所有语言都缺失，使用产品ID

## 测试

创建了单元测试文件 `tests/unit/partner/pdf-generator.unit.test.ts` 来验证功能。

## 注意事项

1. 确保产品服务能够正确返回多语言产品名称
2. 语言请求参数是可选的，向后兼容
3. 产品名称显示长度受表格列宽限制
4. 建议在生产环境中测试多语言显示效果
