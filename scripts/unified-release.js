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
  getLastVersionTag(projectPath) {
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
      
      return versionTags[0]?.tag || null;
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
      packageJson.version = targetVersion;
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
      console.log(`版本已更新为: ${targetVersion}`);
    }
  }

  // 生成智能CHANGELOG
  generateSmartChangelog(projectPath, version, hasActualChanges, currentVersion) {
    const changelogPath = path.join(projectPath, 'CHANGELOG.md');
    const today = new Date().toISOString().split('T')[0];
    
    let changelogEntry;
    
    if (hasActualChanges) {
      // 获取Git历史并分类
      const lastTag = this.getLastVersionTag(projectPath);
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

  // 更新微信小程序版本显示
  updateWechatVersion(projectPath, version) {
    const profileWxmlPath = path.join(projectPath, 'pages/profile/profile.wxml');
    
    if (fs.existsSync(profileWxmlPath)) {
      let content = fs.readFileSync(profileWxmlPath, 'utf8');
      content = content.replace(/v\d+\.\d+\.\d+/, `v${version}`);
      fs.writeFileSync(profileWxmlPath, content);
      console.log(`微信小程序版本显示已更新为: v${version}`);
    }

    // 更新app.json版本信息
    const appJsonPath = path.join(projectPath, 'app.json');
    if (fs.existsSync(appJsonPath)) {
      const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
      appJson.version = version;
      appJson.versionName = version;
      appJson.versionCode = parseInt(version.replace(/\./g, ''));
      fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2));
      console.log(`app.json版本信息已更新`);
    }
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

  // 智能统一发布流程
  async smartUnifiedRelease(versionType = 'patch') {
    console.log(`开始智能统一版本发布流程 - 版本类型: ${versionType}\n`);
    
    try {
      // 1. 检查项目变更状态
      const projectStatus = this.checkProjectChanges();
      
      // 2. 分离codebase和其他项目
      const codebaseProject = projectStatus.find(p => p.name === 'xituan_codebase');
      const otherProjects = projectStatus.filter(p => p.name !== 'xituan_codebase');
      
      // 3. 先发布codebase（如果有变更）
      if (codebaseProject && codebaseProject.hasChanges) {
        console.log('\n=== 发布共享代码库 ===');
        const codebaseVersion = this.calculateNewVersion(codebaseProject.currentVersion, versionType);
        
        this.updateVersionTo(codebaseProject.path, codebaseVersion);
        this.generateSmartChangelog(codebaseProject.path, codebaseVersion, true, codebaseProject.currentVersion);
        
        const currentBranch = this.getCurrentBranch(codebaseProject.path);
        this.exec('git add .', codebaseProject.path);
        this.exec(`git commit -m "chore: release v${codebaseVersion}"`, codebaseProject.path);
        this.exec(`git tag v${codebaseVersion}`, codebaseProject.path);
        this.exec(`git push origin ${currentBranch} --tags`, codebaseProject.path);
        
        console.log(`共享代码库 v${codebaseVersion} 发布完成`);
      } else if (codebaseProject) {
        console.log('\n=== 共享代码库无变更，跳过发布 ===');
      }
      
      // 4. 检查其他项目是否有变更
      const projectsWithChanges = otherProjects.filter(p => p.hasChanges);
      const projectsWithoutChanges = otherProjects.filter(p => !p.hasChanges);
      
      if (projectsWithChanges.length === 0) {
        console.log('\n=== 所有项目均无变更，跳过发布 ===');
        return;
      }
      
      // 5. 计算统一版本号（基于所有项目的最高版本）
      const highestVersion = this.findHighestVersion(otherProjects);
      console.log(`其他项目当前最高版本: ${highestVersion}`);
      
      const newVersion = this.calculateNewVersion(highestVersion, versionType);
      console.log(`其他项目目标版本: ${newVersion}\n`);
      
      // 6. 只更新有变更的项目
      for (const project of projectsWithChanges) {
        console.log(`\n=== 更新 ${project.name} (有变更) ===`);
        
        // 更新submodule引用
        this.exec('git submodule update --remote', project.path);
        this.exec('git add submodules/xituan_codebase', project.path);
        
        // 更新版本号
        this.updateVersionTo(project.path, newVersion);
        
        // 生成智能CHANGELOG（有实际变更）
        this.generateSmartChangelog(project.path, newVersion, true, project.currentVersion);
        
        // 特殊处理微信小程序
        if (project.name === 'xituan_wechat_app') {
          this.updateWechatVersion(project.path, newVersion);
        }
        
        // 获取当前分支名称
        const currentBranch = this.getCurrentBranch(project.path);
        console.log(`当前分支: ${currentBranch}`);
        
        // 提交更改
        this.exec('git add .', project.path);
        this.exec(`git commit -m "chore: release v${newVersion}"`, project.path);
        this.exec(`git tag v${newVersion}`, project.path);
        this.exec(`git push origin ${currentBranch} --tags`, project.path);
        
        console.log(`${project.name} v${newVersion} 发布完成`);
      }
      
      // 7. 对于无变更的项目，只更新submodule引用但不发布新版本
      for (const project of projectsWithoutChanges) {
        console.log(`\n=== ${project.name} 无变更，跳过版本发布 ===`);
        console.log(`当前版本: ${project.currentVersion} (保持不变)`);
      }
      
      console.log('\n=== 智能统一版本发布完成 ===');
      if (codebaseProject && codebaseProject.hasChanges) {
        console.log(`共享代码库版本: ${this.getCurrentVersion(codebaseProject.path)}`);
      }
      if (projectsWithChanges.length > 0) {
        console.log(`有变更的项目版本: ${newVersion}`);
        console.log(`有变更的项目: ${projectsWithChanges.map(p => p.name).join(', ')}`);
      }
      if (projectsWithoutChanges.length > 0) {
        console.log(`无变更的项目: ${projectsWithoutChanges.map(p => p.name).join(', ')} (跳过版本)`);
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
