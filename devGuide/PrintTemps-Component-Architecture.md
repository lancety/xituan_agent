# 打印模板系统组件架构

## 🏗️ 组件架构概览

### 整体架构图
```
┌─────────────────────────────────────────────────────────┐
│                    CMS页面层                            │
├─────────────────────────────────────────────────────────┤
│  PrintTempList  │  PrintTempEditor  │  PrintTempPreview │
├─────────────────────────────────────────────────────────┤
│                   组件层                                │
├─────────────────────────────────────────────────────────┤
│  Canvas  │  PropertyPanel  │  DataBinding  │  StyleEdit │
├─────────────────────────────────────────────────────────┤
│                   工具层                                │
├─────────────────────────────────────────────────────────┤
│  Renderer  │  DataBinding  │  EntityFields  │  Utils   │
├─────────────────────────────────────────────────────────┤
│                   类型层                                │
├─────────────────────────────────────────────────────────┤
│  PrintTemp  │  Element  │  DataBinding  │  Styles     │
└─────────────────────────────────────────────────────────┘
```

## 📁 实际文件结构

### CMS前端结构
```
xituan_cms/src/
├── pages/printTemps/
│   ├── index.tsx                    # 打印模板列表页
│   ├── editor.tsx                   # 打印模板编辑器页
│   └── statistics.tsx               # 模板统计页
├── components/printTemps/
│   ├── TemplateCanvas.tsx           # 画布组件
│   ├── ElementPalette.tsx           # 元素工具栏
│   ├── ElementProperties.tsx        # 元素属性面板
│   ├── TemplatePreviewSelector.tsx  # 模板预览选择器
│   └── PrintTempPreview.tsx         # 打印预览组件
├── componentsPrint/
│   └── TemplateBatchPrinter.tsx     # 通用批量打印组件（集成printTemps）
├── lib/api/
│   └── printTemp.api.ts             # API接口封装
├── utils/
│   └── templateRenderer.util.ts     # 前端模板渲染器
└── submodules/xituan_codebase/
    └── typing_entity/
        ├── printTemp.type.ts        # 打印模板类型定义
        └── entityFields.default.ts  # 实体字段定义
```

### 后端结构
```
xituan_backend/src/domains/printTemps/
├── controllers/
│   ├── printTemp.controller.ts      # 打印模板控制器
│   └── entityFields.controller.ts   # 实体字段控制器
├── services/
│   └── printTemp.service.ts         # 打印模板服务
├── routes/
│   ├── printTemp.routes.ts          # 打印模板路由
│   └── entityFields.routes.ts       # 实体字段路由
└── submodules/xituan_codebase/
    └── typing_entity/
        ├── printTemp.type.ts        # 打印模板类型定义
        └── entityFields.default.ts  # 实体字段定义
```

### 数据库结构
```
xituan_backend/migrations/
└── 1710000000150_create_print_temps_tables.sql  # 数据库迁移文件
```

## 🎨 核心组件设计

### 1. 打印模板编辑器页面 (editor.tsx)

```typescript
// pages/printTemps/editor.tsx
export default function PrintTempEditorPage() {
  const router = useRouter();
  const [template, setTemplate] = useState<iPrintTemp | null>(null);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [sampleData, setSampleData] = useState<any>(null);
  const [entityFields, setEntityFields] = useState<iEntityField[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // 编辑器布局
  return (
    <MainLayout>
      <div className="print-temp-editor">
        {/* 顶部工具栏 */}
        <div className="editor-toolbar">
          <Space>
            <Button icon={<SaveOutlined />} onClick={handleSave}>
              保存
            </Button>
            <Button icon={<EyeOutlined />} onClick={handlePreview}>
              预览
            </Button>
            <Button icon={<UndoOutlined />} onClick={handleUndo}>
              撤销
            </Button>
            <Button icon={<RedoOutlined />} onClick={handleRedo}>
              重做
            </Button>
          </Space>
        </div>

        <Row gutter={16} style={{ height: 'calc(100vh - 120px)' }}>
          {/* 左侧元素工具栏 */}
          <Col span={4}>
            <ElementPalette
              onAddElement={handleAddElement}
              entityType={template?.entityType}
            />
          </Col>

          {/* 中间画布区域 */}
          <Col span={14}>
            <TemplateCanvas
              template={template}
              selectedElement={selectedElement}
              sampleData={sampleData}
              onSelectElement={setSelectedElement}
              onUpdateElement={handleUpdateElement}
              onDeleteElement={handleDeleteElement}
              onUpdateTemplate={setTemplate}
            />
          </Col>

          {/* 右侧属性面板 */}
          <Col span={6}>
            <ElementProperties
              element={selectedElement ? template?.elements.find(el => el.id === selectedElement) : null}
              entityFields={entityFields}
              sampleData={sampleData}
              onUpdateElement={handleUpdateElement}
              templateId={template?.id}
            />
          </Col>
        </Row>
      </div>
    </MainLayout>
  );
}
```

### 2. TemplateCanvas (画布组件)

