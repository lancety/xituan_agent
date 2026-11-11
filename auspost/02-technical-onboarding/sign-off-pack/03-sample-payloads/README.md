# 样例 JSON

Last updated: 2026-11-11

`*_request.template.json` = 与现网代码一致的**请求骨架**（可直接对照实现）。  
`*_response.capture.json` = **待补**：从 testbed/demo 抓真实响应后粘贴（脱敏 account / token / 个人电话邮箱）。

抓取建议（demo CMS 出标一次即可）：

1. Backend 临时打日志或用代理保存 `createShipments` / `createOrderFromShipments` / `createLabels` / `getPrices` / `getOrganisations` 的 request+response。
2. 另抓一笔 OWN + 一笔 flat-rate（若产品都要报）；layout 各抓 A6 与 A4-4pp 的 labels 请求。
3. Track：任意活跃运单 `GET track` 响应一份。

**禁止**把真实 `auspost-merchant-token` / API Key 写入本目录。
