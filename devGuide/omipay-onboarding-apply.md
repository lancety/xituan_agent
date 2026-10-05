# OmiPay 入驻申请（资质上传 + 邮件）

## 范围

- CMS：运营 Tab 资质文件；在线支付 OmiPay 卡「申请开通」
- Platform：系统设定 → OmiPay 合作方（申请邮箱 / 微信 / QR）
- Backend：`compliance_documents`、申请 API、SES 附件邮件、ABN Lookup（GUID 可 placeholder）

## 关键配置

| 项 | 说明 |
|----|------|
| Platform `omipay_partner` | **无独立 migration**。Platform 设定第一次保存即 upsert 建行；未配置时邮箱/微信为空，申请会因未配置收件邮箱失败 |
| `ABN_LOOKUP_GUID` | 本地 `.env`；生产/demo 用 GitHub secret，并由 `deploy.yml` / `deploy-demo.yml` 注入。占位或未配置时跳过远程 Lookup，仅校验 ABN 校验位 |
| 邮件 | `MAIL_FROM` / `MERCHANT_CONTACT_EMAIL`；to=platform 申请邮箱，replyTo+cc=商户运营邮箱，再 cc `merchant@xituan.com.au` |

## API

- `PUT /api/admin/merchant-settings/compliance_documents`（FormData）
- `POST /api/admin/merchant-settings/payment_provider_omipay/onboarding-apply` `{ note? }`
- `PUT /api/admin/platform-settings/omipay_partner`（FormData，QR）
- 商户申请：`POST` 入驻时 ABN 校验位 +（GUID 有效时）ABN Lookup

## 限发

距上次成功发送满 **24 小时**（UTC 时刻差）；冷却错误带 `omipayOnboardingApplyCooldown.nextEligibleAt`。

## 必填（申请时）

银行流水；公司 ASIC；身份件（驾照正+反 **或** 护照）；运营联系电话/邮箱。Sole trader **不要求** ABN 文件。
