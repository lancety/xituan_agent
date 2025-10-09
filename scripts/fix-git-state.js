#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Git状态修复脚本 - 将master分支重置到v0.28.0标签位置
class GitStateFixer {
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

  // 检查当前Git状态
  checkGitStatus(projectPath) {
    try {
      const status = execSync('git status --porcelain', { 
        cwd: projectPath, 
        encoding: 'utf8' 
      });
      return status.trim();
    } catch (error) {
      console.error(`检查 ${projectPath} Git状态失败:`, error.message);
      return null;
    }
  }

  // 获取当前分支
  getCurrentBranch(projectPath) {
    try {
      const branch = execSync('git branch --show-current', { 
        cwd: projectPath, 
        encoding: 'utf8' 
      }).trim();
      return branch || 'master';
    } catch (error) {
      console.log(`无法获取分支名称，使用默认分支: master`);
      return 'master';
    }
  }

  // 获取最新的版本标签
  getLatestVersionTag(projectPath) {
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

  // 修复单个项目的Git状态
  fixProjectGitState(project) {
    console.log(`\n=== 修复 ${project.name} 的Git状态 ===`);
    
    try {
      // 检查是否有未提交的变更
      const status = this.checkGitStatus(project.path);
      if (status) {
        console.log(`⚠️  ${project.name} 有未提交的变更:`);
        console.log(status);
        console.log('请先提交或暂存这些变更，然后重新运行脚本');
        return false;
      }

      const currentBranch = this.getCurrentBranch(project.path);
      console.log(`当前分支: ${currentBranch}`);

      // 获取最新版本标签
      const latestTag = this.getLatestVersionTag(project.path);
      if (!latestTag) {
        console.log(`❌ ${project.name} 没有找到版本标签`);
        return false;
      }

      console.log(`最新版本标签: ${latestTag}`);

      // 检查master分支是否已经指向标签
      try {
        const tagCommit = execSync(`git rev-parse ${latestTag}`, { 
          cwd: project.path, 
          encoding: 'utf8' 
        }).trim();
        
        const masterCommit = execSync(`git rev-parse HEAD`, { 
          cwd: project.path, 
          encoding: 'utf8' 
        }).trim();

        if (tagCommit === masterCommit) {
          console.log(`✅ ${project.name} master分支已经指向 ${latestTag}`);
          return true;
        }

        console.log(`🔄 将master分支重置到 ${latestTag}`);
        
        // 切换到master分支
        this.exec('git checkout master', project.path);
        
        // 重置到标签位置（硬重置，丢弃所有变更）
        this.exec(`git reset --hard ${latestTag}`, project.path);
        
        // 强制推送到远程
        this.exec('git push origin master --force', project.path);
        
        console.log(`✅ ${project.name} master分支已重置到 ${latestTag}`);
        return true;

      } catch (error) {
        console.error(`修复 ${project.name} 失败:`, error.message);
        return false;
      }

    } catch (error) {
      console.error(`修复 ${project.name} 时出现错误:`, error.message);
      return false;
    }
  }

  // 修复所有项目的Git状态
  fixAllProjectsGitState() {
    console.log('=== 开始修复所有项目的Git状态 ===\n');
    
    const results = [];
    
    this.projects.forEach(project => {
      const success = this.fixProjectGitState(project);
      results.push({ project: project.name, success });
    });

    console.log('\n=== 修复结果汇总 ===');
    results.forEach(result => {
      const status = result.success ? '✅ 成功' : '❌ 失败';
      console.log(`${result.project}: ${status}`);
    });

    const successCount = results.filter(r => r.success).length;
    console.log(`\n修复完成: ${successCount}/${results.length} 个项目成功`);
    
    return successCount === results.length;
  }
}

// 命令行参数处理
const args = process.argv.slice(2);
const command = args[0] || 'fix';

const fixer = new GitStateFixer();

switch (command) {
  case 'fix':
    fixer.fixAllProjectsGitState();
    break;
  case 'check':
    console.log('检查所有项目的Git状态...');
    fixer.projects.forEach(project => {
      const status = fixer.checkGitStatus(project.path);
      const branch = fixer.getCurrentBranch(project.path);
      const latestTag = fixer.getLatestVersionTag(project.path);
      console.log(`${project.name}: 分支=${branch}, 最新标签=${latestTag}, 状态=${status ? '有变更' : '干净'}`);
    });
    break;
  case 'help':
    console.log('用法:');
    console.log('  node scripts/fix-git-state.js fix    - 修复所有项目的Git状态');
    console.log('  node scripts/fix-git-state.js check  - 检查所有项目的Git状态');
    console.log('  node scripts/fix-git-state.js help   - 显示帮助');
    break;
  default:
    console.log('未知命令，使用 "help" 查看可用命令');
}
