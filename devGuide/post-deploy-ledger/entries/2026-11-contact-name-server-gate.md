# AusPost 收件人姓名：backend 门禁暂关 → WeChat UX 全量后再开

Last updated: 2026-11-08

| 字段 | 值 |
|------|-----|
| **ID** | `contact-name-server-gate` |
| **状态** | `done` |
| **当前已部署** | Backend Phase 1 `f68a97ae`；WeChat 已全量；Phase N 门禁已开回 `true`（待生产发版） |
| **待完成** | — |
| **Gate** | WeChat 含 `CONTACT_NAME_INVALID` Modal/handler 的版本审核通过并 **全量** ✅ |
| **创建日** | 2026-11-01 |
| **完成日** | 2026-11-08 |

## 背景

AusPost MyPost CSV 要求收件人姓名以英文字母开头（纯中文 / 纯 emoji / 数字开头不可导入）。Backend 在地址保存、下单、履约变更已抛 `CONTACT_NAME_INVALID`；CMS / Site / 地址表单客户端也有校验。

生产 WeChat 在部分路径（尤其下单）未注册该 code 的错误 handler，落到默认「操作失败」且无原因。在新包审核/全量前，server 门禁会让旧端用户被挡且看不懂原因。

## Phase 对照

| Phase | 内容 | 部署状态 | 验证 |
|-------|------|----------|------|
| **1** | Backend `ENFORCE_CONTACT_NAME_ON_SERVER = false`；WeChat 补 `CONTACT_NAME_INVALID` handler + 地址表单 Modal 提示 | 已完成 | 旧 WeChat 可保存/下单纯中文姓名；新 WeChat 本地拦截并说明原因 |
| **N** | `ENFORCE_CONTACT_NAME_ON_SERVER = true` | 代码已改；随 backend 生产发版 | 非法姓名再次被 server 拒绝且新端有明确文案 |

开关位置：`xituan_backend/src/shared/constants/contact-name-enforcement.constant.ts`

## 部署后债务（Post-deploy debt）

### Phase 1 生产确认

- [x] Backend 已推 `origin/production`（`f68a97ae`）
- [x] WeChat 新包已提审/发版并全量
- [x] Entry 状态 → `blocked`（等 WeChat 全量）

### Phase N 清理（Gate 通过后）

- [x] **Gate 确认**：含 contact-name UX 的 WeChat 版本全量（开发者 2026-11-08 确认）
- [x] `ENFORCE_CONTACT_NAME_ON_SERVER = true`（代码已改；随 backend 发版生效）
- [ ] 抽测：纯中文姓名保存地址 / 下单均返回 `CONTACT_NAME_INVALID`，新 WeChat 有明确提示（发版后）
- [x] 本 entry → `done`；registry 移至已归档

## 相关链接

- Util：`xituan_codebase/utils/contact-name.util.ts`
- Backend 调用点：`auth.controller`（add/update address）、`order.service`（resolve delivery address）、`order-delivery-fulfillment.service`
- WeChat：`business-error-message.util.ts`、`simple-error-handler.default.ts`、`delivery-address-form`
