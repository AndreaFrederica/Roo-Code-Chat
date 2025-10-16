import { HTMLAttributes } from "react"
import { Layers } from "lucide-react"

import { useAppTranslation } from "@/i18n/TranslationContext"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { vscode } from "@/utils/vscode"
import { Slider } from "@/components/ui"

import { SetCachedStateField } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { useExtensionState } from "@/context/ExtensionStateContext"

import type { WorkspaceContextSettingKey } from "@roo-code/types"
import { WORKSPACE_CONTEXT_SETTING_KEYS } from "@roo-code/types"

type WorkspaceContextSettingsProps = HTMLAttributes<HTMLDivElement> & {
	workspaceContextSettings: Record<WorkspaceContextSettingKey, boolean>
	maxOpenTabsContext?: number
	maxWorkspaceFiles?: number
	setCachedStateField: SetCachedStateField<
		| "maxOpenTabsContext"
		| "maxWorkspaceFiles"
		| "workspaceContextSettings"
	>
}

type ContextOption = {
	key: WorkspaceContextSettingKey
	icon: string
	labelKey: string
	descriptionKey: string
	category: "primary" | "additional"
}

const contextOptions: ContextOption[] = [
	{
		key: "visibleFiles",
		icon: "eye",
		labelKey: "chat:workspaceContext.options.visibleFiles.label",
		descriptionKey: "chat:workspaceContext.options.visibleFiles.description",
		category: "primary",
	},
	{
		key: "openTabs",
		icon: "files",
		labelKey: "chat:workspaceContext.options.openTabs.label",
		descriptionKey: "chat:workspaceContext.options.openTabs.description",
		category: "primary",
	},
	{
		key: "terminals",
		icon: "terminal",
		labelKey: "chat:workspaceContext.options.terminals.label",
		descriptionKey: "chat:workspaceContext.options.terminals.description",
		category: "primary",
	},
	{
		key: "recentFiles",
		icon: "history",
		labelKey: "chat:workspaceContext.options.recentFiles.label",
		descriptionKey: "chat:workspaceContext.options.recentFiles.description",
		category: "additional",
	},
	{
		key: "currentTime",
		icon: "clock",
		labelKey: "chat:workspaceContext.options.currentTime.label",
		descriptionKey: "chat:workspaceContext.options.currentTime.description",
		category: "additional",
	},
	{
		key: "currentCost",
		icon: "credit-card",
		labelKey: "chat:workspaceContext.options.currentCost.label",
		descriptionKey: "chat:workspaceContext.options.currentCost.description",
		category: "additional",
	},
	{
		key: "currentMode",
		icon: "settings",
		labelKey: "chat:workspaceContext.options.currentMode.label",
		descriptionKey: "chat:workspaceContext.options.currentMode.description",
		category: "additional",
	},
	{
		key: "workspaceFiles",
		icon: "list-tree",
		labelKey: "chat:workspaceContext.options.workspaceFiles.label",
		descriptionKey: "chat:workspaceContext.options.workspaceFiles.description",
		category: "additional",
	},
	{
		key: "todo",
		icon: "checklist",
		labelKey: "chat:workspaceContext.options.todo.label",
		descriptionKey: "chat:workspaceContext.options.todo.description",
		category: "additional",
	},
]

