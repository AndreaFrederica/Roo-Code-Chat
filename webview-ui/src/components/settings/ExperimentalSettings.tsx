import { HTMLAttributes } from "react"
import { FlaskConical } from "lucide-react"
import { memo } from "react"

import type { Experiments } from "@roo-code/types"
import { VSCodeCheckbox, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import { EXPERIMENT_IDS, experimentConfigsMap } from "@roo/experiments"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { cn } from "@src/lib/utils"
import { useExtensionState } from "../../context/ExtensionStateContext"
import { vscode } from "../../utils/vscode"

import { SetExperimentEnabled } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { ExperimentalFeature } from "./ExperimentalFeature"
import { ImageGenerationSettings } from "./ImageGenerationSettings"

type ExperimentalSettingsProps = HTMLAttributes<HTMLDivElement> & {
	experiments: Experiments
	setExperimentEnabled: SetExperimentEnabled
	apiConfiguration?: any
	setApiConfigurationField?: any
	openRouterImageApiKey?: string
	openRouterImageGenerationSelectedModel?: string
	setOpenRouterImageApiKey?: (apiKey: string) => void
	setImageGenerationSelectedModel?: (model: string) => void
	allowNoToolsInChatMode?: boolean
	setAllowNoToolsInChatMode?: (value: boolean) => void
	onSettingChange?: (key: string, value: any) => void
	enableRooCloudServices?: boolean
	customUserAgent?: string
	customUserAgentMode?: string
	customUserAgentFull?: string
}

export const ExperimentalSettings = memo(({
	experiments,
	setExperimentEnabled,
	apiConfiguration,
	setApiConfigurationField,
	openRouterImageApiKey,
	openRouterImageGenerationSelectedModel,
	setOpenRouterImageApiKey,
	setImageGenerationSelectedModel,
	allowNoToolsInChatMode,
	setAllowNoToolsInChatMode,
	onSettingChange,
	enableRooCloudServices,
	customUserAgent,
	customUserAgentMode,
	customUserAgentFull,
	className,
	...props
}: ExperimentalSettingsProps) => {
	const { t } = useAppTranslation()

	const handleAllowNoToolsInChatModeChange = (e: Event | React.FormEvent<HTMLElement>) => {
		const target = e.target as HTMLInputElement
		const checked = target.checked
		onSettingChange?.("allowNoToolsInChatMode", checked)
	}

	const handleEnableRooCloudServicesChange = (e: Event | React.FormEvent<HTMLElement>) => {
		const target = e.target as HTMLInputElement
		const checked = target.checked
		onSettingChange?.("enableRooCloudServices", checked)
	}

	const handleCustomUserAgentChange = (e: Event | React.FormEvent<HTMLElement>) => {
		const target = e.target as HTMLInputElement
		const value = target.value
		onSettingChange?.("customUserAgent", value)
	}

	const handleCustomUserAgentModeChange = (e: Event | React.FormEvent<HTMLElement>) => {
		const target = e.target as HTMLInputElement
		const checked = target.checked
		const mode = checked ? "full" : "segments"
		onSettingChange?.("customUserAgentMode", mode)
	}

	const handleCustomUserAgentFullChange = (e: Event | React.FormEvent<HTMLElement>) => {
		const target = e.target as HTMLInputElement
		const value = target.value
		onSettingChange?.("customUserAgentFull", value)
	}

	return (
		<div className={cn("flex flex-col gap-2", className)} {...props}>
			<SectionHeader>
				<div className="flex items-center gap-2">
					<FlaskConical className="w-4" />
					<div>{t("settings:sections.experimental")}</div>
				</div>
			</SectionHeader>

			<Section>
				{/* Allow No Tools In Chat Mode Setting */}
				{allowNoToolsInChatMode !== undefined && setAllowNoToolsInChatMode && (
					<div className="flex flex-col gap-1 mb-6">
						<VSCodeCheckbox
							checked={allowNoToolsInChatMode}
							onChange={(e: any) => setAllowNoToolsInChatMode(e.target.checked)}
							data-testid="allow-no-tools-in-chat-mode-checkbox">
							<span className="font-medium">{t("settings:ui.allowNoToolsInChatMode.label")}</span>
						</VSCodeCheckbox>
						<div className="text-vscode-descriptionForeground text-sm ml-5 mt-1">
							{t("settings:ui.allowNoToolsInChatMode.description")}
						</div>
					</div>
				)}

				{Object.entries(experimentConfigsMap)
					.filter(([key]) => key in EXPERIMENT_IDS)
					.map((config) => {
						if (config[0] === "MULTI_FILE_APPLY_DIFF") {
							return (
								<ExperimentalFeature
									key={config[0]}
									experimentKey={config[0]}
									enabled={experiments[EXPERIMENT_IDS.MULTI_FILE_APPLY_DIFF] ?? false}
									onChange={(enabled) =>
										setExperimentEnabled(EXPERIMENT_IDS.MULTI_FILE_APPLY_DIFF, enabled)
									}
								/>
							)
						}
						if (
							config[0] === "IMAGE_GENERATION" &&
							setOpenRouterImageApiKey &&
							setImageGenerationSelectedModel
						) {
							return (
								<ImageGenerationSettings
									key={config[0]}
									enabled={experiments[EXPERIMENT_IDS.IMAGE_GENERATION] ?? false}
									onChange={(enabled) =>
										setExperimentEnabled(EXPERIMENT_IDS.IMAGE_GENERATION, enabled)
									}
									openRouterImageApiKey={openRouterImageApiKey}
									openRouterImageGenerationSelectedModel={openRouterImageGenerationSelectedModel}
									setOpenRouterImageApiKey={setOpenRouterImageApiKey}
									setImageGenerationSelectedModel={setImageGenerationSelectedModel}
								/>
							)
						}
						return (
							<ExperimentalFeature
								key={config[0]}
								experimentKey={config[0]}
								enabled={experiments[EXPERIMENT_IDS[config[0] as keyof typeof EXPERIMENT_IDS]] ?? false}
								onChange={(enabled) =>
									setExperimentEnabled(
										EXPERIMENT_IDS[config[0] as keyof typeof EXPERIMENT_IDS],
										enabled,
									)
								}
							/>
						)
					})}
				{/* Roo Cloud Services Setting */}
				<div className="flex flex-col gap-1 mb-6">
					<VSCodeCheckbox
						checked={enableRooCloudServices ?? false}
						onChange={handleEnableRooCloudServicesChange}
						data-testid="enable-roo-cloud-services-checkbox">
						<span className="font-medium">{t("settings:ui.enableRooCloudServices.label")}</span>
					</VSCodeCheckbox>
					<div className="text-vscode-descriptionForeground text-sm ml-5 mt-1">
						{t("settings:ui.enableRooCloudServices.description")}
					</div>
					<div className="text-orange-500 text-sm ml-5 mt-2 p-2 bg-orange-50 dark:bg-orange-900/20 rounded border border-orange-200 dark:border-orange-800">
						<strong>⚠️ 免责声明：</strong>本项目并非官方 Roo Code，启用云服务功能可能存在风险。使用云服务时，请确保您了解相关的隐私和安全影响。<br/>
						<strong>你应该使用Roo Code链接Roo云服务而不是Anh Chat。</strong>
					</div>
				</div>

				{/* Custom User Agent Setting */}
				<div className="flex flex-col gap-1 mb-6">
					<label className="font-medium text-sm">
						{t("settings:ui.customUserAgent.label")}
					</label>
					
					{/* Mode Toggle */}
					<div className="flex flex-col gap-2 mb-3">
						<VSCodeCheckbox
							checked={customUserAgentMode === "full"}
							onChange={handleCustomUserAgentModeChange}
							data-testid="custom-user-agent-mode-checkbox">
							<span className="font-medium">完全自定义 User-Agent</span>
						</VSCodeCheckbox>
						<div className="text-vscode-descriptionForeground text-sm">
							启用后可以输入完整的 User-Agent 字符串，否则使用分段自定义模式
						</div>
					</div>

					{/* Input Field - changes based on mode */}
					{customUserAgentMode === "full" ? (
						<>
							<VSCodeTextField
								value={customUserAgentFull ?? ""}
								onInput={handleCustomUserAgentFullChange}
								placeholder="输入完整的 User-Agent 字符串，例如：Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36..."
								data-testid="custom-user-agent-full-input"
								className="w-full"
							/>
							<div className="text-vscode-descriptionForeground text-sm mt-1">
								完全自定义模式：输入完整的 User-Agent 字符串，将完全替换默认的 User-Agent
							</div>
							<div className="text-orange-400 text-sm mt-1 p-2 bg-orange-900/20 rounded border border-orange-400/30">
								⚠️ 用户责任声明：使用自定义 User-Agent 可能影响 API 服务的正常工作，请确保您了解相关风险和影响。
							</div>
						</>
					) : (
						<>
							<VSCodeTextField
								value={customUserAgent ?? ""}
								onInput={handleCustomUserAgentChange}
								placeholder={t("settings:ui.customUserAgent.placeholder")}
								data-testid="custom-user-agent-input"
								className="w-full"
							/>
							<div className="text-vscode-descriptionForeground text-sm mt-1">
								{t("settings:ui.customUserAgent.description")}
							</div>
						</>
					)}
				</div>
			</Section>
		</div>
	)
})
