# 发货单结算功能实施指南

## 项目概述

基于现有合作伙伴发货单系统，新增发货单结算功能，用于生成和管理合作伙伴的结算记录，支持PDF生成和动态布局。

## 技术架构

### 后端架构
- **Entity**: TypeORM实体定义
- **Repository**: 数据访问层
- **Service**: 业务逻辑层
- **Controller**: API控制器层
- **PDF Generator**: PDF生成服务

### 前端架构
- **Context**: 状态管理
- **Components**: 可复用组件
- **Pages**: 页面组件
- **Utils**: 工具函数

## 实施计划

### 阶段1: 数据库设计 (预计30分钟)

#### 1.1 创建数据库迁移文件
```bash
# 在 xituan_backend/migrations/ 目录下创建新迁移文件
# 文件名格式: {timestamp}_create_partner_invoice_summaries.sql
```

#### 1.2 数据库表结构
```sql
-- 创建 partner_invoice_summaries 表
CREATE TABLE partner_invoice_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id),
  partner_address_id UUID REFERENCES partner_addresses(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_loss DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
  invoice_link TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 添加索引
CREATE INDEX idx_partner_invoice_summaries_partner_id ON partner_invoice_summaries(partner_id);
CREATE INDEX idx_partner_invoice_summaries_dates ON partner_invoice_summaries(start_date, end_date);

-- 修改 partner_invoices 表
ALTER TABLE partner_invoices ADD COLUMN summary_id UUID REFERENCES partner_invoice_summaries(id);
CREATE INDEX idx_partner_invoices_summary_id ON partner_invoices(summary_id);
```

### 阶段2: Codebase类型定义 (预计20分钟)

#### 2.1 更新 partner.type.ts
在 `xituan_codebase/typing_entity/partner.type.ts` 中添加：

```typescript
// 发货单结算实体
export interface iPartnerInvoiceSummary {
  id: string;
  partnerId: string;
  partnerAddressId?: string;
  startDate: Date;
  endDate: Date;
  totalAmount: number;
  totalLoss: number;
  totalPaid: number;
  invoiceLink?: string;
  createdAt: Date;
  updatedAt: Date;
  
  // 关联对象
  partner?: iPartner;
  partnerAddress?: iPartnerAddress;
  invoices?: iPartnerInvoice[];
}

// 创建结算请求
export interface iCreatePartnerInvoiceSummaryRequest {
  partnerId: string;
  partnerAddressId?: string;
  startDate: string;
  endDate: string;
  invoiceIds: string[];
}

// 更新结算请求
export interface iUpdatePartnerInvoiceSummaryRequest {
  partnerId?: string;
  partnerAddressId?: string;
  startDate?: string;
  endDate?: string;
  invoiceIds?: string[];
}

// 结算列表查询参数
export interface iPartnerInvoiceSummaryListParams {
  page?: number;
  limit?: number;
  partnerId?: string;
  partnerAddressId?: string;
  dateFrom?: string;
  dateTo?: string;
}

// 未结算发票查询参数
export interface iUnsettledInvoicesParams {
  partnerId: string;
  partnerAddressId?: string;
  startDate?: string;
  endDate?: string;
}
```

#### 2.2 创建 invoiceSummary.util.ts
在 `xituan_codebase/utils/invoiceSummary.util.ts` 中创建：

```typescript
import { iPartnerInvoice } from '../typing_entity/partner.type';

export interface iInvoiceSummaryCalculation {
  totalAmount: number;
  totalLoss: number;
  totalPaid: number;
}

export const invoiceSummaryUtil = {
  /**
   * 计算结算汇总信息
   * @param invoices 发票列表
   * @returns 计算结果
   */
  calculateInvoiceSummary(invoices: iPartnerInvoice[]): iInvoiceSummaryCalculation {
    let totalAmount = 0;
    let totalLoss = 0;
    let totalPaid = 0;

    invoices.forEach(invoice => {
      totalAmount += invoice.totalAmount || 0;
      totalLoss += (invoice.discountedLoss || 0) + (invoice.outdatedLoss || 0);
      totalPaid += invoice.totalPaid || 0;
    });

    return {
      totalAmount: Number(totalAmount.toFixed(2)),
      totalLoss: Number(totalLoss.toFixed(2)),
      totalPaid: Number(totalPaid.toFixed(2))
    };
  }
};
```

### 阶段3: 后端实体和Repository (预计45分钟)

#### 3.1 创建实体文件
创建 `xituan_backend/src/domains/partner/domain/partner-invoice-summary.entity.ts`：

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { iPartnerInvoiceSummary } from '../../../../submodules/xituan_codebase/typing_entity/partner.type';
import { Partner } from './partner.entity';
import { PartnerAddress } from './partner-address.entity';
import { PartnerInvoice } from './partner-invoice.entity';

