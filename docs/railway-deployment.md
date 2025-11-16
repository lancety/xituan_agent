# Railway 部署指南

## 环境变量配置

本项目使用环境变量进行配置管理，这是 Railway 推荐的最佳实践。

### 必需的环境变量

Railway 会自动注入以下环境变量：

- `DATABASE_URL`: PostgreSQL 数据库连接 URL
  - 格式: `postgres://username:password@host:port/database`
  - Railway 会自动提供此变量
  
- `PORT`: 应用程序端口
  - Railway 会自动设置此变量
  - 本地开发默认: 3000

- `NODE_ENV`: 运行环境
  - 生产环境: `production`
  - 开发环境: `development`

### Railway 部署步骤

1. **创建 Railway 项目**
   ```bash
   railway init
   ```

2. **添加 PostgreSQL 服务**
   - 在 Railway 控制台添加 PostgreSQL
   - Railway 会自动配置数据库并注入环境变量

3. **设置环境变量**
   在 Railway 控制台设置：
   ```
   NODE_ENV=production
   ```
   其他变量会由 Railway 自动管理。

4. **部署命令**
   ```bash
   npm install
   npm run build
   npm start
   ```

### 本地开发

1. **设置环境变量**
   创建 `.env` 文件（不要提交到版本控制）：
   ```
   DATABASE_URL=postgres://postgres:postgres@localhost:5432/xituan_dev
   NODE_ENV=development
   PORT=3000
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **启动开发服务器**
   ```bash
   npm run dev
   ```

### 数据库迁移

在生产环境中，数据库不会自动同步表结构。需要手动运行迁移：

```bash
npm run migration:run
```

### 监控和日志

- 健康检查端点: `/health`
- 生产环境关闭了详细日志，只保留错误日志
- 可通过健康检查端点查看数据库连接状态

### 为什么选择环境变量？

1. **安全性**
   - 敏感信息不会出现在代码中
   - 每个环境可以有独立的配置
   - 避免意外提交密钥到版本控制

2. **Railway 集成**
   - Railway 原生支持环境变量管理
   - 自动注入数据库连接信息
   - UI 界面易于管理

3. **可扩展性**
   - 易于添加新的配置项
   - 支持动态更新
   - 适合容器化部署

4. **最佳实践**
   - 符合 12-Factor App 原则
   - 更好的开发运维分离
   - 更容易进行配置管理 