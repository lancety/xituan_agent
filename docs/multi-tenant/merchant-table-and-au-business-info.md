# Merchant 表结构与澳洲商户主体信息分析

## 一、当前 Merchant 表结构（已存数据）

### 1. 表位置与 DDL

- **Schema**: `platform`
- **表名**: `platform.merchants`
- **迁移**: `1710000000221_split_schemas_platform_and_merchant.sql`

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK, default gen_random_uuid() | 主键 |
| code | VARCHAR(50) | UNIQUE NOT NULL | 商户编码，唯一（如 'DEFAULT'） |
| name | VARCHAR(255) | NOT NULL | 商户名称 |
| status | VARCHAR(20) | NOT NULL, default 'active' | 状态：active / inactive / suspended |
| subscription_plan | VARCHAR(50) | nullable | 订阅计划类型 |
| created_at | TIMESTAMP WITH TIME ZONE | | 创建时间 |
| updated_at | TIMESTAMP WITH TIME ZONE | | 更新时间 |

### 2. 关联表（同 schema）

- **platform.user_merchants**: 用户与商户（**内部成员**）关联，含 `role`、`is_default`，用于 JWT 选商户与商户访问/权限校验。不存商户–顾客关系；商户–顾客若需持久化则单独建表。
- **platform.merchant_subscriptions**: 商户订阅记录（plan_type, start_date, end_date, is_active）。

### 3. 当前实体（merchant.entity.ts）

- 字段与上表一致；`subscriptionPlan` 已做列名映射 `name: 'subscription_plan'`。
- 无联系人、电话、地址、税务标识（ABN/TFN/ACN）、主体类型等字段。

---

## 二、澳洲经营主体与平台通常需要的信息

### 1. 主体类型概览

| 类型 | 英文 | 说明 |
|------|------|------|
| 个体户 | Sole trader | 个人经营，个人承担无限责任，可用个人 TFN |
| 公司 | Company | 在 ASIC 注册，有 ACN，法人实体 |
| 合伙 | Partnership | 多人合伙经营，可申请 ABN |
| 信托 | Trust | 由受托人运营，可申请 ABN |

多商户平台通常需区分：**个人（个体户）** 与 **公司**，部分场景再区分合伙/信托。

### 2. 澳洲常用标识符

| 标识 | 全称 | 位数/格式 | 适用对象 | 说明 |
|------|------|-----------|----------|------|
| **TFN** | Tax File Number | 9 位数字 | 个人/个体户 | 个人报税用；个体户可用个人 TFN |
| **ABN** | Australian Business Number | 11 位数字 | 经营实体（个体/公司/合伙等） | 经营必备；无 ABN 时付款方可能扣 47% 预扣税 |
| **ACN** | Australian Company Number | 9 位数字 | 仅公司 | ASIC 注册公司时分配 |
| **GST** | Goods and Services Tax | 与 ABN 关联 | 营业额≥$75,000 或自愿注册 | 需先有 ABN 才能注册 GST |
| **Business Name** | - | 在 ASIC 登记 | 以商号经营时 | 可与 ABN 关联查询 |

要点：

- **个体户**：通常需要 **ABN**（经营用）+ 个人 **TFN**（报税用）；平台开票/对账常用 ABN。
- **公司**：需要 **ACN**（公司身份）+ **ABN**（公司作为经营实体）；平台开票/对账用 ABN，必要时展示或校验 ACN。
- 平台一般不直接收集或存储个人 TFN（敏感），但可能需知道「是否已提供 TFN」或仅用于后台税务逻辑；对外开票、合同、对账以 **ABN**（及公司时的 **ACN**）为主。

### 3. 多商户平台建议收集的商户信息（按用途）

- **身份与合规**
  - 主体类型：个体户 / 公司 / 合伙 等（枚举）。
  - **ABN**（必填或强推荐）：开票、对账、合规。
  - **ACN**：当主体类型为「公司」时必填或推荐。
  - 注册/贸易用名称：Legal name / Trading name / Business name（与现有 `name` 可区分展示名 vs 法定名）。
- **联系与运营**
  - 联系人姓名、电话、邮箱（可与 User 关联，但商户维度保留一份便于开票与客服）。
  - 经营/注册地址：开票、合同、合规。
- **税务**
  - 是否已注册 GST（是/否），可选：GST 注册日期（若需精确开票）。
  - 平台不推荐存储个人 TFN；若业务确需（如代报税），须单独合规与加密存储，且不在商户表里明文。
- **状态与风控**
  - 现有 `status`（active/inactive/suspended）可保留并继续用于风控与生命周期。

---

## 三、与当前 Merchant 表的差距与扩展建议

### 1. 当前缺失且建议后续考虑的字段（设计用，非最终 DDL）

- 主体类型：`business_type` 或 `legal_entity_type`（enum: sole_trader, company）。
- 税务/身份标识：`abn`（11 位）、`acn`（9 位，公司可选）。
- 法定/注册名称：`legal_name`（开票用），与现有 `name`（展示名）区分。
- 联系信息：`contact_name`, `contact_phone`, `contact_email`；或单独 `merchant_contacts` 表。
- 地址：`registered_address` 或单独地址表（若与 store_address 不同）。
- GST：`gst_registered` (boolean)，可选 `gst_registration_date`。

以上为分析结论，具体是否全部落表、是否拆到「商户主体/商户档案」扩展表，需结合申请流程与合规再定。

### 2. 实施顺序建议

1. 先明确「申请成为商户」流程要收集的必填项（如至少 ABN + 主体类型 + 联系人）。
2. 再在 `platform.merchants` 上做最小增量字段（如 `abn`, `legal_entity_type`, `contact_email`），或新增 `merchant_profiles` 扩展表，避免大改现有商户逻辑。
3. 校验：ABN 格式 11 位、ACN 9 位；可对接 ABR Lookup 做可选校验。
4. 合规：TFN 不写入商户表；若将来需要，单独加密存储并做访问控制。

---

## 四、小结

- **当前 Merchant 表**：仅包含 id、code、name、status、subscription_plan、时间戳，无主体类型、无 ABN/ACN、无联系人与地址。
- **澳洲多商户平台**：建议至少收集 **主体类型**、**ABN**、公司时的 **ACN**、**联系人/联系方式** 及 **GST 是否注册**；个人 **TFN** 不推荐进商户表，若有需要则单独合规处理。
- 扩展时可在 `platform.merchants` 增加上述字段或使用扩展表，并配合申请流程与 ABR 校验逐步落地。
