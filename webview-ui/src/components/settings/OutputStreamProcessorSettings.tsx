import React, { useState, useCallback, useMemo } from "react"
import { HTMLAttributes } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { VSCodeCheckbox, VSCodeTextField, VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { Zap, Code, Settings, FileText, Cpu, Plus, Trash2, Edit2, FolderOpen, Copy } from "lucide-react"
import { vscode } from "@/utils/vscode"

import { SetCachedStateField } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { ExtensionStateContextType } from "@/context/ExtensionStateContext"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { DEFAULT_REGEX_RULES, DEFAULT_AST_RULES } from "../common/builtin-rules-index"

const DEFAULT_ENABLED_RULE_KEYS = new Set<string>(["thinking", "variable"])

interface OutputStreamProcessorSettingsProps extends HTMLAttributes<HTMLDivElement> {
	setCachedStateField: SetCachedStateField<keyof ExtensionStateContextType>
}

// 默认配置 - 只存储配置状态，不存储处理逻辑
const getDefaultConfig = () => ({
	// 内置规则启用状态（默认仅保留基础折叠能力）
	builtinRulesEnabled: {
		thinking: true,
		variable: true,
		tips: false,
	},
	// 内置规则参数配置
	builtinRulesConfig: {
		thinking: {
			defaultFolded: true,
			showIcon: true,
			iconText: "🤔",
			maxPreviewLength: 100
		},
		code: {
			defaultFolded: false,
			showLanguage: true,
			maxHeight: "300px"
		},
		list: {
			threshold: 5,
			showCount: true
		},
		table: {
			threshold: 10,
			showHeaders: true
		},
		blockquote: {
			defaultFolded: false,
			maxPreviewLines: 3,
			showIcon: true
		},
		details: {
			defaultFolded: true,
			native: true
		}
	},
	// 用户自定义规则文件
	customRulesFiles: {
		regexMixins: [] as Array<{ fileName: string; enabled: boolean }>,
		astMixins: [] as Array<{ fileName: string; enabled: boolean }>
	},
	// 内容注入配置
	contentInjection: {
		timestampEnabled: true,
		variableEnabled: true,
		dateFormat: 'YYYY-MM-DD HH:mm:ss'
	}
})

export const OutputStreamProcessorSettings = ({
	setCachedStateField,
	...props
}: OutputStreamProcessorSettingsProps) => {
	const { t } = useAppTranslation()
	const { outputStreamProcessorConfig } = useExtensionState()

	// 获取当前配置 - 优先使用从ExtensionState获取的配置
	const [config, setConfig] = useState(() => {
		// 合并默认配置和已保存的配置
		const defaultConfig = getDefaultConfig()
		return {
			...defaultConfig,
			...outputStreamProcessorConfig,
			// 确保customRulesFiles的结构正确
			customRulesFiles: {
				regexMixins: Array.isArray(outputStreamProcessorConfig?.customRulesFiles?.regexMixins)
					? outputStreamProcessorConfig.customRulesFiles.regexMixins.map((mixin: any) =>
						typeof mixin === 'string' ? { fileName: mixin, enabled: true } : mixin
					)
					: defaultConfig.customRulesFiles.regexMixins,
				astMixins: Array.isArray(outputStreamProcessorConfig?.customRulesFiles?.astMixins)
					? outputStreamProcessorConfig.customRulesFiles.astMixins.map((mixin: any) =>
						typeof mixin === 'string' ? { fileName: mixin, enabled: true } : mixin
					)
					: defaultConfig.customRulesFiles.astMixins
			}
		}
	})

	const builtinRuleRegistry = useMemo(() => {
		const map = new Map<string, { key: string; type: "regex" | "ast"; defaultEnabled: boolean }>() 
		for (const [key, rule] of Object.entries(DEFAULT_REGEX_RULES)) {
			if (!rule.id) continue
			map.set(rule.id, { key, type: "regex", defaultEnabled: !!rule.enabled })
		}
		for (const [key, rule] of Object.entries(DEFAULT_AST_RULES)) {
			if (!rule.id) continue
			map.set(rule.id, { key, type: "ast", defaultEnabled: !!rule.enabled })
		}
		return map
	}, [])

	// 更新配置并通知父组件
	const updateConfig = useCallback((newConfig: any) => {
		setConfig(newConfig)
		setCachedStateField("outputStreamProcessorConfig", newConfig)
	}, [setCachedStateField])

	// 内置规则启用状态切换
	const handleBuiltinRuleToggle = (ruleKey: string, type: "regex" | "ast") => {
		const overrides = config.builtinRulesEnabled || {}
		const currentOverride = overrides[ruleKey]
		const currentDesired = isRuleDesired(ruleKey, type)
		const nextValue = typeof currentOverride === "boolean" ? !currentOverride : !currentDesired

		updateConfig({
			...config,
			builtinRulesEnabled: {
				...overrides,
				[ruleKey]: nextValue
			}
		})
	}

	// 内置规则参数更新
	const handleBuiltinRuleConfigChange = (ruleKey: string, paramPath: string, value: any) => {
		updateConfig({
			...config,
			builtinRulesConfig: {
				...config.builtinRulesConfig,
				[ruleKey]: {
					...config.builtinRulesConfig[ruleKey],
					[paramPath]: value
				}
			}
		})
	}

	const isRuleDesired = useCallback((ruleKey: string, _type: "regex" | "ast"): boolean => {
		const overrideValue = config.builtinRulesEnabled?.[ruleKey]
		if (typeof overrideValue === "boolean") {
			return overrideValue
		}
		return DEFAULT_ENABLED_RULE_KEYS.has(ruleKey)
	}, [config.builtinRulesEnabled])

	const isDependencyActive = useCallback((dependencyId: string): boolean => {
		const meta = builtinRuleRegistry.get(dependencyId)
		if (!meta) {
			return false
		}
		return isRuleDesired(meta.key, meta.type)
	}, [builtinRuleRegistry, isRuleDesired])

	const resolveDependencyNames = useCallback((dependencyIds: string[] = []): string[] => {
		return dependencyIds.map(depId => {
			const meta = builtinRuleRegistry.get(depId)
			if (!meta) {
				return depId
			}
			const labelSource = meta.type === "regex" ? DEFAULT_REGEX_RULES[meta.key] : DEFAULT_AST_RULES[meta.key]
			const friendlyName = labelSource?.description || meta.key
			return friendlyName
		})
	}, [builtinRuleRegistry])

	const getMissingDependencies = useCallback((dependencyIds?: string[], desired?: boolean): string[] => {
		if (!desired || !dependencyIds?.length) {
			return []
		}
		const missing = dependencyIds.filter(id => !isDependencyActive(id))
		return resolveDependencyNames(missing)
	}, [isDependencyActive, resolveDependencyNames])

	// 内容注入配置更新
	const handleContentInjectionChange = (key: string, value: any) => {
		updateConfig({
			...config,
			contentInjection: {
				...config.contentInjection,
				[key]: value
			}
		})
	}

	// 创建新的mixin文件
	const handleCreateMixinFile = (type: 'regex' | 'ast') => {
		const fileName = `custom-${type}-mixin-${Date.now()}.js`

		vscode.postMessage({
			type: "createRulesMixin",
			fileType: type,
			fileName
		})
	}

	// 创建内置规则的mixin文件
	const handleCreateBuiltinMixin = (ruleKey: string, ruleType: 'regex' | 'ast') => {
		const fileName = `builtin-${ruleType}-${ruleKey}-override-${Date.now()}.js`

		vscode.postMessage({
			type: "createRulesMixin",
			fileType: ruleType,
			fileName,
			builtinRuleKey: ruleKey // 告诉后端这是基于哪个内置规则创建的mixin
		})
	}

	// 编辑mixin文件
	const handleEditMixinFile = (type: 'regex' | 'ast', fileName: string) => {
		vscode.postMessage({
			type: "editRulesMixin",
			fileType: type,
			fileName
		})
	}

	// 切换mixin文件启用状态
	const handleToggleMixin = (type: 'regex' | 'ast', fileName: string, enabled: boolean) => {
		const filePath = type === 'regex' ? 'regexMixins' : 'astMixins'

		// 更新mixin的启用状态
		const updatedMixins = config.customRulesFiles[filePath].map((mixin: any) => {
			const mixinFileName = mixin.fileName || mixin
			if (mixinFileName === fileName) {
				return { fileName: mixinFileName, enabled }
			}
			return typeof mixin === 'string' ? { fileName: mixin, enabled: true } : mixin
		})

		updateConfig({
			...config,
			customRulesFiles: {
				...config.customRulesFiles,
				[filePath]: updatedMixins
			}
		})
	}

	// 删除mixin文件
	const handleDeleteMixinFile = (type: 'regex' | 'ast', fileName: string) => {
		const filePath = type === 'regex' ? 'regexMixins' : 'astMixins'
		const newMixins = config.customRulesFiles[filePath].filter((mixin: any) => {
			const mixinFileName = mixin.fileName || mixin
			return mixinFileName !== fileName
		})

		updateConfig({
			...config,
			customRulesFiles: {
				...config.customRulesFiles,
				[filePath]: newMixins
			}
		})

		vscode.postMessage({
			type: "deleteRulesMixin",
			fileType: type,
			fileName
		})
	}

	// 打开规则文件目录
	const handleOpenRulesDirectory = () => {
		vscode.postMessage({
			type: "openRulesDirectory"
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
									onChange={(e: any) => handleContentInjectionChange('timestampEnabled', e.target.checked)}
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
									onChange={(e: any) => handleContentInjectionChange('variableEnabled', e.target.checked)}
									data-testid="variable-injection-checkbox">
									<span className="font-medium">启用变量注入</span>
								</VSCodeCheckbox>
								<div className="text-vscode-descriptionForeground text-sm ml-5 mt-1">
									支持 &lbrace;&lbrace;variable&rbrace;&rbrace; 格式的变量替换
								</div>
							</div>

							<div className="flex flex-col gap-2">
								<label className="font-medium text-vscode-foreground text-sm">
									日期格式
								</label>
								<VSCodeTextField
									value={config.contentInjection.dateFormat}
									onChange={(e: any) => handleContentInjectionChange('dateFormat', e.target.value)}
									placeholder="YYYY-MM-DD HH:mm:ss"
									data-testid="date-format-input">
								</VSCodeTextField>
								<div className="text-vscode-descriptionForeground text-xs">
									支持的格式：YYYY-MM-DD, HH:mm:ss 等
								</div>
							</div>
						</div>
					</div>

					{/* 内置正则规则设置 */}
					<div className="border-b border-vscode-panel-border pb-6">
						<div className="flex items-center justify-between mb-4">
							<div className="flex items-center gap-2">
								<Code className="w-4" />
								<span className="font-semibold text-vscode-foreground">内置正则规则</span>
							</div>
							<VSCodeButton
								onClick={handleOpenRulesDirectory}
								appearance="icon"
								data-testid="open-rules-directory-button">
								<FolderOpen className="w-4 h-4" />
							</VSCodeButton>
						</div>
						<div className="space-y-3">
							{Object.entries(DEFAULT_REGEX_RULES).map(([key, rule]) => {
								const desired = isRuleDesired(key, "regex");
								const missingDeps = getMissingDependencies(rule.dependsOn, desired);

								return (
									<div key={key} className="flex items-center gap-3 p-3 border border-vscode-panel-border rounded">
										<VSCodeCheckbox
											checked={desired}
											onChange={() => handleBuiltinRuleToggle(key, "regex")}
											data-testid={`regex-rule-${key}-checkbox`}>
									</VSCodeCheckbox>
									<div className="flex-1 space-y-1">
										<div className="font-medium text-vscode-foreground">{key}</div>
										<div className="text-sm text-vscode-descriptionForeground">{rule.description}</div>
										<div className="text-xs text-vscode-descriptionForeground">
											模式: {rule.pattern} (标志: {rule.flags || '无'})
										</div>
										{missingDeps.length > 0 && (
											<div className="text-xs text-vscode-errorForeground">
												依赖未启用：{missingDeps.join("、")}
											</div>
										)}
									</div>
									<VSCodeButton
										onClick={() => handleCreateBuiltinMixin(key, 'regex')}
										appearance="icon"
										data-testid={`edit-regex-rule-${key}-button`}
										title="创建mixin文件以编辑此规则">
										<Copy className="w-4 h-4" />
									</VSCodeButton>
								</div>
							)})}
						</div>
					</div>

					{/* 内置AST规则设置 */}
					<div className="border-b border-vscode-panel-border pb-6">
						<div className="flex items-center gap-2 mb-4">
							<Cpu className="w-4" />
							<span className="font-semibold text-vscode-foreground">内置AST规则</span>
						</div>
						<div className="space-y-3">
							{Object.entries(DEFAULT_AST_RULES).map(([key, rule]) => {
								const desired = isRuleDesired(key, "ast");
								const missingDeps = getMissingDependencies(rule.dependsOn, desired);

								return (
									<div key={key} className="space-y-2">
										<div className="flex items-center gap-3 p-3 border border-vscode-panel-border rounded">
											<VSCodeCheckbox
												checked={desired}
												onChange={() => handleBuiltinRuleToggle(key, "ast")}
												data-testid={`ast-rule-${key}-checkbox`}>
											</VSCodeCheckbox>
											<div className="flex-1 space-y-1">
												<div className="font-medium text-vscode-foreground">{key}</div>
												<div className="text-sm text-vscode-descriptionForeground">{rule.description}</div>
												<div className="text-xs text-vscode-descriptionForeground">
													类型: {rule.nodeType} | 动作: {rule.action} | 优先级: {rule.priority || 50}
												</div>
												{missingDeps.length > 0 && (
													<div className="text-xs text-vscode-errorForeground">
														依赖未启用：{missingDeps.join("、")}
													</div>
												)}
											</div>
											<VSCodeButton
												onClick={() => handleCreateBuiltinMixin(key, 'ast')}
												appearance="icon"
												data-testid={`edit-ast-rule-${key}-button`}
												title="创建mixin文件以编辑此规则">
												<Copy className="w-4 h-4" />
											</VSCodeButton>
									</div>

									{desired && config.builtinRulesConfig[key] && (
										<div className="ml-6 pl-3 border-l-2 border-vscode-button-background space-y-2">
											{Object.entries(config.builtinRulesConfig[key]).map(([paramKey, paramValue]) => (
												<div key={paramKey} className="flex items-center gap-2">
													<label className="text-sm text-vscode-foreground min-w-[100px]">
														{paramKey}:
													</label>
													{typeof paramValue === 'boolean' ? (
														<VSCodeCheckbox
															checked={paramValue}
															onChange={(e: any) => handleBuiltinRuleConfigChange(key, paramKey, e.target.checked)}>
														</VSCodeCheckbox>
													) : (
														<VSCodeTextField
															value={typeof paramValue === 'string' ? paramValue : String(paramValue || '')}
															onChange={(e: any) => handleBuiltinRuleConfigChange(key, paramKey, e.target.value)}>
														</VSCodeTextField>
													)}
												</div>
											))}
										</div>
									)}
								</div>
							)})}
						</div>
					</div>
					{/* 自定义规则文件管理 */}
					<div>
						<div className="flex items-center justify-between mb-4">
							<div className="flex items-center gap-2">
								<FileText className="w-4" />
								<span className="font-semibold text-vscode-foreground">自定义规则文件</span>
							</div>
							<div className="flex items-center gap-2">
								<VSCodeButton
									onClick={() => handleCreateMixinFile('regex')}
									appearance="icon"
									data-testid="create-regex-mixin-button">
									<Plus className="w-4 h-4" />
								</VSCodeButton>
								<VSCodeButton
									onClick={() => handleCreateMixinFile('ast')}
									appearance="icon"
									data-testid="create-ast-mixin-button">
									<Plus className="w-4 h-4" />
								</VSCodeButton>
							</div>
						</div>

						<div className="space-y-4">
							{/* 正则规则Mixin文件 */}
							<div>
								<h4 className="font-medium text-vscode-foreground mb-2">正则规则Mixin文件</h4>
								{config.customRulesFiles.regexMixins.length === 0 ? (
									<div className="text-vscode-descriptionForeground text-sm italic">
										暂无自定义正则规则文件
									</div>
								) : (
									<div className="space-y-2">
										{config.customRulesFiles.regexMixins.map((mixin: any) => {
											const fileName = mixin.fileName || mixin
											const isEnabled = mixin.enabled !== false
											const isBuiltinOverride = fileName.includes('builtin-regex-')

											return (
												<div key={fileName} className="flex items-center gap-3 p-2 border border-vscode-panel-border rounded">
													<VSCodeCheckbox
														checked={isEnabled}
														onChange={(e: any) => handleToggleMixin('regex', fileName, e.target.checked)}
														data-testid={`toggle-regex-mixin-${fileName}`}>
													</VSCodeCheckbox>
													<span className="flex-1 text-sm">{fileName}</span>
													{isBuiltinOverride && (
														<span className="text-xs text-vscode-charts-blue bg-vscode-charts-blue/10 px-2 py-1 rounded">
															内置覆盖
														</span>
													)}
													<VSCodeButton
														onClick={() => handleEditMixinFile('regex', fileName)}
														appearance="icon"
														data-testid={`edit-regex-mixin-${fileName}`}>
														<Edit2 className="w-4 h-4" />
													</VSCodeButton>
													<VSCodeButton
														onClick={() => handleDeleteMixinFile('regex', fileName)}
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

							{/* AST规则Mixin文件 */}
							<div>
								<h4 className="font-medium text-vscode-foreground mb-2">AST规则Mixin文件</h4>
								{config.customRulesFiles.astMixins.length === 0 ? (
									<div className="text-vscode-descriptionForeground text-sm italic">
										暂无自定义AST规则文件
									</div>
								) : (
									<div className="space-y-2">
										{config.customRulesFiles.astMixins.map((mixin: any) => {
											const fileName = mixin.fileName || mixin
											const isEnabled = mixin.enabled !== false
											const isBuiltinOverride = fileName.includes('builtin-ast-')

											return (
												<div key={fileName} className="flex items-center gap-3 p-2 border border-vscode-panel-border rounded">
													<VSCodeCheckbox
														checked={isEnabled}
														onChange={(e: any) => handleToggleMixin('ast', fileName, e.target.checked)}
														data-testid={`toggle-ast-mixin-${fileName}`}>
													</VSCodeCheckbox>
													<span className="flex-1 text-sm">{fileName}</span>
													{isBuiltinOverride && (
														<span className="text-xs text-vscode-charts-purple bg-vscode-charts-purple/10 px-2 py-1 rounded">
															内置覆盖
														</span>
													)}
													<VSCodeButton
														onClick={() => handleEditMixinFile('ast', fileName)}
														appearance="icon"
														data-testid={`edit-ast-mixin-${fileName}`}>
														<Edit2 className="w-4 h-4" />
													</VSCodeButton>
													<VSCodeButton
														onClick={() => handleDeleteMixinFile('ast', fileName)}
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
						</div>
					</div>
				</div>
			</Section>
		</div>
	)
}