```typescript
// components/printTemps/TemplateCanvas.tsx
interface TemplateCanvasProps {
  template: iPrintTemp | null;
  selectedElement: string | null;
  sampleData: any;
  onSelectElement: (elementId: string) => void;
  onUpdateElement: (elementId: string, updates: Partial<iPrintTempElement>) => void;
  onDeleteElement: (elementId: string) => void;
  onUpdateTemplate?: (template: iPrintTemp) => void;
}

export function TemplateCanvas({
  template,
  selectedElement,
  sampleData,
  onSelectElement,
  onUpdateElement,
  onDeleteElement,
  onUpdateTemplate
}: TemplateCanvasProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  
  // 尺寸转换工具 (mm to px)
  const mmToPx = useCallback((mm: number) => mm * 3.78, []);
  
  // 画布样式
  const canvasStyle: React.CSSProperties = useMemo(() => {
    if (!template) return {};
    
    return {
      width: `${mmToPx(template.size.width)}px`,
      height: `${mmToPx(template.size.height)}px`,
      border: '1px solid #ccc',
      position: 'relative',
      backgroundColor: 'white',
      cursor: isDragging ? 'grabbing' : 'grab',
      margin: '0 auto'
    };
  }, [template, mmToPx, isDragging]);
  
  // 处理元素拖拽
  const handleElementMouseDown = useCallback((e: React.MouseEvent, elementId: string) => {
    e.stopPropagation();
    onSelectElement(elementId);
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  }, [onSelectElement]);
  
  // 处理元素移动
  const handleElementMouseMove = useCallback((e: React.MouseEvent, elementId: string) => {
    if (!isDragging || !dragStart || !template) return;
    
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    const element = template.elements.find(el => el.id === elementId);
    if (!element) return;
    
    const newX = element.position.x + (deltaX / mmToPx(1));
    const newY = element.position.y + (deltaY / mmToPx(1));
    
    onUpdateElement(elementId, {
      position: { x: Math.max(0, newX), y: Math.max(0, newY) }
    });
    
    setDragStart({ x: e.clientX, y: e.clientY });
  }, [isDragging, dragStart, template, mmToPx, onUpdateElement]);
  
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragStart(null);
  }, []);
  
  if (!template) {
    return (
      <div className="canvas-container">
        <div className="canvas-placeholder">
          请选择或创建模板
        </div>
      </div>
    );
  }
  
  return (
    <div className="canvas-container">
      <div
        className="canvas"
        style={canvasStyle}
        onMouseUp={handleMouseUp}
      >
        {template.elements.map(element => (
          <div
            key={element.id}
            className={`element ${selectedElement === element.id ? 'selected' : ''}`}
            style={{
              position: 'absolute',
              left: `${mmToPx(element.position.x)}px`,
              top: `${mmToPx(element.position.y)}px`,
              width: `${mmToPx(element.size.width)}px`,
              height: `${mmToPx(element.size.height)}px`,
              border: selectedElement === element.id ? '2px solid #1890ff' : '1px solid transparent',
              cursor: 'pointer',
              zIndex: element.zIndex,
              ...element.styles
            }}
            onMouseDown={(e) => handleElementMouseDown(e, element.id)}
            onMouseMove={(e) => handleElementMouseMove(e, element.id)}
          >
            {/* 元素内容渲染 */}
            <ElementContent
              element={element}
              sampleData={sampleData}
            />
          </div>
        ))}
      </div>
      
      <div className="canvas-info">
        {template.size.width}mm × {template.size.height}mm
      </div>
    </div>
  );
}
```

### 3. ElementPalette (元素工具栏)

```typescript
// components/printTemps/ElementPalette.tsx
interface ElementPaletteProps {
  onAddElement: (elementType: epPrintTempElementType) => void;
  entityType?: epEntityType;
}

export function ElementPalette({ onAddElement, entityType }: ElementPaletteProps) {
  const elementTypes = [
    { type: 'text', label: '文本', icon: '📝' },
    { type: 'barcode', label: '条形码', icon: '📊' },
    { type: 'image', label: '图片', icon: '🖼️' },
    { type: 'shape', label: '形状', icon: '🔷' }
  ];

  return (
    <Card title="元素工具栏" size="small">
      <div className="element-palette">
        {elementTypes.map(({ type, label, icon }) => (
          <Button
            key={type}
            type="dashed"
            block
            style={{ marginBottom: 8 }}
            onClick={() => onAddElement(type as epPrintTempElementType)}
            icon={<span>{icon}</span>}
          >
            {label}
          </Button>
        ))}
      </div>
    </Card>
  );
}
```

### 4. ElementProperties (元素属性面板)

```typescript
// components/printTemps/ElementProperties.tsx
interface ElementPropertiesProps {
  element: iPrintTempElement | null;
  entityFields: iEntityField[];
  sampleData: any;
  onUpdateElement: (elementId: string, updates: Partial<iPrintTempElement>) => void;
  templateId?: string;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export function ElementProperties({ 
  element, 
  entityFields, 
  sampleData, 
  onUpdateElement,
  templateId,
  activeTab: externalActiveTab,
  onTabChange
}: ElementPropertiesProps) {
  const [activeTab, setActiveTab] = useState('data');

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  if (!element) {
    return (
      <Card title="元素属性" size="small">
        <Empty description="请选择一个元素" />
      </Card>
    );
  }

  return (
    <Card title="元素属性" size="small">
      <Tabs
        activeKey={externalActiveTab || activeTab}
        onChange={handleTabChange}
        items={[
          {
            key: 'data',
            label: '数据绑定',
            children: (
              <DataBindingEditor
                element={element}
                entityFields={entityFields}
                onUpdateElement={onUpdateElement}
              />
            )
          },
          {
            key: 'style',
            label: '样式设置',
            children: (
              <StyleEditor
                element={element}
                onUpdateElement={onUpdateElement}
              />
            )
          },
          {
            key: 'layout',
            label: '布局设置',
            children: (
              <LayoutEditor
                element={element}
                onUpdateElement={onUpdateElement}
              />
            )
          }
        ]}
      />
    </Card>
  );
}
```

