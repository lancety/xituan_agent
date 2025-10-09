# Release Script 修复总结

## 问题描述

在运行 xituan_agent release scripts 后，submodule codebase 出现了以下问题：

- new version v0.28.0 作为独立 tag branch 存在
- 新 master 跟 new version 是两个分支
- 新 master 把老 version tag branch v0.27.0 merge 一起
- 新 master 上的 package.json 还有重复的 version change

## 期望结果

- 新 master 在 v0.28.0 tag branch 上，两个是同一个 commit
- 包含 package 和 readme 的版本变更

## 修复方案

### 1. 修复 Release Script 逻辑

**文件**: `xituan_agent/scripts/unified-release.js`

**主要变更**:
- 确保在 master 分支上直接提交版本变更，而不是创建独立的 version branch
- 创建 tag 指向当前 commit（不是独立分支）
- 避免重复的版本变更提交

**关键修改**:
```javascript
// 确保在 master 分支上
this.exec('git checkout master', projectPath);
this.exec('git pull origin master', projectPath);

// 在 master 分支上直接提交版本变更
this.exec('git add .', projectPath);
this.exec(`git commit -m "chore: release v${newVersion}"`, projectPath);

// 创建 tag 指向当前 commit（不是独立分支）
this.exec(`git tag v${newVersion}`, projectPath);

// 推送 master 分支和 tags
this.exec(`git push origin master --tags`, projectPath);
```

### 2. 创建 Git 状态修复脚本

**文件**: `xituan_agent/scripts/fix-git-state.js`

**功能**:
- 检查所有项目的 Git 状态
- 将 master 分支重置到最新版本标签位置
- 确保 master 和 version tag 指向同一个 commit

**使用方法**:
```bash
# 检查所有项目的 Git 状态
npm run git:check

# 修复所有项目的 Git 状态
npm run git:fix
```

### 3. 更新 Package.json

**文件**: `xituan_agent/package.json`

**新增脚本**:
```json
{
  "scripts": {
    "git:fix": "node scripts/fix-git-state.js fix",
    "git:check": "node scripts/fix-git-state.js check"
  }
}
```

## 修复结果

### 修复前
```
*   aa6a301 (HEAD, origin/master, origin/HEAD, master) Merge commit '73d8e9612b80c0b6518475014704ac1786877d0d'
|\
| * 73d8e96 (tag: v0.28.0) chore: release v0.28.0
* |   9ac1f24 Merge tag 'v0.27.0'
```

### 修复后
```
* 73d8e96 (HEAD -> master, tag: v0.28.0, origin/master, origin/HEAD) chore: release v0.28.0
* 208e8dd (3333333) fix: removed depreciate settings prop - storeAddress
* fc21749 feat: user payment lock; delivery max distance setting;
```

## 验证结果

所有项目的状态检查结果：
- ✅ xituan_codebase: 分支=master, 最新标签=v0.28.0, 状态=干净
- ✅ xituan_backend: 分支=master, 最新标签=v0.28.0, 状态=干净
- ✅ xituan_cms: 分支=master, 最新标签=v0.28.0, 状态=干净
- ✅ xituan_wechat_app: 分支=master, 最新标签=v0.28.0, 状态=干净

## 使用说明

### 正常发布流程
```bash
# 发布 patch 版本
npm run release:patch

# 发布 minor 版本
npm run release:minor

# 发布 major 版本
npm run release:major
```

### 修复 Git 状态
```bash
# 检查状态
npm run git:check

# 修复状态
npm run git:fix
```

## 注意事项

1. 修复脚本会强制重置 master 分支，请确保没有未提交的重要变更
2. 修复过程中会自动提交 submodule 引用变更
3. 所有变更都会推送到远程仓库

## 技术细节

- 使用 `git reset --hard <tag>` 将 master 分支重置到标签位置
- 使用 `git push origin master --force` 强制推送修复后的状态
- 确保 submodule 引用指向正确的 commit
- 避免创建不必要的 merge commit
