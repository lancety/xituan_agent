#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// CHANGELOG生成器
class ChangelogGenerator {
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

  // 获取Git提交历史
  getGitHistory(projectPath, since = null) {
    try {
      let command = 'git log --oneline --pretty=format:"%h %s"';
      if (since) {
        command += ` --since="${since}"`;
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

  // 获取上一个版本标签
  getLastVersionTag(projectPath) {
    try {
      const tags = execSync('git tag --sort=-version:refname', { 
        cwd: projectPath, 
        encoding: 'utf8' 
      });
      
      const versionTags = tags.split('\n')
        .filter(tag => tag.match(/^v?\d+\.\d+\.\d+$/))
        .slice(0, 1);
      
      return versionTags[0] || null;
    } catch (error) {
      return null;
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

  // 生成项目CHANGELOG
  generateProjectChangelog(project, version, since = null) {
    const commits = this.getGitHistory(project.path, since);
    const categorizedCommits = this.categorizeCommits(commits);
    const today = new Date().toISOString().split('T')[0];

    let changelog = `## [${version}] - ${today}\n\n`;

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
        changelog += `### ${categoryNames[category]}\n\n`;
        categorizedCommits[category].forEach(commit => {
          const message = commit.replace(/^[a-f0-9]+ /, '');
          changelog += `- ${message}\n`;
        });
        changelog += '\n';
      }
    });

    return changelog;
  }

  // 更新项目CHANGELOG文件
  updateProjectChangelog(project, version, since = null) {
    const changelogPath = path.join(project.path, 'CHANGELOG.md');
    const newChangelog = this.generateProjectChangelog(project, version, since);
    
    if (fs.existsSync(changelogPath)) {
      const existingContent = fs.readFileSync(changelogPath, 'utf8');
      const updatedContent = newChangelog + existingContent;
      fs.writeFileSync(changelogPath, updatedContent);
    } else {
      fs.writeFileSync(changelogPath, newChangelog);
    }
    
    console.log(`✅ ${project.name} CHANGELOG已更新: ${changelogPath}`);
  }

  // 生成总体CHANGELOG
  generateMasterChangelog(version) {
    const today = new Date().toISOString().split('T')[0];
    let masterChangelog = `# Changelog\n\n`;
    masterChangelog += `所有项目的变更记录。\n\n`;
    masterChangelog += `## [${version}] - ${today}\n\n`;

    this.projects.forEach(project => {
      const lastTag = this.getLastVersionTag(project.path);
      const commits = this.getGitHistory(project.path, lastTag);
      
      if (commits.length > 0) {
        masterChangelog += `### ${project.name}\n\n`;
        commits.forEach(commit => {
          const message = commit.replace(/^[a-f0-9]+ /, '');
          masterChangelog += `- ${message}\n`;
        });
        masterChangelog += '\n';
      }
    });

    return masterChangelog;
  }

  // 更新所有项目CHANGELOG
  updateAllChangelogs(version) {
    console.log('=== 更新所有项目CHANGELOG ===\n');
    
    this.projects.forEach(project => {
      const lastTag = this.getLastVersionTag(project.path);
      this.updateProjectChangelog(project, version, lastTag);
    });

    // 生成总体CHANGELOG
    const masterChangelog = this.generateMasterChangelog(version);
    fs.writeFileSync('CHANGELOG.md', masterChangelog);
    console.log('✅ 总体CHANGELOG已更新: CHANGELOG.md');
  }

  // 显示项目变更摘要
  showProjectSummary(project, since = null) {
    const commits = this.getGitHistory(project.path, since);
    const categorizedCommits = this.categorizeCommits(commits);
    
    console.log(`\n${project.name} 变更摘要:`);
    console.log(`总提交数: ${commits.length}`);
    
    Object.keys(categorizedCommits).forEach(category => {
      if (categorizedCommits[category].length > 0) {
        console.log(`  ${category}: ${categorizedCommits[category].length} 项`);
      }
    });
  }

  // 显示所有项目摘要
  showAllSummaries() {
    console.log('=== 项目变更摘要 ===\n');
    
    this.projects.forEach(project => {
      const lastTag = this.getLastVersionTag(project.path);
      this.showProjectSummary(project, lastTag);
    });
  }
}

// 获取项目当前版本号
function getCurrentVersion(projectPath) {
  const packageJsonPath = path.join(projectPath, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return packageJson.version;
  }
  return '0.0.0';
}

// 命令行参数处理
const args = process.argv.slice(2);
const command = args[0] || 'update';
const version = args[1] || getCurrentVersion(path.join(__dirname, '..', '..', 'xituan_backend'));

const generator = new ChangelogGenerator();

switch (command) {
  case 'update':
    generator.updateAllChangelogs(version);
    break;
  case 'summary':
    generator.showAllSummaries();
    break;
  case 'help':
    console.log('用法:');
    console.log('  node scripts/changelog-generator.js update [version]  - 更新所有CHANGELOG');
    console.log('  node scripts/changelog-generator.js summary          - 显示变更摘要');
    console.log('  node scripts/changelog-generator.js help             - 显示帮助');
    break;
  default:
    console.log('未知命令，使用 "help" 查看可用命令');
}
