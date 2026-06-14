# 微信小程序分包 Bootstrap 契约（wechat-main-constants）

Last updated: 2026-06-13

## 背景

分享冷启动与分包 eager 加载时，**模块求值阶段**不能读取 `codebaseBootstrapAccessUtil`（见 [wechat-bootstrap-gate-share-coldstart.md](./wechat-bootstrap-gate-share-coldstart.md)）。主包与分包均需在 `Component({ data/properties })`、`pageConfig.data`、模块顶层 `const` 使用 **静态 enum/常量**，而不能走 bootstrap gate。

原先手抄 enum（如 `lib/wechat-nav-icon-kind.enum.ts`）易漂移。现改为 **manifest 驱动的整文件 sync**，由 ESLint 守门。

## 架构分层

| 场景 | 允许 import 来源 |
|------|------------------|
| 模块 init / `data` / `properties.value` 的 **运行时 enum 值** | `lib/wechat-main-constants/<manifest 路径>` |
| 仅类型注解（interface、type alias、泛型） | `import type` from `submodules/xituan_codebase/**/*.type.ts`（**不必**进 manifest） |
| 业务 service / util（需 bootstrap 导出） | `codebaseBootstrapAccessUtil`，**仅**在 `onLoadPage`、`attached`、普通函数内 |
| 同步脚本白名单 | `submodules/wechat-bootstrap.util.ts`、`lib/codebase-host.util.ts` |

**禁止**手改 `lib/wechat-main-constants/**`；只能跑 sync 脚本生成。

## Manifest（逐条登记）

文件：`xituan_wechat_app/scripts/wechat-main-constants.manifest.mjs`

当前条目（路径相对 `submodules/xituan_codebase/`）：

| source | 典型用途 |
|--------|----------|
| `typing/wechat-nav-icon.enum.ts` | Nav 组件 `properties.kind` 默认值 |
| `typing_entity/order.enum.ts` | 订单/配送/购物车 page `data` 初值 |
| `typing_entity/payment.type.ts` | 支付方式、支付状态 |
| `typing_entity/order-payment-record.type.ts` | 支付记录 method enum |
| `typing_entity/wechat-subscribe-template.enum.ts` | 订阅消息 template key |
| `constants/message-notification-sound.enum.ts` | IM 消息提示音常量 |

新增 runtime enum 时：**先**在 manifest 加一行 → `npm run sync:wechat-main-constants` → 改业务 import → `npm run lint`。

## Sync / Verify

```bash
cd xituan_wechat_app
npm run sync:wechat-main-constants   # 从 codebase 子模块复制到 lib/wechat-main-constants/
npm run verify:wechat-main-constants # 校验 drift（lint 前置步骤）
npm run lint                         # verify + ESLint 四条 local 规则
```

生成文件带 `AUTO-GENERATED` 头；路径与 codebase **相对路径一致**（如 `lib/wechat-main-constants/typing_entity/order.enum.ts`）。

**代码质量 / 「主包未使用的 JS」**：微信**不能**按文件夹关闭该项检测。manifest 中部分文件仅被子包引用时，会报「主包存在仅被其他分包依赖的 JS」。对策：

1. `lib/wechat-main-constants/subpackage-shared-constants-anchor.ts`（sync 自动生成）— `app.ts` side-effect import，让静态分析认定主包依赖整组 manifest
2. `project.config.json` → `packOptions.include` 含 `lib/wechat-main-constants` 文件夹，避免上传时被误过滤

manifest 增删后须 `npm run sync:wechat-main-constants` 以更新 anchor。

## ESLint 守门（`eslint-local-rules/`）

| 规则 | 作用 |
|------|------|
| `no-sync-submodules-codebase-import` | 禁止 value import `submodules/xituan_codebase`（白名单除外） |
| `prefer-wechat-main-constants` | manifest 内模块必须从 `lib/wechat-main-constants/` value import |
| `no-bootstrap-module-init` | 禁止在 Component/Page `data`、`properties.value`、program-level pageConfig 读 bootstrap |
| `no-promote-status-enum-misuse` | 活动生命周期须用 `epPreorderPromoteStatus`，勿误用 order 的 `epPreorderStatus` |

