# Merchant panel：退役混合 activities 列表 API

Last updated: 2026-10-07

| 字段 | 值 |
|------|-----|
| **ID** | `merchant-panel-mixed-activities-retire` |
| **状态** | `planned` |
| **当前已部署** | —（Phase 1 代码中：新客户端分接口；backend **保留** 混合路由） |
| **待完成** | Phase 1 发版确认 → Phase N 删除 `GET /activities` + `listActivities` |
| **Gate** | 生产 WeChat 商家面板版本已切分接口（首页团购/预定分 section），且 **全量**；可观测期内混合 `/activities` 调用可忽略或为 0 |
| **创建日** | 2026-10-07 |

**部署尾项:** 本 entry

## 背景

商家首页 / 营销活动 UI 已按「团购接龙」「预定」分 section，App 与新 WeChat 代码改走 `GET .../offers` 与 `GET .../preorder-promotes`。

`GET /api/wechat/merchant-panel/activities`（`listActivities`：双端各拉最多 500 再内存合并）仍被 **已发布 WeChat** 商家首页调用。WeChat 审核与全量滞后于 backend / App，**禁止**在 Phase 1 同批删除该路由。

## Phase 对照

| Phase | 内容 | 部署状态 | 验证 |
|-------|------|----------|------|
| **1** | 新客户端（App + 待审 WeChat）改用分接口；**backend 保留** deprecated `GET /activities` + `listActivities`，供旧包继续用 | pending | 旧 WeChat 商家首页活动列表仍 200；新 App / 新 WeChat 首页不依赖混合接口 |
| **N** | 删除 `GET /activities`、`getActivities` controller、`listActivities`；WeChat `merchantPanelApi.getActivities`（若仍残留）；可选清理 `iWechatMerchantPanelActivitiesResponse` | pending | 仅 Gate 通过后；确认无生产流量打该 path |

## 消费者

| Consumer | Phase 1 行为 |
|----------|----------------|
| **WeChat 已发布包** | 继续调混合 `/activities` → backend 必须保留 |
| **WeChat 新代码** | 首页已分 section + `getOffersList` / `getPreorderPromotesList`；`getActivities` 仅 deprecated 保留 |
| **商户 App** | 已改分接口；不再调混合列表 |
| **CMS / Site** | 不依赖此 path |

## 部署后债务（Post-deploy debt）

### Phase 1 生产确认

- [ ] Backend 已部署且 **未** 删除 `GET /wechat/merchant-panel/activities`
- [ ] 生产旧 WeChat 商家首页「近期活动」仍可加载
- [ ] 新 App（及新 WeChat 发版后）首页分 section 正常
- [ ] Entry 状态 → `blocked`（等 WeChat 全量）或 `active`

### Phase N 清理（Gate 通过后）

- [ ] 删除 route `GET /activities`、`controller.getActivities`、`service.listActivities` 及相关 merge 常量
- [ ] 删除 WeChat `merchantPanelApi.getActivities`（若仍存在）
- [ ] Grep 确认无 consumer 再引用混合列表
- [ ] 本 entry → `done`；registry 移至已归档

## 相关链接

- Backend: `wechat-merchant-panel.routes.ts`、`wechat-merchant-panel.controller.ts`、`wechat-merchant-panel.service.ts`（`listActivities`）
- WeChat: `packageMerchant/lib/merchant-panel/merchant-panel.api.ts`；首页 `merchant-panel-home-section`
- App: `xituan_app_merchant/src/api/merchant-panel.api.ts`（`getOffersList` / `getPreorderPromotesList`）
