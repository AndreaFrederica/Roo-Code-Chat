# ANH Chat Extension 一键发布脚本 (PowerShell版本)
# 支持发布到 VS Code Marketplace 和 Open VSX

param(
    [switch]$SkipGitCheck,
    [switch]$SkipTag,
    [switch]$Help
)

# 显示帮助信息
if ($Help) {
    Write-Host @"
ANH Chat Extension 一键发布工具

用法: .\scripts\publish.ps1 [选项]

选项:
  -SkipGitCheck    跳过Git状态检查
  -SkipTag         跳过创建Git标签
  -Help            显示此帮助信息

环境变量要求:
  VSCE_PAT         VS Code Marketplace Personal Access Token
  OVSX_PAT         Open VSX Personal Access Token

示例:
  .\scripts\publish.ps1                    # 完整发布流程
  .\scripts\publish.ps1 -SkipGitCheck     # 跳过Git检查
  .\scripts\publish.ps1 -SkipTag          # 跳过创建标签

"@
    exit 0
}

# 颜色输出函数
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$ForegroundColor = "White"
    )
    Write-Host $Message -ForegroundColor $ForegroundColor
}

function Write-Success {
    param([string]$Message)
    Write-ColorOutput "✅ $Message" "Green"
}

function Write-Error {
    param([string]$Message)
    Write-ColorOutput "❌ $Message" "Red"
}

function Write-Warning {
    param([string]$Message)
    Write-ColorOutput "⚠️  $Message" "Yellow"
}

function Write-Info {
    param([string]$Message)
    Write-ColorOutput "ℹ️  $Message" "Cyan"
}

function Write-Step {
    param([string]$Message)
    Write-ColorOutput "🚀 $Message" "Magenta"
}

# 执行命令函数
function Invoke-CommandWithLogging {
    param(
        [string]$Command,
        [string]$Description,
        [string]$WorkingDirectory = $PWD
    )
    
    try {
        Write-Info "执行: $Description"
        Write-ColorOutput "$ $Command" "Yellow"
        
        $result = Invoke-Expression $Command
        if ($LASTEXITCODE -eq 0) {
            Write-Success "完成: $Description"
            return $true
        } else {
            Write-Error "失败: $Description (退出代码: $LASTEXITCODE)"
            return $false
        }
    }
    catch {
        Write-Error "失败: $Description"
        Write-Error "错误: $($_.Exception.Message)"
        return $false
    }
}

# 检查环境变量
function Test-EnvironmentVariables {
    Write-Step "检查发布环境变量"
    
    $requiredVars = @(
        @{ Name = "VSCE_PAT"; Description = "VS Code Marketplace Personal Access Token" },
        @{ Name = "OVSX_PAT"; Description = "Open VSX Personal Access Token" }
    )
    
    $missingVars = @()
    
    foreach ($var in $requiredVars) {
        $value = [Environment]::GetEnvironmentVariable($var.Name)
        if ([string]::IsNullOrEmpty($value)) {
            $missingVars += $var
        } else {
            Write-Success "$($var.Name) 已设置"
        }
    }
    
    if ($missingVars.Count -gt 0) {
        Write-Error "缺少必要的环境变量:"
        foreach ($var in $missingVars) {
            Write-Error "  $($var.Name): $($var.Description)"
        }
        Write-Info ""
        Write-Info "请设置环境变量后重试:"
        Write-Info "PowerShell:"
        Write-Info '  $env:VSCE_PAT="your_vsce_token"'
        Write-Info '  $env:OVSX_PAT="your_ovsx_token"'
        Write-Info ""
        Write-Info "或者在系统环境变量中设置这些变量"
        return $false
    }
    
    return $true
}

# 获取包信息
function Get-PackageInfo {
    $packageJsonPath = Join-Path $PWD "src\package.json"
    if (-not (Test-Path $packageJsonPath)) {
        Write-Error "找不到 src\package.json 文件"
        return $null
    }
    
    try {
        $packageJson = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
        return @{
            Name = $packageJson.name
            Version = $packageJson.version
            DisplayName = if ($packageJson.displayName) { $packageJson.displayName } else { $packageJson.name }
        }
    }
    catch {
        Write-Error "读取 package.json 失败: $($_.Exception.Message)"
        return $null
    }
}

