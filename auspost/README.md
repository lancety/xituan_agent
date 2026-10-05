# Australia Post eCommerce Partner 资料备注

来源：Abdul 提供的 [eCommerce Partner Resource Centre](https://eng17e.seismic.com/ls/3e81e1f0-a716-48ff-b7d7-b3c8cfa0f440/k9wQJOYcd62bB53v)（Australia Post × eCommerce Partners）。

整理原则：按 Resource Centre 页面区块分子文件夹；邮件附件协议单独放在 `01-legal-agreement`。

**Xituan / Galaxy108 当前主路径**：MyPost Business BYOK（商户自有账户 + Partners Token），不是平台代付 / eParcel float。

**Partner ID（API header 必传）**：`XITUAN-8745`

---

## 文件夹说明

### `01-legal-agreement` — 法律协议

| 文件 | 用途 |
| --- | --- |
| `eCommerce Partner API Licence Agreement - Galaxy108 Pty Ltd.pdf` | 邮件附件协议。签完 Particulars + 授权人/见证人后回传 Abdul；**未签且未通过技术验证前，不能让真实商户走 API 上线**。 |

### `02-technical-onboarding` — 技术入驻（优先阅读）

| 文件 | 用途 |
| --- | --- |
| `eCommerce Partner Onboarding Guide 2026.PDF` | **总指南**。testbed 凭证、集成步骤、上线前验证流程。Abdul 点名必读。 |
| `MyPost Business API Integration Guide.PDF` | **MPB API 集成说明**（报价 / 建单 / 出标 / 追踪等）。我们主技术文档。 |
| `MPB Partner Verification Test Cases v1.1.XLSX` | 上线前验收用例清单；按表测完再提交验证。 |
| `MPB Tech Sign Off.PDF` | 技术验收签字 / 确认表；验证通过后的正式 sign-off。 |

### `03-merchant-sender-support` — 给商户看的连接指南

页面上 “Sender Support / Share with your merchants” 区块。可转发给入驻商户，教他们如何把账户接到 Xituan。

| 文件 | 用途 |
| --- | --- |
| `MyPost Business Customer Integration Guide.pdf` | 商户侧：登录 MPB → Connect Partner → 接受条款 → **绑 Visa/Mastercard** → 复制 **Partners Token**。未绑卡则 Partner 代下单会失败。**我们当前主路径。** |
| `eParcel Contract Customer Integration Guide.pdf` | 商户侧 eParcel Contract：Developer Centre 注册 key、选 Platform Partner、收生产凭证后再交给 Partner。高用量合同客户路径；与当前 MPB BYOK 不同，可后置。 |

### `04-brand-guidelines-and-logos` — 品牌规范与 Logo

上线后对外展示 AusPost / MyPost / eParcel / StarTrack 标识时使用。非技术阻塞项。

| 文件 | 用途 |
| --- | --- |
| `eCommerce Platform Brand Guidelines.PDF` | 电商 Partner 平台品牌使用规范。 |
| `Australia Post-Identifier Icon-*.PNG` | AusPost Standard / Express 标识图标。 |
| `Australia Post-Contract Lockup-MyPost Business.PNG` | MyPost Business 合同/产品 lockup。 |
| `Australia Post-Contract Lockup-eParcel.PNG` | eParcel 合同/产品 lockup。 |
| `StarTrack-Identifier Icon-Standard.PNG` | StarTrack 标准标识。 |

补充：完整品牌资产库需申请 [Brand Hub](https://brandhub.auspost.com.au/portals/auspostbrandhub)。选择 External Agency/Partner，enquiry 写明 eCommerce Partner / BYO Account（MyPost Business and eParcel）。

### `05-products-and-services` — 产品与服务介绍

偏业务理解与对商户说明，不是 API 验收硬门槛。

| 文件 | 用途 |
| --- | --- |
| `Australia Post Group - Cover slide.PPTX` | 集团产品封面 / 介绍幻灯片。 |
| `MyPost Business vs Parcel Contract.PDF` | MPB 与 Parcel/eParcel Contract 差异对比；决定商户走哪条账户路径时有用。 |
| `MyPost Business Toolkit.PDF` | MyPost Business 产品工具包 / 卖点材料。 |
| `MyPost Business - Automatically create shipping labels.PDF` | 自动出标能力说明（商户价值主张）。 |
| `eParcel Contract eCommerce Partner Integration Guide.PDF` | Partner 视角的 eParcel 集成说明（与客户版内容同类；高用量合同路径）。 |
| `Sending overseas with MyPost Business.MP4` | MPB 国际寄送介绍视频。 |

说明：Resource Centre 另有 `How MyPost Business savings work.MP4`，本次本地未放入文件夹。

### `06-winning-in-ecommerce` — 电商洞察与旺季资源

运营 / 市场材料；帮商户做旺季与活动规划，不阻塞技术入驻。

| 文件 | 用途 |
| --- | --- |
| `Australia Post eCommerce Report 2026.PDF` | 年度电商报告。 |
| `eCommerce Report quarterly update – October 2025.PDF` | 季度更新。 |
| `eCommerce Sales Event Calendar.PDF` | 销售/活动日历。 |
| `Australia Post eCommerce Calendar Toolkit.PDF` | 日历工具包。 |
| `Peak Playbook.PDF` | 旺季作战手册。 |
| `Peak Checklist.PDF` | 旺季检查清单。 |

---

## 建议阅读 / 处理顺序

1. 签并回传 `01-legal-agreement` 协议；同时回 Abdul 三个联系人（含 support + 通用邮箱）。
2. 精读 `02-technical-onboarding` 四份材料，按 Onboarding Guide 申请 testbed，实现时 header 带 `XITUAN-8745`。
3. 按 `MPB Partner Verification Test Cases` 自测，再填 `MPB Tech Sign Off`。
4. 商户连接流程对齐 `03-merchant-sender-support`（尤其 MPB Token + 绑卡）。
5. 对外品牌与 CMS/App 展示前再看 `04`；产品话术与旺季运营看 `05` / `06`。
