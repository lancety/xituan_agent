# Local 补抓 2026-11-12（缺口 API + Parcel Post）

## 覆盖

| API | 文件前缀 | 状态 |
|-----|----------|------|
| GET /organisations | `10-local-organisations_*` | 200 |
| POST /prices/items（OWN BE1P10） | `10-local-prices-items_*` | 200 |
| DELETE /shipments/{id} | `10-local-delete-shipment_*` | 200 |
| GET /track | `10-local-track_*` | 200 |
| Parcel Post BE1PB1 shipments/orders/labels | `10-local-*-parcel-post_*` | 201/201/200 |

## Parcel Post 标签

| 字段 | 值 |
|------|-----|
| product_id | BE1PB1（AP_BOX_S / PP） |
| tracking | 99703102334501000840904 |
| AusPost order | TB03562764 |
| label PDF | `../04-label-pdfs/label-A6-1pp-parcel-post-AP_BOX_S.pdf` |

Express 样例见 `09-local-*` / demo A6+A4。International 本期不做。
