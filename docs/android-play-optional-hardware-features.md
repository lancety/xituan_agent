# Android Play：硬件 `uses-feature` 一律 optional（草案）

## 结论

对喜团 **customer / merchant** Expo App：**默认把所有硬件 `uses-feature` 标成 `android:required="false"`** 更合适。  
App 不是「无摄像头不能装」类产品；Play 审核反复卡的是 **可用性过窄**，不是真依赖某块硬件。

但 **只扫清单里已有条目不够**——Play 还会从 **权限 / Activity 属性** 推断 feature，推断结果在 merge 后的 manifest 里可能根本没有对应 `<uses-feature>`，默认即 required。

## Play 行为（为何会反复踩）

| 来源 | 典型推断 | 是否会出现在我们的 manifest |
|------|----------|------------------------------|
| `ACCESS_WIFI_STATE` 等 | `android.hardware.wifi` | 常无显式声明 → 被当成 required |
| `CAMERA` / location 权限 | camera / location.* | 同上 |
| `android:screenOrientation="portrait"` | `android.hardware.screen.portrait` | 同上（已在 4.3.1-12 踩到） |
| 依赖库自带 `<uses-feature required="true">` | 各异 | 有声明 → 必须改成 false |

因此策略是 **两段式**，不是纯白名单堆砌。

## 推荐方案（两段式）

在现有 `plugins/with-android-optional-features.cjs`（customer + merchant 各一份，逻辑保持一致）中：

### A. 全量降级（兜底）

对 **当前 merge 结果** 里每一个 `<uses-feature>`：

- 一律设 `android:required="false"`
- 不区分 name（含库注入的）

可选：`uses-feature` 带 `android:glEsVersion` 的也降级（一般可装设备本就支持；若将来真要强制 GLES 再单独例外）。

### B. 推断种子表（补洞）

维护一份 **Play 常推断、但 merge 时可能不存在** 的 name，**若缺失则插入** `required="false"`：

- `android.hardware.wifi`
- `android.hardware.camera`（及若需要 `camera.autofocus` 等再加）
- `android.hardware.location` / `.gps` / `.network`
- `android.hardware.screen.portrait`（及必要时 `.landscape`）
- 按实际权限再补：`telephony`、`microphone`、`bluetooth`、`touchscreen` 等（**不要提前堆无关项**；有权限/属性再加）

种子表是 **补洞**，不是唯一真相；真相是 A +「新踩到就加进种子」。

### C. 明确不做

- **不要**靠改掉 `screenOrientation` / 去掉权限来「消掉」推断（产品行为会变）。
- **不要**假设 EAS/本地一次 prebuild 后 `android/` 手改能长期生效；以 **config plugin** 为准（`android/` 可 gitignore）。
- **不要**对 `uses-permission` 乱改；只动 feature 的 `required`。

## 与「纯白名单」对比

| | 纯白名单（现状演进） | 两段式（推荐） |
|--|---------------------|---------------|
| 库突然注入新 `uses-feature` | 容易漏，再被 Play 打回 | A 已覆盖 |
| 权限/orientation 推断 | 必须记得加进名单 | B 种子表专门覆盖 |
| 维护成本 | 每次打回加一项 | 打回只扩种子；库侧自动降级 |
| 误伤「真·必需硬件」 | 低 | 对本产品可接受；真要强制某 feature 再加 allow-required 例外 |

## 验证

1. prebuild / 打 AAB 后检查最终 manifest：相关 `uses-feature` 均为 `required="false"`，且含 portrait / wifi。
2. Play Console「Device catalog / availability」或送审前的 hardware feature 提示消失。
3. versionCode 递增后重传（同一 code 不能覆盖）。

## 落地范围

- `xituan_app_merchant` + `xituan_app_customer` 同一插件语义（可复制或日后抽共享，暂不强制抽包）。
- 与 store release copy 无关；本文件只谈 Android 可用性。

## 状态

已落地：`plugins/with-android-optional-features.cjs` v2.0.0（merchant + customer）采用 **A+B**。
