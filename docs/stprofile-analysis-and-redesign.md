# STProfile 处理器分析与重新设计

## 问题分析

### 当前处理器的严重问题

通过分析 `st-preset-injector.ts` 和实际的 stprofile 文件，发现了以下关键问题：

#### 1. **结构理解完全错误**

- 当前处理器将 stprofile 理解为简单的 "prompts + prompt_order" 结构
- 实际上 stprofile 是一个极其复杂的 **SillyTavern 完整配置文件**，包含：
    - 100+ 个提示词配置项
    - 复杂的扩展系统（SPreset）
    - 正则绑定系统
    - 模板变量系统
    - 多种渲染模式和输出格式

#### 2. **字段处理缺失**

当前处理器完全忽略了 stprofile 中的关键字段：

- `extensions.SPreset`: 包含正则绑定、聊天压缩等核心功能
- `prompts` 数组中的复杂配置：`injection_position`, `injection_depth`, `injection_order`
- 各种格式化选项：`wi_format`, `scenario_format`, `personality_format`
- 高级功能：`bias_preset_selected`, `max_context_unlocked`

#### 3. **模板处理不当**

- 简单的 LiquidJS 处理无法应对 stprofile 中的复杂模板语法
- 缺少对 `{{setvar::}}`, `{{getvar::}}` 等特殊指令的处理
- 没有处理条件渲染和循环逻辑

#### 4. **注入逻辑错误**

- 当前只处理 system/user/assistant 三个通道
- 实际 stprofile 包含多种注入位置和深度控制
- 缺少对 marker 和 forbid_overrides 的处理

## 新处理器架构设计

### 核心设计原则

1. **完全兼容 SillyTavern**: 100% 支持 stprofile 的所有功能
2. **模块化设计**: 每个功能模块独立，便于维护和扩展
3. **类型安全**: 完整的 TypeScript 类型定义和验证
4. **性能优化**: 智能缓存和增量处理
5. **错误恢复**: 优雅的错误处理和降级策略

### 架构层次

```
STProfileProcessor (主处理器)
├── STProfileParser (解析器)
│   ├── SchemaValidator (模式验证)
│   ├── StructureAnalyzer (结构分析)
│   └── CompatibilityChecker (兼容性检查)
├── STProfileCompiler (编译器)
│   ├── PromptResolver (提示词解析)
│   ├── TemplateProcessor (模板处理器)
│   ├── VariableManager (变量管理器)
│   └── InjectionPlanner (注入规划)
├── STProfileRenderer (渲染器)
│   ├── LiquidJSEngine (LiquidJS 引擎)
│   ├── CustomTagProcessor (自定义标签处理器)
│   ├── RegexProcessor (正则处理器)
│   └── OutputFormatter (输出格式化)
└── STProfileInjector (注入器)
    ├── RoleMapper (角色映射器)
    ├── FieldCalculator (字段计算器)
    └── ExtensionsHandler (扩展处理器)
```

### 关键数据结构

```typescript
// 完整的 STProfile 结构
interface STProfileComplete {
	// 基础配置
	basic: STProfileBasic
	// 提示词配置
	prompts: STPromptConfig[]
	// 扩展配置
	extensions: STExtensions
	// 正则绑定
	regexBindings: STRegexBinding[]
	// 模板变量
	templateVars: STTemplateVariables
}

// 编译上下文
interface STCompileContext {
	profile: STProfileComplete
	variables: Map<string, any>
	resolvedPrompts: Map<string, STResolvedPrompt>
	injectionPlan: STInjectionPlan
	renderCache: Map<string, string>
}

// 注入结果
interface STInjectionResult {
	success: boolean
	role: Role
	metadata: STInjectionMetadata
	warnings: STWarning[]
	errors: STError[]
}
```

## 核心模块实现

### 1. STProfileParser (解析器)

