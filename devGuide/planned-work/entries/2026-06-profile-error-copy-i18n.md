# profile-error-copy-i18n

Last updated: 2026-11-16

## 摘要

登录/资料相关错误的用户文案从 `xituan_codebase` 的 `PROFILE_ERROR_COPY` 挪到各端 i18n。API 已经是 `BusinessError` code，backend 不返回固定中文。这是还没做的文案搬迁，不是已上线兼容层。优先级 **mid**。

## 当前掌握的信息

- 文案在 `xituan_codebase/utils/auth-profile-message.util.ts`：按 `eBusinessErrorCode` 映射 zh_cn / zh_tw / en 的 title + message。
- 覆盖邮箱、手机、用户名、昵称、未登录等资料/登录错误。
- 各端若直接用这个 util，就不是自己的 i18n 文件。

## 期望目标结果

### 计划要做的

- [ ] 各端 i18n 补上对应短文案，展示改走 code → 本地文案
- [ ] 登录/资料/访问相关错误不再读 `PROFILE_ERROR_COPY`

### 触发后才做的

- [ ] 删除 codebase 里的中文/英文字符串表 — 触发：CMS / Site / WeChat / App 都不再引用 `PROFILE_ERROR_COPY`

## 触发条件 / 目标窗口

**mid**。有空窗，或改登录/资料错误提示时一起做。
