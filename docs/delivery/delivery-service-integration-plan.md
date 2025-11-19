# 配送服务商集成方案（Uber Direct + Sendle）

## 📋 概述

本方案实现 Uber Direct 和 Sendle 双配送服务商集成，根据平台设置、配送距离、订单模式和产品特性自动选择配送方案：

### 核心规则

#### 1. 产品"自送"标记（最高优先级）
- 如果订单中**任一产品**标记为"自送"（`requiresStoreDelivery = true`）：
  - ✅ **强制使用店铺自送或自提**
  - ❌ 禁用 Uber Direct 和 Sendle
  - ❌ 如果选择配送且超出 `maxDeliverKM`，**不允许下单**

#### 2. 配送服务商选择逻辑
- **16公里内（或 maxDeliverKM 内）**：
  - 如果开通了 Uber Direct → 使用 Uber Direct（当日达）
  - 如果没有开通 Uber Direct → 使用店铺自送（现有距离×价格计算）

- **超过16公里（或 maxDeliverKM）**：
  - 如果开通了 Sendle → 允许使用 Sendle（标准配送）
  - 如果没有开通 Sendle → **不允许下单**（提示超出配送范围）

#### 3. 订单模式与配送时效

**Regular 订单**：
- 实时订单 → **立即创建配送**（ASAP，立即取货）

**Offer 订单**：
- 有明确发货日期 → **批量创建配送**
- Uber/Sendle 过来**一次性取走这批订单**（一般是同一天）
- 按发货日期分组，可批量配送多个订单
- **Uber Direct 优化分组**：
  - 通过经纬度计算所有订单地址的相互间距离
  - 根据距离分组成指定的 N 组订单（每组最多 14 个订单）
  - 按组申请 Uber 取单，确保每个配送员配送的几个地点最小范围
  - 避免交叉浪费配送成本

**Preorder 订单**：
- 有明确配送时段 → **单笔预定取单**
- 根据 preorder 最终确认的配送时段 **-1小时** 作为取件时间
- 因为 preorder 几乎没有同时段，且一般指定 1-2 小时内，所以**很难多个订单一起取单**
- 因为要精确到小时，**Sendle 这种 1-2 天送到的就不行了**
- 所以 preorder **只能自送或单个取单 Uber 配送**

### 运费计算
- **Uber Direct**：使用 Uber Direct API 获取实时报价
- **店铺自送**：使用现有计算方式（距离×价格 - 订单总值百分比抵扣）
- **Sendle**：使用 Sendle API 获取实时报价

---

## 🏗️ 系统架构改动

### 1. 数据库改动

#### 1.1 产品表新增字段

```sql
-- 添加"自送"标记字段到 products 表
ALTER TABLE products ADD COLUMN IF NOT EXISTS requires_store_delivery BOOLEAN DEFAULT FALSE;
COMMENT ON COLUMN products.requires_store_delivery IS '是否必须店铺自送（如蛋糕等易损产品）';
```

#### 1.2 订单表新增字段

```sql
-- 添加配送服务商相关字段到 orders 表
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_provider VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_provider_order_id VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_tracking_number VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_tracking_url TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_estimated_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_scheduled_pickup_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_batch_id VARCHAR(255); -- 批量配送批次ID
COMMENT ON COLUMN orders.delivery_provider IS '配送服务商：store_delivery, uber_direct, sendle';
COMMENT ON COLUMN orders.delivery_batch_id IS '批量配送批次ID，同一批次的订单可以一起配送';
```

#### 1.2 创建配送记录表（可选，用于追踪历史）

```sql
CREATE TABLE IF NOT EXISTS delivery_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL, -- 'uber_direct' | 'sendle'
    provider_order_id VARCHAR(255),
    tracking_number VARCHAR(255),
    tracking_url TEXT,
    status VARCHAR(50), -- 'pending', 'picked_up', 'in_transit', 'delivered', 'failed'
    estimated_delivery_time TIMESTAMP WITH TIME ZONE,
    actual_delivery_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_delivery_records_order_id ON delivery_records(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_records_provider_order_id ON delivery_records(provider_order_id);
```

---

## 🔧 后端改动

### 2.0 更新平台设置类型

**文件**: `submodules/xituan_codebase/typing_entity/platform-setting.type.ts`

```typescript
// 运费计算设置（扩展）
export interface iShippingSettings {
  valuePercentage: number;      // 货值含运费百分比，如 0.2 表示 20%
  maxDeduction: number;         // 货值抵扣运费最大值，如 20 元
  minValueThreshold: number;    // 货值抵运费起算值，如 50 元
  minDistance: number;          // 运费最小距离，如 5 公里
  pricePerKm: number;           // 运费公里价格，如 2 元/公里
  maxDeliverKM: number;         // 最大配送距离（店铺自送），如 10 公里
  
  // 新增：配送服务商开关
  enableUberDirect: boolean;    // 是否开通 Uber Direct
  enableSendle: boolean;         // 是否开通 Sendle
  uberDirectMaxDistance: number; // Uber Direct 最大配送距离，默认 16 公里
}
```

### 2.1 新增枚举类型

**文件**: `submodules/xituan_codebase/typing_entity/delivery.enum.ts`

```typescript
// 配送服务商枚举
export enum epDeliveryProvider {
  STORE_DELIVERY = 'store_delivery',  // 店铺自送（现有方式）
  UBER_DIRECT = 'uber_direct',        // Uber Direct
  SENDLE = 'sendle'                  // Sendle
}

// 配送状态枚举
export enum epDeliveryStatus {
  PENDING = 'pending',           // 待取件
  PICKED_UP = 'picked_up',       // 已取件
  IN_TRANSIT = 'in_transit',     // 运输中
  DELIVERED = 'delivered',       // 已送达
  FAILED = 'failed'              // 配送失败
}
```

### 2.2 新增类型定义

**文件**: `submodules/xituan_codebase/typing_entity/delivery.type.ts`

```typescript
// 配送服务商信息
export interface iDeliveryProviderInfo {
  provider: epDeliveryProvider;
  name: string;
  estimatedDeliveryTime: string; // 预计配送时间描述，如 "当日达"、"1-2个工作日"
  estimatedDeliveryHours?: number; // 预计配送小时数
  price: number;
  distanceKm: number;
  isAvailable: boolean;
  unavailableReason?: string;
}

// 配送追踪信息
export interface iDeliveryTracking {
  provider: epDeliveryProvider;
  providerOrderId?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  status: epDeliveryStatus;
  estimatedDeliveryTime?: Date;
  actualDeliveryTime?: Date;
  currentLocation?: string;
  events: Array<{
    timestamp: Date;
    status: string;
    description: string;
    location?: string;
  }>;
}

// 运费计算响应（扩展）
export interface iShippingFeeResponse {
  shippingFee: number;
  distanceKm: number;
  distanceMeters: number;
  providers: iDeliveryProviderInfo[]; // 可用的配送服务商列表
  recommendedProvider: epDeliveryProvider; // 推荐的服务商
}
```

### 2.3 更新订单实体

**文件**: `src/domains/order/domain/order.entity.ts`

