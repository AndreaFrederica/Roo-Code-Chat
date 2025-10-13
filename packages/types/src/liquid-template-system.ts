import { Liquid } from "liquidjs"

/**
 * 模板处理选项
 */
export interface LiquidTemplateProcessingOptions {
	/** 严格模式 - 未定义变量会抛出错误 */
	strict?: boolean
	/** 移除未处理的模板 */
	removeUnprocessed?: boolean
	/** 预定义变量 */
	variables?: Record<string, any>
	/** 保留变量定义（不移除 {{setvar::}} 等） */
	keepVariableDefinitions?: boolean
	/** 最大递归深度 */
	maxRecursionDepth?: number
	/** LiquidJS 配置选项 */
	liquidOptions?: {
		/** 是否启用严格模式 */
		strict?: boolean
		/** 自定义过滤器 */
		filters?: Record<string, (...args: any[]) => any>
		/** 自定义标签 */
		tags?: Record<string, (...args: any[]) => any>
	}
}

/**
 * 模板变量信息
 */
export interface LiquidTemplateVariable {
	name: string
	value: string
	type: "variable" | "output" | "comment"
	line?: number
	source?: string
}

/**
 * 模板处理结果
 */
export interface LiquidTemplateProcessingResult {
	/** 处理后的文本 */
	processedText: string
	/** 所有找到的变量 */
	variables: LiquidTemplateVariable[]
	/** 设置的变量（通过 set 标签） */
	setVariables: Record<string, string>
	/** 使用的变量 */
	usedVariables: string[]
	/** 未处理的模板（如果有的话） */
	unprocessedTemplates: string[]
	/** 处理错误 */
	errors: string[]
	/** 警告 */
	warnings: string[]
	/** 统计信息 */
	stats: {
		totalTemplates: number
		processedTemplates: number
		variableCount: number
		outputCount: number
		commentCount: number
	}
}

/**
 * 基于 LiquidJS 的模板处理器
 */
export class LiquidTemplateProcessor {
	private liquid: Liquid
	private options: Required<LiquidTemplateProcessingOptions>
	private defaultVariables: Record<string, any>

	constructor(options: LiquidTemplateProcessingOptions = {}) {
		this.options = {
			strict: false,
			removeUnprocessed: false,
			variables: {},
			keepVariableDefinitions: false,
			maxRecursionDepth: 10,
			liquidOptions: {
				strict: false,
				filters: {},
				tags: {},
			},
			...options,
		}

		// 初始化 LiquidJS 引擎
		this.liquid = new Liquid()

		// 设置默认变量
		this.defaultVariables = this.createDefaultVariables()

		// 合并用户变量
		const allVariables = { ...this.defaultVariables, ...this.options.variables }

		// 添加变量到 LiquidJS 上下文
		this.setupLiquidVariables(allVariables)
	}

	/**
	 * 创建默认变量
	 */
	private createDefaultVariables(): Record<string, any> {
		const now = new Date()
		return {
			user: "用户",
			char: "角色",
			isodate: now.toISOString().split("T")[0],
			isotime: now.toTimeString().split(" ")[0],
			idle_duration: "5分钟",
			lastUserMessage: "(上一条消息)",
		}
	}

	/**
	 * 设置 LiquidJS 变量和过滤器
	 */
	private setupLiquidVariables(variables: Record<string, any>): void {
		// 添加自定义过滤器
		this.liquid.registerFilter("date", (value: string | Date, format = "YYYY-MM-DD") => {
			if (typeof value === "string") {
				value = new Date(value)
			}
			// 简单的日期格式化
			if (format === "YYYY-MM-DD") {
				return value.toISOString().split("T")[0]
			}
			return value.toString()
		})

		this.liquid.registerFilter("time", (value: string | Date) => {
			if (typeof value === "string") {
				value = new Date(value)
			}
			return value.toTimeString().split(" ")[0]
		})
	}

