#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 版本检查脚本
class VersionChecker {
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

  // 获取项目版本信息
  getProjectVersion(projectPath) {
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      return {
        version: packageJson.version,
        name: packageJson.name,
        description: packageJson.description
      };
    }
    return null;
  }

  // 获取微信小程序版本信息
  getWechatVersion(projectPath) {
    const appJsonPath = path.join(projectPath, 'app.json');
    const profileWxmlPath = path.join(projectPath, 'pages/profile/profile.wxml');
    
    let appVersion = null;
    let displayVersion = null;
    
    if (fs.existsSync(appJsonPath)) {
      const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
      appVersion = appJson.version;
    }
    
    if (fs.existsSync(profileWxmlPath)) {
      const content = fs.readFileSync(profileWxmlPath, 'utf8');
      const match = content.match(/v(\d+\.\d+\.\d+)/);
      if (match) {
        displayVersion = match[1];
      }
    }
    
    return { appVersion, displayVersion };
  }

  // 检查版本一致性
  checkVersionConsistency() {
    console.log('=== 版本一致性检查 ===\n');
    
    const versions = {};
    let allConsistent = true;
    
    this.projects.forEach(project => {
      const versionInfo = this.getProjectVersion(project.path);
      if (versionInfo) {
        versions[project.name] = versionInfo.version;
        console.log(`${project.name}: ${versionInfo.version}`);
        
        // 特殊处理微信小程序
        if (project.name === 'xituan_wechat_app') {
          const wechatVersion = this.getWechatVersion(project.path);
          console.log(`  - app.json版本: ${wechatVersion.appVersion || '未设置'}`);
          console.log(`  - 显示版本: ${wechatVersion.displayVersion || '未找到'}`);
          
          if (wechatVersion.appVersion && wechatVersion.appVersion !== versionInfo.version) {
            console.log(`  ⚠️  app.json版本与package.json不一致`);
            allConsistent = false;
          }
          if (wechatVersion.displayVersion && wechatVersion.displayVersion !== versionInfo.version) {
            console.log(`  ⚠️  显示版本与package.json不一致`);
            allConsistent = false;
          }
        }
      } else {
        console.log(`${project.name}: 未找到package.json`);
        allConsistent = false;
      }
    });
    
    // 检查主版本号一致性
    const majorVersions = Object.values(versions).filter(v => v).map(v => v.split('.')[0]);
    const uniqueMajorVersions = [...new Set(majorVersions)];
    
    if (uniqueMajorVersions.length > 1) {
      console.log(`\n⚠️  主版本号不一致: ${uniqueMajorVersions.join(', ')}`);
      allConsistent = false;
    }
    
    console.log(`\n版本一致性: ${allConsistent ? '✅ 通过' : '❌ 存在问题'}`);
    return allConsistent;
  }

  // 检查Git状态
  checkGitStatus() {
    console.log('\n=== Git状态检查 ===\n');
    
    const { execSync } = require('child_process');
    
    this.projects.forEach(project => {
      try {
        const status = execSync('git status --porcelain', { 
          cwd: project.path, 
          encoding: 'utf8' 
        });
        
        if (status.trim()) {
          console.log(`${project.name}: 有未提交的更改`);
          console.log(status);
        } else {
          console.log(`${project.name}: ✅ 工作区干净`);
        }
      } catch (error) {
        console.log(`${project.name}: ❌ Git状态检查失败`);
      }
    });
  }

  // 检查依赖版本
  checkDependencies() {
    console.log('\n=== 依赖版本检查 ===\n');
    
    this.projects.forEach(project => {
      const packageJsonPath = path.join(project.path, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        
        console.log(`${project.name} 依赖:`);
        
        // 检查共享代码库引用
        if (packageJson.dependencies && packageJson.dependencies['xituan_codebase']) {
          console.log(`  - xituan_codebase: ${packageJson.dependencies['xituan_codebase']}`);
        }
        
        // 检查关键依赖版本
        const keyDeps = ['react', 'next', 'typescript', 'express'];
        keyDeps.forEach(dep => {
          if (packageJson.dependencies && packageJson.dependencies[dep]) {
            console.log(`  - ${dep}: ${packageJson.dependencies[dep]}`);
          }
          if (packageJson.devDependencies && packageJson.devDependencies[dep]) {
            console.log(`  - ${dep}: ${packageJson.devDependencies[dep]} (dev)`);
          }
        });
        
        console.log('');
      }
    });
  }

  // 生成版本报告
  generateReport() {
    console.log('=== Xituan项目版本报告 ===\n');
    console.log(`生成时间: ${new Date().toLocaleString()}\n`);
    
    this.checkVersionConsistency();
    this.checkGitStatus();
    this.checkDependencies();
    
    console.log('\n=== 建议 ===');
    console.log('1. 确保所有项目版本号一致');
    console.log('2. 发布前确保工作区干净');
    console.log('3. 更新CHANGELOG.md记录变更');
    console.log('4. 使用统一的版本发布流程');
  }
}

// 执行版本检查
const checker = new VersionChecker();
checker.generateReport();