export const WorkspaceContextSettings = ({
	workspaceContextSettings,
	maxOpenTabsContext = 10,
	maxWorkspaceFiles = 50,
	setCachedStateField,
	...props
}: WorkspaceContextSettingsProps) => {
	const { t } = useAppTranslation()
	// 移除重复的数据源，直接使用props传入的workspaceContextSettings

	const primaryOptions = contextOptions.filter(option => option.category === "primary")
	const additionalOptions = contextOptions.filter(option => option.category === "additional")

	const handleToggleAll = (enabled: boolean) => {
		const settings = WORKSPACE_CONTEXT_SETTING_KEYS.reduce<Record<WorkspaceContextSettingKey, boolean>>((acc, key) => {
			acc[key] = enabled
			return acc
		}, {} as Record<WorkspaceContextSettingKey, boolean>)
		
		// 使用缓存机制，与AutoApproveSettings保持一致
		setCachedStateField("workspaceContextSettings", settings)
		console.debug("[WorkspaceContext] handleToggleAll", settings)
		
		vscode.postMessage({
			type: "setWorkspaceContextSettings",
			workspaceContextSettings: settings,
		})
	}

	const handleToggleOption = (key: WorkspaceContextSettingKey, value: boolean) => {
		// 使用缓存机制更新单个设置
		const updatedSettings = {
			...workspaceContextSettings,
			[key]: value
		}
		setCachedStateField("workspaceContextSettings", updatedSettings)
		console.debug("[WorkspaceContext] handleToggleOption", { key, value, updatedSettings })
		
		vscode.postMessage({
			type: "setWorkspaceContextSetting",
			workspaceContextKey: key,
			bool: value,
		})
	}

	const enabledCount = WORKSPACE_CONTEXT_SETTING_KEYS.filter(key => workspaceContextSettings[key]).length
	const totalCount = WORKSPACE_CONTEXT_SETTING_KEYS.length
	const allEnabled = enabledCount === totalCount
	const someEnabled = enabledCount > 0

	return (
		<div {...props}>
			<SectionHeader>
				<div className="flex items-center gap-2">
					<Layers className="w-4 h-4" />
					<div>{t("settings:sections.workspaceContext")}</div>
				</div>
			</SectionHeader>

			<Section>
				<div className="space-y-4">
					{/* 主开关 */}
					<VSCodeCheckbox
						checked={someEnabled}
						aria-label={t("settings:workspaceContext.toggleAriaLabel")}
						onChange={() => {
							const newValue = !someEnabled
							handleToggleAll(newValue)
						}}>
						<span className="font-medium">{t("settings:workspaceContext.title")}</span>
					</VSCodeCheckbox>
					<div className="text-vscode-descriptionForeground text-sm mt-1">
						<p>{t("settings:workspaceContext.description")}</p>
					</div>

					{/* 全局控制 */}
					<div className="flex gap-2">
						<button
							className="px-3 py-1 text-sm bg-vscode-button-background text-vscode-button-foreground hover:bg-vscode-button-hoverBackground rounded"
							onClick={() => handleToggleAll(true)}>
							{t("settings:workspaceContext.enableAll")}
						</button>
						<button
							className="px-3 py-1 text-sm bg-vscode-button-secondaryBackground text-vscode-button-secondaryForeground hover:bg-vscode-button-secondaryHoverBackground rounded"
							onClick={() => handleToggleAll(false)}>
							{t("settings:workspaceContext.disableAll")}
						</button>
					</div>

					{/* 主要选项 */}
					<div className="space-y-3">
						<div className="font-medium text-sm text-vscode-descriptionForeground">
							{t("settings:workspaceContext.primaryOptions")}
						</div>
						{primaryOptions.map((option) => (
							<div key={option.key} className="flex items-start gap-3">
								<span className={`codicon codicon-${option.icon} mt-1`} />
								<div className="flex-1">
									<VSCodeCheckbox
										checked={workspaceContextSettings[option.key]}
										onChange={(e: any) => handleToggleOption(option.key, e.target.checked)}
										data-testid={`workspace-context-${option.key}-checkbox`}>
										<span className="font-medium">{t(option.labelKey)}</span>
									</VSCodeCheckbox>
									<div className="text-vscode-descriptionForeground text-sm mt-1">
										{t(option.descriptionKey)}
									</div>
								</div>
							</div>
						))}
					</div>

					{/* 附加选项 */}
					<div className="space-y-3">
						<div className="font-medium text-sm text-vscode-descriptionForeground">
							{t("settings:workspaceContext.additionalOptions")}
						</div>
						{additionalOptions.map((option) => (
							<div key={option.key} className="flex items-start gap-3">
								<span className={`codicon codicon-${option.icon} mt-1`} />
								<div className="flex-1">
									<VSCodeCheckbox
										checked={workspaceContextSettings[option.key]}
										onChange={(e: any) => handleToggleOption(option.key, e.target.checked)}
										data-testid={`workspace-context-${option.key}-checkbox`}>
										<span className="font-medium">{t(option.labelKey)}</span>
									</VSCodeCheckbox>
									<div className="text-vscode-descriptionForeground text-sm mt-1">
										{t(option.descriptionKey)}
									</div>
								</div>
							</div>
						))}
					</div>

				{/* 限制设置 */}
				{(workspaceContextSettings.openTabs || workspaceContextSettings.workspaceFiles) && (
					<div className="space-y-4 pt-4 border-t border-vscode-widget-border">
						<div className="font-medium text-sm text-vscode-descriptionForeground">
							{t("settings:workspaceContext.limits")}
						</div>

						{/* 打开标签页限制 */}
						{workspaceContextSettings.openTabs && (
							<div className="flex flex-col gap-3 pl-3 border-l-2 border-vscode-button-background">
								<div className="flex items-center gap-4 font-bold">
									<span className="codicon codicon-files" />
									<div>{t("settings:contextManagement.openTabs.label")}</div>
								</div>
								<div>
									<div className="flex items-center gap-2">
										<Slider
											min={1}
											max={50}
											step={1}
											value={[maxOpenTabsContext]}
											onValueChange={([value]) => setCachedStateField("maxOpenTabsContext", value)}
											data-testid="max-open-tabs-slider"
										/>
										<span className="w-20">{maxOpenTabsContext}</span>
									</div>
									<div className="text-vscode-descriptionForeground text-sm mt-1">
										{t("settings:contextManagement.openTabs.description")}
									</div>
								</div>
							</div>
						)}

						{/* 工作区文件限制 */}
						{workspaceContextSettings.workspaceFiles && (
							<div className="flex flex-col gap-3 pl-3 border-l-2 border-vscode-button-background">
								<div className="flex items-center gap-4 font-bold">
									<span className="codicon codicon-list-tree" />
									<div>{t("settings:contextManagement.workspaceFiles.label")}</div>
								</div>
								<div>
									<div className="flex items-center gap-2">
										<Slider
											min={0}
											max={200}
											step={10}
											value={[maxWorkspaceFiles]}
											onValueChange={([value]) => setCachedStateField("maxWorkspaceFiles", value)}
											data-testid="max-workspace-files-slider"
										/>
										<span className="w-20">{maxWorkspaceFiles}</span>
									</div>
									<div className="text-vscode-descriptionForeground text-sm mt-1">
										{t("settings:contextManagement.workspaceFiles.description")}
									</div>
								</div>
							</div>
						)}
					</div>
				)}
				</div>
			</Section>
		</div>
	)
}
