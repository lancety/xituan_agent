# Site · 商户信任档（消费侧标签）

Last updated: 2026-11-15

索引：[`site.md`](./site.md) · Badge 视觉：[`badge.md`](./badge.md)

## 意图

列表上的商户类型 = **信任层级**（类淘宝普通店 / 天猫），不是 ASIC 法律主体说明。

## 映射（对外文案；底层枚举不变）

| `epLegalEntityType` / API | 消费侧 zh（推荐） | en（推荐） | 列表样式 |
|---------------------------|-------------------|------------|----------|
| `sole_trader` | 普通店 | Standard shop | soft **状态** badge |
| `company` | 品牌店 | Brand shop | soft **状态** badge（可略醒目） |

法律全称只放商户关于/入驻资料，**不进** `MerchantCard` 主信息行。

## 实现提示

- i18n：`home.merchantType.*`（Site `messages/*.json`）应改为上表消费侧文案（落地时改）。  
- 组件：`MerchantCard`；样式走 [`badge.md`](./badge.md) 状态模式，勿 Ant `Tag`。  
- 日后若有「认证」门槛，再增第三档，勿与法律字段混名。
