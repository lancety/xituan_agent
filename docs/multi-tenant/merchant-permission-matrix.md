# Merchant permission matrix (default)

Permission keys and which merchant roles have them. Source: `xituan_backend/src/shared/constants/merchant-role-permissions.ts`.

---

## 1. Permission keys and sample operations

| Permission key | 含义 | 操作 / API 样本 |
|----------------|------|------------------|
| `member:list` | 查看商户成员列表 | GET 成员列表 |
| `member:invite` | 邀请新成员 | POST 邀请、查看/审批加入申请 |
| `member:update_role` | 修改成员角色 | PUT 成员角色 |
| `member:remove` | 移除成员 | DELETE 成员 |
| `order:list` | 查看订单列表与详情 | GET 订单列表、订单详情、订单统计 |
| `order:update_status` | 更新订单状态 | PUT 订单状态（如接单、完成） |
| `order:cancel` | 取消订单 | 订单取消相关接口 |
| `product:create` | 创建产品 | POST 产品、分类、选项等 |
| `product:update` | 更新产品 | PUT/PATCH 产品、库存、分类、选项 |
| `product:delete` | 删除/下架产品 | DELETE 产品、恢复等 |
| `setting:read` | 读取商户设置 | GET 商户设置、平台设置（商户可见部分）等 |
| `setting:write` | 修改商户设置 | PUT/PATCH 商户设置、平台设置（商户可改部分）等 |

---

## 2. 其他 CMS 功能页与操作 → 建议 permission

以下为使用 `requireMerchantAccess` 的 CMS 功能模块、典型操作与建议挂载的 permission（现有 12 个 key 或后续扩展）。

| 功能模块 | 典型操作 / API 样本 | 建议 permission |
|----------|----------------------|-----------------|
| **成员** merchant-member | GET 成员列表；POST 邀请；PUT 角色；DELETE 移除；GET/PATCH 加入申请 | `member:list` / `member:invite` / `member:update_role` / `member:remove`（已定义） |
| **订单** admin-order | GET 订单列表、详情、统计；PUT 订单状态 | `order:list`；`order:update_status` |
| **订单状态** admin-order-status | 订单状态流、批量改状态等 | `order:list`；`order:update_status` |
| **购物车** cart | GET/POST/PUT/PATCH/DELETE 购物车、购物车项、合并、统计、库存检查 | 与下单流程相关，可用 `order:list` 或 不细分 |
| **订单支付警报** alert-orders-payments | GET 警报列表、用户警报、承诺支付统计；POST 记录警报、处理过期承诺 | `order:list` |
| **产品** admin-product / product | 产品/分类/选项/库存 列表、详情、创建、更新、删除、恢复、批量 | `product:create` / `product:update` / `product:delete`（查看可用其一或 order:list 视业务） |
| **报价** admin-offer | 报价列表、详情、创建、更新、删除、发布、统计、特色图 | 可归入 `product:create`/`product:update`/`product:delete` 或 新增 `offer:*` |
| **预约** admin-preorder | 预约列表、详情、更新状态、确认时段、统计 | `order:list`；`order:update_status` |
| **预定商品** admin-products-preorderable | 预定商品 创建、更新、删除、批量 | `product:create` / `product:update` / `product:delete` |
| **预订单推广** admin-preorder-promotes | 预订单推广 创建、列表、更新、删除、发布 | 可归入 `setting:read`/`setting:write` 或 新增 key |
| **平台设置（CMS 侧）** platform-setting | GET 设置/缓存状态；PUT 按 category 更新；POST 重新加载 | 读：`setting:read`；写：`setting:write` |
| **收入** revenue | GET 收入列表、详情；POST 创建；PUT 更新；DELETE 删除（super_admin） | `setting:read`；`setting:write`（或 新增 `revenue:*`） |
| **支出** expense | GET 列表、详情；POST 创建、上传/OCR、手动上传；PUT 更新；DELETE 删除；POST 重新识别/分析 | `setting:read`；`setting:write`（或 新增 `expense:*`） |
| **合作伙伴** partner | 合作伙伴/地址/发货单/结算单 列表、详情、创建、更新、删除、PDF、确认付款等 | `setting:read`；`setting:write`（或 新增 `partner:*`） |
| **供应商** supplier | 供应商 列表、详情、创建、更新、删除 | `setting:read`；`setting:write`（或 新增 `supplier:*`） |
| **设备** equipment | 设备 列表、详情、创建、更新、删除 | `setting:read`；`setting:write`（或 新增 `equipment:*`） |
| **设备折旧** equipment-depreciation | 折旧记录 CRUD；生成/查看折旧报表 | `setting:read`；`setting:write` |
| **税报** tax-return-report | 生成/查看/提交/修订税报、资产负债表、审计日志 | `setting:read`；`setting:write` |
| **打印模板** printTemp | 模板 CRUD、复制、批量、使用统计、元素统计、筛选 | `setting:read`；`setting:write` |
| **新闻** admin-news | 新闻 创建、列表、详情、更新、删除、切换发布 | 可归入 `setting:read`/`setting:write` 或 新增 `news:*` |
| **门店地址** store-address | 门店 创建、更新、删除、设默认（管理端） | `setting:read`；`setting:write` |
| **运费** shipping-fee | POST 计算运费、按地址计算 | 可与订单流程共用 `order:list` 或 `setting:read` |

说明：未单独建 key 的模块目前均可先用 `setting:read` / `setting:write` 接入。**ADMIN 与 MANAGER 默认拥有 setting:read、setting:write**，因此这些分类（收入、支出、合作伙伴、供应商、设备、税报、打印模板、新闻、门店地址等）当前默认都是 ADMIN 与 MANAGER 可操作。若以后需要按身份细分（例如只允许某角色看财务、某角色只能看供应链），可新增对应 key（如 `revenue:read`、`partner:write` 等），在 `DEFAULT_ROLE_PERMISSIONS` 中分配给不同角色即可。

---

## 3. Role × Permission matrix（谁拥有哪些 key）

| Permission key | ADMIN | MANAGER | PRODUCER | DELIVERY |
|----------------|:-----:|:-------:|:--------:|:--------:|
| `member:list` | ✓ | ✓ | — | — |
| `member:invite` | ✓ | — | — | — |
| `member:update_role` | ✓ | — | — | — |
| `member:remove` | ✓ | — | — | — |
| `order:list` | ✓ | ✓ | ✓ | ✓ |
| `order:update_status` | ✓ | ✓ | ✓ | ✓ |
| `order:cancel` | ✓ | ✓ | — | — |
| `product:create` | ✓ | ✓ | — | — |
| `product:update` | ✓ | ✓ | — | — |
| `product:delete` | ✓ | ✓ | — | — |
| `setting:read` | ✓ | ✓ | — | — |
| `setting:write` | ✓ | ✓ | — | — |

- **ADMIN**：拥有全部 12 个 key。  
- **MANAGER**：无成员邀请/改角色/移除，有订单列表与改状态/取消、产品增删改、设置读写。  
- **PRODUCER / DELIVERY**：仅订单列表、订单改状态（接单、完成等）。

---

## 4. 角色简要说明

| 角色 | 典型用途 |
|------|----------|
| ADMIN | 商户管理员：成员管理、订单、产品、设置全权限 |
| MANAGER | 店长/运营：订单与产品与设置，不可管理成员 |
| PRODUCER | 生产/后厨：看单、改订单状态 |
| DELIVERY | 配送：看单、改订单状态 |