### 5. TemplateBatchPrinter (通用批量打印组件)

```typescript
// componentsPrint/TemplateBatchPrinter.tsx
interface iPrintItem<T> {
  item: T;                                    // 原始实体对象
  quantity: number;
  selected?: boolean;                         // 仅用于 printItems
  sourceIndex?: number;                       // printItemsSource 中的索引
  id: string;                                 // 显示用的ID
  name: iMultilingualContent | string;        // 显示用的名称
}

interface iTemplateBatchPrinterProps<T> {
  visible: boolean;
  onClose: () => void;
  printItemsSource: iPrintItem<T>[];
  entityType: epEntityType;
}

export function TemplateBatchPrinter<T>({
  visible,
  onClose,
  printItemsSource,
  entityType
}: iTemplateBatchPrinterProps<T>) {
  const [printItems, setPrintItems] = useState<iPrintItem<T>[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<iPrintTemp | null>(null);
  const [labelLanguage, setLabelLanguage] = useState<string>('zh_cn');
  const [startDate, setStartDate] = useState<dayjs.Dayjs>(dayjs());

  // 初始化打印项目
  React.useEffect(() => {
    if (visible && printItemsSource.length > 0) {
      const items: iPrintItem<T>[] = printItemsSource.map((printItem, index) => ({
        item: printItem.item,
        quantity: printItem.quantity,
        sourceIndex: index,
        id: printItem.id,
        name: printItem.name,
        selected: true // 默认全选
      }));
      setPrintItems(items);
    }
  }, [visible, printItemsSource]);

  // 处理选择变化
  const handleSelectChange = useCallback((sourceIndex: number, checked: boolean) => {
    setPrintItems(prev => prev.map(item => 
      item.sourceIndex === sourceIndex 
        ? { ...item, selected: checked }
        : item
    ));
  }, []);

  // 处理数量变化
  const handleQuantityChange = useCallback((sourceIndex: number, quantity: number) => {
    setPrintItems(prev => prev.map(item => 
      item.sourceIndex === sourceIndex 
        ? { ...item, quantity }
        : item
    ));
  }, []);

  // 重置所有项目
  const handleReset = useCallback(() => {
    setPrintItems(prev => prev.map(item => ({
      item: item.item,
      quantity: printItemsSource[item.sourceIndex!]?.quantity || item.quantity,
      sourceIndex: item.sourceIndex,
      id: item.id,
      name: item.name,
      selected: true
    })));
  }, [printItemsSource]);

  // 批量打印
  const handleBatchPrint = useCallback(async () => {
    const selectedItems = printItems.filter(item => item.selected);
    
    if (selectedItems.length === 0) {
      message.warning('请至少选择一个项目进行打印');
      return;
    }

    if (!selectedTemplate) {
      message.warning('请先选择一个打印模板');
      return;
    }

    // 生成打印页面
    const printPages: { [key: string]: T }[] = [];
    selectedItems.forEach(item => {
      for (let i = 0; i < item.quantity; i++) {
        printPages.push({
          [entityType.toLowerCase()]: item.item
        });
      }
    });

    // 执行打印
    await printAllLabels(printPages);
  }, [printItems, selectedTemplate, entityType]);

  // 表格列定义
  const columns = [
    {
      title: '选择',
      key: 'selected',
      width: 60,
      render: (record: iPrintItem<T>) => (
        <Checkbox
          checked={record.selected}
          onChange={(e) => handleSelectChange(record.sourceIndex!, e.target.checked)}
        />
      ),
    },
    {
      title: '实体名称',
      key: 'entityName',
      render: (record: iPrintItem<T>) => (
        <span>
          {typeof record.name === 'string' 
            ? record.name 
            : multilingualUtil.getLocalizedText(record.name, language, ['zh_cn', 'en'])
          }
        </span>
      ),
    },
    {
      title: '数量',
      key: 'quantity',
      width: 100,
      render: (record: iPrintItem<T>) => (
        <InputNumber
          min={1}
          max={999}
          value={record.quantity}
          onChange={(value) => handleQuantityChange(record.sourceIndex!, value || 1)}
          style={{ width: '100%' }}
        />
      ),
    },
  ];

  return (
    <Modal
      title="批量打印标签"
      open={visible}
      onCancel={onClose}
      width={1200}
      footer={[
        <Button key="reset" icon={<ReloadOutlined />} onClick={handleReset}>
          重置
        </Button>,
        <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={handleBatchPrint}>
          批量打印
        </Button>,
      ]}
    >
      <Tabs
        items={[
          {
            key: 'config',
            label: '配置选项',
            children: (
              <>
                <Table
                  columns={columns}
                  dataSource={printItems}
                  rowKey={(record) => record.sourceIndex!}
                  pagination={false}
                  size="small"
                />
                
                {/* 配置选项 */}
                <Row gutter={16} style={{ marginTop: 16 }}>
                  <Col span={12}>
                    <Select
                      value={labelLanguage}
                      onChange={setLabelLanguage}
                      style={{ width: '100%' }}
                    >
                      <Select.Option value="zh_cn">简体中文</Select.Option>
                      <Select.Option value="en">English</Select.Option>
                    </Select>
                  </Col>
                  <Col span={12}>
                    <DatePicker
                      value={startDate}
                      onChange={(date) => setStartDate(date || dayjs())}
                      style={{ width: '100%' }}
                      format="YYYY-MM-DD"
                    />
                  </Col>
                </Row>
              </>
            )
          },
          {
            key: 'template',
            label: '选择模板',
            children: (
              <TemplatePreviewSelector
                entityType={entityType}
                sampleData={printItemsSource[0]?.item || null}
                language={labelLanguage}
                selectedTemplateId={selectedTemplate?.id}
                onTemplateSelect={setSelectedTemplate}
                visible={true}
              />
            )
          }
        ]}
      />
    </Modal>
  );
}
```

