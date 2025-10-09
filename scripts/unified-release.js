#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 智能统一发布脚本 - 结合Git历史和手动输入
class SmartUnifiedReleaseManager {
  constructor() {
    // 获取脚本运行目录，然后回到项目根目录
    const scriptDir = __dirname;
    const projectRoot = path.join(scriptDir, '..', '..');
    
    this.projects = [
      { name: 'xituan_codebase', path: path.join(projectRoot, 'xituan_backend/submodules/xituan_codebase') },
      { name: 'xituan_backend', path: path.join(projectRoot, 'xituan_backend') },
      { name: 'xituan_cms', path: path.join(projectRoot, 'xituan_cms') },
      { name: 'xituan_wechat_app', path: path.join(projectRoot, 'xituan_wechat_app') }
    ];
  }

  // 执行命令
  exec(command, cwd = process.cwd()) {
    console.log(`执行命令: ${command} (在 ${cwd})`);
    try {
      return execSync(command, { cwd, stdio: 'inherit' });
    } catch (error) {
      console.error(`命令执行失败: ${command}`);
      throw error;
    }
  }

  // 获取当前分支名称
  getCurrentBranch(projectPath) {
    try {
      const branch = execSync('git branch --show-current', { 
        cwd: projectPath, 
        encoding: 'utf8' 
      }).trim();
      return branch || 'master'; // 如果获取失败，默认使用master
    } catch (error) {
      console.log(`无法获取分支名称，使用默认分支: master`);
      return 'master';
    }
  }

  // 检查项目是否有变更（检测新的commit，排除版本号变更）
  hasChanges(projectPath) {
    try {
      // 获取最后一个版本标签
      const lastTag = this.getLastVersionTag(projectPath);
      
      if (!lastTag) {
        // 如果没有版本标签，检查是否有任何commit
        const commits = this.getGitHistory(projectPath);
        return commits.length > 0;
      }
      
      // 检查自上次版本标签以来是否有新的commit
      const commits = this.getGitHistory(projectPath, lastTag);
      
      if (commits.length === 0) {
        return false;
      }
      
      // 过滤掉版本发布相关的commit
      const filteredCommits = commits.filter(commit => {
        const message = commit.toLowerCase();
        return !message.includes('chore: release') && 
               !message.includes('version') &&
               !message.includes('tag');
      });
      
      return filteredCommits.length > 0;
      
    } catch (error) {
      console.error(`检查 ${projectPath} 变更失败:`, error.message);
      return false;
    }
  }

