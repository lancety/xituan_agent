# mobile-markdown-body-image-insert

Last updated: 2026-11-27

## 摘要

商家 App 和微信商户端的正文 Markdown 插图单独做。CMS 插图和各端展示已经落地，见 [markdown-body-image.md](../../markdown-body-image.md)。本条优先级 **mid**，现在不实施。

## 当前掌握的信息

- 商家 App `MarkdownEditor` 的图片按钮只插入 `![描述](图片URL)`。新闻正文不再传 `imageUpload`。展示侧 `MarkdownBody` 仍按 `dw` 和同一行不换行来画。
- 微信商户团购 / 预定编辑器是 textarea，没有插图按钮。顾客活动简介和新闻详情的 wemark 展示保留。
- 上传契约与 CMS 相同：直传、`retainPending`、`dw`、长边不超过 2048 的 webp。手机端不要照搬 CMS 的 `react-advanced-cropper` 弹窗。
- 响应式的最小 / 最大宽度和图组不在本条里，见 `.cursor/plans_planned/正文图_flex_布局_444970db.plan.md`。

## 期望目标结果

### 计划要做的

- [ ] 商家 App：新闻正文（以及日后若开放的活动描述）从编辑器插入已上传图片，并写入 `dw`
- [ ] 微信商户：团购 / 预定描述从编辑界面插入已上传图片，并写入 `dw`
- [ ] 插入结果能被现有 Site、顾客 App、微信顾客活动简介原样展示

### 触发后才做的

- [ ] 活动描述若仍是纯文本字段，先确认是否改成与 CMS 相同的 Markdown 正文，再接插图

## 触发条件 / 目标窗口

主动启动移动端正文插图时再做。不要和 CMS 展示修补混在同一次改动里。