### 6. TemplatePreviewSelector (模板预览选择器)

```typescript
// components/printTemps/TemplatePreviewSelector.tsx
interface TemplatePreviewSelectorProps {
  entityType?: epEntityType;
  sampleData?: any;
  language?: string;
  selectedTemplateId?: string;
  onTemplateSelect: (template: iPrintTemp) => void;
  visible?: boolean;
  onClose?: () => void;
}

export function TemplatePreviewSelector({
  entityType,
  sampleData,
  language,
  selectedTemplateId,
  onTemplateSelect,
  visible = true,
  onClose
}: TemplatePreviewSelectorProps) {
  const [templates, setTemplates] = useState<iPrintTemp[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    size: 12,
    total: 0,
    totalPages: 0
  });
  const [filters, setFilters] = useState({
    category: undefined as epPrintTempCategory | undefined,
    keyword: '',
    status: 'active' as 'active' | 'inactive'
  });

  // 加载模板列表
  const loadTemplates = useCallback(async (page = 1, reset = false) => {
    try {
      setLoading(true);

      const params: iPrintTempQueryParams = {
        entityType,
        category: filters.category,
        status: filters.status,
        keyword: filters.keyword || undefined,
        page,
        size: pagination.size,
        sortBy: 'created_at',
        sortOrder: 'desc'
      };

      const response: iPrintTempListResponse = await printTempApi.getPrintTemps(params);
      
      if (reset) {
        setTemplates(response.items);
      } else {
        setTemplates(prev => [...prev, ...response.items]);
      }
      
      setPagination(response.pagination);
    } catch (error) {
      console.error('加载模板列表失败:', error);
      message.error('加载模板失败');
    } finally {
      setLoading(false);
    }
  }, [entityType, filters, pagination.size]);

  // 模板预览卡片
  const TemplatePreviewCard: React.FC<{ template: iPrintTemp }> = ({ template }) => {
    const [previewHtml, setPreviewHtml] = useState<string>('');
    const [previewLoading, setPreviewLoading] = useState(false);

    useEffect(() => {
      if (sampleData) {
        setPreviewLoading(true);
        try {
          const rendered = frontendTemplateRenderer.renderTemplate(template, sampleData, language);
          setPreviewHtml(rendered.html);
        } catch (error) {
          console.error('模板预览失败:', error);
        } finally {
          setPreviewLoading(false);
        }
      }
    }, [template, sampleData, language]);

    return (
      <Card
        hoverable
        size="small"
        className={`template-preview-card ${selectedTemplateId === template.id ? 'selected' : ''}`}
        onClick={() => onTemplateSelect(template)}
        actions={[
          <EyeOutlined key="preview" title="预览" />,
          <CheckOutlined key="select" title="选择" />
        ]}
      >
        <div className="template-preview">
          <div className="template-info">
            <div className="template-name">{template.name}</div>
            <div className="template-category">
              <Tag color="blue">{printTempCategoryNames[template.category]}</Tag>
            </div>
            <div className="template-size">
              {template.size.width}mm × {template.size.height}mm
            </div>
          </div>
          
          <div className="template-preview-content">
            {previewLoading ? (
              <Spin size="small" />
            ) : (
              <div 
                className="preview-html"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
                style={{
                  transform: 'scale(0.3)',
                  transformOrigin: 'top left',
                  width: '333%',
                  height: '333%'
                }}
              />
            )}
          </div>
        </div>
      </Card>
    );
  };

  return (
    <Modal
      title="选择打印模板"
      open={visible}
      onCancel={onClose}
      width={1200}
      footer={null}
    >
      <div className="template-selector">
        {/* 筛选器 */}
        <div className="template-filters">
          <Space wrap>
            <Select
              placeholder="选择分类"
              value={filters.category}
              onChange={(value) => setFilters(prev => ({ ...prev, category: value }))}
              allowClear
              style={{ width: 150 }}
            >
              {Object.entries(printTempCategoryNames).map(([key, label]) => (
                <Option key={key} value={key}>{label}</Option>
              ))}
            </Select>
            
            <Search
              placeholder="搜索模板"
              value={filters.keyword}
              onChange={(e) => setFilters(prev => ({ ...prev, keyword: e.target.value }))}
              onSearch={() => loadTemplates(1, true)}
              style={{ width: 200 }}
            />
            
            <Button 
              icon={<ReloadOutlined />} 
              onClick={() => loadTemplates(1, true)}
            >
              刷新
            </Button>
          </Space>
        </div>

        {/* 模板列表 */}
        <div className="template-list">
          <Row gutter={[16, 16]}>
            {templates.map(template => (
              <Col key={template.id} span={6}>
                <TemplatePreviewCard template={template} />
              </Col>
            ))}
          </Row>
          
          {loading && (
            <div className="loading-container">
              <Spin size="large" />
            </div>
          )}
          
          {!loading && templates.length === 0 && (
            <Empty description="暂无模板" />
          )}
        </div>
      </div>
    </Modal>
  );
}
```

### 5. StyleEditor (样式编辑器)

