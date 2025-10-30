# 基于时间的发布内容设计规范

> 一种可复用的内容管理系统设计模式，支持基于时间周期的发布控制和动态状态计算

## 概述

本设计规范基于 `Offers` 页面的布局和样式，提供了一套完整的、可复用的内容管理解决方案。该设计支持：

- **时间周期控制**：通过 `startDate` 和 `endDate` 定义内容有效期
- **发布开关**：使用 `isReleased` 字段控制内容的公开性
- **动态状态计算**：基于当前时间、开始时间、结束时间和发布状态实时计算内容状态
- **响应式布局**：同时支持桌面端和移动端的优雅展示

## 核心设计原则

### 1. 数据模型设计

#### 必需字段
```typescript
interface TimeBasedContent {
  id: string;
  title: MultilingualContent;           // 标题
  isReleased: boolean;                  // 发布开关
  startDate: string;                    // 开始日期
  endDate: string;                      // 结束日期
  createdAt: string;
  updatedAt: string;
}
```

#### 状态枚举
```typescript
enum ContentStatus {
  DRAFT = 'draft',       // 草稿 (未发布)
  PUBLISHED = 'published', // 已发布 (但未开始)
  ACTIVE = 'active',     // 活跃中 (进行中)
  EXPIRED = 'expired'    // 已过期
}
```

### 2. 状态计算逻辑

状态由 `isReleased` 和时间关系动态计算：

```typescript
const computedStatus = !isReleased 
  ? ContentStatus.DRAFT       // 未发布 = 草稿
  : now.isBefore(startDate)   // 已发布但未开始
  ? ContentStatus.PUBLISHED
  : now.isAfter(endDate)       // 已过期
  ? ContentStatus.EXPIRED
  : ContentStatus.ACTIVE;      // 进行中
```

### 3. 发布控制流程

```
创建 → 草稿状态 → 发布 (isReleased=true) → 等待开始 → 活跃中 → 已过期
                                              ↑________________↑
```

## 布局设计

### 桌面端布局

#### 三列式布局结构
```
┌──────────────────────────────────────────────────────────────────────┐
│  [图片] 标题 + 状态标签      配送天数  商品数量  订单数量    [操作按钮] │
│             日期范围                                               │
└──────────────────────────────────────────────────────────────────────┘
```

#### 关键样式特征

1. **左侧：核心信息区**
   - 缩略图：64x64px，圆角 6px
   - 标题 + 状态标签
   - 日期范围

2. **中间：数据统计区**
   - 3列网格布局，间距 16px
   - 数字：20px，加粗，彩色
   - 标签：11px，灰色

3. **右侧：操作按钮区**
   - 发布状态切换、编辑、删除

#### 数据统计样式
```css
/* 配送天数 - 蓝色 */
color: #2563eb;

/* 商品数量 - 绿色 */
color: #059669;

/* 订单数量 - 紫色 */
color: #7c3aed;

/* 标签文字 */
font-size: 11px;
color: #999;  /* 亮色模式 */
color: #cbd5e1;  /* 暗色模式 */
```

### 移动端布局

#### 折叠式卡片结构
```
┌─────────────────────────────┐
│ [图片] 标题          ▲/▼    │  ◄─ 点击整个卡片展开
│       日期范围              │
│       状态标签              │
├─────────────────────────────┤  ◄─ 展开后
│ [分隔线]                    │
│   配送天数  商品数量  订单数量 │
│ [分隔线]                    │
│    [未公开] [编辑] [删除]   │
└─────────────────────────────┘
```

#### 交互设计
- **卡片悬停效果**：使用 Ant Design 的 `hoverable` 属性
- **点击整个卡片展开**：`onClick={handleToggleExpanded}` 绑定到 Card 组件
- **展开图标指示**：右上角显示展开/收起箭头（不再使用按钮）
- **互斥展开**：展开某个卡片时自动收起其他所有卡片，确保一次只有一个卡片处于展开状态

#### 展开区域样式
- **数据统计**：3列平均分布，数字 24px
- **按钮组**：3个按钮，平均分配空间
- 使用 `Divider` 分隔不同内容区域

## 样式系统

### 发布状态按钮样式

#### 已发布状态 (.status-btn-released)
```css
/* 亮色模式 */
background-color: #52c41a;  /* 绿色 */
color: #ffffff;

/* 暗色模式 */
background-color: #15803d;  /* 深绿色 */
color: #ffffff;
```

#### 未发布状态 (.status-btn-unreleased)
```css
/* 亮色模式 */
background-color: #faad14;  /* 橙黄色 */
color: #ffffff;

/* 暗色模式 */
background-color: #d97706;  /* 深橙黄色 */
color: #ffffff;
```

### 状态标签样式 (.status-tag-outlined)

#### 设计原则
- 透明/半透明背景 + 彩色边框
- 文字与边框颜色协调
- 不显示为按钮样式

