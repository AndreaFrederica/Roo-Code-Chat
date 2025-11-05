import { useState, useEffect, useCallback } from "react"
import { vscode } from "@/utils/vscode"

interface MixinRule {
	id: string
	enabled: boolean
	pattern?: string
	flags?: string
	description?: string
	replacement?: string
	action?: "replace" | "match" | "extract" | "validate"
	toType?: string
	defaultCollapsed?: boolean
	dependsOn?: string[]
}

interface MixinConfig {
	version: string
	type: "regex" | "ast"
	name: string
	description?: string
	basedOn?: string
	rules: Record<string, MixinRule>
	enabled: boolean
	metadata: {
		createdAt: string
		updatedAt: string
		author?: string
	}
}

interface MixinRulesState {
	regexMixins: Record<string, MixinRule>
	astMixins: Record<string, MixinRule>
	loading: boolean
	error: string | null
}

/**
 * 安全的Mixin规则Hook - 基于JSON配置而非代码执行
 */
export function useMixinRules(customRulesFiles: {
	regexMixins: Array<{ fileName: string; enabled: boolean }>
	astMixins: Array<{ fileName: string; enabled: boolean }>
}) {
	const [state, setState] = useState<MixinRulesState>({
		regexMixins: {},
		astMixins: {},
		loading: false,
		error: null,
	})

	// 安全解析JSON配置文件
	const parseMixinConfig = useCallback((content: string, fileName: string): MixinConfig | null => {
		try {
			const config = JSON.parse(content) as MixinConfig

			// 验证配置结构
			if (!config.version || !config.type || !config.name || !config.rules) {
				throw new Error("Invalid mixin configuration structure")
			}

			return config
		} catch (error) {
			console.warn(`Failed to parse mixin config ${fileName}:`, error)
			return null
		}
	}, [])

	// 转换配置为规则对象
	const convertConfigToRules = useCallback((config: MixinConfig): Record<string, MixinRule> => {
		const rules: Record<string, MixinRule> = {}

		for (const [ruleKey, rule] of Object.entries(config.rules)) {
			if (!rule.id || typeof rule.id !== "string" || !rule.id.trim()) {
				console.warn(`Mixin rule ${ruleKey} is missing required id; skipping`)
				continue
			}
			// 只支持安全的字符串替换，不支持函数
			rules[ruleKey] = {
				id: rule.id,
				enabled: rule.enabled || false,
				pattern: rule.pattern,
				flags: rule.flags,
				description: rule.description,
				replacement: typeof rule.replacement === "string" ? rule.replacement : undefined,
				action: rule.action || "replace",
				toType: typeof rule.toType === "string" ? rule.toType.trim() : undefined,
				defaultCollapsed: typeof rule.defaultCollapsed === "boolean" ? rule.defaultCollapsed : undefined,
				dependsOn: Array.isArray(rule.dependsOn)
					? rule.dependsOn.filter((id) => typeof id === "string" && id.trim().length > 0)
					: undefined,
			}
		}

		return rules
	}, [])

	// 加载mixin文件
	const loadMixinFile = useCallback(
		async (fileName: string): Promise<Record<string, MixinRule>> => {
			return new Promise((resolve) => {
				const messageId = Date.now().toString()

				// 请求后端加载mixin文件
				vscode.postMessage({
					type: "loadMixinFile",
					messageId,
					fileType: fileName.includes("regex") ? "regex" : "ast",
					fileName,
				})

				// 监听响应
				const handleMessage = (event: MessageEvent) => {
					const message = event.data
					if (message.type === "ospMixinLoaded" && message.ospMessageId === messageId) {
						window.removeEventListener("message", handleMessage)

						if (message.error) {
							console.warn(`Failed to load mixin ${fileName}:`, message.error)
							resolve({})
							return
						}

						if (message.payload?.content) {
							const config = parseMixinConfig(message.payload.content, fileName)
							if (config) {
								const rules = convertConfigToRules(config)
								resolve(rules)
							} else {
								resolve({})
							}
						} else {
							resolve({})
						}
					}
				}

				window.addEventListener("message", handleMessage)

				// 超时处理
				setTimeout(() => {
					window.removeEventListener("message", handleMessage)
					console.warn(`Timeout loading mixin ${fileName}`)
					resolve({})
				}, 5000)
			})
		},
		[parseMixinConfig, convertConfigToRules],
	)

	// 加载所有启用的mixin规则
	useEffect(() => {
		const loadAllMixins = async () => {
			setState((prev) => ({ ...prev, loading: true, error: null }))

			try {
				const regexMixins: Record<string, MixinRule> = {}
				const astMixins: Record<string, MixinRule> = {}

				// 加载正则mixin
				for (const mixinFile of customRulesFiles.regexMixins) {
					if (mixinFile.enabled) {
						const rules = await loadMixinFile(mixinFile.fileName)
						Object.assign(regexMixins, rules)
					}
				}

				// 加载AST mixin
				for (const mixinFile of customRulesFiles.astMixins) {
					if (mixinFile.enabled) {
						const rules = await loadMixinFile(mixinFile.fileName)
						Object.assign(astMixins, rules)
					}
				}

				setState({
					regexMixins,
					astMixins,
					loading: false,
					error: null,
				})
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : String(error)
				setState((prev) => ({
					...prev,
					loading: false,
					error: errorMsg,
				}))
			}
		}

		loadAllMixins()
	}, [customRulesFiles, loadMixinFile])

	return state
}