```typescript
// components/printTemps/editors/StyleEditor.tsx
interface iStyleEditorProps {
  element: iPrintTempElement | null;
  onUpdate: (updates: Partial<iPrintTempElement>) => void;
}

const StyleEditor: React.FC<iStyleEditorProps> = ({
  element,
  onUpdate
}) => {
  const [fontFamily, setFontFamily] = useState('Arial');
  const [fontSize, setFontSize] = useState(12);
  const [color, setColor] = useState('#000000');
  
  // 字体选项
  const fontOptions = [
    { value: 'Arial', label: 'Arial' },
    { value: 'Bahnschrift SemiBold Condensed', label: 'Bahnschrift SemiBold Condensed' },
    { value: 'Helvetica', label: 'Helvetica' },
    { value: 'Times New Roman', label: 'Times New Roman' },
    { value: 'Courier New', label: 'Courier New' }
  ];
  
  // 处理样式更新
  const handleStyleUpdate = useCallback((styleKey: string, value: any) => {
    if (!element) return;
    
    onUpdate({
      styles: {
        ...element.styles,
        [styleKey]: value
      }
    });
  }, [element, onUpdate]);
  
  if (!element) {
    return (
      <div className="style-editor">
        <div className="no-selection">请选择一个元素</div>
      </div>
    );
  }
  
  return (
    <div className="style-editor">
      <Form layout="vertical">
        {/* 字体设置 */}
        <Form.Item label="字体">
          <Select
            value={element.styles.fontFamily}
            onChange={(value) => handleStyleUpdate('fontFamily', value)}
            options={fontOptions}
          />
        </Form.Item>
        
        <Form.Item label="字体大小">
          <InputNumber
            value={element.styles.fontSize}
            onChange={(value) => handleStyleUpdate('fontSize', value)}
            min={6}
            max={72}
            addonAfter="px"
          />
        </Form.Item>
        
        <Form.Item label="字体粗细">
          <Select
            value={element.styles.fontWeight}
            onChange={(value) => handleStyleUpdate('fontWeight', value)}
            options={[
              { value: 'normal', label: '正常' },
              { value: 'bold', label: '粗体' },
              { value: 'lighter', label: '细体' },
              { value: 'bolder', label: '更粗' }
            ]}
          />
        </Form.Item>
        
        <Form.Item label="字体样式">
          <Checkbox.Group
            value={[
              element.styles.fontStyle === 'italic' ? 'italic' : null,
              element.styles.textDecoration === 'underline' ? 'underline' : null
            ].filter(Boolean)}
            onChange={(values) => {
              handleStyleUpdate('fontStyle', values.includes('italic') ? 'italic' : 'normal');
              handleStyleUpdate('textDecoration', values.includes('underline') ? 'underline' : 'none');
            }}
          >
            <Checkbox value="italic">斜体</Checkbox>
            <Checkbox value="underline">下划线</Checkbox>
          </Checkbox.Group>
        </Form.Item>
        
        {/* 颜色设置 */}
        <Form.Item label="文字颜色">
          <ColorPicker
            value={element.styles.color}
            onChange={(color) => handleStyleUpdate('color', color.toHexString())}
          />
        </Form.Item>
        
        <Form.Item label="背景颜色">
          <ColorPicker
            value={element.styles.backgroundColor}
            onChange={(color) => handleStyleUpdate('backgroundColor', color.toHexString())}
          />
        </Form.Item>
        
        {/* 对齐设置 */}
        <Form.Item label="水平对齐">
          <Radio.Group
            value={element.styles.textAlign}
            onChange={(e) => handleStyleUpdate('textAlign', e.target.value)}
          >
            <Radio value="left">左对齐</Radio>
            <Radio value="center">居中</Radio>
            <Radio value="right">右对齐</Radio>
            <Radio value="justify">两端对齐</Radio>
          </Radio.Group>
        </Form.Item>
        
        <Form.Item label="垂直对齐">
          <Radio.Group
            value={element.styles.verticalAlign}
            onChange={(e) => handleStyleUpdate('verticalAlign', e.target.value)}
          >
            <Radio value="top">顶部</Radio>
            <Radio value="middle">居中</Radio>
            <Radio value="bottom">底部</Radio>
          </Radio.Group>
        </Form.Item>
        
        {/* 间距设置 */}
        <Form.Item label="行高">
          <InputNumber
            value={element.styles.lineHeight}
            onChange={(value) => handleStyleUpdate('lineHeight', value)}
            min={0.5}
            max={3}
            step={0.1}
          />
        </Form.Item>
        
        <Form.Item label="字间距">
          <InputNumber
            value={element.styles.letterSpacing}
            onChange={(value) => handleStyleUpdate('letterSpacing', value)}
            min={-2}
            max={10}
            addonAfter="px"
          />
        </Form.Item>
        
        <Form.Item label="词间距">
          <InputNumber
            value={element.styles.wordSpacing}
            onChange={(value) => handleStyleUpdate('wordSpacing', value)}
            min={-2}
            max={10}
            addonAfter="px"
          />
        </Form.Item>
      </Form>
    </div>
  );
};
```

## 🔧 工具函数和Hooks

### 1. usePrintTempEditor Hook

