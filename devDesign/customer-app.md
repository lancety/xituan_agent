# L2 · Customer App（`xituan_app_customer`）差异

Last updated: 2026-11-14

继承：[`00-platform-wide.md`](./00-platform-wide.md) → [`client.md`](./client.md)

## 本端差异（相对 L1）

| 项 | 约定 |
|----|------|
| 栈 | Expo / React Native |
| 主题 | L0 语义色映射到 RN theme；禁止独立「App 专用品牌色」 |
| 列表 | 遵循 `expo-paginated-list-scroll`、list-to-detail 首屏预算 |
| 上传等 | 走既有 S3 direct-upload（Android/iOS skill） |

## 待补

- 与 Site / WeChat 共用的店面组件视觉对照。
- 导航 Tab / 栈与 Site 路由语义对照表。
