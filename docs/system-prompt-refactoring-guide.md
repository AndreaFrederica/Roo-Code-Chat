# System.ts 重构指南

## 📋 重构概述

本次重构将原本2388行的庞大 `system.ts` 文件拆分为多个专门的模块，提高了代码的可维护性、可测试性和可复用性。

## 🏗️ 新的模块架构

```
src/core/prompts/
├── system.ts                 # 原始文件（保持向后兼容）
├── system-refactored.ts      # 重构后的主入口文件
├── index.ts                  # 统一导出接口
├── generators/               # 生成器模块
│   ├── index.ts             # 生成器统一导出
│   ├── role-generator.ts    # 角色信息生成器
│   ├── stprofile-generator.ts # STProfile处理器
│   ├── worldbook-generator.ts # 世界观生成器
│   └── variable-injector.ts # 变量状态注入器
├── builders/                 # 构建器模块
│   ├── index.ts             # 构建器统一导出
│   ├── prompt-builder.ts    # 系统提示词组装器
│   └── environment-builder.ts # 环境详情构建器
├── utils/                    # 工具模块
│   ├── index.ts             # 工具统一导出
│   ├── template-processor.ts # 模板处理器
│   └── role-overrides.ts    # 角色覆盖逻辑
└── sections/                 # 保留原有的sections模块
    ├── custom-system-prompt.ts
    ├── tools.ts
    └── ...
```

## 🎯 重构目标

### ✅ 已完成的改进

1. **职责分离**：
   - 角色生成逻辑 → `RoleGenerator`
   - STProfile处理 → `STProfileGenerator`
   - 世界观处理 → `WorldBookGenerator`
   - 变量注入 → `VariableInjector`
   - 系统提示词组装 → `PromptBuilder`
   - 环境详情构建 → `EnvironmentBuilder`

2. **可复用性**：
   - 增强导向模式现在可以复用角色生成逻辑
   - 各个模块可以独立使用
   - 清晰的接口定义

3. **可维护性**：
   - 单一职责原则
   - 模块化设计
   - 清晰的依赖关系

4. **可测试性**：
   - 独立的模块便于单元测试
   - 模拟依赖更容易
   - 测试覆盖率提升

## 🚀 主要模块详解

### 1. RoleGenerator (角色信息生成器)

**职责**：生成角色详细信息，处理角色覆盖逻辑

**核心功能**：
```typescript
class RoleGenerator {
  generateRoleSection()           // 生成AI角色详细信息
  generateUserAvatarSection()     // 生成用户头像角色信息
  generateEnhancedRoleInfo()      // 为增强导向模式生成角色信息
  applyRoleOverrides()            // 应用角色覆盖逻辑
}
```

**增强导向模式支持**：
- `generateEnhancedRoleInfo()` 专门为增强导向模式提供完整的角色信息
- 包含角色定义、系统指令、用户头像信息等

### 2. STProfileGenerator (STProfile处理器)

**职责**：加载、验证和处理 STProfile 文件

**核心功能**：
```typescript
class STProfileGenerator {
  loadProfiles()                 // 加载Profile文件
  applyPreprocessing()           // 应用Profile预处理
  validateProfile()              // 验证Profile文件
}
```

**特性**：
- 支持工作区和全局Profile
- 自动检测和处理mixin文件
- 模板变量注入
- 错误处理和降级策略

### 3. WorldBookGenerator (世界观生成器)

**职责**：处理世界观设定内容

**核心功能**：
```typescript
class WorldBookGenerator {
  loadWorldBookContent()         // 加载世界观内容
  loadTriggeredWorldBookContent() // 加载触发的世界观内容
  generateWorldBookSummary()     // 生成世界观摘要
}
```

### 4. VariableInjector (变量状态注入器)

**职责**：处理变量状态的注入和格式化

**核心功能**：
```typescript
class VariableInjector {
  injectVariableState()          // 注入变量状态
  generateVariableSummary()      // 生成变量摘要
  extractVariablesFromTodoList() // 从Todo列表提取变量
  cleanVariableState()           // 清理敏感信息
}
```

### 5. PromptBuilder (系统提示词组装器)

**职责**：协调各个生成器，组装完整的系统提示词

**核心功能**：
```typescript
class PromptBuilder {
  buildSystemPrompt()            // 构建完整系统提示词
  buildFileBasedPrompt()         // 构建基于文件的提示词
  generateEnhancedRoleInfo()     // 生成增强角色信息
}
```

### 6. EnvironmentBuilder (环境详情构建器)

**职责**：构建环境上下文信息

**核心功能**：
```typescript
class EnvironmentBuilder {
  buildEnvironmentDetails()      // 构建环境详情
  generateEnhancedRoleEnvironmentInfo() // 生成增强角色环境信息
}
```

## 🔄 增强导向模式的改进

### 问题解决

**之前的问题**：
```typescript
// 只包含简单的角色定义
details += `<role>${modeDetails.roleDefinition}</role>\n`
// 结果：You are Roo, a friendly and knowledgeable conversational assistant.
```

**重构后的解决方案**：
```typescript
// 包含完整的角色系统信息
const enhancedRoleInfo = this.roleGenerator.generateEnhancedRoleInfo(rolePromptData)
details += `<enhanced_role_definition>${enhancedRoleInfo.roleDefinition}</enhanced_role_definition>\n`
details += `<role_summary>${enhancedRoleInfo.roleSummary}</role_summary>\n`
details += `<enhanced_system_instructions>${enhancedRoleInfo.systemInstructions}</enhanced_system_instructions>\n`
```

### 效果对比