```typescript
// 在 Order 实体中添加字段
@Column({ type: 'varchar', length: 50, nullable: true, name: 'delivery_provider' })
deliveryProvider?: string;

@Column({ type: 'varchar', length: 255, nullable: true, name: 'delivery_provider_order_id' })
deliveryProviderOrderId?: string;

@Column({ type: 'varchar', length: 255, nullable: true, name: 'delivery_tracking_number' })
deliveryTrackingNumber?: string;

@Column({ type: 'text', nullable: true, name: 'delivery_tracking_url' })
deliveryTrackingUrl?: string;

@Column({ type: 'timestamp with time zone', nullable: true, name: 'delivery_estimated_time' })
deliveryEstimatedTime?: Date;

@Column({ type: 'timestamp with time zone', nullable: true, name: 'delivery_scheduled_pickup_time' })
deliveryScheduledPickupTime?: Date;
```

### 2.4 创建配送服务商服务

**文件**: `src/domains/delivery/services/delivery-provider.service.ts`

```typescript
import { epDeliveryProvider, iDeliveryProviderInfo } from '../../../../submodules/xituan_codebase/typing_entity/delivery.type';
import { PlatformSettingService } from '../../platform-setting/services/platform-setting.service';
import { iShippingSettings } from '../../../../submodules/xituan_codebase/typing_entity/platform-setting.type';
import { BusinessError } from '../../../../submodules/xituan_codebase/typing_api/business-error-server.util';
import { eBusinessErrorCode } from '../../../../submodules/xituan_codebase/typing_api/business-error.enum';

export class DeliveryProviderService {
  private platformSettingService: PlatformSettingService;

  constructor() {
    this.platformSettingService = PlatformSettingService.getInstance();
  }

  /**
   * 获取运费设置
   */
  private getShippingSettings(): iShippingSettings {
    const settings = this.platformSettingService.getShippingSettings();
    if (!settings) {
      throw new Error('运费设置未找到');
    }
    return settings;
  }

  /**
   * 根据距离和产品特性判断可用的配送服务商
   * 
   * @param distanceKm 配送距离（公里）
   * @param requiresStoreDelivery 订单中是否有产品标记为"自送"
   * @returns 可用的配送服务商列表，如果超出范围且没有 Sendle，返回空数组
   */
  getAvailableProviders(
    distanceKm: number, 
    requiresStoreDelivery: boolean = false,
    orderMode?: epOrderMode
  ): epDeliveryProvider[] {
    // 如果订单中有产品标记为"自送"，只能使用店铺自送或自提
    if (requiresStoreDelivery) {
      return [epDeliveryProvider.STORE_DELIVERY];
    }
    
    // Preorder 订单：只能自送或 Uber Direct（不能使用 Sendle）
    if (orderMode === epOrderMode.PREORDER) {
      const settings = this.getShippingSettings();
      const isWithinLocalRange = distanceKm <= settings.maxDeliverKM;
      const isWithinUberDirectRange = distanceKm <= settings.uberDirectMaxDistance;
      const providers: epDeliveryProvider[] = [];
      
      // 店铺自送（总是可用）
      providers.push(epDeliveryProvider.STORE_DELIVERY);
      
      // Uber Direct（如果开通且在范围内）
      if (settings.enableUberDirect && isWithinUberDirectRange) {
        providers.push(epDeliveryProvider.UBER_DIRECT);
      }
      
      return providers; // Preorder 不使用 Sendle
    }
    const settings = this.getShippingSettings();
    const providers: epDeliveryProvider[] = [];
    
    // 判断是否在店铺自送/Uber Direct 范围内
    const isWithinLocalRange = distanceKm <= settings.maxDeliverKM;
    const isWithinUberDirectRange = distanceKm <= settings.uberDirectMaxDistance;
    
    // 16公里内（或 maxDeliverKM 内）
    if (isWithinLocalRange) {
      // 如果开通了 Uber Direct，优先使用
      if (settings.enableUberDirect && isWithinUberDirectRange) {
        providers.push(epDeliveryProvider.UBER_DIRECT);
      }
      // 如果没有 Uber Direct，使用店铺自送
      // 店铺自送不需要添加到 providers，因为它是默认的
    }
    
    // 超过范围
    if (!isWithinLocalRange) {
      // 如果开通了 Sendle，可以使用
      if (settings.enableSendle) {
        providers.push(epDeliveryProvider.SENDLE);
      }
      // 如果没有 Sendle，不允许下单（返回空数组）
    }
    
    return providers;
  }

  /**
   * 获取推荐的服务商
   * 
   * @param distanceKm 配送距离（公里）
   * @param requiresStoreDelivery 订单中是否有产品标记为"自送"
   * @returns 推荐的服务商，如果超出范围且没有 Sendle，抛出错误
   */
  getRecommendedProvider(
    distanceKm: number, 
    requiresStoreDelivery: boolean = false,
    orderMode?: epOrderMode
  ): epDeliveryProvider {
    // 如果订单中有产品标记为"自送"，强制使用店铺自送
    if (requiresStoreDelivery) {
      return epDeliveryProvider.STORE_DELIVERY;
    }
    
    // Preorder 订单：优先 Uber Direct，否则店铺自送
    if (orderMode === epOrderMode.PREORDER) {
      const settings = this.getShippingSettings();
      const isWithinUberDirectRange = distanceKm <= settings.uberDirectMaxDistance;
      
      if (settings.enableUberDirect && isWithinUberDirectRange) {
        return epDeliveryProvider.UBER_DIRECT;
      }
      return epDeliveryProvider.STORE_DELIVERY;
    }
    const settings = this.getShippingSettings();
    const isWithinLocalRange = distanceKm <= settings.maxDeliverKM;
    const isWithinUberDirectRange = distanceKm <= settings.uberDirectMaxDistance;
    
    // 16公里内（或 maxDeliverKM 内）
    if (isWithinLocalRange) {
      // 如果开通了 Uber Direct，优先使用
      if (settings.enableUberDirect && isWithinUberDirectRange) {
        return epDeliveryProvider.UBER_DIRECT;
      }
      // 如果没有 Uber Direct，使用店铺自送
      return epDeliveryProvider.STORE_DELIVERY; // 需要添加这个枚举值
    }
    
    // 超过范围
    if (settings.enableSendle) {
      return epDeliveryProvider.SENDLE;
    }
    
    // 超出范围且没有 Sendle，不允许下单
    throw BusinessError.createError(
      eBusinessErrorCode.DELIVERY_DISTANCE_EXCEEDED,
      `配送距离 ${distanceKm} 公里超出最大配送范围 ${settings.maxDeliverKM} 公里，且未开通 Sendle 配送服务`
    );
  }

  /**
   * 验证配送距离是否允许下单
   * 
   * @param distanceKm 配送距离（公里）
   * @param requiresStoreDelivery 订单中是否有产品标记为"自送"
   * @throws BusinessError 如果超出范围且没有 Sendle，或产品要求自送但超出范围
   */
  validateDeliveryDistance(
    distanceKm: number, 
    requiresStoreDelivery: boolean = false,
    deliveryOption?: epDeliveryOption
  ): void {
    const settings = this.getShippingSettings();
    const isWithinLocalRange = distanceKm <= settings.maxDeliverKM;
    
    // 如果订单中有产品标记为"自送"
    if (requiresStoreDelivery) {
      // 必须使用店铺自送或自提
      // 如果选择配送且超出范围，不允许下单
      if (deliveryOption === epDeliveryOption.DELIVER && !isWithinLocalRange) {
        throw BusinessError.createError(
          eBusinessErrorCode.DELIVERY_DISTANCE_EXCEEDED,
          `订单中包含必须店铺自送的产品，但配送距离 ${distanceKm} 公里超出最大配送范围 ${settings.maxDeliverKM} 公里，请选择自提或更换地址`
        );
      }
      return; // 产品要求自送，且（选择自提或距离在范围内），验证通过
    }
    
    // 如果超出店铺自送范围
    if (!isWithinLocalRange) {
      // 且没有开通 Sendle
      if (!settings.enableSendle) {
        throw BusinessError.createError(
          eBusinessErrorCode.DELIVERY_DISTANCE_EXCEEDED,
          `配送距离 ${distanceKm} 公里超出最大配送范围 ${settings.maxDeliverKM} 公里，且未开通 Sendle 配送服务`
        );
      }
    }
  }

  /**
   * 计算各服务商的运费和预计时间
   */
  async calculateProviderFees(
    distanceKm: number,
    totalAmount: number,
    originAddress: string,
    destinationAddress: string,
    shippingFeeService?: any // 用于计算店铺自送运费
  ): Promise<iDeliveryProviderInfo[]> {
    const settings = this.getShippingSettings();
    const providers: iDeliveryProviderInfo[] = [];
    const isWithinLocalRange = distanceKm <= settings.maxDeliverKM;
    const isWithinUberDirectRange = distanceKm <= settings.uberDirectMaxDistance;
    
    // 16公里内（或 maxDeliverKM 内）
    if (isWithinLocalRange) {
      // 如果开通了 Uber Direct
      if (settings.enableUberDirect && isWithinUberDirectRange) {
        const uberInfo = await this.getUberDirectQuote(distanceKm, totalAmount, originAddress, destinationAddress);
        providers.push(uberInfo);
      }
      
      // 店铺自送（如果没有 Uber Direct，或者作为备选显示）
      if (!settings.enableUberDirect || !isWithinUberDirectRange) {
        // 使用现有的运费计算方式
        const storeFee = shippingFeeService?.calculateShippingFee(totalAmount, distanceKm) || 0;
        providers.push({
          provider: epDeliveryProvider.STORE_DELIVERY,
          name: '店铺自送',
          estimatedDeliveryTime: '1-2小时',
          estimatedDeliveryHours: 2,
          price: storeFee,
          distanceKm,
          isAvailable: true
        });
      }
    }
    
    // 超过范围
    if (!isWithinLocalRange && settings.enableSendle) {
      const sendleInfo = await this.getSendleQuote(distanceKm, totalAmount, originAddress, destinationAddress);
      providers.push(sendleInfo);
    }

    return providers;
  }

  private async getUberDirectQuote(
    distanceKm: number, 
    totalAmount: number,
    originAddress: string,
    destinationAddress: string
  ): Promise<iDeliveryProviderInfo> {
    // TODO: 实现 Uber Direct API 调用获取实时报价
    // 调用 UberDirectService.getQuote()
    const { UberDirectService } = require('./uber-direct.service');
    const uberService = new UberDirectService();
    
    try {
      const quote = await uberService.getQuote({
        pickupAddress: originAddress,
        deliveryAddress: destinationAddress
      });
      
      return {
        provider: epDeliveryProvider.UBER_DIRECT,
        name: 'Uber Direct',
        estimatedDeliveryTime: '当日达',
        estimatedDeliveryHours: 2,
        price: quote.price,
        distanceKm,
        isAvailable: true
      };
    } catch (error) {
      // API 调用失败，返回不可用
      return {
        provider: epDeliveryProvider.UBER_DIRECT,
        name: 'Uber Direct',
        estimatedDeliveryTime: '当日达',
        estimatedDeliveryHours: 2,
        price: 0,
        distanceKm,
        isAvailable: false,
        unavailableReason: 'Uber Direct 服务暂时不可用'
      };
    }
  }

  private async getSendleQuote(
    distanceKm: number, 
    totalAmount: number,
    originAddress: string,
    destinationAddress: string
  ): Promise<iDeliveryProviderInfo> {
    // TODO: 实现 Sendle API 调用获取实时报价
    // 调用 SendleService.getQuote()
    const { SendleService } = require('./sendle.service');
    const sendleService = new SendleService();
    
    try {
      // 从地址中提取邮编等信息
      const quote = await sendleService.getQuote({
        pickupSuburb: '', // 需要从地址解析
        pickupPostcode: '',
        deliverySuburb: '',
        deliveryPostcode: '',
        weight: 2.5 // 需要根据订单计算重量
      });
      
      return {
        provider: epDeliveryProvider.SENDLE,
        name: 'Sendle',
        estimatedDeliveryTime: '1-2个工作日',
        estimatedDeliveryHours: 24,
        price: quote.price,
        distanceKm,
        isAvailable: true
      };
    } catch (error) {
      // API 调用失败，返回不可用
      return {
        provider: epDeliveryProvider.SENDLE,
        name: 'Sendle',
        estimatedDeliveryTime: '1-2个工作日',
        estimatedDeliveryHours: 24,
        price: 0,
        distanceKm,
        isAvailable: false,
        unavailableReason: 'Sendle 服务暂时不可用'
      };
    }
  }
}
```

