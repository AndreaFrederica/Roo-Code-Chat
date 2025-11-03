import React, { useCallback, useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { vscode } from "@src/utils/vscode"
import { cn } from "@src/lib/utils"
import { Plus, Wifi, WifiOff, Loader2 } from "lucide-react"
import { StandardTooltip } from "@src/components/ui"
import "./web-client-navigation.css"

type Tab = "settings" | "history" | "mcp" | "modes" | "chat" | "marketplace" | "cloud"

interface WebClientNavigationProps {
	className?: string
	currentTab: Tab
	onTabChange: (tab: Tab) => void
	enableRooCloudServices?: boolean
}

const tabIcons: Record<Tab, string> = {
	chat: "💬",
	history: "📚",
	mcp: "🔌",
	modes: "⚙️",
	settings: "🔧",
	marketplace: "🛍️",
	cloud: "☁️",
}

const tabLabels: Record<Tab, string> = {
	chat: "聊天",
	history: "历史",
	mcp: "MCP",
	modes: "模式",
	settings: "设置",
	marketplace: "商店",
	cloud: "云端",
}

export const WebClientNavigation: React.FC<WebClientNavigationProps> = ({
	className,
	currentTab,
	onTabChange,
	enableRooCloudServices = false,
}) => {
	const { t } = useTranslation()

	// 连接状态管理
	const [isConnected, setIsConnected] = useState<boolean>(vscode.isConnected())
	const [reconnectCountdown, setReconnectCountdown] = useState<number>(0)

	useEffect(() => {
		const unsubscribeConnection = vscode.onConnectionStatusChange((status) => {
			setIsConnected(status)
			if (status) {
				setReconnectCountdown(0) // 连接成功时清除倒计时
			}
		})

		const unsubscribeCountdown = vscode.onReconnectCountdown((seconds) => {
			setReconnectCountdown(seconds)
		})

		return () => {
			if (typeof unsubscribeConnection === "function") {
				unsubscribeConnection()
			}
			if (typeof unsubscribeCountdown === "function") {
				unsubscribeCountdown()
			}
		}
	}, [])

	// 获取连接状态指示器
	const getConnectionIndicator = () => {
		if (isConnected) {
			return (
				<StandardTooltip content="已连接到扩展服务">
					<Wifi size={14} className="text-green-500" />
				</StandardTooltip>
			)
		} else {
			let tooltipText = "未连接到扩展服务"
			if (reconnectCountdown > 0) {
				tooltipText = `重连中...${reconnectCountdown}秒`
			}

			return (
				<StandardTooltip content={tooltipText}>
					<div className="flex items-center space-x-1">
						<Loader2 size={14} className="text-yellow-500 animate-spin" />
						{reconnectCountdown > 0 && (
							<span className="text-xs text-yellow-500 font-mono min-w-[12px] text-center">
								{reconnectCountdown}
							</span>
						)}
					</div>
				</StandardTooltip>
			)
		}
	}

	const switchTab = useCallback(
		(newTab: Tab) => {
			// Don't allow switching to cloud tab if Roo cloud services are disabled
			if (newTab === "cloud" && !enableRooCloudServices) {
				return
			}

			// 直接调用回调函数
			onTabChange(newTab)
		},
		[onTabChange, enableRooCloudServices],
	)

	const handleNewTask = useCallback(() => {
		vscode.postMessage({ type: "clearTask" })
	}, [])

	const tabs: Tab[] = [
		"chat",
		"history",
		"mcp",
		"modes",
		"settings",
		"marketplace",
		...(enableRooCloudServices ? (["cloud"] as Tab[]) : []),
	]

	// 检查是否为移动端屏幕
	const [isMobile, setIsMobile] = useState(false)

	// 监听窗口大小变化，检测是否为移动端
	useEffect(() => {
		const checkIsMobile = () => {
			const width = window.innerWidth
			setIsMobile(width < 480) // 超小屏幕（手机）
		}

		checkIsMobile()
		window.addEventListener("resize", checkIsMobile)
		return () => window.removeEventListener("resize", checkIsMobile)
	}, [])

	// 在移动端时，只显示最重要的标签
	const getMobileTabs = () => {
		if (isMobile) {
			const importantTabs: Tab[] = ["chat", "history"]
			if (enableRooCloudServices && currentTab === "cloud") {
				importantTabs.push("cloud")
			}
			return importantTabs
		}
		return tabs
	}

	// 获取移动端的菜单项
	const getMobileMenuItems = () => {
		if (isMobile) {
			const menuTabs = tabs.filter((tab) => !getMobileTabs().includes(tab))
			return menuTabs.map((tab) => ({
				key: tab,
				icon: tabIcons[tab],
				label: tabLabels[tab],
				onClick: () => switchTab(tab),
			}))
		}
		return []
	}

	const [showMobileMenu, setShowMobileMenu] = useState(false)

	return (
		<div className={cn("web-client-navigation", className, { "mobile-nav": isMobile })}>
			<nav className="flex items-center justify-between gap-2 p-3 bg-vscode-editor-background border-b border-vscode-panel-border/50 flex-shrink-0">
				{/* 左侧：主要导航标签 */}
				<div className="flex items-center space-x-1 flex-1 min-w-0 overflow-x-auto">
					{getMobileTabs().map((tab) => (
						<button
							key={tab}
							onClick={() => switchTab(tab)}
							className={cn(
								"flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200",
								"hover:bg-vscode-toolbar-hoverBackground/80 whitespace-nowrap flex-shrink-0",
								currentTab === tab
									? "bg-vscode-tab-activeBackground text-vscode-tab-activeForeground"
									: "text-vscode-tab-inactiveForeground hover:text-vscode-tab-activeForeground",
							)}
							title={tabLabels[tab]}>
							<span className="text-base">{tabIcons[tab]}</span>
							<span className="hidden xs:inline sm:inline">{tabLabels[tab]}</span>
						</button>
					))}
				</div>

				{/* 右侧：移动端菜单、连接状态和新任务按钮 */}
				<div className="action-buttons flex items-center space-x-2 flex-shrink-0">
					{isMobile && getMobileMenuItems().length > 0 && (
						<StandardTooltip content="更多选项">
							<button
								onClick={() => setShowMobileMenu(!showMobileMenu)}
								className={cn(
									"flex items-center justify-center px-2 py-2 rounded-md text-sm font-medium transition-all duration-200",
									"bg-vscode-button-secondaryBackground hover:bg-vscode-button-secondaryHoverBackground text-vscode-button-secondaryForeground",
								)}>
								<Plus size={16} className="transform rotate-90" />
							</button>
						</StandardTooltip>
					)}

					{/* 连接状态指示器 - 移动端隐藏 */}
					{!isMobile && (
						<div className="connection-indicator flex items-center justify-center min-w-[32px] h-8">
							{getConnectionIndicator()}
						</div>
					)}

					{/* 新任务按钮 - 移动端更小 */}
					<StandardTooltip content="结束当前任务并开始新任务">
						<button
							onClick={handleNewTask}
							className={cn(
								"flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200",
								"bg-vscode-button-background hover:bg-vscode-button-hoverBackground text-vscode-button-foreground",
								"hover:scale-105 active:scale-95",
								isMobile && "px-2 py-1", // 移动端更紧凑
							)}>
							<Plus size={isMobile ? 14 : 16} />
							<span className="hidden xs:inline sm:inline">{isMobile ? "" : "新任务"}</span>
						</button>
					</StandardTooltip>
				</div>
			</nav>

			{/* 移动端下拉菜单 */}
			{isMobile && showMobileMenu && (
				<div
					className="mobile-menu-overlay"
					onClick={() => setShowMobileMenu(false)}
					style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}>
					<div
						className="mobile-menu"
						onClick={(e) => e.stopPropagation()}
						style={{
							position: "fixed",
							top: "56px", // 导航栏高度
							right: "8px",
							backgroundColor: "var(--vscode-dropdown-background)",
							border: "1px solid var(--vscode-dropdown-border)",
							borderRadius: "6px",
							minWidth: "180px",
							maxWidth: "calc(100vw - 16px)",
							maxHeight: "calc(100vh - 72px)",
							overflowY: "auto",
							boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
							zIndex: 10000,
						}}>
						<div className="mobile-menu-header">
							<span>更多选项</span>
							<button onClick={() => setShowMobileMenu(false)} className="mobile-menu-close">
								×
							</button>
						</div>
						{getMobileMenuItems().map((item) => (
							<button
								key={item.key}
								onClick={() => {
									item.onClick()
									setShowMobileMenu(false)
								}}
								className="mobile-menu-item">
								<span className="text-base">{item.icon}</span>
								<span>{item.label}</span>
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	)
}

export default WebClientNavigation
