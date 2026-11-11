# Local 抓取记录 2026-11-11（AusPost 原始 HTTP）

## 场景

- Site：`localhost:3005` · 账号 `lanceaaaaa@gmail.com`
- 地址：`29 Norfolk Street, Killara NSW 2071` · 快递
- 支付：现金 → CMS `localhost:3010` 确认已支付
- CMS：`GB261111000001` → 新建发货 → **Australia Post — API** → 邮局箱 S + **快递 EXP** + **A6** → 确认出标成功
- Backend：`AUSPOST_MPB_LOG_PAYLOADS=1` → `tmp/auspost-mpb-signoff-payloads/2026-11-11.jsonl`

## 结果

| 字段 | 值 |
|------|-----|
| order_number | GB261111000001 |
| order_id | cc9afb1a-788e-4f94-b885-d0b7155cfb39 |
| AusPost shipment_id | aMUK0Ehgn7gAAAGhhjgFk8ne |
| AusPost order_id | TB03561180 |
| tracking / consignment | 997031022175 / article `99703102217501004900905` |
| product_id | BE9PB1（AP_BOX_S / EXP） |
| payment_method | STORED_PAYMENT |
| label layout | A6-1pp |
| label PDF | `../04-label-pdfs/label-A6-1pp-express-post-AP_BOX_S-local-dev.pdf` |

## 原始报文文件（本目录）

| 文件 | API |
|------|-----|
| `09-local-shipments_request.capture.json` / `_response.capture.json` | `POST /shipping/v1/shipments` → 201 |
| `09-local-orders_request.capture.json` / `_response.capture.json` | `PUT /shipping/v1/orders` → 201 |
| `09-local-labels_request.capture.json` / `_response.capture.json` | `POST /shipping/v1/labels` → 200 |

Token / account / 临时 PDF URL 已脱敏。