| 项目 | 重构前 | 重构后 |
|------|--------|--------|
| 角色信息 | 简单的一句话 | 完整的角色定义、特征、背景 |
| 系统指令 | 无 | 包含完整的system_prompt |
| 世界观信息 | 无 | 世界观摘要（如果有） |
| 变量状态 | 无 | 变量状态摘要（如果有） |
| 用户头像 | 无 | 用户头像角色信息 |

## 📝 迁移指南

### 1. 向后兼容性

重构后的代码完全向后兼容：

```typescript
// 原有的调用方式仍然有效
import { SYSTEM_PROMPT } from './core/prompts/system'

const prompt = await SYSTEM_PROMPT(context, cwd, supportsComputerUse, ...)
```

### 2. 新的推荐用法

```typescript
// 推荐使用重构后的接口
import { PromptBuilder, RoleGenerator } from './core/prompts'

const promptBuilder = new PromptBuilder()
const roleGenerator = new RoleGenerator()

// 构建系统提示词
const prompt = await promptBuilder.buildSystemPrompt(options)

// 为增强导向模式生成角色信息
const enhancedRole = roleGenerator.generateEnhancedRoleInfo(rolePromptData)
```

### 3. 增强导向模式的集成

```typescript
// 在 getEnvironmentDetails 中
import { EnvironmentBuilder } from './core/prompts/builders'

const environmentBuilder = new EnvironmentBuilder()

if (Experiments.isEnabled(experiments, EXPERIMENT_IDS.POWER_STEERING)) {
    const enhancedInfo = environmentBuilder.generateEnhancedRoleEnvironmentInfo({
        rolePromptData,
        userAvatarRole,
        enableUserAvatar,
        maxLength: 1500,
        includeSystemInstructions: true,
        includeWorldBookSummary: true,
        includeVariableSummary: true,
    })
    details += enhancedInfo
}
```

## 🧪 测试策略

### 1. 单元测试

每个模块都可以独立测试：

```typescript
// 测试角色生成器
describe('RoleGenerator', () => {
  it('should generate enhanced role info', () => {
    const generator = new RoleGenerator()
    const result = generator.generateEnhancedRoleInfo(mockRolePromptData)
    expect(result.roleDefinition).toContain('You are...')
  })
})

// 测试STProfile处理器
describe('STProfileGenerator', () => {
  it('should load and validate profiles', async () => {
    const generator = new STProfileGenerator()
    const profiles = await generator.loadProfiles('global')
    expect(profiles).toBeInstanceOf(Array)
  })
})
```

### 2. 集成测试

```typescript
describe('System Prompt Integration', () => {
  it('should build complete system prompt', async () => {
    const builder = new PromptBuilder()
    const prompt = await builder.buildSystemPrompt(testOptions)
    expect(prompt).toContain('You are')
    expect(prompt).toContain('Capabilities')
  })
})
```

### 3. 回归测试

确保重构后的行为与原始版本一致：

```typescript
describe('Backward Compatibility', () => {
  it('should produce same output as original', async () => {
    const originalPrompt = await ORIGINAL_SYSTEM_PROMPT(...)
    const refactoredPrompt = await SYSTEM_PROMPT(...)
    expect(normalizePrompt(originalPrompt)).toEqual(normalizePrompt(refactoredPrompt))
  })
})
```

## 🔧 性能优化

### 1. 单例模式

```typescript
// 使用单例模式避免重复创建实例
let promptBuilderInstance: PromptBuilder | null = null

function getPromptBuilder(): PromptBuilder {
  if (!promptBuilderInstance) {
    promptBuilderInstance = new PromptBuilder()
  }
  return promptBuilderInstance
}
```

### 2. 懒加载

只有在需要时才创建和初始化模块：

```typescript
// 模块按需加载
const roleGenerator = new RoleGenerator() // 轻量级，立即创建
const stProfileGenerator = new STProfileGenerator() // 按需使用
```

### 3. 缓存机制

```typescript
// 缓存处理结果
private cache = new Map<string, any>()

async generateEnhancedRoleInfo(options: EnhancedRoleOptions): EnhancedRoleInfo {
  const cacheKey = JSON.stringify(options)
  if (this.cache.has(cacheKey)) {
    return this.cache.get(cacheKey)
  }

  const result = this.processRoleInfo(options)
  this.cache.set(cacheKey, result)
  return result
}
```

## 📈 未来扩展

### 1. 插件系统

新的模块化架构支持插件系统：

```typescript
interface PromptPlugin {
  name: string
  process(content: string, options: any): Promise<string>
}

class PromptBuilder {
  private plugins: PromptPlugin[] = []

  registerPlugin(plugin: PromptPlugin) {
    this.plugins.push(plugin)
  }
}
```

### 2. 配置驱动

```typescript
interface PromptBuilderConfig {
  enableCaching: boolean
  maxCacheSize: number
  defaultLocale: string
  customGenerators: Record<string, GeneratorClass>
}
```

### 3. 监控和调试

```typescript
class PromptBuilder {
  private metrics = {
    generationTime: 0,
    cacheHits: 0,
    errors: 0
  }

  getMetrics() {
    return this.metrics
  }
}
```

## 🎉 总结

这次重构成功地将一个庞大的单体文件转换为模块化、可维护的架构。主要成果包括：

1. **代码质量提升**：单一职责、模块化设计
2. **可维护性增强**：清晰的模块边界和依赖关系
3. **可测试性改善**：独立模块便于单元测试
4. **功能增强**：增强导向模式现在包含完整的角色信息
5. **向后兼容**：现有代码无需修改即可使用
6. **性能优化**：单例模式和缓存机制
7. **扩展性提升**：为未来的功能扩展奠定基础

现在增强导向模式可以真正发挥作用，为AI提供完整的角色强化信息，而不仅仅是简单的角色定义重复。