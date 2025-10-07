import { HTMLAttributes } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { Glasses } from "lucide-react"
import { telemetryClient } from "@/utils/TelemetryClient"

import { SetCachedStateField } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { ExtensionStateContextType } from "@/context/ExtensionStateContext"

interface UISettingsProps extends HTMLAttributes<HTMLDivElement> {
	reasoningBlockCollapsed: boolean
	anhChatModeHideTaskCompletion: boolean
	anhShowRoleCardOnSwitch: boolean
	setCachedStateField: SetCachedStateField<keyof ExtensionStateContextType>
}

export const UISettings = ({ reasoningBlockCollapsed, anhChatModeHideTaskCompletion, anhShowRoleCardOnSwitch, setCachedStateField, ...props }: UISettingsProps) => {
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
				</div>
			</Section>
		</div>
	)
}
