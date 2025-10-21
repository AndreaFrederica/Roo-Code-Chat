import type { Role } from "@roo-code/types"

export interface TemplateProcessingOptions {
	variables?: Record<string, any>
	strict?: boolean
	keepVariableDefinitions?: boolean
	removeUnprocessed?: boolean
	maxRecursionDepth?: number
}

export interface ProcessingResult {
	processedText: string
	processedVariables: string[]
	unprocessedVariables: string[]
	errors: string[]
}

/**
 * 模板处理器
 * 负责处理模板变量替换和Liquid模板渲染
 */
export class TemplateProcessor {
	/**
	 * 处理Liquid模板变量
	 */
	processLiquidTemplate(
		template: string,
		options: TemplateProcessingOptions = {},
	): ProcessingResult {
		const {
			variables = {},
			strict = false,
			keepVariableDefinitions = false,
			removeUnprocessed = true,
			maxRecursionDepth = 10,
		} = options

		const result: ProcessingResult = {
			processedText: template,
			processedVariables: [],
			unprocessedVariables: [],
			errors: [],
		}

		try {
			// 简单的Liquid模板变量替换
			// 这里实现一个基础版本，实际项目中可以使用liquidjs库
			let processedText = template
			let depth = 0

			// 多次处理以支持嵌套变量
			while (depth < maxRecursionDepth) {
				const previousText = processedText
				processedText = this.replaceTemplateVariables(processedText, variables, result)

				// 如果没有变化，说明已经处理完成
				if (processedText === previousText) {
					break
				}

				depth++
			}

			// 处理未处理的变量
			if (!keepVariableDefinitions && removeUnprocessed) {
				processedText = this.removeUnprocessedVariables(processedText, result)
			}

			result.processedText = processedText

			// 严格模式下检查未处理的变量
			if (strict && result.unprocessedVariables.length > 0) {
				result.errors.push(
					`Unprocessed variables in strict mode: ${result.unprocessedVariables.join(", ")}`,
				)
			}

		} catch (error) {
			result.errors.push(`Template processing error: ${error instanceof Error ? error.message : "Unknown error"}`)
		}

		return result
	}

	/**
	 * 替换模板变量
	 */
	private replaceTemplateVariables(
		template: string,
		variables: Record<string, any>,
		result: ProcessingResult,
	): string {
		let processedText = template

		// 处理 {{ variable }} 格式
		const doubleBraceRegex = /\{\{\s*([^}]+)\s*\}\}/g
		processedText = processedText.replace(doubleBraceRegex, (match, variablePath) => {
			const trimmedPath = variablePath.trim()
			const value = this.getVariableValue(trimmedPath, variables)

			if (value !== undefined) {
				result.processedVariables.push(trimmedPath)
				return String(value)
			} else {
				result.unprocessedVariables.push(trimmedPath)
				return match // 保持原样
			}
		})

		// 处理 {% if variable %} ... {% endif %} 格式
		processedText = this.processConditionalBlocks(processedText, variables, result)

		// 处理 {% for item in array %} ... {% endfor %} 格式
		processedText = this.processLoopBlocks(processedText, variables, result)

