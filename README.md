# Xituan Agent - 版本管理工具

这是一个专为Xituan项目设计的版本管理和发布工具集。

## 功能特性

- 🚀 **智能发布**: 自动协调多个项目的版本发布，基于Git历史智能生成CHANGELOG
- 🔍 **版本检查**: 检查版本一致性和Git状态
- 📝 **智能CHANGELOG**: 自动分析Git提交历史，智能分类并生成变更日志
- 🔄 **Submodule管理**: 自动更新共享代码库引用
- 📱 **微信小程序支持**: 特殊处理微信小程序的版本管理
- 🎯 **版本统一**: 保持所有项目版本号一致，智能跳过中间版本

## 项目结构

```
xituan_agent/
├── scripts/
│   ├── unified-release.js      # 智能统一发布脚本
│   ├── version-check.js        # 版本检查工具
│   └── changelog-generator.js  # CHANGELOG生成器
├── package.json                # 工具依赖和脚本配置
├── version-release-guide.md    # 详细发布流程文档
├── DEVELOPMENT_WORKFLOW.md     # 开发工作流程指南
└── README.md                   # 本文件
```

## 快速开始

### 安装依赖

```bash
cd xituan_agent
npm install
```

### 基本使用

#### 1. 版本检查
```bash
# 检查所有项目版本状态
npm run version:check
```

#### 2. 智能发布新版本
```bash
# 补丁版本发布 (bug修复)
npm run release:patch

# 次要版本发布 (新功能) - 推荐
npm run release:minor

# 主要版本发布 (破坏性变更)
npm run release:major
```

**智能特性**:
- 自动分析Git提交历史
- 智能分类变更内容 (feat, fix, docs等)
- 保持所有项目版本统一
- 自动跳过中间版本号

#### 3. 生成CHANGELOG
```bash
# 更新所有项目CHANGELOG
npm run changelog:generate
```

## 详细说明

### 发布脚本 (release.js)

主发布脚本，支持以下功能：

- 自动版本号递增
- 多项目协调发布
- 共享代码库submodule更新
- 微信小程序特殊处理
- 自动生成CHANGELOG
- Git标签管理

**使用方法:**
```bash
# 基本发布
node scripts/release.js patch

# 自定义发布
node scripts/release.js patch "Fixed" "修复用户登录问题" "优化性能"
```

### 版本检查工具 (version-check.js)

检查以下内容：

- 版本号一致性
- Git工作区状态
- 依赖版本信息
- 微信小程序版本同步

**使用方法:**
```bash
node scripts/version-check.js
```

### CHANGELOG生成器 (changelog-generator.js)

自动生成变更日志，支持：

- 提交信息智能分类
- 多项目汇总
- 版本对比
- 变更摘要

**使用方法:**
```bash
# 更新所有CHANGELOG
node scripts/changelog-generator.js update 1.0.1

# 显示变更摘要
node scripts/changelog-generator.js summary

# 显示帮助
node scripts/changelog-generator.js help
```

## 支持的版本类型

- **patch**: 补丁版本 (1.0.0 → 1.0.1) - 用于bug修复
- **minor**: 次要版本 (1.0.0 → 1.1.0) - 用于新功能
- **major**: 主要版本 (1.0.0 → 2.0.0) - 用于破坏性变更

## 项目支持

本工具支持以下Xituan项目：

- `xituan_wechat_app` - 微信小程序
- `xituan_cms` - Next.js CMS
- `xituan_backend` - NestJS Backend
- `submodules/xituan_codebase` - 共享代码库

## 注意事项

1. **发布前检查**: 确保所有项目工作区干净
2. **版本同步**: 所有项目使用相同的主版本号
3. **Submodule更新**: 共享代码库更新后需要同步到各项目
4. **微信小程序**: 需要同时更新app.json和显示版本

## 故障排除

### 常见问题

1. **版本号不一致**
   ```bash
   npm run version:check
   # 手动同步版本号
   ```

2. **Git submodule更新失败**
   ```bash
   git submodule update --init --recursive
   git submodule update --remote
   ```

3. **权限问题**
   ```bash
   chmod +x scripts/*.js
   ```

## 贡献

如需改进工具功能，请：

1. 修改相应的脚本文件
2. 更新文档
3. 测试功能
4. 提交更改

## 许可证

内部使用工具，仅供Xituan项目团队使用。

---

*最后更新: 2024年12月*