```typescript
// hooks/printTemps/usePrintTempEditor.ts
interface iUsePrintTempEditorProps {
  printTempId?: string;
  entityType: epEntityType;
  onPrintTempChange: (printTemp: iPrintTemp) => void;
  onDirtyChange: (isDirty: boolean) => void;
}

export const usePrintTempEditor = ({
  printTempId,
  entityType,
  onPrintTempChange,
  onDirtyChange
}: iUsePrintTempEditorProps) => {
  const [printTemp, setPrintTemp] = useState<iPrintTemp | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  
  // 加载模板
  const loadPrintTemp = useCallback(async () => {
    if (!printTempId) return;
    
    setIsLoading(true);
    try {
      const response = await api.getPrintTemp(printTempId);
      setPrintTemp(response.data);
      onPrintTempChange(response.data);
    } catch (error) {
      console.error('Failed to load print temp:', error);
    } finally {
      setIsLoading(false);
    }
  }, [printTempId, onPrintTempChange]);
  
  // 创建新模板
  const createNewPrintTemp = useCallback(() => {
    const newPrintTemp: iPrintTemp = {
      id: generateId(),
      name: '新模板',
      description: '',
      category: 'custom_label',
      entityType,
      size: { width: 40, height: 30 },
      elements: [],
      requiredFields: [],
      optionalFields: [],
      version: 1,
      isActive: true,
      createdBy: getCurrentUserId(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    setPrintTemp(newPrintTemp);
    onPrintTempChange(newPrintTemp);
    setIsDirty(true);
  }, [entityType, onPrintTempChange]);
  
  // 添加元素
  const addElement = useCallback((elementType: epPrintTempElementType) => {
    if (!printTemp) return;
    
    const newElement: iPrintTempElement = {
      id: generateId(),
      type: elementType,
      position: { x: 10, y: 10 },
      size: { width: 20, height: 10 },
      dataBinding: { type: 'fixed', value: '' },
      styles: getDefaultElementStyles(elementType),
      zIndex: printTemp.elements.length + 1
    };
    
    const updatedPrintTemp = {
      ...printTemp,
      elements: [...printTemp.elements, newElement]
    };
    
    setPrintTemp(updatedPrintTemp);
    onPrintTempChange(updatedPrintTemp);
    setIsDirty(true);
  }, [printTemp, onPrintTempChange]);
  
  // 删除元素
  const removeElement = useCallback((elementId: string) => {
    if (!printTemp) return;
    
    const updatedPrintTemp = {
      ...printTemp,
      elements: printTemp.elements.filter(el => el.id !== elementId)
    };
    
    setPrintTemp(updatedPrintTemp);
    onPrintTempChange(updatedPrintTemp);
    setIsDirty(true);
  }, [printTemp, onPrintTempChange]);
  
  // 更新元素
  const updateElement = useCallback((elementId: string, updates: Partial<iPrintTempElement>) => {
    if (!printTemp) return;
    
    const updatedPrintTemp = {
      ...printTemp,
      elements: printTemp.elements.map(el => 
        el.id === elementId ? { ...el, ...updates } : el
      )
    };
    
    setPrintTemp(updatedPrintTemp);
    onPrintTempChange(updatedPrintTemp);
    setIsDirty(true);
  }, [printTemp, onPrintTempChange]);
  
  // 保存模板
  const savePrintTemp = useCallback(async () => {
    if (!printTemp) return;
    
    try {
      if (printTempId) {
        await api.updatePrintTemp(printTempId, printTemp);
      } else {
        await api.createPrintTemp(printTemp);
      }
      setIsDirty(false);
    } catch (error) {
      console.error('Failed to save print temp:', error);
      throw error;
    }
  }, [printTemp, printTempId]);
  
  useEffect(() => {
    if (printTempId) {
      loadPrintTemp();
    } else {
      createNewPrintTemp();
    }
  }, [printTempId, loadPrintTemp, createNewPrintTemp]);
  
  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);
  
  return {
    printTemp,
    isLoading,
    isDirty,
    addElement,
    removeElement,
    updateElement,
    savePrintTemp
  };
};
```

### 2. useDataBinding Hook

```typescript
// hooks/printTemps/useDataBinding.ts
export const useDataBinding = () => {
  // 数据绑定引擎
  const dataBindingEngine = useMemo(() => new DataBindingEngine(), []);
  
  // 绑定数据
  const bindData = useCallback((
    element: iPrintTempElement,
    data: any,
    language: string = 'zh_cn'
  ): string => {
    return dataBindingEngine.bindData(element, data, language);
  }, [dataBindingEngine]);
  
  // 验证绑定配置
  const validateBinding = useCallback((
    binding: iPrintTempDataBinding,
    entityType: epEntityType
  ): { isValid: boolean; errors: string[] } => {
    return dataBindingEngine.validateBinding(binding, entityType);
  }, [dataBindingEngine]);
  
  // 获取绑定预览
  const getBindingPreview = useCallback((
    element: iPrintTempElement,
    sampleData: any,
    language: string = 'zh_cn'
  ): string => {
    return dataBindingEngine.getPreview(element, sampleData, language);
  }, [dataBindingEngine]);
  
  return {
    bindData,
    validateBinding,
    getBindingPreview
  };
};
```

### 3. 模板渲染器

