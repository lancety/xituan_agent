/**
 * One-shot: finish interrupted v3.8.2 release for remaining main repos.
 * Uses SmartUnifiedReleaseManager logic from unified-release.js without re-running full patch.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const srcPath = path.join(__dirname, 'unified-release.js');
const tmpPath = path.join(__dirname, '_tmp-release-export.js');
const src = fs
  .readFileSync(srcPath, 'utf8')
  .replace(/\/\/ 命令行参数处理[\s\S]*$/, 'module.exports = SmartUnifiedReleaseManager;\n');
fs.writeFileSync(tmpPath, src);

const SmartUnifiedReleaseManager = require('./_tmp-release-export.js');
const mgr = new SmartUnifiedReleaseManager();

const NEW_VERSION = '3.8.2';
const projectRoot = path.join(__dirname, '..', '..');

const remaining = [
  { name: 'xituan_platform', syncApp: false },
  { name: 'xituan_site', syncApp: true, syncLabel: '站点' },
  { name: 'xituan_wechat_app', syncApp: true, syncLabel: '微信小程序' },
  { name: 'xituan_agent', syncApp: false },
];

function pushMasterAndVersionTag(projectPath, version) {
  execSync('git push origin master', { cwd: projectPath, stdio: 'inherit' });
  execSync(`git push origin v${version}`, { cwd: projectPath, stdio: 'inherit' });
}

try {
  for (const item of remaining) {
    const projectPath = path.join(projectRoot, item.name);
    const currentVersion = mgr.getCurrentVersion(projectPath);
    console.log(`\n=== 补完 ${item.name} (${currentVersion} → ${NEW_VERSION}) ===`);

    if (currentVersion === NEW_VERSION) {
      const hasTag = execSync('git tag -l v' + NEW_VERSION, {
        cwd: projectPath,
        encoding: 'utf8',
      }).trim();
      if (hasTag) {
        console.log(`${item.name} 已是 ${NEW_VERSION} 且有 tag，跳过版本变更`);
        // Ensure remote is up to date
        try {
          pushMasterAndVersionTag(projectPath, NEW_VERSION);
        } catch (e) {
          console.log(`${item.name} push 可能已存在，继续: ${e.message}`);
        }
        continue;
      }
    }

    const hasChanges = mgr.hasChanges(projectPath);
    const oldVersion = mgr.updateVersionTo(projectPath, NEW_VERSION);
    mgr.generateSmartChangelog(projectPath, NEW_VERSION, hasChanges, oldVersion);

    if (item.syncApp) {
      mgr.syncAppVersion(projectPath, item.syncLabel);
    }

    mgr.exec('git checkout master', projectPath);
    mgr.exec('git pull origin master', projectPath);
    mgr.exec('git add .', projectPath);

    // Commit may fail if nothing to commit
    try {
      mgr.exec(`git commit -m "chore: release v${NEW_VERSION}"`, projectPath);
    } catch (e) {
      console.log(`${item.name} commit 跳过或失败: ${e.message}`);
    }

    // Tag if missing
    const existingTag = execSync(`git tag -l v${NEW_VERSION}`, {
      cwd: projectPath,
      encoding: 'utf8',
    }).trim();
    if (!existingTag) {
      mgr.exec(`git tag v${NEW_VERSION}`, projectPath);
    } else {
      console.log(`${item.name} tag v${NEW_VERSION} 已存在`);
    }

    pushMasterAndVersionTag(projectPath, NEW_VERSION);
    console.log(`${item.name} v${NEW_VERSION} 发布完成`);
  }

  console.log('\n=== 补完发布结束 ===');
} finally {
  if (fs.existsSync(tmpPath)) {
    fs.unlinkSync(tmpPath);
  }
}
