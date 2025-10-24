import React, { memo, useCallback, useMemo, useState, useEffect } from "react"
import { Virtuoso } from "react-virtuoso"

import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Button } from "@src/components/ui"

import { useTaskSearch } from "./useTaskSearch"
import TaskItem from "./TaskItem"
import { getChatModeTitleFromHistoryItem, getCodingModeTitle } from "@/utils/messageParser"
import type { HistoryItem } from "@roo-code/types"
import { useExtensionState } from "@/context/ExtensionStateContext"

interface RoleItem {
	id: string
	name: string
	uuid?: string
	isAll?: boolean
	tasks: HistoryItem[]
	latestTime: number
}

const HistoryPreview = () => {
	const { tasks } = useTaskSearch()
	const { t } = useAppTranslation()
	const [selectedRoleId, setSelectedRoleId] = useState<string>("all")
	const [isMobileView, setIsMobileView] = useState(false)
	const [showRoleList, setShowRoleList] = useState(true)
	const [isTransitioning, setIsTransitioning] = useState(false)
	const [animationClass, setAnimationClass] = useState<string>("")
	const [previousViewMode, setPreviousViewMode] = useState<"mobile" | "desktop">("desktop")
	const {
		displayMode: persistedDisplayMode = "coding",
		setDisplayMode: updateDisplayMode,
		enableUIDebug = false,
		uiDebugComponents = [],
	} = useExtensionState()

	const handleDisplayModeToggle = useCallback(() => {
		const newMode = persistedDisplayMode === "coding" ? "chat" : "coding"
		updateDisplayMode(newMode)
		vscode.postMessage({ type: "setDisplayMode", text: newMode })
	}, [persistedDisplayMode, updateDisplayMode])

	// Prepare role list including "All Conversations" as a special role
	const roleList = useMemo(() => {
		const roles: RoleItem[] = []
		const roleMap = new Map<string, RoleItem>()

		// Add "All Conversations" as the first item
		roles.push({
			id: "all",
			name: t('history:allConversations'),
			isAll: true,
			tasks: tasks,
			latestTime: tasks.length > 0 ? Math.max(...tasks.map(t => t.ts || 0)) : 0
		})

		// Group tasks by role
		const tasksWithRoles: HistoryItem[] = []
		const tasksWithoutRoles: HistoryItem[] = []

		tasks.forEach(task => {
			if (task.anhRoleName) {
				tasksWithRoles.push(task)
			} else {
				tasksWithoutRoles.push(task)
			}
		})

		// Group tasks by role
		tasksWithRoles.forEach(task => {
			const key = task.anhRoleUuid || task.anhRoleName || 'unknown'
			if (!roleMap.has(key)) {
				roleMap.set(key, {
					id: key,
					name: task.anhRoleName || t('history:role.unknown'),
					uuid: task.anhRoleUuid,
					tasks: [],
					latestTime: task.ts || 0
				})
			}
			roleMap.get(key)!.tasks.push(task)
		})

		// Convert map to array and sort by most recent activity
		const sortedRoles = Array.from(roleMap.values()).sort((a, b) => {
			// Update latestTime for each role based on their tasks
			a.latestTime = Math.max(...a.tasks.map(t => t.ts || 0))
			b.latestTime = Math.max(...b.tasks.map(t => t.ts || 0))
			return b.latestTime - a.latestTime
		})

		// Add regular roles to the list
		roles.push(...sortedRoles)

		// Add tasks without roles as "Default Assistant"
		if (tasksWithoutRoles.length > 0) {
			roles.push({
				id: 'default',
				name: t('history:role.default'),
				tasks: tasksWithoutRoles,
				latestTime: Math.max(...tasksWithoutRoles.map(t => t.ts || 0))
			})
		}

		// Return all roles without limit for virtual scrolling
		return roles
	}, [tasks, t])

	// Get current selected role
	const selectedRole = useMemo(() => {
		return roleList.find(role => role.id === selectedRoleId) || roleList[0]
	}, [roleList, selectedRoleId])

	// 监听窗口大小变化，检测是否为移动端视图
	useEffect(() => {
		const checkScreenSize = () => {
			const isMobile = window.innerWidth < 512  // 调整移动端切换阈值：从768px改为1024px
			
			// 检测视图模式是否发生变化
			if (isMobile !== isMobileView) {
				// 开始动画过渡
				setIsTransitioning(true)
				
				// 设置动画类
				if (isMobile) {
					// 从桌面端切换到移动端
					setAnimationClass("mobile-view-enter")
					setPreviousViewMode("desktop")
					
					// 延迟更新状态，确保动画播放
					setTimeout(() => {
						setIsMobileView(isMobile)
						setAnimationClass("mobile-view-enter-active")
						
						// 在移动端自动隐藏角色列表
						if (roleList.length > 1) {
							setShowRoleList(false)
						}
						
						// 动画完成后清理
						setTimeout(() => {
							setIsTransitioning(false)
							setAnimationClass("")
						}, 300)
					}, 50)
				} else {
					// 从移动端切换到桌面端
					setAnimationClass("desktop-view-enter")
					setPreviousViewMode("mobile")
					
					// 延迟更新状态，确保动画播放
					setTimeout(() => {
						setIsMobileView(isMobile)
						setAnimationClass("desktop-view-enter-active")
						
						// 切换到桌面端时总是显示角色列表
						setShowRoleList(true)
						
						// 动画完成后清理
						setTimeout(() => {
							setIsTransitioning(false)
							setAnimationClass("")
						}, 300)
					}, 50)
				}
			} else {
				// 只是初始化，没有视图模式变化
				setIsMobileView(isMobile)
				if (isMobile && roleList.length > 1) {
					setShowRoleList(false)
				} else if (!isMobile) {
					setShowRoleList(true)
				}
			}
		}

		checkScreenSize()
		window.addEventListener('resize', checkScreenSize)
		return () => window.removeEventListener('resize', checkScreenSize)
	}, [roleList.length, isMobileView])

	// Get tasks for selected role (sorted by time, no limit for virtual scrolling)
	const sortedTasks = useMemo(() => {
		return selectedRole.tasks.sort((a, b) => (b.ts || 0) - (a.ts || 0))
	}, [selectedRole.tasks])

	// Render role list item (WeChat style, compact)
	const renderRoleItem = (role: RoleItem) => {
		const isSelected = selectedRoleId === role.id
		const latestTask = role.tasks[0]
		const unreadCount = role.tasks.length
		const taskWithAvatar = role.tasks.find((task) => task.anhRoleAvatar)

		// Get avatar from character card V3 or fallback to text avatar
		const getAvatarContent = () => {
			if (role.isAll) {
				return "📋"
			}

			if (taskWithAvatar?.anhRoleAvatar) {
				return (
					<img
						src={taskWithAvatar.anhRoleAvatar}
						alt={role.name}
						className="w-full h-full object-cover rounded-full"
						onError={(e) => {
							// Fallback to text avatar if image fails to load
							const target = e.target as HTMLImageElement
							target.style.display = "none"
							const parent = target.parentElement
							if (parent) {
								const fallback = document.createElement("div")
								fallback.className =
									"w-full h-full flex items-center justify-center text-sm font-medium"
								fallback.style.background = "var(--vscode-button-background)"
								fallback.style.color = "var(--vscode-button-foreground)"
								fallback.textContent = role.name.charAt(0).toUpperCase()
								parent.appendChild(fallback)
							}
						}}
					/>
				)
			}
			
			return role.name.charAt(0).toUpperCase()
		}

		const roleItemStyle: React.CSSProperties = {
			borderLeftColor: isSelected ? "var(--vscode-focusBorder)" : "transparent",
			borderLeftWidth: "2px",
			borderLeftStyle: "solid",
		}

		return (
			<div
				key={role.id}
				className={`flex items-center gap-2 p-2 cursor-pointer transition-colors rounded ${
					isSelected ? "bg-vscode-list-activeSelectionBackground" : "hover:bg-vscode-list-hoverBackground"
				}`}
				style={roleItemStyle}
				onClick={() => handleRoleSelect(role.id)}>

		{/* Avatar */}
		<div className="relative flex-shrink-0">
			<div
				className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-sm font-medium"
				style={{
					background: role.isAll
						? "var(--vscode-charts-green, var(--vscode-button-background))"
						: taskWithAvatar?.anhRoleAvatar
							? "var(--vscode-input-background)"
							: "var(--vscode-button-background)",
					color: taskWithAvatar?.anhRoleAvatar
						? "var(--vscode-foreground)"
						: "var(--vscode-button-foreground)",
				}}>
				{getAvatarContent()}
			</div>
			{unreadCount > 1 && (
				<div
					className="absolute -top-1 -right-1 text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold"
					style={{
						background: "var(--vscode-errorForeground)",
						color: "var(--vscode-button-foreground)",
					}}>
					{unreadCount > 9 ? "9+" : unreadCount}
				</div>
			)}
		</div>

				{/* Content */}
				<div className="flex-1 min-w-0">
					<div className="flex items-center justify-between mb-1">
						<span className={`font-medium text-sm truncate ${
							isSelected ? 'text-vscode-foreground' : 'text-vscode-foreground'
						}`}>
							{role.name}
						</span>
						{latestTask && (
							<span className="text-xs text-vscode-descriptionForeground whitespace-nowrap">
								{new Date(latestTask.ts || 0).toLocaleDateString('zh-CN', {
									month: 'numeric',
									day: 'numeric'
								})}
							</span>
						)}
					</div>
					<div className="text-xs text-vscode-descriptionForeground truncate">
						{latestTask ? (
							persistedDisplayMode === 'chat'
								? getChatModeTitleFromHistoryItem(latestTask, 25)
								: getCodingModeTitle(latestTask.task, 25)
						) : '暂无对话'}
					</div>
				</div>
			</div>
		)
	}

	const handleViewAllHistory = () => {
		// 在独立浏览器模式中，用户应该直接点击顶部导航栏的历史标签
		// 这个按钮主要在 VSCode 扩展模式中使用
		const isWebClient = vscode.isStandaloneMode?.() ?? false

		if (!isWebClient) {
			vscode.postMessage({ type: "switchTab", tab: "history" })
		}
		// 在独立浏览器模式中不执行任何操作，因为用户可以使用顶栏导航
	}

	// 检查是否在独立浏览器模式
	const isWebClient = vscode.isStandaloneMode?.() ?? false

	const handleBackToRoleList = () => {
		setShowRoleList(true)
	}

	const handleRoleSelect = (roleId: string) => {
		setSelectedRoleId(roleId)
		// 在移动端，选择角色后隐藏角色列表，显示任务详情
		if (isMobileView) {
			setShowRoleList(false)
		}
	}

	return (
		<div className={`flex flex-col gap-4 h-full transition-layout ${animationClass}`}>
			{/* 调试信息 - 使用全局设置控制 */}
			{enableUIDebug && uiDebugComponents.includes('HistoryPreview') && (
				<div className="text-xs text-vscode-descriptionForeground p-2 border-b border-vscode-panel-border">
					Debug: isMobileView={isMobileView.toString()}, showRoleList={showRoleList.toString()}, roleList.length={roleList.length}, transitioning={isTransitioning.toString()}, animationClass={animationClass}
				</div>
			)}
			
			{roleList.length > 0 ? (
				<>
					{/* 移动端顶部导航栏 */}
					{isMobileView && (
						<div className="flex items-center justify-between p-3 border-b border-vscode-panel-border flex-shrink-0">
							{!showRoleList && (
								<Button
									variant="ghost"
									size="sm"
									onClick={handleBackToRoleList}
									className="flex items-center gap-1 text-xs px-2 py-1"
								>
									<span className="codicon codicon-arrow-left" />
									返回
								</Button>
							)}
							<div className="flex items-center gap-2">
								{showRoleList && (
									<h4 className="font-medium text-sm text-vscode-foreground">
										{t('history:allConversations')}
									</h4>
								)}
								{!showRoleList && (
									<div className="flex items-center gap-2">
											<div
												className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium"
												style={{
													background: selectedRole.isAll
														? "var(--vscode-charts-green, var(--vscode-button-background))"
														: "var(--vscode-button-background)",
													color: "var(--vscode-button-foreground)",
												}}>
												{selectedRole.isAll ? "📋" : selectedRole.name.charAt(0).toUpperCase()}
											</div>
										<div>
											<h5 className="font-medium text-sm text-vscode-foreground">
												{selectedRole.name}
											</h5>
											<p className="text-xs text-vscode-descriptionForeground">
												{selectedRole.tasks.length} 个对话
											</p>
										</div>
									</div>
								)}
							</div>
							<Button
								variant="secondary"
								size="sm"
								onClick={handleDisplayModeToggle}
								className="flex items-center gap-1 text-xs px-2 py-1"
							>
								<span className={`codicon ${persistedDisplayMode === 'coding' ? 'codicon-code' : 'codicon-comment-discussion'}`} />
								{persistedDisplayMode === 'coding' ? '编码' : '聊天'}
							</Button>
						</div>
					)}

					<div className={`flex gap-4 flex-1 min-h-0 ${isMobileView ? 'flex-col' : ''}`}>
						{/* Left sidebar - Role list with virtual scrolling */}
						{(!isMobileView || showRoleList) && (
							<div className={`${isMobileView ? 'w-full' : 'w-48'} flex flex-col min-h-0 relative ${
								isMobileView ? `transition-slide ${showRoleList ? 'panel-slide-in-right active' : 'panel-slide-out-right active'}` : ''
							}`}>
								{enableUIDebug && uiDebugComponents.includes("HistoryPreview") && (
									<div
										className="absolute top-0 left-0 right-0 text-xs p-1 z-50"
										style={{
											background: "var(--vscode-errorForeground)",
											color: "var(--vscode-button-foreground)",
										}}>
										Debug Container: {isMobileView ? "mobile" : "desktop"}, showRoleList:{" "}
										{showRoleList.toString()}, roleCount: {roleList.length}
									</div>
								)}
								{isMobileView ? (
									// 移动端使用简单的滚动容器作为后备方案
									<div className="flex-1 overflow-y-auto" style={{ height: '300px' }}>
										{roleList.map((role, index) => (
											<div key={role.id}>
												{enableUIDebug && uiDebugComponents.includes('HistoryPreview') && (
													<div className="text-xs text-yellow-500 p-1">
														Mobile Role {index}: {role.name} (tasks: {role.tasks.length})
													</div>
												)}
												{renderRoleItem(role)}
											</div>
										))}
									</div>
								) : (
									// 桌面端使用 Virtuoso
									<Virtuoso
										data={roleList}
										itemContent={(index, role: RoleItem) => renderRoleItem(role)}
										fixedItemHeight={60}
										className="h-full w-full scrollbar-hide"
										style={{ height: '100%', width: '100%' }}
										components={{
											Scroller: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((props, ref) => (
												<div {...props} ref={ref} className={`${props.className} overscroll-y-auto scrollbar-hide`} />
											))
										}}
									/>
								)}
							</div>
						)}

						{/* Right panel - Selected role's tasks */}
						{(!isMobileView || !showRoleList) && (
							<div className={`flex-1 flex flex-col h-full ${
								isMobileView ? `transition-slide ${!showRoleList ? 'panel-slide-in-left active' : 'panel-slide-out-left active'}` : ''
							}`}>
								{/* 桌面端头部 */}
								{!isMobileView && (
									<div className="mb-3 flex items-center justify-between flex-shrink-0">
										<div className="flex items-center gap-2">
											<div
												className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium"
												style={{
													background: selectedRole.isAll
														? "var(--vscode-charts-green, var(--vscode-button-background))"
														: "var(--vscode-button-background)",
													color: "var(--vscode-button-foreground)",
												}}>
												{selectedRole.isAll ? "📋" : selectedRole.name.charAt(0).toUpperCase()}
											</div>
											<div>
												<h5 className="font-medium text-sm text-vscode-foreground">
													{selectedRole.name}
												</h5>
												<p className="text-xs text-vscode-descriptionForeground">
													{selectedRole.tasks.length} 个对话
												</p>
											</div>
										</div>
										<Button
											variant="secondary"
											size="sm"
											onClick={handleDisplayModeToggle}
											className="flex items-center gap-1 text-xs px-2 py-1"
										>
											<span className={`codicon ${persistedDisplayMode === 'coding' ? 'codicon-code' : 'codicon-comment-discussion'}`} />
											{persistedDisplayMode === 'coding' ? '编码' : '聊天'}
										</Button>
									</div>
								)}

								<div className="flex-1 min-h-0">
									{sortedTasks.length > 0 ? (
										<Virtuoso
											data={sortedTasks}
											itemContent={(index, task: HistoryItem) => (
												<TaskItem
													key={task.id}
													item={task}
													variant="compact"
													displayMode={persistedDisplayMode}
												/>
											)}
											fixedItemHeight={80}
											className="h-full"
										/>
									) : (
										<div className="text-center py-4 text-vscode-descriptionForeground h-full flex items-center justify-center">
											<p className="text-sm">暂无对话记录</p>
										</div>
									)}
								</div>

								{/* 在独立浏览器模式中隐藏"查看所有历史记录"按钮，因为用户可以使用顶栏导航 */}
								{!isWebClient && (
									<button
										onClick={handleViewAllHistory}
										className="w-full text-center text-sm text-vscode-descriptionForeground hover:text-vscode-textLink-foreground transition-colors cursor-pointer py-2 flex-shrink-0">
										{t("history:viewAllHistory")}
									</button>
								)}
							</div>
						)}
					</div>
				</>
			) : (
				<div className="text-center py-8 text-vscode-descriptionForeground">
					<div className="text-4xl mb-2">💬</div>
					<p className="text-sm">暂无对话记录</p>
				</div>
			)}
		</div>
	)
}

export default memo(HistoryPreview)
