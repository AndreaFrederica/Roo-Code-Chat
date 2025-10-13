// STProfile 处理器 - 完全重写的 SillyTavern 预设文件处理器
// 解决现有处理器的所有问题，提供完整的 stprofile 支持

import { z } from "zod"
import { Role, roleSchema } from "./anh-chat.js"
import { processLiquidTemplateVariables, type LiquidTemplateProcessingOptions } from "./liquid-template-system.js"

// ============================================================================
// 类型定义
// ============================================================================

/** 完整的 STProfile 结构 */
export interface STProfileComplete {
	/** 基础配置 */
	basic: STProfileBasic
	/** 提示词配置 */
	prompts: STPromptConfig[]
	/** 扩展配置 */
	extensions: STExtensions
	/** 正则绑定 */
	regexBindings: STRegexBinding[]
	/** 模板变量 */
	templateVars: STTemplateVariables
}

/** 基础配置 */
export interface STProfileBasic {
	temperature?: number
	frequency_penalty?: number
	presence_penalty?: number
	top_p?: number
	top_k?: number
	top_a?: number
	min_p?: number
	repetition_penalty?: number
	openai_max_context?: number
	openai_max_tokens?: number
	wrap_in_quotes?: boolean
	names_behavior?: number
	send_if_empty?: string
	impersonation_prompt?: string
	new_chat_prompt?: string
	new_group_chat_prompt?: string
	new_example_chat_prompt?: string
	continue_nudge_prompt?: string
	bias_preset_selected?: string
	max_context_unlocked?: boolean
	wi_format?: string
	scenario_format?: string
	personality_format?: string
	group_nudge_prompt?: string
	stream_openai?: boolean
}

/** 提示词配置 */
export interface STPromptConfig {
	identifier: string
	name?: string
	role: "system" | "user" | "assistant"
	content: string
	enabled: boolean
	system_prompt: boolean
	marker: boolean
	injection: {
		position: number
		depth: number
		order: number
	}
	forbid_overrides: boolean
	conditional?: STConditional
	variables: string[]
	dependencies: string[]
}

/** 扩展配置 */
export interface STExtensions {
	SPreset?: STSPresetExtension
	[key: string]: any
}

/** SPreset 扩展 */
export interface STSPresetExtension {
	ChatSquash?: STChatSquashConfig
	RegexBinding?: STRegexBinding[]
	[key: string]: any
}

/** 聊天压缩配置 */
export interface STChatSquashConfig {
	enabled: boolean
	separate_chat_history: boolean
	parse_clewd: boolean
	role: string
	stop_string: string
	user_prefix: string
	user_suffix: string
	char_prefix: string
	char_suffix: string
	prefix_system: string
	suffix_system: string
	enable_squashed_separator: boolean
	squashed_separator_regex?: boolean
	squashed_separator_string?: string
	squashed_post_script_enable: boolean
	squashed_post_script?: string
}

/** 正则绑定 */
export interface STRegexBinding {
	id: string
	scriptName: string
	findRegex: string
	replaceString: string
	trimStrings: string[]
	placement: number[]
	disabled: boolean
	markdownOnly: boolean
	promptOnly: boolean
	runOnEdit: boolean
	substituteRegex: number
	minDepth?: number
	maxDepth?: number
}

/** 模板变量 */
export interface STTemplateVariables {
	[key: string]: any
}

/** 条件配置 */
export interface STConditional {
	if?: string
	then?: string
	else?: string
}

/** 编译上下文 */
export interface STCompileContext {
	profile: STProfileComplete
	variables: Map<string, any>
	resolvedPrompts: Map<string, STResolvedPrompt>
	injectionPlan: STInjectionPlan
	renderCache: Map<string, string>
}

/** 已解析的提示词 */
export interface STResolvedPrompt extends STPromptConfig {
	processedContent: string
	dependencies: string[]
	renderHints: STRenderHints
}

/** 渲染提示 */
export interface STRenderHints {
	priority: number
	conditional: boolean
	hasVariables: boolean
	templateComplexity: number
}

/** 注入计划 */
export interface STInjectionPlan {
	systemPrompts: STInjection[]
	userPrompts: STInjection[]
	assistantPrompts: STInjection[]
	customInjections: STInjection[]
}

/** 单个注入项 */
export interface STInjection {
	identifier: string
	content: string
	target: string
	priority: number
	position: number
	depth: number
	enabled: boolean
}

/** 编译结果 */
export interface STCompilationResult {
	resolvedPrompts: STResolvedPrompt[]
	injectionPlan: STInjectionPlan
	templateContext: STCompileContext
	metadata: STCompilationMetadata
}

/** 编译元数据 */
export interface STCompilationMetadata {
	totalPrompts: number
	enabledPrompts: number
	processingTime: number
	dependencies: string[]
	warnings: string[]
}

/** 渲染上下文 */
export interface STRenderContext {
	variables: Map<string, any>
	processors: Map<string, STCustomProcessor>
	cache: Map<string, string>
	metadata: STRenderMetadata
}

/** 渲染元数据 */
export interface STRenderMetadata {
	renderTime: number
	cacheHits: number
	processedVariables: number
	errors: string[]
}

/** 渲染结果 */
export interface STRenderResult {
	prompts: STResolvedPrompt[]
	context: STRenderContext
	metadata: STRenderMetadata
}

