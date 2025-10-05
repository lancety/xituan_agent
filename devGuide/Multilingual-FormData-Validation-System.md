# 多语言FormData处理和验证系统

## 概述

本文档描述了基于lang查询参数的多语言FormData处理和验证系统的实现方案。该系统允许前端根据用户当前选择的语言发送请求，后端根据该语言参数验证多语言字段是否为空，并使用Accept-Language头部作为备用语言列表。

## 核心设计原则

### 1. 语言参数驱动验证
- 前端通过`lang`查询参数指定主要验证语言
- 后端根据该参数检查对应语言字段是否有值
- 支持备用语言机制，提高验证的灵活性

### 2. 标准化语言代码处理
- 统一使用`normalizeLanguageCode`函数处理语言代码
- 将`zh-CN`、`zh_CN`等格式统一为`zh_cn`
- 确保语言代码的一致性

### 3. 智能备用语言机制
- 从Accept-Language头部解析用户语言偏好
- 当主要语言为空时，检查备用语言
- 提供更好的用户体验

## 系统架构

```
前端 (CMS)                   后端 (API)
┌─────────────────┐         ┌─────────────────────┐
│ 用户选择语言     │         │ 接收lang参数        │
│ zh_cn/en/zh_tw  │────────▶│ 解析Accept-Language │
└─────────────────┘         └─────────────────────┘
         │                           │
         ▼                           ▼
┌─────────────────┐         ┌─────────────────────┐
│ 发送FormData    │         │ 验证多语言字段      │
│ + lang查询参数   │────────▶│ 使用备用语言机制    │
└─────────────────┘         └─────────────────────┘
```

## 实现细节

### 1. 前端实现

#### 1.1 API调用添加lang参数

```typescript
// news.api.ts
async createNews(data: iCreateNewsRequest | FormData, isFormData: boolean = false, language?: string): Promise<iNews> {
  const endpoint = isFormData ? '/admin/news/with-images' : '/admin/news';
  const url = language ? `${endpoint}?lang=${encodeURIComponent(language)}` : endpoint;
  return apiRequest<iNews>(url, {
    method: 'POST',
    body: isFormData ? data as FormData : JSON.stringify(data)
  });
}

async updateNews(id: string, data: iUpdateNewsRequest | FormData, isFormData: boolean = false, currentImages?: string[], language?: string): Promise<iNews> {
  let url = `/admin/news/${id}`;
  const queryParams = new URLSearchParams();
  
  if (currentImages && currentImages.length > 0) {
    queryParams.append('currentImages', JSON.stringify(currentImages));
  }
  
  if (language) {
    queryParams.append('lang', language);
  }
  
  if (queryParams.toString()) {
    url += `?${queryParams.toString()}`;
  }
  
  return apiRequest<iNews>(url, {
    method: 'PUT',
    body: isFormData ? data as FormData : JSON.stringify(data)
  });
}
```

#### 1.2 组件中传递当前语言

```typescript
// NewsEditor.tsx
const NewsEditor: React.FC<NewsEditorProps> = ({ news, onSuccess, onCancel, loading = false }) => {
  const { language } = useLanguage(); // 获取当前选中的语言
  
  const handleSubmit = async (values: any) => {
    // ... 处理表单数据
    
    if (isEditing) {
      await newsApi.updateNews(news!.id, formData, true, currentImages, language);
    } else {
      await newsApi.createNews(formData, true, language);
    }
  };
};
```

#### 1.3 多语言输入组件使用当前语言

```typescript
// MultilingualInput.tsx
const getDefaultMultilingualLanguages = (currentLanguage: string): string[] => {
  return getDefaultMultilingualFields(currentLanguage); // 使用当前语言作为默认值
};
```

### 2. 后端实现

#### 2.1 多语言工具函数

