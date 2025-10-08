import React, { HTMLAttributes, useState, useEffect } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { BookOpen, FileText, FolderOpen, RefreshCw, Play, Square } from "lucide-react"
import { cn } from "@/lib/utils"
import { vscode } from "@/utils/vscode"

import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"

interface WorldsetFile {
	name: string
	path: string
}

interface WorldsetStatus {
	enabled: boolean
	enabledWorldsets?: string[]
}

type WorldviewSettingsProps = HTMLAttributes<HTMLDivElement> & {
	// 可以添加需要的props，比如状态管理相关的
}

export const WorldviewSettings = ({ className, ...props }: WorldviewSettingsProps) => {
	const { t } = useAppTranslation()
	const [worldsetFiles, setWorldsetFiles] = useState<WorldsetFile[]>([])
	const [selectedWorldset, setSelectedWorldset] = useState<string | null>(null)
	const [worldsetContent, setWorldsetContent] = useState<string>("")
	const [worldsetStatus, setWorldsetStatus] = useState<WorldsetStatus>({ enabled: false })
	const [loading, setLoading] = useState(false)

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
				case "worldsetStatusUpdate":
					setWorldsetStatus({
						enabled: message.worldsetStatus?.enabled || false,
						enabledWorldsets: message.worldsetStatus?.enabledWorldsets || []
					})
					break
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [])

	// 选择世界观文件
	const handleWorldsetSelect = (fileName: string) => {
		setSelectedWorldset(fileName)
		setLoading(true)
		vscode.postMessage({ 
			type: "readWorldsetFile", 
			worldsetName: fileName
		})
	}

	// 启用世界观
	const handleEnableWorldset = (fileName: string) => {
		vscode.postMessage({ 
			type: "enableWorldset", 
			worldsetName: fileName
		})
		// 更新本地状态 - 添加到已启用列表
		setWorldsetStatus(prev => ({
			enabled: true,
			enabledWorldsets: [...(prev.enabledWorldsets || []), fileName].filter((name, index, arr) => arr.indexOf(name) === index)
		}))
	}

	// 禁用世界观
	const handleDisableWorldset = (fileName?: string) => {
		if (fileName) {
			// 禁用特定的worldset
			vscode.postMessage({ 
				type: "disableWorldset",
				worldsetName: fileName
			})
			// 更新本地状态 - 从已启用列表中移除
			setWorldsetStatus(prev => {
				const newEnabledWorldsets = (prev.enabledWorldsets || []).filter(name => name !== fileName)
				return {
					enabled: newEnabledWorldsets.length > 0,
					enabledWorldsets: newEnabledWorldsets
				}
			})
		} else {
			// 禁用所有worldsets
			vscode.postMessage({ type: "disableWorldset" })
			// 更新本地状态
			setWorldsetStatus({ enabled: false, enabledWorldsets: [] })
		}
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
							worldsetStatus.enabled ? "bg-green-400" : "bg-gray-400"
						)} />
						<span className="text-sm font-medium">
							{worldsetStatus.enabled ? "已启用" : "未启用"}
						</span>
						{worldsetStatus.enabled && worldsetStatus.enabledWorldsets && worldsetStatus.enabledWorldsets.length > 0 && (
							<div className="flex flex-wrap gap-1 ml-2">
								{worldsetStatus.enabledWorldsets.map((worldsetName) => (
									<span 
										key={worldsetName}
										className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400 flex items-center gap-1"
									>
										{worldsetName}
										<button
											className="hover:bg-red-500/30 rounded-full p-0.5"
											onClick={() => handleDisableWorldset(worldsetName)}
											title={`禁用 ${worldsetName}`}
										>
											<Square className="w-2 h-2" />
										</button>
									</span>
								))}
							</div>
						)}
					</div>
					{worldsetStatus.enabled && (
						<button
							className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
							onClick={() => handleDisableWorldset()}
						>
							<Square className="w-3 h-3 inline mr-1" />
							全部禁用
						</button>
					)}
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
										key={file.name}
										className={cn(
											"p-3 rounded border cursor-pointer transition-colors",
											"hover:bg-vscode-list-hoverBackground",
											selectedWorldset === file.name
												? "bg-vscode-list-activeSelectionBackground border-vscode-focusBorder"
												: "border-vscode-widget-border"
										)}
										onClick={() => handleWorldsetSelect(file.name)}
									>
										<div className="flex items-center justify-between mb-1">
											<h4 className="text-sm font-medium truncate">{file.name}</h4>
											<div className="flex gap-1">
												{worldsetStatus.enabled && worldsetStatus.enabledWorldsets?.includes(file.name) ? (
													<>
														<span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400">
															已启用
														</span>
														<button
															className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
															onClick={(e) => {
																e.stopPropagation()
																handleDisableWorldset(file.name)
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
															handleEnableWorldset(file.name)
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
}