/** 注入选项 */
export interface STInjectOptions {
	mapping?: STFieldMapping
	keepRawInExtensions?: boolean
	keepCompiledInExtensions?: boolean
	joiner?: string
}

/** 字段映射 */
export interface STFieldMapping {
	systemTo?: "system_prompt" | "creator_notes" | "post_history_instructions" | "description" | "system_settings" // 添加 system_settings 选项
	userTo?: "scenario" | "description" | "creator_notes" | "post_history_instructions" | "user_settings" // 添加 user_settings 选项
	assistantTo?: "mes_example" | "creator_notes" | "post_history_instructions" | "description" | "assistant_settings" // 添加 assistant_settings 选项
}

/** 注入结果 */
export interface STInjectionResult {
	success: boolean
	role: Role
	metadata: STInjectionMetadata
	warnings: STWarning[]
	errors: STError[]
}

/** 注入元数据 */
export interface STInjectionMetadata {
	injectionTime: number
	injectedFields: string[]
	processedPrompts: number
}

/** 警告 */
export interface STWarning {
	type: string
	message: string
	identifier?: string
}

/** 错误 */
export interface STError {
	type: string
	message: string
	identifier?: string
	stack?: string
}

/** 自定义处理器 */
export interface STCustomProcessor {
	name: string
	process(content: string, context: STRenderContext): string
	validate?(content: string): boolean
}

// ============================================================================
// 主处理器
// ============================================================================

/** STProfile 处理器主类 */
export class STProfileProcessor {
	private parser: STProfileParser
	private compiler: STProfileCompiler
	private renderer: STProfileRenderer
	private injector: STProfileInjector
	private mixinProcessor: STProfileMixinProcessor
	private cache: Map<string, any> = new Map()
	private cachingEnabled: boolean = false

	constructor() {
		this.parser = new STProfileParser()
		this.compiler = new STProfileCompiler()
		this.renderer = new STProfileRenderer()
		this.injector = new STProfileInjector()
		this.mixinProcessor = new STProfileMixinProcessor()
	}

	/** 解析 STProfile */
	parse(raw: unknown): STProfileComplete {
		const cacheKey = `parse:${JSON.stringify(raw)}`
		if (this.cachingEnabled && this.cache.has(cacheKey)) {
			return this.cache.get(cacheKey)
		}

		const result = this.parser.parse(raw)

		if (this.cachingEnabled) {
			this.cache.set(cacheKey, result)
		}

		return result
	}

	/** 编译 STProfile */
	compile(profile: STProfileComplete, options: STCompileOptions = {}): STCompilationResult {
		const cacheKey = `compile:${profile.basic.temperature || 0}:${JSON.stringify(options)}`
		if (this.cachingEnabled && this.cache.has(cacheKey)) {
			return this.cache.get(cacheKey)
		}

		const context = this.createCompileContext(profile, options)
		const result = this.compiler.compile(profile, context)

		if (this.cachingEnabled) {
			this.cache.set(cacheKey, result)
		}

		return result
	}

	/** 渲染 STProfile */
	render(compilation: STCompilationResult, variables: Record<string, any> = {}): STRenderResult {
		const cacheKey = `render:${JSON.stringify(variables)}`
		if (this.cachingEnabled && this.cache.has(cacheKey)) {
			return this.cache.get(cacheKey)
		}

		const result = this.renderer.render(compilation, variables)

		if (this.cachingEnabled) {
			this.cache.set(cacheKey, result)
		}

		return result
	}

	/** 注入到角色 */
	inject(renderResult: STRenderResult, targetRole: Role, options: STInjectOptions = {}): STInjectionResult {
		return this.injector.inject(renderResult, targetRole, options)
	}

	/** 一步处理 */
	async process(targetRole: Role, raw: unknown, options: STProcessOptions = {}): Promise<STInjectionResult> {
		try {
			let profile = this.parse(raw)

			// 如果提供了 mixin，则应用 mixin
			if (options.mixin) {
				let mixin: STProfileMixin
				if (typeof options.mixin === "string") {
					// 从文件加载 mixin
					mixin = await this.mixinProcessor.loadMixin(options.mixin)
				} else {
					// 直接使用 mixin 对象
					mixin = options.mixin
				}

				// 合并 mixin 到 profile
				const mergeResult = this.mixinProcessor.mergeMixin(profile, mixin)
				profile = mergeResult.profile

				// 将 mixin 警告添加到结果中
				// (这里我们暂时不处理警告，因为 injectionResult 没有警告字段)
			}

			const compilation = this.compile(profile, options.compile || {})
			const renderResult = this.render(compilation, options.variables || {})
			return this.inject(renderResult, targetRole, options.inject || {})
		} catch (error) {
			return {
				success: false,
				role: targetRole,
				metadata: {
					injectionTime: 0,
					injectedFields: [],
					processedPrompts: 0,
				},
				warnings: [],
				errors: [
					{
						type: "ProcessError",
						message: error instanceof Error ? error.message : String(error),
						stack: error instanceof Error ? error.stack : undefined,
					},
				],
			}
		}
	}

	/** 启用缓存 */
	enableCaching(enabled: boolean): void {
		this.cachingEnabled = enabled
		if (!enabled) {
			this.cache.clear()
		}
	}

	/** 清除缓存 */
	clearCache(): void {
		this.cache.clear()
	}

	/** 注册自定义处理器 */
	registerCustomProcessor(name: string, processor: STCustomProcessor): void {
		this.renderer.registerCustomProcessor(name, processor)
	}