  // 获取当前版本号
  getCurrentVersion(projectPath) {
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      return packageJson.version;
    }
    return null;
  }

  // 获取上一个版本标签
  getLastVersionTag(projectPath, currentVersion = null) {
    try {
      const tags = execSync('git tag --sort=-version:refname', { 
        cwd: projectPath, 
        encoding: 'utf8' 
      });
      
      const versionTags = tags.split('\n')
        .filter(tag => tag.match(/^v?\d+\.\d+\.\d+$/))
        .map(tag => {
          // 提取版本号部分进行排序
          const version = tag.replace(/^v/, '');
          const parts = version.split('.').map(Number);
          return { tag, version, parts };
        })
        .sort((a, b) => {
          // 自定义版本号比较逻辑
          for (let i = 0; i < Math.max(a.parts.length, b.parts.length); i++) {
            const numA = a.parts[i] || 0;
            const numB = b.parts[i] || 0;
            if (numA !== numB) {
              return numB - numA; // 降序排列
            }
          }
          return 0;
        });
      
      // 如果提供了当前版本，找到比当前版本小的第一个标签
      if (currentVersion) {
        const currentVersionParts = currentVersion.split('.').map(Number);
        for (const tagInfo of versionTags) {
          const isSmaller = this.compareVersions(currentVersion, tagInfo.version) > 0;
          if (isSmaller) {
            return tagInfo.tag;
          }
        }
      }
      
      // 否则返回第二个标签（跳过最新版本）
      return versionTags[1]?.tag || null;
    } catch (error) {
      return null;
    }
  }

  // 获取Git提交历史
  getGitHistory(projectPath, since = null) {
    try {
      let command = 'git log --oneline --pretty=format:"%h %s"';
      if (since) {
        command += ` ${since}..HEAD`;
      }
      
      const history = execSync(command, { 
        cwd: projectPath, 
        encoding: 'utf8' 
      });
      
      return history.split('\n').filter(line => line.trim());
    } catch (error) {
      console.error(`获取 ${projectPath} Git历史失败:`, error.message);
      return [];
    }
  }

  // 分类提交信息
  categorizeCommits(commits) {
    const categories = {
      feat: [],
      fix: [],
      docs: [],
      style: [],
      refactor: [],
      test: [],
      chore: [],
      other: []
    };

    commits.forEach(commit => {
      const message = commit.toLowerCase();
      
      // 过滤掉版本发布记录，避免重复显示
      if (message.includes('chore: release v') || message.includes('chore: set version to')) {
        return; // 跳过版本发布记录
      }
      
      if (message.includes('feat') || message.includes('feature') || message.includes('新增')) {
        categories.feat.push(commit);
      } else if (message.includes('fix') || message.includes('修复') || message.includes('bug')) {
        categories.fix.push(commit);
      } else if (message.includes('docs') || message.includes('文档')) {
        categories.docs.push(commit);
      } else if (message.includes('style') || message.includes('样式')) {
        categories.style.push(commit);
      } else if (message.includes('refactor') || message.includes('重构')) {
        categories.refactor.push(commit);
      } else if (message.includes('test') || message.includes('测试')) {
        categories.test.push(commit);
      } else if (message.includes('chore') || message.includes('构建') || message.includes('配置')) {
        categories.chore.push(commit);
      } else {
        categories.other.push(commit);
      }
    });

    return categories;
  }

  // 比较版本号大小
  compareVersions(version1, version2) {
    const v1 = version1.split('.').map(Number);
    const v2 = version2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
      const num1 = v1[i] || 0;
      const num2 = v2[i] || 0;
      
      if (num1 > num2) return 1;
      if (num1 < num2) return -1;
    }
    
    return 0;
  }

  // 找出所有项目中的最高版本号
  findHighestVersion(projectStatus) {
    let highestVersion = '0.0.0';
    
    projectStatus.forEach(project => {
      if (project.currentVersion && this.compareVersions(project.currentVersion, highestVersion) > 0) {
        highestVersion = project.currentVersion;
      }
    });
    
    return highestVersion;
  }

  // 计算新版本号（基于最高版本号）
  calculateNewVersion(highestVersion, versionType) {
    const [major, minor, patch] = highestVersion.split('.').map(Number);
    
    switch (versionType) {
      case 'major':
        return `${major + 1}.0.0`;
      case 'minor':
        return `${major}.${minor + 1}.0`;
      case 'patch':
        return `${major}.${minor}.${patch + 1}`;
      default:
        return highestVersion;
    }
  }

  // 更新版本号到指定版本
  updateVersionTo(projectPath, targetVersion) {
    console.log(`更新 ${projectPath} 版本号到 ${targetVersion}...`);
    
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const oldVersion = packageJson.version;
      packageJson.version = targetVersion;
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
      console.log(`版本已更新: ${oldVersion} → ${targetVersion}`);
      
      // 在项目文件夹范围内替换所有旧版本号
      this.replaceVersionInProject(projectPath, oldVersion, targetVersion);
      
      return oldVersion; // 返回旧版本号，用于后续的版本替换
    }
    return null;
  }

  // 在项目文件夹范围内替换所有旧版本号
  replaceVersionInProject(projectPath, oldVersion, newVersion) {
    console.log(`在项目 ${projectPath} 中替换版本号: ${oldVersion} → ${newVersion}`);
    
    try {
      // 递归搜索项目文件夹中的所有文件
      const files = this.getAllFiles(projectPath);
      let replacedCount = 0;
      
      files.forEach(filePath => {
        // 跳过 node_modules、.git 等目录
        if (this.shouldSkipFile(filePath)) {
          return;
        }
        
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const oldContent = content;
          
          // 替换各种版本号格式
          let newContent = content;
          
          // 替换 v0.23.0 格式
          newContent = newContent.replace(new RegExp(`v${oldVersion.replace(/\./g, '\\.')}`, 'g'), `v${newVersion}`);
          
          // 替换 版本 v0.23.0 格式
          newContent = newContent.replace(new RegExp(`版本 v${oldVersion.replace(/\./g, '\\.')}`, 'g'), `版本 v${newVersion}`);
          
          // 替换纯版本号 0.23.0 格式（在特定上下文中）
          newContent = newContent.replace(new RegExp(`"version":\\s*"${oldVersion.replace(/\./g, '\\.')}"`, 'g'), `"version": "${newVersion}"`);
          
          // 如果内容有变化，写回文件
          if (newContent !== oldContent) {
            fs.writeFileSync(filePath, newContent, 'utf8');
            console.log(`  ✅ 已更新: ${path.relative(projectPath, filePath)}`);
            replacedCount++;
          }
        } catch (error) {
          // 忽略无法读取的文件（如二进制文件）
          console.log(`  ⚠️  跳过文件: ${path.relative(projectPath, filePath)} (${error.message})`);
        }
      });
      
      console.log(`版本号替换完成，共更新 ${replacedCount} 个文件`);
      
    } catch (error) {
      console.error(`版本号替换失败:`, error.message);
    }
  }

  // 递归获取文件夹中的所有文件
  getAllFiles(dirPath) {
    const files = [];
    
    try {
      const items = fs.readdirSync(dirPath);
      
      items.forEach(item => {
        const fullPath = path.join(dirPath, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          // 递归处理子目录
          files.push(...this.getAllFiles(fullPath));
        } else if (stat.isFile()) {
          files.push(fullPath);
        }
      });
    } catch (error) {
      console.log(`无法读取目录: ${dirPath}`);
    }
    
    return files;
  }

  // 判断是否应该跳过某个文件
  shouldSkipFile(filePath) {
    const skipPatterns = [
      'node_modules',
      '.git',
      'dist',
      'build',
      '.next',
      'coverage',
      '.nyc_output',
      'package-lock.json',
      'yarn.lock',
      '.DS_Store',
      'Thumbs.db'
    ];
    
    return skipPatterns.some(pattern => filePath.includes(pattern));
  }

  // 生成智能CHANGELOG
  generateSmartChangelog(projectPath, version, hasActualChanges, currentVersion) {
    const changelogPath = path.join(projectPath, 'CHANGELOG.md');
    const today = new Date().toISOString().split('T')[0];
    
    let changelogEntry;
    
    if (hasActualChanges) {
      // 获取Git历史并分类
      const lastTag = this.getLastVersionTag(projectPath, currentVersion);
      const commits = this.getGitHistory(projectPath, lastTag);
      const categorizedCommits = this.categorizeCommits(commits);
      
      changelogEntry = `## [${version}] - ${today}\n\n`;
      
      // 添加各个分类的更改
      const categoryNames = {
        feat: '✨ 新功能',
        fix: '🐛 修复',
        docs: '📚 文档',
        style: '💄 样式',
        refactor: '♻️ 重构',
        test: '🧪 测试',
        chore: '🔧 构建/配置',
        other: '📝 其他'
      };

      Object.keys(categoryNames).forEach(category => {
        if (categorizedCommits[category].length > 0) {
          changelogEntry += `### ${categoryNames[category]}\n\n`;
          categorizedCommits[category].forEach(commit => {
            const message = commit.replace(/^[a-f0-9]+ /, '');
            changelogEntry += `- ${message}\n`;
          });
          changelogEntry += '\n';
        }
      });
      
    } else {
      // 检查是否跳过了版本号
      const versionSkipped = this.compareVersions(version, currentVersion) > 1;
      
      if (versionSkipped) {
        changelogEntry = `## [${version}] - ${today}

### 🔄 版本同步
- 同步版本号以保持项目间版本一致
- 跳过版本 ${currentVersion} → ${version}

`;
      } else {
        changelogEntry = `## [${version}] - ${today}

### 🔄 版本同步
- 同步版本号以保持项目间版本一致

`;
      }
    }
    
    if (fs.existsSync(changelogPath)) {
      const content = fs.readFileSync(changelogPath, 'utf8');
      fs.writeFileSync(changelogPath, changelogEntry + content);
    } else {
      fs.writeFileSync(changelogPath, changelogEntry);
    }
    
    console.log(`智能CHANGELOG已更新: ${changelogPath}`);
  }

  // 更新微信小程序版本显示（已集成到 updateVersionTo 方法中）
  updateWechatVersion(projectPath, version) {
    // 注意：版本号替换逻辑已经集成到 updateVersionTo 方法中
    // 该方法会自动在项目文件夹范围内搜索并替换所有旧版本号
    // 包括 profile.wxml、settings.wxml 等文件中的版本显示
    
    // 微信小程序的 app.json 不支持 version、versionName、versionCode 属性
    // 这些属性是 Android 应用特有的，微信小程序通过微信平台管理版本
    console.log(`微信小程序版本号已通过通用替换逻辑更新，无需在 app.json 中设置版本属性`);
  }

  // 检查项目变更状态
  checkProjectChanges() {
    console.log('=== 检查项目变更状态 ===\n');
    
    const projectStatus = [];
    
    this.projects.forEach(project => {
      const hasChanges = this.hasChanges(project.path);
      const currentVersion = this.getCurrentVersion(project.path);
      
      console.log(`${project.name}:`);
      console.log(`  当前版本: ${currentVersion}`);
      console.log(`  有变更: ${hasChanges ? '是' : '否'}`);
      
      projectStatus.push({
        ...project,
        hasChanges,
        currentVersion
      });
      
      console.log('');
    });
    
    return projectStatus;
  }

  // 更新所有项目的submodule引用到最新版本
  updateAllSubmodules() {
    console.log('\n=== 更新所有项目的submodule引用 ===');
    
    this.projects.forEach(project => {
      if (project.name !== 'xituan_codebase') {
        console.log(`更新 ${project.name} 的submodule引用...`);
        try {
          // 先进入submodule目录，拉取最新代码
          const submodulePath = path.join(project.path, 'submodules/xituan_codebase');
          this.exec('git fetch --tags', submodulePath);
          this.exec('git checkout master', submodulePath);
          this.exec('git pull origin master', submodulePath);
          
          // 获取最新的版本标签
          const latestTag = this.getLastVersionTag(submodulePath);
          if (latestTag) {
            console.log(`确保master分支包含最新版本标签: ${latestTag}`);
            // 检查master是否已经包含这个标签的commit
            try {
              this.exec(`git merge-base --is-ancestor ${latestTag} HEAD`, submodulePath);
              console.log(`master分支已包含 ${latestTag} 的变更`);
            } catch (error) {
              // 如果master不包含标签，则合并标签到master
              console.log(`将 ${latestTag} 合并到master分支`);
              this.exec(`git merge ${latestTag} --no-edit`, submodulePath);
            }
          }
          
          // 回到主项目，添加submodule变更
          this.exec('git add submodules/xituan_codebase', project.path);
          console.log(`${project.name} submodule引用已更新到 ${latestTag || '最新版本'}`);
        } catch (error) {
          console.error(`更新 ${project.name} submodule失败:`, error.message);
        }
      }
    });
  }

  // 智能统一发布流程
  async smartUnifiedRelease(versionType = 'patch') {
    console.log(`开始智能统一版本发布流程 - 版本类型: ${versionType}\n`);
    
    try {
      // 1. 检查项目变更状态
      const projectStatus = this.checkProjectChanges();
      
      // 2. 分离codebase和其他项目
      const codebaseProject = projectStatus.find(p => p.name === 'xituan_codebase');
      const otherProjects = projectStatus.filter(p => p.name !== 'xituan_codebase');
      
      // 3. 计算统一版本号（基于所有项目的最高版本）
      const allProjects = projectStatus.filter(p => p.name !== 'xituan_codebase');
      const highestVersion = this.findHighestVersion(allProjects);
      console.log(`所有项目当前最高版本: ${highestVersion}`);
      
      const newVersion = this.calculateNewVersion(highestVersion, versionType);
      console.log(`统一目标版本: ${newVersion}\n`);
      
      // 4. 先发布codebase（如果有变更）
      if (codebaseProject && codebaseProject.hasChanges) {
        console.log('\n=== 发布共享代码库 ===');
        
        const oldCodebaseVersion = this.updateVersionTo(codebaseProject.path, newVersion);
        this.generateSmartChangelog(codebaseProject.path, newVersion, true, oldCodebaseVersion);
        
        const currentBranch = this.getCurrentBranch(codebaseProject.path);
        
        // 确保在 master 分支上
        this.exec('git checkout master', codebaseProject.path);
        this.exec('git pull origin master', codebaseProject.path);
        
        // 在 master 分支上直接提交版本变更
        this.exec('git add .', codebaseProject.path);
        this.exec(`git commit -m "chore: release v${newVersion}"`, codebaseProject.path);
        
        // 创建 tag 指向当前 commit（不是独立分支）
        this.exec(`git tag v${newVersion}`, codebaseProject.path);
        
        // 推送 master 分支和 tags
        this.exec(`git push origin master --tags`, codebaseProject.path);
        
        console.log(`共享代码库 v${newVersion} 发布完成`);
        
        // 5. 发布codebase后，立即更新所有项目的submodule引用
        this.updateAllSubmodules();
        
        // 6. 重新检查项目变更状态（因为submodule可能带来新的变更）
        console.log('\n=== 重新检查项目变更状态（submodule更新后） ===');
        const updatedProjectStatus = this.checkProjectChanges();
        const updatedOtherProjects = updatedProjectStatus.filter(p => p.name !== 'xituan_codebase');
        
        // 7. 更新所有项目（无论是否有变更都发布版本）
        console.log('\n=== 更新所有项目版本 ===');
        for (const project of updatedOtherProjects) {
          const hasChanges = project.hasChanges;
          const changeType = hasChanges ? '有变更' : '版本同步';
          
          console.log(`\n=== 更新 ${project.name} (${changeType}) ===`);
          
          // 更新版本号
          const oldVersion = this.updateVersionTo(project.path, newVersion);
          
          // 生成智能CHANGELOG
          this.generateSmartChangelog(project.path, newVersion, hasChanges, oldVersion);
          
          // 特殊处理微信小程序
          if (project.name === 'xituan_wechat_app') {
            this.updateWechatVersion(project.path, newVersion);
          }
          
          // 获取当前分支名称
          const currentBranch = this.getCurrentBranch(project.path);
          console.log(`当前分支: ${currentBranch}`);
          
          // 确保在 master 分支上
          this.exec('git checkout master', project.path);
          this.exec('git pull origin master', project.path);
          
          // 在 master 分支上直接提交版本变更
          this.exec('git add .', project.path);
          this.exec(`git commit -m "chore: release v${newVersion}"`, project.path);
          
          // 创建 tag 指向当前 commit（不是独立分支）
          this.exec(`git tag v${newVersion}`, project.path);
          
          // 推送 master 分支和 tags
          this.exec(`git push origin master --tags`, project.path);
          
          console.log(`${project.name} v${newVersion} 发布完成${hasChanges ? '' : ' (版本同步)'}`);
        }
        
      } else if (codebaseProject) {
        console.log('\n=== 共享代码库无变更，但仍需发布版本以保持同步 ===');
        
        // 5. 即使codebase无变更，也要更新submodule引用
        this.updateAllSubmodules();
        
        // 6. 重新检查项目变更状态
        console.log('\n=== 重新检查项目变更状态（submodule更新后） ===');
        const updatedProjectStatus = this.checkProjectChanges();
        const updatedOtherProjects = updatedProjectStatus.filter(p => p.name !== 'xituan_codebase');
        
        // 7. 更新所有项目（无论是否有变更都发布版本）
        console.log('\n=== 更新所有项目版本 ===');
        for (const project of updatedOtherProjects) {
          const hasChanges = project.hasChanges;
          const changeType = hasChanges ? '有变更' : '版本同步';
          
          console.log(`\n=== 更新 ${project.name} (${changeType}) ===`);
          
          // 更新版本号
          const oldVersion = this.updateVersionTo(project.path, newVersion);
          
          // 生成智能CHANGELOG
          this.generateSmartChangelog(project.path, newVersion, hasChanges, oldVersion);
          
          // 特殊处理微信小程序
          if (project.name === 'xituan_wechat_app') {
            this.updateWechatVersion(project.path, newVersion);
          }
          
          // 获取当前分支名称
          const currentBranch = this.getCurrentBranch(project.path);
          console.log(`当前分支: ${currentBranch}`);
          
          // 确保在 master 分支上
          this.exec('git checkout master', project.path);
          this.exec('git pull origin master', project.path);
          
          // 在 master 分支上直接提交版本变更
          this.exec('git add .', project.path);
          this.exec(`git commit -m "chore: release v${newVersion}"`, project.path);
          
          // 创建 tag 指向当前 commit（不是独立分支）
          this.exec(`git tag v${newVersion}`, project.path);
          
          // 推送 master 分支和 tags
          this.exec(`git push origin master --tags`, project.path);
          
          console.log(`${project.name} v${newVersion} 发布完成${hasChanges ? '' : ' (版本同步)'}`);
        }
      }
      
      console.log('\n=== 智能统一版本发布完成 ===');
      if (codebaseProject && codebaseProject.hasChanges) {
        console.log(`共享代码库版本: ${this.getCurrentVersion(codebaseProject.path)}`);
      }
      
    } catch (error) {
      console.error('发布过程中出现错误:', error.message);
      process.exit(1);
    }
  }
}

// 命令行参数处理
const args = process.argv.slice(2);
const versionType = args[0] || 'patch';

// 执行智能统一发布
const releaseManager = new SmartUnifiedReleaseManager();
releaseManager.smartUnifiedRelease(versionType);
