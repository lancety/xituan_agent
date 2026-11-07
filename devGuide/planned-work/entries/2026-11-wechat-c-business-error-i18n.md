# wechat-c-business-error-i18n

Last updated: 2026-11-07

## 摘要

微信 **C 端**业务错误统一 `code → business-error-message`，禁止 toast 接口原文。**high**。

微信「我的网店」商户管理将删除 → **不**为商户面板做专项 handler。

Cursor plan：`d:/projects/xituan_module/.cursor/plans_planned/app_business-error_standard_0b00f8f4.plan.md`

## 当前掌握的信息

- Customer / Merchant App / CMS 已有统一 util。
- 微信仍有 `SimpleErrorHandler` 与多处 `err.message` 路径。
- 契约：API `code` + payload/lineErrors；客户端 i18n。

## 期望目标结果

### 计划要做的

- [ ] 审计微信 C 端业务 API 错误展示
- [ ] 全部改为 code→i18n；补缺失文案
- [ ] 退款超额等关键码覆盖

### 触发后才做的

- [ ] 删除「我的网店」后清理 panel 专用错误路径 — 触发：商户面板下线 PR

## 触发条件 / 目标窗口

high；可与业务错误扫漏同窗口。