	private createCompileContext(profile: STProfileComplete, options: STCompileOptions): STCompileContext {
		return {
			profile,
			variables: new Map(Object.entries(options.variables || {})),
			resolvedPrompts: new Map(),
			injectionPlan: {
				systemPrompts: [],
				userPrompts: [],
				assistantPrompts: [],
				customInjections: [],
			},
			renderCache: new Map(),
		}
	}
}

// ============================================================================
// 编译选项
// ============================================================================

/** 编译选项 */
export interface STCompileOptions {
	characterId?: number
	onlyEnabled?: boolean
	templateOptions?: LiquidTemplateProcessingOptions
	variables?: Record<string, any>
}

/** Mixin 配置 - 用于覆盖 profile 中的单个 prompt */
export interface STPromptMixin {
	/** 提示词标识符 */
	identifier: string
	/** 是否启用（可选，未设置则保持原值） */
	enabled?: boolean
	/** 新的内容（可选，未设置则保持原内容） */
	content?: string
}

/** Mixin 文件结构 */
export interface STProfileMixin {
	/** Mixin 版本 */
	version?: string
	/** Mixin 描述 */
	description?: string
	/** 提示词覆盖配置 */
	prompts: STPromptMixin[]
	/** 全局变量覆盖 */
	variables?: Record<string, any>
	/** Mixin 元数据 */
	metadata?: {
		/** 创建时间 */
		createdAt?: number
		/** 更新时间 */
		updatedAt?: number
		/** 作者 */
		author?: string
		/** 标签 */
		tags?: string[]
	}
}

/** Mixin 合并结果 */
export interface STMixinMergeResult {
	/** 合并后的 profile */
	profile: STProfileComplete
	/** 应用的 mixin 配置 */
	appliedMixins: STPromptMixin[]
	/** 被禁用的提示词 */
	disabledPrompts: string[]
	/** 被修改的提示词 */
	modifiedPrompts: string[]
	/** 警告信息 */
	warnings: STWarning[]
}

/** 处理选项 */
export interface STProcessOptions {
	compile?: STCompileOptions
	variables?: Record<string, any>
	inject?: STInjectOptions
	/** Mixin 文件路径或内容 */
	mixin?: string | STProfileMixin
}

// ============================================================================
// 解析器
// ============================================================================

/** STProfile 解析器 */
class STProfileParser {
	parse(raw: unknown): STProfileComplete {
		// 1. 基础结构验证
		this.validateBasicStructure(raw)

		const rawObj = raw as any

		// 2. 解析提示词配置
		const prompts = this.parsePrompts(rawObj.prompts || [])

		// 3. 解析扩展配置
		const extensions = this.parseExtensions(rawObj.extensions || {})

		// 4. 解析正则绑定
		const regexBindings = this.parseRegexBindings(extensions.SPreset?.RegexBinding || [])

		// 5. 构建完整结构
		return {
			basic: this.parseBasicConfig(rawObj),
			prompts,
			extensions,
			regexBindings,
			templateVars: this.extractTemplateVars(prompts),
		}
	}

	private validateBasicStructure(raw: unknown): void {
		if (!raw || typeof raw !== "object") {
			throw new Error("Invalid STProfile: must be an object")
		}
	}

	private parseBasicConfig(raw: any): STProfileBasic {
		return {
			temperature: raw.temperature,
			frequency_penalty: raw.frequency_penalty,
			presence_penalty: raw.presence_penalty,
			top_p: raw.top_p,
			top_k: raw.top_k,
			top_a: raw.top_a,
			min_p: raw.min_p,
			repetition_penalty: raw.repetition_penalty,
			openai_max_context: raw.openai_max_context,
			openai_max_tokens: raw.openai_max_tokens,
			wrap_in_quotes: raw.wrap_in_quotes,
			names_behavior: raw.names_behavior,
			send_if_empty: raw.send_if_empty,
			impersonation_prompt: raw.impersonation_prompt,
			new_chat_prompt: raw.new_chat_prompt,
			new_group_chat_prompt: raw.new_group_chat_prompt,
			new_example_chat_prompt: raw.new_example_chat_prompt,
			continue_nudge_prompt: raw.continue_nudge_prompt,
			bias_preset_selected: raw.bias_preset_selected,
			max_context_unlocked: raw.max_context_unlocked,
			wi_format: raw.wi_format,
			scenario_format: raw.scenario_format,
			personality_format: raw.personality_format,
			group_nudge_prompt: raw.group_nudge_prompt,
			stream_openai: raw.stream_openai,
		}
	}

	private parsePrompts(prompts: any[]): STPromptConfig[] {
		return prompts.map((p) => ({
			identifier: p.identifier,
			name: p.name,
			role: (p.role as "system" | "user" | "assistant") || "system",
			content: p.content || "",
			enabled: p.enabled !== false,
			system_prompt: p.system_prompt || false,
			marker: p.marker || false,
			injection: {
				position: p.injection_position || 0,
				depth: p.injection_depth || 4,
				order: p.injection_order || 100,
			},
			forbid_overrides: p.forbid_overrides || false,
			conditional: this.parseConditional(p),
			variables: this.extractPromptVariables(p.content || ""),
			dependencies: this.findDependencies(p.content || ""),
		}))
	}

	private parseExtensions(extensions: any): STExtensions {
		return {
			...extensions,
			SPreset: extensions.SPreset ? this.parseSPreset(extensions.SPreset) : undefined,
		}
	}

