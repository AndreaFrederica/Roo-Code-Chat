import { HTMLAttributes } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { VSCodeCheckbox, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { Glasses, Database } from "lucide-react"
import { telemetryClient } from "@/utils/TelemetryClient"

import { SetCachedStateField } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { ExtensionStateContextType } from "@/context/ExtensionStateContext"

interface UISettingsProps extends HTMLAttributes<HTMLDivElement> {
	reasoningBlockCollapsed: boolean
	anhChatModeHideTaskCompletion: boolean
	anhShowRoleCardOnSwitch: boolean
	hideRoleDescription: boolean
	variableStateDisplayRows: number
	variableStateDisplayColumns: number
	setCachedStateField: SetCachedStateField<keyof ExtensionStateContextType>
}

export const UISettings = ({
	reasoningBlockCollapsed,
	anhChatModeHideTaskCompletion,
	anhShowRoleCardOnSwitch,
	hideRoleDescription,
	variableStateDisplayRows,
	variableStateDisplayColumns,
	setCachedStateField,
	...props
}: UISettingsProps) => {
	const { t } = useAppTranslation()

	const handleReasoningBlockCollapsedChange = (value: boolean) => {
		setCachedStateField("reasoningBlockCollapsed", value)

		// Track telemetry event
		telemetryClient.capture("ui_settings_collapse_thinking_changed", {
			enabled: value,
		})
	}

	const handleAnhChatModeHideTaskCompletionChange = (value: boolean) => {
		setCachedStateField("anhChatModeHideTaskCompletion", value)

		// Track telemetry event
		telemetryClient.capture("ui_settings_anh_chat_hide_task_completion_changed", {
			enabled: value,
		})
	}

	const handleAnhShowRoleCardOnSwitchChange = (value: boolean) => {
		setCachedStateField("anhShowRoleCardOnSwitch", value)

		// Track telemetry event
		telemetryClient.capture("ui_settings_anh_show_role_card_on_switch_changed", {
			enabled: value,
		})
	}

	const handleHideRoleDescriptionChange = (value: boolean) => {
		setCachedStateField("hideRoleDescription", value)

		// Track telemetry event
		telemetryClient.capture("ui_settings_hide_role_description_changed", {
			enabled: value,
		})
	}

	const handleVariableStateDisplayRowsChange = (value: string) => {
		const numValue = parseInt(value, 10)
		if (!isNaN(numValue) && numValue > 0 && numValue <= 10) {
			setCachedStateField("variableStateDisplayRows", numValue)

			// Track telemetry event
			telemetryClient.capture("ui_settings_variable_state_display_rows_changed", {
				rows: numValue,
			})
		}
	}

	const handleVariableStateDisplayColumnsChange = (value: string) => {
		const numValue = parseInt(value, 10)
		if (!isNaN(numValue) && numValue > 0 && numValue <= 5) {
			setCachedStateField("variableStateDisplayColumns", numValue)

			// Track telemetry event
			telemetryClient.capture("ui_settings_variable_state_display_columns_changed", {
				columns: numValue,
			})
		}
	}

	return (
		<div {...props}>
			<SectionHeader>
				<div className="flex items-center gap-2">
					<Glasses className="w-4" />
					<div>{t("settings:sections.ui")}</div>
				</div>
			</SectionHeader>

			<Section>
				<div className="space-y-6">
					{/* Collapse Thinking Messages Setting */}
					<div className="flex flex-col gap-1">
						<VSCodeCheckbox
							checked={reasoningBlockCollapsed}
							onChange={(e: any) => handleReasoningBlockCollapsedChange(e.target.checked)}
							data-testid="collapse-thinking-checkbox">
							<span className="font-medium">{t("settings:ui.collapseThinking.label")}</span>
						</VSCodeCheckbox>
						<div className="text-vscode-descriptionForeground text-sm ml-5 mt-1">
							{t("settings:ui.collapseThinking.description")}
						</div>
					</div>

					{/* ANH Chat Mode Hide Task Completion Setting */}
					<div className="flex flex-col gap-1">
						<VSCodeCheckbox
							checked={anhChatModeHideTaskCompletion}
							onChange={(e: any) => handleAnhChatModeHideTaskCompletionChange(e.target.checked)}
							data-testid="anh-chat-hide-task-completion-checkbox">
							<span className="font-medium">{t("settings:ui.anhChatModeHideTaskCompletion.label")}</span>
						</VSCodeCheckbox>
						<div className="text-vscode-descriptionForeground text-sm ml-5 mt-1">
							{t("settings:ui.anhChatModeHideTaskCompletion.description")}
						</div>
					</div>

					{/* ANH Show Role Card On Switch Setting */}
					<div className="flex flex-col gap-1">
						<VSCodeCheckbox
							checked={anhShowRoleCardOnSwitch}
							onChange={(e: any) => handleAnhShowRoleCardOnSwitchChange(e.target.checked)}
							data-testid="anh-show-role-card-on-switch-checkbox">
							<span className="font-medium">{t("settings:ui.anhShowRoleCardOnSwitch.label")}</span>
						</VSCodeCheckbox>
						<div className="text-vscode-descriptionForeground text-sm ml-5 mt-1">
							{t("settings:ui.anhShowRoleCardOnSwitch.description")}
						</div>
					</div>

					{/* Hide Role Description Setting */}
					<div className="flex flex-col gap-1">
						<VSCodeCheckbox
							checked={hideRoleDescription}
							onChange={(e: any) => handleHideRoleDescriptionChange(e.target.checked)}
							data-testid="hide-role-description-checkbox">
							<span className="font-medium">{t("settings:ui.hideRoleDescription.label")}</span>
						</VSCodeCheckbox>
						<div className="text-vscode-descriptionForeground text-sm ml-5 mt-1">
							{t("settings:ui.hideRoleDescription.description")}
						</div>
					</div>

					{/* Variable State Display Settings */}
					<div className="border-t border-vscode-panel-border pt-6 mt-6">
						<div className="flex items-center gap-2 mb-4">
							<Database className="w-4" />
							<span className="font-semibold text-vscode-foreground">{t("settings:ui.variableStateDisplay.title")}</span>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							{/* Variable State Display Rows */}
							<div className="flex flex-col gap-2">
								<label className="font-medium text-vscode-foreground text-sm">
									{t("settings:ui.variableStateDisplay.rows.label")}
								</label>
								<VSCodeTextField
									value={variableStateDisplayRows.toString()}
									onChange={(e: any) => handleVariableStateDisplayRowsChange(e.target.value)}
									data-testid="variable-state-display-rows-input">
								</VSCodeTextField>
								<div className="text-vscode-descriptionForeground text-xs">
									{t("settings:ui.variableStateDisplay.rows.description")}
								</div>
							</div>

							{/* Variable State Display Columns */}
							<div className="flex flex-col gap-2">
								<label className="font-medium text-vscode-foreground text-sm">
									{t("settings:ui.variableStateDisplay.columns.label")}
								</label>
								<VSCodeTextField
									value={variableStateDisplayColumns.toString()}
									onChange={(e: any) => handleVariableStateDisplayColumnsChange(e.target.value)}
									data-testid="variable-state-display-columns-input">
								</VSCodeTextField>
								<div className="text-vscode-descriptionForeground text-xs">
									{t("settings:ui.variableStateDisplay.columns.description")}
								</div>
							</div>
						</div>
					</div>
				</div>
			</Section>
		</div>
	)
}