```typescript
// multilingual.util.ts
export const multilingualUtil = {
  /**
   * 标准化语言代码
   */
  normalizeLanguageCode(language: string): string {
    if (!language) return '';
    
    return language
      .toLowerCase()
      .replace('-', '_')
      .trim();
  },

  /**
   * 检查多语言对象在指定语言下是否为空
   */
  isEmptyForLanguage(
    content: iMultilingualContent | undefined, 
    language: string, 
    fallbackLanguages: string[] = []
  ): boolean {
    if (!this.isMultilingual(content)) {
      return true;
    }

    // 检查指定语言
    if (content[language] && typeof content[language] === 'string' && content[language].trim().length > 0) {
      return false;
    }

    // 检查备用语言
    for (const fallbackLang of fallbackLanguages) {
      if (content[fallbackLang] && typeof content[fallbackLang] === 'string' && content[fallbackLang].trim().length > 0) {
        return false;
      }
    }

    return true;
  },

  /**
   * 解析Accept-Language头部
   */
  parseAcceptLanguage(acceptLanguage: string): Array<{code: string, quality: number}> {
    if (!acceptLanguage) return [];
    
    return acceptLanguage
      .split(',')
      .map(lang => {
        const [code, quality] = lang.trim().split(';q=');
        return {
          code: code.trim(),
          quality: quality ? parseFloat(quality) : 1.0
        };
      })
      .filter(lang => lang.code);
  }
};
```

#### 2.2 控制器中的验证逻辑

```typescript
// admin-news.controller.ts
async createNewsWithImages(req: iAuthenticatedRequest, res: Response): Promise<void> {
  try {
    // 处理FormData中的字段类型转换
    const processedData = fieldProcessorUtil.processFormDataFields(
      req.body,
      newsString,           // stringSet - 字符串字段保持原样
      newsNum,              // numSet - 数字字段
      newsBoolean,          // boolSet - 布尔字段
      newsDate,             // dateSet - 日期字段
      newsMultilingual,     // objSet - 多语言字段（JSONB字段）
      undefined             // specialFields - 特殊字段
    );
    
    // 获取语言参数，默认为zh
    const lang = (req.query.lang as string) || 'zh';
    const normalizedLang = multilingualUtil.normalizeLanguageCode(lang);
    
    // 从Accept-Language头部获取备用语言列表
    const acceptLanguage = req.headers['accept-language'] as string || '';
    const preferredLanguages = multilingualUtil.parseAcceptLanguage(acceptLanguage)
      .map(lang => multilingualUtil.normalizeLanguageCode(lang.code))
      .filter(lang => lang !== normalizedLang); // 排除主要语言
    
    const fallbackLanguages = preferredLanguages;
    
    // 验证请求数据 - 使用指定语言检查多语言内容
    if (multilingualUtil.isEmptyForLanguage(processedData.title, normalizedLang, fallbackLanguages)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST_DATA',
          message: '新闻标题不能为空'
        }
      });
      return;
    }
    
    if (multilingualUtil.isEmptyForLanguage(processedData.description, normalizedLang, fallbackLanguages)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST_DATA',
          message: '新闻描述不能为空'
        }
      });
      return;
    }
    
    if (multilingualUtil.isEmptyForLanguage(processedData.body, normalizedLang, fallbackLanguages)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST_DATA',
          message: '新闻正文不能为空'
        }
      });
      return;
    }

    // ... 继续处理业务逻辑
  } catch (error) {
    // ... 错误处理
  }
}
```

## 关键避坑指南

### 1. 语言代码标准化
**问题**：不同来源的语言代码格式不一致（`zh-CN` vs `zh_cn`）
**解决**：始终使用`normalizeLanguageCode`函数统一处理

```typescript
// ❌ 错误：直接比较
if (language === 'zh-CN') { ... }

// ✅ 正确：标准化后比较
const normalizedLang = multilingualUtil.normalizeLanguageCode(language);
if (normalizedLang === 'zh_cn') { ... }
```

### 2. 避免硬编码语言检查
**问题**：硬编码检查特定语言字段（如只检查`zh`字段）
**解决**：使用动态语言参数和备用语言机制

```typescript
// ❌ 错误：硬编码检查
if (!processedData.title.zh || processedData.title.zh.trim() === '') {
  // 只检查zh字段
}

// ✅ 正确：动态检查
if (multilingualUtil.isEmptyForLanguage(processedData.title, normalizedLang, fallbackLanguages)) {
  // 检查指定语言和备用语言
}
```

