# Demo 抓取记录 2026-11-11

## 场景

- Site：`demo.xituan.com.au` 登录后下单（**团购活动列表为空**，改用零售「碱水面包」）
- 地址：默认 `1 Honeysuckle Dr, Newcastle NSW 2300`；结账选 **Express Post**
- 支付：现金 → CMS 确认已支付
- CMS：`XT261111000001` → 新建发货 → **Australia Post — API** → 邮局箱 S + **快递 EXP** + **A6** → 确认出标成功

## 结果

| 字段 | 值 |
|------|-----|
| order_number | XT261111000001 |
| order_id | edd9ed12-a7cf-42a8-af41-f1cd8c57778d |
| tracking_number | 99703102155201004900905 |
| product_id | BE9PB1（AP_BOX_S / EXP） |
| quote | AUD 15.20 inc GST（flat-rate 表） |
| label PDF | `../04-label-pdfs/label-A6-1pp-express-post-AP_BOX_S.pdf` |

## 说明

浏览器只能抓到 **Xituan admin API**（quote / confirm），AusPost 原始 request/response 在 backend 服务端；交 Sign Off 时附本目录 capture JSON + 标签 PDF，并配合 `*_request.template.json`。

### 第二单（A4-4pp）

| 字段 | 值 |
|------|-----|
| order_number | XT261111000002 |
| order_id | 77ac25dc-0574-465a-8b02-f8e090ad3651 |
| tracking_number | 99703102155301004900902 |
| layout | A4-4pp（PDF mediabox 595×842） |
| label PDF | `../04-label-pdfs/label-A4-4pp-express-post-AP_BOX_S.pdf` |

A6 + A4-4pp 标签样例已齐。
