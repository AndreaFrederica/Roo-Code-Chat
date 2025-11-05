/**
 * Enhanced Regex Processor Service
 *
 * 提供完整的正则表达式处理功能，包括：
 * - 多阶段执行（pre-ast, post-ast, output）
 * - 分组捕获和替换
 * - 函数式替换
 * - 优先级排序
 * - 依赖关系检查
 */

import { RegexRule } from "../shared/builtin-regex-rules"

export type ProcessStage = "pre-ast" | "post-ast" | "output"

export interface ProcessContext {
	stage: ProcessStage
	rulesEnabled: Record<string, boolean>
	rulesConfig: Record<string, any>
	variables?: Record<string, any>
}

export interface ProcessingResult {
	text: string
	appliedRules: Array<{
		ruleId: string
		stage: ProcessStage
		matchCount: number
	}>
}

export interface ReplacementFunction {
	(match: string, ...groups: string[]): string
}

/**
 * 增强的正则处理器
 */
export class RegexProcessorService {
	private static instance: RegexProcessorService
	private replacementFunctions: Map<string, ReplacementFunction> = new Map()

	private constructor() {
		this.registerBuiltinFunctions()
	}

	public static getInstance(): RegexProcessorService {
		if (!RegexProcessorService.instance) {
			RegexProcessorService.instance = new RegexProcessorService()
		}
		return RegexProcessorService.instance
	}

	/**
	 * 注册替换函数
	 */
	public registerReplacementFunction(name: string, fn: ReplacementFunction): void {
		this.replacementFunctions.set(name, fn)
	}

	/**
	 * 获取替换函数
	 */
	public getReplacementFunction(name: string): ReplacementFunction | undefined {
		return this.replacementFunctions.get(name)
	}

	/**
	 * 处理文本
	 */
	public processText(text: string, rules: Record<string, RegexRule>, context: ProcessContext): ProcessingResult {
		const appliedRules: Array<{ ruleId: string; stage: ProcessStage; matchCount: number }> = []
		let processedText = text

		// 按优先级和阶段过滤规则
		const filteredRules = this.filterRulesByStage(rules, context.stage)
		const sortedRules = this.sortRulesByPriority(filteredRules)

		// 检查依赖关系
		const validRules = this.validateDependencies(sortedRules, context.rulesEnabled)

		for (const [key, rule] of validRules) {
			if (!context.rulesEnabled[rule.id]) {
				continue
			}

			try {
				const result = this.applyRule(processedText, rule, context)
				if (result.changed) {
					processedText = result.text
					appliedRules.push({
						ruleId: rule.id,
						stage: context.stage,
						matchCount: result.matchCount,
					})
				}
			} catch (error) {
				console.warn(`Failed to apply regex rule ${key}:`, error)
			}
		}

		return {
			text: processedText,
			appliedRules,
		}
	}

	/**
	 * 应用单个规则
	 */
	private applyRule(
		text: string,
		rule: RegexRule,
		context: ProcessContext,
	): { text: string; changed: boolean; matchCount: number } {
		const regex = new RegExp(rule.pattern, rule.flags || "g")
		let matchCount = 0
		let changed = false

		if (rule.replacementFunction) {
			// 使用函数式替换
			const fn = this.getReplacementFunction(rule.replacementFunction)
			if (!fn) {
				console.warn(`Replacement function '${rule.replacementFunction}' not found for rule ${rule.id}`)
				return { text, changed: false, matchCount: 0 }
			}

			const result = text.replace(regex, (...args) => {
				matchCount++
				return fn.apply(null, args)
			})

			return { text: result, changed: result !== text, matchCount }
		}

		if (rule.replacement) {
			if (typeof rule.replacement === "function") {
				// 直接函数替换
				const result = text.replace(regex, rule.replacement)
				return { text: result, changed: result !== text, matchCount: 0 }
			} else {
				// 字符串替换（支持分组）
				const result = text.replace(regex, rule.replacement)
				matchCount = (text.match(regex) || []).length
				return { text: result, changed: result !== text, matchCount }
			}
		}

		// 只匹配，不替换 - 记录匹配数量
		const matches = text.match(regex)
		matchCount = matches ? matches.length : 0

		return { text, changed: false, matchCount }
	}

