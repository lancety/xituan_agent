# 团购（OFFER）主仓与活动子库存：期望流程 vs 当前实现

本文档对照**业务期望**与**仓库内实际代码路径**，并指向既有设计/说明文档。用于后续改造与测试对齐。

## 1. 相关设计 / 实施文档索引

| 路径 | 说明 |
|------|------|
| `xituan_agent/devGuide/inventory-stock-model-and-modes.md` | 三模式字段含义、预留/确认/释放、分仓原则（**§4 支付路径已与代码核对，见文内更正**） |
| `xituan_agent/devGuide/order-system.md` | 订单与分层库存、团购「借用」文字描述（部分为**目标设计**，需与本文件「当前实现」对照） |
| `xituan_agent/docs/offer-stock-system-design.md` | 团购借用/截单返还的**设计说明**（伪代码级，**未保证与实现一致**） |
| `xituan_agent/docs/stock-system-update.md` | 库存相关变更记录 |
| `xituan_agent/docs/stock-validation-logic-fix.md` | 校验逻辑修复记录 |
| `xituan_cms/docs/offer-stock-settings.md` | CMS 侧团购库存设置说明 |
| `.cursor/skills/inventory-stock-model/SKILL.md` | Agent 技能摘要（引用 devGuide） |

**实施代码主入口**（便于检索）：

- `xituan_backend/src/domains/inventory/services/inventory-management.service.ts` — `reserveStockForOrder` / `confirmStockOnPayment` / `releaseOrderStock` / `updateInventoryOnPayment` / `restoreInventoryOnRefund`
- `xituan_backend/src/domains/inventory/services/stock-updater.service.ts` — `updateStockByMode`
- `xituan_backend/src/domains/offer/services/offer-product.service.ts` — 创建/更新团购行、主仓上限校验
- `xituan_backend/src/domains/inventory/services/inventory-cron.service.ts` — `returnStockFromExpiredOffer` 等

---

## 2. 业务期望的库存流程（团购 OFFER）

以下为用户确认的**应然**模型（主仓 ↔ 活动子账）：

1. **活动创建 / 向活动划拨库存时**  
   从 `merchant.products` 扣减对应数量，在 `merchant.offer_products` 记入活动可售池（一次划拨，主仓与活动账同步）。

2. **活动期间（下单预留、支付确认、取消释放、退款恢复）**  
   **只**在 `merchant.offer_products` 上按既有 `stock / reserved_stock / total_stock` 规则变动；**不再**对同一笔团购销量重复扣减 `merchant.products`。

3. **活动结束（截单 / 过期等由业务定义的触发点）**  
   将活动内**剩余应归还主仓**的数量从 `offer_products` 返还到 `merchant.products`（与步骤 1 对称）。

4. **配置校验**  
   划拨量不应超过当时主仓可用（可与现有「团购初始库存不能超过产品库存」类校验衔接或替换为显式划拨语义）。

---

## 3. 当前实现中的实际流程（与代码一致）

### 3.1 创建 / 更新团购商品行（划拨）

- `OfferProductRepository.create` 仅写入 `offer_products`，**无**对 `products` 的 `UPDATE` 减量。
- `OfferProductService.createOfferProduct` / `updateOfferProduct`：当团购行 `stock > 0` 且主产品 `stock >= 0` 时，**读取** `products.stock` 做上限比较；**仍无**创建时从主仓扣减的实现。

### 3.2 下单预留

- `reserveStockForOrder` → `updateStockByMode`：OFFER **仅**更新 `merchant.offer_products`（符合「活动期间只动活动表」的预留部分）。

### 3.3 支付成功（`updateInventoryOnPayment`）

- 对每个订单行**固定顺序**：先 `updateProductInventory`（若 `products.stock >= 0` 则检查并扣减 **主产品**），再 `updateModeSpecificInventory`（OFFER 时扣 **offer_products**）。
- 因此：主产品为**有限库存**时，支付路径**会**同时动主仓与活动行（与 §2 期望不一致）。主产品 `stock === -1` 时不在数值上扣主仓，但流程仍会进入该分支记流水。

### 3.4 退款（`restoreInventoryOnRefund`）

