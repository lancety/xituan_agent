# 多语言预设内容管理方案

## 概述

本方案设计了一个统一的多语言管理系统，支持微信端、CMS端、后端和共享代码库的多语言文本管理。采用开发时合并格式编辑，构建时分离生成的策略，既保证了编辑的便利性，又确保了运行时的效率。

## 核心设计原则

1. **统一性**: 所有项目使用相同的多语言数据结构
2. **编辑友好**: 开发时所有语言版本在一起，便于对比和编辑
3. **运行时高效**: 每个项目只加载需要的语言数据
4. **类型安全**: 提供完整的TypeScript类型定义
5. **可扩展性**: 为未来的云端管理预留接口

## 项目结构

### 1. 微信端 (xituan_wechat_app)
```
xituan_wechat_app/
├── i18n/
│   ├── source/                    # 开发时编辑
│   │   ├── order/
│   │   │   ├── order.multilang.ts
│   │   │   └── order.type.ts
│   │   ├── payment/
│   │   │   ├── payment.multilang.ts
│   │   │   └── payment.type.ts
│   │   ├── common/
│   │   │   ├── common.multilang.ts
│   │   │   └── common.type.ts
│   │   └── index.ts               # 统一导出
│   ├── generated/                 # 构建时生成
│   │   ├── order/
│   │   │   ├── zh_cn.ts
│   │   │   ├── zh_cn.json
│   │   │   ├── en.ts
│   │   │   ├── en.json
│   │   │   ├── zh_tw.ts
│   │   │   └── zh_tw.json
│   │   ├── payment/
│   │   │   └── ... (同上)
│   │   └── types/
│   │       ├── order.type.ts
│   │       ├── payment.type.ts
│   │       └── index.ts
│   └── scripts/
│       └── generate-i18n.js       # 构建脚本
└── utils/
    └── i18n.util.ts              # 微信端专用工具
```

### 2. CMS端 (xituan_cms) - Next.js项目
```
xituan_cms/
├── i18n/                         # Next.js i18n专用目录
│   ├── source/                   # 开发时编辑
│   │   ├── order/
│   │   │   ├── order.multilang.ts
│   │   │   └── order.type.ts
│   │   ├── payment/
│   │   └── common/
│   ├── generated/                # 构建时生成
│   │   ├── order/
│   │   │   ├── zh_cn.json        # Next.js i18n格式
│   │   │   ├── en.json
│   │   │   └── zh_tw.json
│   │   └── ...
│   └── scripts/
│       └── generate-i18n.js
├── messages/                     # Next.js i18n默认目录
│   ├── zh_cn.json               # 合并后的完整语言文件
│   ├── en.json
│   └── zh_tw.json
└── utils/
    └── i18n.util.ts             # CMS端专用工具
```

### 3. 后端 (xituan_backend)
```
xituan_backend/
├── i18n/
│   ├── source/                   # 开发时编辑
│   │   ├── order/
│   │   │   ├── order.multilang.ts
│   │   │   └── order.type.ts
│   │   ├── payment/
│   │   └── common/
│   ├── generated/                # 构建时生成
│   │   ├── order/
│   │   │   ├── zh_cn.ts
│   │   │   ├── zh_cn.json
│   │   │   ├── en.ts
│   │   │   └── en.json
│   │   └── ...
│   └── scripts/
│       └── generate-i18n.js
└── src/
    └── utils/
        └── i18n.util.ts         # 后端专用工具
```

### 4. 共享代码库 (xituan_codebase)
```
xituan_codebase/
├── i18n/
│   ├── source/                   # 开发时编辑
│   │   ├── order/
│   │   │   ├── order.multilang.ts
│   │   │   └── order.type.ts
│   │   ├── payment/
│   │   └── common/
│   ├── generated/                # 构建时生成
│   │   ├── order/
│   │   │   ├── zh_cn.ts
│   │   │   ├── zh_cn.json
│   │   │   ├── en.ts
│   │   │   └── en.json
│   │   └── ...
│   └── scripts/
│       └── generate-i18n.js
└── utils/
    └── i18n.util.ts             # 共享工具
```

## 开发时编辑格式

