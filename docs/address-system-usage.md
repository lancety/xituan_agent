# 地址系统使用指南

## 概述

新的地址系统基于Google Maps API的地址组件结构，支持更精确的地址解析和存储。

## 地址字段结构

### 新字段映射

| 字段名 | 数据库列名 | Google Maps类型 | 描述 |
|--------|------------|----------------|------|
| streetNumber | street_number | street_number | 门牌号 |
| route | route | route | 街道名称 |
| locality | locality | locality | 城市/地区 |
| administrativeArea | administrative_area | administrative_area_level_1 | 省/州 |
| country | country | country | 国家 |
| postalCode | postal_code | postal_code | 邮政编码 |
| formattedAddress | formatted_address | formatted_address | 完整格式化地址 |
| additionalInfo | additional_info | - | 额外地址信息（如单元号、楼层等） |

## 使用方法

### 1. 从Google Maps API解析地址

```typescript
import { GoogleMapsService } from './domains/google-maps/services/google-maps.service';
import { addressParserUtil } from './utils/address-parser.util';

// 获取地址建议
const suggestions = await googleMapsService.getAddressSuggestions('22 Norfolk St');

// 用户选择某个建议后，获取详细地址
const placeId = 'ChIJE_H-2pin2EcR1CO0XaYu6tE';
const placeDetails = await googleMapsService.getPlaceDetails(placeId);

// 解析为用户地址格式
const userAddress = addressParserUtil.parseGoogleAddressToUserAddress(
  placeDetails.result,
  'Unit 5, Level 2' // 额外信息
);
```

### 2. 验证地址完整性

```typescript
const validation = addressParserUtil.validateAddressComponents(userAddress);

if (!validation.isValid) {
  console.log('缺失字段:', validation.missingFields);
  console.log('警告字段:', validation.warnings);
}
```

### 3. 格式化地址显示

```typescript
// 基础地址显示
const baseAddress = addressParserUtil.formatAddressForDisplay(userAddress, false);

// 完整地址显示（包含额外信息）
const completeAddress = addressParserUtil.formatAddressForDisplay(userAddress, true);
```

### 4. 使用Google Maps服务的高级方法

```typescript
// 直接获取解析后的用户地址
const userAddress = await googleMapsService.getPlaceDetailsAsUserAddress(
  placeId,
  'Unit 5, Level 2', // 额外信息
  'en' // 语言
);

// 验证地址组件
const validation = googleMapsService.validateAddressComponents(userAddress);

// 格式化显示
const displayAddress = googleMapsService.formatAddressForDisplay(userAddress);
```

## 地址解析流程

### 1. 用户输入地址
- 用户在前端输入地址关键词
- 调用 `getAddressSuggestions()` 获取建议列表

### 2. 用户选择地址
- 用户从建议列表中选择一个地址
- 获取对应的 `place_id`

### 3. 获取详细地址信息
- 使用 `place_id` 调用 `getPlaceDetails()`
- 获取完整的地址组件信息

### 4. 解析和存储
- 使用 `parseGoogleAddressToUserAddress()` 解析地址
- 用户可以添加额外信息（如单元号、楼层等）
- 保存到数据库

## 额外信息字段

`additionalInfo` 字段用于存储无法通过Google Maps API自动获取的详细信息：

- 单元号 (Unit 5)
- 楼层信息 (Level 2)
- 房间号 (Room 201)
- 小区内具体位置
- 其他人工输入的地址细节

## 注意事项

1. **地址验证**: 建议在保存前验证地址组件的完整性
2. **额外信息**: 鼓励用户填写额外信息以提高配送准确性
3. **格式化显示**: 优先使用 `formattedAddress`，如果不存在则组合各个组件
4. **错误处理**: 妥善处理Google Maps API调用失败的情况

## 数据库迁移

运行以下迁移脚本更新数据库结构：

```sql
-- 执行迁移
\i migrations/1710000000120_update_user_addresses_structure.sql
```

迁移将：
- 删除旧的地址字段 (province, city, district, address_line1, address_line2)
- 添加新的地址字段
- 创建相应的索引
