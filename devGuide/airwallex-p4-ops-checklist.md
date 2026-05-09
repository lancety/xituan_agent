# Airwallex P4 下线 — 运维清单（文档 / 环境 / 平台）

后端已移除 Airwallex 集成与 Webhook 路由；数据库与枚举中的 **历史值保留**。下列事项由运维在 **各环境** 与 **第三方控制台** 执行，不在应用迁移脚本中自动完成。

---

## 1. 密钥与注入环境（必查）

| 项 | 说明 |
|----|------|
| `AIRWALLEX_API_KEY` / `AIRWALLEX_CLIENT_ID` / `AIRWALLEX_WEBHOOK_SECRET` | 从 **ECS / Railway / GitHub Actions secrets / `.env` 私有副本** 中删除或停用注入；仓库内示例 `.env` 已去敏为注释。 |
| `AIRWALLEX_BASE_URL` | **可选**：仅当仍需在 CMS 中 **预览** 旧 `payment_provider`（Airwallex 形态）JSON 时保留；否则可删。 |
| `AIRWALLEX_CONNECT_WEBHOOK_ENABLED` | 已无代码读取；可删。 |

**动作**：在 staging / production 密钥管理界面核对一遍变量名，保存并 **重新部署** 使 Pod/实例不再携带旧变量。

---

## 2. Airwallex Dashboard（若曾配置）

- 删除或停用指向本系统域名的 **Webhook**（原路径含 `/api/webhooks/airwallex` 或 `airwallex-single`），避免对方仍向已下线 URL 投递。
- 若曾使用生产 **API Key**，按贵司策略在 Airwallex 侧 **轮换或作废**（代码已不再调用，但密钥泄露面仍存在）。

---

## 3. 监控与排障

- **CMS / Platform** Webhook 监控页仍展示 `merchant.webhooks_events_psp` 中 **历史** `payment_provider = airwallex` 行；**重放（retry）** 会对 Airwallex 明确失败（设计如此）。
- 新事件以 **Stripe**、**OmiPay** 为主；对照 `deploy.yml` 与当前 `app.ts` 仅注册 `/api/webhooks/stripe`、`/api/webhooks/omipay/:webhookKey`。

---

## 4. 文档与开发指引（已更新位置）

| 文档 | 用途 |
|------|------|
| `devGuide/airwallex-webhook-dev-setup.md` | 已标 **归档**；隧道/HTTPS 仍可参考；Webhook 路径已改为 Stripe/OmiPay 说明。 |
| `devGuide/cloudflared-tunnel-setup.md` | Quick/Named Tunnel 示例 URL 已改为 Stripe/OmiPay。 |
| `xituan_wechat_app/docs/wechat-pay-airwallex-setup.md` | 文首已标 **历史**；当前小程序支付见仓库内 OmiPay 流程与 `pages/payment`。 |
| `xituan_backend/src/domains/payment/README.md` | 与当前模块分层一致。 |

---

## 5. 子模块（如改过 `xituan_codebase`）

若某次提交修改了 **canonical** `xituan_codebase` 且需与其它父仓库对齐，按团队 **multirepo / submodule** 流程推送并更新各消费者指针（本清单不替代该流程）。

---

## 6. 验收建议（可选）

- [ ] Staging 环境变量中无 `AIRWALLEX_API_KEY` / `CLIENT_ID` / `WEBHOOK_SECRET`（或确认 intentionally unused）。
- [ ] 对 staging 域名 `curl -i POST https://<host>/api/webhooks/airwallex` 应 **404 或路由不存在**（视网关配置），且不应再命中应用内处理逻辑。
- [ ] Stripe、OmiPay 测试 Webhook 各走一通 **200** 与签名校验。

---

## 7. 数据库与迁移

- **不**要求为「去掉 airwallex 字样」做数据迁移；`migrations_stable/` 按仓库规则仍由人工维护。
- 若将来要清理 `webhooks_events_psp` 历史行，属 **独立数据治理** 任务，需单独评估与备份。