@Entity('partner_invoice_summaries')
export class PartnerInvoiceSummary implements iPartnerInvoiceSummary {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'partner_id' })
  partnerId!: string;

  @Column({ type: 'uuid', name: 'partner_address_id', nullable: true })
  partnerAddressId?: string;

  @Column({ type: 'date', name: 'start_date' })
  startDate!: Date;

  @Column({ type: 'date', name: 'end_date' })
  endDate!: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'total_amount' })
  totalAmount!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'total_loss' })
  totalLoss!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'total_paid' })
  totalPaid!: number;

  @Column({ type: 'text', name: 'invoice_link', nullable: true })
  invoiceLink?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // 关联关系
  @ManyToOne(() => Partner)
  @JoinColumn({ name: 'partner_id' })
  partner?: Partner;

  @ManyToOne(() => PartnerAddress)
  @JoinColumn({ name: 'partner_address_id' })
  partnerAddress?: PartnerAddress;

  @OneToMany(() => PartnerInvoice, invoice => invoice.summary)
  invoices?: PartnerInvoice[];
}
```

#### 3.2 更新 PartnerInvoice 实体
在 `partner-invoice.entity.ts` 中添加：

```typescript
@ManyToOne(() => PartnerInvoiceSummary, summary => summary.invoices)
@JoinColumn({ name: 'summary_id' })
summary?: PartnerInvoiceSummary;
```

#### 3.3 更新 Repository
在 `partner.repository.ts` 中添加方法：

```typescript
// 结算相关方法
async getPartnerInvoiceSummaries(params: iPartnerInvoiceSummaryListParams = {}): Promise<iPaginatedResponse<iPartnerInvoiceSummary>> {
  const { page = 1, limit = 10, partnerId, partnerAddressId, dateFrom, dateTo } = params;
  const skip = (page - 1) * limit;

  const queryBuilder = this.partnerInvoiceSummaryRepo.createQueryBuilder('summary')
    .leftJoinAndSelect('summary.partner', 'partner')
    .leftJoinAndSelect('summary.partnerAddress', 'partnerAddress')
    .where('1=1');

  if (partnerId) {
    queryBuilder.andWhere('summary.partnerId = :partnerId', { partnerId });
  }

  if (partnerAddressId) {
    queryBuilder.andWhere('summary.partnerAddressId = :partnerAddressId', { partnerAddressId });
  }

  if (dateFrom) {
    queryBuilder.andWhere('summary.startDate >= :dateFrom', { dateFrom });
  }

  if (dateTo) {
    queryBuilder.andWhere('summary.endDate <= :dateTo', { dateTo });
  }

  const [items, total] = await queryBuilder
    .orderBy('summary.createdAt', 'DESC')
    .skip(skip)
    .take(limit)
    .getManyAndCount();

  const totalPages = Math.ceil(total / limit);

  return {
    items,
    total,
    page,
    pageSize: limit,
    totalPages
  };
}

async getPartnerInvoiceSummaryById(id: string): Promise<iPartnerInvoiceSummary | null> {
  return await this.partnerInvoiceSummaryRepo.findOne({
    where: { id },
    relations: ['partner', 'partnerAddress', 'invoices']
  });
}

async createPartnerInvoiceSummary(data: Partial<iPartnerInvoiceSummary>): Promise<iPartnerInvoiceSummary> {
  const summary = this.partnerInvoiceSummaryRepo.create(data);
  return await this.partnerInvoiceSummaryRepo.save(summary);
}

async updatePartnerInvoiceSummary(id: string, data: Partial<iPartnerInvoiceSummary>): Promise<iPartnerInvoiceSummary | null> {
  await this.partnerInvoiceSummaryRepo.update(id, data);
  return await this.getPartnerInvoiceSummaryById(id);
}

async deletePartnerInvoiceSummary(id: string): Promise<boolean> {
  const result = await this.partnerInvoiceSummaryRepo.delete(id);
  return result.affected !== 0;
}

async getUnsettledInvoices(params: iUnsettledInvoicesParams): Promise<iPartnerInvoice[]> {
  const { partnerId, partnerAddressId, startDate, endDate } = params;

  const queryBuilder = this.partnerInvoiceRepo.createQueryBuilder('invoice')
    .leftJoinAndSelect('invoice.partner', 'partner')
    .leftJoinAndSelect('invoice.partnerAddress', 'partnerAddress')
    .where('invoice.partnerId = :partnerId', { partnerId })
    .andWhere('invoice.summaryId IS NULL');

  if (partnerAddressId) {
    queryBuilder.andWhere('invoice.partnerAddressId = :partnerAddressId', { partnerAddressId });
  }

  if (startDate) {
    queryBuilder.andWhere('invoice.issueDate >= :startDate', { startDate });
  }

  if (endDate) {
    queryBuilder.andWhere('invoice.issueDate <= :endDate', { endDate });
  }

  return await queryBuilder
    .orderBy('invoice.issueDate', 'ASC')
    .getMany();
}
```

### 阶段4: 后端Service层 (预计30分钟)

在 `partner.service.ts` 中添加方法：

```typescript
// 结算相关方法
async getPartnerInvoiceSummaries(params: iPartnerInvoiceSummaryListParams = {}): Promise<iPaginatedResponse<iPartnerInvoiceSummary>> {
  return await this.partnerRepository.getPartnerInvoiceSummaries(params);
}

async getPartnerInvoiceSummaryById(id: string): Promise<iPartnerInvoiceSummary | null> {
  return await this.partnerRepository.getPartnerInvoiceSummaryById(id);
}

