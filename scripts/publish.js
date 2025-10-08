#!/usr/bin/env node

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

// 颜色输出函数
const colors = {
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  bold: (text) => `\x1b[1m${text}\x1b[0m`
}

// 日志函数
const log = {
  info: (msg) => console.log(colors.blue('ℹ'), msg),
  success: (msg) => console.log(colors.green('✅'), msg),
  warning: (msg) => console.log(colors.yellow('⚠️'), msg),
  error: (msg) => console.log(colors.red('❌'), msg),
  step: (msg) => console.log(colors.cyan('🚀'), colors.bold(msg))
}

// 执行命令函数
function runCommand(command, description) {
  try {
    log.info(`执行: ${description}`)
    console.log(colors.yellow(`$ ${command}`))
    execSync(command, { stdio: 'inherit', cwd: process.cwd() })
    log.success(`完成: ${description}`)
    return true
  } catch (error) {
    log.error(`失败: ${description}`)
    log.error(`错误: ${error.message}`)
    return false
  }
}

// 检查环境变量
function checkEnvironmentVariables() {
  log.step('检查发布环境变量')
  
  const requiredEnvVars = [
    { name: 'VSCE_PAT', description: 'VS Code Marketplace Personal Access Token' },
    { name: 'OVSX_PAT', description: 'Open VSX Personal Access Token' }
  ]
  
  const missingVars = []
  
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar.name]) {
      missingVars.push(envVar)
    } else {
      log.success(`${envVar.name} 已设置`)
    }
  }
  
  if (missingVars.length > 0) {
    log.error('缺少必要的环境变量:')
    missingVars.forEach(envVar => {
      log.error(`  ${envVar.name}: ${envVar.description}`)
    })
    log.info('\n请设置环境变量后重试:')
    log.info('Windows (PowerShell):')
    log.info('  $env:VSCE_PAT="your_vsce_token"')
    log.info('  $env:OVSX_PAT="your_ovsx_token"')
    log.info('\nWindows (CMD):')
    log.info('  set VSCE_PAT=your_vsce_token')
    log.info('  set OVSX_PAT=your_ovsx_token')
    log.info('\nLinux/macOS:')
    log.info('  export VSCE_PAT="your_vsce_token"')
    log.info('  export OVSX_PAT="your_ovsx_token"')
    return false
  }
  
  return true
}

// 获取包信息
function getPackageInfo() {
  const packageJsonPath = path.join(process.cwd(), 'src', 'package.json')
  if (!fs.existsSync(packageJsonPath)) {
    log.error('找不到 src/package.json 文件')
    return null
  }
  
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    return {
      name: packageJson.name,
      version: packageJson.version,
      displayName: packageJson.displayName || packageJson.name
    }
  } catch (error) {
    log.error(`读取 package.json 失败: ${error.message}`)
    return null
  }
}

// 检查是否有未提交的更改
function checkGitStatus() {
  log.step('检查Git状态')
  
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8' })
    if (status.trim()) {
      log.warning('检测到未提交的更改:')
      console.log(status)
      log.warning('建议在发布前提交所有更改')
      return false
    } else {
      log.success('工作目录干净')
      return true
    }
  } catch (error) {
    log.warning('无法检查Git状态，可能不在Git仓库中')
    return true
  }
}

// 构建VSIX包
function buildVsix() {
  log.step('构建VSIX包')
  return runCommand('pnpm vsix', '构建VSIX包')
}

// 发布到市场
function publishToMarketplaces() {
  log.step('发布到VS Code Marketplace和Open VSX')
  return runCommand('pnpm --filter anh-cline publish:marketplace', '发布到市场')
}

// 创建Git标签
function createGitTag(version) {
  log.step(`创建Git标签 v${version}`)
  
  try {
    // 检查标签是否已存在
    try {
      execSync(`git rev-parse v${version}`, { stdio: 'ignore' })
      log.warning(`标签 v${version} 已存在`)
      return true
    } catch {
      // 标签不存在，继续创建
    }
    
    const success = runCommand(`git tag -a v${version} -m "Release v${version}"`, `创建标签 v${version}`)
    if (success) {
      return runCommand(`git push origin v${version}`, `推送标签 v${version}`)
    }
    return false
  } catch (error) {
    log.error(`创建Git标签失败: ${error.message}`)
    return false
  }
}

// 主函数
async function main() {
  console.log(colors.bold(colors.cyan('\n🚀 ANH Chat Extension 一键发布工具\n')))
  
  // 检查包信息
  const packageInfo = getPackageInfo()
  if (!packageInfo) {
    process.exit(1)
  }
  
  log.info(`扩展名称: ${packageInfo.displayName}`)
  log.info(`包名: ${packageInfo.name}`)
  log.info(`版本: ${packageInfo.version}`)
  
  // 检查环境变量
  if (!checkEnvironmentVariables()) {
    process.exit(1)
  }
  
  // 检查Git状态
  const gitClean = checkGitStatus()
  if (!gitClean) {
    log.info('\n继续发布请按 Enter，取消请按 Ctrl+C')
    // 在Node.js中等待用户输入
    process.stdin.setRawMode(true)
    process.stdin.resume()
    await new Promise(resolve => {
      process.stdin.once('data', () => {
        process.stdin.setRawMode(false)
        process.stdin.pause()
        resolve()
      })
    })
  }
  
  console.log('\n' + colors.bold('开始发布流程...') + '\n')
  
  // 1. 构建VSIX包
  if (!buildVsix()) {
    log.error('构建VSIX包失败')
    process.exit(1)
  }
  
  // 2. 发布到市场
  if (!publishToMarketplaces()) {
    log.error('发布到市场失败')
    process.exit(1)
  }
  
  // 3. 创建Git标签
  if (!createGitTag(packageInfo.version)) {
    log.warning('创建Git标签失败，但发布已完成')
  }
  
  // 发布完成
  console.log('\n' + colors.green(colors.bold('🎉 发布完成！')) + '\n')
  log.success(`${packageInfo.displayName} v${packageInfo.version} 已成功发布到:`)
  log.success('  • VS Code Marketplace')
  log.success('  • Open VSX Registry')
  
  log.info('\n发布后的操作建议:')
  log.info('  • 检查市场页面确认发布成功')
  log.info('  • 更新CHANGELOG.md记录此次发布')
  log.info('  • 通知团队成员新版本已发布')
}

// 错误处理
process.on('uncaughtException', (error) => {
  log.error(`未捕获的异常: ${error.message}`)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  log.error(`未处理的Promise拒绝: ${reason}`)
  process.exit(1)
})

// 运行主函数
main().catch(error => {
  log.error(`发布失败: ${error.message}`)
  process.exit(1)
})