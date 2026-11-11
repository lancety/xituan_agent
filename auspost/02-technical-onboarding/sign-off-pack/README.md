# MPB Tech Sign Off 材料包

Last updated: 2026-11-11

对照官方表单 [`../MPB Tech Sign Off.PDF`](../MPB%20Tech%20Sign%20Off.PDF) 与用例 [`../MPB Partner Verification Test Cases v1.1.XLSX`](../MPB%20Partner%20Verification%20Test%20Cases%20v1.1.XLSX)。  
填完本包后，把 PDF 签字页 + 本目录证据一并回传 Abdul / Partner 邮箱，换 **production credentials**。

**Partner ID**：`XITUAN-8745`（见 [`../../README.md`](../../README.md)）  
**公司名（MyPost 展示）**：Galaxy108 Pty Ltd / Xituan（以协议 Particulars 为准）

---

## 提交清单（勾完再交）

| # | 材料 | 状态 | 位置 |
|---|------|------|------|
| 1 | API License Agreement 已签回 | 本地有 SIGNED PDF | [`../../01-legal-agreement/`](../../01-legal-agreement/) |
| 2 | Lodgement / 工作流说明 | 已写 | [`01-lodgement-workflow.md`](./01-lodgement-workflow.md) |
| 3 | 已实现 API 勾选说明 | 已写 | 同文件 §API Calls |
| 4 | 错误处理 / 地址校验 / basket | 已写 | [`02-error-handling.md`](./02-error-handling.md) |
| 5 | 样例 JSON（request/response） | 模板 + demo admin 抓包 + **本地 AusPost 原始 HTTP**（shipments/orders/labels） | [`03-sample-payloads/`](./03-sample-payloads/)（`07-demo-*` + `09-local-*`） |
| 6 | 标签 PDF 样例（A6 + A4-4pp；PP/EXP 尽量各一） | **A6 + A4-4pp 均已有（EXP）**；另有本地 A6 | [`04-label-pdfs/`](./04-label-pdfs/) |
| 7 | 开发验证方式 | 建议 **a) Sandbox/Web staging** | demo CMS + backend；凭证另附邮件，勿进 git |
| 8 | 填好并签字的 `MPB Tech Sign Off.PDF` | **人工填 PDF** | 打印/Adobe 填后另存 `MPB Tech Sign Off - Galaxy108 SIGNED.pdf` |

OAuth / Pickup / Charge Account / International：**本期不申请**，表单勾 **No** / 不勾对应 API。

---

## 建议交给 AusPost 的附件顺序

1. 已签 License Agreement（若尚未回传）
2. 本包 `01` + `02`（可 PDF 打印或直接 md）
3. `03-sample-payloads/*.json`（脱敏后）
4. `04-label-pdfs/*.pdf`
5. 填完签字的 Tech Sign Off PDF
6. （可选）demo 走查：URL + 临时账号（邮件发送，不入库）

---

## 相关

- CMS MVP entry：`../../../devGuide/planned-work/entries/2026-11-auspost-mypost-dual-track.md`
- Track 轮询：`../../../devGuide/delivery/auspost-mpb-track-poll-design.md`
- 实现约束：`.cursor/skills/auspost-mpb-api-service/SKILL.md`