### 类型定义示例
```typescript
// i18n/source/order/order.type.ts
export interface iOrderTexts {
  status: {
    pending: string;
    unpaid: string;
    processing: string;
    readyForDelivery: string;
    inDelivery: string;
    delivered: string;
    cancelled: string;
    expired: string;
    refunded: string;
    deleted: string;
  };
  mode: {
    regular: string;
    offer: string;
    preorder: string;
  };
  labels: {
    orderNumber: string;
    user: string;
    createTime: string;
    paymentMethod: string;
    paymentStatus: string;
    deliveryAddress: string;
    orderAmount: string;
    deliveryFee: string;
    edit: string;
  };
  actions: {
    edit: string;
    view: string;
    cancel: string;
    refund: string;
  };
}
```

### 合并格式编辑文件
```typescript
// i18n/source/order/order.multilang.ts
import { iOrderTexts } from './order.type';

export const orderTextsMultilang: Record<keyof iOrderTexts, Record<string, {
  zh_cn: string;
  en: string;
  zh_tw: string;
}>> = {
  status: {
    pending: {
      zh_cn: '待处理',
      en: 'Pending',
      zh_tw: '待處理'
    },
    unpaid: {
      zh_cn: '未付款',
      en: 'Unpaid',
      zh_tw: '未付款'
    },
    processing: {
      zh_cn: '处理中',
      en: 'Processing',
      zh_tw: '處理中'
    },
    readyForDelivery: {
      zh_cn: '待发货',
      en: 'Ready for Delivery',
      zh_tw: '待發貨'
    },
    inDelivery: {
      zh_cn: '配送中',
      en: 'In Delivery',
      zh_tw: '配送中'
    },
    delivered: {
      zh_cn: '已送达',
      en: 'Delivered',
      zh_tw: '已送達'
    },
    cancelled: {
      zh_cn: '已取消',
      en: 'Cancelled',
      zh_tw: '已取消'
    },
    expired: {
      zh_cn: '已过期',
      en: 'Expired',
      zh_tw: '已過期'
    },
    refunded: {
      zh_cn: '已退款',
      en: 'Refunded',
      zh_tw: '已退款'
    },
    deleted: {
      zh_cn: '已删除',
      en: 'Deleted',
      zh_tw: '已刪除'
    }
  },
  mode: {
    regular: {
      zh_cn: '普通',
      en: 'Regular',
      zh_tw: '普通'
    },
    offer: {
      zh_cn: '团购',
      en: 'Offer',
      zh_tw: '團購'
    },
    preorder: {
      zh_cn: '预约',
      en: 'Preorder',
      zh_tw: '預約'
    }
  },
  labels: {
    orderNumber: {
      zh_cn: '订单号',
      en: 'Order Number',
      zh_tw: '訂單號'
    },
    user: {
      zh_cn: '用户',
      en: 'User',
      zh_tw: '用戶'
    },
    createTime: {
      zh_cn: '创建时间',
      en: 'Create Time',
      zh_tw: '創建時間'
    },
    paymentMethod: {
      zh_cn: '支付方式',
      en: 'Payment Method',
      zh_tw: '支付方式'
    },
    paymentStatus: {
      zh_cn: '支付状态',
      en: 'Payment Status',
      zh_tw: '支付狀態'
    },
    deliveryAddress: {
      zh_cn: '配送地址',
      en: 'Delivery Address',
      zh_tw: '配送地址'
    },
    orderAmount: {
      zh_cn: '订单金额',
      en: 'Order Amount',
      zh_tw: '訂單金額'
    },
    deliveryFee: {
      zh_cn: '配送费',
      en: 'Delivery Fee',
      zh_tw: '配送費'
    },
    edit: {
      zh_cn: '编辑',
      en: 'Edit',
      zh_tw: '編輯'
    }
  },
  actions: {
    edit: {
      zh_cn: '编辑',
      en: 'Edit',
      zh_tw: '編輯'
    },
    view: {
      zh_cn: '查看',
      en: 'View',
      zh_tw: '查看'
    },
    cancel: {
      zh_cn: '取消',
      en: 'Cancel',
      zh_tw: '取消'
    },
    refund: {
      zh_cn: '退款',
      en: 'Refund',
      zh_tw: '退款'
    }
  }
} as const;
```

## 构建脚本

