import type { TodoItem } from "@roo-code/types"

export interface VariableState {
	[key: string]: any
}

export interface VariableInjectionOptions {
	enabled?: boolean
	format?: "structured" | "simple" | "inline"
	maxVariables?: number
	excludePatterns?: string[]
}

export interface VariableInjectionResult {
	injected: boolean
	content: string
	variablesCount: number
	variables: string[]
}

/**
 * 变量状态注入器
 * 负责处理变量状态的注入和格式化
 */
export class VariableInjector {
	/**
	 * 将变量状态注入到系统提示词中
	 */
	injectVariableState(
		basePrompt: string,
		variableState: VariableState,
		options: VariableInjectionOptions = {},
	): VariableInjectionResult {
		const {
			enabled = true,
			format = "structured",
			maxVariables = 50,
			excludePatterns = ["password", "token", "secret", "key"],
		} = options

		if (!enabled || Object.keys(variableState).length === 0) {
			return {
				injected: false,
				content: basePrompt,
				variablesCount: 0,
				variables: [],
			}
		}

		// 过滤变量
		const filteredVariables = this.filterVariables(variableState, excludePatterns, maxVariables)
		const variableNames = Object.keys(filteredVariables)

		if (variableNames.length === 0) {
			return {
				injected: false,
				content: basePrompt,
				variablesCount: 0,
				variables: [],
			}
		}

		// 生成变量注入内容
		const variableSection = this.formatVariableSection(filteredVariables, format)

		// 注入到系统提示词中
		const injectedPrompt = this.injectIntoPrompt(basePrompt, variableSection)

		return {
			injected: true,
			content: injectedPrompt,
			variablesCount: variableNames.length,
			variables: variableNames,
		}
	}

	/**
	 * 生成变量摘要（用于增强导向模式）
	 */
	generateVariableSummary(variableState: VariableState, maxLength: number = 500): string {
		const variableNames = Object.keys(variableState)
		if (variableNames.length === 0) {
			return ""
		}

		const summary: string[] = []
		let currentLength = 0

		for (const [name, value] of Object.entries(variableState)) {
			const variableInfo = `${name}: ${typeof value === "string" ? value : JSON.stringify(value)}`

			if (currentLength + variableInfo.length > maxLength) {
				summary.push(`... and ${variableNames.length - summary.length} more variables`)
				break
			}

			summary.push(variableInfo)
			currentLength += variableInfo.length + 2 // +2 for newline
		}

		return summary.join("\n")
	}

	/**
	 * 过滤变量
	 */
	private filterVariables(
		variableState: VariableState,
		excludePatterns: string[],
		maxVariables: number,
	): VariableState {
		const filtered: VariableState = {}
		let count = 0

		for (const [name, value] of Object.entries(variableState)) {
			// 检查排除模式
			if (this.shouldExcludeVariable(name, excludePatterns)) {
				continue
			}

			// 检查数量限制
			if (count >= maxVariables) {
				break
			}

			// 过滤掉null、undefined和空字符串
			if (value !== null && value !== undefined && value !== "") {
				filtered[name] = value
				count++
			}
		}

		return filtered
	}

	/**
	 * 检查是否应该排除变量
	 */
	private shouldExcludeVariable(variableName: string, excludePatterns: string[]): boolean {
		const lowerName = variableName.toLowerCase()

		return excludePatterns.some((pattern) =>
			lowerName.includes(pattern.toLowerCase())
		)
	}

	/**
	 * 格式化变量部分
	 */
	private formatVariableSection(variables: VariableState, format: "structured" | "simple" | "inline"): string {
		switch (format) {
			case "structured":
				return this.formatStructuredVariables(variables)
			case "simple":
				return this.formatSimpleVariables(variables)
			case "inline":
				return this.formatInlineVariables(variables)
			default:
				return this.formatStructuredVariables(variables)
		}
	}

	/**
	 * 格式化为结构化变量
	 */
	private formatStructuredVariables(variables: VariableState): string {
		const lines: string[] = [
			"====",
			"TASK VARIABLE STATE",
			"",
			"The following variables are currently available and can be used in your responses:",
		]

		for (const [key, value] of Object.entries(variables)) {
			if (typeof value === "string") {
				lines.push(`- ${key}: ${value}`)
			} else {
				lines.push(`- ${key}: ${JSON.stringify(value)}`)
			}
		}

		lines.push(
			"",
			"You can reference these variables using the format: _.variableName",
			"====",
		)

		return lines.join("\n")
	}