### 2.5 更新运费计算服务

**文件**: `src/domains/shipping/services/shipping-fee.service.ts`

```typescript
// 在 ShippingFeeService 中添加新方法

/**
 * 根据地址计算运费（包含配送服务商信息）
 */
async calculateShippingFeeWithProviders(
  totalAmount: number,
  originAddress: string | iCoordinates,
  destinationAddressId: string,
  userId: string,
  travelMode: eTravelMode = eTravelMode.DRIVING
): Promise<iShippingFeeResponse> {
  // 1. 计算距离
  const distanceResult = await this.calculateShippingFeeByAddress(
    totalAmount,
    originAddress,
    destinationAddressId,
    userId,
    travelMode
  );

  // 2. 检查订单中是否有产品标记为"自送"
  // TODO: 需要从订单项中获取产品信息，检查 requiresStoreDelivery
  // 这里假设已经获取到 requiresStoreDelivery 标志
  const requiresStoreDelivery = false; // TODO: 从订单项中检查
  
  // 3. 验证配送距离（如果超出范围且没有 Sendle，会抛出错误）
  const { DeliveryProviderService } = require('../../delivery/services/delivery-provider.service');
  const deliveryProviderService = new DeliveryProviderService();
  
  // 验证距离，如果超出范围且没有 Sendle，会抛出 BusinessError
  deliveryProviderService.validateDeliveryDistance(distanceResult.distanceKm, requiresStoreDelivery);
  
  // 3. 获取目标地址信息
  const userRepository = new (require('../../user/infrastructure/user.repository').UserRepository)();
  const address = await userRepository.getUserAddressById(destinationAddressId, userId);
  const destinationAddress = address?.formattedAddress || '';

  // 4. 计算各服务商的费用（传入当前服务实例用于计算店铺自送运费）
  const providers = await deliveryProviderService.calculateProviderFees(
    distanceResult.distanceKm,
    totalAmount,
    typeof originAddress === 'string' ? originAddress : '',
    destinationAddress,
    this // 传入当前 ShippingFeeService 实例
  );

  // 5. 推荐服务商
  const recommendedProvider = deliveryProviderService.getRecommendedProvider(
    distanceResult.distanceKm, 
    requiresStoreDelivery
  );
  
  // 6. 根据推荐服务商确定最终运费
  const recommendedProviderInfo = providers.find(p => p.provider === recommendedProvider);
  const finalShippingFee = recommendedProviderInfo?.price || distanceResult.shippingFee;

  return {
    shippingFee: finalShippingFee, // 使用推荐服务商的价格
    distanceKm: distanceResult.distanceKm,
    distanceMeters: distanceResult.distanceMeters,
    providers,
    recommendedProvider
  };
}
```

