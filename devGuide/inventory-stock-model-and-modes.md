## Inventory stock model & order modes

本说明文档整理 `regular / offer / preorder` 三种模式下的库存模型与数据流转约定，统一 `products / offer_products / products_preorderable` 三张表及相关 Service 的语义，后续做库存相关改动时，应优先参考此文档。

### 1. 三个主表与字段含义

#### 1.1 `merchant.products`

- `stock`  
  - 含义：**当前可售库存**（可立即卖出的数量）。  
  - 特殊值：`-1` 表示无限库存，无上限。
- `reserved_stock`  
  - 含义：**已预留但尚未确认的数量**，通常来源于下单时的“锁库存”。  
  - 预留成功后，从 `stock` 转移到这里。
- `total_stock`  
  - 含义：**当前剩余总库存**（不包含已售出的数量），即：
    - 在有库存上限的情况下：  
      \(`stock + reserved_stock = total_stock`\) 恒成立。
    - 在无限库存情况下：通常为 `-1`。

#### 1.2 `merchant.offer_products`

- `stock`：该 offer 产品在当前活动下的可售数量（`-1` 表示无限）。  
- `reserved_stock`：该 offer 产品下已预留的数量。  
- `total_stock`：该 offer 产品在当前活动下的剩余总库存，同样遵守：
  - 有上限时：`stock + reserved_stock = total_stock`。  
  - 无上限时：可按照业务需要设为 `-1` 或其他约定值。

#### 1.3 `merchant.products_preorderable`

- `stock`：preorder 场景下的可售数量（默认 `-1`，表示无限）。  
- `reserved_stock`：preorder 场景下已预留的数量。  
- `total_stock`：preorder 场景下的剩余总库存，同样约定：
  - 有上限：`stock + reserved_stock = total_stock`。  
  - 无上限：`stock = -1, total_stock = 0/-1`，由业务定义。

### 2. 模式间库存“分仓”的原则

1. **基础池在 `products`，模式专用池在其各自表中**：
   - `regular`：只消耗 `merchant.products`。  
   - `offer`：只消耗 `merchant.offer_products`。  
   - `preorder`：只消耗 `merchant.products_preorderable`。
2. **创建 offer / preorder 时，从 `products` 借出库存**：
   - 在集成测试中已体现典型 SQL：
     - Offer：
       ```sql
       UPDATE merchant.products 
       SET stock = stock - $1, total_stock = total_stock - $1
       WHERE id = $2;
       ```
     - Preorder：
       ```sql
       UPDATE merchant.products 
       SET stock = stock - $1, total_stock = total_stock - $1
       WHERE id = $2;
       ```
   - 同步在 `offer_products` / `products_preorderable` 中插入对应的 `stock / total_stock`。
3. **活动结束后（具体触发点由业务定义），由单独的“活动收尾逻辑”负责把未用完的库存从 `offer/preorder` 返还到 `products`**。  
   - 注意：**订单级别的库存锁定/释放不会负责跨表返还**，只在各自表内调整。

### 3. 订单级库存流程（锁定 / 确认 / 释放）

以下约定同时适用于 `products / offer_products / products_preorderable` 三表，只是根据订单模式选用不同的数据源：

#### 3.1 下单预留（`reserveStockForOrder`）

- 目标：防止超卖，锁定库存但尚未视为最终售出。  
- 操作（有限制库存时）：
  - `stock -= quantity`
  - `reserved_stock += quantity`
  - `total_stock` **不变**
- 结果：
  - `stock + reserved_stock` 仍等于原来的 `total_stock`。  
  - 创建 `inventory_locks` 记录（`lockType = 'ORDER_RESERVED'`）。

#### 3.2 支付成功确认（`confirmStockOnPayment`）

- 目标：在用户完成支付后，将预留数量视为最终售出。  
- 操作（有限制库存时）：
  - `reserved_stock -= quantity`
  - `total_stock -= quantity`
  - `stock` **不变**（因为已从预留状态直接变成“已售出”）。  