### 3. 正确处理空字符串
**问题**：只检查字段存在性，忽略空字符串
**解决**：检查字段值并去除空白字符

```typescript
// ❌ 错误：只检查存在性
if (!content[language]) { return true; }

// ✅ 正确：检查非空值
if (content[language] && typeof content[language] === 'string' && content[language].trim().length > 0) {
  return false;
}
```

### 4. 备用语言顺序
**问题**：备用语言顺序不合理
**解决**：根据Accept-Language头部的质量值排序

```typescript
// ✅ 正确：按质量排序
languages.sort((a, b) => b.quality - a.quality);
```

### 5. 错误消息本地化
**问题**：错误消息固定为中文
**解决**：根据语言参数返回对应的错误消息

```typescript
// 可以考虑根据语言参数返回不同的错误消息
const errorMessages = {
  zh: '新闻标题不能为空',
  en: 'News title cannot be empty',
  zh_cn: '新闻标题不能为空',
  zh_tw: '新聞標題不能為空'
};

const message = errorMessages[normalizedLang] || errorMessages.zh;
```

## 使用示例

### 前端发送请求

```typescript
// 用户选择英文，发送请求
const formData = new FormData();
formData.append('title', JSON.stringify({
  intl: true,
  zh: '',
  en: 'Hello World'
}));

await newsApi.createNews(formData, true, 'en');
// 实际请求：POST /admin/news/with-images?lang=en
```

### 后端验证过程

```
1. 接收lang=en参数
2. 标准化：normalizedLang = 'en'
3. 解析Accept-Language: zh-CN,zh;q=0.9,en-AU;q=0.8
4. 备用语言：['zh_cn', 'zh']
5. 验证title字段：
   - 检查en字段：有值"Hello World" ✅
   - 验证通过
```

## 扩展指南

### 1. 添加新的多语言字段

```typescript
// 1. 在字段类型定义中添加
export const newsMultilingual = new Set([
  'title', 'description', 'body', 'summary' // 添加新字段
]);

// 2. 在控制器中添加验证
if (multilingualUtil.isEmptyForLanguage(processedData.summary, normalizedLang, fallbackLanguages)) {
  res.status(400).json({
    success: false,
    error: {
      code: 'INVALID_REQUEST_DATA',
      message: '新闻摘要不能为空'
    }
  });
  return;
}
```

### 2. 支持更多语言

```typescript
// 1. 在枚举中添加新语言
export enum epSupportedLanguages {
  EN = 'en',
  ZH = 'zh',
  ZH_CN = 'zh_cn', 
  ZH_TW = 'zh_tw',
  JA = 'ja',  // 添加日语
  KO = 'ko'   // 添加韩语
}

// 2. 更新语言映射
const languageMapping: { [key: string]: string } = {
  'zh_cn': 'zh_cn',
  'zh_tw': 'zh_tw', 
  'en': 'en',
  'zh': 'zh',
  'ja': 'ja',  // 添加日语映射
  'ko': 'ko'   // 添加韩语映射
};
```

### 3. 自定义验证规则

```typescript
// 可以创建更复杂的验证函数
const validateMultilingualField = (
  content: iMultilingualContent | undefined,
  fieldName: string,
  language: string,
  fallbackLanguages: string[],
  customRules?: {
    minLength?: number;
    maxLength?: number;
    requiredLanguages?: string[];
  }
): { isValid: boolean; message: string } => {
  // 实现自定义验证逻辑
};
```

## 总结

这个多语言FormData处理和验证系统提供了：

1. **灵活性**：支持任意语言作为主要验证语言
2. **智能性**：使用Accept-Language头部提供备用语言机制
3. **一致性**：统一的语言代码标准化处理
4. **可扩展性**：易于添加新语言和新字段
5. **用户友好**：根据用户语言偏好进行验证

通过遵循这个方案，可以确保多语言系统的一致性和可维护性，同时提供良好的用户体验。