### 2.6 更新运费计算控制器

**文件**: `src/domains/shipping/controllers/shipping-fee.controller.ts`

```typescript
// 更新 calculateShippingFeeByAddress 方法，返回配送服务商信息

async calculateShippingFeeByAddress(req: Request, res: Response) {
  try {
    // ... 现有代码 ...

    // 使用新的方法计算运费（包含配送服务商信息）
    const result = await this.shippingFeeService.calculateShippingFeeWithProviders(
      totalAmount,
      originAddress,
      destinationAddressId,
      userId,
      eTravelMode.DRIVING 
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    // ... 错误处理 ...
  }
}
```

### 2.7 创建配送服务商 API 集成

#### 2.7.1 Uber Direct 集成

**文件**: `src/domains/delivery/services/uber-direct.service.ts`

```typescript
export class UberDirectService {
  private apiKey: string;
  private apiUrl: string;

  constructor() {
    // 从环境变量或配置获取
    this.apiKey = process.env.UBER_DIRECT_API_KEY || '';
    this.apiUrl = process.env.UBER_DIRECT_API_URL || 'https://api.uber.com/v1/direct';
  }

  /**
   * 创建配送订单（单点）
   */
  async createDelivery(params: {
    pickupAddress: string;
    deliveryAddress: string;
    scheduledPickupTime?: Date;
    items: Array<{ description: string; quantity: number }>;
  }): Promise<{
    orderId: string;
    trackingNumber: string;
    trackingUrl: string;
    estimatedDeliveryTime: Date;
  }> {
    // TODO: 实现 Uber Direct API 调用
    // POST /v1/direct/deliveries
  }

  /**
   * 创建多点配送订单（批量配送）
   * 
   * @param params 多点配送参数
   * @returns 配送订单信息
   */
  async createMultiStopDelivery(params: {
    pickupAddress: string;
    pickupLatitude?: number;
    pickupLongitude?: number;
    stops: Array<{
      orderId: string;
      address: string;
      contactName: string;
      contactNumber: string;
      latitude?: number;
      longitude?: number;
    }>;
    scheduledPickupTime: Date;
    items: Array<{ description: string; quantity: number }>;
  }): Promise<{
    orderId: string;
    trackingNumber: string;
    trackingUrl: string;
    estimatedDeliveryTime: Date;
  }> {
    // TODO: 实现 Uber Direct 多点配送 API 调用
    // POST /v1/direct/deliveries/multi-stop
    // 最多支持 14 个配送点
    if (params.stops.length > 14) {
      throw new Error('Uber Direct 多点配送最多支持 14 个配送点');
    }
    
    // 准备 API 请求数据
    const requestData = {
      pickup: {
        address: params.pickupAddress,
        latitude: params.pickupLatitude,
        longitude: params.pickupLongitude
      },
      stops: params.stops.map(stop => ({
        address: stop.address,
        latitude: stop.latitude,
        longitude: stop.longitude,
        contact_name: stop.contactName,
        contact_number: stop.contactNumber
      })),
      scheduled_pickup_time: params.scheduledPickupTime.toISOString(),
      items: params.items
    };
    
    // 调用 Uber Direct API
    // const response = await this.apiCall('POST', '/deliveries/multi-stop', requestData);
    // return response;
    
    // TODO: 实现实际 API 调用
    throw new Error('Uber Direct 多点配送 API 待实现');
  }

  /**
   * 追踪配送
   */
  async trackDelivery(orderId: string): Promise<any> {
    // TODO: 实现追踪 API 调用
    // GET /v1/direct/deliveries/{orderId}
  }

  /**
   * 获取报价
   */
  async getQuote(params: {
    pickupAddress: string;
    deliveryAddress: string;
  }): Promise<{
    price: number;
    estimatedDeliveryTime: Date;
  }> {
    // TODO: 实现报价 API 调用
  }
}
```

#### 2.7.2 Sendle 集成

**文件**: `src/domains/delivery/services/sendle.service.ts`

```typescript
export class SendleService {
  private sendleId: string;
  private apiKey: string;
  private apiUrl: string;

  constructor() {
    // 从环境变量或配置获取
    this.sendleId = process.env.SENDLE_ID || '';
    this.apiKey = process.env.SENDLE_API_KEY || '';
    this.apiUrl = process.env.SENDLE_API_URL || 'https://sandbox.sendle.com/api';
  }

  /**
   * 创建配送订单
   */
  async createOrder(params: {
    pickupDate: string; // YYYY-MM-DD
    description: string;
    weight: { value: number; units: string };
    dimensions: { length: number; width: number; height: number; units: string };
    sender: any;
    receiver: any;
  }): Promise<{
    orderId: string;
    trackingNumber: string;
    labelUrl: string;
  }> {
    // TODO: 实现 Sendle API 调用
    // POST /api/orders
  }

  /**
   * 追踪配送
   */
  async trackOrder(trackingNumber: string): Promise<any> {
    // TODO: 实现追踪 API 调用
    // GET /api/tracking/{trackingNumber}
  }

  /**
   * 获取报价
   */
  async getQuote(params: {
    pickupSuburb: string;
    pickupPostcode: string;
    deliverySuburb: string;
    deliveryPostcode: string;
    weight: number;
  }): Promise<{
    price: number;
    estimatedDeliveryDays: number;
  }> {
    // TODO: 实现报价 API 调用
    // GET /api/quote
  }
}
```

### 2.8 创建配送管理服务

**文件**: `src/domains/delivery/services/delivery-management.service.ts`

