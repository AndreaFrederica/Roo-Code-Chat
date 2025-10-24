import { HTMLAttributes, useMemo, useEffect } from "react"
import {
	VSCodeCheckbox,
	VSCodeTextField,
	VSCodeTextArea,
	VSCodeDropdown,
	VSCodeOption,
} from "@vscode/webview-ui-toolkit/react"
import { Puzzle, Globe, Folder } from "lucide-react"

import {
	type AnhExtensionCapability,
	type AnhExtensionCapabilityRegistry,
	type AnhExtensionRuntimeState,
	type AnhExtensionSettingDefinition,
} from "@roo-code/types"

import { useAppTranslation } from "@/i18n/TranslationContext"

import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"

type ExtensionsSettingsProps = HTMLAttributes<HTMLDivElement> & {
	extensions: AnhExtensionRuntimeState[]
	enabledMap: Record<string, boolean | undefined>
	capabilityRegistry?: AnhExtensionCapabilityRegistry
	settings: Record<string, Record<string, unknown>>
	onToggle: (compositeKey: string, enabled: boolean) => void
	onSettingChange: (id: string, key: string, value: unknown) => void
	hasChanges?: boolean
	onSaveChanges?: () => void
	onResetChanges?: () => void
	onHasChangesChange?: (hasChanges: boolean) => void
}

const extensionContainerClass =
	"border border-vscode-panel-border rounded-md bg-vscode-sideBarSectionHeader-background/40 px-3 py-3"
const badgeBaseClass =
	"inline-flex items-center gap-2 rounded-full border px-2 py-0.5 text-xs font-medium leading-none"
const settingsSectionClass = "mt-3 space-y-2 border-t border-vscode-panel-border/50 pt-3"

const capabilityOrder: AnhExtensionCapability[] = ["systemPrompt", "tools"]

// Helper function to determine if extension is global based on entryPath
const isGlobalExtension = (entryPath: string): boolean => {
	// Global extensions are typically in user home directory or .anh-chat global directory
	// Workspace extensions are in the current workspace directory
	return entryPath.includes('.anh-chat') &&
		   (entryPath.includes('Users/') || entryPath.includes('home/') ||
		    entryPath.includes('\\Users\\') || entryPath.includes('\\home\\'))
}

// Helper function to create scope-aware extension key
const getExtensionKey = (extension: AnhExtensionRuntimeState): string => {
	const isGlobal = isGlobalExtension(extension.entryPath)
	// 使用简单的字符串哈希来确保唯一性，与ExtensionManager保持一致的逻辑
	const pathHash = extension.entryPath
		.split('')
		.reduce((hash, char) => {
			const charCode = char.charCodeAt(0)
			hash = ((hash << 5) - hash) + charCode
			return hash & hash // Convert to 32bit integer
		}, 0)
		.toString(16)
		.substring(0, 8)
	const scope = isGlobal ? 'global' : 'workspace'
	return `${extension.id}:${scope}:${pathHash}`
}

