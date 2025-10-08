# ANH Chat Extension 发布指南

本文档介绍如何将 ANH Chat Extension 发布到 VS Code Marketplace 和 Open VSX Registry。

## 前置要求

### 1. 获取发布令牌

#### VS Code Marketplace (VSCE_PAT)
1. 访问 [Azure DevOps](https://dev.azure.com/)
2. 创建个人访问令牌 (Personal Access Token)
3. 权限设置：
   - **Scopes**: Custom defined
   - **Marketplace**: Manage

#### Open VSX Registry (OVSX_PAT)
1. 访问 [Open VSX Registry](https://open-vsx.org/)
2. 使用 GitHub 账号登录
3. 在用户设置中生成访问令牌

### 2. 设置环境变量

#### Windows PowerShell
```powershell
$env:VSCE_PAT="your_vsce_token_here"
$env:OVSX_PAT="your_ovsx_token_here"
```

#### Windows CMD
```cmd
set VSCE_PAT=your_vsce_token_here
set OVSX_PAT=your_ovsx_token_here
```

#### Linux/macOS
```bash
export VSCE_PAT="your_vsce_token_here"
export OVSX_PAT="your_ovsx_token_here"
```

## 发布方法

### 方法一：使用 Node.js 脚本（推荐）

```bash
# 完整发布流程
pnpm publish

# 或直接运行脚本
node scripts/publish.js
```

### 方法二：使用 PowerShell 脚本（Windows）

```powershell
# 完整发布流程
pnpm run publish:ps1

# 或直接运行脚本
.\scripts\publish.ps1

# 跳过 Git 检查
.\scripts\publish.ps1 -SkipGitCheck

# 跳过创建 Git 标签
.\scripts\publish.ps1 -SkipTag

# 查看帮助
.\scripts\publish.ps1 -Help
```

### 方法三：手动发布

```bash
# 1. 构建 VSIX 包
pnpm vsix

# 2. 发布到市场
pnpm --filter anh-cline publish:marketplace

# 3. 创建 Git 标签（可选）
git tag -a v$(node -p "require('./src/package.json').version") -m "Release v$(node -p "require('./src/package.json').version")"
git push origin v$(node -p "require('./src/package.json').version")
```

## 发布流程说明

一键发布脚本会执行以下步骤：

1. **环境检查**
   - 验证必要的环境变量 (VSCE_PAT, OVSX_PAT)
   - 检查 package.json 文件
   - 检查 Git 工作目录状态

2. **构建阶段**
   - 执行 `pnpm vsix` 构建 VSIX 包
   - 验证构建产物

3. **发布阶段**
   - 同时发布到 VS Code Marketplace 和 Open VSX Registry
   - 使用 `vsce publish` 和 `ovsx publish` 命令

4. **标签创建**
   - 基于 package.json 中的版本创建 Git 标签
   - 推送标签到远程仓库

## 发布后检查

发布完成后，请检查以下内容：

1. **VS Code Marketplace**
   - 访问 [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=AndreaFrederica.anh-cline)
   - 确认新版本已显示
   - 检查扩展信息和截图

2. **Open VSX Registry**
   - 访问 [Open VSX](https://open-vsx.org/extension/AndreaFrederica/anh-cline)
   - 确认新版本已显示

3. **GitHub Release**
   - 检查是否自动创建了 GitHub Release（如果配置了 CI/CD）
   - 确认 VSIX 文件已附加到 Release

## 故障排除

### 常见错误

#### 1. 环境变量未设置
```
❌ 缺少必要的环境变量:
  VSCE_PAT: VS Code Marketplace Personal Access Token
```
**解决方案**: 按照上述方法设置环境变量

#### 2. 令牌权限不足
```
❌ Error: Failed request: (401) Unauthorized
```
**解决方案**: 检查令牌权限设置，确保有发布权限

#### 3. 版本已存在
```
❌ Error: Extension version already exists
```
**解决方案**: 更新 `src/package.json` 中的版本号

#### 4. Git 工作目录不干净
```
⚠️ 检测到未提交的更改
```
**解决方案**: 提交所有更改或使用 `-SkipGitCheck` 参数

### 调试技巧

1. **查看详细日志**
   ```bash
   # 启用详细输出
   DEBUG=* pnpm publish
   ```

2. **测试构建**
   ```bash
   # 仅构建不发布
   pnpm vsix
   ```

3. **检查 VSIX 内容**
   ```bash
   # 解压查看 VSIX 内容
   unzip -l bin/anh-cline-*.vsix
   ```

## 版本管理

### 语义化版本控制

项目使用语义化版本控制 (SemVer)：
- **主版本号**: 不兼容的 API 修改
- **次版本号**: 向下兼容的功能性新增
- **修订号**: 向下兼容的问题修正

### 版本更新

```bash
# 更新补丁版本 (1.0.0 -> 1.0.1)
npm version patch

# 更新次版本 (1.0.0 -> 1.1.0)
npm version minor

# 更新主版本 (1.0.0 -> 2.0.0)
npm version major
```

## 自动化发布

项目已配置 GitHub Actions 自动发布工作流：

- **触发条件**: 
  - Pull Request 合并到 main 分支且标题包含 "Changeset version bump"
  - 手动触发 workflow_dispatch

- **工作流文件**: `.github/workflows/marketplace-publish.yml`

## 相关链接

- [VS Code Extension Publishing](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [Open VSX Registry](https://open-vsx.org/)
- [vsce CLI 文档](https://github.com/microsoft/vscode-vsce)
- [ovsx CLI 文档](https://github.com/eclipse/openvsx/wiki/Publishing-Extensions)