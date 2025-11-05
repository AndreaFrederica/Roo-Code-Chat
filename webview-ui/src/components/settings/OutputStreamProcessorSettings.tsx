import React, { useState, useCallback, useMemo, useEffect, useRef } from "react"
import { HTMLAttributes } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { VSCodeCheckbox, VSCodeTextField, VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { Zap, Settings, FileText, Plus, Trash2, Edit2, FolderOpen, Copy } from "lucide-react"
import { vscode } from "@/utils/vscode"

import { SetCachedStateField } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { ExtensionStateContextType } from "@/context/ExtensionStateContext"
import { useExtensionState } from "@/context/ExtensionStateContext"
// 定义规则类型接口
interface Rule {
	id: string
	name: string
	type: "regex" | "ast"
	enabled: boolean
	description: string
	// 规则来源标识（动态字符串）
	source?: string
	// 正则规则特有属性
	pattern?: string
	flags?: string
	replacement?: string
	replacementFunction?: string
	groups?: Array<{
		name?: string
		description: string
		example?: string
	}>
	// AST规则特有属性
	nodeType?: string
	nodeAttributes?: Record<string, any>
	action?: string
	priority?: number
	processor?: string
	params?: Record<string, any>
	recursive?: boolean
	// 通用属性
	stage?: "pre-ast" | "post-ast" | "output"
	// 依赖关系
	dependsOn?: string[]
}

interface _RulesResponse {
	regex: Record<string, Rule>
	ast: Record<string, Rule>
}

interface OutputStreamProcessorSettingsProps extends HTMLAttributes<HTMLDivElement> {
	setCachedStateField: SetCachedStateField<keyof ExtensionStateContextType>
	onHasChangesChange?: (hasChanges: boolean) => void
	onSaveChanges?: () => Promise<void>
	onResetChanges?: () => void
}

// 默认配置结构 - 不包含具体规则，只包含配置结构
const getDefaultConfig = () => ({
	// 移除 builtinRulesEnabled，直接使用 enabledRules
	enabledRules: {
		regex: {},
		ast: {},
	},
	// 用户自定义规则文件
	customRulesFiles: {
		regexMixins: [] as Array<{ fileName: string; enabled: boolean }>,
		astMixins: [] as Array<{ fileName: string; enabled: boolean }>,
	},
	// 内容注入配置
	contentInjection: {
		timestampEnabled: true,
		variableEnabled: true,
		dateFormat: "YYYY-MM-DD HH:mm:ss",
	},
})

export const OutputStreamProcessorSettings = ({
	setCachedStateField,
	onHasChangesChange,
	onSaveChanges,
	onResetChanges,
	...props
}: OutputStreamProcessorSettingsProps) => {
	const { t } = useAppTranslation()
	const { outputStreamProcessorConfig } = useExtensionState()

	// 从后端获取的可用规则数据
	const [availableRules, setAvailableRules] = useState<_RulesResponse>({ regex: {}, ast: {} })
	const [loading, setLoading] = useState(true)

	// 折叠状态管理 - 根据规则来源动态生成
	const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
		regex: true,
		ast: true,
	})

	// 获取当前配置 - 优先使用从ExtensionState获取的配置
	const [config, setConfig] = useState(() => {
		// 合并默认配置和已保存的配置
		const defaultConfig = getDefaultConfig()
		const savedConfig = outputStreamProcessorConfig || {}

		return {
			...defaultConfig,
			...savedConfig,
			// 确保customRulesFiles的结构正确
			customRulesFiles: {
				regexMixins: Array.isArray(savedConfig?.customRulesFiles?.regexMixins)
					? savedConfig.customRulesFiles.regexMixins.map((mixin: any) =>
							typeof mixin === "string" ? { fileName: mixin, enabled: true } : mixin,
						)
					: defaultConfig.customRulesFiles.regexMixins,
				astMixins: Array.isArray(savedConfig?.customRulesFiles?.astMixins)
					? savedConfig.customRulesFiles.astMixins.map((mixin: any) =>
							typeof mixin === "string" ? { fileName: mixin, enabled: true } : mixin,
						)
					: defaultConfig.customRulesFiles.astMixins,
			},
			// 保持启用的规则
			enabledRules: savedConfig.enabledRules || defaultConfig.enabledRules,
			// 保持内容注入配置
			contentInjection: savedConfig.contentInjection || defaultConfig.contentInjection,
		}
	})

	// 变更状态跟踪
	const [hasChanges, setHasChanges] = useState(false)
	const initialConfigRef = useRef(JSON.parse(JSON.stringify(config)))

	// 监听outputStreamProcessorConfig的变化，确保组件状态与ExtensionState同步
	useEffect(() => {
		if (outputStreamProcessorConfig) {
			const defaultConfig = getDefaultConfig()
			const savedConfig = outputStreamProcessorConfig || {}

			const mergedConfig = {
				...defaultConfig,
				...savedConfig,
				// 确保customRulesFiles的结构正确
				customRulesFiles: {
					regexMixins: Array.isArray(savedConfig?.customRulesFiles?.regexMixins)
						? savedConfig.customRulesFiles.regexMixins.map((mixin: any) =>
								typeof mixin === "string" ? { fileName: mixin, enabled: true } : mixin,
							)
						: defaultConfig.customRulesFiles.regexMixins,
					astMixins: Array.isArray(savedConfig?.customRulesFiles?.astMixins)
						? savedConfig.customRulesFiles.astMixins.map((mixin: any) =>
								typeof mixin === "string" ? { fileName: mixin, enabled: true } : mixin,
							)
						: defaultConfig.customRulesFiles.astMixins,
				},
				// 保持启用的规则
				enabledRules: savedConfig.enabledRules || defaultConfig.enabledRules,
				// 保持内容注入配置
				contentInjection: savedConfig.contentInjection || defaultConfig.contentInjection,
			}
			setConfig(mergedConfig)
		}
	}, [outputStreamProcessorConfig])

	// 从后端获取所有可用规则数据
	useEffect(() => {
		const fetchAllRules = () => {
			vscode.postMessage({
				type: "ospGetAllRules" as any,
			})
		}

		const fetchEnabledRules = () => {
			vscode.postMessage({
				type: "ospGetEnabledRules" as any,
			})
		}

		// 监听来自后端的响应
		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "ospRulesLoaded") {
				// 设置所有可用规则（用于设置界面显示）
				setAvailableRules(message.payload?.ospRules || { regex: {}, ast: {} })
				setLoading(false)
				console.log("[OutputStreamProcessorSettings] All OSP rules loaded:", message.payload?.ospRules)
			} else if (message.type === "ospEnabledRulesLoaded") {
				// 更新配置中的启用规则（用于渲染）
				if (message.payload?.ospEnabledRules) {
					const newConfig = {
						...config,
						enabledRules: message.payload.ospEnabledRules,
					}
					setConfig(newConfig)
					setCachedStateField("outputStreamProcessorConfig", newConfig)
					console.log(
						"[OutputStreamProcessorSettings] Enabled OSP rules loaded and config updated:",
						message.payload.ospEnabledRules,
					)
				}
			}
		}

		window.addEventListener("message", handleMessage)
		fetchAllRules()
		fetchEnabledRules()

		return () => {
			window.removeEventListener("message", handleMessage)
		}
	}, [config, setCachedStateField])

	const ruleRegistry = useMemo(() => {
		const map = new Map<string, { key: string; type: "regex" | "ast"; defaultEnabled: boolean }>()
		for (const [key, rule] of Object.entries(availableRules.regex)) {
			map.set(rule.id, { key, type: "regex", defaultEnabled: rule.enabled })
		}
		for (const [key, rule] of Object.entries(availableRules.ast)) {
			map.set(rule.id, { key, type: "ast", defaultEnabled: rule.enabled })
		}
		return map
	}, [availableRules])

	// 根据来源对规则进行分类（支持动态 source）
	const getRulesBySource = useCallback(
		(type: "regex" | "ast") => {
			const rules = availableRules[type]
			const categorized: Record<string, Array<Rule>> = {}

			Object.entries(rules).forEach(([key, rule]: [string, Rule]) => {
				const source = rule.source || "default"
				if (!categorized[source]) {
					categorized[source] = []
				}
				// 将 id 添加到 rule 对象中，这样就可以直接访问 rule.id
				categorized[source].push({ ...rule, id: key })
			})

			return categorized
		},
		[availableRules],
	)

	// 更新配置并通知父组件有变更
	const updateConfig = useCallback(
		(newConfig: any) => {
			console.log("[OutputStreamProcessorSettings] updateConfig called with:", newConfig)
			setConfig(newConfig)
			setCachedStateField("outputStreamProcessorConfig", newConfig)

			// 检查是否有变更
			const hasConfigChanges = JSON.stringify(newConfig) !== JSON.stringify(initialConfigRef.current)
			if (hasConfigChanges !== hasChanges) {
				setHasChanges(hasConfigChanges)
				// 通知父组件有变更
				if (onHasChangesChange) {
					onHasChangesChange(hasConfigChanges)
				}
			}
		},
		[setCachedStateField, hasChanges, onHasChangesChange],
	)

	// 保存变更到后端
	const _handleSaveChanges = useCallback(async () => {
		console.log("[OutputStreamProcessorSettings] Saving changes to backend:", config)
		try {
			// 发送配置到后端
			vscode.postMessage({
				type: "outputStreamProcessorConfig",
				config: config,
			})

			// 等待一小段时间确保消息发送
			await new Promise((resolve) => setTimeout(resolve, 100))

			// 重置变更状态
			setHasChanges(false)
			if (onHasChangesChange) {
				onHasChangesChange(false)
			}

			// 更新初始配置
			initialConfigRef.current = JSON.parse(JSON.stringify(config))

			console.log("[OutputStreamProcessorSettings] Changes saved successfully")
		} catch (error) {
			console.error("[OutputStreamProcessorSettings] Failed to save changes:", error)
		}
	}, [config, onHasChangesChange])

	// 重置变更
	const _handleResetChanges = useCallback(() => {
		console.log("[OutputStreamProcessorSettings] Resetting changes")
		// 恢复到初始配置
		setConfig(JSON.parse(JSON.stringify(initialConfigRef.current)))
		setHasChanges(false)
		if (onHasChangesChange) {
			onHasChangesChange(false)
		}
		if (onResetChanges) {
			onResetChanges()
		}
	}, [onHasChangesChange, onResetChanges])

	// 暴露保存和重置函数给父组件使用
	useEffect(() => {
		if (onSaveChanges) {
			// 父组件可以在需要时调用这个函数
			// 我们通过 ref 或者回调来暴露这个功能
		}
	}, [onSaveChanges])

	// 如果父组件需要，可以通过 ref 获取保存方法
	// 不过更简单的方式是直接使用回调函数

	// 内置规则启用状态切换
	const handleRuleToggle = (ruleKey: string, type: "regex" | "ast") => {
		const rule = type === "regex" ? availableRules.regex[ruleKey] : availableRules.ast[ruleKey]
		if (!rule?.id) return

		const currentEnabledRules = config.enabledRules || { regex: {}, ast: {} }
		const typeEnabledRules = currentEnabledRules[type] || {}
		const currentEnabled = !!typeEnabledRules[rule.id]

		// 构建完整的规则对象
		const ruleDefinition = {
			id: rule.id,
			name: rule.name,
			key: ruleKey,
			type: type,
			enabled: !currentEnabled,
			description: rule.description || ruleKey,
			// 根据类型添加特定属性
			...(type === "regex"
				? {
						pattern: rule.pattern,
						flags: rule.flags,
						replacement: rule.replacement,
						replacementFunction: rule.replacementFunction,
						groups: rule.groups,
						stage: rule.stage,
						priority: rule.priority || 0,
						dependsOn: rule.dependsOn || [],
						params: {},
					}
				: {
						nodeType: rule.nodeType,
						nodeAttributes: rule.nodeAttributes,
						action: rule.action,
						priority: rule.priority || 0,
						processor: rule.processor,
						params: rule.params || {},
						recursive: rule.recursive,
						dependsOn: rule.dependsOn || [],
					}),
			source: "builtin",
		}

		// 更新 enabledRules
		const newEnabledRules = {
			...currentEnabledRules,
			[type]: {
				...typeEnabledRules,
				[rule.id]: !currentEnabled ? ruleDefinition : undefined,
			},
		}

		// 移除 undefined 值
		if (!newEnabledRules[type][rule.id]) {
			delete newEnabledRules[type][rule.id]
		}

		updateConfig({
			...config,
			enabledRules: newEnabledRules,
		})
	}

	// 规则参数更新
	const _handleRuleConfigChange = (ruleKey: string, paramPath: string, value: any) => {
		// 获取规则的实际ID
		const rule = availableRules.regex[ruleKey] || availableRules.ast[ruleKey]
		const ruleId = rule?.id || ruleKey

		// Note: 规则配置参数功能暂时移除，因为不再使用 builtinRulesConfig
		// 可以根据需要重新设计规则参数存储机制
		console.log(`Rule config changed: ${ruleId}.${paramPath} = ${value}`)
	}

	// 折叠切换函数
	const toggleSection = useCallback((section: string) => {
		setExpandedSections((prev) => ({
			...prev,
			[section]: !prev[section],
		}))
	}, [])

	const isRuleDesired = useCallback(
		(ruleKey: string, type: "regex" | "ast"): boolean => {
			const rules = type === "regex" ? availableRules.regex : availableRules.ast
			const rule = rules[ruleKey]
			if (!rule?.id) return false

			const enabledRules = config.enabledRules || { regex: {}, ast: {} }
			const typeEnabledRules = enabledRules[type] || {}
			const isEnabled = !!typeEnabledRules[rule.id]

			// 调试日志
			console.log(`[isRuleDesired] ${type} rule ${ruleKey} (id: ${rule.id}): ${isEnabled}`)

			return isEnabled
		},
		[config.enabledRules, availableRules.regex, availableRules.ast],
	)

	const isDependencyActive = useCallback(
		(dependencyId: string): boolean => {
			const meta = ruleRegistry.get(dependencyId)
			if (!meta) {
				return false
			}
			return isRuleDesired(meta.key, meta.type)
		},
		[ruleRegistry, isRuleDesired],
	)

	const resolveDependencyNames = useCallback(
		(dependencyIds: string[] = []): string[] => {
			return dependencyIds.map((depId) => {
				const meta = ruleRegistry.get(depId)
				if (!meta) {
					return depId
				}
				const labelSource =
					meta.type === "regex" ? availableRules.regex[meta.key] : availableRules.ast[meta.key]
				const friendlyName = labelSource?.description || meta.key
				return friendlyName
			})
		},
		[ruleRegistry],
	)

	const getMissingDependencies = useCallback(
		(dependencyIds?: string[], desired?: boolean): string[] => {
			if (!desired || !dependencyIds?.length) {
				return []
			}
			const missing = dependencyIds.filter((id) => !isDependencyActive(id))
			return resolveDependencyNames(missing)
		},
		[isDependencyActive, resolveDependencyNames],
	)

	// 内容注入配置更新
	const handleContentInjectionChange = (key: string, value: any) => {
		updateConfig({
			...config,
			contentInjection: {
				...config.contentInjection,
				[key]: value,
			},
		})
	}

	// 创建新的mixin文件
	const handleCreateMixinFile = (type: "regex" | "ast") => {
		const fileName = `custom-${type}-mixin-${Date.now()}.js`

		vscode.postMessage({
			type: "ospCreateRulesMixin",
			ospFileType: type,
			ospFileName: fileName,
		})
	}

	// 创建内置规则的mixin文件
	const handleCreateMixin = (ruleKey: string, ruleType: "regex" | "ast") => {
		const fileName = `${ruleType}-${ruleKey}-override-${Date.now()}.js`

		vscode.postMessage({
			type: "ospCreateRulesMixin",
			ospFileType: ruleType,
			ospFileName: fileName,
			ospBuiltinRuleKey: ruleKey, // 告诉后端这是基于哪个规则创建的mixin
		})
	}

	// 编辑mixin文件
	const handleEditMixinFile = (type: "regex" | "ast", fileName: string) => {
		vscode.postMessage({
			type: "ospEditRulesMixin",
			ospFileType: type,
			ospFileName: fileName,
		})
	}

	// 切换mixin文件启用状态
	const handleToggleMixin = (type: "regex" | "ast", fileName: string, enabled: boolean) => {
		const filePath = type === "regex" ? "regexMixins" : "astMixins"

		// 更新mixin的启用状态
		const updatedMixins = config.customRulesFiles[filePath].map((mixin: any) => {
			const mixinFileName = mixin.fileName || mixin
			if (mixinFileName === fileName) {
				return { fileName: mixinFileName, enabled }
			}
			return typeof mixin === "string" ? { fileName: mixin, enabled: true } : mixin
		})

		updateConfig({
			...config,
			customRulesFiles: {
				...config.customRulesFiles,
				[filePath]: updatedMixins,
			},
		})
	}

	// 删除mixin文件
	const handleDeleteMixinFile = (type: "regex" | "ast", fileName: string) => {
		const filePath = type === "regex" ? "regexMixins" : "astMixins"
		const newMixins = config.customRulesFiles[filePath].filter((mixin: any) => {
			const mixinFileName = mixin.fileName || mixin
			return mixinFileName !== fileName
		})

		updateConfig({
			...config,
			customRulesFiles: {
				...config.customRulesFiles,
				[filePath]: newMixins,
			},
		})

		vscode.postMessage({
			type: "ospDeleteRulesMixin",
			ospFileType: type,
			ospFileName: fileName,
		})
	}

	// 打开规则文件目录
	const handleOpenRulesDirectory = () => {
		vscode.postMessage({
			type: "ospOpenRulesDirectory",
		})
	}

	return (
		<div {...props}>
			<SectionHeader>
				<div className="flex items-center gap-2">
					<Zap className="w-4" />
					<div>{t("settings:sections.outputStreamProcessor")}</div>
				</div>
			</SectionHeader>

			<Section>
				<div className="space-y-6">
					{/* 内容注入设置 */}
					<div className="border-b border-vscode-panel-border pb-6">
						<div className="flex items-center gap-2 mb-4">
							<Settings className="w-4" />
							<span className="font-semibold text-vscode-foreground">内容注入设置</span>
						</div>

						<div className="space-y-4">
							<div className="flex flex-col gap-1">
								<VSCodeCheckbox
									checked={config.contentInjection.timestampEnabled}
									onChange={(e: any) =>
										handleContentInjectionChange("timestampEnabled", e.target.checked)
									}
									data-testid="timestamp-injection-checkbox">
									<span className="font-medium">启用时间戳注入</span>
								</VSCodeCheckbox>
								<div className="text-vscode-descriptionForeground text-sm ml-5 mt-1">
									将 &lbrace;&lbrace;timestamp&rbrace;&rbrace; 替换为当前时间
								</div>
							</div>

							<div className="flex flex-col gap-1">
								<VSCodeCheckbox
									checked={config.contentInjection.variableEnabled}
									onChange={(e: any) =>
										handleContentInjectionChange("variableEnabled", e.target.checked)
									}
									data-testid="variable-injection-checkbox">
									<span className="font-medium">启用变量注入</span>
								</VSCodeCheckbox>
								<div className="text-vscode-descriptionForeground text-sm ml-5 mt-1">
									支持 &lbrace;&lbrace;variable&rbrace;&rbrace; 格式的变量替换
								</div>
							</div>

							<div className="flex flex-col gap-2">
								<label className="font-medium text-vscode-foreground text-sm">日期格式</label>
								<VSCodeTextField
									value={config.contentInjection.dateFormat}
									onChange={(e: any) => handleContentInjectionChange("dateFormat", e.target.value)}
									placeholder="YYYY-MM-DD HH:mm:ss"
									data-testid="date-format-input"></VSCodeTextField>
								<div className="text-vscode-descriptionForeground text-xs">
									支持的格式：YYYY-MM-DD, HH:mm:ss 等
								</div>
							</div>
						</div>
					</div>

					{/* 动态规则列表 - 按来源分类 */}
					<div className="border-b border-vscode-panel-border pb-6">
						<div className="flex items-center justify-between mb-4">
							<div className="flex items-center gap-2">
								<Zap className="w-4" />
								<span className="font-semibold text-vscode-foreground">规则列表</span>
							</div>
							<div className="flex items-center gap-2">
								<VSCodeButton
									onClick={handleOpenRulesDirectory}
									appearance="icon"
									data-testid="open-rules-directory-button"
									title="打开规则文件目录">
									<FolderOpen className="w-4 h-4" />
								</VSCodeButton>
							</div>
						</div>

						{loading ? (
							<div className="text-vscode-descriptionForeground text-sm">加载规则列表中...</div>
						) : (
							<div className="space-y-6">
								{/* 正则规则分类 */}
								<div>
									<div className="flex items-center gap-2 mb-3">
										<VSCodeButton
											onClick={() => toggleSection("regex")}
											appearance="icon"
											className="w-4 h-4 p-0">
											{expandedSections.regex ? "▼" : "▶"}
										</VSCodeButton>
										<div className="w-3 h-3 bg-vscode-charts-blue rounded-full"></div>
										<span className="font-medium text-vscode-foreground">正则规则</span>
										<span className="text-xs text-vscode-descriptionForeground">
											({Object.keys(availableRules.regex).length} 个)
										</span>
									</div>
									{expandedSections.regex && (
										<div className="ml-4 space-y-4">
											{/* 按来源分类的正则规则 */}
											{Object.keys(availableRules.regex).length > 0 && (
												<div>
													{Object.entries(getRulesBySource("regex")).map(
														([source, rules]) => {
															if (rules.length === 0) return null

															const sourceColors = {
																default: "bg-vscode-charts-blue",
																user: "bg-vscode-charts-green",
																plugin: "bg-vscode-charts-orange",
																custom: "bg-vscode-charts-purple",
																mixin: "bg-vscode-charts-cyan",
															}

															return (
																<div key={source}>
																	<div className="flex items-center gap-2 mb-3">
																		<div
																			className={`w-2 h-2 ${sourceColors[source as keyof typeof sourceColors] || "bg-vscode-charts-gray"} rounded-full`}></div>
																		<span className="text-sm font-medium text-vscode-foreground">
																			{source} 规则
																		</span>
																		<span className="text-xs text-vscode-descriptionForeground">
																			({rules.length} 个)
																		</span>
																	</div>
																	<div className="ml-4 space-y-2">
																		{rules.map((rule) => {
																			const desired = isRuleDesired(
																				rule.id,
																				"regex",
																			)
																			const missingDeps = getMissingDependencies(
																				rule.dependsOn,
																				desired,
																			)

																			return (
																				<div
																					key={rule.id}
																					className="flex items-center gap-3 p-3 border border-vscode-panel-border rounded">
																					<VSCodeCheckbox
																						checked={desired}
																						onChange={() =>
																							handleRuleToggle(
																								rule.id,
																								"regex",
																							)
																						}
																						data-testid={`regex-rule-${rule.id}-checkbox`}></VSCodeCheckbox>
																					<div className="flex-1 space-y-1">
																						<div className="font-medium text-vscode-foreground">
																							{rule.name}
																						</div>
																						<div className="text-xs text-vscode-descriptionForeground font-mono opacity-70">
																							UUID: {rule.id}
																						</div>
																						<div className="text-sm text-vscode-descriptionForeground">
																							{rule.description}
																						</div>
																						<div className="text-xs text-vscode-descriptionForeground space-y-1">
																							<div>
																								模式: {rule.pattern}{" "}
																								(标志:{" "}
																								{rule.flags || "无"})
																							</div>
																							{rule.stage && (
																								<div>
																									阶段:{" "}
																									{rule.stage ===
																									"pre-ast"
																										? "AST前处理"
																										: rule.stage ===
																											  "post-ast"
																											? "AST后处理"
																											: "输出处理"}
																								</div>
																							)}
																							{rule.priority !==
																								undefined && (
																								<div>
																									优先级:{" "}
																									{rule.priority}
																								</div>
																							)}
																							{rule.replacementFunction && (
																								<div>
																									替换函数:{" "}
																									{
																										rule.replacementFunction
																									}
																								</div>
																							)}
																							{rule.replacement &&
																								typeof rule.replacement ===
																									"string" && (
																									<div>
																										替换:{" "}
																										{
																											rule.replacement
																										}
																									</div>
																								)}
																						</div>
																						{rule.groups &&
																							rule.groups.length > 0 && (
																								<div className="text-xs text-vscode-descriptionForeground mt-2">
																									<div className="font-medium">
																										分组信息:
																									</div>
																									{rule.groups?.map(
																										(
																											group: any,
																											idx: number,
																										) => (
																											<div
																												key={
																													idx
																												}
																												className="ml-2">
																												•{" "}
																												{group.name ||
																													`组${idx + 1}`}
																												:{" "}
																												{
																													group.description
																												}
																												{group.example && (
																													<span className="text-vscode-charts-blue">
																														{" "}
																														(
																														{
																															group.example
																														}
																														)
																													</span>
																												)}
																											</div>
																										),
																									)}
																								</div>
																							)}
																						{missingDeps.length > 0 && (
																							<div className="text-xs text-vscode-errorForeground">
																								依赖未启用：
																								{missingDeps.join("、")}
																							</div>
																						)}
																					</div>
																					{rule.source === "default" && (
																						<VSCodeButton
																							onClick={() =>
																								handleCreateMixin(
																									rule.id,
																									"regex",
																								)
																							}
																							appearance="icon"
																							data-testid={`edit-regex-rule-${rule.id}-button`}
																							title="创建mixin文件以编辑此规则">
																							<Copy className="w-4 h-4" />
																						</VSCodeButton>
																					)}
																				</div>
																			)
																		})}
																	</div>
																</div>
															)
														},
													)}
												</div>
											)}

											{/* 正则规则 Mixin 文件 */}
											{config.customRulesFiles.regexMixins.length > 0 && (
												<div>
													<div className="flex items-center gap-2 mb-3">
														<VSCodeButton
															onClick={() => toggleSection("regex-custom")}
															appearance="icon"
															className="w-4 h-4 p-0">
															{expandedSections["regex-custom"] ? "▼" : "▶"}
														</VSCodeButton>
														<div className="w-2 h-2 bg-vscode-charts-green rounded-full"></div>
														<span className="text-sm font-medium text-vscode-foreground">
															自定义规则文件
														</span>
														<span className="text-xs text-vscode-descriptionForeground">
															({config.customRulesFiles.regexMixins.length} 个)
														</span>
													</div>
													{expandedSections["regex-custom"] && (
														<div className="ml-4 space-y-2">
															{config.customRulesFiles.regexMixins.map((mixin: any) => {
																const fileName = mixin.fileName || mixin
																const isEnabled = mixin.enabled !== false
																const _isOverride = fileName.includes("-regex-")

																return (
																	<div
																		key={fileName}
																		className="flex items-center gap-3 p-2 border border-vscode-panel-border rounded">
																		<VSCodeCheckbox
																			checked={isEnabled}
																			onChange={(e: any) =>
																				handleToggleMixin(
																					"regex",
																					fileName,
																					e.target.checked,
																				)
																			}
																			data-testid={`toggle-regex-mixin-${fileName}`}></VSCodeCheckbox>
																		<span className="flex-1 text-sm">
																			{fileName}
																		</span>
																		{_isOverride && (
																			<span className="text-xs text-vscode-charts-blue bg-vscode-charts-blue/10 px-2 py-1 rounded">
																				规则覆盖
																			</span>
																		)}
																		<VSCodeButton
																			onClick={() =>
																				handleEditMixinFile("regex", fileName)
																			}
																			appearance="icon"
																			data-testid={`edit-regex-mixin-${fileName}`}>
																			<Edit2 className="w-4 h-4" />
																		</VSCodeButton>
																		<VSCodeButton
																			onClick={() =>
																				handleDeleteMixinFile("regex", fileName)
																			}
																			appearance="icon"
																			data-testid={`delete-regex-mixin-${fileName}`}>
																			<Trash2 className="w-4 h-4" />
																		</VSCodeButton>
																	</div>
																)
															})}
														</div>
													)}
												</div>
											)}
										</div>
									)}
								</div>

								{/* AST规则分类 */}
								<div>
									<div className="flex items-center gap-2 mb-3">
										<VSCodeButton
											onClick={() => toggleSection("ast")}
											appearance="icon"
											className="w-4 h-4 p-0">
											{expandedSections.ast ? "▼" : "▶"}
										</VSCodeButton>
										<div className="w-3 h-3 bg-vscode-charts-purple rounded-full"></div>
										<span className="font-medium text-vscode-foreground">AST规则</span>
										<span className="text-xs text-vscode-descriptionForeground">
											({Object.keys(availableRules.ast).length} 个)
										</span>
									</div>
									{expandedSections.ast && (
										<div className="ml-4 space-y-4">
											{/* 按来源分类的AST规则 */}
											{Object.keys(availableRules.ast).length > 0 && (
												<div>
													{Object.entries(getRulesBySource("ast")).map(([source, rules]) => {
														if (rules.length === 0) return null

														const sourceColors = {
															default: "bg-vscode-charts-purple",
															user: "bg-vscode-charts-green",
															plugin: "bg-vscode-charts-orange",
															custom: "bg-vscode-charts-purple",
															mixin: "bg-vscode-charts-cyan",
														}

														return (
															<div key={source}>
																<div className="flex items-center gap-2 mb-3">
																	<div
																		className={`w-2 h-2 ${sourceColors[source as keyof typeof sourceColors] || "bg-vscode-charts-gray"} rounded-full`}></div>
																	<span className="text-sm font-medium text-vscode-foreground">
																		{source} AST规则
																	</span>
																	<span className="text-xs text-vscode-descriptionForeground">
																		({rules.length} 个)
																	</span>
																</div>
																<div className="ml-4 space-y-2">
																	{rules.map((rule) => {
																		const desired = isRuleDesired(rule.id, "ast")
																		const missingDeps = getMissingDependencies(
																			rule.dependsOn,
																			desired,
																		)

																		return (
																			<div key={rule.id}>
																				<div className="flex items-center gap-3 p-3 border border-vscode-panel-border rounded">
																					<VSCodeCheckbox
																						checked={desired}
																						onChange={() =>
																							handleRuleToggle(
																								rule.id,
																								"ast",
																							)
																						}
																						data-testid={`ast-rule-${rule.id}-checkbox`}></VSCodeCheckbox>
																					<div className="flex-1 space-y-1">
																						<div className="font-medium text-vscode-foreground">
																							{rule.name}
																						</div>
																						<div className="text-xs text-vscode-descriptionForeground font-mono opacity-70">
																							UUID: {rule.id}
																						</div>
																						<div className="text-sm text-vscode-descriptionForeground">
																							{rule.description}
																						</div>
																						<div className="text-xs text-vscode-descriptionForeground">
																							类型: {rule.nodeType} |
																							动作: {rule.action} |
																							优先级:{" "}
																							{rule.priority || 50}
																						</div>
																						{missingDeps.length > 0 && (
																							<div className="text-xs text-vscode-errorForeground">
																								依赖未启用：
																								{missingDeps.join("、")}
																							</div>
																						)}
																					</div>
																					<VSCodeButton
																						onClick={() =>
																							handleCreateMixin(
																								rule.id,
																								"ast",
																							)
																						}
																						appearance="icon"
																						data-testid={`edit-ast-rule-${rule.id}-button`}
																						title="创建mixin文件以编辑此规则">
																						<Copy className="w-4 h-4" />
																					</VSCodeButton>
																				</div>

																				{desired &&
																					rule.params &&
																					Object.keys(rule.params).length >
																						0 && (
																						<div className="ml-6 pl-3 border-l-2 border-vscode-button-background space-y-2">
																							{Object.entries(
																								rule.params,
																							).map(
																								([
																									paramKey,
																									paramDefaultValue,
																								]) => {
																									// const currentValue = config.builtinRulesConfig?.[rule.id]?.[paramKey] ?? paramDefaultValue
																									const currentValue =
																										paramDefaultValue // 临时使用默认值
																									return (
																										<div
																											key={
																												paramKey
																											}
																											className="flex items-center gap-2">
																											<label className="text-sm text-vscode-foreground min-w-[100px]">
																												{
																													paramKey
																												}
																												:
																											</label>
																											{typeof currentValue ===
																											"boolean" ? (
																												<VSCodeCheckbox
																													checked={
																														currentValue
																													}
																													onChange={(
																														e: any,
																													) =>
																														_handleRuleConfigChange(
																															rule.id,
																															paramKey,
																															e
																																.target
																																.checked,
																														)
																													}></VSCodeCheckbox>
																											) : (
																												<VSCodeTextField
																													value={
																														typeof currentValue ===
																														"string"
																															? currentValue
																															: String(
																																	currentValue ||
																																		"",
																																)
																													}
																													onChange={(
																														e: any,
																													) =>
																														_handleRuleConfigChange(
																															rule.id,
																															paramKey,
																															e
																																.target
																																.value,
																														)
																													}></VSCodeTextField>
																											)}
																										</div>
																									)
																								},
																							)}
																						</div>
																					)}
																			</div>
																		)
																	})}
																</div>
															</div>
														)
													})}
												</div>
											)}

											{/* AST规则 Mixin 文件 */}
											{config.customRulesFiles.astMixins.length > 0 && (
												<div>
													<div className="flex items-center gap-2 mb-3">
														<VSCodeButton
															onClick={() => toggleSection("ast-custom")}
															appearance="icon"
															className="w-4 h-4 p-0">
															{expandedSections["ast-custom"] ? "▼" : "▶"}
														</VSCodeButton>
														<div className="w-2 h-2 bg-vscode-charts-green rounded-full"></div>
														<span className="text-sm font-medium text-vscode-foreground">
															自定义规则文件
														</span>
														<span className="text-xs text-vscode-descriptionForeground">
															({config.customRulesFiles.astMixins.length} 个)
														</span>
													</div>
													{expandedSections["ast-custom"] && (
														<div className="ml-4 space-y-2">
															{config.customRulesFiles.astMixins.map((mixin: any) => {
																const fileName = mixin.fileName || mixin
																const isEnabled = mixin.enabled !== false
																const _isOverride = fileName.includes("-ast-")

																return (
																	<div
																		key={fileName}
																		className="flex items-center gap-3 p-2 border border-vscode-panel-border rounded">
																		<VSCodeCheckbox
																			checked={isEnabled}
																			onChange={(e: any) =>
																				handleToggleMixin(
																					"ast",
																					fileName,
																					e.target.checked,
																				)
																			}
																			data-testid={`toggle-ast-mixin-${fileName}`}></VSCodeCheckbox>
																		<span className="flex-1 text-sm">
																			{fileName}
																		</span>
																		{_isOverride && (
																			<span className="text-xs text-vscode-charts-purple bg-vscode-charts-purple/10 px-2 py-1 rounded">
																				规则覆盖
																			</span>
																		)}
																		<VSCodeButton
																			onClick={() =>
																				handleEditMixinFile("ast", fileName)
																			}
																			appearance="icon"
																			data-testid={`edit-ast-mixin-${fileName}`}>
																			<Edit2 className="w-4 h-4" />
																		</VSCodeButton>
																		<VSCodeButton
																			onClick={() =>
																				handleDeleteMixinFile("ast", fileName)
																			}
																			appearance="icon"
																			data-testid={`delete-ast-mixin-${fileName}`}>
																			<Trash2 className="w-4 h-4" />
																		</VSCodeButton>
																	</div>
																)
															})}
														</div>
													)}
												</div>
											)}
										</div>
									)}
								</div>
							</div>
						)}
					</div>
					{/* 创建自定义规则文件 */}
					<div>
						<div className="flex items-center justify-between mb-4">
							<div className="flex items-center gap-2">
								<FileText className="w-4" />
								<span className="font-semibold text-vscode-foreground">创建自定义规则</span>
							</div>
							<div className="flex items-center gap-2">
								<VSCodeButton
									onClick={() => handleCreateMixinFile("regex")}
									appearance="icon"
									data-testid="create-regex-mixin-button"
									title="创建正则规则文件">
									<Plus className="w-4 h-4" />
								</VSCodeButton>
								<VSCodeButton
									onClick={() => handleCreateMixinFile("ast")}
									appearance="icon"
									data-testid="create-ast-mixin-button"
									title="创建AST规则文件">
									<Plus className="w-4 h-4" />
								</VSCodeButton>
							</div>
						</div>
						<div className="text-vscode-descriptionForeground text-sm">
							点击上方按钮创建新的自定义规则文件。已创建的自定义规则文件将显示在&ldquo;规则列表&rdquo;中的&ldquo;自定义规则文件&rdquo;分类下。
						</div>
					</div>
				</div>
			</Section>
		</div>
	)
}