```typescript
export class DeliveryManagementService {
  /**
   * 创建配送订单（根据订单信息自动选择服务商）
   */
  async createDeliveryForOrder(orderId: string): Promise<void> {
    // 1. 获取订单信息
    // 2. 根据距离选择服务商
    // 3. 调用对应的服务商 API 创建配送
    // 4. 更新订单的配送信息
  }

  /**
   * 同步配送状态
   */
  async syncDeliveryStatus(orderId: string): Promise<void> {
    // 1. 获取订单的配送服务商信息
    // 2. 调用对应服务商的追踪 API
    // 3. 更新订单状态
  }

  /**
   * 批量创建配送（用于 Offer 订单）
   * 
   * @param orderIds 订单ID列表（Offer 订单）
   * @param deliveryDate 配送日期
   */
  async batchCreateDeliveriesForOffer(orderIds: string[], deliveryDate: Date): Promise<void> {
    // 1. 获取所有订单信息
    const orders = await this.orderRepository.findByIds(orderIds);
    
    // 2. 验证所有订单都是 Offer 订单
    const nonOfferOrders = orders.filter(o => o.mode !== epOrderMode.OFFER);
    if (nonOfferOrders.length > 0) {
      throw new Error('批量配送只能用于 Offer 订单');
    }
    
    // 3. 按配送服务商分组
    const groups = await this.groupOrdersByProvider(orders);
    
    // 4. 对每个服务商分组创建批量配送
    for (const group of groups) {
      if (group.provider === epDeliveryProvider.UBER_DIRECT) {
        // Uber Direct：基于经纬度优化分组
        await this.createUberDirectOptimizedBatchDelivery(group.orders, deliveryDate);
      } else if (group.provider === epDeliveryProvider.SENDLE) {
        // Sendle 批量取单（同一天）
        await this.createSendleBatchDelivery(group.orders, deliveryDate);
      } else {
        // 店铺自送，可以合并配送路线
        await this.createStoreBatchDelivery(group.orders, deliveryDate);
      }
    }
  }

  /**
   * 创建 Uber Direct 优化批量配送（基于经纬度距离分组）
   * 
   * 通过经纬度计算所有订单地址的相互间距离，根据距离分组成指定的 N 组订单，
   * 然后按组申请 Uber 取单，确保每个配送员配送的几个地点最小范围，避免交叉浪费配送成本
   * 
   * @param orders 订单列表（都是 Uber Direct）
   * @param deliveryDate 配送日期
   */
  private async createUberDirectOptimizedBatchDelivery(orders: any[], deliveryDate: Date): Promise<void> {
    // 1. 提取所有订单的地址和经纬度
    const orderLocations = await this.extractOrderLocations(orders);
    
    // 2. 计算所有地址之间的相互距离矩阵（Haversine 公式）
    const distanceMatrix = this.calculateDistanceMatrix(orderLocations);
    
    // 3. 根据距离和 Uber Direct 限制（最多 14 个订单）进行优化分组
    const optimizedGroups = this.optimizeDeliveryGroups(orderLocations, distanceMatrix, 14);
    
    // 4. 对每个优化后的组创建 Uber Direct 多点配送
    for (const group of optimizedGroups) {
      const groupOrderIds = group.map(loc => loc.orderId);
      await this.createUberDirectMultiStopDelivery(groupOrderIds, deliveryDate);
    }
  }

  /**
   * 提取订单的地址和经纬度信息
   */
  private async extractOrderLocations(orders: any[]): Promise<Array<{
    orderId: string;
    address: string;
    latitude: number;
    longitude: number;
    order: any;
  }>> {
    const locations: Array<{
      orderId: string;
      address: string;
      latitude: number;
      longitude: number;
      order: any;
    }> = [];

    for (const order of orders) {
      const addressSnapshot = order.deliveryAddressSnapshot;
      
      if (!addressSnapshot) {
        throw new Error(`订单 ${order.id} 缺少配送地址信息`);
      }

      // 从地址快照中获取经纬度
      const latitude = addressSnapshot.latitude;
      const longitude = addressSnapshot.longitude;

      if (!latitude || !longitude) {
        // 如果没有经纬度，尝试从地址字符串获取
        const coordinates = await this.getCoordinatesFromAddress(
          addressSnapshot.formattedAddress || this.formatAddress(addressSnapshot)
        );
        
        if (!coordinates) {
          throw new Error(`订单 ${order.id} 的地址无法获取经纬度`);
        }
        
        locations.push({
          orderId: order.id,
          address: addressSnapshot.formattedAddress || this.formatAddress(addressSnapshot),
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          order
        });
      } else {
        locations.push({
          orderId: order.id,
          address: addressSnapshot.formattedAddress || this.formatAddress(addressSnapshot),
          latitude: Number(latitude),
          longitude: Number(longitude),
          order
        });
      }
    }

    return locations;
  }

  /**
   * 计算所有地址之间的相互距离矩阵（使用 Haversine 公式）
   * 
   * @param locations 地址列表
   * @returns 距离矩阵，distanceMatrix[i][j] 表示 locations[i] 到 locations[j] 的距离（公里）
   */
  private calculateDistanceMatrix(locations: Array<{ latitude: number; longitude: number }>): number[][] {
    const matrix: number[][] = [];
    const R = 6371; // 地球半径（公里）

    for (let i = 0; i < locations.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < locations.length; j++) {
        if (i === j) {
          matrix[i][j] = 0;
        } else {
          const loc1 = locations[i];
          const loc2 = locations[j];
          
          // Haversine 公式计算两点间距离
          const dLat = this.toRadians(loc2.latitude - loc1.latitude);
          const dLon = this.toRadians(loc2.longitude - loc1.longitude);
          
          const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(this.toRadians(loc1.latitude)) * Math.cos(this.toRadians(loc2.latitude)) *
                    Math.sin(dLon / 2) * Math.sin(dLon / 2);
          
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distance = R * c;
          
          matrix[i][j] = distance;
        }
      }
    }

    return matrix;
  }

  /**
   * 优化配送分组（基于距离聚类）
   * 
   * 使用改进的 K-means 聚类算法，确保：
   * 1. 每组订单数量不超过 Uber Direct 限制（14个）
   * 2. 组内订单之间的距离最小化
   * 3. 组与组之间的距离最大化（避免交叉）
   * 
   * @param locations 订单地址列表
   * @param distanceMatrix 距离矩阵
   * @param maxOrdersPerGroup 每组最大订单数（Uber Direct 限制为 14）
   * @returns 优化后的分组列表
   */
  private optimizeDeliveryGroups(
    locations: Array<{ orderId: string; latitude: number; longitude: number }>,
    distanceMatrix: number[][],
    maxOrdersPerGroup: number
  ): Array<Array<{ orderId: string; latitude: number; longitude: number }>> {
    if (locations.length === 0) {
      return [];
    }

    // 如果订单数量少于等于 maxOrdersPerGroup，直接返回一组
    if (locations.length <= maxOrdersPerGroup) {
      return [locations];
    }

    // 计算需要的组数
    const numGroups = Math.ceil(locations.length / maxOrdersPerGroup);

    // 使用改进的 K-means 聚类算法
    const groups = this.kMeansClustering(locations, numGroups, maxOrdersPerGroup, distanceMatrix);

    return groups;
  }

  /**
   * K-means 聚类算法（改进版，考虑距离矩阵和最大组大小限制）
   */
  private kMeansClustering(
    locations: Array<{ orderId: string; latitude: number; longitude: number }>,
    k: number,
    maxSize: number,
    distanceMatrix: number[][]
  ): Array<Array<{ orderId: string; latitude: number; longitude: number }>> {
    // 初始化：随机选择 k 个中心点
    const centers: Array<{ latitude: number; longitude: number; index: number }> = [];
    const usedIndices = new Set<number>();
    
    for (let i = 0; i < k; i++) {
      let randomIndex;
      do {
        randomIndex = Math.floor(Math.random() * locations.length);
      } while (usedIndices.has(randomIndex));
      
      usedIndices.add(randomIndex);
      centers.push({
        latitude: locations[randomIndex].latitude,
        longitude: locations[randomIndex].longitude,
        index: randomIndex
      });
    }

    let groups: Array<Array<{ orderId: string; latitude: number; longitude: number }>> = [];
    let changed = true;
    let iterations = 0;
    const maxIterations = 100;

    while (changed && iterations < maxIterations) {
      iterations++;
      
      // 分配每个点到最近的中心点
      groups = Array(k).fill(null).map(() => []);
      
      for (let i = 0; i < locations.length; i++) {
        let minDistance = Infinity;
        let nearestCenterIndex = 0;
        
        // 找到最近的中心点
        for (let j = 0; j < centers.length; j++) {
          const centerIndex = centers[j].index;
          const distance = distanceMatrix[i][centerIndex];
          
          if (distance < minDistance) {
            minDistance = distance;
            nearestCenterIndex = j;
          }
        }
        
        // 检查组大小限制
        if (groups[nearestCenterIndex].length < maxSize) {
          groups[nearestCenterIndex].push(locations[i]);
        } else {
          // 如果最近的组已满，找下一个最近的未满组
          let assigned = false;
          for (let j = 0; j < groups.length; j++) {
            if (groups[j].length < maxSize) {
              const centerIndex = centers[j].index;
              const distance = distanceMatrix[i][centerIndex];
              if (!assigned || distance < minDistance) {
                minDistance = distance;
                nearestCenterIndex = j;
                assigned = true;
              }
            }
          }
          groups[nearestCenterIndex].push(locations[i]);
        }
      }

      // 更新中心点（使用组内所有点的平均位置）
      changed = false;
      for (let i = 0; i < centers.length; i++) {
        if (groups[i].length === 0) continue;
        
        const avgLat = groups[i].reduce((sum, loc) => sum + loc.latitude, 0) / groups[i].length;
        const avgLon = groups[i].reduce((sum, loc) => sum + loc.longitude, 0) / groups[i].length;
        
        // 找到组内最接近平均位置的点作为新中心
        let minDist = Infinity;
        let newCenterIndex = centers[i].index;
        
        for (let j = 0; j < groups[i].length; j++) {
          const loc = groups[i][j];
          const dist = Math.sqrt(
            Math.pow(loc.latitude - avgLat, 2) + Math.pow(loc.longitude - avgLon, 2)
          );
          if (dist < minDist) {
            minDist = dist;
            const originalIndex = locations.findIndex(l => l.orderId === loc.orderId);
            newCenterIndex = originalIndex;
          }
        }
        
        if (newCenterIndex !== centers[i].index) {
          centers[i].index = newCenterIndex;
          centers[i].latitude = locations[newCenterIndex].latitude;
          centers[i].longitude = locations[newCenterIndex].longitude;
          changed = true;
        }
      }
    }

    // 移除空组
    return groups.filter(group => group.length > 0);
  }

  /**
   * 创建 Uber Direct 多点配送（一组订单）
   */
  private async createUberDirectMultiStopDelivery(orderIds: string[], deliveryDate: Date): Promise<void> {
    // 1. 获取订单信息
    const orders = await this.orderRepository.findByIds(orderIds);
    
    // 2. 准备多点配送数据
    const stops = orders.map(order => ({
      address: order.deliveryAddressSnapshot.formattedAddress,
      latitude: order.deliveryAddressSnapshot.latitude,
      longitude: order.deliveryAddressSnapshot.longitude,
      contactName: order.deliveryAddressSnapshot.contactName,
      contactNumber: order.deliveryAddressSnapshot.contactNumber
    }));
    
    // 3. 调用 Uber Direct API 创建多点配送
    const { UberDirectService } = require('./uber-direct.service');
    const uberService = new UberDirectService();
    
    const result = await uberService.createMultiStopDelivery({
      pickupAddress: await this.getStoreAddress(),
      stops: stops,
      scheduledPickupTime: deliveryDate
    });
    
    // 4. 更新所有订单的配送信息
    const batchId = `uber_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    for (const order of orders) {
      await this.updateOrderDeliveryInfo(order.id, {
        provider: epDeliveryProvider.UBER_DIRECT,
        providerOrderId: result.orderId,
        trackingNumber: result.trackingNumber,
        trackingUrl: result.trackingUrl,
        batchId: batchId,
        scheduledPickupTime: deliveryDate
      });
    }
  }

  /**
   * 辅助方法：角度转弧度
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * 辅助方法：从地址获取经纬度
   */
  private async getCoordinatesFromAddress(address: string): Promise<{ latitude: number; longitude: number } | null> {
    try {
      const { GoogleMapsService } = require('../../google-maps/services/google-maps.service');
      const { configUtil } = require('../../../shared/config/config.util');
      const googleMapsConfig = configUtil.getGoogleMapsConfig();
      const googleMapsService = new GoogleMapsService(googleMapsConfig);
      
      const result = await googleMapsService.getCoordinatesFromAddress(address, 'en');
      if (result?.results && result.results.length > 0) {
        const location = result.results[0].geometry?.location;
        if (location) {
          return {
            latitude: typeof location.lat === 'function' ? location.lat() : location.lat,
            longitude: typeof location.lng === 'function' ? location.lng() : location.lng
          };
        }
      }
    } catch (error) {
      console.error('获取地址经纬度失败:', error);
    }
    return null;
  }

  /**
   * 辅助方法：格式化地址
   */
  private formatAddress(addressSnapshot: any): string {
    return `${addressSnapshot.streetNumber || ''} ${addressSnapshot.route || ''}, ${addressSnapshot.locality || ''}, ${addressSnapshot.administrativeArea || ''} ${addressSnapshot.postalCode || ''}, ${addressSnapshot.country || ''}`.trim();
  }

  /**
   * 辅助方法：获取店铺地址
   */
  private async getStoreAddress(): Promise<string> {
    const { StoreAddressService } = require('../../store/services/store-address.service');
    const storeService = new StoreAddressService();
    const defaultStore = await storeService.getDefaultStoreAddress();
    return defaultStore?.formattedAddress || '';
  }

  /**
   * 按配送服务商分组订单
   */
  private async groupOrdersByProvider(orders: any[]): Promise<Array<{ provider: epDeliveryProvider; orders: any[] }>> {
    const groups = new Map<epDeliveryProvider, any[]>();
    
    for (const order of orders) {
      const provider = order.deliveryProvider || epDeliveryProvider.STORE_DELIVERY;
      
      if (!groups.has(provider)) {
        groups.set(provider, []);
      }
      groups.get(provider)!.push(order);
    }
    
    return Array.from(groups.entries()).map(([provider, orders]) => ({ provider, orders }));
  }

  /**
   * 创建 Sendle 批量配送（同一天取单）
   */
  private async createSendleBatchDelivery(orders: any[], deliveryDate: Date): Promise<void> {
    // 1. 为每个订单创建 Sendle 配送订单
    // 2. 使用相同的取件日期
    // 3. Sendle 会安排同一天取单
    // TODO: 实现
  }

  /**
   * 创建店铺自送批量配送（合并配送路线）
   */
  private async createStoreBatchDelivery(orders: any[], deliveryDate: Date): Promise<void> {
    // 1. 优化配送路线
    // 2. 创建配送任务
    // 3. 更新订单状态
    // TODO: 实现
  }
}
```

---

## 📱 微信小程序前端改动

### 3.1 更新运费计算工具

**文件**: `lib/order-shipping.util.ts`

```typescript
// 更新 calculateAndSetShippingFee 方法
async calculateAndSetShippingFee(pageCtx: iPageCtxForShipping): Promise<void> {
  const { deliveryOption, selectedAddressId, totalAmount } = pageCtx.data;

  if (deliveryOption === epDeliveryOption.PICK_UP) {
    pageCtx.setData({ 
      shippingFee: 0, 
      shippingDistance: 0,
      deliveryProviders: [],
      recommendedProvider: null
    });
    pageCtx.updateFinalAmount();
    return;
  }

  if (deliveryOption === epDeliveryOption.DELIVER) {
    if (!selectedAddressId || !totalAmount) {
      pageCtx.setData({ 
        shippingFee: 0, 
        shippingDistance: 0,
        deliveryProviders: [],
        recommendedProvider: null
      });
      pageCtx.updateFinalAmount();
      return;
    }

    try {
      pageCtx.setData({ isCalculatingShipping: true as unknown as never });
      const result = await Commerce.calculateShippingFeeByAddress({
        totalAmount,
        destinationAddressId: selectedAddressId
      });
      
      // 更新数据，包含配送服务商信息
      pageCtx.setData({ 
        shippingFee: result.shippingFee, 
        shippingDistance: result.distanceKm,
        deliveryProviders: result.providers || [],
        recommendedProvider: result.recommendedProvider || null
      });
      pageCtx.updateFinalAmount();
    } catch (err) {
      pageCtx.setData({ 
        shippingFee: 0, 
        shippingDistance: 0,
        deliveryProviders: [],
        recommendedProvider: null
      });
      pageCtx.updateFinalAmount();
    } finally {
      pageCtx.setData({ isCalculatingShipping: false as unknown as never });
    }
  }
}
```

### 3.2 更新配送选择组件

**文件**: `components/delivery-selector/deliverySelector.wxml`

```xml
<!-- 在配送地址选择后，显示配送服务商信息 -->
<view class="delivery-provider-info" wx:if="{{selectedDeliveryOption === 'delivery' && deliveryProviders && deliveryProviders.length > 0}}">
  <view class="provider-list">
    <view 
      class="provider-item {{item.provider === recommendedProvider ? 'recommended' : ''}}"
      wx:for="{{deliveryProviders}}" 
      wx:key="provider">
      <view class="provider-name">{{item.name}}</view>
      <view class="provider-time">{{item.estimatedDeliveryTime}}</view>
      <view class="provider-price">${{item.price}}</view>
      <view class="recommended-badge" wx:if="{{item.provider === recommendedProvider}}">推荐</view>
    </view>
  </view>
