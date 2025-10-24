import React, { memo, useState, useMemo, useCallback, ReactNode } from "react"
import { DeleteTaskDialog } from "./DeleteTaskDialog"
import { BatchDeleteTaskDialog } from "./BatchDeleteTaskDialog"
import { Virtuoso } from "react-virtuoso"

import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import {
	Button,
	Checkbox,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	StandardTooltip,
} from "@/components/ui"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { vscode } from "@/utils/vscode"

import { Tab, TabContent, TabHeader } from "../common/Tab"
import { useTaskSearch } from "./useTaskSearch"
import TaskItem from "./TaskItem"
import { getChatModeTitleFromHistoryItem, getCodingModeTitle } from "@/utils/messageParser"
import type { HistoryItem } from "@roo-code/types"

interface WeChatHistoryViewProps {
	onDone: () => void
	headerActions?: ReactNode
	layout?: "standalone" | "embedded"
}

type SortOption = "newest" | "oldest" | "mostExpensive" | "mostTokens" | "mostRelevant"

interface RoleItem {
	id: string
	name: string
	uuid?: string
	isAll?: boolean
	tasks: HistoryItem[]
	latestTime: number
}

const WeChatHistoryView = ({ onDone, headerActions, layout = "standalone" }: WeChatHistoryViewProps) => {
	const {
		tasks,
		searchQuery,
		setSearchQuery,
		sortOption,
		setSortOption,
		showAllWorkspaces,
	} = useTaskSearch()
	const { t } = useAppTranslation()

	const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null)
	const [isSelectionMode, setIsSelectionMode] = useState(false)
	const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([])
	const [showBatchDeleteDialog, setShowBatchDeleteDialog] = useState<boolean>(false)
	const [selectedRoleId, setSelectedRoleId] = useState<string>("all")
	const { displayMode, setDisplayMode } = useExtensionState()

	const isEmbedded = layout === "embedded"

	// Handle display mode change with persistence
	const handleDisplayModeChange = useCallback(
		(newMode: "coding" | "chat") => {
			setDisplayMode(newMode)
			vscode.postMessage({ type: "setDisplayMode", text: newMode })
		},
		[setDisplayMode],
	)

	// Prepare role list including "All Conversations" as a special role
	const roleList = useMemo(() => {
		const roles: RoleItem[] = []
		const roleMap = new Map<string, RoleItem>()

		// Add "All Conversations" as the first item
		roles.push({
			id: "all",
			name: t("history:allConversations"),
			isAll: true,
			tasks: tasks,
			latestTime: tasks.length > 0 ? Math.max(...tasks.map((task) => task.ts || 0)) : 0,
		})

		// Group tasks by role
		const tasksWithRoles: HistoryItem[] = []
		const tasksWithoutRoles: HistoryItem[] = []

		tasks.forEach((task) => {
			if (task.anhRoleName) {
				tasksWithRoles.push(task)
			} else {
				tasksWithoutRoles.push(task)
			}
		})

		tasksWithRoles.forEach((task) => {
			const key = task.anhRoleUuid || task.anhRoleName || "unknown"
			if (!roleMap.has(key)) {
				roleMap.set(key, {
					id: key,
					name: task.anhRoleName || t("history:role.unknown"),
					uuid: task.anhRoleUuid,
					tasks: [],
					latestTime: task.ts || 0,
				})
			}
			roleMap.get(key)!.tasks.push(task)
		})

		const sortedRoles = Array.from(roleMap.values()).sort((a, b) => {
			const aLatest = Math.max(...a.tasks.map((task) => task.ts || 0))
			const bLatest = Math.max(...b.tasks.map((task) => task.ts || 0))
			return bLatest - aLatest
		})

		roles.push(...sortedRoles)

		if (tasksWithoutRoles.length > 0) {
			roles.push({
				id: "default",
				name: t("history:role.default"),
				tasks: tasksWithoutRoles,
				latestTime: Math.max(...tasksWithoutRoles.map((task) => task.ts || 0)),
			})
		}

		return roles
	}, [tasks, t])

	const selectedRole = useMemo(() => {
		return roleList.find((role) => role.id === selectedRoleId) || roleList[0]
	}, [roleList, selectedRoleId])

	const filteredTasks = useMemo(() => {
		let tasksToFilter = selectedRole.tasks

		if (searchQuery) {
			const query = searchQuery.toLowerCase()
			tasksToFilter = tasksToFilter.filter((task) => task.task.toLowerCase().includes(query))
		}

		return [...tasksToFilter].sort((a, b) => {
			switch (sortOption) {
				case "newest":
					return (b.ts || 0) - (a.ts || 0)
				case "oldest":
					return (a.ts || 0) - (b.ts || 0)
				case "mostExpensive":
					return (b.totalCost || 0) - (a.totalCost || 0)
				case "mostTokens":
					return (b.tokensOut || 0) - (a.tokensOut || 0)
				case "mostRelevant":
					return searchQuery ? 0 : (b.ts || 0) - (a.ts || 0)
				default:
					return 0
			}
		})
	}, [selectedRole.tasks, searchQuery, sortOption])

	const handleTaskSelection = (taskId: string, isSelected: boolean) => {
		if (isSelected) {
			setSelectedTaskIds((prev) => [...prev, taskId])
		} else {
			setSelectedTaskIds((prev) => prev.filter((id) => id !== taskId))
		}
	}

	const handleBatchDelete = () => {
		if (selectedTaskIds.length > 0) {
			setShowBatchDeleteDialog(true)
		}
	}

	const renderRoleItem = (role: RoleItem) => {
		const isSelected = selectedRoleId === role.id
		const latestTask = role.tasks[0]
		const avatar = role.isAll ? "📋" : role.name.charAt(0).toUpperCase()
		const unreadCount = role.tasks.length

		const roleItemStyle: React.CSSProperties = {
			borderLeftColor: isSelected ? "var(--vscode-focusBorder)" : "transparent",
			borderLeftWidth: "4px",
			borderLeftStyle: "solid",
		}

		return (
			<div
				key={role.id}
				className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${
					isSelected ? "bg-vscode-list-activeSelectionBackground" : "hover:bg-vscode-list-hoverBackground"
				}`}
				style={roleItemStyle}
				onClick={() => setSelectedRoleId(role.id)}>
				<div className="relative flex-shrink-0">
					<div
						className="w-12 h-12 rounded-full flex items-center justify-center font-medium"
						style={{
							background: role.isAll
								? "var(--vscode-charts-green, var(--vscode-button-background))"
								: "var(--vscode-button-background)",
							color: "var(--vscode-button-foreground)",
						}}>
						{avatar}
					</div>
					{unreadCount > 1 && (
						<div
							className="absolute -top-1 -right-1 text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold"
							style={{
								background: "var(--vscode-errorForeground)",
								color: "var(--vscode-button-foreground)",
							}}>
							{unreadCount > 99 ? "99+" : unreadCount}
						</div>
					)}
				</div>

				<div className="flex-1 min-w-0">
					<div className="flex items-center justify-between mb-1">
						<span className="font-medium truncate text-vscode-foreground">{role.name}</span>
						{latestTask && (
							<span className="text-xs text-vscode-descriptionForeground whitespace-nowrap">
								{new Date(latestTask.ts || 0).toLocaleDateString("zh-CN", {
									month: "numeric",
									day: "numeric",
								})}
							</span>
						)}
					</div>
					<div className="text-sm text-vscode-descriptionForeground truncate">
						{latestTask
							? displayMode === "chat"
								? getChatModeTitleFromHistoryItem(latestTask, 30)
								: getCodingModeTitle(latestTask.task, 30)
							: "暂无对话"}
					</div>
				</div>
			</div>
		)
	}

	const headerContent = (
		<div className="flex justify-between items-center">
			<h3 className="text-vscode-foreground m-0">{t("history:history")}</h3>
			<div className="flex gap-2">
				{headerActions}
				{isSelectionMode && selectedTaskIds.length > 0 && (
					<Button variant="destructive" size="sm" onClick={handleBatchDelete}>
						<span className="codicon codicon-trash mr-1" />
						删除 ({selectedTaskIds.length})
					</Button>
				)}
				<StandardTooltip content={isSelectionMode ? "退出选择模式" : "进入选择模式"}>
					<Button
						variant={isSelectionMode ? "default" : "secondary"}
						onClick={() => {
							setIsSelectionMode(!isSelectionMode)
							if (!isSelectionMode) {
								setSelectedTaskIds([])
							}
						}}>
						<span className={`codicon ${isSelectionMode ? "codicon-close" : "codicon-checklist"} mr-1`} />
						{isSelectionMode ? "取消选择" : "选择"}
					</Button>
				</StandardTooltip>
				<Button onClick={onDone}>{t("history:done")}</Button>
			</div>
		</div>
	)

	const contentBody = (
		<>
			<div className="w-80 border-r border-vscode-panel-border bg-vscode-sideBar-background flex flex-col">
				<div className="p-3 border-b border-vscode-panel-border">
					<VSCodeTextField
						placeholder="搜索角色..."
						value={searchQuery}
						onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
						className="w-full"
					/>
				</div>

				<div className="flex-1 overflow-y-auto">
					{roleList.length > 1 ? (
						roleList.map(renderRoleItem)
					) : (
						<div className="text-center py-8 text-vscode-descriptionForeground">
							<div className="text-4xl mb-2">💬</div>
							<p>暂无对话记录</p>
						</div>
					)}
				</div>
			</div>

			<div className="flex-1 flex flex-col bg-[var(--card)]">
				<div className="flex items-center justify-between p-4 border-b border-vscode-panel-border">
					<div className="flex items-center gap-3">
						<div
							className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
							style={{
								background: selectedRole.isAll
									? "var(--vscode-charts-green, var(--vscode-button-background))"
									: "var(--vscode-button-background)",
								color: "var(--vscode-button-foreground)",
							}}>
							{selectedRole.isAll ? "📋" : selectedRole.name.charAt(0).toUpperCase()}
						</div>
						<div>
							<h4 className="font-medium text-vscode-foreground">{selectedRole.name}</h4>
							<p className="text-sm text-vscode-descriptionForeground">{selectedRole.tasks.length} 个对话</p>
						</div>
					</div>

					<div className="flex items-center gap-2">
						<Select value={sortOption} onValueChange={(value: SortOption) => setSortOption(value)}>
							<SelectTrigger className="w-32">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="newest">最新</SelectItem>
								<SelectItem value="oldest">最早</SelectItem>
								<SelectItem value="mostExpensive">最贵</SelectItem>
								<SelectItem value="mostTokens">最多Token</SelectItem>
								<SelectItem value="mostRelevant" disabled={!searchQuery}>
									相关度
								</SelectItem>
							</SelectContent>
						</Select>
						<StandardTooltip content={displayMode === "coding" ? "切换到聊天模式" : "切换到编码模式"}>
							<Button
								variant="secondary"
								size="sm"
								onClick={() => handleDisplayModeChange(displayMode === "coding" ? "chat" : "coding")}
								className="flex items-center gap-1">
								<span className={`codicon ${displayMode === "coding" ? "codicon-code" : "codicon-comment-discussion"}`} />
								{displayMode === "coding" ? "编码" : "聊天"}
							</Button>
						</StandardTooltip>
					</div>
				</div>

				<div className="flex-1 overflow-y-auto">
					{filteredTasks.length > 0 ? (
						<Virtuoso
							data={filteredTasks}
							itemContent={(_index, task) => (
								<TaskItem
									key={task.id}
									item={task}
									variant="full"
									showWorkspace={showAllWorkspaces}
									isSelectionMode={isSelectionMode}
									isSelected={selectedTaskIds.includes(task.id)}
									onToggleSelection={handleTaskSelection}
									onDelete={setDeleteTaskId}
									displayMode={displayMode}
								/>
							)}
						/>
					) : (
						<div className="flex items-center justify-center h-full text-vscode-descriptionForeground">
							<div className="text-center">
								<div className="text-6xl mb-4">📭</div>
								<p>{searchQuery ? "没有找到匹配的对话" : "暂无对话记录"}</p>
							</div>
						</div>
					)}
				</div>
			</div>
		</>
	)

	const dialogs = (
		<>
			{deleteTaskId && (
				<DeleteTaskDialog taskId={deleteTaskId} open={!!deleteTaskId} onOpenChange={() => setDeleteTaskId(null)} />
			)}
			{showBatchDeleteDialog && (
				<BatchDeleteTaskDialog
					taskIds={selectedTaskIds}
					open={showBatchDeleteDialog}
					onOpenChange={(deleted) => {
						setShowBatchDeleteDialog(false)
						if (deleted) {
							setSelectedTaskIds([])
							if (Array.isArray(deleted) && deleted.length > 5) {
								setIsSelectionMode(false)
							}
						}
					}}
				/>
			)}
		</>
	)

	return (
		<>
			{isEmbedded ? (
				<div className="flex h-full flex-col">
					<TabHeader className="flex flex-col gap-2">{headerContent}</TabHeader>
					<TabContent className="flex h-full">{contentBody}</TabContent>
				</div>
			) : (
				<Tab>
					<TabHeader className="flex flex-col gap-2">{headerContent}</TabHeader>
					<TabContent className="flex h-full">{contentBody}</TabContent>
				</Tab>
			)}
			{dialogs}
		</>
	)
}

export default memo(WeChatHistoryView)
