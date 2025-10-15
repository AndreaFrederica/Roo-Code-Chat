import React, { HTMLAttributes, useState, useEffect, useMemo, forwardRef, useImperativeHandle } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { BookOpen, FileText, FolderOpen, RefreshCw, Play, Square, Globe, Folder } from "lucide-react"
import { cn } from "@/lib/utils"
import { vscode } from "@/utils/vscode"

import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"

interface WorldsetFile {
	name: string
	path: string
	scope?: "global" | "workspace"
}

interface WorldsetStatus {
	enabled: boolean
	enabledWorldsets?: string[] // 改为存储 "name-scope" 格式
}

interface CachedWorldsetStatus {
	enabledWorldsets: string[]
}

type WorldviewSettingsProps = HTMLAttributes<HTMLDivElement> & {
	// 统一保存系统接口
	onHasChangesChange?: (hasChanges: boolean) => void;
	onSaveChanges?: () => Promise<void>;
	onResetChanges?: () => void;
}

export const WorldviewSettings = forwardRef<
	{ handleSaveChanges: () => Promise<void> },
	WorldviewSettingsProps
>(({
	className,
	onHasChangesChange,
	onSaveChanges,
	onResetChanges,
	...props
}, ref) => {
	const { t } = useAppTranslation()
	const [worldsetFiles, setWorldsetFiles] = useState<WorldsetFile[]>([])
	const [selectedWorldset, setSelectedWorldset] = useState<string | null>(null)
	const [selectedWorldsetScope, setSelectedWorldsetScope] = useState<"global" | "workspace" | null>(null)
	const [worldsetContent, setWorldsetContent] = useState<string>("")
	const [worldsetStatus, setWorldsetStatus] = useState<WorldsetStatus>({ enabled: false })
	const [cachedWorldsetStatus, setCachedWorldsetStatus] = useState<CachedWorldsetStatus>({
		enabledWorldsets: []
	})
	const [originalWorldsetStatus, setOriginalWorldsetStatus] = useState<CachedWorldsetStatus>({
		enabledWorldsets: []
	})
	const [loading, setLoading] = useState(false)

	// 检查是否有变更
	const hasChanges = useMemo(() => {
		return JSON.stringify(cachedWorldsetStatus.enabledWorldsets.sort()) !==
		       JSON.stringify(originalWorldsetStatus.enabledWorldsets.sort())
	}, [cachedWorldsetStatus.enabledWorldsets, originalWorldsetStatus.enabledWorldsets])

	// 初始化：创建worldset文件夹并加载列表
	useEffect(() => {
		const initializeWorldsets = async () => {
			try {
				// 创建worldset文件夹
				vscode.postMessage({ type: "createWorldsetFolder" })
				// 获取世界观状态
				vscode.postMessage({ type: "getWorldsetStatus" })
				// 获取世界观文件列表
				vscode.postMessage({ type: "getWorldsetList" })
			} catch (error) {
				console.error("Failed to initialize worldsets:", error)
			}
		}
		initializeWorldsets()
	}, [])

	// 监听来自后端的消息
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			switch (message.type) {
				case "worldsetList":
					// worldsetFiles 现在已经是 WorldsetFile[] 类型
					setWorldsetFiles(message.worldsetFiles || [])
					break
				case "worldsetContent":
					setWorldsetContent(message.worldsetContent || "")
					setLoading(false)
					break
				case "worldsetStatusUpdate": {
					const serverStatus = {
						enabled: message.worldsetStatus?.enabled || false,
						enabledWorldsets: message.worldsetStatus?.enabledWorldsets || []
					}
					setWorldsetStatus(serverStatus)
					
					// 只在初始化时同步状态（当原始状态为空时）
					if (originalWorldsetStatus.enabledWorldsets.length === 0) {
						const enabledWorldsets = [...serverStatus.enabledWorldsets]
						setCachedWorldsetStatus({ enabledWorldsets })
						setOriginalWorldsetStatus({ enabledWorldsets })
					}
					break
				}
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [])

	// 通知父组件变更状态
	useEffect(() => {
		onHasChangesChange?.(hasChanges)
	}, [hasChanges])

	// 选择世界观文件
	const handleWorldsetSelect = (fileName: string, scope: "global" | "workspace" = "workspace") => {
		setSelectedWorldset(fileName)
		setSelectedWorldsetScope(scope)
		setLoading(true)
		vscode.postMessage({
			type: "readWorldsetFile",
			worldsetName: fileName,
			isGlobal: scope === "global"
		})
	}

	// 启用世界观（暂存模式）
	const handleEnableWorldset = (fileName: string, scope: "global" | "workspace" = "workspace") => {
		const worldsetKey = `${fileName}-${scope}`
		setCachedWorldsetStatus(prev => {
			const newEnabledWorldsets = [...prev.enabledWorldsets, worldsetKey].filter((key, index, arr) => arr.indexOf(key) === index)
			// 同步更新显示状态
			setWorldsetStatus(() => ({
				enabled: true,
				enabledWorldsets: newEnabledWorldsets
			}))
			return {
				enabledWorldsets: newEnabledWorldsets
			}
		})
	}

	// 禁用世界观（暂存模式）
	const handleDisableWorldset = (fileName?: string, scope?: "global" | "workspace") => {
		if (fileName && scope) {
			// 禁用特定的worldset
			const worldsetKey = `${fileName}-${scope}`
			setCachedWorldsetStatus(prev => {
				const newEnabledWorldsets = prev.enabledWorldsets.filter(key => key !== worldsetKey)
				// 同步更新显示状态
				setWorldsetStatus(() => ({
					enabled: newEnabledWorldsets.length > 0,
					enabledWorldsets: newEnabledWorldsets
				}))
				return {
					enabledWorldsets: newEnabledWorldsets
				}
			})
		} else {
			// 禁用所有worldsets
			setCachedWorldsetStatus({
				enabledWorldsets: []
			})
			// 更新显示状态
			setWorldsetStatus({ enabled: false, enabledWorldsets: [] })
		}
	}

	// 保存更改到后端
	const handleSaveChanges = async () => {
		if (!hasChanges) return

		setLoading(true)
		try {
			const currentEnabled = new Set(cachedWorldsetStatus.enabledWorldsets)
			const previousEnabled = new Set(originalWorldsetStatus.enabledWorldsets)

			// 找出需要启用和禁用的worldsets
			const toEnable = cachedWorldsetStatus.enabledWorldsets.filter(key => !previousEnabled.has(key))
			const toDisable = originalWorldsetStatus.enabledWorldsets.filter(key => !currentEnabled.has(key))

			// 批量发送更改
			toEnable.forEach(worldsetKey => {
				const [worldsetName, scope] = worldsetKey.split('-')
				vscode.postMessage({
					type: "enableWorldset",
					worldsetName,
					worldsetScope: scope as "global" | "workspace"
				})
			})

			toDisable.forEach(worldsetKey => {
				const [worldsetName, scope] = worldsetKey.split('-')
				vscode.postMessage({
					type: "disableWorldset",
					worldsetName,
					worldsetScope: scope as "global" | "workspace"
				})
			})

			// 如果没有启用的worldsets，发送禁用全部消息
			if (cachedWorldsetStatus.enabledWorldsets.length === 0) {
				vscode.postMessage({ type: "disableAllWorldsets" })
			}

			console.log("Worldview changes saved successfully")

			// 只有在保存成功后才更新原始状态
			setOriginalWorldsetStatus({ enabledWorldsets: [...cachedWorldsetStatus.enabledWorldsets] })
		} catch (error) {
			console.error("Failed to save worldview changes:", error)
			// 可以在这里添加错误提示给用户
		} finally {
			setLoading(false)
		}
	}

	// 重置更改
	const handleResetChanges = () => {
		// 重置本地缓存状态
		setCachedWorldsetStatus({
			enabledWorldsets: [...originalWorldsetStatus.enabledWorldsets]
		})
	}

	// 刷新世界观列表
	const handleRefresh = () => {
		vscode.postMessage({ type: "getWorldsetList" })
		vscode.postMessage({ type: "getWorldsetStatus" })
	}

	// 打开worldset文件夹
	const handleOpenFolder = () => {
		vscode.postMessage({ type: "openWorldsetFolder" })
	}

	// 使用useImperativeHandle暴露handleSaveChanges方法给父组件
	useImperativeHandle(ref, () => ({
		handleSaveChanges
	}), [handleSaveChanges]);

	return (
		<div className={cn("flex flex-col gap-4", className)} {...props}>
			<SectionHeader>
				<div className="flex items-center gap-2">
					<BookOpen className="w-4 h-4" />
					<div>世界观设置</div>
				</div>
			</SectionHeader>

			{/* 当前状态显示 */}
			<Section>
				<div className="flex items-center justify-between p-3 bg-vscode-editor-background rounded border border-vscode-widget-border">
					<div className="flex items-center gap-2">
						<div className={cn(
							"w-2 h-2 rounded-full",
							cachedWorldsetStatus.enabledWorldsets.length > 0 ? "bg-green-400" : "bg-gray-400"
						)} />
						<span className="text-sm font-medium">
							{cachedWorldsetStatus.enabledWorldsets.length > 0 ? "已启用" : "未启用"}
						</span>
						{hasChanges && (
							<span className="text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-400 ml-2">
								未保存
							</span>
						)}
						{cachedWorldsetStatus.enabledWorldsets && cachedWorldsetStatus.enabledWorldsets.length > 0 && (
							<div className="flex flex-wrap gap-1 ml-2">
								{cachedWorldsetStatus.enabledWorldsets.map((worldsetKey) => {
									const [worldsetName, scope] = worldsetKey.split('-')
									const worldset = worldsetFiles.find(w => w.name === worldsetName && w.scope === scope)
									return (
										<span
											key={worldsetKey}
											className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400 flex items-center gap-1"
										>
											{worldsetName}
											{/* Scope indicator for both global and workspace */}
											{scope === "global" ? (
												<span title="全局">
													<Globe className="w-2 h-2" />
												</span>
											) : (
												<span title="工作区">
													<Folder className="w-2 h-2" />
												</span>
											)}
											<button
												className="hover:bg-red-500/30 rounded-full p-0.5"
												onClick={() => handleDisableWorldset(worldsetName, scope as "global" | "workspace")}
												title={`禁用 ${worldsetName} (${scope === "global" ? "全局" : "工作区"})`}
											>
												<Square className="w-2 h-2" />
											</button>
										</span>
									)
								})}
							</div>
						)}
					</div>
					<div className="flex gap-2">
						{cachedWorldsetStatus.enabledWorldsets.length > 0 && (
							<button
								className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
								onClick={() => handleDisableWorldset()}
							>
								<Square className="w-3 h-3 inline mr-1" />
								全部禁用
							</button>
						)}
						{hasChanges && (
							<button
								className="px-2 py-1 text-xs bg-gray-500/20 text-gray-400 rounded hover:bg-gray-500/30"
								onClick={handleResetChanges}
							>
								<RefreshCw className="w-3 h-3 inline mr-1" />
								重置更改
							</button>
						)}
					</div>
				</div>
			</Section>

			<Section>
				<div className="flex gap-4 h-96">
					{/* 左栏：世界观文件选择 */}
					<div className="flex-1 border-r border-vscode-sideBar-background pr-4">
						<div className="flex items-center justify-between mb-3">
							<div className="flex items-center gap-2">
								<FileText className="w-4 h-4" />
								<h3 className="text-sm font-medium">世界观文件</h3>
							</div>
							<button
								className="p-1 text-xs hover:bg-vscode-toolbar-hoverBackground rounded"
								onClick={handleRefresh}
								title="刷新列表"
							>
								<RefreshCw className="w-3 h-3" />
							</button>
						</div>
						
						<div className="space-y-2 max-h-80 overflow-y-auto">
							{worldsetFiles.length === 0 ? (
								<div className="text-sm text-vscode-descriptionForeground text-center py-4">
									暂无世界观文件
								</div>
							) : (
								worldsetFiles.map((file) => (
									<div
										key={`${file.name}-${file.scope || "workspace"}`}
										className={cn(
											"p-3 rounded border cursor-pointer transition-colors",
											"hover:bg-vscode-list-hoverBackground",
											selectedWorldset === file.name && selectedWorldsetScope === (file.scope || "workspace")
												? "bg-vscode-list-activeSelectionBackground border-vscode-focusBorder"
												: "border-vscode-widget-border"
										)}
										onClick={() => handleWorldsetSelect(file.name, file.scope || "workspace")}
									>
										<div className="flex items-center justify-between mb-1">
											<div className="flex items-center gap-2">
												{/* Global/Workspace indicator */}
												{file.scope === "global" ? (
													<span title="全局文件">
														<Globe className="w-3 h-3 text-blue-400 flex-shrink-0" />
													</span>
												) : (
													<span title="工作区文件">
														<Folder className="w-3 h-3 text-green-400 flex-shrink-0" />
													</span>
												)}
												<h4 className="text-sm font-medium truncate">{file.name}</h4>
											</div>
											<div className="flex gap-1">
												{cachedWorldsetStatus.enabledWorldsets?.includes(`${file.name}-${file.scope || "workspace"}`) ? (
													<>
														<span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400">
															已启用
														</span>
														<button
															className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
															onClick={(e) => {
																e.stopPropagation()
																handleDisableWorldset(file.name, file.scope || "workspace")
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
															handleEnableWorldset(file.name, file.scope || "workspace")
														}}
													>
														<Play className="w-3 h-3 inline mr-1" />
														启用
													</button>
												)}
											</div>
										</div>
										<p className="text-xs text-vscode-descriptionForeground">
											{file.path}
										</p>
									</div>
								))
							)}
						</div>
					</div>

					{/* 右栏：世界观内容预览 */}
					<div className="flex-1 pl-4">
						<div className="flex items-center gap-2 mb-3">
							<BookOpen className="w-4 h-4" />
							<h3 className="text-sm font-medium">内容预览</h3>
						</div>

						{selectedWorldset ? (
							<div className="border border-vscode-widget-border rounded p-3 h-full">
								<h4 className="text-sm font-medium mb-2">{selectedWorldset}</h4>
								{loading ? (
									<div className="text-sm text-vscode-descriptionForeground">
										加载中...
									</div>
								) : (
									<div className="text-xs text-vscode-descriptionForeground h-full overflow-y-auto whitespace-pre-wrap">
										{worldsetContent || "暂无内容"}
									</div>
								)}
							</div>
						) : (
							<div className="text-sm text-vscode-descriptionForeground text-center py-8 border border-vscode-widget-border rounded">
								请选择一个世界观文件查看内容
							</div>
						)}
					</div>
				</div>
			</Section>

			{/* 操作按钮区域 */}
			<Section>
				<div className="flex gap-2">
					<button
						className="px-3 py-1.5 text-sm bg-vscode-button-background text-vscode-button-foreground rounded hover:bg-vscode-button-hoverBackground disabled:opacity-50"
						onClick={handleOpenFolder}
					>
						<FolderOpen className="w-4 h-4 inline mr-1" />
						打开文件夹
					</button>
					<button
						className="px-3 py-1.5 text-sm bg-vscode-button-secondaryBackground text-vscode-button-secondaryForeground rounded hover:bg-vscode-button-secondaryHoverBackground"
						onClick={handleRefresh}
					>
						<RefreshCw className="w-4 h-4 inline mr-1" />
						刷新
					</button>
				</div>
			</Section>
		</div>
	)
})
