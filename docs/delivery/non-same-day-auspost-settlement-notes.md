# 非当日邮寄（AusPost flat-rate）结算备注

Last updated: 2026-08-11

## 当前装箱设定（已确认）

- 产品软包装体积系数：`packVolumeFactor`（默认 `1`，软袋碱水面包建议 `0.46`）
- **结账装箱暂时只使用 flat-rate box**（**无 XS**，仅 S/M/L/XL）；satchel 数据仍保留在常量中，但不参与报价选箱
- **Box 运费口径**：AusPost「Flat rate packaging — postage only」（不含箱子本身费用）
  - Express：S $15.20 / M $20 / L $24.75 / XL $32.95（2026-07-01）
  - Parcel Post：S $11.70 / M $16 / L $20.25 / XL $24.45
  - 注意：与「Express Post parcel box and postage」（含箱，如 S $17.15）是另一套 SKU，当前不采用
- 箱型体积 fill：
  - S `0.88` / M `0.85`（与软袋 `packVolumeFactor=0.46` + 140×140×40 对齐约 S=6 / M=12）
  - L `0.87`
  - XL `0.88`
- 单件仍按硬外尺寸判断能否装入；系数只影响多件有效体积

参考默认件：`140×140×40 mm` + 系数 `0.46` → 算法约 box S=6 / M=12

## 结算 / 退差备注（未实现，产品约定）

**结账付款时**按算法箱型报价收取运费（含货值抵扣规则）。

**付款后实际打包**若能装进**更小**的 AusPost flat-rate 箱（相对订单快照里的箱型），允许给用户退 **箱型运费差额**（报价箱 prepaid 价 − 实际更小箱 prepaid 价，再按当时抵扣规则口径处理；具体退款入口可复用现有退运费能力）。

- 本条仅为结算侧产品备注，**本期不实现自动退差**
- 实施时需对照订单 `shippingPackagingSnapshot` 与实际装箱记录