	/**
	 * 格式化为简单变量
	 */
	private formatSimpleVariables(variables: VariableState): string {
		const lines: string[] = [
			"Available Variables:",
			"",
		]

		for (const [key, value] of Object.entries(variables)) {
			const displayValue = typeof value === "string" ? value : JSON.stringify(value)
			lines.push(`${key} = ${displayValue}`)
		}

		return lines.join("\n")
	}

	/**
	 * 格式化为内联变量
	 */
	private formatInlineVariables(variables: VariableState): string {
		const variableList = Object.keys(variables).map((key) => `_.${key}`).join(", ")
		return `Available variables: ${variableList}`
	}

	/**
	 * 将变量部分注入到系统提示词中
	 */
	private injectIntoPrompt(basePrompt: string, variableSection: string): string {
		// 尝试找到合适的注入位置
		const injectionPositions = [
			{
				// 在系统提示词末尾注入
				position: basePrompt.length,
				context: "end",
			},
			{
				// 在最后一个主要章节后注入
				position: this.findLastMajorSectionEnd(basePrompt),
				context: "after_last_section",
			},
			{
				// 在规则部分前注入
				position: this.findRulesSection(basePrompt),
				context: "before_rules",
			},
		]

		for (const { position, context } of injectionPositions) {
			if (position > 0 && position < basePrompt.length) {
				switch (context) {
					case "end":
						return `${basePrompt}\n\n${variableSection}`
					case "after_last_section":
						return `${basePrompt.substring(0, position)}\n\n${variableSection}\n\n${basePrompt.substring(position)}`
					case "before_rules":
						return `${basePrompt.substring(0, position)}\n\n${variableSection}\n\n${basePrompt.substring(position)}`
				}
			}
		}

		// 如果找不到合适的位置，在末尾添加
		return `${basePrompt}\n\n${variableSection}`
	}

	/**
	 * 找到最后一个主要章节的结束位置
	 */
	private findLastMajorSectionEnd(prompt: string): number {
		const lines = prompt.split("\n")
		let lastSectionEnd = -1

		for (let i = lines.length - 1; i >= 0; i--) {
			const line = lines[i].trim()

			// 查找主要章节标题
			if (line.startsWith("# ") || line.startsWith("## ")) {
				// 找到这个章节的结束位置
				for (let j = i + 1; j < lines.length; j++) {
					const nextLine = lines[j].trim()
					if (nextLine.startsWith("# ") || nextLine.startsWith("## ")) {
						lastSectionEnd = j
						break
					}
				}
				break
			}
		}

		return lastSectionEnd > 0 ? lastSectionEnd : -1
	}

	/**
	 * 找到规则部分的位置
	 */
	private findRulesSection(prompt: string): number {
		const lines = prompt.split("\n")

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim().toLowerCase()

			if (line.includes("rules") || line.includes("guidelines") || line.includes("instructions")) {
				return i
			}
		}

		return -1
	}

	/**
	 * 从Todo列表提取变量状态
	 */
	extractVariablesFromTodoList(todoList: TodoItem[]): VariableState {
		const variables: VariableState = {}

		for (const todo of todoList) {
			

			// 添加todo相关信息作为变量
			if (todo.id) {
				variables[`todo_${todo.id}_status`] = todo.status
				variables[`todo_${todo.id}_content`] = todo.content
			}
		}

		return variables
	}

	/**
	 * 清理变量状态（移除敏感信息）
	 */
	cleanVariableState(variableState: VariableState): VariableState {
		const cleaned: VariableState = {}
		const sensitivePatterns = [
			/password/i,
			/token/i,
			/secret/i,
			/key/i,
			/auth/i,
			/credential/i,
		]

		for (const [key, value] of Object.entries(variableState)) {
			// 检查键名是否包含敏感信息
			const isSensitive = sensitivePatterns.some((pattern) => pattern.test(key))

			if (!isSensitive) {
				// 对于值，也进行简单检查
				if (typeof value === "string") {
					// 如果值看起来像敏感信息，进行脱敏
					if (value.length > 50 && /[a-zA-Z0-9+/]{40,}/.test(value)) {
						cleaned[key] = "[REDACTED]"
					} else {
						cleaned[key] = value
					}
				} else {
					cleaned[key] = value
				}
			}
		}

		return cleaned
	}
}