### 通用构建脚本模板
```javascript
// i18n/scripts/generate-i18n.js
const fs = require('fs');
const path = require('path');

// 支持的语言
const LANGUAGES = ['zh_cn', 'en', 'zh_tw'];

// 支持的模块
const MODULES = ['order', 'payment', 'common'];

function generateI18nFiles() {
  console.log('🔄 开始生成多语言文件...');

  MODULES.forEach(module => {
    console.log(`📝 处理模块: ${module}`);
    
    // 读取合并格式文件
    const multilangFile = require(`../source/${module}/${module}.multilang.ts`);
    const multilangData = multilangFile[`${module}TextsMultilang`];

    LANGUAGES.forEach(language => {
      // 生成单语言数据
      const langData = extractLanguageData(multilangData, language);
      
      // 生成 TypeScript 文件
      const tsContent = generateTSFile(langData, language, module);
      const tsPath = `../generated/${module}/${language}.ts`;
      fs.writeFileSync(path.resolve(__dirname, tsPath), tsContent);
      
      // 生成 JSON 文件
      const jsonContent = JSON.stringify(langData, null, 2);
      const jsonPath = `../generated/${module}/${language}.json`;
      fs.writeFileSync(path.resolve(__dirname, jsonPath), jsonContent);
      
      console.log(`✅ 生成 ${module}/${language} 文件`);
    });
  });

  // 生成类型定义文件
  generateTypeFiles();
  
  console.log('🎉 多语言文件生成完成！');
}

function extractLanguageData(multilangData, targetLang) {
  const result = {};
  
  function extract(obj, target) {
    for (const key in obj) {
      if (typeof obj[key] === 'object' && obj[key][targetLang]) {
        target[key] = obj[key][targetLang];
      } else if (typeof obj[key] === 'object') {
        target[key] = {};
        extract(obj[key], target[key]);
      }
    }
  }
  
  extract(multilangData, result);
  return result;
}

function generateTSFile(data, language, module) {
  return `// 自动生成的文件，请勿手动编辑
// Generated file, do not edit manually

import { i${module.charAt(0).toUpperCase() + module.slice(1)}Texts } from '../types/${module}.type';

export const ${module}Texts: i${module.charAt(0).toUpperCase() + module.slice(1)}Texts = ${JSON.stringify(data, null, 2)};
`;
}

function generateTypeFiles() {
  MODULES.forEach(module => {
    const typeContent = `// 自动生成的类型定义，请勿手动编辑
// Generated type definitions, do not edit manually

export interface i${module.charAt(0).toUpperCase() + module.slice(1)}Texts {
  // 类型定义内容
  // Type definitions content
}`;
    
    const typePath = `../generated/types/${module}.type.ts`;
    fs.writeFileSync(path.resolve(__dirname, typePath), typeContent);
  });
}

// 运行生成
generateI18nFiles();
```

### CMS端特殊构建脚本 (Next.js)
```javascript
// xituan_cms/i18n/scripts/generate-i18n.js
const fs = require('fs');
const path = require('path');

const LANGUAGES = ['zh_cn', 'en', 'zh_tw'];
const MODULES = ['order', 'payment', 'common'];

function generateI18nFiles() {
  console.log('🔄 生成CMS端多语言文件...');

  // 1. 生成各模块的JSON文件
  MODULES.forEach(module => {
    const multilangFile = require(`../source/${module}/${module}.multilang.ts`);
    const multilangData = multilangFile[`${module}TextsMultilang`];

    LANGUAGES.forEach(language => {
      const langData = extractLanguageData(multilangData, language);
      
      // 生成模块JSON文件
      const jsonContent = JSON.stringify(langData, null, 2);
      const jsonPath = `../generated/${module}/${language}.json`;
      fs.writeFileSync(path.resolve(__dirname, jsonPath), jsonContent);
    });
  });

  // 2. 生成Next.js i18n格式的完整语言文件
  LANGUAGES.forEach(language => {
    const completeLangData = {};
    
    MODULES.forEach(module => {
      const multilangFile = require(`../source/${module}/${module}.multilang.ts`);
      const multilangData = multilangFile[`${module}TextsMultilang`];
      const langData = extractLanguageData(multilangData, language);
      
      completeLangData[module] = langData;
    });

    // 写入Next.js messages目录
    const messagesPath = `../../messages/${language}.json`;
    fs.writeFileSync(path.resolve(__dirname, messagesPath), JSON.stringify(completeLangData, null, 2));
  });

  console.log('✅ CMS端多语言文件生成完成！');
}

// ... 其他函数
generateI18nFiles();
```

