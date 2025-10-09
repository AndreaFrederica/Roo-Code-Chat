import { HTMLAttributes, useMemo } from "react"
import {
	VSCodeCheckbox,
	VSCodeTextField,
	VSCodeTextArea,
	VSCodeDropdown,
	VSCodeOption,
} from "@vscode/webview-ui-toolkit/react"
import { Puzzle } from "lucide-react"

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
	onToggle: (id: string, enabled: boolean) => void
	onSettingChange: (id: string, key: string, value: unknown) => void
}

const extensionContainerClass =
	"border border-vscode-panel-border rounded-md bg-vscode-sideBarSectionHeader-background/40 px-3 py-3"
const badgeBaseClass =
	"inline-flex items-center gap-2 rounded-full border px-2 py-0.5 text-xs font-medium leading-none"
const settingsSectionClass = "mt-3 space-y-2 border-t border-vscode-panel-border/50 pt-3"

const capabilityOrder: AnhExtensionCapability[] = ["systemPrompt", "tools"]

export const ExtensionsSettings = ({
	extensions,
	enabledMap,
	capabilityRegistry,
	settings,
	onToggle,
	onSettingChange,
	...props
}: ExtensionsSettingsProps) => {
	const { t } = useAppTranslation()

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
		() =>
			[...extensions].sort((a, b) =>
				a.manifest.name.localeCompare(b.manifest.name, undefined, {
					sensitivity: "base",
				}),
			),
		[extensions],
	)

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

					{sortedExtensions.length === 0 ? (
						<div className="text-sm text-vscode-descriptionForeground">
							{t("settings:extensions.empty")}
						</div>
					) : (
						<div className="space-y-3">
							{sortedExtensions.map((extension) => {
								const isEnabled =
									enabledMap[extension.id] ?? extension.enabled ?? extension.manifest.enabled ?? true
								const registeredSet = new Set(extension.registeredCapabilities)
								const declaredCapabilities = capabilityOrder.filter((capability) =>
									extension.manifest.capabilities.includes(capability),
								)
								const settingsSchema = extension.manifest.settings ?? []
								const extensionSettings = settings[extension.id] ?? {}

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
													onChange={(event: any) =>
														onSettingChange(extension.id, setting.id, event.target.checked)
													}
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
											const handleInput = (event: any) =>
												onSettingChange(extension.id, setting.id, event.target.value)

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
													onSettingChange(extension.id, setting.id, undefined)
													return
												}
												const parsed = Number(raw)
												if (!Number.isNaN(parsed)) {
													onSettingChange(extension.id, setting.id, parsed)
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
											const handleChange = (event: any) =>
												onSettingChange(extension.id, setting.id, event.target.value)

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
									<div key={extension.id} className={extensionContainerClass}>
										<div className="flex items-start justify-between gap-4">
											<div className="space-y-2">
												<div className="flex items-center gap-2">
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
												onChange={(event: any) => onToggle(extension.id, event.target.checked)}
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