export const ExtensionsSettings = ({
	extensions,
	enabledMap,
	capabilityRegistry,
	settings,
	onToggle,
	onSettingChange,
	hasChanges = false,
	onSaveChanges,
	onResetChanges,
	onHasChangesChange,
	...props
}: ExtensionsSettingsProps) => {
	const { t } = useAppTranslation()

	// 监听hasChanges变化，通知父组件
	useEffect(() => {
		onHasChangesChange?.(hasChanges)
	}, [hasChanges, onHasChangesChange])

	const capabilityLabels: Record<AnhExtensionCapability, string> = {
		systemPrompt: t("settings:extensions.capabilityLabels.systemPrompt"),
		tools: "Tools",
	}

	const capabilityStateLabels = {
		active: t("settings:extensions.capabilityStates.active"),
		inactive: t("settings:extensions.capabilityStates.inactive"),
	}
	const systemPromptProviders = capabilityRegistry?.systemPrompt ?? []

	const sortedExtensions = useMemo(
		() => {
			// 不再去重，显示所有扩展（包括全局和本地）
			return extensions.sort((a, b) => {
				// 首先按名称排序
				const nameCompare = a.manifest.name.localeCompare(b.manifest.name, undefined, {
					sensitivity: "base",
				})
				if (nameCompare !== 0) return nameCompare
				
				// 如果名称相同，本地扩展排在前面
				const aIsGlobal = isGlobalExtension(a.entryPath)
				const bIsGlobal = isGlobalExtension(b.entryPath)
				if (aIsGlobal && !bIsGlobal) return 1
				if (!aIsGlobal && bIsGlobal) return -1
				return 0
			})
		},
		[extensions],
	)

	// 检测扩展冲突（同ID的全局和本地扩展）
	const extensionConflicts = useMemo(() => {
		const conflicts = new Map<string, { global: AnhExtensionRuntimeState[], workspace: AnhExtensionRuntimeState[] }>()
		
		extensions.forEach(extension => {
			const isGlobal = isGlobalExtension(extension.entryPath)
			const id = extension.id
			
			if (!conflicts.has(id)) {
				conflicts.set(id, { global: [], workspace: [] })
			}
			
			const conflict = conflicts.get(id)!
			if (isGlobal) {
				conflict.global.push(extension)
			} else {
				conflict.workspace.push(extension)
			}
		})
		
		// 只返回真正有冲突的（同时存在全局和本地扩展）
		const realConflicts = new Map<string, { global: AnhExtensionRuntimeState[], workspace: AnhExtensionRuntimeState[] }>()
		conflicts.forEach((conflict, id) => {
			if (conflict.global.length > 0 && conflict.workspace.length > 0) {
				realConflicts.set(id, conflict)
			}
		})
		
		return realConflicts
	}, [extensions])

	return (
		<div {...props}>
			<SectionHeader>
				<div className="flex items-center gap-2">
					<Puzzle className="w-4 h-4" />
					<div>{t("settings:sections.extensions")}</div>
				</div>
			</SectionHeader>

			<Section>
				<div className="space-y-4">
					<p className="text-sm text-vscode-descriptionForeground m-0">
						{t("settings:extensions.description")}
					</p>
					<div style={{
						display: 'flex',
						alignItems: 'center',
						gap: '6px',
						fontSize: '12px',
						color: 'var(--vscode-descriptionForeground)',
						marginTop: '8px'
					}}>
						<Globe className="w-3 h-3 ui-accent-text flex-shrink-0" />
						<span>全局扩展适用于所有工作区，工作区扩展仅适用于当前工作区</span>
					</div>

					{hasChanges && (
						<div style={{
							backgroundColor: 'var(--vscode-inputValidation-warningBackground)',
							border: '1px solid var(--vscode-inputValidation-warningBorder)',
							borderRadius: '4px',
							padding: '8px 12px',
							marginBottom: '16px',
							display: 'flex',
							justifyContent: 'space-between',
							alignItems: 'center'
						}}>
							<span style={{ color: 'var(--vscode-inputValidation-warningForeground)', fontSize: '12px' }}>
								⚠️ 您有未保存的扩展设置更改
							</span>
							<div style={{ display: 'flex', gap: '8px' }}>
								<button
									style={{
										backgroundColor: 'var(--vscode-button-secondaryBackground)',
										color: 'var(--vscode-button-secondaryForeground)',
										border: '1px solid var(--vscode-button-border)',
										borderRadius: '3px',
										padding: '4px 8px',
										fontSize: '11px',
										cursor: 'pointer'
									}}
									onClick={onResetChanges}
									disabled={!onResetChanges}
								>
									重置
								</button>
								<button
									style={{
										backgroundColor: 'var(--vscode-button-background)',
										color: 'var(--vscode-button-foreground)',
										border: '1px solid var(--vscode-button-border)',
										borderRadius: '3px',
										padding: '4px 8px',
										fontSize: '11px',
										cursor: 'pointer'
									}}
									onClick={onSaveChanges}
									disabled={!onSaveChanges}
								>
									保存更改
								</button>
							</div>
						</div>
					)}

					{sortedExtensions.length === 0 ? (
						<div className="text-sm text-vscode-descriptionForeground">
							{t("settings:extensions.empty")}
						</div>
					) : (
						<div className="space-y-3">
							{sortedExtensions.map((extension) => {
								const extensionKey = getExtensionKey(extension)
								const isGlobal = isGlobalExtension(extension.entryPath)
								const isEnabled =
									enabledMap[extensionKey] ?? extension.enabled ?? extension.manifest.enabled ?? true
								const registeredSet = new Set(extension.registeredCapabilities)
								const declaredCapabilities = capabilityOrder.filter((capability) =>
									extension.manifest.capabilities.includes(capability),
								)
								const settingsSchema = extension.manifest.settings ?? []
								const extensionSettings = settings[extensionKey] ?? {}

								const renderSettingControl = (setting: AnhExtensionSettingDefinition) => {
									const commonDescription = setting.description ? (
										<p className="text-[11px] text-vscode-descriptionForeground m-0">
											{setting.description}
										</p>
									) : null

									if (setting.type === "boolean") {
										const checked = Boolean(
											extensionSettings[setting.id] ??
												(setting.default !== undefined ? setting.default : false),
										)
										return (
											<div key={setting.id} className="space-y-1">
												<VSCodeCheckbox
													checked={checked}
													onChange={(event: any) => {
														onSettingChange(extensionKey, setting.id, event.target.checked)
														onHasChangesChange?.(true)
													}}
												>
													<span className="text-sm font-medium text-vscode-foreground">
														{setting.label}
														{setting.required ? (
															<span className="text-vscode-errorForeground ml-1">*</span>
														) : null}
													</span>
												</VSCodeCheckbox>
												{commonDescription}
											</div>
										)
									}

									const label = (
										<div className="flex items-center justify-between text-xs font-medium text-vscode-foreground">
											<span>{setting.label}</span>
											{setting.required ? (
												<span className="text-vscode-errorForeground">*</span>
											) : null}
										</div>
									)

									switch (setting.type) {
										case "string": {
											const value =
												(typeof extensionSettings[setting.id] === "string"
													? (extensionSettings[setting.id] as string)
													: undefined) ??
												setting.default ??
												""
											const handleInput = (event: any) => {
												onSettingChange(extensionKey, setting.id, event.target.value)
												onHasChangesChange?.(true)
											}

											return (
												<div key={setting.id} className="space-y-1">
													{label}
													{commonDescription}
													{setting.multiline ? (
														<VSCodeTextArea
															rows={4}
															value={value}
															placeholder={setting.placeholder ?? ""}
															onInput={handleInput}
														/>
													) : (
														<VSCodeTextField
															value={value}
															placeholder={setting.placeholder ?? ""}
															onInput={handleInput}
														/>
													)}
												</div>
											)
										}
										case "number": {
											const numericValue = extensionSettings[setting.id] ?? setting.default
											const value =
												numericValue === undefined || numericValue === null
													? ""
													: String(numericValue)
											const handleInput = (event: any) => {
												const raw = event.target.value
												if (raw === "") {
													onSettingChange(extensionKey, setting.id, undefined)
													onHasChangesChange?.(true)
													return
												}
												const parsed = Number(raw)
												if (!Number.isNaN(parsed)) {
													onSettingChange(extensionKey, setting.id, parsed)
													onHasChangesChange?.(true)
												}
											}

											return (
												<div key={setting.id} className="space-y-1">
													{label}
													{commonDescription}
													<VSCodeTextField
														value={value}
														onInput={handleInput}
														{...(setting.min !== undefined ? { min: setting.min } : {})}
														{...(setting.max !== undefined ? { max: setting.max } : {})}
														{...(setting.step !== undefined ? { step: setting.step } : {})}
													/>
												</div>
											)
										}
										case "select": {
											const options = setting.options ?? []
											const currentValue =
												(extensionSettings[setting.id] as string | undefined) ??
												setting.default ??
												options[0]?.value ??
												""
											const handleChange = (event: any) => {
												onSettingChange(extensionKey, setting.id, event.target.value)
												onHasChangesChange?.(true)
											}

											return (
												<div key={setting.id} className="space-y-1">
													{label}
													{commonDescription}
													<VSCodeDropdown value={currentValue} onChange={handleChange}>
														{options.map((option) => (
															<VSCodeOption key={option.value} value={option.value}>
																{option.label}
															</VSCodeOption>
														))}
													</VSCodeDropdown>
												</div>
											)
										}
										default:
											return null
									}
								}

								return (
									<div key={extensionKey} className={extensionContainerClass}>
										{/* 冲突警告 */}
										{extensionConflicts.has(extension.id) && (
											<div style={{
												backgroundColor: 'var(--vscode-inputValidation-warningBackground)',
												border: '1px solid var(--vscode-inputValidation-warningBorder)',
												borderRadius: '4px',
												padding: '6px 8px',
												marginBottom: '12px',
												fontSize: '11px',
												color: 'var(--vscode-inputValidation-warningForeground)',
												display: 'flex',
												alignItems: 'center',
												gap: '6px'
											}}>
												<span>⚠️</span>
												<span>
													检测到同ID扩展冲突：存在同名的全局和工作区扩展。工作区扩展将优先生效。
												</span>
											</div>
										)}
										
										<div className="flex items-start justify-between gap-4">
											<div className="space-y-2">
												<div className="flex items-center gap-2">
													{isGlobalExtension(extension.entryPath) ? (
														<span title="全局扩展">
															<Globe className="w-3 h-3 ui-accent-text flex-shrink-0" />
														</span>
													) : (
														<span title="工作区扩展">
															<Folder className="w-3 h-3 text-green-400 flex-shrink-0" />
														</span>
													)}
													<span className="font-medium text-sm text-vscode-foreground">
														{extension.manifest.name}
													</span>
													{extension.manifest.version && (
														<span className="text-xs text-vscode-descriptionForeground">
															v{extension.manifest.version}
														</span>
													)}
												</div>
												{extension.manifest.description && (
													<p className="text-xs text-vscode-descriptionForeground m-0">
														{extension.manifest.description}
													</p>
												)}
												{extension.error ? (
													<p className="text-xs text-vscode-errorForeground m-0">
														{t("settings:extensions.error", { error: extension.error })}
													</p>
												) : null}

												<div className="space-y-1">
													<div className="text-xs font-semibold text-vscode-foreground">
														{t("settings:extensions.capabilitiesTitle")}
													</div>
													{declaredCapabilities.length === 0 ? (
														<div className="text-xs text-vscode-descriptionForeground">
															{t("settings:extensions.noCapabilities")}
														</div>
													) : (
														<div className="flex flex-wrap gap-2">
															{declaredCapabilities.map((capability) => {
																const isRegistered = registeredSet.has(capability)
																return (
																	<span
																		key={`${extension.id}-${capability}`}
																		className={`${badgeBaseClass} ${
																			isRegistered
																				? "border-vscode-focusBorder text-vscode-foreground bg-vscode-inputOption-activeBackground"
																				: "border-transparent bg-vscode-editorWidget-background text-vscode-descriptionForeground"
																		}`}
																	>
																		<span>{capabilityLabels[capability]}</span>
																		<span
																			className={`text-[10px] uppercase tracking-wide ${
																				isRegistered
																					? "text-vscode-foreground"
																					: "text-vscode-descriptionForeground"
																			}`}
																		>
																			{isRegistered
																				? capabilityStateLabels.active
																				: capabilityStateLabels.inactive}
																		</span>
																	</span>
																)
															})}
														</div>
													)}
												</div>
											</div>

											<VSCodeCheckbox
												checked={isEnabled}
												onChange={(event: any) => {
													onToggle(extensionKey, event.target.checked)
													onHasChangesChange?.(true)
												}}
												disabled={Boolean(extension.error)}
											>
												{t("settings:extensions.enableLabel")}
											</VSCodeCheckbox>
										</div>

										{settingsSchema.length > 0 && (
											<div className={settingsSectionClass}>
												<div className="text-xs font-semibold text-vscode-foreground">
													{t("settings:extensions.settingsTitle")}
												</div>
												<div className="space-y-2">
													{settingsSchema.map((setting) => renderSettingControl(setting))}
												</div>
											</div>
										)}
									</div>
								)
							})}
						</div>
					)}

					{systemPromptProviders.length > 0 && (
						<p className="text-xs text-vscode-descriptionForeground m-0">
							{t("settings:extensions.registrySummary.systemPrompt", {
								count: systemPromptProviders.length,
								names: systemPromptProviders.join(", "),
							})}
						</p>
					)}
				</div>
			</Section>
		</div>
	)
}
