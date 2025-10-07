import { memo, useCallback, useMemo, useState } from "react"

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
	const {
		displayMode: persistedDisplayMode = "coding",
		setDisplayMode: updateDisplayMode,
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

		// Limit to top 4 roles for preview
		return roles.slice(0, 4)
	}, [tasks, t])

	// Get current selected role
	const selectedRole = useMemo(() => {
		return roleList.find(role => role.id === selectedRoleId) || roleList[0]
	}, [roleList, selectedRoleId])

	// Get tasks for selected role (limit to 5 for preview)
	const previewTasks = useMemo(() => {
		return selectedRole.tasks.slice(0, 5).sort((a, b) => (b.ts || 0) - (a.ts || 0))
	}, [selectedRole.tasks])

	// Render role list item (WeChat style, compact)
	const renderRoleItem = (role: RoleItem) => {
		const isSelected = selectedRoleId === role.id
		const latestTask = role.tasks[0]
		const avatar = role.isAll ? "📋" : role.name.charAt(0).toUpperCase()
		const unreadCount = role.tasks.length

		return (
			<div
				key={role.id}
				className={`flex items-center gap-2 p-2 cursor-pointer transition-colors rounded ${
					isSelected
						? 'bg-vscode-list-activeSelectionBackground border-l-2 border-blue-500'
						: 'hover:bg-vscode-list-hoverBackground'
				}`}
				onClick={() => setSelectedRoleId(role.id)}>

				{/* Avatar */}
				<div className="relative flex-shrink-0">
					<div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
						role.isAll
							? 'bg-gradient-to-br from-green-500 to-blue-600 text-white'
							: 'bg-gradient-to-br from-blue-500 to-purple-600 text-white'
					}`}>
						{avatar}
					</div>
					{unreadCount > 1 && (
						<div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
							{unreadCount > 9 ? '9+' : unreadCount}
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
		vscode.postMessage({ type: "switchTab", tab: "history" })
	}

	return (
		<div className="flex flex-col gap-4">
			{roleList.length > 1 ? (
				<div className="flex gap-4">
					{/* Left sidebar - Role list */}
					<div className="w-48 space-y-1">
						{roleList.map(renderRoleItem)}
					</div>

					{/* Right panel - Selected role's tasks */}
					<div className="flex-1">
						<div className="mb-3 flex items-center justify-between">
							<div className="flex items-center gap-2">
								<div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
									selectedRole.isAll
										? 'bg-gradient-to-br from-green-500 to-blue-600 text-white'
										: 'bg-gradient-to-br from-blue-500 to-purple-600 text-white'
								}`}>
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

						<div className="space-y-2">
							{previewTasks.length > 0 ? (
								previewTasks.map((task) => (
									<TaskItem
										key={task.id}
										item={task}
										variant="compact"
										displayMode={persistedDisplayMode}
									/>
								))
							) : (
								<div className="text-center py-4 text-vscode-descriptionForeground">
									<p className="text-sm">暂无对话记录</p>
								</div>
							)}

							{selectedRole.tasks.length > 5 && (
								<div className="text-center py-2">
									<button
										onClick={handleViewAllHistory}
										className="text-xs text-vscode-textLink-foreground hover:underline">
										查看更多 {selectedRole.tasks.length - 5} 个对话...
									</button>
								</div>
							)}

							<button
								onClick={handleViewAllHistory}
								className="w-full text-center text-sm text-vscode-descriptionForeground hover:text-vscode-textLink-foreground transition-colors cursor-pointer py-2">
								{t("history:viewAllHistory")}
							</button>
						</div>
					</div>
				</div>
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
