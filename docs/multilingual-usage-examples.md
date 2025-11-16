# 多语言系统使用示例

## 概述

多语言系统现在使用预定义的常量来管理各个实体的多语言字段，确保一致性和可维护性。

## 常量定义

```typescript
// 产品多语言字段配置
export const productIntlFields: string[] = ['name', 'description'];
export const productIntlFieldsRecursive: string[] = ['metadata'];

// 分类多语言字段配置
export const categoryIntlFields: string[] = ['name'];
export const categoryIntlFieldsRecursive: string[] = ['metadata'];

// 优惠多语言字段配置
export const offerIntlFields: string[] = ['name'];
export const offerIntlFieldsRecursive: string[] = [];
```

## 使用方式

### 1. 产品多语言处理

```typescript
// 在 ProductService 中
processMultilingualData<T>(data: T, req: iLanguageRequest): T {
  return MultilingualUtil.processData(data, req, productIntlFields, productIntlFieldsRecursive);
}
```

### 2. 分类多语言处理

```typescript
// 在 ProductService 中
processCategoryMultilingualData<T>(data: T, req: iLanguageRequest): T {
  return MultilingualUtil.processData(data, req, categoryIntlFields, categoryIntlFieldsRecursive);
}
```

### 3. 优惠多语言处理（未来实现）

```typescript
// 在 OfferService 中
processOfferMultilingualData<T>(data: T, req: iLanguageRequest): T {
  return MultilingualUtil.processData(data, req, offerIntlFields, offerIntlFieldsRecursive);
}
```

### 4. 原始数据处理（CMS编辑）

```typescript
// 在 ProductService 中
processRawData<T>(data: T, req: iLanguageRequest): T {
  return MultilingualUtil.processRawData(data, req);
}
```

## 处理逻辑

`MultilingualService.processMultilingualFields` 方法的处理逻辑：

1. **fieldNames 处理**：遍历指定的多语言字段，将多语言对象转换为对应语言的文本
2. **fieldNamesRecursive 处理**：遍历指定的JSONB对象字段，递归处理其中的多语言子对象

```typescript
// 处理指定的多语言字段
if (fieldNames && fieldNames.length > 0) {
  for (const fieldName of fieldNames) {
    if (result[fieldName] && multilingualUtil.isMultilingual(result[fieldName])) {
      result[fieldName] = this.getBestLocalizedText(result[fieldName], request);
    }
  }
}

// 递归处理指定的JSONB对象字段
if (fieldNamesRecursive && fieldNamesRecursive.length > 0) {
  for (const fieldNameRecursive of fieldNamesRecursive) {
    if (result[fieldNameRecursive] && typeof result[fieldNameRecursive] === 'object') {
      result[fieldNameRecursive] = this.processMetadataMultilingualFields(result[fieldNameRecursive], request);
    }
  }
}
```

## 扩展新的多语言字段

当需要添加新的多语言字段时，只需要更新常量定义：

```typescript
// 例如：为产品添加新的多语言字段
export const productIntlFields: string[] = ['name', 'description', 'shortDescription', 'tags'];
export const productIntlFieldsRecursive: string[] = ['metadata', 'seo'];
```

所有使用这些常量的地方都会自动获得新的多语言字段支持，无需修改业务逻辑代码。

## MultilingualUtil 工具类

为了进一步简化代码，我们创建了 `MultilingualUtil` 工具类：

```typescript
export class MultilingualUtil {
  /**
   * 处理多语言数据（通用方法）
   */
  static processData<T>(
    data: T,
    req: iLanguageRequest,
    fieldNames: string[],
    fieldNamesRecursive: string[]
  ): T {
    if (!data) return data;
    
    return MultilingualService.processMultilingualFields(
      data,
      req,
      fieldNames,
      fieldNamesRecursive
    );
  }

  /**
   * 处理原始数据（不进行多语言处理）
   */
  static processRawData<T>(data: T, req: iLanguageRequest): T {
    if (!data) return data;
    
    return MultilingualService.processMultilingualFields(data, req);
  }
}
```

### 优势

1. **代码复用**：消除了重复的多语言处理逻辑
2. **一致性**：所有地方使用相同的字段配置
3. **可维护性**：集中管理多语言字段定义和处理逻辑
4. **类型安全**：TypeScript 类型检查
5. **扩展性**：轻松添加新的多语言字段
6. **性能**：只处理指定的字段，避免不必要的递归
7. **简洁性**：Service 层的方法变得非常简洁