	/**
	 * 按阶段过滤规则
	 */
	private filterRulesByStage(rules: Record<string, RegexRule>, stage: ProcessStage): Record<string, RegexRule> {
		const filtered: Record<string, RegexRule> = {}

		for (const [key, rule] of Object.entries(rules)) {
			// 如果规则没有指定阶段，默认为 pre-ast
			const ruleStage = rule.stage || "pre-ast"
			if (ruleStage === stage) {
				filtered[key] = rule
			}
		}

		return filtered
	}

	/**
	 * 按优先级排序规则
	 */
	private sortRulesByPriority(rules: Record<string, RegexRule>): Array<[string, RegexRule]> {
		return Object.entries(rules).sort(([, a], [, b]) => {
			const priorityA = a.priority ?? 50
			const priorityB = b.priority ?? 50
			return priorityA - priorityB
		})
	}

	/**
	 * 验证依赖关系
	 */
	private validateDependencies(
		rules: Array<[string, RegexRule]>,
		enabledRules: Record<string, boolean>,
	): Array<[string, RegexRule]> {
		return rules.filter(([, rule]) => {
			if (!rule.dependsOn || rule.dependsOn.length === 0) {
				return true
			}

			return rule.dependsOn.every((dep) => enabledRules[dep])
		})
	}

	/**
	 * 注册内置函数
	 */
	private registerBuiltinFunctions(): void {
		// 时间戳注入
		this.registerReplacementFunction("timestamp", () => {
			return new Date().toISOString()
		})

		// 日期格式化
		this.registerReplacementFunction("dateformat", (match, format) => {
			try {
				return new Date().toLocaleDateString(undefined, {
					year: "numeric",
					month: "2-digit",
					day: "2-digit",
					...(format ? { dateStyle: format as any } : {}),
				})
			} catch {
				return match
			}
		})

		// 变量替换
		this.registerReplacementFunction("variable", (match, varName) => {
			// 这里可以从context中获取变量值
			return match // 暂时返回原值
		})

		// 引用标记转换
		this.registerReplacementFunction("citation", (match, citationKey) => {
			return `[${citationKey}]`
		})

		// 脚注引用
		this.registerReplacementFunction("footnoteRef", (match, footnoteNum) => {
			return `<sup>[${footnoteNum}]</sup>`
		})

		// 链接规范化
		this.registerReplacementFunction("normalizeLink", (match, text, url) => {
			// 清理和验证链接
			const cleanUrl = url.trim()
			const cleanText = text.trim()

			if (!cleanUrl) {
				return match // 保留破损链接用于检测
			}

			return `[${cleanText}](${cleanUrl})`
		})

		// 智能引号转换
		this.registerReplacementFunction("smartQuotes", (match, content) => {
			return `"${content}"`
		})

		// 代码块保护（已在useMarkdownProcessor中实现，但这里提供更完整的版本）
		this.registerReplacementFunction("protectCodeBlock", (match, code) => {
			return `\u0000__CODE_BLOCK__${code}\u0000`
		})

		// 行内代码保护
		this.registerReplacementFunction("protectInlineCode", (match, code) => {
			return `\u0000__INLINE_CODE__${code}\u0000`
		})

		// 标题ID生成
		this.registerReplacementFunction("headingId", (match, level, text) => {
			const id = text
				.toLowerCase()
				.replace(/[^\w\s-]/g, "")
				.replace(/\s+/g, "-")
			return `${level} ${text} {#${id}}`
		})

		// 表情符号短代码
		this.registerReplacementFunction("emoji", (match, emojiName) => {
			// 简单的emoji映射
			const emojiMap: Record<string, string> = {
				smiley: "😊",
				thumbsup: "👍",
				warning: "⚠️",
				info: "ℹ️",
				check: "✅",
				x: "❌",
			}
			return emojiMap[emojiName.toLowerCase()] || match
		})
	}

	/**
	 * 获取函数列表
	 */
	public getRegisteredFunctions(): string[] {
		return Array.from(this.replacementFunctions.keys())
	}

	/**
	 * 清除函数
	 */
	public clearFunctions(): void {
		this.replacementFunctions.clear()
		this.registerBuiltinFunctions()
	}
}