</view>
```

### 3.3 更新订单创建逻辑

**文件**: `lib/commerce.ts`

```typescript
// 在创建订单时，传递推荐的服务商
async createRegularOrder(params: {
  cartItemIds: string[];
  deliveryAddressId: string;
  paymentMethod?: string;
  note?: string;
  deliveryProvider?: string; // 新增：用户选择的配送服务商
}): Promise<any> {
  // ... 现有代码 ...
}
```

---

## 🖥️ CMS 管理界面改动

### 4.1 配送服务商配置页面

**文件**: `src/pages/delivery-settings.tsx`

```typescript
// 新建页面：配送服务商配置
// 功能：
// 1. Uber Direct API 配置（API Key, API URL）
// 2. Sendle API 配置（Sendle ID, API Key）
// 3. 配送范围设置（Uber Direct 最大距离）
// 4. 默认服务商选择
// 5. 自动化规则设置
```

### 4.2 订单管理页面增强

**文件**: `src/pages/orders.tsx`

```typescript
// 在订单列表中显示：
// 1. 配送服务商（Uber Direct / Sendle）
// 2. 追踪号码
// 3. 预计送达时间
// 4. 配送状态

// 在订单详情中显示：
// 1. 配送服务商信息
// 2. 追踪链接
// 3. 配送历史记录
// 4. 手动创建配送按钮
// 5. 同步配送状态按钮
```

### 4.3 配送管理页面

**文件**: `src/pages/delivery-management.tsx`

```typescript
// 新建页面：配送管理
// 功能：
// 1. 待配送订单列表
// 2. 批量创建配送
// 3. 配送状态监控
// 4. 配送异常处理
// 5. 配送统计报表
```

### 4.4 配送自动化设置

**文件**: `src/pages/delivery-automation.tsx`

```typescript
// 新建页面：配送自动化设置
// 功能：
// 1. 自动创建配送规则
//   - 订单状态触发（如：ready_for_delivery）
//   - 自动选择服务商规则
//   - 批量配送时间设置
// 2. 自动同步配送状态
//   - 同步频率设置
//   - Webhook 配置
// 3. 异常处理规则
//   - 配送失败自动重试
//   - 自动通知设置
```

---

## 🔄 API 路由改动

### 5.1 新增配送相关路由

**文件**: `src/domains/delivery/routes/delivery.routes.ts`

```typescript
// POST /api/delivery/create - 创建配送订单
// GET /api/delivery/track/:orderId - 追踪配送
// POST /api/delivery/sync-status - 同步配送状态
// POST /api/delivery/batch-create - 批量创建配送
```

### 5.2 更新订单路由

**文件**: `src/domains/order/routes/order.routes.ts`

```typescript
// 在创建订单时，自动创建配送订单（如果启用自动化）
```

---

## 📝 环境变量配置

```env
# Uber Direct
UBER_DIRECT_API_KEY=your_api_key
UBER_DIRECT_API_URL=https://api.uber.com/v1/direct