async createPartnerInvoiceSummary(data: iCreatePartnerInvoiceSummaryRequest): Promise<iPartnerInvoiceSummary> {
  // 获取未结算发票
  const unsettledInvoices = await this.partnerRepository.getUnsettledInvoices({
    partnerId: data.partnerId,
    partnerAddressId: data.partnerAddressId,
    startDate: data.startDate,
    endDate: data.endDate
  });

  // 过滤出指定的发票
  const selectedInvoices = unsettledInvoices.filter(invoice => 
    data.invoiceIds.includes(invoice.id)
  );

  // 计算汇总信息
  const calculation = invoiceSummaryUtil.calculateInvoiceSummary(selectedInvoices);

  // 创建结算记录
  const summaryData: Partial<iPartnerInvoiceSummary> = {
    partnerId: data.partnerId,
    partnerAddressId: data.partnerAddressId,
    startDate: new Date(data.startDate),
    endDate: new Date(data.endDate),
    totalAmount: calculation.totalAmount,
    totalLoss: calculation.totalLoss,
    totalPaid: calculation.totalPaid
  };

  const summary = await this.partnerRepository.createPartnerInvoiceSummary(summaryData);

  // 更新发票的summaryId
  await this.partnerRepository.updateInvoicesSummaryId(selectedInvoices.map(invoice => invoice.id), summary.id);

  return summary;
}

async updatePartnerInvoiceSummary(id: string, data: iUpdatePartnerInvoiceSummaryRequest): Promise<iPartnerInvoiceSummary | null> {
  return await this.partnerRepository.updatePartnerInvoiceSummary(id, data);
}

async deletePartnerInvoiceSummary(id: string): Promise<boolean> {
  // 先清空相关发票的summaryId
  await this.partnerRepository.clearInvoicesSummaryId(id);
  
  // 删除结算记录
  return await this.partnerRepository.deletePartnerInvoiceSummary(id);
}

async getUnsettledInvoices(params: iUnsettledInvoicesParams): Promise<iPartnerInvoice[]> {
  return await this.partnerRepository.getUnsettledInvoices(params);
}
```

### 阶段5: 后端Controller层 (预计25分钟)

在 `partner.controller.ts` 中添加路由：

```typescript
// 结算相关路由
getPartnerInvoiceSummaries = async (req: Request, res: Response): Promise<void> => {
  try {
    const params: iPartnerInvoiceSummaryListParams = req.query;
    const summaries = await this.partnerService.getPartnerInvoiceSummaries(params);
    res.json({ success: true, data: summaries });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message || '获取结算列表失败' } });
  }
};

getPartnerInvoiceSummaryById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const summary = await this.partnerService.getPartnerInvoiceSummaryById(id);
    
    if (!summary) {
      res.status(404).json({ success: false, error: { message: '结算记录不存在' } });
      return;
    }

    res.json({ success: true, data: summary });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message || '获取结算详情失败' } });
  }
};

createPartnerInvoiceSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const data: iCreatePartnerInvoiceSummaryRequest = req.body;
    
    // 验证必需字段
    if (!data.partnerId || !data.startDate || !data.endDate || !data.invoiceIds || data.invoiceIds.length === 0) {
      res.status(400).json({ success: false, error: { message: '请填写完整结算信息' } });
      return;
    }

    const summary = await this.partnerService.createPartnerInvoiceSummary(data);
    res.status(201).json({ success: true, data: summary });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message || '创建结算失败' } });
  }
};

updatePartnerInvoiceSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const data: iUpdatePartnerInvoiceSummaryRequest = req.body;
    
    const summary = await this.partnerService.updatePartnerInvoiceSummary(id, data);
    
    if (!summary) {
      res.status(404).json({ success: false, error: { message: '结算记录不存在' } });
      return;
    }

    res.json({ success: true, data: summary });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message || '更新结算失败' } });
  }
};

deletePartnerInvoiceSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const success = await this.partnerService.deletePartnerInvoiceSummary(id);
    
    if (!success) {
      res.status(404).json({ success: false, error: { message: '结算记录不存在' } });
      return;
    }

    res.json({ success: true, data: { message: '结算记录已删除' } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message || '删除结算失败' } });
  }
};

getUnsettledInvoices = async (req: Request, res: Response): Promise<void> => {
  try {
    const params: iUnsettledInvoicesParams = req.query;
    const invoices = await this.partnerService.getUnsettledInvoices(params);
    res.json({ success: true, data: invoices });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message || '获取未结算发票失败' } });
  }
};

generateInvoiceSummaryPdf = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    // 获取结算详情
    const summary = await this.partnerService.getPartnerInvoiceSummaryById(id);
    if (!summary) {
      res.status(404).json({ success: false, error: { message: '结算记录不存在' } });
      return;
    }

    // 获取合作伙伴和地址信息
    const partner = await this.partnerService.getPartnerById(summary.partnerId);
    const partnerAddress = summary.partnerAddressId ? 
      await this.partnerService.getPartnerAddressById(summary.partnerAddressId, summary.partnerId) : 
      undefined;
    
    if (!partner) {
      res.status(404).json({ success: false, error: { message: '合作伙伴信息不存在' } });
      return;
    }

    // 生成PDF
    const languageRequest = req as iLanguageRequest;
    const pdfBuffer = await this.pdfGeneratorService.generateInvoiceSummaryPdf(summary, partner, partnerAddress, languageRequest);
    
    // 设置响应头
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice_summary_${summary.id}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    
    // 发送PDF
    res.send(pdfBuffer);
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message || '生成PDF失败' } });
  }
};
```

### 阶段6: 更新路由配置 (预计10分钟)

在 `partner.routes.ts` 中添加路由：

```typescript
// 发货单结算管理路由
router.get('/partner-invoice-summaries', partnerController.getPartnerInvoiceSummaries);
router.get('/partner-invoice-summaries/:id', partnerController.getPartnerInvoiceSummaryById);
router.post('/partner-invoice-summaries', partnerController.createPartnerInvoiceSummary);
router.put('/partner-invoice-summaries/:id', partnerController.updatePartnerInvoiceSummary);
router.delete('/partner-invoice-summaries/:id', partnerController.deletePartnerInvoiceSummary);