```typescript
// utils/printTemps/templateRenderer.ts
export class TemplateRenderer {
  // 渲染模板
  renderTemplate(
    template: iPrintTemp,
    data: any,
    language: string = 'zh_cn'
  ): { html: string; css: string } {
    const css = this.generateCSS(template);
    const html = this.generateHTML(template, data, language);
    
    return { html, css };
  }
  
  // 生成CSS
  private generateCSS(template: iPrintTemp): string {
    const css = `
      .print-temp {
        width: ${template.size.width / 10}cm;
        height: ${template.size.height / 10}cm;
        position: relative;
        background: white;
        overflow: hidden;
        font-family: Arial, sans-serif;
      }
      
      .print-temp-element {
        position: absolute;
        box-sizing: border-box;
      }
      
      ${template.elements.map(element => this.generateElementCSS(element)).join('\n')}
    `;
    
    return css;
  }
  
  // 生成HTML
  private generateHTML(
    template: iPrintTemp,
    data: any,
    language: string
  ): string {
    const elementsHtml = template.elements
      .sort((a, b) => a.zIndex - b.zIndex)
      .map(element => this.generateElementHTML(element, data, language))
      .join('\n');
    
    return `
      <div class="print-temp">
        ${elementsHtml}
      </div>
    `;
  }
  
  // 生成元素CSS
  private generateElementCSS(element: iPrintTempElement): string {
    const { position, size, styles } = element;
    
    return `
      .element-${element.id} {
        left: ${position.x / 10}cm;
        top: ${position.y / 10}cm;
        width: ${size.width / 10}cm;
        height: ${size.height / 10}cm;
        font-family: ${styles.fontFamily};
        font-size: ${styles.fontSize}px;
        font-weight: ${styles.fontWeight};
        font-style: ${styles.fontStyle};
        text-align: ${styles.textAlign};
        vertical-align: ${styles.verticalAlign};
        line-height: ${styles.lineHeight};
        letter-spacing: ${styles.letterSpacing}px;
        word-spacing: ${styles.wordSpacing}px;
        color: ${styles.color};
        background-color: ${styles.backgroundColor};
        text-decoration: ${styles.textDecoration};
        text-shadow: ${styles.textShadow};
        padding: ${styles.padding.top / 10}cm ${styles.padding.right / 10}cm ${styles.padding.bottom / 10}cm ${styles.padding.left / 10}cm;
        margin: ${styles.margin.top / 10}cm ${styles.margin.right / 10}cm ${styles.margin.bottom / 10}cm ${styles.margin.left / 10}cm;
      }
    `;
  }
  
  // 生成元素HTML
  private generateElementHTML(
    element: iPrintTempElement,
    data: any,
    language: string
  ): string {
    const content = this.bindElementData(element, data, language);
    
    return `
      <div class="print-temp-element element-${element.id}">
        ${content}
      </div>
    `;
  }
  
  // 绑定元素数据
  private bindElementData(
    element: iPrintTempElement,
    data: any,
    language: string
  ): string {
    const { dataBinding } = element;
    
    switch (dataBinding.type) {
      case 'fixed':
        return dataBinding.value || '';
      case 'entity':
        return this.resolveEntityPath(dataBinding.entityPath || '', data, language);
      case 'date':
        return this.formatDate(dataBinding.dateTimeConfig, data);
      case 'time':
        return this.formatTime(dataBinding.dateTimeConfig, data);
      case 'calculated':
        return this.calculateValue(dataBinding.calculation, data);
      default:
        return '';
    }
  }
  
  // 解析实体路径
  private resolveEntityPath(path: string, data: any, language: string): string {
    const value = get(data, path);
    
    if (value && typeof value === 'object' && value.intl) {
      return value[language] || value.zh_cn || value.en || '';
    }
    
    return String(value || '');
  }
  
  // 格式化日期
  private formatDate(config: iPrintTempDateTimeConfig | undefined, data: any): string {
    if (!config) return '';
    
    let baseDate: Date;
    
    if (config.baseType === 'now') {
      baseDate = new Date();
    } else if (config.baseField) {
      const fieldValue = get(data, config.baseField);
      baseDate = new Date(fieldValue);
    } else {
      baseDate = new Date();
    }
    
    // 应用偏移
    if (config.shiftConfig) {
      const { shiftDays = 0, shiftHours = 0, shiftMinutes = 0 } = config.shiftConfig;
      baseDate.setDate(baseDate.getDate() + shiftDays);
      baseDate.setHours(baseDate.getHours() + shiftHours);
      baseDate.setMinutes(baseDate.getMinutes() + shiftMinutes);
    }
    
    return dayjs(baseDate).format(config.format);
  }
  
  // 格式化时间
  private formatTime(config: iPrintTempDateTimeConfig | undefined, data: any): string {
    if (!config) return '';
    
    let baseTime: Date;
    
    if (config.baseType === 'now') {
      baseTime = new Date();
    } else if (config.baseField) {
      const fieldValue = get(data, config.baseField);
      baseTime = new Date(fieldValue);
    } else {
      baseTime = new Date();
    }
    
    // 应用偏移
    if (config.shiftConfig) {
      const { shiftHours = 0, shiftMinutes = 0, shiftSeconds = 0 } = config.shiftConfig;
      baseTime.setHours(baseTime.getHours() + shiftHours);
      baseTime.setMinutes(baseTime.getMinutes() + shiftMinutes);
      baseTime.setSeconds(baseTime.getSeconds() + shiftSeconds);
    }
    
    return dayjs(baseTime).format(config.format);
  }
  
  // 计算值
  private calculateValue(calculation: iPrintTempCalculation | undefined, data: any): string {
    if (!calculation) return '';
    
    switch (calculation.type) {
      case 'date_shift':
        return this.formatDate({
          baseType: 'entity_field',
          baseField: calculation.baseField,
          format: 'YYYY-MM-DD',
          shiftConfig: {
            shiftDays: calculation.shiftDays || 0
          }
        }, data);
      case 'time_shift':
        return this.formatTime({
          baseType: 'entity_field',
          baseField: calculation.baseField,
          format: 'HH:mm:ss',
          shiftConfig: {
            shiftHours: calculation.shiftHours || 0,
            shiftMinutes: calculation.shiftMinutes || 0
          }
        }, data);
      case 'formula':
        return this.evaluateFormula(calculation.formula || '', data);
      default:
        return '';
    }
  }
  
  // 计算公式
  private evaluateFormula(formula: string, data: any): string {
    try {
      // 简单的公式计算，实际项目中需要更安全的实现
      const result = eval(formula.replace(/\{(\w+)\}/g, (match, key) => {
        const value = get(data, key);
        return typeof value === 'number' ? value : 0;
      }));
      return String(result);
    } catch (error) {
      console.error('Formula evaluation error:', error);
      return '';
    }
  }
}
```