# Sendle
SENDLE_ID=your_sendle_id
SENDLE_API_KEY=your_api_key
SENDLE_API_URL=https://sandbox.sendle.com/api  # 或生产环境 URL
```

---

## ✅ 实施步骤

1. **第一阶段：数据库和基础服务**
   - 创建数据库迁移
   - 创建枚举和类型定义
   - 创建配送服务商服务

2. **第二阶段：API 集成**
   - 实现 Uber Direct API 集成
   - 实现 Sendle API 集成
   - 更新运费计算 API

3. **第三阶段：前端改动**
   - 更新微信小程序配送选择组件
   - 更新订单创建流程

4. **第四阶段：CMS 管理界面**
   - 创建配送配置页面
   - 增强订单管理页面
   - 创建配送管理页面
   - 创建自动化设置页面

5. **第五阶段：测试和优化**
   - 单元测试
   - 集成测试
   - 性能优化

---

## 📌 注意事项

1. **API 密钥安全**：所有 API 密钥存储在环境变量中，不要硬编码
2. **错误处理**：完善的错误处理和重试机制
3. **日志记录**：记录所有配送操作，便于追踪和调试
4. **成本控制**：监控配送成本，设置预算限制
5. **用户体验**：清晰显示配送服务商和预计时间
6. **自动化规则**：谨慎设置自动化规则，避免误操作

---

## 🎯 关键改动总结

### 1. 平台设置扩展

在 `iShippingSettings` 中添加三个新字段：
- `enableUberDirect: boolean` - 是否开通 Uber Direct
- `enableSendle: boolean` - 是否开通 Sendle  
- `uberDirectMaxDistance: number` - Uber Direct 最大配送距离（默认 16 公里）

### 2. 配送服务商选择逻辑

```
距离判断流程：
├─ 距离 ≤ maxDeliverKM（如 10 公里）
│  ├─ 如果 enableUberDirect = true 且 距离 ≤ uberDirectMaxDistance
│  │  └─ 使用 Uber Direct（当日达）
│  └─ 否则
│     └─ 使用店铺自送（现有距离×价格计算）
│
└─ 距离 > maxDeliverKM
   ├─ 如果 enableSendle = true
   │  └─ 允许使用 Sendle（标准配送）
   └─ 否则
      └─ ❌ 不允许下单（抛出 DELIVERY_DISTANCE_EXCEEDED 错误）
