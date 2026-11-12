# 样例 JSON

Last updated: 2026-11-11

`*_request.template.json` = 与现网代码一致的**请求骨架**（可直接对照实现）。  
`*_response.capture.json` / `*_request.capture.json` = 真实抓取（脱敏 account / token / 临时 PDF URL）。

### 已收集

| 前缀 | 来源 |
|------|------|
| `07-demo-*` | demo CMS admin quote/confirm（非 AusPost 原始 HTTP） |
| `09-local-*` | Express lodgement：shipments / orders / labels |
| `10-local-*` | organisations / prices / delete / track + Parcel Post lodgement |

已齐，可交 Production Request。

**禁止**把真实 `auspost-merchant-token` / API Key 写入本目录。