## 🎯 组件通信

### 1. 状态管理
```typescript
// stores/printTempsStore.ts
interface iPrintTempsState {
  printTemps: iPrintTemp[];
  currentPrintTemp: iPrintTemp | null;
  selectedElement: string | null;
  previewData: any;
  isLoading: boolean;
  error: string | null;
}

export const usePrintTempsStore = create<iPrintTempsState>((set, get) => ({
  printTemps: [],
  currentPrintTemp: null,
  selectedElement: null,
  previewData: null,
  isLoading: false,
  error: null,
  
  // Actions
  setCurrentPrintTemp: (printTemp: iPrintTemp | null) => 
    set({ currentPrintTemp: printTemp }),
  
  setSelectedElement: (elementId: string | null) => 
    set({ selectedElement: elementId }),
  
  setPreviewData: (data: any) => 
    set({ previewData: data }),
  
  updateElement: (elementId: string, updates: Partial<iPrintTempElement>) => {
    const state = get();
    if (!state.currentPrintTemp) return;
    
    const updatedPrintTemp = {
      ...state.currentPrintTemp,
      elements: state.currentPrintTemp.elements.map(el => 
        el.id === elementId ? { ...el, ...updates } : el
      )
    };
    
    set({ currentPrintTemp: updatedPrintTemp });
  }
}));
```

### 2. 事件系统
```typescript
// utils/printTemps/eventBus.ts
class PrintTempsEventBus {
  private events: Map<string, Function[]> = new Map();
  
  on(event: string, callback: Function) {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(callback);
  }
  
  off(event: string, callback: Function) {
    if (!this.events.has(event)) return;
    
    const callbacks = this.events.get(event)!;
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }
  
  emit(event: string, ...args: any[]) {
    if (!this.events.has(event)) return;
    
    this.events.get(event)!.forEach(callback => {
      callback(...args);
    });
  }
}

export const printTempsEventBus = new PrintTempsEventBus();
```

## 🔧 性能优化

### 1. 组件优化
```typescript
// 使用 React.memo 优化组件
export const ElementRenderer = React.memo<iElementRendererProps>(({
  element,
  previewData,
  isSelected,
  onSelect,
  onUpdate,
  mmToPx
}) => {
  // 组件实现
});

// 使用 useMemo 优化计算
const elementStyle = useMemo(() => {
  return {
    position: 'absolute',
    left: `${mmToPx(element.position.x)}px`,
    top: `${mmToPx(element.position.y)}px`,
    // ... 其他样式
  };
}, [element.position, element.size, mmToPx]);

// 使用 useCallback 优化函数
const handleElementUpdate = useCallback((elementId: string, updates: Partial<iPrintTempElement>) => {
  // 更新逻辑
}, []);
```

### 2. 渲染优化
```typescript
// 虚拟化长列表
import { FixedSizeList as List } from 'react-window';

const VirtualizedPrintTempList = ({ printTemps }: { printTemps: iPrintTemp[] }) => {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style}>
      <PrintTempCard printTemp={printTemps[index]} />
    </div>
  );
  
  return (
    <List
      height={600}
      itemCount={printTemps.length}
      itemSize={120}
    >
      {Row}
    </List>
  );
};
```

### 3. 内存管理
```typescript
// 清理事件监听器
useEffect(() => {
  const handleElementSelect = (elementId: string) => {
    setSelectedElement(elementId);
  };
  
  printTempsEventBus.on('element:select', handleElementSelect);
  
  return () => {
    printTempsEventBus.off('element:select', handleElementSelect);
  };
}, []);
```

## 🔄 组件重构说明

### ProductLabelPrinter → TemplateBatchPrinter

**重构目标**: 将产品专用的打印组件重构为通用的批量打印组件

**主要变化**:
1. **组件重命名**: `ProductLabelPrinter` → `TemplateBatchPrinter`
2. **泛型化**: 使用 `<T>` 泛型支持所有实体类型
3. **接口重构**: 
   - `iProductLabelPrinterProps` → `iTemplateBatchPrinterProps<T>`
   - `iPrintProductItem` → `iPrintItem<T>`
4. **数据源优化**: 
   - `invoiceItems` → `printItemsSource`
   - 移除 `products` 属性，数据包含在 `printItemsSource` 中
5. **显示逻辑解耦**: 在 `iPrintItem<T>` 中设置 `id` 和 `name` 字段
6. **移除API调用**: 不再调用 `productApi`，由调用方提供完整数据

**重构优势**:
- **通用性**: 支持所有实体类型，不再局限于产品
- **解耦**: 显示逻辑与实体类型解耦，调用方完全控制
- **性能**: 移除不必要的API调用，提升性能
- **维护性**: 单一组件处理所有批量打印需求

---

**文档版本**: v1.1  
**创建日期**: 2024-01-20  
**最后更新**: 2024-01-20  
**维护者**: 前端团队