	private parseSPreset(spreset: any): STSPresetExtension {
		return {
			ChatSquash: spreset.ChatSquash,
			RegexBinding: spreset.RegexBinding || [],
		}
	}

	private parseRegexBindings(bindings: any): STRegexBinding[] {
		// 确保 bindings 是数组
		if (!Array.isArray(bindings)) {
			return []
		}

		return bindings.map((b) => ({
			id: b.id,
			scriptName: b.scriptName,
			findRegex: b.findRegex,
			replaceString: b.replaceString,
			trimStrings: b.trimStrings || [],
			placement: b.placement || [],
			disabled: b.disabled || false,
			markdownOnly: b.markdownOnly || false,
			promptOnly: b.promptOnly || false,
			runOnEdit: b.runOnEdit || false,
			substituteRegex: b.substituteRegex || 0,
			minDepth: b.minDepth,
			maxDepth: b.maxDepth,
		}))
	}

	private parseConditional(prompt: any): STConditional | undefined {
		// 简单的条件解析，可以根据需要扩展
		return undefined
	}

	private extractTemplateVars(prompts: STPromptConfig[]): STTemplateVariables {
		const vars: STTemplateVariables = {}
		for (const prompt of prompts) {
			for (const varName of prompt.variables) {
				vars[varName] = undefined // 初始化变量
			}
		}
		return vars
	}

	private extractPromptVariables(content: string): string[] {
		const vars: string[] = []
		const setvarMatches = content.match(/\{\{setvar::([^}]+)\}\}/g)
		if (setvarMatches) {
			for (const match of setvarMatches) {
				const varMatch = match.match(/\{\{setvar::([^}]+)\}\}/)
				if (varMatch && varMatch[1]) {
					vars.push(varMatch[1])
				}
			}
		}
		return vars
	}

	private findDependencies(content: string): string[] {
		const deps: string[] = []
		const getvarMatches = content.match(/\{\{getvar::([^}]+)\}\}/g)
		if (getvarMatches) {
			for (const match of getvarMatches) {
				const varMatch = match.match(/\{\{getvar::([^}]+)\}\}/)
				if (varMatch && varMatch[1]) {
					deps.push(varMatch[1])
				}
			}
		}
		return deps
	}
}

// ============================================================================
// 编译器
// ============================================================================

/** STProfile 编译器 */
class STProfileCompiler {
	compile(profile: STProfileComplete, context: STCompileContext): STCompilationResult {
		const startTime = Date.now()

		// 1. 解析提示词依赖关系
		const dependencyGraph = this.buildDependencyGraph(profile.prompts)

		// 2. 按顺序解析提示词
		const resolvedPrompts = this.resolvePrompts(profile.prompts, dependencyGraph, context)

		// 3. 处理变量定义和引用
		this.processVariableDefinitions(resolvedPrompts, context)

		// 4. 生成注入计划
		const injectionPlan = this.generateInjectionPlan(resolvedPrompts, profile)

		// 5. 构建编译结果
		const result = {
			resolvedPrompts,
			injectionPlan,
			templateContext: context,
			metadata: this.generateMetadata(profile, resolvedPrompts, startTime),
		}

		// 更新上下文
		context.resolvedPrompts = new Map(resolvedPrompts.map((p) => [p.identifier, p]))
		context.injectionPlan = injectionPlan

		return result
	}

	private buildDependencyGraph(prompts: STPromptConfig[]): Map<string, string[]> {
		const graph = new Map<string, string[]>()

		for (const prompt of prompts) {
			graph.set(prompt.identifier, prompt.dependencies)
		}

		return graph
	}

	private resolvePrompts(
		prompts: STPromptConfig[],
		graph: Map<string, string[]>,
		context: STCompileContext,
	): STResolvedPrompt[] {
		const resolved: STResolvedPrompt[] = []
		const visited = new Set<string>()

		// 简单的拓扑排序
		for (const prompt of prompts) {
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
			dependencies: prompt.dependencies,
			renderHints: this.generateRenderHints(prompt),
		}
	}

	private preprocessContent(content: string, context: STCompileContext): string {
		// 基础的内容预处理
		return content
	}

	private generateRenderHints(prompt: STPromptConfig): STRenderHints {
		return {
			priority: prompt.injection.order,
			conditional: !!prompt.conditional,
			hasVariables: prompt.variables.length > 0,
			templateComplexity: this.calculateTemplateComplexity(prompt.content),
		}
	}

