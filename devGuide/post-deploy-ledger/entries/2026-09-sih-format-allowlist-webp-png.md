# SIH：format 白名单收紧 + Lambda 环境变量提醒

Last updated: 2026-09-05

| 字段 | 值 |
|------|-----|
| **ID** | `sih-format-allowlist-webp-png` |
| **状态** | `planned` |
| **当前已部署** | —（format 白名单**本期不动**） |
| **待完成** | ① 部署 SIH 样本时：**手动更新 Lambda 环境变量 `SIZE_OPTS`**；② Gate 后评估去掉 SIH `jpeg/jpg` |
| **Gate** | Normalize/回填后主路径多为 `.webp`/`.png` 且 SIH 查询不再依赖 `format=jpeg` |
| **创建日** | 2026-09-05 |

## 背景

Phase A SIH 样本 `validateParams` 中 `ALLOWED_IMAGE_FORMATS` 含 `jpeg` / `jpg` / `png` / `webp`。  
`content.util.getContentUrlImage` 的 `format` **跟路径扩展名**，存量 `.jpg` 仍会拼 `format=jpeg`。若过早只允许 `webp|png`，现网 SIH 会大面积 500。

浏览器 / 微信对 **显示** webp 已基本够用，但 **白名单收紧** 必须等对象与 URL 契约切完。

另：样本 JS 默认尺寸为 `64,128,256,512,1024`；**Lambda 控制台手动环境变量 `SIZE_OPTS` 不会随代码自动变**，部署样本或改契约时必须人工改 env。

**本期明确：不改 format 白名单代码。** 部署样本时再改 `SIZE_OPTS`。

## Phase 对照

| Phase | 内容 | 部署状态 | 验证 |
|-------|------|----------|------|
| **样本部署（人工）** | 上传 `content.util.sample.*.js`；**手动设 `SIZE_OPTS=64,128,256,512,1024`**（过渡期若需兼容老端请求 2048，可临时追加 `,2048`） | pending | 缩略 SIH 正常；非法尺寸拒绝；大图直链原图 |
| **现状（format 兼容）** | SIH 样本允许 `jpeg\|jpg\|png\|webp`；客户端按扩展名拼 format | 保持 | 现网 jpg SIH 正常 |
| **N（format 清理，Gate 后）** | 评估并可能：样本只保留 `webp\|png`；确认无 `format=jpeg` 流量 | pending | Gate 后单独决策与 PR |

## Gate（可验证）

- [ ] IMAGE_NORMALIZE（或等价）主路径新图默认 **webp**（logo 等 **png**）已上线并稳定
- [ ] 存量回填覆盖主要业务图，或接受剩余 jpg 仅直链、不再走 SIH `format=jpeg`
- [ ] 抽样 / 日志：SIH 请求中 `format=jpeg` 占比可忽略（或仅旧客户端可接受窗口）
- [ ] WeChat / Site / CMS 已发版路径与文档一致：大图无 SIH；缩略 format 与扩展名一致

## 部署后债务（Post-deploy debt）

### 提醒开发者（聊天 / 部署时）

- [ ] **部署或更新 SIH Lambda 时：提醒手动改环境变量 `SIZE_OPTS`**（默认建议 `64,128,256,512,1024`；老端未切完可临时加 `2048`）
- [ ] 确认 fit 忽略、format 白名单行为与已部署样本一致

### 现状

- [x] 登记本 entry；**不改** 当前 `ALLOWED_IMAGE_FORMATS`
- [ ] Phase C Normalize / 回填推进时回看本条

### Phase N（Gate 通过后，单独评估 + PR）

- [ ] 决定：Lambda 样本 `ALLOWED_IMAGE_FORMATS` 是否改为仅 `webp` / `png`
- [ ] 若收紧：同步部署 dev/staging/prod SIH；回归 jpg 存量路径（应无 SIH jpeg 或已直链）
- [ ] 环境变量 `SIZE_OPTS` 是否去掉临时 `2048`（若曾追加）
- [ ] 更新 `devGuide/sih-image-size-phase-a.md`
- [ ] 本 entry → `done`；registry 归档

## 相关链接

- SIH 样本：`xituan_agent/lambda/content.util.sample.dev.js` / `.prod.js`（`ALLOWED_IMAGE_FORMATS`、`SIZE_OPTS` 默认）
- URL 契约：`xituan_codebase/utils/content.util.ts` → `resolveFormatFromContentPath`
- 契约文档：[`../sih-image-size-phase-a.md`](../sih-image-size-phase-a.md)