## 各项目使用方式

### 1. 微信端使用
```typescript
// 直接导入生成的单语言文件
import { orderTexts } from '@/i18n/generated/order/zh_cn';
import { paymentTexts } from '@/i18n/generated/payment/zh_cn';

// 使用
const statusText = orderTexts.status.pending; // '待处理'
const modeText = orderTexts.mode.regular; // '普通'
const paymentStatusText = paymentTexts.status.success; // '支付成功'
```

### 2. CMS端使用 (Next.js)
```typescript
// next.config.js
module.exports = {
  i18n: {
    locales: ['zh_cn', 'en', 'zh_tw'],
    defaultLocale: 'zh_cn',
  },
};

// 使用Next.js i18n
import { useTranslations } from 'next-intl';

const OrdersPage = () => {
  const t = useTranslations('order');
  
  return (
    <div>
      <h1>{t('labels.orderNumber')}</h1>
      <span className="status">
        {t('status.pending')}
      </span>
    </div>
  );
};
```

### 3. 后端使用
```typescript
// 直接导入生成的TypeScript文件
import { orderTexts } from '@/i18n/generated/order/zh_cn';
import { paymentTexts } from '@/i18n/generated/payment/zh_cn';

// 在服务中使用
export class OrderService {
  getOrderStatusText(status: string, language: string = 'zh_cn'): string {
    const texts = language === 'zh_cn' ? orderTexts : 
                  language === 'en' ? orderTextsEn : orderTextsZhTw;
    return texts.status[status] || status;
  }
}
```

## 构建流程

### 各项目package.json配置

#### 微信端
```json
{
  "scripts": {
    "build:i18n": "node i18n/scripts/generate-i18n.js",
    "dev": "npm run build:i18n && npm run dev:app",
    "build": "npm run build:i18n && npm run build:app"
  }
}
```

#### CMS端
```json
{
  "scripts": {
    "build:i18n": "node i18n/scripts/generate-i18n.js",
    "dev": "npm run build:i18n && next dev",
    "build": "npm run build:i18n && next build"
  }
}
```

#### 后端
```json
{
  "scripts": {
    "build:i18n": "node i18n/scripts/generate-i18n.js",
    "dev": "npm run build:i18n && npm run dev:server",
    "build": "npm run build:i18n && npm run build:server"
  }
}
```

## 未来扩展预留

### 云端接口预留
```typescript
// i18n/types/cloud.type.ts
export interface iCloudI18nProvider {
  // 获取文本
  getText(module: string, key: string, language: string): Promise<string>;
  
  // 获取所有文本
  getAllTexts(module: string, language: string): Promise<any>;
  
  // 更新文本
  updateText(module: string, key: string, language: string, value: string): Promise<void>;
  
  // 同步到本地
  syncToLocal(): Promise<void>;
  
  // 同步到云端
  syncToCloud(): Promise<void>;
}
```

### 本地同步工具预留
```typescript
// i18n/utils/sync.util.ts
export class I18nSyncUtil {
  // 从云端拉取
  static async pullFromCloud(): Promise<void> {
    // 预留接口
  }
  
  // 推送到云端
  static async pushToCloud(): Promise<void> {
    // 预留接口
  }
  
  // 解决冲突
  static async resolveConflicts(): Promise<void> {
    // 预留接口
  }
}
```

## 优势总结

1. **编辑友好**: 开发时所有语言版本在一起，便于对比和编辑
2. **运行时高效**: 每个项目只加载需要的语言数据
3. **类型安全**: 提供完整的TypeScript类型定义
4. **灵活部署**: 支持静态编译和动态加载两种模式
5. **易于维护**: 修改合并格式文件后，自动生成所有语言文件
6. **可扩展性**: 为未来的云端管理预留了完整的接口

## 实施步骤

1. **第一阶段**: 创建各项目的i18n目录结构和基础文件
2. **第二阶段**: 实现构建脚本和类型定义
3. **第三阶段**: 集成到各项目的构建流程
4. **第四阶段**: 迁移现有的多语言文本到新结构
5. **第五阶段**: 优化和测试各端的使用方式

这个方案既满足了当前的需求，又为未来的云端扩展预留了接口，是一个完整且可扩展的多语言管理解决方案。
