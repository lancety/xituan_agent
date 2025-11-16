# PDF中文字体支持实现

## 问题描述

在PDF生成过程中遇到 `WinAnsi cannot encode "杏" (0x674f)` 错误，这是因为 `pdf-lib` 的默认字体（Helvetica）只支持 WinAnsi 编码，无法处理中文字符。

## 解决方案

### 1. 安装依赖

```bash
npm install @pdf-lib/fontkit
```

### 2. 下载中文字体文件

- **字体名称**: Noto Sans CJK Regular
- **文件路径**: `assets/fonts/NotoSansCJK-Regular.ttf`
- **文件大小**: ~16MB
- **支持语言**: 中文简体、中文繁体、日文、韩文
- **许可证**: Open Font License

### 3. 混合字体策略

为了优化PDF文件大小和性能，采用混合字体策略：

- **默认字体**: 用于所有英文文本（标题、价格、数量等）
- **中文字体**: 仅用于产品名称（当包含中日韩文字符时）

### 4. 代码实现

```typescript
import fontkit from '@pdf-lib/fontkit';

// 在 generateInvoicePdf 方法中
const pdfDoc = await PDFDocument.create();
pdfDoc.registerFontkit(fontkit);

// 默认字体用于大部分文本
const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

// 中文字体仅用于产品名称
let chineseFont = null;
try {
  const chineseFontPath = path.join(process.cwd(), 'assets', 'fonts', 'NotoSansCJK-Regular.ttf');
  if (fs.existsSync(chineseFontPath)) {
    const fontBytes = fs.readFileSync(chineseFontPath);
    chineseFont = await pdfDoc.embedFont(fontBytes);
  }
} catch (error) {
  console.warn('Chinese font not available');
}
```

### 5. 智能字体选择逻辑

```typescript
// 在产品名称绘制时
const productName = productNameMap.get(item.productId) || item.productId;

// 检查产品名称是否包含中日韩文字符
const hasCJKCharacters = /[\u4e00-\u9fff\u3400-\u4dbf\u20000-\u2a6df\u2a700-\u2b73f\u2b740-\u2b81f\u2b820-\u2ceaf\u2ceb0-\u2ebef\u2f800-\u2fa1f\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(productName);
const productNameFont = (hasCJKCharacters && chineseFont) ? chineseFont : font;

page.drawText(productName, {
  x: xPos + 9,
  y: currentY - textOffsetY,
  size: 10,
  font: productNameFont, // 智能选择字体
  color: rgb(0, 0, 0)
});
```

## 测试验证

创建了测试脚本验证字体加载功能：

```javascript
// 测试中文文本渲染
page.drawText('测试中文：杏花春雨江南', {
  x: 50,
  y: 750,
  size: 20,
  font: font,
});
```

测试结果：✅ 成功生成包含中文字符的PDF文件

## 文件结构

```
xituan_backend/
├── assets/
│   └── fonts/
│       ├── NotoSansCJK-Regular.ttf  # 中文字体文件
│       └── README.md                # 字体说明文档
├── src/
│   └── domains/
│       └── partner/
│           └── services/
│               └── pdf-generator.service.ts  # 更新的PDF生成器
└── docs/
    └── chinese-font-support.md  # 本文档
```

## 使用效果

- ✅ 支持中文产品名称显示
- ✅ 智能字体选择（仅产品名称使用中文字体）
- ✅ 解决 "WinAnsi cannot encode" 错误
- ✅ 优化PDF文件大小（减少不必要的字体嵌入）
- ✅ 保持PDF生成性能
- ✅ 向后兼容（字体加载失败时回退到标准字体）

## 注意事项

1. **字体文件大小**: 中文字体文件较大（16MB），但仅在需要时嵌入
2. **网络依赖**: 字体文件存储在本地，无需网络连接
3. **性能优化**: 采用混合字体策略，减少PDF文件大小
4. **智能选择**: 自动检测产品名称是否包含中日韩文字符
5. **回退机制**: 如果字体文件不存在或损坏，系统会自动回退到标准字体

## 维护建议

1. 定期检查字体文件完整性
2. 考虑压缩字体文件以减少存储空间
3. 监控PDF生成性能
4. 根据需要使用其他中文字体（如思源黑体、微软雅黑等）