// 发货单结算特殊操作路由
router.get('/partner-invoice-summaries/unsettled-invoices', partnerController.getUnsettledInvoices);
router.get('/partner-invoice-summaries/:id/pdf', partnerController.generateInvoiceSummaryPdf);
```

### 阶段7: PDF生成服务 (预计60分钟)

在 `pdf-generator.service.ts` 中添加方法：

```typescript
async generateInvoiceSummaryPdf(
  summary: iPartnerInvoiceSummary, 
  partner: iPartner, 
  partnerAddress?: iPartnerAddress, 
  languageRequest?: iLanguageRequest
): Promise<Buffer> {
  // 创建新的PDF文档
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  
  const page = pdfDoc.addPage([595, 842]); // A4尺寸

  // 获取平台设置
  const financeSettings = this.platformSettingService.getSetting<iFinanceSettings>(epPlatformSettingCategory.FINANCE);
  const operationSettings = this.platformSettingService.getSetting<iOperationSettings>(epPlatformSettingCategory.OPERATION);

  // 设置字体
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const chineseFont = await this.loadChineseFont(pdfDoc);

  // 绘制结算内容
  await this.drawInvoiceSummaryHeader(page, operationSettings, font, boldFont);
  await this.drawInvoiceSummaryDetails(page, summary, font, boldFont);
  await this.drawPartnerInfo(page, partner, partnerAddress, font, boldFont);
  await this.drawPaymentInfo(page, financeSettings, font, boldFont, summary);
  await this.drawInvoiceSummaryTable(page, summary, font, boldFont, chineseFont);
  await this.drawInvoiceSummarySummary(page, summary, font, boldFont);
  await this.drawFooter(page, font, boldFont);

  // 返回PDF字节数组
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

private async drawInvoiceSummaryHeader(page: PDFPage, operationSettings: iOperationSettings, font: any, boldFont: any): Promise<void> {
  // 绘制结算标题和公司信息
  // 参考现有 drawInvoiceHeader 方法
}

private async drawInvoiceSummaryDetails(page: PDFPage, summary: iPartnerInvoiceSummary, font: any, boldFont: any): Promise<void> {
  // 绘制结算详情（日期范围、金额等）
}

private async drawInvoiceSummaryTable(page: PDFPage, summary: iPartnerInvoiceSummary, font: any, boldFont: any, chineseFont: any): Promise<void> {
  // 绘制发票列表表格（动态行数）
  // 绘制过期/折扣产品列表（动态位置）
}

private async drawInvoiceSummarySummary(page: PDFPage, summary: iPartnerInvoiceSummary, font: any, boldFont: any): Promise<void> {
  // 绘制汇总信息
}
```

### 阶段8: 前端Context更新 (预计30分钟)

在 `partner.context.tsx` 中添加状态和方法：

```typescript
// 结算相关状态
const [partnerInvoiceSummaries, setPartnerInvoiceSummaries] = useState<iPartnerInvoiceSummary[]>([]);
const [partnerInvoiceSummariesLoading, setPartnerInvoiceSummariesLoading] = useState(false);
const [partnerInvoiceSummariesError, setPartnerInvoiceSummariesError] = useState<string | null>(null);
const [partnerInvoiceSummariesTotal, setPartnerInvoiceSummariesTotal] = useState(0);

// 结算相关方法
const getPartnerInvoiceSummaries = async (params: iPartnerInvoiceSummaryListParams = {}) => {
  setPartnerInvoiceSummariesLoading(true);
  setPartnerInvoiceSummariesError(null);
  
  try {
    const response = await apiClient.get('/partners/partner-invoice-summaries', { params });
    if (response.data.success) {
      setPartnerInvoiceSummaries(response.data.data.items);
      setPartnerInvoiceSummariesTotal(response.data.data.total);
    } else {
      setPartnerInvoiceSummariesError(response.data.error?.message || '获取结算列表失败');
    }
  } catch (error: any) {
    setPartnerInvoiceSummariesError(error.message || '获取结算列表失败');
  } finally {
    setPartnerInvoiceSummariesLoading(false);
  }
};

const createPartnerInvoiceSummary = async (data: iCreatePartnerInvoiceSummaryRequest) => {
  try {
    const response = await apiClient.post('/partners/partner-invoice-summaries', data);
    if (response.data.success) {
      message.success('结算创建成功');
      return response.data.data;
    } else {
      message.error(response.data.error?.message || '创建结算失败');
      return null;
    }
  } catch (error: any) {
    message.error(error.message || '创建结算失败');
    return null;
  }
};

const updatePartnerInvoiceSummary = async (id: string, data: iUpdatePartnerInvoiceSummaryRequest) => {
  try {
    const response = await apiClient.put(`/partners/partner-invoice-summaries/${id}`, data);
    if (response.data.success) {
      message.success('结算更新成功');
      return response.data.data;
    } else {
      message.error(response.data.error?.message || '更新结算失败');
      return null;
    }
  } catch (error: any) {
    message.error(error.message || '更新结算失败');
    return null;
  }
};

const deletePartnerInvoiceSummary = async (id: string) => {
  try {
    const response = await apiClient.delete(`/partners/partner-invoice-summaries/${id}`);
    if (response.data.success) {
      message.success('结算删除成功');
      return true;
    } else {
      message.error(response.data.error?.message || '删除结算失败');
      return false;
    }
  } catch (error: any) {
    message.error(error.message || '删除结算失败');
    return false;
  }
};

const getUnsettledInvoices = async (params: iUnsettledInvoicesParams) => {
  try {
    const response = await apiClient.get('/partners/partner-invoice-summaries/unsettled-invoices', { params });
    if (response.data.success) {
      return response.data.data;
    } else {
      message.error(response.data.error?.message || '获取未结算发票失败');
      return [];
    }
  } catch (error: any) {
    message.error(error.message || '获取未结算发票失败');
    return [];
  }
};
```

### 阶段9: 前端页面实现 (预计120分钟)

#### 9.1 列表页面
创建 `xituan_cms/src/pages/partner-invoice-summaries/index.tsx`：

```typescript
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { 
  Table, 
  Button, 
  Space, 
  Tag, 
  Input, 
  Select, 
  Card, 
  Row, 
  Col, 
  message,
  Popconfirm,
  Tooltip,
  DatePicker
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  SearchOutlined,
  FilePdfOutlined
} from '@ant-design/icons';
import { usePartner } from '../../contexts/partner.context';
import { iPartnerInvoiceSummary } from '../../../submodules/xituan_codebase/typing_entity/partner.type';
import MainLayout from '../../components/layout/MainLayout';
import PartnerSelector from '../../components/common/PartnerSelector';
import LocalityFilter from '../../components/common/LocalityFilter';
import dayjs from 'dayjs';

const { Search } = Input;
const { Option } = Select;
const { RangePicker } = DatePicker;

const PartnerInvoiceSummaryListPage: React.FC = () => {
  const router = useRouter();
  const {
    partnerInvoiceSummaries,
    partnerInvoiceSummariesLoading,
    partnerInvoiceSummariesError,
    partnerInvoiceSummariesTotal,
    getPartnerInvoiceSummaries,
    deletePartnerInvoiceSummary,
    getPartnersByIds,
    getPartnerAddressLocalities
  } = usePartner();

  const [searchText, setSearchText] = useState('');
  const [partnerId, setPartnerId] = useState<string | undefined>();
  const [locality, setLocality] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [partnersMap, setPartnersMap] = useState<Map<string, any>>(new Map());
  const [localitiesMap, setLocalitiesMap] = useState<Map<string, string>>(new Map());

  // 加载数据
  const loadSummaries = useCallback(async () => {
    const params: any = {
      page: pagination.current,
      limit: pagination.pageSize,
      partnerId,
      dateFrom: dateRange?.[0]?.format('YYYY-MM-DD'),
      dateTo: dateRange?.[1]?.format('YYYY-MM-DD')
    };

    await getPartnerInvoiceSummaries(params);
  }, [pagination.current, pagination.pageSize, partnerId, dateRange]);

  useEffect(() => {
    loadSummaries();
  }, [loadSummaries]);

  // 更新分页信息
  useEffect(() => {
    setPagination(prev => ({
      ...prev,
      total: partnerInvoiceSummariesTotal
    }));
  }, [partnerInvoiceSummariesTotal]);

  // 表格列定义
  const columns = [
    {
      title: '结算ID',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      render: (id: string) => (
        <Button type="link" onClick={() => handleEdit(id)}>
          {id.substring(0, 8)}...
        </Button>
      )
    },
    {
      title: '合作伙伴',
      dataIndex: 'partnerId',
      key: 'partnerId',
      width: 150,
      render: (partnerId: string) => {
        const partner = partnersMap.get(partnerId);
        return partner ? partner.name?.en || partner.name?.zh_cn || 'Unknown' : 'Loading...';
      }
    },
    {
      title: '地址',
      dataIndex: 'partnerAddressId',
      key: 'partnerAddressId',
      width: 120,
      render: (addressId: string, record: iPartnerInvoiceSummary) => {
        if (!addressId) return '全部地址';
        const locality = localitiesMap.get(addressId);
        return locality || 'Loading...';
      }
    },
    {
      title: '日期范围',
      key: 'dateRange',
      width: 200,
      render: (record: iPartnerInvoiceSummary) => (
        <span>
          {dayjs(record.startDate).format('YYYY-MM-DD')} ~ {dayjs(record.endDate).format('YYYY-MM-DD')}
        </span>
      )
    },
    {
      title: '总金额',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 100,
      render: (amount: number) => `$${amount.toFixed(2)}`
    },
    {
      title: '总亏损',
      dataIndex: 'totalLoss',
      key: 'totalLoss',
      width: 100,
      render: (loss: number) => (
        <span style={{ color: loss > 0 ? '#ff4d4f' : '#52c41a' }}>
          ${loss.toFixed(2)}
        </span>
      )
    },
    {
      title: '实收',
      dataIndex: 'totalPaid',
      key: 'totalPaid',
      width: 100,
      render: (paid: number) => `$${paid.toFixed(2)}`
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (record: iPartnerInvoiceSummary) => (
        <Space>
          <Tooltip title="编辑">
            <Button 
              type="text" 
              icon={<EditOutlined />} 
              onClick={() => handleEdit(record.id)}
            />
          </Tooltip>
          <Tooltip title="查看PDF">
            <Button 
              type="text" 
              icon={<FilePdfOutlined />} 
              onClick={() => handleViewPdf(record.id)}
            />
          </Tooltip>
          <Popconfirm
            title="确定要删除这个结算记录吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button 
                type="text" 
                danger 
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ];

  // 事件处理
  const handleCreate = () => {
    router.push('/partner-invoice-summaries/create');
  };

  const handleEdit = (id: string) => {
    router.push(`/partner-invoice-summaries/${id}/edit`);
  };

  const handleViewPdf = (id: string) => {
    window.open(`/api/partners/partner-invoice-summaries/${id}/pdf`, '_blank');
  };

  const handleDelete = async (id: string) => {
    const success = await deletePartnerInvoiceSummary(id);
    if (success) {
      loadSummaries();
    }
  };

  const handleTableChange = (pagination: any) => {
    setPagination({
      current: pagination.current,
      pageSize: pagination.pageSize,
      total: pagination.total
    });
  };

  return (
    <MainLayout>
      <Card title="发货单结算管理" extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          创建结算
        </Button>
      }>
        {/* 过滤器 */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <PartnerSelector
              value={partnerId}
              onChange={setPartnerId}
              placeholder="选择合作伙伴"
              allowClear
            />
          </Col>
          <Col span={6}>
            <LocalityFilter
              value={locality}
              onChange={setLocality}
              partnerId={partnerId}
              placeholder="选择地址"
              allowClear
            />
          </Col>
          <Col span={8}>
            <RangePicker
              value={dateRange}
              onChange={setDateRange}
              style={{ width: '100%' }}
            />
          </Col>
          <Col span={4}>
            <Button type="primary" icon={<SearchOutlined />} onClick={loadSummaries}>
              搜索
            </Button>
          </Col>
        </Row>

        {/* 表格 */}
        <Table
          columns={columns}
          dataSource={partnerInvoiceSummaries}
          loading={partnerInvoiceSummariesLoading}
          rowKey="id"
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
          }}
          onChange={handleTableChange}
          scroll={{ x: 1000 }}
        />
      </Card>
    </MainLayout>
  );
};

export default PartnerInvoiceSummaryListPage;
```

#### 9.2 创建页面
创建 `xituan_cms/src/pages/partner-invoice-summaries/create.tsx`：

```typescript
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { 
  Form, 
  Input, 
  Select, 
  Button, 
  Card, 
  Row, 
  Col, 
  message,
  Space,
  DatePicker,
  Table,
  Tag
} from 'antd';
import { 
  SaveOutlined, 
  ArrowLeftOutlined, 
  ReloadOutlined
} from '@ant-design/icons';
import { usePartner } from '../../contexts/partner.context';
import { iCreatePartnerInvoiceSummaryRequest, iPartnerInvoice } from '../../../submodules/xituan_codebase/typing_entity/partner.type';
import MainLayout from '../../components/layout/MainLayout';
import PartnerSelector from '../../components/common/PartnerSelector';
import LocalityFilter from '../../components/common/LocalityFilter';
import { invoiceSummaryUtil } from '../../../submodules/xituan_codebase/utils/invoiceSummary.util';
import dayjs from 'dayjs';

const { Option } = Select;
const { RangePicker } = DatePicker;

const CreatePartnerInvoiceSummaryPage: React.FC = () => {
  const router = useRouter();
  const {
    createPartnerInvoiceSummary,
    getUnsettledInvoices,
    getPartnersByIds,
    getPartnerAddressLocalities
  } = usePartner();

  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [unsettledInvoices, setUnsettledInvoices] = useState<iPartnerInvoice[]>([]);
  const [selectedInvoices, setSelectedInvoices] = useState<iPartnerInvoice[]>([]);
  const [calculation, setCalculation] = useState({ totalAmount: 0, totalLoss: 0, totalPaid: 0 });

  const [partnerId, setPartnerId] = useState<string | undefined>();
  const [partnerAddressId, setPartnerAddressId] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  // 加载未结算发票
  const loadUnsettledInvoices = async () => {
    if (!partnerId) return;

    setLoading(true);
    try {
      const invoices = await getUnsettledInvoices({
        partnerId,
        partnerAddressId,
        startDate: dateRange?.[0]?.format('YYYY-MM-DD'),
        endDate: dateRange?.[1]?.format('YYYY-MM-DD')
      });
      setUnsettledInvoices(invoices);
      setSelectedInvoices(invoices); // 默认选择所有
    } catch (error) {
      message.error('加载未结算发票失败');
    } finally {
      setLoading(false);
    }
  };

  // 当合作伙伴或地址改变时重新加载
  useEffect(() => {
    if (partnerId) {
      loadUnsettledInvoices();
    }
  }, [partnerId, partnerAddressId, dateRange]);

  // 计算汇总信息
  useEffect(() => {
    if (selectedInvoices.length > 0) {
      const calc = invoiceSummaryUtil.calculateInvoiceSummary(selectedInvoices);
      setCalculation(calc);
    } else {
      setCalculation({ totalAmount: 0, totalLoss: 0, totalPaid: 0 });
    }
  }, [selectedInvoices]);

  // 表格列定义
  const columns = [
    {
      title: '发票ID',
      dataIndex: 'packCode',
      key: 'packCode',
      width: 120
    },
    {
      title: '开票日期',
      dataIndex: 'issueDate',
      key: 'issueDate',
      width: 120,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD')
    },
    {
      title: '总金额',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 100,
      render: (amount: number) => `$${amount.toFixed(2)}`
    },
    {
      title: '折扣损失',
      dataIndex: 'discountedLoss',
      key: 'discountedLoss',
      width: 100,
      render: (loss: number) => (
        <span style={{ color: loss > 0 ? '#ff4d4f' : '#52c41a' }}>
          ${loss.toFixed(2)}
        </span>
      )
    },
    {
      title: '过期损失',
      dataIndex: 'outdatedLoss',
      key: 'outdatedLoss',
      width: 100,
      render: (loss: number) => (
        <span style={{ color: loss > 0 ? '#ff4d4f' : '#52c41a' }}>
          ${loss.toFixed(2)}
        </span>
      )
    },
    {
      title: '实收',
      dataIndex: 'totalPaid',
      key: 'totalPaid',
      width: 100,
      render: (paid: number) => `$${paid.toFixed(2)}`
    }
  ];

  // 行选择配置
  const rowSelection = {
    selectedRowKeys: selectedInvoices.map(invoice => invoice.id),
    onChange: (selectedRowKeys: React.Key[], selectedRows: iPartnerInvoice[]) => {
      setSelectedInvoices(selectedRows);
    },
    getCheckboxProps: (record: iPartnerInvoice) => ({
      name: record.packCode,
    }),
  };

  // 提交表单
  const handleSubmit = async (values: any) => {
    if (selectedInvoices.length === 0) {
      message.error('请至少选择一个发票');
      return;
    }

    setLoading(true);
    try {
      const data: iCreatePartnerInvoiceSummaryRequest = {
        partnerId: values.partnerId,
        partnerAddressId: values.partnerAddressId,
        startDate: values.dateRange[0].format('YYYY-MM-DD'),
        endDate: values.dateRange[1].format('YYYY-MM-DD'),
        invoiceIds: selectedInvoices.map(invoice => invoice.id)
      };

      const summary = await createPartnerInvoiceSummary(data);
      if (summary) {
        message.success('结算创建成功');
        router.push('/partner-invoice-summaries');
      }
    } catch (error) {
      message.error('创建结算失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <Card 
        title="创建发货单结算" 
        extra={
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.back()}>
            返回
          </Button>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            dateRange: [dayjs().subtract(1, 'month'), dayjs()]
          }}
        >
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="partnerId"
                label="合作伙伴"
                rules={[{ required: true, message: '请选择合作伙伴' }]}
              >
                <PartnerSelector
                  value={partnerId}
                  onChange={(value) => {
                    setPartnerId(value);
                    form.setFieldsValue({ partnerId: value });
                  }}
                  placeholder="选择合作伙伴"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="partnerAddressId"
                label="合作伙伴地址"
              >
                <LocalityFilter
                  value={partnerAddressId}
                  onChange={(value) => {
                    setPartnerAddressId(value);
                    form.setFieldsValue({ partnerAddressId: value });
                  }}
                  partnerId={partnerId}
                  placeholder="选择地址（可选）"
                  allowClear
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="dateRange"
                label="日期范围"
                rules={[{ required: true, message: '请选择日期范围' }]}
              >
                <RangePicker
                  value={dateRange}
                  onChange={(dates) => {
                    setDateRange(dates);
                    form.setFieldsValue({ dateRange: dates });
                  }}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* 发票选择区域 */}
          <Card 
            title="发票选择" 
            extra={
              <Button 
                icon={<ReloadOutlined />} 
                onClick={loadUnsettledInvoices}
                loading={loading}
              >
                重置
              </Button>
            }
            style={{ marginTop: 16 }}
          >
            <Table
              columns={columns}
              dataSource={unsettledInvoices}
              loading={loading}
              rowKey="id"
              rowSelection={rowSelection}
              pagination={false}
              scroll={{ y: 300 }}
              size="small"
            />
          </Card>

          {/* 汇总信息 */}
          <Card title="汇总信息" style={{ marginTop: 16 }}>
            <Row gutter={16}>
              <Col span={8}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>
                    ${calculation.totalAmount.toFixed(2)}
                  </div>
                  <div>总金额</div>
                </div>
              </Col>
              <Col span={8}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: '#ff4d4f' }}>
                    ${calculation.totalLoss.toFixed(2)}
                  </div>
                  <div>总亏损</div>
                </div>
              </Col>
              <Col span={8}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>
                    ${calculation.totalPaid.toFixed(2)}
                  </div>
                  <div>实收</div>
                </div>
              </Col>
            </Row>
          </Card>

          {/* 操作按钮 */}
          <Row justify="end" style={{ marginTop: 24 }}>
            <Space>
              <Button onClick={() => router.back()}>
                取消
              </Button>
              <Button 
                type="primary" 
                htmlType="submit" 
                icon={<SaveOutlined />}
                loading={loading}
                disabled={selectedInvoices.length === 0}
              >
                创建结算
              </Button>
            </Space>
          </Row>
        </Form>
      </Card>
    </MainLayout>
  );
};