	/**
	 * 处理文本中的模板变量
	 */
	async processText(text: string): Promise<LiquidTemplateProcessingResult> {
		const result: LiquidTemplateProcessingResult = {
			processedText: text,
			variables: [],
			setVariables: {},
			usedVariables: [],
			unprocessedTemplates: [],
			errors: [],
			warnings: [],
			stats: {
				totalTemplates: 0,
				processedTemplates: 0,
				variableCount: 0,
				outputCount: 0,
				commentCount: 0,
			},
		}

		try {
			// 第一步：解析模板
			const parsedTemplate = await this.parseTemplate(text, result)

			// 第二步：处理变量设置
			await this.processVariableAssignments(parsedTemplate, result)

			// 第三步：渲染模板
			result.processedText = await this.renderTemplate(parsedTemplate, result)
		} catch (error) {
			result.errors.push(`处理过程中发生错误: ${error instanceof Error ? error.message : String(error)}`)
		}

		return result
	}

	/**
	 * 同步版本的处理方法
	 * !目前使用
	 */
	processTextSync(text: string): LiquidTemplateProcessingResult {
		const result: LiquidTemplateProcessingResult = {
			processedText: text,
			variables: [],
			setVariables: {},
			usedVariables: [],
			unprocessedTemplates: [],
			errors: [],
			warnings: [],
			stats: {
				totalTemplates: 0,
				processedTemplates: 0,
				variableCount: 0,
				outputCount: 0,
				commentCount: 0,
			},
		}

		try {
			// 新的处理流程：先扫描 setvar，再移除，最后渲染
			if (this.options.keepVariableDefinitions) {
				// 第一步：扫描并提取所有 {{setvar::name::value}} 中的变量值
				const setvarPattern = /\{\{setvar::([^:]+)::\s*([\s\S]*?)\s*\}\}/g
				let match
				while ((match = setvarPattern.exec(text)) !== null) {
					const name = match[1]?.trim()
					const value = match[2]?.trim() || ""
					if (name) {
						// 修复：只要有变量名就处理，即使值为空
						result.setVariables[name] = value // 空值也要保留
						result.variables.push({
							name,
							value,
							type: "variable",
							line: this.getLineNumber(text, match.index || 0),
							source: match[0] || "",
						})
						result.stats.processedTemplates++
						result.stats.totalTemplates++
					}
				}

				// 第二步：移除所有 {{setvar::}} 语句
				let cleanedText = text.replace(/\{\{setvar::[^}]*\}\}/g, "")

				// 第三步：扫描并记录所有 {{getvar::name}} 的使用
				const getvarPattern = /\{\{getvar::([^}]+)\}\}/g
				while ((match = getvarPattern.exec(cleanedText)) !== null) {
					const name = match[1]?.trim()
					if (name) {
						result.usedVariables.push(name)
						result.stats.totalTemplates++
					}
				}

				// 第四步：转换 {{getvar::name}} 为 LiquidJS 的 {{ name }} 语法
				const preprocessedText = cleanedText.replace(/\{\{getvar::([^}]+)\}\}/g, (match, name) => {
					const trimmedName = name.trim()

					// 检查变量优先级：外部变量 > setvar 变量 > 默认变量
					if (this.options.variables && this.options.variables[trimmedName] !== undefined) {
						return `{{ ${trimmedName} }}`
					}
					if (result.setVariables[trimmedName] !== undefined) {
						return `{{ ${trimmedName} }}`
					}
					if (this.defaultVariables[trimmedName] !== undefined) {
						return `{{ ${trimmedName} }}`
					}

					// 如果变量未定义，保留原始语法
					return match
				})

				// 第五步：准备渲染上下文（按优先级合并）
				const allVariables = {
					...this.defaultVariables,
					...result.setVariables,
					...this.options.variables, // 外部变量优先级最高
				}

				// 第六步：使用 LiquidJS 渲染
				result.processedText = this.liquid.parseAndRenderSync(preprocessedText, allVariables)