`createCustomMessage({ data: ... })` 等普通对象的 `data` 字段**不会**误判为 page init（规则按 Component/Page 调用链判定）。

## 发布链路守门（微信开发者工具）

GitHub 仅做版本管理；**编译 / 预览 / 上传**前由 `project.config.json` 钩子检查：

| 钩子 | 开发者工具「本地设置」填写的命令（Windows） | 检查内容 |
|------|---------------------------------------------|----------|
| 编译前预处理 | `call scripts\before-compile.cmd` | verify（6 文件 drift） |
| 预览前预处理 | `call scripts\before-upload.cmd` | lint 全量 |
| 上传前预处理 | `call scripts\before-upload.cmd` | lint 全量 |

**勿用** `scripts/before-compile.cmd`（正斜杠）——会被误解析为命令 `scripts`。

手动等价：`npm run precompile:check` / `npm run preupload:check`

macOS 本地设置可填 `node scripts/before-compile.mjs` / `node scripts/before-upload.mjs`。

非 0 退出则中止对应操作。

**日志在哪看（调试器 Console 与业务 log 同一面板）**

| 时机 | 可见输出 |
|------|----------|
| 编译/预览/上传**失败** | shell 报错（如「不是内部或外部命令」） |
| 编译/预览/上传**成功** | cmd 最后一行 `$: [precompile:check] PASS — …`（与失败同属调试器 Console） |
| 备用 | 项目根 `wechat-hook-last.log` |

Console 勾选 **Preserve log**。保存文件触发的 `$: Compiling` **不会**跑 `beforeCompile`，须手动点「编译」。

手动：`npm run precompile:check` / `npm run preupload:check`

GitHub Actions / CI **非必需**；multirepo sync 阶段 3 仍建议在 commit 前 verify/sync constants。

## Multirepo sync 挂钩

在 [xituan-multirepo-codebase-sync](../../.cursor/skills/xituan-multirepo-codebase-sync/SKILL.md) **阶段 3** 处理 `xituan_wechat_app` 时，在 `git commit` 之前：

1. `npm run sync:wechat-main-constants`
2. `npm run verify:wechat-main-constants`（或 `npm run lint`）
3. 将 `lib/wechat-main-constants/**` 与 manifest/sync 脚本变更一并提交

Commit 示例：`chore(wechat): sync wechat-main-constants after codebase bump`

## 改法速查

| 违规模式 | 修复 |
|----------|------|
| `data: { x: codebaseBootstrapAccessUtil.epXxx.Y }` | 改 import `lib/wechat-main-constants/...` |
| 模块顶层 `const MAP = { [codebaseBootstrapAccessUtil.epXxx.A]: ... }` | 改用 constants import，或惰性 getter |
| 手抄 enum 与 codebase 重复 | 删手抄文件，manifest + sync |
| 仅需类型 | `import type { ... } from 'submodules/xituan_codebase/...'` |

## 验收清单

1. `npm run verify:wechat-main-constants` — 6 文件无 drift
2. `npm run lint` / `npm run preupload:check` — 0 error
3. 微信开发者工具已勾选「启用自定义处理命令」；预览/上传被 lint 正确拦截或放行
3. 分享冷启动活动/商品页 — 无 `Bootstrap not ready`
4. 购物车 Tab、`nav-icon` 渲染正常
5. 分包抽测：merchant 订单弹窗、trade 下单页、IM 订阅/提示音

## 相关文档

- [wechat-bootstrap-gate-share-coldstart.md](./wechat-bootstrap-gate-share-coldstart.md) — 冷启动 gate 与 Page/Component 同步注册约束
- `.cursor/skills/xituan-multirepo-codebase-sync/SKILL.md` — 多仓 sync 阶段 3 wechat 步骤