```

### 3. 运费计算逻辑

- **Uber Direct**：调用 Uber Direct API 获取实时报价
- **店铺自送**：使用现有计算方式（距离×价格 - 订单总值百分比抵扣）
- **Sendle**：调用 Sendle API 获取实时报价

### 4. 前端验证

在用户选择地址后：
1. 检查购物车中是否有产品标记为"自送"
   - 如果有，禁用 Uber Direct 和 Sendle，只显示店铺自送或自提
2. 如果是 Preorder 订单，禁用 Sendle（只显示自送或 Uber Direct）
3. 计算距离
4. 验证是否允许配送
   - 如果产品要求自送且选择配送超出范围，提示选择自提或更换地址
   - 如果超出范围且没有 Sendle，显示错误提示
5. 显示可用的配送服务商选项
6. 默认选择推荐的服务商

### 5. 订单创建时的配送处理

```
Regular 订单：
└─ 订单创建后 → 立即调用 createDeliveryForOrder(orderId, true)
   └─ ASAP，立即取货

Offer 订单：
└─ 订单创建后 → 不立即创建配送
   └─ 在发货日期前，批量调用 batchCreateDeliveriesForOffer(orderIds, deliveryDate)
      └─ Uber/Sendle 一次性取走这批订单（同一天）

Preorder 订单：
└─ 订单创建后 → 不立即创建配送
   └─ 在配送时段前，调用 createDeliveryForPreorder(orderId, deliveryTimeSlot)
      └─ 取件时间 = 配送时段开始时间 - 1小时
      └─ 只能自送或单个取单 Uber 配送（不使用 Sendle）
```

---

## 💡 实施建议

### 阶段一：基础功能（必须）

1. **产品"自送"标记**
   - 在产品表中添加 `requiresStoreDelivery` 字段
   - 更新产品类型定义
   - 在 CMS 产品编辑页面添加开关

2. **更新平台设置类型**
   - 在 `iShippingSettings` 中添加三个开关字段
   - 更新数据库迁移，添加默认值

3. **实现配送服务商选择逻辑**
   - 创建 `DeliveryProviderService`
   - 实现距离验证和服务商选择
   - 实现产品"自送"标记检查逻辑

4. **更新运费计算 API**
   - 修改 `calculateShippingFeeByAddress` 返回配送服务商信息
   - 检查订单中产品的"自送"标记
   - 根据推荐服务商返回对应价格

5. **订单创建时的配送处理**
   - Regular 订单：立即创建配送
   - Offer/Preorder 订单：批量创建配送逻辑

6. **前端显示**
   - 在配送选择组件中检查产品"自送"标记
   - 显示配送服务商信息
   - 处理超出范围的错误提示

### 阶段二：API 集成（可选，可先用模拟数据）

1. **Uber Direct API 集成**
   - 实现报价 API
   - 实现创建配送订单 API
   - 实现追踪 API

2. **Sendle API 集成**
   - 实现报价 API
   - 实现创建订单 API
   - 实现追踪 API

### 阶段三：管理界面（可选）

1. **CMS 配置页面**
   - 配送服务商开关设置
   - API 密钥配置

2. **订单管理增强**
   - 显示配送服务商信息
   - 配送追踪功能

---

## 🔄 向后兼容性

- 如果 `enableUberDirect = false` 且 `enableSendle = false`，系统行为与现有完全一致（使用店铺自送）
- 现有的运费计算逻辑保持不变，只是增加了新的服务商选项
- 订单表中的 `delivery_provider` 字段可以为空，兼容旧订单

---

## 🎯 Offer 订单 Uber Direct 优化分组算法

### 算法概述

通过经纬度计算所有订单地址的相互间距离，使用改进的 K-means 聚类算法进行优化分组，确保：
1. 每组订单数量不超过 Uber Direct 限制（14个）
2. 组内订单之间的距离最小化（减少配送员行驶距离）
3. 组与组之间的距离最大化（避免交叉，减少配送成本）

### 算法步骤

```
1. 提取订单地址和经纬度
   ├─ 从订单的 delivery_address_snapshot 获取经纬度
   └─ 如果没有经纬度，通过 Google Maps API 获取

2. 计算距离矩阵
   └─ 使用 Haversine 公式计算所有地址之间的相互距离
      └─ 生成 N×N 距离矩阵（N = 订单数量）

3. 优化分组（改进的 K-means 聚类）
   ├─ 计算需要的组数：ceil(订单数 / 14)
   ├─ 随机初始化 k 个中心点
   ├─ 迭代分配：
   │  ├─ 将每个订单分配到最近的中心点
   │  ├─ 检查组大小限制（最多 14 个）
   │  └─ 如果组已满，分配到下一个最近的未满组
   └─ 更新中心点（组内平均位置）
      └─ 重复直到收敛或达到最大迭代次数

4. 按组创建多点配送
   └─ 每组最多 14 个订单，调用 Uber Direct 多点配送 API
```

### 算法优势

1. **成本优化**：组内距离最小化，减少配送员行驶距离
2. **避免交叉**：组与组之间距离最大化，避免配送路线交叉
3. **符合限制**：严格遵守 Uber Direct 最多 14 个订单的限制
4. **自动处理**：无需手动分组，系统自动优化

### 性能考虑

- **距离矩阵计算**：O(N²) 时间复杂度，对于 100 个订单约需计算 10,000 次距离
- **K-means 聚类**：O(N×k×iterations)，通常 10-100 次迭代即可收敛
- **优化建议**：
  - 如果订单数量 > 200，考虑分批处理
  - 可以缓存距离矩阵，避免重复计算
  - 考虑使用更高效的聚类算法（如 DBSCAN）处理大规模数据