				// 第七步：如果需要，恢复 {{setvar::}} 语句（保持向后兼容）
				if (this.options.keepVariableDefinitions) {
					// 在文本末尾添加所有 setvar 语句
					const setvarStatements = Object.entries(result.setVariables)
						.map(([name, value]) => `{{setvar::${name}::${value}}}`)
						.join("\n")

					if (setvarStatements) {
						result.processedText += "\n" + setvarStatements
					}
				}
			} else {
				// 原有的标准处理逻辑（非 keepVariableDefinitions 模式）
				const preprocessedText = this.preprocessText(text)
				this.collectTemplateInfo(preprocessedText, result)

				const allVariables = {
					...this.defaultVariables,
					...this.options.variables,
					...result.setVariables,
				}

				result.processedText = this.liquid.parseAndRenderSync(preprocessedText, allVariables)
			}

			// 后处理：清理未处理的模板（如果需要）
			if (this.options.removeUnprocessed) {
				result.processedText = this.removeUnprocessedTemplates(result.processedText, result)
			}
		} catch (error) {
			result.errors.push(`处理过程中发生错误: ${error instanceof Error ? error.message : String(error)}`)
		}

		return result
	}

	/**
	 * 处理 {{random:[...]}} 语法
	 */
	private processRandomSyntax(text: string): string {
		return text.replace(/\{\{random:\s*\[([^\]]*)\]\s*::\s*\[([^\]]*)\]\s*\}\}/g, (match, options, fallback) => {
			try {
				// 解析选项
				const optionList = options
					.split("::")
					.map((opt: string) => opt.trim())
					.filter((opt: string) => opt.length > 0)
				const fallbackList = fallback
					.split("::")
					.map((opt: string) => opt.trim())
					.filter((opt: string) => opt.length > 0)

				// 合并所有选项
				const allOptions = [...optionList, ...fallbackList]

				if (allOptions.length === 0) {
					return "" // 如果没有选项，返回空字符串
				}

				// 随机选择一个选项
				const randomIndex = Math.floor(Math.random() * allOptions.length)
				return allOptions[randomIndex]
			} catch (error) {
				// 如果解析失败，返回原始语法
				return match
			}
		})
	}

	/**
	 * 预处理文本：将自定义语法转换为 LiquidJS 语法
	 */
	private preprocessText(text: string): string {
		let processed = text

		// 首先处理 {{random:[...]}} 语法
		processed = this.processRandomSyntax(processed)

		if (this.options.keepVariableDefinitions) {
			// 在保留模式下，我们需要特殊处理：
			// 1. 首先收集所有 setvar 的值
			// 2. 将所有 {% assign %} 语句提前到模板开头，确保变量在使用前被定义
			// 3. 只转换 getvar 为对应的变量引用，保持 setvar 语句原样

			const setvarMap = new Map<string, string>()
			const assignStatements: string[] = []
			const placeholders: Array<{ name: string; hash: string; originalMatch: string }> = []

			// 第一步：收集所有 setvar 的值，并生成 assign 语句
			// 注意：只为不在外部变量中的变量生成 assign 语句，避免覆盖外部变量
			processed = processed.replace(
				/\{\{setvar::([^:]+)::\s*([\s\S]*?)\s*\}\}/g,
				(match, name, value, offset) => {
					const trimmedName = name.trim()
					const trimmedValue = value.trim()
					setvarMap.set(trimmedName, trimmedValue)

					// 只为不在外部变量中的变量生成 assign 语句
					// 这样可以确保外部变量优先级更高
					if (!this.options.variables || this.options.variables[trimmedName] === undefined) {
						// 创建 LiquidJS assign 语句用于变量定义
						let processedValue = trimmedValue
						if (!processedValue) {
							processedValue = '""'
						} else {
							// 正确转义所有特殊字符，包括换行符
							processedValue = processedValue
								.replace(/\\/g, "\\\\") // 反斜杠
								.replace(/\n/g, "\\n") // 换行符
								.replace(/\r/g, "\\r") // 回车符
								.replace(/\t/g, "\\t") // 制表符
								.replace(/"/g, '\\"') // 双引号
							processedValue = `"${processedValue}"`
						}

						// 收集 assign 语句（稍后会提前到模板开头）
						assignStatements.push(`{% assign ${trimmedName} = ${processedValue} %}`)
					}

					// 使用特殊占位符保存原始 setvar 语句的位置
					const hash = this.simpleHash(trimmedValue)
					const placeholder = `__SETVAR_PLACEHOLDER_${trimmedName}__${hash}__`
					placeholders.push({ name: trimmedName, hash, originalMatch: match })
					return placeholder
				},
			)

			// 第二步：将所有 assign 语句添加到模板开头
			if (assignStatements.length > 0) {
				processed = assignStatements.join("\n") + "\n" + processed
			}

			// 第三步：转换 getvar 为变量引用
			// 正确的优先级：外部变量 > 模板定义的变量 > 默认变量
			processed = processed.replace(/\{\{getvar::([^}]+)\}\}/g, (match, name) => {
				const trimmedName = name.trim()

				// 首先检查外部变量（优先级最高）
				if (this.options.variables && this.options.variables[trimmedName] !== undefined) {
					return `{{ ${trimmedName} }}`
				}

				// 然后检查模板中定义的变量
				if (setvarMap.has(trimmedName)) {
					return `{{ ${trimmedName} }}`
				}

				// 最后检查默认变量
				if (this.defaultVariables[trimmedName] !== undefined) {
					return `{{ ${trimmedName} }}`
				}

				return match // 保留原始格式
			})

			// 转换注释 {{// comment}} 为 {% comment %}comment{% endcomment %}
			processed = processed.replace(/\{\{\/\/([^}]*)\}\}/g, "{% comment %}$1{% endcomment %}")
		} else {
			// 标准模式：直接转换
			processed = processed.replace(/\{\{setvar::([^:]+)::\s*([\s\S]*?)\s*\}\}/g, (match, name, value) => {
				// 处理空值
				if (!value || value.trim() === "") {
					value = '""'
				} else {
					// 保持原始内容，只做必要的转义
					value = value.replace(/"/g, '\\"') // 转义引号
					value = `"${value}"` // 始终用引号包围以确保安全
				}
				return `{% assign ${name.trim()} = ${value} %}`
			})

			// 转换 {{getvar::name}} 为 {{ name }}
			processed = processed.replace(/\{\{getvar::([^}]+)\}\}/g, "{{ $1 }}")

			// 转换注释 {{// comment}} 为 {% comment %}comment{% endcomment %}
			processed = processed.replace(/\{\{\/\/([^}]*)\}\}/g, "{% comment %}$1{% endcomment %}")
		}

		return processed
	}

	/**
	 * 收集模板信息
	 */
	private collectTemplateInfo(text: string, result: LiquidTemplateProcessingResult): void {
		// 首先处理原始的 {{setvar::}} 和 {{getvar::}} 语法
		if (this.options.keepVariableDefinitions) {
			// 匹配 {{setvar::name::value}}
			const setvarMatches = text.matchAll(/\{\{setvar::([^:]+)::\s*([\s\S]*?)\s*\}\}/g)
			for (const match of setvarMatches) {
				const name = match[1]?.trim()
				const value = match[2]?.trim() || ""
				if (name) {
					// 修复：只要有变量名就处理，即使值为空
					result.setVariables[name] = value
					result.variables.push({
						name,
						value,
						type: "variable",
						line: this.getLineNumber(text, match.index || 0),
						source: match[0] || "",
					})
					result.stats.processedTemplates++
					result.stats.totalTemplates++
				}
			}

			// 匹配 {{getvar::name}}
			const getvarMatches = text.matchAll(/\{\{getvar::([^}]+)\}\}/g)
			for (const match of getvarMatches) {
				const name = match[1]?.trim()
				if (name) {
					result.usedVariables.push(name)
					result.variables.push({
						name,
						value: result.setVariables[name] || "",
						type: "variable",
						line: this.getLineNumber(text, match.index || 0),
						source: match[0],
					})
					result.stats.totalTemplates++
				}
			}
		} else {
			// 标准的 LiquidJS 语法处理
			// 匹配变量输出 {{ variable }}
			const variableMatches = text.matchAll(/\{\{([^}]+)\}\}/g)
			for (const match of variableMatches) {
				const content = match[1]?.trim()
				if (content && !content.startsWith("%") && !content.startsWith("#")) {
					result.variables.push({
						name: content,
						value: "",
						type: "variable",
						line: this.getLineNumber(text, match.index || 0),
						source: match[0],
					})
					result.stats.variableCount++
					result.stats.totalTemplates++
				}
			}

			// 匹配标签 {% tag %}
			const tagMatches = text.matchAll(/\{%([^%]+)%\}/g)
			for (const match of tagMatches) {
				const content = match[1]?.trim()
				if (content) {
					if (content.startsWith("assign")) {
						// 变量赋值
						const assignMatch = content.match(/assign\s+([^=\s]+)\s+=\s+(.+)/)
						if (assignMatch) {
							const [, name, value] = assignMatch
							if (name && value) {
								result.setVariables[name.trim()] = value.trim().replace(/^["']|["']$/g, "")
								result.variables.push({
									name: name.trim(),
									value: value.trim(),
									type: "variable",
									line: this.getLineNumber(text, match.index || 0),
									source: match[0],
								})
								result.stats.processedTemplates++
							}
						}
					} else if (content.startsWith("comment")) {
						result.stats.commentCount++
					}
					result.stats.totalTemplates++
				}
			}
		}
	}

	/**
	 * 移除未处理的模板
	 */
	private removeUnprocessedTemplates(text: string, result: LiquidTemplateProcessingResult): string {
		let processed = text

		// 移除未处理的变量
		processed = processed.replace(/\{\{[^}]+\}\}/g, (match) => {
			result.unprocessedTemplates.push(match)
			return ""
		})

		// 移除未处理的标签
		processed = processed.replace(/\{%[^%]+%\}/g, (match) => {
			if (!match.includes("endcomment")) {
				result.unprocessedTemplates.push(match)
				return ""
			}
			return match
		})

		return processed
	}

	/**
	 * 异步解析模板（保留接口，目前主要使用同步版本）
	 */
	private async parseTemplate(text: string, result: LiquidTemplateProcessingResult): Promise<string> {
		return this.preprocessText(text)
	}

	/**
	 * 处理变量赋值
	 */
	private async processVariableAssignments(template: string, result: LiquidTemplateProcessingResult): Promise<void> {
		// 这个方法在同步版本中已经通过 collectTemplateInfo 处理
	}

	/**
	 * 渲染模板
	 */
	private async renderTemplate(template: string, result: LiquidTemplateProcessingResult): Promise<string> {
		const allVariables = {
			...this.defaultVariables,
			...this.options.variables,
			...result.setVariables,
		}

		const rendered = await this.liquid.parseAndRender(template, allVariables)

		// 如果需要保留变量定义，则恢复原始的 {{setvar::}} 语法
		if (this.options.keepVariableDefinitions) {
			return this.restoreVariableDefinitions(rendered, result.setVariables)
		}

		return rendered
	}

	/**
	 * 从占位符中恢复原始的 setvar 语句
	 * 在新的 approach 中，我们需要从占位符中恢复 setvar 语句
	 */
	private restoreVariableDefinitions(text: string, setVariables: Record<string, string>): string {
		// 在新的 approach 中，我们需要：
		// 1. 从占位符中恢复原始的 {{setvar::}} 语句
		// 2. 清理占位符

		let result = text

		// 从 setVariables 中恢复所有 setvar 语句
		for (const [name, value] of Object.entries(setVariables)) {
			const hash = this.simpleHash(value)
			const placeholder = `__SETVAR_PLACEHOLDER_${name}__${hash}__`
			if (result.includes(placeholder)) {
				result = result.replace(placeholder, `{{setvar::${name}::${value}}}`)
			}
		}

		return result
	}

	/**
	 * 简单哈希函数，用于生成安全的占位符标识
	 */
	private simpleHash(str: string): string {
		let hash = 0
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i)
			hash = (hash << 5) - hash + char
			hash = hash & hash // Convert to 32bit integer
		}
		return Math.abs(hash).toString(36)
	}

	/**
	 * 获取行号
	 */
	private getLineNumber(text: string, index: number): number {
		const lines = text.substring(0, index).split("\n")
		return lines.length
	}

	/**
	 * 设置变量
	 */
	setVariable(name: string, value: any): void {
		this.defaultVariables[name] = value
	}

	/**
	 * 获取变量
	 */
	getVariable(name: string): any {
		return this.defaultVariables[name]
	}

	/**
	 * 获取所有变量
	 */
	getAllVariables(): Record<string, any> {
		return { ...this.defaultVariables }
	}
}

/**
 * 便捷函数：同步处理模板变量
 */
export function processLiquidTemplateVariables(
	text: string,
	options: LiquidTemplateProcessingOptions = {},
): LiquidTemplateProcessingResult {
	const processor = new LiquidTemplateProcessor(options)
	return processor.processTextSync(text)
}

/**
 * 便捷函数：异步处理模板变量
 */
export async function processLiquidTemplateVariablesAsync(
	text: string,
	options: LiquidTemplateProcessingOptions = {},
): Promise<LiquidTemplateProcessingResult> {
	const processor = new LiquidTemplateProcessor(options)
	return await processor.processText(text)
}

/**
 * 便捷函数：只处理模板渲染（不包含复杂逻辑）
 */
export function renderTemplate(template: string, variables: Record<string, any> = {}): string {
	const processor = new LiquidTemplateProcessor()
	return processor.processTextSync(template).processedText
}

// 导出 LiquidJS 以便高级用户使用
export { Liquid }