#### 亮色模式示例
```css
/* 蓝色标签 */
background-color: #dbeafe;
border-color: #3b82f6;
color: #1e3a8a;

/* 绿色标签 */
background-color: #d1fae5;
border-color: #10b981;
color: #064e3b;
```

#### 暗色模式示例
```css
/* 蓝色标签 */
background-color: #1e3a8a;
border-color: #3b82f6;
color: #bfdbfe;

/* 绿色标签 */
background-color: #064e3b;
border-color: #10b981;
color: #6ee7b7;
```

## 日期显示优化

### 亮色模式
```typescript
color: '#666'
```

### 暗色模式
```typescript
color: '#cbd5e1'  // 提高对比度
```

## 响应式适配

### 桌面端
- 使用 Ant Design `List.Item` 组件
- 3列式水平布局
- 图片固定在左侧

### 移动端
- 使用 `Card` 组件
- 可折叠展开设计
- 展开后显示统计数据和操作按钮

### 响应式判断
```typescript
import { Grid } from 'antd';
const { useBreakpoint } = Grid;
const screens = useBreakpoint();
const isMobile = !screens.md;
```

## 主题适配

### CSS 变量系统
```css
[data-theme="light"] {
  --text-primary: #1d2939;
  --text-secondary: #475467;
  --border-primary: #e2e8f0;
}

[data-theme="dark"] {
  --text-primary: #f1f5f9;
  --text-secondary: #cbd5e1;
  --border-primary: #334155;
}
```

### 主题感知代码
```typescript
import { useTheme, epThemeMode } from '../../contexts/theme.context';

const { theme } = useTheme();

// 根据主题选择颜色
<div style={{ 
  color: theme === epThemeMode.DARK ? '#cbd5e1' : '#666' 
}}>
```

## API 设计

### 字段过滤
```typescript
interface ContentQueryParams {
  keyword?: string;
  isReleased?: boolean;      // 可选过滤
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}
```

### 后端过滤逻辑
公共 API 自动过滤：
- `startDate <= now`
- `endDate >= now`
- `isReleased = true`

管理端 API 不过滤，显示所有记录

## 关键实现代码

### 移动端卡片展开交互

```tsx
// 关键配置
<Card
  hoverable              // 启用悬停效果
  onClick={handleToggleExpanded}  // 点击整个卡片展开/收起
>
  {/* 卡片内容 */}
  <div>
    {/* 内容区域 */}
  </div>
  
  {/* 展开图标（不再使用 Button） */}
  <div style={{ color: '#999' }}>
    {isExpanded ? <UpOutlined /> : <DownOutlined />}
  </div>
  
  {/* 展开区域 */}
  {isExpanded && (
    <div>
      <Divider style={{ margin: '12px 0' }} />
      {/* 数据统计和操作按钮 */}
    </div>
  )}
</Card>
```

### 互斥展开逻辑

```tsx
// 切换展开状态 - 一次只展开一个
const toggleExpanded = (itemId: string) => {
  setExpandedItems(prev => {
    const newExpanded = new Set<string>();
    // 如果点击的是已展开的，则收起；否则收起所有并展开新的
    if (prev.has(itemId)) {
      // 收起当前
      return new Set();
    } else {
      // 收起其他，展开新的
      newExpanded.add(itemId);
      return newExpanded;
    }
  });
};
```

## 复制到其他页面的检查清单

- [ ] 数据模型包含 `isReleased`, `startDate`, `endDate`
- [ ] 实现状态计算逻辑 (`computedStatus`)
- [ ] 添加发布/取消发布 API 端点
- [ ] 创建 `ListItem` 组件，支持桌面/移动双模式
- [ ] 实现 `.status-btn-released` 和 `.status-btn-unreleased` 样式
- [ ] 实现 `.status-tag-outlined` 多色状态标签
- [ ] 添加主题感知的日期显示
- [ ] 配置响应式布局
- [ ] 添加过滤器 UI（可选）
- [ ] 移动端卡片支持点击展开（使用 `hoverable` 和 `onClick`）
- [ ] 实现互斥展开逻辑（展开一个自动收起其他）

## 文件结构参考

```
pages/
  └── {content-name}.tsx          # 主页面
components/
  └── {content-name}/
      ├── {ContentName}ListItem.tsx    # 列表项组件
      ├── {ContentName}Form.tsx        # 表单组件
      └── {ContentName}Manager.tsx     # 表格模式（可选）
styles/
  └── globals.css                  # 共享样式
```

## 设计优势

1. **视觉一致性**：统一的颜色系统、间距规范、标签样式
2. **信息层次**：左侧核心信息、中间统计数据、右侧操作
3. **状态明确**：通过按钮和标签清晰显示发布和活跃状态
4. **响应式友好**：移动端折叠式设计，桌面端信息密度高
5. **主题适配**：完整的亮色/暗色模式支持
6. **可扩展性**：可轻松添加到其他内容类型（订单、产品等）