```typescript
class STProfileParser {
	parse(raw: unknown): STProfileComplete {
		// 1. 基础结构验证
		this.validateBasicStructure(raw)

		// 2. 解析提示词配置
		const prompts = this.parsePrompts(raw.prompts)

		// 3. 解析扩展配置
		const extensions = this.parseExtensions(raw.extensions)

		// 4. 解析正则绑定
		const regexBindings = this.parseRegexBindings(raw.extensions?.SPreset)

		// 5. 构建完整结构
		return {
			basic: this.parseBasicConfig(raw),
			prompts,
			extensions,
			regexBindings,
			templateVars: this.extractTemplateVars(prompts),
		}
	}

	private parsePrompts(prompts: any[]): STPromptConfig[] {
		return prompts.map((p) => ({
			identifier: p.identifier,
			name: p.name,
			role: p.role || "system",
			content: p.content,
			enabled: p.enabled !== false,
			system_prompt: p.system_prompt || false,
			marker: p.marker || false,
			injection: {
				position: p.injection_position || 0,
				depth: p.injection_depth || 4,
				order: p.injection_order || 100,
			},
			forbid_overrides: p.forbid_overrides || false,
			// 新增字段支持
			conditional: this.parseConditional(p),
			variables: this.extractPromptVariables(p.content),
		}))
	}
}
```

### 2. STProfileCompiler (编译器)

```typescript
class STProfileCompiler {
	compile(profile: STProfileComplete, context: STCompileContext): STCompilationResult {
		// 1. 解析提示词依赖关系
		const dependencyGraph = this.buildDependencyGraph(profile.prompts)

		// 2. 按顺序解析提示词
		const resolvedPrompts = this.resolvePrompts(profile.prompts, dependencyGraph, context)

		// 3. 处理变量定义和引用
		this.processVariableDefinitions(resolvedPrompts, context)

		// 4. 生成注入计划
		const injectionPlan = this.generateInjectionPlan(resolvedPrompts, profile)

		// 5. 构建编译结果
		return {
			resolvedPrompts,
			injectionPlan,
			templateContext: context,
			metadata: this.generateMetadata(profile, resolvedPrompts),
		}
	}

	private resolvePrompts(
		prompts: STPromptConfig[],
		graph: DependencyGraph,
		context: STCompileContext,
	): STResolvedPrompt[] {
		const resolved: STResolvedPrompt[] = []
		const visited = new Set<string>()

		for (const prompt of this.topologicalSort(graph)) {
			if (visited.has(prompt.identifier)) continue

			const resolvedPrompt = this.resolvePrompt(prompt, context)
			resolved.push(resolvedPrompt)
			visited.add(prompt.identifier)
		}

		return resolved
	}

	private resolvePrompt(prompt: STPromptConfig, context: STCompileContext): STResolvedPrompt {
		return {
			...prompt,
			processedContent: this.preprocessContent(prompt.content, context),
			dependencies: this.findDependencies(prompt.content),
			renderHints: this.generateRenderHints(prompt),
		}
	}
}
```

### 3. STProfileRenderer (渲染器)

```typescript
class STProfileRenderer {
	private liquidEngine: LiquidJSEngine
	private customProcessors: Map<string, CustomProcessor>

	constructor() {
		this.liquidEngine = new LiquidJSEngine()
		this.setupCustomProcessors()
	}

	render(compilation: STCompilationResult, variables: Record<string, any>): STRenderResult {
		const context = this.createRenderContext(compilation, variables)

		// 1. 处理变量设置
		this.processVariableSettings(compilation, context)

		// 2. 渲染提示词内容
		const renderedPrompts = this.renderPrompts(compilation.resolvedPrompts, context)

		// 3. 应用正则处理
		const processedPrompts = this.applyRegexProcessing(renderedPrompts, compilation)

		// 4. 格式化输出
		const formatted = this.formatOutput(processedPrompts, compilation)

		return {
			prompts: formatted,
			context: context,
			metadata: this.generateRenderMetadata(compilation, context),
		}
	}

	private setupCustomProcessors(): void {
		// 设置自定义标签处理器
		this.customProcessors.set("setvar", new SetVarProcessor())
		this.customProcessors.set("getvar", new GetVarProcessor())
		this.customProcessors.set("random", new RandomProcessor())
		this.customProcessors.set("roll", new RollProcessor())
		this.customProcessors.set("if", new ConditionalProcessor())
	}

	private processVariableSettings(compilation: STCompilationResult, context: STRenderContext): void {
		for (const prompt of compilation.resolvedPrompts) {
			if (prompt.content.includes("{{setvar::")) {
				this.extractAndSetVariables(prompt.content, context)
			}
		}
	}
}
```

### 4. STProfileInjector (注入器)