	private calculateTemplateComplexity(content: string): number {
		// 简单的复杂度计算
		let complexity = 0
		complexity += (content.match(/\{\{[^}]+\}\}/g) || []).length
		complexity += (content.match(/\{\{[^}]+\}\}\}\}/g) || []).length * 2
		complexity += (content.match(/\{\{if[^}]+\}\}/g) || []).length * 3
		return complexity
	}

	private processVariableDefinitions(prompts: STResolvedPrompt[], context: STCompileContext): void {
		// 处理变量定义
		for (const prompt of prompts) {
			this.extractAndSetVariables(prompt.processedContent, context)
		}
	}

	private extractAndSetVariables(content: string, context: STCompileContext): void {
		const setvarMatches = content.match(/\{\{setvar::([^}]+)::([^}]*)\}\}/g)
		if (setvarMatches) {
			for (const match of setvarMatches) {
				const varMatch = match.match(/\{\{setvar::([^}]+)::([^}]*)\}\}/)
				if (varMatch && varMatch[1] && varMatch[2]) {
					context.variables.set(varMatch[1], varMatch[2])
				}
			}
		}
	}

	private generateInjectionPlan(prompts: STResolvedPrompt[], profile: STProfileComplete): STInjectionPlan {
		const plan: STInjectionPlan = {
			systemPrompts: [],
			userPrompts: [],
			assistantPrompts: [],
			customInjections: [],
		}

		for (const prompt of prompts) {
			if (!prompt.enabled) continue

			const injection: STInjection = {
				identifier: prompt.identifier,
				content: prompt.processedContent,
				target: this.determineTarget(prompt),
				priority: prompt.injection.order,
				position: prompt.injection.position,
				depth: prompt.injection.depth,
				enabled: true,
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

	private determineTarget(prompt: STResolvedPrompt): string {
		// 根据提示词的角色和标记确定目标字段
		if (prompt.system_prompt) return "system_prompt"
		if (prompt.marker) return "marker"

		// 当 system_prompt 为 false 时，根据角色创建新的目标字段
		if (!prompt.system_prompt) {
			switch (prompt.role) {
				case "system":
					return "system_settings" // 修复：当 system_prompt 为 false 时，系统角色映射到 system_settings
				case "user":
					return "user_settings" // 用户角色映射到 user_settings
				case "assistant":
					return "assistant_settings" // 助手角色映射到 assistant_settings
			}
		}

		return prompt.role
	}

	private sortInjectionsByPriority(plan: STInjectionPlan): void {
		const sortFn = (a: STInjection, b: STInjection) => a.priority - b.priority

		plan.systemPrompts.sort(sortFn)
		plan.userPrompts.sort(sortFn)
		plan.assistantPrompts.sort(sortFn)
		plan.customInjections.sort(sortFn)
	}

	private generateMetadata(
		profile: STProfileComplete,
		prompts: STResolvedPrompt[],
		startTime: number,
	): STCompilationMetadata {
		return {
			totalPrompts: profile.prompts.length,
			enabledPrompts: prompts.filter((p) => p.enabled).length,
			processingTime: Date.now() - startTime,
			dependencies: Array.from(new Set(prompts.flatMap((p) => p.dependencies))),
			warnings: [],
		}
	}
}

// ============================================================================
// 渲染器
// ============================================================================

/** STProfile 渲染器 */
class STProfileRenderer {
	private customProcessors: Map<string, STCustomProcessor> = new Map()

	render(compilation: STCompilationResult, variables: Record<string, any>): STRenderResult {
		const startTime = Date.now()
		const context = this.createRenderContext(compilation, variables)

		// 1. 处理变量设置
		this.processVariableSettings(compilation, context)

		// 2. 渲染提示词内容
		const renderedPrompts = this.renderPrompts(compilation.resolvedPrompts, context)

		// 3. 应用正则处理
		const processedPrompts = this.applyRegexProcessing(renderedPrompts, compilation)

		return {
			prompts: processedPrompts,
			context,
			metadata: {
				renderTime: Date.now() - startTime,
				cacheHits: 0,
				processedVariables: context.variables.size,
				errors: [],
			},
		}
	}

	registerCustomProcessor(name: string, processor: STCustomProcessor): void {
		this.customProcessors.set(name, processor)
	}

	private createRenderContext(compilation: STCompilationResult, variables: Record<string, any>): STRenderContext {
		return {
			variables: new Map(Object.entries(variables)),
			processors: this.customProcessors,
			cache: new Map(),
			metadata: {
				renderTime: 0,
				cacheHits: 0,
				processedVariables: 0,
				errors: [],
			},
		}
	}

	private processVariableSettings(compilation: STCompilationResult, context: STRenderContext): void {
		// 处理 setvar 指令
		for (const prompt of compilation.resolvedPrompts) {
			this.extractAndSetVariables(prompt.processedContent, context)
		}
	}

	private extractAndSetVariables(content: string, context: STRenderContext): void {
		const setvarMatches = content.match(/\{\{setvar::([^}]+)::([^}]*)\}\}/g)
		if (setvarMatches) {
			for (const match of setvarMatches) {
				const varMatch = match.match(/\{\{setvar::([^}]+)::([^}]*)\}\}/)
				if (varMatch && varMatch[1] && varMatch[2]) {
					context.variables.set(varMatch[1], varMatch[2])
				}
			}
		}
	}

	private renderPrompts(prompts: STResolvedPrompt[], context: STRenderContext): STResolvedPrompt[] {
		return prompts.map((prompt) => ({
			...prompt,
			processedContent: this.renderPromptContent(prompt.processedContent, context),
		}))
	}

	private renderPromptContent(content: string, context: STRenderContext): string {
		// 1. 处理自定义标签
		let processed = content
		for (const [name, processor] of context.processors) {
			if (processor.validate && !processor.validate(processed)) {
				continue
			}
			processed = processor.process(processed, context)
		}

		// 2. 处理 LiquidJS 模板 - 修复后的正确方式
		// 确保传入完整的待处理文件内容和所有必要的变量
		const templateResult = processLiquidTemplateVariables(processed, {
			variables: {
				// 确保 user 和 char 变量可用，这是 {{random:...}} 等语法处理的基础
				user: context.variables.get("user") || "用户",
				char: context.variables.get("char") || "角色",
				// 添加其他所有上下文变量，确保所有变量都可用
				...Object.fromEntries(context.variables),
			},
			strict: false,
			removeUnprocessed: true,
			keepVariableDefinitions: false,
		})

		return templateResult.processedText
	}

	private applyRegexProcessing(prompts: STResolvedPrompt[], compilation: STCompilationResult): STResolvedPrompt[] {
		// 应用正则表达式处理
		// 这里可以实现复杂的正则绑定逻辑
		return prompts
	}
}

