# 2. Error Handling / Address / Basket / Availability

Last updated: 2026-11-11

对应 Tech Sign Off §11–§15。

---

## §11 Error Handling

### 用户可见（商户 CMS / 打包台）

平台返回稳定业务码，前端 i18n，不把 AusPost 原始英文堆给用户：

| 业务码 | 典型触发 | 用户侧含义 |
|--------|----------|------------|
| `AUSPOST_MPB_NOT_CONNECTED` | 未连接 | 先去连接 MyPost |
| `AUSPOST_MPB_CONNECTION_INVALID` | organisations 失败 / 坏 Token | 重贴 Token |
| `AUSPOST_MPB_QUOTE_FAILED` | prices 无可用价 | 检查包装/地址后重试 |
| `AUSPOST_MPB_PAYMENT_FAILED` | 401/403 或 STORED_PAYMENT 文案 | 检查绑卡 / Token；连接标 `needs_attention` |
| `AUSPOST_MPB_LABEL_FAILED` | 建单/出标一般失败 | 重试或联系支持 |
| `AUSPOST_MPB_LABEL_UNAVAILABLE` | 已扣款但 PDF URL 失败 | 保留运单号；引导 MyPost 后台取标 |
| `DISPATCH_PACKAGING_INVALID` | OWN 缺重量/尺寸等 | 补全信息（禁止默认猜重） |

`needs_attention` **仅**在鉴权/支付类失败时置位（401/403 或 body 含 unauthenticated / stored_payment 等），包装校验失败不误伤连接状态。

### 排障责任

| 角色 | 责任 |
|------|------|
| 商户 | 绑卡、Token、取标；按 CMS 文案操作 |
| Xituan 支持 | 查 backend 日志（已 redact token）、连接状态、业务码与 partial tracking |
| AusPost | Partner/testbed 凭证、API 故障；关注 [status.developers.auspost.com.au](https://status.developers.auspost.com.au) |

超时：Labels 使用 `wait_for_label_url`；若超时/无 URL → `LABEL_UNAVAILABLE` 路径，运单号仍可用，商户可稍后在 MyPost 恢复，无需读源码。

服务端日志：记录 HTTP status + 脱敏 body；**永不**回显完整 merchant token。

---

## §12 Address Validation

- 履约地址来自订单/商户发件快照（澳洲结构化字段：name、lines、suburb、state、postcode）。
- 映射见 `auspost-mpb-address.util.ts`（`snapshotToAuspostFrom` / `To`）。
- **未**单独调用 Validate Suburb API；依赖订单侧已校验的 AU 地址 + MPB 建单错误回传。
- 非法/拒收地址：建单失败 → 业务码 + 可重试；不落「半截」本地 shipment（Order 失败会 DELETE basket 中的 shipment）。

---

## §13 Basket Size

- 出标失败回滚：`DELETE /shipments/{id}` 清未入单条目。
- 单次 Create Order：按订单打包台一次确认，包裹数远低于 2000 article 上限；**遵守**「单次 Create Order ≤ 2000 articles」。
- 超出 basket（10k）错误：映射为出标/建单失败业务码，提示重试或联系支持；日常单订单路径不会触顶。

---

## §14 Limitations（本期边界）

- 仅国内、STORED_PAYMENT、无 Charge Account / Pickup / International。
- Flat-rate Create Shipments **省略** weight/dims；OWN **强制**重量+三边。
- PDF 不长期存 S3（AusPost URL ~48h）；超时引导 MyPost 后台。
- 轨迹通过 Track Items API 获取，并在商户/顾客端展示。

---

## §15 Service Availability

- 订阅 AusPost developer status（运营侧）。
- 平台自身：常规健康检查；计划内维护走现有商户/状态通知渠道（与全站一致）。
- 表单「是否有正式对外沟通计划」：勾 **Yes**（沿用平台运维通知；细节可邮件补充）。