export default CreatePartnerInvoiceSummaryPage;
```

#### 9.3 编辑页面
创建 `xituan_cms/src/pages/partner-invoice-summaries/[id]/edit.tsx`：

```typescript
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { 
  Card, 
  Button, 
  Row, 
  Col, 
  message,
  Space,
  Table,
  Tag,
  Statistic
} from 'antd';
import { 
  ArrowLeftOutlined, 
  FilePdfOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { usePartner } from '../../../contexts/partner.context';
import { iPartnerInvoiceSummary, iPartnerInvoice } from '../../../../submodules/xituan_codebase/typing_entity/partner.type';
import MainLayout from '../../../components/layout/MainLayout';
import dayjs from 'dayjs';

const PartnerInvoiceSummaryEditPage: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;
  
  const {
    getPartnerInvoiceSummaryById,
    updatePartnerInvoiceSummary,
    getPartnersByIds,
    getPartnerAddressLocalities
  } = usePartner();

  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<iPartnerInvoiceSummary | null>(null);
  const [partnersMap, setPartnersMap] = useState<Map<string, any>>(new Map());
  const [localitiesMap, setLocalitiesMap] = useState<Map<string, string>>(new Map());

  // 加载结算详情
  const loadSummary = async () => {
    if (!id) return;

    setLoading(true);
    try {
      const data = await getPartnerInvoiceSummaryById(id as string);
      if (data) {
        setSummary(data);
        
        // 加载合作伙伴信息
        if (data.partnerId) {
          const partners = await getPartnersByIds([data.partnerId]);
          const partnerMap = new Map();
          partners.forEach(partner => partnerMap.set(partner.id, partner));
          setPartnersMap(partnerMap);
        }

        // 加载地址信息
        if (data.partnerAddressId) {
          const localities = await getPartnerAddressLocalities(data.partnerId);
          const localityMap = new Map();
          localities.forEach(locality => localityMap.set(locality.id, locality.locality));
          setLocalitiesMap(localityMap);
        }
      }
    } catch (error) {
      message.error('加载结算详情失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, [id]);

  // 查看PDF
  const handleViewPdf = () => {
    if (summary) {
      window.open(`/api/partners/partner-invoice-summaries/${summary.id}/pdf`, '_blank');
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '发票ID',
      dataIndex: 'packCode',
      key: 'packCode',
      width: 120
    },
    {
      title: '开票日期',
      dataIndex: 'issueDate',
      key: 'issueDate',
      width: 120,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD')
    },
    {
      title: '总金额',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 100,
      render: (amount: number) => `$${amount.toFixed(2)}`
    },
    {
      title: '折扣损失',
      dataIndex: 'discountedLoss',
      key: 'discountedLoss',
      width: 100,
      render: (loss: number) => (
        <span style={{ color: loss > 0 ? '#ff4d4f' : '#52c41a' }}>
          ${loss.toFixed(2)}
        </span>
      )
    },
    {
      title: '过期损失',
      dataIndex: 'outdatedLoss',
      key: 'outdatedLoss',
      width: 100,
      render: (loss: number) => (
        <span style={{ color: loss > 0 ? '#ff4d4f' : '#52c41a' }}>
          ${loss.toFixed(2)}
        </span>
      )
    },
    {
      title: '实收',
      dataIndex: 'totalPaid',
      key: 'totalPaid',
      width: 100,
      render: (paid: number) => `$${paid.toFixed(2)}`
    }
  ];

  if (!summary) {
    return (
      <MainLayout>
        <Card loading={loading}>
          <div style={{ height: 200 }} />
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Card 
        title={`结算详情 - ${summary.id.substring(0, 8)}...`}
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadSummary}>
              刷新
            </Button>
            <Button icon={<FilePdfOutlined />} onClick={handleViewPdf}>
              预览PDF
            </Button>
            <Button icon={<ArrowLeftOutlined />} onClick={() => router.back()}>
              返回
            </Button>
          </Space>
        }
      >
        {/* 基本信息 */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={8}>
            <Card size="small" title="合作伙伴">
              {partnersMap.get(summary.partnerId)?.name?.en || 'Loading...'}
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" title="地址">
              {summary.partnerAddressId ? 
                (localitiesMap.get(summary.partnerAddressId) || 'Loading...') : 
                '全部地址'
              }
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" title="日期范围">
              {dayjs(summary.startDate).format('YYYY-MM-DD')} ~ {dayjs(summary.endDate).format('YYYY-MM-DD')}
            </Card>
          </Col>
        </Row>

        {/* 汇总统计 */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="总金额"
                value={summary.totalAmount}
                prefix="$"
                precision={2}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="总亏损"
                value={summary.totalLoss}
                prefix="$"
                precision={2}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="实收"
                value={summary.totalPaid}
                prefix="$"
                precision={2}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
        </Row>

        {/* 发票列表 */}
        <Card title="包含的发票" size="small">
          <Table
            columns={columns}
            dataSource={summary.invoices || []}
            loading={loading}
            rowKey="id"
            pagination={false}
            scroll={{ y: 400 }}
            size="small"
          />
        </Card>
      </Card>
    </MainLayout>
  );
};

export default PartnerInvoiceSummaryEditPage;
```

### 阶段10: 更新菜单配置 (预计10分钟)

在 `MainLayout.tsx` 中添加菜单项：

```typescript
// 在合作伙伴菜单组中添加
{
  key: 'partner-invoice-summaries',
  label: '发货单结算',
  icon: <FileTextOutlined />,
  children: [
    {
      key: 'partner-invoice-summaries-list',
      label: '结算列表',
      path: '/partner-invoice-summaries'
    }
  ]
}
```

## 测试计划

### 单元测试
- Repository层方法测试
- Service层业务逻辑测试
- Util函数测试

### 集成测试
- API接口测试
- 数据库操作测试
- PDF生成测试

### 端到端测试
- 完整结算流程测试
- 前端页面交互测试
- 权限控制测试

## 部署检查清单

- [ ] 数据库迁移执行成功
- [ ] 后端服务启动正常
- [ ] API接口响应正常
- [ ] 前端页面加载正常
- [ ] PDF生成功能正常
- [ ] 权限控制生效
- [ ] 错误处理完善

## 预计总时间

- 数据库设计: 30分钟
- 后端开发: 3小时
- 前端开发: 3小时
- 测试和调试: 1小时
- **总计: 约7.5小时**

## 注意事项

1. 严格按照现有代码规范和架构模式实现
2. 确保所有错误处理完善
3. 保持与现有系统的一致性
4. 充分测试所有功能点
5. 注意权限控制和安全性
