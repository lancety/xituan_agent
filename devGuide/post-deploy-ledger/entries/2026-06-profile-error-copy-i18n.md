# PROFILE_ERROR_COPY i18n cleanup

Last updated: 2026-06-18

| Field | Value |
|-------|-------|
| **ID** | `profile-error-copy-i18n` |
| **Status** | `planned` |
| **Deployed** | — |
| **Pending** | Phase 1 → Phase 2 |
| **Gate (Phase 2)** | 所有 frontend consumer 已改用 enum/code + i18n；`xituan_codebase` 不再内嵌 `PROFILE_ERROR_COPY` 中文文案；旧调用路径 smoke OK |
| **Created** | 2026-06-18 |

## Background

`PROFILE_ERROR_COPY` 当前用于 auth/profile 相关错误展示文案。后续需要把用户可见文案从 `xituan_codebase` 移出，改为共享 enum/code + 各前端 i18n 映射，避免 codebase 内嵌中文字符串。

目标：

- `xituan_codebase` 只提供稳定错误 code/enum 与必要的结构化 helper，不包含中文用户文案。
- CMS / Site / WeChat 等前端按自身 i18n 体系映射 `PROFILE_ERROR_COPY` 相关 code。
- 后端/API 不返回 locale-specific message，前端按 code 展示本地化文案。

## Phase map

| Phase | Scope | Deploy | Verify |
|-------|-------|--------|--------|
| **1** | 新增或调整 profile/auth 错误 enum/code；前端补齐 i18n 映射并切换展示逻辑；保留旧 `PROFILE_ERROR_COPY` 兼容导出（如仍有消费者） | pending | 相关登录/profile/access 场景错误提示仍能展示；各前端语言资源存在对应 key |
| **2** | Gate 满足后删除 `PROFILE_ERROR_COPY` 中的内嵌中文文案与旧兼容路径 | pending | grep 确认无消费者依赖旧中文 copy；codebase 无用户可见中文文案 |

## Post-deploy debt

### Phase 1 prod confirm

- [ ] `xituan_codebase` 已定义 canonical enum/code（不要硬编码 string value）
- [ ] CMS / Site / WeChat consumer 已使用 enum/code 触发 i18n，而不是显示 raw `Error.message`
- [ ] 各前端 i18n 资源已补齐 `PROFILE_ERROR_COPY` 对应短文案/摘要
- [ ] auth/profile/access 相关错误路径 smoke OK
- [ ] Entry → `active` 或 `blocked`；registry updated

### Phase 2 cleanup (after Gate)

- [ ] grep 确认 `PROFILE_ERROR_COPY` 旧中文 copy 不再被任何 consumer 使用
- [ ] 删除 `xituan_codebase` 内嵌中文文案与旧兼容导出
- [ ] 确认 `xituan_codebase` 仅保留 enum/code/结构化 helper
- [ ] Entry → `done`；registry archived

## Technical notes

- enum value 不要在调用处直接 hardcode string，应通过 enum prop 引用。
- TypeScript 变更禁止使用 `any`。
- 纯 util 新文件需按项目约定使用 `*.util.ts`，并通过与文件名匹配的主变量导出。

## Links

- Current util: `xituan_codebase/utils/auth-profile-message.util.ts`