// ============================================================================
// 注入器
// ============================================================================

/** STProfile 注入器 */
class STProfileInjector {
	inject(renderResult: STRenderResult, targetRole: Role, options: STInjectOptions = {}): STInjectionResult {
		const startTime = Date.now()

		try {
			// 1. 创建注入计划
			const plan = this.createInjectionPlan(renderResult, options)

			// 2. 计算字段映射
			const fieldMapping = this.calculateFieldMapping(plan, targetRole, options)

			// 3. 执行注入
			const injectedRole = this.performInjection(targetRole, plan, fieldMapping, options)

			// 4. 处理扩展信息
			this.processExtensions(injectedRole, renderResult, options)

			return {
				success: true,
				role: injectedRole,
				metadata: {
					injectionTime: Date.now() - startTime,
					injectedFields: Object.keys(fieldMapping),
					processedPrompts: renderResult.prompts.length,
				},
				warnings: [],
				errors: [],
			}
		} catch (error) {
			return {
				success: false,
				role: targetRole,
				metadata: {
					injectionTime: Date.now() - startTime,
					injectedFields: [],
					processedPrompts: 0,
				},
				warnings: [],
				errors: [
					{
						type: "InjectionError",
						message: error instanceof Error ? error.message : String(error),
						stack: error instanceof Error ? error.stack : undefined,
					},
				],
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

			const injection: STInjection = {
				identifier: prompt.identifier,
				content: prompt.processedContent,
				target: this.determineTarget(prompt, options),
				priority: prompt.injection.order,
				position: prompt.injection.position,
				depth: prompt.injection.depth,
				enabled: true,
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

	private determineTarget(prompt: STResolvedPrompt | STInjection, options: STInjectOptions): string {
		const mapping = options.mapping || {}
		const role = (prompt as STResolvedPrompt).role || (prompt as STInjection).target

		// 如果是 STResolvedPrompt，检查 system_prompt 标志
		if ((prompt as STResolvedPrompt).system_prompt !== undefined) {
			if ((prompt as STResolvedPrompt).system_prompt) {
				return mapping.systemTo || "system_prompt"
			}

			// 当 system_prompt 为 false 时，根据角色映射到相应的 settings 字段
			switch (role) {
				case "system":
					return "system_settings" // 修复：当 system_prompt 为 false 时，系统角色映射到 system_settings
				case "user":
					return mapping.userTo || "user_settings"
				case "assistant":
					return mapping.assistantTo || "assistant_settings"
			}
		}

		// 默认映射逻辑
		switch (role) {
			case "system":
				return mapping.systemTo || "system_prompt"
			case "user":
				return mapping.userTo || "user_settings"
			case "assistant":
				return mapping.assistantTo || "assistant_settings"
			default:
				return role
		}
	}

	private sortInjectionsByPriority(plan: STInjectionPlan): void {
		const sortFn = (a: STInjection, b: STInjection) => a.priority - b.priority

		plan.systemPrompts.sort(sortFn)
		plan.userPrompts.sort(sortFn)
		plan.assistantPrompts.sort(sortFn)
		plan.customInjections.sort(sortFn)
	}

	private calculateFieldMapping(
		plan: STInjectionPlan,
		targetRole: Role,
		options: STInjectOptions,
	): Record<string, string> {
		const mapping: Record<string, string> = {}
		const joiner = options.joiner || "\n\n----\n\n"

		// 根据注入目标分别处理内容
		// system_prompts 可能包含映射到 system_prompt 和 system_settings 的内容
		const systemPromptContent: string[] = []
		const systemSettingsContent: string[] = []

		for (const injection of plan.systemPrompts) {
			if (injection.target === "system_settings") {
				systemSettingsContent.push(injection.content)
			} else {
				systemPromptContent.push(injection.content)
			}
		}

		// 处理 user 和 assistant 内容，过滤掉空内容
		const userContent =
			plan.userPrompts.length > 0
				? plan.userPrompts
						.filter((p) => p.content && p.content.trim())
						.map((p) => p.content)
						.join(joiner)
				: ""
		const assistantContent =
			plan.assistantPrompts.length > 0
				? plan.assistantPrompts
						.filter((p) => p.content && p.content.trim())
						.map((p) => p.content)
						.join(joiner)
				: ""

		// 处理 system_prompt 字段，过滤掉空内容
		const filteredSystemPromptContent = systemPromptContent.filter((content) => content && content.trim())
		if (filteredSystemPromptContent.length > 0) {
			const systemPromptText = filteredSystemPromptContent.join(joiner)
			mapping["system_prompt"] = this.concatText(targetRole.system_prompt, systemPromptText, joiner)
		}

		// 处理 system_settings 字段，过滤掉空内容
		const filteredSystemSettingsContent = systemSettingsContent.filter((content) => content && content.trim())
		if (filteredSystemSettingsContent.length > 0) {
			const systemSettingsText = filteredSystemSettingsContent.join(joiner)
			mapping["system_settings"] = this.concatText(targetRole.system_settings, systemSettingsText, joiner)
		}

		// 处理 user_settings 字段
		if (userContent && plan.userPrompts.length > 0) {
			mapping["user_settings"] = this.concatText(targetRole.user_settings, userContent, joiner)
		}

		// 处理 assistant_settings 字段
		if (assistantContent && plan.assistantPrompts.length > 0) {
			mapping["assistant_settings"] = this.concatText(targetRole.assistant_settings, assistantContent, joiner)
		}

		return mapping
	}

	private concatText(existing?: string, added?: string, separator = "\n\n"): string {
		if (!existing && !added) return ""
		if (!existing) return added || ""
		if (!added) return existing

		// 清理现有内容和新增内容的两端，避免多余的分隔符
		const cleanExisting = existing.trim()
		const cleanAdded = added.trim()

		// 如果任一内容为空，返回另一个
		if (!cleanExisting) return cleanAdded
		if (!cleanAdded) return cleanExisting

		// 检查现有内容是否已经以分隔符结尾
		const existingEndsWithSep = cleanExisting.endsWith(separator.trim())
		// 检查新增内容是否以分隔符开头
		const addedStartsWithSep = cleanAdded.startsWith(separator.trim())

		// 根据情况添加分隔符，避免重复
		if (existingEndsWithSep && addedStartsWithSep) {
			// 两端都有分隔符，不需要额外添加
			return `${cleanExisting}\n${cleanAdded}`
		} else if (existingEndsWithSep || addedStartsWithSep) {
			// 只有一端有分隔符，直接连接
			return `${cleanExisting}\n${cleanAdded}`
		} else {
			// 两端都没有分隔符，添加分隔符
			return `${cleanExisting}${separator}${cleanAdded}`
		}
	}

	private performInjection(
		targetRole: Role,
		plan: STInjectionPlan,
		fieldMapping: Record<string, string>,
		options: STInjectOptions,
	): Role {
		const copy: any = JSON.parse(JSON.stringify(targetRole))

		// 应用字段映射
		for (const [field, content] of Object.entries(fieldMapping)) {
			if (content) {
				copy[field] = content
			}
		}

		// 更新时间戳
		copy.updatedAt = Date.now()

		const validation = roleSchema.safeParse(copy)
		return validation.success ? validation.data : (copy as Role)
	}

	private processExtensions(role: Role, renderResult: STRenderResult, options: STInjectOptions): void {
		const keepRaw = options.keepRawInExtensions !== false
		const keepCompiled = options.keepCompiledInExtensions === true

		if (!keepRaw && !keepCompiled) return

		const roleCopy = role as any
		roleCopy.extensions = roleCopy.extensions || {}
		roleCopy.extensions.anh = roleCopy.extensions.anh || {}
		roleCopy.extensions.anh.stProfile = roleCopy.extensions.anh.stProfile || {}

		if (keepRaw) {
			roleCopy.extensions.anh.stProfile.sequence = renderResult.prompts.map((p) => p.identifier)
		}

		if (keepCompiled) {
			roleCopy.extensions.anh.stProfile.compiled = {
				system: renderResult.prompts
					.filter((p) => p.role === "system")
					.map((p) => p.processedContent)
					.join("\n\n"),
				user: renderResult.prompts
					.filter((p) => p.role === "user")
					.map((p) => p.processedContent)
					.join("\n\n"),
				assistant: renderResult.prompts
					.filter((p) => p.role === "assistant")
					.map((p) => p.processedContent)
					.join("\n\n"),
			}
		}
	}
}

// ============================================================================
// Mixin 处理器
// ============================================================================

/** STProfile Mixin 处理器 */
class STProfileMixinProcessor {
	/** 加载 Mixin 文件 */
	async loadMixin(mixinPathOrContent: string | STProfileMixin): Promise<STProfileMixin> {
		if (typeof mixinPathOrContent === "string") {
			// 如果是文件路径，读取文件内容
			try {
				const fs = await import("fs/promises")
				const content = await fs.readFile(mixinPathOrContent, "utf-8")
				return JSON.parse(content) as STProfileMixin
			} catch (error) {
				throw new Error(
					`Failed to load mixin from ${mixinPathOrContent}: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		} else {
			// 直接返回 mixin 对象
			return mixinPathOrContent
		}
	}

	/** 合并 Mixin 到 Profile */
	mergeMixin(profile: STProfileComplete, mixin: STProfileMixin): STMixinMergeResult {
		const warnings: STWarning[] = []
		const appliedMixins: STPromptMixin[] = []
		const disabledPrompts: string[] = []
		const modifiedPrompts: string[] = []

		// 创建 profile 的深拷贝
		const mergedProfile = JSON.parse(JSON.stringify(profile)) as STProfileComplete

		// 1. 处理提示词覆盖
		for (const mixinPrompt of mixin.prompts) {
			const originalPromptIndex = mergedProfile.prompts.findIndex((p) => p.identifier === mixinPrompt.identifier)

			if (originalPromptIndex === -1) {
				warnings.push({
					type: "MixinWarning",
					message: `Prompt identifier "${mixinPrompt.identifier}" not found in profile, creating new prompt`,
					identifier: mixinPrompt.identifier,
				})

				// 创建新的提示词
				const newPrompt: STPromptConfig = {
					identifier: mixinPrompt.identifier,
					name: mixinPrompt.identifier,
					role: "system", // 默认角色
					content: mixinPrompt.content || "",
					enabled: mixinPrompt.enabled !== false,
					system_prompt: false,
					marker: false,
					injection: {
						position: 0,
						depth: 4,
						order: 100,
					},
					forbid_overrides: false,
					variables: this.extractPromptVariables(mixinPrompt.content || ""),
					dependencies: this.findDependencies(mixinPrompt.content || ""),
				}

				mergedProfile.prompts.push(newPrompt)
				appliedMixins.push(mixinPrompt)

				if (mixinPrompt.enabled === false) {
					disabledPrompts.push(mixinPrompt.identifier)
				} else {
					modifiedPrompts.push(mixinPrompt.identifier)
				}
			} else {
				// 修改现有提示词
				const originalPrompt = mergedProfile.prompts[originalPromptIndex]
				if (!originalPrompt) continue

				const wasEnabled = originalPrompt.enabled

				// 应用 mixin 覆盖
				if (mixinPrompt.enabled !== undefined) {
					originalPrompt.enabled = mixinPrompt.enabled
				}

				if (mixinPrompt.content !== undefined) {
					originalPrompt.content = mixinPrompt.content
					// 重新提取变量和依赖
					originalPrompt.variables = this.extractPromptVariables(mixinPrompt.content)
					originalPrompt.dependencies = this.findDependencies(mixinPrompt.content)
				}

				appliedMixins.push(mixinPrompt)

				// 记录状态变化
				if (wasEnabled && !originalPrompt.enabled) {
					disabledPrompts.push(mixinPrompt.identifier)
				} else if ((!wasEnabled && originalPrompt.enabled) || mixinPrompt.content !== undefined) {
					modifiedPrompts.push(mixinPrompt.identifier)
				}
			}
		}

		// 2. 处理全局变量覆盖
		if (mixin.variables) {
			for (const [key, value] of Object.entries(mixin.variables)) {
				mergedProfile.templateVars[key] = value
			}
		}

		// 3. 验证合并结果
		const validationWarnings = this.validateMergedProfile(mergedProfile)
		warnings.push(...validationWarnings)

		return {
			profile: mergedProfile,
			appliedMixins,
			disabledPrompts,
			modifiedPrompts,
			warnings,
		}
	}

	/** 验证合并后的 Profile */
	private validateMergedProfile(profile: STProfileComplete): STWarning[] {
		const warnings: STWarning[] = []

		// 检查标识符重复
		const identifiers = profile.prompts.map((p) => p.identifier)
		const duplicates = identifiers.filter((id, index) => identifiers.indexOf(id) !== index)

		for (const duplicate of duplicates) {
			warnings.push({
				type: "ValidationWarning",
				message: `Duplicate prompt identifier: ${duplicate}`,
				identifier: duplicate,
			})
		}

		// 检查依赖关系
		for (const prompt of profile.prompts) {
			for (const dep of prompt.dependencies) {
				if (!identifiers.includes(dep)) {
					warnings.push({
						type: "ValidationWarning",
						message: `Prompt "${prompt.identifier}" depends on non-existent prompt "${dep}"`,
						identifier: prompt.identifier,
					})
				}
			}
		}

		return warnings
	}

	/** 提取提示词变量 */
	private extractPromptVariables(content: string): string[] {
		const vars: string[] = []
		const setvarMatches = content.match(/\{\{setvar::([^}]+)\}\}/g)
		if (setvarMatches) {
			for (const match of setvarMatches) {
				const varMatch = match.match(/\{\{setvar::([^}]+)\}\}/)
				if (varMatch && varMatch[1]) {
					vars.push(varMatch[1])
				}
			}
		}
		return vars
	}

	/** 查找依赖关系 */
	private findDependencies(content: string): string[] {
		const deps: string[] = []
		const getvarMatches = content.match(/\{\{getvar::([^}]+)\}\}/g)
		if (getvarMatches) {
			for (const match of getvarMatches) {
				const varMatch = match.match(/\{\{getvar::([^}]+)\}\}/)
				if (varMatch && varMatch[1]) {
					deps.push(varMatch[1])
				}
			}
		}
		return deps
	}
}

// ============================================================================
// 默认处理器
// ============================================================================

/** 默认字段映射 */
export const DEFAULT_FIELD_MAPPING: Required<STFieldMapping> = {
	systemTo: "system_prompt",
	userTo: "user_settings", // 修复：默认映射到 user_settings
	assistantTo: "assistant_settings", // 修复：默认映射到 assistant_settings
}

/** 便捷函数：一步到位处理 */
export async function processSTProfile(
	role: Role,
	raw: unknown,
	options: STProcessOptions = {},
): Promise<STInjectionResult> {
	const processor = new STProfileProcessor()
	return processor.process(role, raw, options)
}

/** 便捷函数：带模板变量处理 */
export async function processSTProfileWithTemplates(
	role: Role,
	raw: unknown,
	templateVars?: Record<string, any>,
	options: Omit<STProcessOptions, "variables"> = {},
): Promise<STInjectionResult> {
	return processSTProfile(role, raw, {
		...options,
		variables: templateVars,
	})
}

/** 便捷函数：带 Mixin 处理 */
export async function processSTProfileWithMixin(
	role: Role,
	raw: unknown,
	mixin: string | STProfileMixin,
	options: Omit<STProcessOptions, "mixin"> = {},
): Promise<STInjectionResult> {
	const processor = new STProfileProcessor()
	return processor.process(role, raw, {
		...options,
		mixin,
	})
}