- 对每个订单行：先 `restoreProductInventory`（有限主仓则加回 **products**），再 `restoreModeSpecificInventory`（OFFER 则恢复 **offer_products**）。与支付对称。

### 3.5 活动过期清理（`returnStockFromExpiredOffer`）

- 将 `offer_products` 中 `stock > 0` 的剩余量 `UPDATE` 加回 `merchant.products.stock` / `total_stock`，并清零对应 `offer_products.stock`。
- 若从未在创建时从主仓扣出，该加回可能与账实不符；若支付阶段已扣主仓，又与「仅活动内消耗」期望冲突，需整体 redesign 时一并算清。

---

## 4. 文档与代码的差异说明

- `inventory-stock-model-and-modes.md` 旧版 §4.1 曾写「offer 只通过 `updateModeSpecificInventory` 影响模式表」，**遗漏了先执行的 `updateProductInventory`**，与真实代码不符；已在同文件 §4 更正并指向本页。
- `order-system.md`、`offer-stock-system-design.md` 中「创建 Offer 时从 products 借用」等描述，属于**目标设计**；当前 **create 路径未实现借用 SQL**，以 §3.1 为准。

---

## 5. 建议的工程 Todo（实施对齐期望模型）

以下为推荐任务顺序（实施前需业务确认历史数据与边界：已发生订单、已跑过期任务等）。

1. **定义唯一真相**：在 devGuide 中冻结「OFFER 主仓仅划拨/回收、订单只动 offer_products」的状态机（含无限库存 `-1`、归档/删除活动行）。
2. **创建/更新团购行时主仓划拨**：在事务内实现 `products` 减量 + `offer_products` 增量（或等价字段），与删除行/改量减少时的**退回主仓**对称；替换或收紧现有「仅比较不上账」逻辑。
3. **支付/退款路径**：对 `order.mode === OFFER`（及若一致的 PREORDER）跳过或条件化 `updateProductInventory` / `restoreProductInventory`，避免订单级双扣；核对 `inventory_transactions` 的 `mode` 记录是否仍满足审计需求。
4. **过期返还**：使 `returnStockFromExpiredOffer`（及任何手动结束活动逻辑）与步骤 2 的划拨严格对账；评估 `reserved_stock` 在返还时是否必须归零或单独处理。
5. **订单创建校验**：核对 `OrderService.createOrderItems` 等对 `products.stock` 的检查在 OFFER 下是否应改为仅校验 `offer_products`（避免错误拦截）。
6. **测试**：更新 `tests/unit/inventory/inventory-management.unit.test.ts`、`tests/integration/inventory/inventory-management.integration.test.ts`、支付 webhook 相关用例，覆盖划拨 → 预留 → 确认 → 退款 → 过期返还全链。
7. **文档收敛**：更新 `order-system.md`、`offer-stock-system-design.md` 与本文件一致；`.cursor/skills/inventory-stock-model/SKILL.md` 若叙述「借还」需与实现同步。

---

## 6. `offers.inventory_cleared`（已清仓）

- 字段：`merchant.offers.inventory_cleared` BOOLEAN NOT NULL DEFAULT false。
- **true**：商户已执行「清仓回主仓」，剩余活动可售 `offer_products.stock` 已补回 `products`（见 `OfferService.clearOfferInventoryToMain`）。
- **false**：活动侧库存池仍有效；退款在未清仓且活动行仍存在时回到 `offer_products`。
- 商户对**活动商品库存**的变更（增删改、批量库存变更等）会将该标志**置回 false**。
- 过期任务不再自动把活动库存加回主仓（见 `inventory-cron.service.ts` `returnStockFromExpiredOffer`）。
- **订单项活动行已删除**：退款时 `offer_products` 行不存在 → 回主仓（见 `restoreInventoryOnRefund` 中 `OFFER_LINE_REMOVED`）。

## 7. 修订记录

| 日期 | 说明 |
|------|------|
| 2026-04-15 | 初版：整理文档索引、期望 vs 实际、工程 Todo |
| 2026-04-15 | 增加 `inventory_cleared`、清仓 API、退款分支与 CMS 展示 |