# 检查Git状态
function Test-GitStatus {
    if ($SkipGitCheck) {
        Write-Warning "跳过Git状态检查"
        return $true
    }
    
    Write-Step "检查Git状态"
    
    try {
        $status = git status --porcelain 2>$null
        if ($status) {
            Write-Warning "检测到未提交的更改:"
            Write-Host $status
            Write-Warning "建议在发布前提交所有更改"
            
            $response = Read-Host "是否继续发布? (y/N)"
            return ($response -eq "y" -or $response -eq "Y")
        } else {
            Write-Success "工作目录干净"
            return $true
        }
    }
    catch {
        Write-Warning "无法检查Git状态，可能不在Git仓库中"
        return $true
    }
}

# 构建VSIX包
function Build-Vsix {
    Write-Step "构建VSIX包"
    return Invoke-CommandWithLogging "pnpm vsix" "构建VSIX包"
}

# 发布到市场
function Publish-ToMarketplaces {
    Write-Step "发布到VS Code Marketplace和Open VSX"
    return Invoke-CommandWithLogging "pnpm --filter anh-cline publish:marketplace" "发布到市场"
}

# 创建Git标签
function New-GitTag {
    param([string]$Version)
    
    if ($SkipTag) {
        Write-Warning "跳过创建Git标签"
        return $true
    }
    
    Write-Step "创建Git标签 v$Version"
    
    try {
        # 检查标签是否已存在
        $tagExists = git rev-parse "v$Version" 2>$null
        if ($tagExists) {
            Write-Warning "标签 v$Version 已存在"
            return $true
        }
        
        $success = Invoke-CommandWithLogging "git tag -a v$Version -m `"Release v$Version`"" "创建标签 v$Version"
        if ($success) {
            return Invoke-CommandWithLogging "git push origin v$Version" "推送标签 v$Version"
        }
        return $false
    }
    catch {
        Write-Error "创建Git标签失败: $($_.Exception.Message)"
        return $false
    }
}

# 主函数
function Main {
    Write-Host ""
    Write-ColorOutput "🚀 ANH Chat Extension 一键发布工具" "Cyan"
    Write-Host ""
    
    # 检查包信息
    $packageInfo = Get-PackageInfo
    if (-not $packageInfo) {
        exit 1
    }
    
    Write-Info "扩展名称: $($packageInfo.DisplayName)"
    Write-Info "包名: $($packageInfo.Name)"
    Write-Info "版本: $($packageInfo.Version)"
    Write-Host ""
    
    # 检查环境变量
    if (-not (Test-EnvironmentVariables)) {
        exit 1
    }
    
    # 检查Git状态
    if (-not (Test-GitStatus)) {
        Write-Info "发布已取消"
        exit 1
    }
    
    Write-Host ""
    Write-ColorOutput "开始发布流程..." "White"
    Write-Host ""
    
    # 1. 构建VSIX包
    if (-not (Build-Vsix)) {
        Write-Error "构建VSIX包失败"
        exit 1
    }
    
    # 2. 发布到市场
    if (-not (Publish-ToMarketplaces)) {
        Write-Error "发布到市场失败"
        exit 1
    }
    
    # 3. 创建Git标签
    if (-not (New-GitTag $packageInfo.Version)) {
        Write-Warning "创建Git标签失败，但发布已完成"
    }
    
    # 发布完成
    Write-Host ""
    Write-ColorOutput "🎉 发布完成！" "Green"
    Write-Host ""
    Write-Success "$($packageInfo.DisplayName) v$($packageInfo.Version) 已成功发布到:"
    Write-Success "  • VS Code Marketplace"
    Write-Success "  • Open VSX Registry"
    
    Write-Host ""
    Write-Info "发布后的操作建议:"
    Write-Info "  • 检查市场页面确认发布成功"
    Write-Info "  • 更新CHANGELOG.md记录此次发布"
    Write-Info "  • 通知团队成员新版本已发布"
    Write-Host ""
}

# 错误处理
$ErrorActionPreference = "Stop"

try {
    Main
}
catch {
    Write-Error "发布失败: $($_.Exception.Message)"
    exit 1
}