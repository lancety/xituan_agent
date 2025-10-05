# Xituan Agent 使用示例

## 基本使用流程

### 1. 进入工具目录
```bash
cd xituan_agent
```

### 2. 安装依赖
```bash
npm install
```

### 3. 检查当前状态
```bash
# 检查所有项目版本状态
npm run version:check
```

### 4. 发布新版本

#### 场景1: Bug修复发布
```bash
# 自动发布补丁版本
npm run release:patch

# 或者自定义发布信息
node scripts/release.js patch "Fixed" "修复用户登录问题" "优化页面加载速度"
```

#### 场景2: 新功能发布
```bash
# 自动发布次要版本
npm run release:minor

# 或者自定义发布信息
node scripts/release.js minor "Added" "新增用户管理功能" "添加订单导出功能" "优化搜索性能"
```

#### 场景3: 重大更新发布
```bash
# 自动发布主要版本
npm run release:major

# 或者自定义发布信息
node scripts/release.js major "Changed" "重构用户系统" "更新API接口" "升级数据库结构"
```

### 5. 生成CHANGELOG
```bash
# 更新所有项目CHANGELOG
npm run changelog:generate

# 或者指定版本
node scripts/changelog-generator.js update 1.1.0
```

## 实际使用示例

### 示例1: 修复购物车bug
```bash
cd xituan_agent

# 1. 检查当前状态
npm run version:check

# 2. 发布修复版本
npm run release:patch

# 输出示例:
# === 发布共享代码库 ===
# 更新 submodules/xituan_codebase 版本号...
# 版本已更新为: 1.0.1
# 共享代码库 v1.0.1 发布完成
# 
# === 发布 xituan_backend ===
# 更新 xituan_backend 版本号...
# 版本已更新为: 1.0.1
# xituan_backend v1.0.1 发布完成
# 
# === 发布 xituan_cms ===
# 更新 xituan_cms 版本号...
# 版本已更新为: 0.1.1
# xituan_cms v0.1.1 发布完成
# 
# === 发布 xituan_wechat_app ===
# 更新 xituan_wechat_app 版本号...
# 版本已更新为: 1.0.1
# 微信小程序版本显示已更新为: v1.0.1
# app.json版本信息已更新
# xituan_wechat_app v1.0.1 发布完成
# 
# === 发布完成 ===
# 所有项目版本已同步发布
```

### 示例2: 添加新功能
```bash
cd xituan_agent

# 1. 检查状态
npm run version:check

# 2. 发布新功能版本
npm run release:minor

# 3. 生成CHANGELOG
npm run changelog:generate
```

### 示例3: 紧急修复
```bash
cd xituan_agent

# 快速发布紧急修复
node scripts/release.js patch "Fixed" "紧急修复支付问题" "修复订单状态错误"
```

## 版本检查示例

```bash
cd xituan_agent
npm run version:check

# 输出示例:
# === 版本一致性检查 ===
# 
# xituan_codebase: 1.0.1
# xituan_backend: 1.0.1
# xituan_cms: 0.1.1
# xituan_wechat_app: 1.0.1
#   - app.json版本: 1.0.1
#   - 显示版本: 1.0.1
# 
# 版本一致性: ✅ 通过
# 
# === Git状态检查 ===
# 
# xituan_codebase: ✅ 工作区干净
# xituan_backend: ✅ 工作区干净
# xituan_cms: ✅ 工作区干净
# xituan_wechat_app: ✅ 工作区干净
# 
# === 依赖版本检查 ===
# 
# xituan_backend 依赖:
#   - typescript: ^5.8.0 (dev)
#   - express: ^4.18.2
# 
# xituan_cms 依赖:
#   - react: ^18.2.0
#   - next: 14.1.0
#   - typescript: ^5.3.3 (dev)
# 
# xituan_wechat_app 依赖:
#   - typescript: ^5.8.0 (dev)
```

## 故障排除示例

### 问题1: 版本号不一致
```bash
# 检查具体问题
npm run version:check

# 手动修复版本号
cd ../xituan_wechat_app
npm version 1.0.1
git add .
git commit -m "fix: sync version to 1.0.1"
```

### 问题2: Git submodule更新失败
```bash
# 重新初始化submodule
git submodule update --init --recursive
git submodule update --remote
```

### 问题3: 权限问题
```bash
# 给脚本添加执行权限
chmod +x scripts/*.js
```

## 最佳实践

1. **发布前检查**: 始终先运行 `npm run version:check`
2. **小步快跑**: 优先使用patch版本，避免积累大量变更
3. **及时发布**: 功能开发完成后及时发布，不要积累
4. **记录变更**: 使用有意义的提交信息
5. **测试验证**: 发布后及时验证功能

## 注意事项

- 确保在项目根目录运行工具
- 发布前确保所有更改已提交
- 微信小程序需要特殊处理版本显示
- 共享代码库更新后需要同步到各项目