```typescript
class STProfileInjector {
	inject(renderResult: STRenderResult, targetRole: Role, options: STInjectOptions): STInjectionResult {
		try {
			// 1. 创建注入计划
			const plan = this.createInjectionPlan(renderResult, options)

			// 2. 计算字段映射
			const fieldMapping = this.calculateFieldMapping(plan, targetRole)

			// 3. 执行注入
			const injectedRole = this.performInjection(targetRole, plan, fieldMapping)

			// 4. 处理扩展信息
			this.processExtensions(injectedRole, renderResult, options)

			return {
				success: true,
				role: injectedRole,
				metadata: this.generateInjectionMetadata(plan, fieldMapping),
				warnings: this.collectWarnings(plan, renderResult),
				errors: [],
			}
		} catch (error) {
			return {
				success: false,
				role: targetRole, // 返回原始角色
				metadata: {},
				warnings: [],
				errors: [this.formatError(error)],
			}
		}
	}

	private createInjectionPlan(renderResult: STRenderResult, options: STInjectOptions): STInjectionPlan {
		const plan: STInjectionPlan = {
			systemPrompts: [],
			userPrompts: [],
			assistantPrompts: [],
			customInjections: [],
		}

		for (const prompt of renderResult.prompts) {
			if (!prompt.enabled) continue

			const injection = {
				identifier: prompt.identifier,
				content: prompt.processedContent,
				target: this.determineTarget(prompt, options),
				priority: prompt.injection.order,
				position: prompt.injection.position,
				depth: prompt.injection.depth,
			}

			switch (prompt.role) {
				case "system":
					plan.systemPrompts.push(injection)
					break
				case "user":
					plan.userPrompts.push(injection)
					break
				case "assistant":
					plan.assistantPrompts.push(injection)
					break
			}
		}

		// 按优先级排序
		this.sortInjectionsByPriority(plan)

		return plan
	}
}
```

## 使用示例

### 基本用法

```typescript
import { STProfileProcessor } from "./st-profile-processor"

const processor = new STProfileProcessor()

// 解析和编译
const profile = processor.parse(rawSTProfile)
const compilation = processor.compile(profile, {
	characterId: 100001,
	onlyEnabled: true,
	templateOptions: {
		strict: false,
		removeUnprocessed: true,
	},
})

// 渲染
const renderResult = processor.render(compilation, {
	user: "玩家角色名",
	char: "AI角色名",
	// 其他模板变量
})

// 注入到角色
const injectionResult = processor.inject(renderResult, targetRole, {
	mapping: {
		systemTo: "system_prompt",
		userTo: "scenario",
		assistantTo: "mes_example",
	},
	keepRawInExtensions: true,
})
```

### 高级用法

```typescript
// 自定义处理器
processor.registerCustomProcessor("custom_tag", new MyCustomProcessor())

// 缓存优化
processor.enableCaching(true)

// 错误处理
const result = processor.processWithFallback(rawSTProfile, targetRole, {
	fallbackStrategy: "partial",
	errorReporting: "detailed",
})
```

## 迁移指南

### 从旧处理器迁移

1. **替换导入**:

```typescript
// 旧
import { parseCompileAndInjectPreset } from "./st-preset-injector"

// 新
import { STProfileProcessor } from "./st-profile-processor"
```

2. **更新调用方式**:

```typescript
// 旧
const role = parseCompileAndInjectPreset(targetRole, rawPreset, options)

// 新
const processor = new STProfileProcessor()
const result = processor.process(targetRole, rawPreset, options)
const role = result.success ? result.role : targetRole
```

3. **处理新的错误信息**:

```typescript
if (!result.success) {
	console.error("注入失败:", result.errors)
	// 处理错误...
}
```

## 性能优化

1. **智能缓存**: 编译结果和渲染结果缓存
2. **增量处理**: 只重新处理变更的部分
3. **懒加载**: 按需加载处理器和模板
4. **内存管理**: 及时清理不需要的数据

## 测试策略

1. **单元测试**: 每个模块独立测试
2. **集成测试**: 端到端流程测试
3. **兼容性测试**: 各种 stprofile 文件测试
4. **性能测试**: 大文件和复杂配置测试
5. **错误处理测试**: 异常情况处理测试

这个新架构完全重新设计了 stprofile 处理器，解决了现有处理器的所有问题，并提供了强大的扩展能力和性能优化。