		return processedText
	}

	/**
	 * 处理条件块
	 */
	private processConditionalBlocks(
		template: string,
		variables: Record<string, any>,
		result: ProcessingResult,
	): string {
		const conditionalRegex = /\{%\s*if\s+([^%]+)\s*%\}([\s\S]*?)\{%\s*endif\s*%\}/g

		return template.replace(conditionalRegex, (match, condition, content) => {
			const trimmedCondition = condition.trim()
			const value = this.getVariableValue(trimmedCondition, variables)

			if (this.isTruthy(value)) {
				result.processedVariables.push(trimmedCondition)
				return content
			} else {
				result.unprocessedVariables.push(trimmedCondition)
				return ""
			}
		})
	}

	/**
	 * 处理循环块
	 */
	private processLoopBlocks(
		template: string,
		variables: Record<string, any>,
		result: ProcessingResult,
	): string {
		const loopRegex = /\{%\s*for\s+(\w+)\s+in\s+([^%]+)\s*%\}([\s\S]*?)\{%\s*endfor\s*%\}/g

		return template.replace(loopRegex, (match, itemVar, arrayPath, content) => {
			const trimmedArrayPath = arrayPath.trim()
			const arrayValue = this.getVariableValue(trimmedArrayPath, variables)

			if (Array.isArray(arrayValue)) {
				result.processedVariables.push(trimmedArrayPath)
				return arrayValue
					.map((item, index) => {
						const loopVariables = {
							...variables,
							[itemVar]: item,
							[`${itemVar}_index`]: index,
							[`${itemVar}_first`]: index === 0,
							[`${itemVar}_last`]: index === arrayValue.length - 1,
						}
						return this.replaceTemplateVariables(content, loopVariables, result)
					})
					.join("")
			} else {
				result.unprocessedVariables.push(trimmedArrayPath)
				return ""
			}
		})
	}

	/**
	 * 获取变量值
	 */
	private getVariableValue(path: string, variables: Record<string, any>): any {
		// 支持简单的点号路径访问，如 "user.name"
		const parts = path.split(".")
		let current: any = variables

		for (const part of parts) {
			if (current && typeof current === "object" && part in current) {
				current = current[part]
			} else {
				return undefined
			}
		}

		return current
	}

	/**
	 * 判断值是否为真
	 */
	private isTruthy(value: any): boolean {
		if (value === null || value === undefined) {
			return false
		}
		if (typeof value === "boolean") {
			return value
		}
		if (typeof value === "number") {
			return value !== 0
		}
		if (typeof value === "string") {
			return value.length > 0
		}
		if (Array.isArray(value)) {
			return value.length > 0
		}
		if (typeof value === "object") {
			return Object.keys(value).length > 0
		}
		return true
	}

	/**
	 * 移除未处理的变量
	 */
	private removeUnprocessedVariables(template: string, result: ProcessingResult): string {
		let processedText = template

		// 移除未处理的变量标记
		const unprocessedVars = [...new Set(result.unprocessedVariables)]

		unprocessedVars.forEach((variable) => {
			const regex = new RegExp(`\\{\\{\\s*${this.escapeRegExp(variable)}\\s*\\}\\}`, "g")
			processedText = processedText.replace(regex, "")
		})

		// 移除空的条件块
		processedText = processedText.replace(/\{%\s*if\s+[^%]*%\s*\}%\s*\{%\s*endif\s*%\}/g, "")

		// 移除空的循环块
		processedText = processedText.replace(/\{%\s*for\s+\w+\s+in\s+[^%]*%\s*\}%\s*\{%\s*endfor\s*%\}/g, "")

		return processedText
	}

	/**
	 * 转义正则表达式特殊字符
	 */
	private escapeRegExp(string: string): string {
		return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
	}

	/**
	 * 应用角色模板变量
	 */
	applyRoleTemplateVariables(
		role: Role,
		variables: Record<string, any> = {},
		options: TemplateProcessingOptions = {},
	): Role {
		const processedRole = JSON.parse(JSON.stringify(role)) // 深拷贝

		// 定义需要处理的字段
		const processableFields = [
			"name",
			"description",
			"personality",
			"scenario",
			"first_mes",
			"mes_example",
			"creator_notes",
			"system_prompt",
			"post_history_instructions",
		]

		for (const field of processableFields) {
			if (processedRole[field] && typeof processedRole[field] === "string") {
				const result = this.processLiquidTemplate(processedRole[field], {
					...options,
					variables: {
						char: processedRole.name || "",
						name: processedRole.name || "",
						description: processedRole.description || "",
						personality: processedRole.personality || "",
						scenario: processedRole.scenario || "",
						...variables,
					},
				})

				if (result.errors.length === 0) {
					processedRole[field] = result.processedText
				} else {
					console.warn(`Template processing errors for field ${field}:`, result.errors)
				}
			}
		}

		// 处理profile对象中的字段
		if (processedRole.profile && typeof processedRole.profile === "object") {
			const profileFields = ["appearance", "background", "skills", "hobbies"]

			for (const field of profileFields) {
				if (processedRole.profile[field]) {
					if (Array.isArray(processedRole.profile[field])) {
						processedRole.profile[field] = processedRole.profile[field].map((item: any) => {
							if (typeof item === "string") {
								const result = this.processLiquidTemplate(item, {
									...options,
									variables: {
										char: processedRole.name || "",
										name: processedRole.name || "",
										...variables,
									},
								})
								return result.errors.length === 0 ? result.processedText : item
							}
							return item
						})
					} else if (typeof processedRole.profile[field] === "string") {
						const result = this.processLiquidTemplate(processedRole.profile[field], {
							...options,
							variables: {
								char: processedRole.name || "",
								name: processedRole.name || "",
								...variables,
							},
						})
						if (result.errors.length === 0) {
							processedRole.profile[field] = result.processedText
						}
					}
				}
			}
		}

		return processedRole
	}
}