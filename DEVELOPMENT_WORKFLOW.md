# 开发工作流程指南

## 场景：多项目同时开发

当你同时在多个项目中做改动时，需要按照以下顺序操作：

### 1. 开发阶段
```bash
# 在各个项目中开发
cd xituan_backend
# 修改代码...

cd ../xituan_wechat_app  
# 修改代码...

cd ../xituan_cms
# 修改代码...
```

### 2. 提交阶段（按顺序执行）

#### 2.1 先提交共享代码库
```bash
# 进入共享代码库
cd xituan_backend/submodules/xituan_codebase

# 检查改动
git status
git diff

# 提交共享代码库改动
git add .
git commit -m "feat: 添加新功能到共享代码库"
git push origin main

# 创建标签（可选，release脚本会自动创建）
git tag v0.21.3
git push origin main --tags
```

#### 2.2 更新各项目的submodule引用
```bash
# 更新Backend项目
cd ../../
git add submodules/xituan_codebase
git commit -m "chore: update xituan_codebase to v0.21.3"

# 更新CMS项目
cd ../xituan_cms
git submodule update --remote
git add submodules/xituan_codebase
git commit -m "chore: update xituan_codebase to v0.21.3"

# 更新WeChat项目
cd ../xituan_wechat_app
git submodule update --remote
git add submodules/xituan_codebase
git commit -m "chore: update xituan_codebase to v0.21.3"
```

#### 2.3 提交各项目的代码改动
```bash
# 提交Backend项目改动
cd ../xituan_backend
git add .
git commit -m "feat: 实现新功能"

# 提交WeChat项目改动
cd ../xituan_wechat_app
git add .
git commit -m "feat: 实现新功能"

# 提交CMS项目改动（如果有）
cd ../xituan_cms
git add .
git commit -m "feat: 实现新功能"
```

### 3. 版本发布阶段

#### 3.1 检查项目状态
```bash
cd xituan_agent
npm run version:check
```

#### 3.2 运行版本发布
```bash
# 根据改动类型选择版本类型
npm run release:patch    # bug修复
npm run release:minor    # 新功能
npm run release:major    # 破坏性变更
```

## 常见问题

### Q: 为什么不能直接运行release？
A: Release脚本会检查Git状态，如果有未提交的更改会报错。需要先提交所有更改。

### Q: 为什么要先提交共享代码库？
A: 确保所有项目都引用相同版本的共享代码库，避免版本不一致。

### Q: 什么时候用patch/minor/major？
A: 
- patch: bug修复
- minor: 新功能（向下兼容）
- major: 破坏性变更

### Q: 如果忘记更新submodule引用怎么办？
A: 可以手动更新：
```bash
git submodule update --remote
git add submodules/xituan_codebase
git commit -m "chore: update xituan_codebase"
```

## 最佳实践

1. **开发前先拉取最新代码**
2. **经常提交，避免大量改动堆积**
3. **提交信息要清晰明确**
4. **发布前先检查项目状态**
5. **保持submodule引用同步**

## 自动化脚本

你也可以创建自动化脚本来简化这个过程：

```bash
# 创建提交脚本
echo '#!/bin/bash
echo "提交共享代码库..."
cd xituan_backend/submodules/xituan_codebase
git add .
git commit -m "feat: $1"
git push origin main

echo "更新submodule引用..."
cd ../../
git add submodules/xituan_codebase
git commit -m "chore: update xituan_codebase"
git push origin main

cd ../xituan_cms
git submodule update --remote
git add submodules/xituan_codebase
git commit -m "chore: update xituan_codebase"
git push origin main

cd ../xituan_wechat_app
git submodule update --remote
git add submodules/xituan_codebase
git commit -m "chore: update xituan_codebase"
git push origin main

echo "提交各项目改动..."
cd ../xituan_backend
git add .
git commit -m "feat: $1"
git push origin main

cd ../xituan_wechat_app
git add .
git commit -m "feat: $1"
git push origin main

echo "准备发布版本..."
cd ../xituan_agent
npm run version:check
' > commit-and-release.sh

chmod +x commit-and-release.sh
```

使用方法：
```bash
./commit-and-release.sh "添加新功能"
```