- 结果：
  - 仍满足：`stock + reserved_stock = total_stock`（两侧都减去 `quantity`）。  
  - 删除对应 `inventory_locks`（按 `orderId + lockType` 批量删除）。

#### 3.3 取消/过期释放（`releaseOrderStock`）

- 目标：订单取消或过期后，把预留的数量重新释放为可售库存。  
- 操作（有限制库存时）：
  - `stock += quantity`
  - `reserved_stock -= quantity`
  - `total_stock` **不变**（因为这部分从未真正卖出）。  
- 结果：
  - 仍满足：`stock + reserved_stock = total_stock`。  
  - 删除对应 `inventory_locks`（按 `orderId + lockType` 批量删除）。

### 4. 支付 & 退款与库存的关系

> **与业务期望的对照**：若团购应为主仓「划拨 → 活动内自洽 → 结束返还」，见 `devGuide/inventory-offer-main-warehouse-flow-expected-vs-actual.md`（当前实现与期望差异、工程 Todo 列表）。

#### 4.1 支付路径（`updateInventoryOnPayment`）— 以代码为准

实现中对**每个订单行**顺序固定为（见 `inventory-management.service.ts`）：

1. **始终先**调用 `updateProductInventory`：  
   - 若主产品 `products.stock >= 0`：检查并扣减 `products` 的 `stock` / `total_stock`。  
   - 若 `stock === -1`：不改动数值，仅记交易。  
   - **注意**：此步骤**不区分** `REGULAR` / `OFFER` / `PREORDER` 订单模式。
2. **再**调用 `updateModeSpecificInventory`：  
   - `OFFER`：`updateOfferStock` → 扣减 `offer_products`。  
   - `PREORDER`：`updatePreorderStock` → 扣减 `products_preorderable`。  
   - `REGULAR`：无额外模式表操作。

因此：在 **OFFER 且主产品为有限库存** 时，支付成功路径会**同时**更新 `products` 与 `offer_products`；这与「活动期内订单只动活动子库存」的应然模型不一致时，需按上述对照文档做改造而非仅改本段文字。

#### 4.2 退款路径（`restoreInventoryOnRefund`）— 以代码为准

对每个订单行顺序为：

1. **始终先** `restoreProductInventory`（有限主仓则恢复 `products`）。  
2. **再** `restoreModeSpecificInventory`（`OFFER` / `PREORDER` 恢复对应模式表）。

与 §4.1 对称。

### 5. 无限库存（`stock = -1`）的约定

1. 在 `products / offer_products / products_preorderable` 中：
   - `stock = -1` 表示无限制库存。
   - 此时：
     - 库存检查仅根据 `stock === -1` 直接返回可用。  
     - 预留 / 确认 / 释放流程**不会创建锁记录**或**不会变更库存数值**，只记录交易日志（用于审计）。
2. 相关 Service 中的行为：
   - `StockCalculatorService.getStockByMode` 对于无限模式可返回 `availableStock = -1`，调用方据此跳过锁逻辑或只记录交易。

### 6. 开发修改库存逻辑时的 checklist

1. **先确认操作的是哪张表**：
   - regular → `products`  
   - offer → `offer_products`  
   - preorder → `products_preorderable`
2. **保持不变量**（有限制库存时）：
   - `stock + reserved_stock = total_stock`。  
   - 预留：只动 `stock / reserved_stock`。  
   - 确认：只动 `reserved_stock / total_stock`。  
   - 释放：只动 `stock / reserved_stock`。
3. **不要在订单级逻辑里跨表“借/还”库存**：
   - 订单逻辑只在当前模式对应的表内移动数量。  
   - 跨表的“借出/返还”由活动生命周期逻辑（创建/结束 offer 或 preorder）负责。
4. **考虑无限库存分支**：
   - 遇到 `stock = -1` 时，要么直接放行，要么只记录交易，不要调整数量。  
5. **修改后同步更新测试**：
   - 单元测试：`tests/unit/inventory/*`。  
   - 集成测试：`tests/integration/inventory/*`、`tests/integration/payment/payment-webhook.integration.test.ts`。

