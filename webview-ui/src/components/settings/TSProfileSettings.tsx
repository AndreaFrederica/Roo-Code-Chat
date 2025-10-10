import React, { HTMLAttributes, useState, useEffect } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { FileText, FolderOpen, RefreshCw, Play, Square, Info, AlertTriangle, CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { vscode } from "@/utils/vscode"
import { StandardTooltip } from "@/components/ui"
import { useExtensionState } from "@/context/ExtensionStateContext"

import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { SetCachedStateField } from "./types"
import type { ExtensionStateContextType } from "@/context/ExtensionStateContext"

interface ProfileInfo {
	name: string
	path: string
	description?: string
	promptsCount?: number
	enabledCount?: number
	lastModified?: number
}

interface TSProfileSettingsProps {
	setCachedStateField: SetCachedStateField<keyof ExtensionStateContextType>
}

type TSProfileSettingsPropsExtended = HTMLAttributes<HTMLDivElement> & TSProfileSettingsProps

export const TSProfileSettings: React.FC<TSProfileSettingsPropsExtended> = ({
	className,
	setCachedStateField,
	...props
}) => {
	const { t } = useAppTranslation()

	// 获取全局状态中的 TSProfile 设置
	const {
		enabledTSProfiles = [],
		anhTsProfileAutoInject = true,
		anhTsProfileVariables = {},
	} = useExtensionState() as ExtensionStateContextType

	const [profiles, setProfiles] = useState<ProfileInfo[]>([])
	const [selectedProfile, setSelectedProfile] = useState<string | null>(null)
	const [profileContent, setProfileContent] = useState<string>("")
	const [loading, setLoading] = useState(false)
	const [validationError, setValidationError] = useState<string | null>(null)
	const [validationSuccess, setValidationSuccess] = useState<string | null>(null)

	// 初始化：创建profile文件夹并加载列表
	useEffect(() => {
		const initializeTSProfiles = async () => {
			try {
				console.log("[TSProfile] Initializing TSProfiles...")
				// 获取TSProfile文件列表
				vscode.postMessage({ type: "loadTsProfiles" })
			} catch (error) {
				console.error("Failed to initialize TSProfiles:", error)
			}
		}
		initializeTSProfiles()
	}, [])

	// 监听来自后端的消息
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data

			switch (message.type) {
				case "tsProfilesLoaded":
					console.log("[TSProfile] Received profiles:", message.profiles)
					setProfiles(message.profiles || [])
					break
				case "tsProfileValidated":
					if (message.tsProfileSuccess) {
						setValidationSuccess(t("settings:tsProfile.validation.success", {
							name: message.tsProfileName,
							promptsCount: message.tsProfilePromptsCount
						}))
					} else {
						setValidationError(t("settings:tsProfile.validation.error", { error: message.tsProfileError }))
					}
					break
				case "tsProfileSelected":
					// 当用户通过浏览器选择文件时
					const fileName = message.path ? message.path.split(/[/\\]/).pop() : ""
					if (fileName) {
						handleProfileSelect(fileName)
					}
					break
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [t])

	// 选择TSProfile文件
	const handleProfileSelect = (fileName: string) => {
		setSelectedProfile(fileName)
		setLoading(true)
		setValidationError(null)
		setValidationSuccess(null)

		// 验证选择的profile
		const profile = profiles.find(p => p.name === fileName)
		if (profile) {
			vscode.postMessage({
				type: "validateTsProfile",
				path: profile.path
			})
		}
		setLoading(false)
	}

	// 启用TSProfile
	const handleEnableTSProfile = (fileName: string) => {
		vscode.postMessage({
			type: "enableTSProfile",
			tsProfileName: fileName
		})
		// 更新本地状态 - 添加到已启用列表
		const newEnabledTSProfiles = [...enabledTSProfiles, fileName].filter((name, index, arr) => arr.indexOf(name) === index)
		setCachedStateField("enabledTSProfiles", newEnabledTSProfiles)
	}

	// 禁用TSProfile
	const handleDisableTSProfile = (fileName?: string) => {
		if (fileName) {
			// 禁用特定的TSProfile
			vscode.postMessage({
				type: "disableTSProfile",
				tsProfileName: fileName
			})
			// 更新本地状态 - 从已启用列表中移除
			const newEnabledTSProfiles = enabledTSProfiles.filter(name => name !== fileName)
			setCachedStateField("enabledTSProfiles", newEnabledTSProfiles)
		} else {
			// 禁用所有TSProfiles
			setCachedStateField("enabledTSProfiles", [])
		}
	}

	// 刷新TSProfile列表
	const handleRefresh = () => {
		vscode.postMessage({ type: "loadTsProfiles" })
	}

	// 浏览选择TSProfile文件
	const handleBrowseProfile = () => {
		vscode.postMessage({
			type: "browseTsProfile",
		})
	}

	// 处理自动注入开关变化
	const handleAutoInjectChange = (value: boolean) => {
		setCachedStateField("anhTsProfileAutoInject", value)
		vscode.postMessage({
			type: "anhTsProfileAutoInject",
			bool: value
		})
	}

	// 处理变量变化
	const handleVariableChange = (key: string, value: string) => {
		const newVariables = { ...anhTsProfileVariables, [key]: value }
		setCachedStateField("anhTsProfileVariables", newVariables)
		vscode.postMessage({
			type: "anhTsProfileVariables",
			values: newVariables
		})
	}

	const handleVariableRemove = (key: string) => {
		const newVariables = { ...anhTsProfileVariables }
		delete newVariables[key]
		setCachedStateField("anhTsProfileVariables", newVariables)
		vscode.postMessage({
			type: "anhTsProfileVariables",
			values: newVariables
		})
	}

	const handleVariableAdd = () => {
		const newKey = `variable_${Object.keys(anhTsProfileVariables).length + 1}`
		const newVariables = { ...anhTsProfileVariables, [newKey]: "" }
		setCachedStateField("anhTsProfileVariables", newVariables)
		vscode.postMessage({
			type: "anhTsProfileVariables",
			values: newVariables
		})
	}

	const currentProfile = profiles.find(p => p.name === selectedProfile)

	return (
		<div className={cn("flex flex-col gap-4", className)} {...props}>
			<SectionHeader description={t("settings:tsProfile.description")}>
				<div className="flex items-center gap-2">
					<FileText className="w-4 h-4" />
					<div>{t("settings:tsProfile.title")}</div>
				</div>
			</SectionHeader>

			{/* 当前状态显示 */}
			<Section>
				<div className="flex items-center justify-between p-3 bg-vscode-editor-background rounded border border-vscode-widget-border">
					<div className="flex items-center gap-2">
						<div className={cn(
							"w-2 h-2 rounded-full",
							enabledTSProfiles.length > 0 ? "bg-green-400" : "bg-gray-400"
						)} />
						<span className="text-sm font-medium">
							{enabledTSProfiles.length > 0 ? `已启用 (${enabledTSProfiles.length})` : "未启用"}
						</span>
						{enabledTSProfiles.length > 0 && (
							<div className="flex flex-wrap gap-1 ml-2">
								{enabledTSProfiles.map((profileName) => (
									<span
										key={profileName}
										className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400 flex items-center gap-1"
									>
										{profileName}
										<button
											className="hover:bg-red-500/30 rounded-full p-0.5"
											onClick={() => handleDisableTSProfile(profileName)}
											title={`禁用 ${profileName}`}
										>
											<Square className="w-2 h-2" />
										</button>
									</span>
								))}
							</div>
						)}
					</div>
					{enabledTSProfiles.length > 0 && (
						<button
							className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
							onClick={() => handleDisableTSProfile()}
						>
							<Square className="w-3 h-3 inline mr-1" />
							全部禁用
						</button>
					)}
				</div>
			</Section>

			{/* 自动注入开关 */}
			<Section>
				<div className="flex items-center justify-between py-3">
					<div className="flex items-center gap-2">
						<label htmlFor="ts-profile-auto-inject" className="text-sm font-medium">
							{t("settings:tsProfile.autoInjectLabel")}
						</label>
						<StandardTooltip content={t("settings:tsProfile.autoInjectTooltip")}>
							<Info className="w-4 h-4 text-vscode-descriptionForeground" />
						</StandardTooltip>
					</div>
					<input
						id="ts-profile-auto-inject"
						type="checkbox"
						checked={anhTsProfileAutoInject}
						onChange={(e) => handleAutoInjectChange(e.target.checked)}
						className="w-4 h-4 rounded border-vscode-input-border bg-vscode-input-background text-vscode-focusBorder focus:ring-vscode-focusBorder"
					/>
				</div>
			</Section>

			<Section>
				<div className="flex gap-4 h-96">
					{/* 左栏：TSProfile文件选择 */}
					<div className="flex-1 border-r border-vscode-sideBar-background pr-4">
						<div className="flex items-center justify-between mb-3">
							<div className="flex items-center gap-2">
								<FileText className="w-4 h-4" />
								<h3 className="text-sm font-medium">TSProfile文件</h3>
							</div>
							<div className="flex gap-1">
								<button
									className="p-1 text-xs hover:bg-vscode-toolbar-hoverBackground rounded"
									onClick={handleRefresh}
									title="刷新列表"
								>
									<RefreshCw className="w-3 h-3" />
								</button>
								<button
									className="p-1 text-xs hover:bg-vscode-toolbar-hoverBackground rounded"
									onClick={handleBrowseProfile}
									title="浏览文件"
								>
									<FolderOpen className="w-3 h-3" />
								</button>
							</div>
						</div>

						<div className="space-y-2 max-h-80 overflow-y-auto">
							{profiles.length === 0 ? (
								<div className="text-sm text-vscode-descriptionForeground text-center py-4">
									暂无TSProfile文件
								</div>
							) : (
								profiles.map((profile) => (
									<div
										key={profile.name}
										className={cn(
											"p-3 rounded border cursor-pointer transition-colors",
											"hover:bg-vscode-list-hoverBackground",
											selectedProfile === profile.name
												? "bg-vscode-list-activeSelectionBackground border-vscode-focusBorder"
												: "border-vscode-widget-border"
										)}
										onClick={() => handleProfileSelect(profile.name)}
									>
										<div className="flex items-center justify-between mb-1">
											<h4 className="text-sm font-medium truncate">{profile.name}</h4>
											<div className="flex gap-1">
												{enabledTSProfiles.includes(profile.name) ? (
													<>
														<span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400">
															已启用
														</span>
														<button
															className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
															onClick={(e) => {
																e.stopPropagation()
																handleDisableTSProfile(profile.name)
															}}
														>
															<Square className="w-3 h-3 inline mr-1" />
															禁用
														</button>
													</>
												) : (
													<button
														className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
														onClick={(e) => {
															e.stopPropagation()
															handleEnableTSProfile(profile.name)
														}}
													>
														<Play className="w-3 h-3 inline mr-1" />
														启用
													</button>
												)}
											</div>
										</div>
										<p className="text-xs text-vscode-descriptionForeground mb-1">
											{profile.description}
										</p>
										<div className="flex items-center justify-between text-xs text-vscode-descriptionForeground">
											<span>{profile.path}</span>
											{profile.promptsCount && (
												<span>{profile.promptsCount} 个提示词</span>
											)}
										</div>
									</div>
								))
							)}
						</div>
					</div>

					{/* 右栏：TSProfile详情和验证状态 */}
					<div className="flex-1 pl-4">
						<div className="flex items-center gap-2 mb-3">
							<FileText className="w-4 h-4" />
							<h3 className="text-sm font-medium">详情信息</h3>
						</div>

						{selectedProfile ? (
							<div className="border border-vscode-widget-border rounded p-3 h-full">
								<h4 className="text-sm font-medium mb-2">{selectedProfile}</h4>
								{currentProfile && (
									<div className="space-y-2 text-xs text-vscode-descriptionForeground">
										<div><strong>路径:</strong> {currentProfile.path}</div>
										{currentProfile.description && (
											<div><strong>描述:</strong> {currentProfile.description}</div>
										)}
										{currentProfile.promptsCount && (
											<div><strong>提示词数量:</strong> {currentProfile.promptsCount}</div>
										)}
										{currentProfile.enabledCount && (
											<div><strong>启用数量:</strong> {currentProfile.enabledCount}</div>
										)}
									</div>
								)}

								{/* 验证状态 */}
								{validationError && (
									<div className="flex items-center gap-2 text-xs text-vscode-errorForeground bg-red-500/10 p-2 rounded mt-2">
										<AlertTriangle className="w-3 h-3" />
										{validationError}
									</div>
								)}
								{validationSuccess && (
									<div className="flex items-center gap-2 text-xs text-vscode-charts-green bg-green-500/10 p-2 rounded mt-2">
										<CheckCircle className="w-3 h-3" />
										{validationSuccess}
									</div>
								)}
							</div>
						) : (
							<div className="text-sm text-vscode-descriptionForeground text-center py-8 border border-vscode-widget-border rounded">
								请选择一个TSProfile文件查看详情
							</div>
						)}
					</div>
				</div>
			</Section>

			{/* 模板变量设置 */}
			<Section>
				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<label className="text-sm font-medium">
								{t("settings:tsProfile.variablesLabel")}
							</label>
							<StandardTooltip content={t("settings:tsProfile.variablesTooltip")}>
								<Info className="w-4 h-4 text-vscode-descriptionForeground" />
							</StandardTooltip>
						</div>
						<button
							onClick={handleVariableAdd}
							className="px-2 py-1 text-xs bg-vscode-button-background hover:bg-vscode-button-hoverBackground text-vscode-button-foreground rounded flex items-center gap-1"
						>
							<Play className="w-3 h-3" />
							{t("common:add")}
						</button>
					</div>

					<div className="space-y-2 max-h-48 overflow-y-auto">
						{Object.entries(anhTsProfileVariables).map(([key, value]) => (
							<div key={key} className="flex items-center gap-2">
								<input
									type="text"
									value={key}
									onChange={(e) => {
										const newVariables = { ...anhTsProfileVariables }
										delete newVariables[key]
										newVariables[e.target.value] = value
										setCachedStateField("anhTsProfileVariables", newVariables)
										vscode.postMessage({
											type: "anhTsProfileVariables",
											values: newVariables
										})
									}}
									placeholder={t("settings:tsProfile.variableNamePlaceholder")}
									className="flex-1 px-2 py-1 text-xs bg-vscode-input-background border border-vscode-input-border rounded focus:outline-none focus:ring-1 focus:ring-vscode-focusBorder"
								/>
								<input
									type="text"
									value={value}
									onChange={(e) => handleVariableChange(key, e.target.value)}
									placeholder={t("settings:tsProfile.variableValuePlaceholder")}
									className="flex-1 px-2 py-1 text-xs bg-vscode-input-background border border-vscode-input-border rounded focus:outline-none focus:ring-1 focus:ring-vscode-focusBorder"
								/>
								<button
									onClick={() => handleVariableRemove(key)}
									className="p-1 text-xs text-vscode-errorForeground hover:bg-vscode-errorForeground/10 rounded"
								>
									<Square className="w-3 h-3" />
								</button>
							</div>
						))}
						{Object.keys(anhTsProfileVariables).length === 0 && (
							<div className="text-center text-vscode-descriptionForeground text-xs py-4">
								{t("settings:tsProfile.noVariables")}
							</div>
						)}
					</div>

					<div className="text-xs text-vscode-descriptionForeground bg-vscode-textBlockQuote-background p-2 rounded">
						{t("settings:tsProfile.variablesHelp")}
					</div>
				</div>
			</Section>
		</div>
	)
}