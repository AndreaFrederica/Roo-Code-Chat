import React, { useState, useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"
import {
	Brain,
	Search,
	Filter,
	Plus,
	Edit,
	Trash2,
	Download,
	Upload,
	RefreshCw,
	BarChart3,
	Clock,
	Tag,
	Heart,
	Target,
	AlertCircle,
	Check,
	X,
	Settings,
	Eye,
	EyeOff,
	Save,
	XCircle,
	FileText,
	Calendar,
	Hash,
} from "lucide-react"

import type {
	MemoryEntry,
	MemoryFilter,
	MemoryStats,
	MemoryManagementState,
	MemoryManagementMessage,
	MemoryManagementResponse,
} from "@roo-code/types"
import {
	formatMemoryTypeLabel,
	formatTriggerTypeLabel,
	formatEmotionTypeLabel,
	getMemoryTypeColor,
	getEmotionTypeColor,
	formatMemoryDate,
} from "@roo-code/types"

import { vscode } from "@src/utils/vscode"
import { useMessageListener } from "@/hooks/useMessageListener"
import { cn } from "@src/lib/utils"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { SetCachedStateField } from "./types"
import {
	Button,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Switch,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Badge,
	Separator,
	ScrollArea,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Label,
	Textarea,
	Slider,
	Checkbox,
} from "@src/components/ui"

interface MemoryManagementSettingsProps {
	memorySystemEnabled?: boolean
	memoryToolsEnabled?: boolean
	setCachedStateField: SetCachedStateField<"memorySystemEnabled" | "memoryToolsEnabled">
}

export const MemoryManagementSettings: React.FC<MemoryManagementSettingsProps> = ({
	memorySystemEnabled = true,
	memoryToolsEnabled = true,
	setCachedStateField,
}) => {
	const { t } = useTranslation()
	const { currentAnhRole } = useExtensionState()

	const [state, setState] = useState<MemoryManagementState>({
		selectedRoleUuid: currentAnhRole?.uuid || "",
		memories: [],
		stats: undefined,
		filter: {
			search: "",
			memoryType: "all",
			triggerType: "all",
			priorityRange: { min: 0, max: 100 },
			isConstant: undefined,
		},
		loading: false,
		error: undefined,
		selectedMemories: [],
		editMode: false,
		editingMemory: undefined,
		showDeleteDialog: false,
		memoryToDelete: undefined,
	})

	const [activeTab, setActiveTab] = useState("list")
	const [showImportDialog, setShowImportDialog] = useState(false)
	const [importData, setImportData] = useState("")
	const [showFilterDialog, setShowFilterDialog] = useState(false)

	// 记忆类型选项
	const memoryTypeOptions = [
		{ value: "all", label: "全部类型" },
		{ value: "episodic", label: "情景记忆" },
		{ value: "semantic", label: "语义记忆" },
		{ value: "trait", label: "特质" },
		{ value: "goal", label: "目标" },
	]

	// 触发类型选项
	const triggerTypeOptions = [
		{ value: "all", label: "全部触发方式" },
		{ value: "keyword", label: "关键词" },
		{ value: "semantic", label: "语义" },
		{ value: "temporal", label: "时间" },
		{ value: "emotional", label: "情感" },
	]

	// 发送消息到后端
	const sendMessage = (message: MemoryManagementMessage) => {
		vscode.postMessage({
			type: "memoryManagement",
			data: message,
		})
	}

	// 加载记忆列表
	const loadMemories = () => {
		if (!state.selectedRoleUuid) return

		setState((prev) => ({ ...prev, loading: true, error: undefined }))

		sendMessage({
			type: "getMemoryList",
			roleUuid: state.selectedRoleUuid,
			filter: state.filter,
		})
	}

	// 加载记忆统计
	const loadStats = () => {
		if (!state.selectedRoleUuid) return

		sendMessage({
			type: "getMemoryStats",
			roleUuid: state.selectedRoleUuid,
		})
	}

	// 使用统一的消息监听 Hook 来处理记忆管理响应
	useMessageListener(["memoryManagementResponse"], (message: any) => {
		const { type, payload } = message

		if (type === "memoryManagementResponse") {
			handleResponse(payload as MemoryManagementResponse)
		}
	}, [state.selectedRoleUuid])

	const handleResponse = (response: MemoryManagementResponse) => {
		setState((prev) => {
			switch (response.type) {
				case "memoryList":
					return {
						...prev,
						memories: response.memories,
						stats: response.stats,
						loading: false,
					}

				case "memoryStats":
					return {
						...prev,
						stats: response.stats,
					}

				case "memoryUpdated":
					return {
						...prev,
						editMode: false,
						editingMemory: undefined,
					}

				case "memoryDeleted":
				case "multipleMemoriesDeleted":
				case "memoriesCleaned":
					return {
						...prev,
						selectedMemories: [],
						showDeleteDialog: false,
						memoryToDelete: undefined,
					}

				case "memoriesImported":
					setShowImportDialog(false)
					setImportData("")
					return prev

				case "memoryError":
					return {
						...prev,
						error: response.error,
						loading: false,
					}

				default:
					return prev
			}
		})

		// 重新加载数据
		if (
			[
				"memoryUpdated",
				"memoryDeleted",
				"multipleMemoriesDeleted",
				"memoriesCleaned",
				"memoriesImported",
			].includes(response.type)
		) {
			loadMemories()
			loadStats()
		}
	}

	// 初始化加载
	useEffect(() => {
		if (state.selectedRoleUuid) {
			loadMemories()
			loadStats()
		}
	}, [state.selectedRoleUuid])

	// 过滤后的记忆
	const filteredMemories = useMemo(() => {
		return state.memories.filter((memory) => {
			if (
				state.filter.search &&
				!memory.content.toLowerCase().includes(state.filter.search!.toLowerCase()) &&
				!memory.keywords.some((keyword) => keyword.toLowerCase().includes(state.filter.search!.toLowerCase()))
			) {
				return false
			}

			if (
				state.filter.memoryType &&
				state.filter.memoryType !== "all" &&
				memory.type !== state.filter.memoryType
			) {
				return false
			}

			if (
				state.filter.triggerType &&
				state.filter.triggerType !== "all" &&
				memory.triggerType !== state.filter.triggerType
			) {
				return false
			}

			if (state.filter.priorityRange) {
				if (state.filter.priorityRange.min !== undefined && memory.priority < state.filter.priorityRange.min) {
					return false
				}
				if (state.filter.priorityRange.max !== undefined && memory.priority > state.filter.priorityRange.max) {
					return false
				}
			}

			if (state.filter.isConstant !== undefined && memory.isConstant !== state.filter.isConstant) {
				return false
			}

			return true
		})
	}, [state.memories, state.filter])

	// 选择/取消选择记忆
	const toggleMemorySelection = (memoryId: string) => {
		setState((prev) => ({
			...prev,
			selectedMemories: prev.selectedMemories.includes(memoryId)
				? prev.selectedMemories.filter((id) => id !== memoryId)
				: [...prev.selectedMemories, memoryId],
		}))
	}

	// 全选/取消全选
	const toggleSelectAll = () => {
		setState((prev) => ({
			...prev,
			selectedMemories:
				prev.selectedMemories.length === filteredMemories.length ? [] : filteredMemories.map((m) => m.id),
		}))
	}

	// 删除单个记忆
	const deleteMemory = (memoryId: string) => {
		setState((prev) => ({ ...prev, memoryToDelete: memoryId, showDeleteDialog: true }))
	}

	// 确认删除
	const confirmDelete = () => {
		if (state.memoryToDelete) {
			sendMessage({
				type: "deleteMemory",
				roleUuid: state.selectedRoleUuid!,
				memoryId: state.memoryToDelete,
			})
		} else if (state.selectedMemories.length > 0) {
			sendMessage({
				type: "deleteMultipleMemories",
				roleUuid: state.selectedRoleUuid!,
				memoryIds: state.selectedMemories,
			})
		}
	}

	// 批量删除选中的记忆
	const deleteSelectedMemories = () => {
		setState((prev) => ({ ...prev, showDeleteDialog: true }))
	}

	// 清理过期记忆
	const cleanupMemories = () => {
		sendMessage({
			type: "cleanupMemories",
			roleUuid: state.selectedRoleUuid!,
		})
	}

	// 导出记忆
	const exportMemories = () => {
		sendMessage({
			type: "exportMemories",
			roleUuid: state.selectedRoleUuid!,
			memoryIds: state.selectedMemories.length > 0 ? state.selectedMemories : undefined,
		})
	}

	// 导入记忆
	const importMemories = () => {
		try {
			const memories = JSON.parse(importData) as MemoryEntry[]
			sendMessage({
				type: "importMemories",
				roleUuid: state.selectedRoleUuid!,
				memories,
			})
		} catch (error) {
			setState((prev) => ({ ...prev, error: "导入数据格式错误" }))
		}
	}

	// 编辑记忆
	const editMemory = (memory: MemoryEntry) => {
		setState((prev) => ({
			...prev,
			editMode: true,
			editingMemory: { ...memory },
		}))
	}

	// 保存编辑的记忆
	const saveMemory = () => {
		if (!state.editingMemory) return

		sendMessage({
			type: "updateMemory",
			roleUuid: state.selectedRoleUuid!,
			memoryId: state.editingMemory.id,
			memory: state.editingMemory,
		})
	}

	// 渲染记忆卡片
	const renderMemoryCard = (memory: MemoryEntry) => {
		const isSelected = state.selectedMemories.includes(memory.id)
		const typeColor = getMemoryTypeColor(memory.type)
		const emotionColor = getEmotionTypeColor(memory.emotionType || "neutral")

		return (
			<Card
				key={memory.id}
				className={cn(
					"relative cursor-pointer transition-all hover:shadow-md",
					isSelected && "ring-2 ring-[var(--vscode-focusBorder)]",
					memory.isConstant &&
						"border-[var(--vscode-inputValidation-warningBorder)] bg-[var(--vscode-inputValidation-warningBackground)]",
				)}>
				<CardContent className="p-4">
					<div className="flex items-start justify-between mb-2">
						<div className="flex items-center gap-2">
							<Checkbox checked={isSelected} onCheckedChange={() => toggleMemorySelection(memory.id)} />
							<Badge
								variant="outline"
								className="text-xs bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]">
								{formatMemoryTypeLabel(memory.type)}
							</Badge>
							<Badge
								variant="outline"
								className="text-xs bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]">
								{formatTriggerTypeLabel(memory.triggerType)}
							</Badge>
							{memory.emotionType && (
								<Badge variant="outline" className={cn("text-xs", emotionColor)}>
									{formatEmotionTypeLabel(memory.emotionType)}
								</Badge>
							)}
							{memory.isConstant && (
								<Badge
									variant="outline"
									className="text-xs bg-[var(--vscode-inputValidation-warningBackground)] text-[var(--vscode-inputValidation-warningForeground)]">
									常驻
								</Badge>
							)}
						</div>
						<div className="flex items-center gap-1">
							<Button
								variant="ghost"
								size="sm"
								onClick={() => editMemory(memory)}
								className="h-8 w-8 p-0">
								<Edit className="h-3 w-3" />
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => deleteMemory(memory.id)}
								className="h-8 w-8 p-0 text-[var(--vscode-errorForeground)] hover:text-[var(--vscode-errorForeground)]">
								<Trash2 className="h-3 w-3" />
							</Button>
						</div>
					</div>

					<div className="space-y-2">
						<p className="text-sm text-[var(--vscode-foreground)] line-clamp-3">{memory.content}</p>

						{memory.keywords.length > 0 && (
							<div className="flex flex-wrap gap-1">
								{memory.keywords.slice(0, 5).map((keyword, index) => (
									<Badge
										key={index}
										variant="secondary"
										className="text-xs bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)]">
										{keyword}
									</Badge>
								))}
								{memory.keywords.length > 5 && (
									<Badge
										variant="secondary"
										className="text-xs bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)]">
										+{memory.keywords.length - 5}
									</Badge>
								)}
							</div>
						)}

						<div className="flex items-center justify-between text-xs text-[var(--vscode-descriptionForeground)]">
							<div className="flex items-center gap-4">
								<span className="flex items-center gap-1">
									<BarChart3 className="h-3 w-3" />
									{memory.priority}
								</span>
								{memory.accessCount !== undefined && (
									<span className="flex items-center gap-1">
										<Eye className="h-3 w-3" />
										{memory.accessCount}
									</span>
								)}
							</div>
							<span className="flex items-center gap-1">
								<Clock className="h-3 w-3" />
								{formatMemoryDate(memory.createdAt)}
							</span>
						</div>
					</div>
				</CardContent>
			</Card>
		)
	}

	// 渲染编辑对话框
	const renderEditDialog = () => {
		if (!state.editingMemory) return null

		return (
			<Dialog open={state.editMode} onOpenChange={(open) => setState((prev) => ({ ...prev, editMode: open }))}>
				<DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>编辑记忆</DialogTitle>
						<DialogDescription>修改记忆内容和相关属性</DialogDescription>
					</DialogHeader>

					<div className="space-y-4">
						<div>
							<Label htmlFor="content">内容</Label>
							<Textarea
								id="content"
								value={state.editingMemory.content}
								onChange={(e) =>
									setState((prev) => ({
										...prev,
										editingMemory: prev.editingMemory
											? { ...prev.editingMemory, content: e.target.value }
											: undefined,
									}))
								}
								rows={4}
								placeholder="记忆内容..."
							/>
						</div>

						<div>
							<Label htmlFor="keywords">关键词（用逗号分隔）</Label>
							<Input
								id="keywords"
								value={state.editingMemory.keywords.join(", ")}
								onChange={(e) =>
									setState((prev) => ({
										...prev,
										editingMemory: prev.editingMemory
											? {
													...prev.editingMemory,
													keywords: e.target.value
														.split(",")
														.map((k) => k.trim())
														.filter((k) => k),
												}
											: undefined,
									}))
								}
								placeholder="关键词1, 关键词2, ..."
							/>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div>
								<Label htmlFor="type">记忆类型</Label>
								<Select
									value={state.editingMemory.type}
									onValueChange={(value) =>
										setState((prev) => ({
											...prev,
											editingMemory: prev.editingMemory
												? { ...prev.editingMemory, type: value as any }
												: undefined,
										}))
									}>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{memoryTypeOptions.slice(1).map((option) => (
											<SelectItem key={option.value} value={option.value}>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div>
								<Label htmlFor="triggerType">触发类型</Label>
								<Select
									value={state.editingMemory.triggerType}
									onValueChange={(value) =>
										setState((prev) => ({
											...prev,
											editingMemory: prev.editingMemory
												? { ...prev.editingMemory, triggerType: value as any }
												: undefined,
										}))
									}>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{triggerTypeOptions.slice(1).map((option) => (
											<SelectItem key={option.value} value={option.value}>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>

						<div>
							<Label htmlFor="priority">优先级: {state.editingMemory.priority}</Label>
							<Slider
								id="priority"
								min={0}
								max={100}
								step={5}
								value={[state.editingMemory.priority]}
								onValueChange={([value]) =>
									setState((prev) => ({
										...prev,
										editingMemory: prev.editingMemory
											? { ...prev.editingMemory, priority: value }
											: undefined,
									}))
								}
								className="mt-2"
							/>
						</div>

						<div className="flex items-center space-x-2">
							<Switch
								id="isConstant"
								checked={state.editingMemory.isConstant}
								onCheckedChange={(checked) =>
									setState((prev) => ({
										...prev,
										editingMemory: prev.editingMemory
											? { ...prev.editingMemory, isConstant: checked }
											: undefined,
									}))
								}
							/>
							<Label htmlFor="isConstant">常驻记忆（不会被清理）</Label>
						</div>
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => setState((prev) => ({ ...prev, editMode: false }))}>
							取消
						</Button>
						<Button onClick={saveMemory}>保存</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		)
	}

	
	return (
		<div className="settings-section">
			<h3>记忆系统设置</h3>
			<p className="settings-description">
				管理AI角色的记忆系统，允许记录和回忆对话中的重要信息。
			</p>

			{/* 全局开关 */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Settings className="h-5 w-5" />
						全局设置
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="flex items-center justify-between">
						<div>
							<Label htmlFor="memorySystemEnabled">启用记忆系统</Label>
							<p className="text-sm text-gray-500">允许AI角色记录和回忆对话中的重要信息</p>
						</div>
						<Switch
							id="memorySystemEnabled"
							checked={memorySystemEnabled}
							onCheckedChange={(checked) => setCachedStateField("memorySystemEnabled", checked)}
						/>
					</div>

					<div className="flex items-center justify-between">
						<div>
							<Label htmlFor="memoryToolsEnabled">启用记忆工具</Label>
							<p className="text-sm text-gray-500">允许AI使用记忆工具主动记录和检索信息</p>
						</div>
						<Switch
							id="memoryToolsEnabled"
							checked={memoryToolsEnabled}
							onCheckedChange={(checked) => setCachedStateField("memoryToolsEnabled", checked)}
						/>
					</div>
				</CardContent>
			</Card>

			{memorySystemEnabled && (
				<>
					{/* 记忆统计 */}
					{state.stats && (
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<BarChart3 className="h-5 w-5" />
									记忆统计
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
									<div className="text-center">
										<div className="text-2xl font-bold ui-accent-text">
											{state.stats.totalMemories}
										</div>
										<div className="text-sm text-gray-500">总记忆数</div>
									</div>
									<div className="text-center">
										<div className="text-2xl font-bold text-green-600">
											{state.stats.constantMemories}
										</div>
										<div className="text-sm text-gray-500">常驻记忆</div>
									</div>
									<div className="text-center">
										<div className="text-2xl font-bold text-purple-600">
											{state.stats.averageImportance.toFixed(1)}
										</div>
										<div className="text-sm text-gray-500">平均重要性</div>
									</div>
									<div className="text-center">
										<div className="text-2xl font-bold text-orange-600">
											{Math.round((state.stats.storageSize || 0) / 1024)}KB
										</div>
										<div className="text-sm text-gray-500">存储大小</div>
									</div>
								</div>

								<div className="mt-4 grid grid-cols-2 gap-4">
									<div>
										<Label className="text-sm font-medium">类型分布</Label>
										<div className="mt-1 space-y-1">
											{Object.entries(state.stats.typeDistribution).map(([type, count]) => (
												<div key={type} className="flex justify-between text-sm">
													<span>{formatMemoryTypeLabel(type)}</span>
													<span className="font-medium">{count}</span>
												</div>
											))}
										</div>
									</div>
									<div>
										<Label className="text-sm font-medium">触发方式分布</Label>
										<div className="mt-1 space-y-1">
											{Object.entries(state.stats.triggerTypeDistribution).map(
												([type, count]) => (
													<div key={type} className="flex justify-between text-sm">
														<span>{formatTriggerTypeLabel(type)}</span>
														<span className="font-medium">{count}</span>
													</div>
												),
											)}
										</div>
									</div>
								</div>
							</CardContent>
						</Card>
					)}

					{/* 操作栏 */}
					<Card>
						<CardContent className="p-4">
							<div className="flex flex-wrap items-center gap-2">
								<div className="flex-1 min-w-[200px]">
									<div className="relative">
										<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
										<Input
											placeholder="搜索记忆内容或关键词..."
											value={state.filter.search || ""}
											onChange={(e) =>
												setState((prev) => ({
													...prev,
													filter: { ...prev.filter, search: e.target.value },
												}))
											}
											className="pl-10"
										/>
									</div>
								</div>

								<Button
									variant="outline"
									size="sm"
									onClick={() => setShowFilterDialog(true)}
									className="flex items-center gap-2">
									<Filter className="h-4 w-4" />
									过滤
								</Button>

								<Button
									variant="outline"
									size="sm"
									onClick={loadMemories}
									disabled={state.loading}
									className="flex items-center gap-2">
									<RefreshCw className={cn("h-4 w-4", state.loading && "animate-spin")} />
									刷新
								</Button>

								<Button
									variant="outline"
									size="sm"
									onClick={exportMemories}
									className="flex items-center gap-2">
									<Download className="h-4 w-4" />
									导出
								</Button>

								<Button
									variant="outline"
									size="sm"
									onClick={() => setShowImportDialog(true)}
									className="flex items-center gap-2">
									<Upload className="h-4 w-4" />
									导入
								</Button>

								<Button
									variant="outline"
									size="sm"
									onClick={cleanupMemories}
									className="flex items-center gap-2">
									<RefreshCw className="h-4 w-4" />
									清理
								</Button>

								{state.selectedMemories.length > 0 && (
									<Button
										variant="destructive"
										size="sm"
										onClick={deleteSelectedMemories}
										className="flex items-center gap-2">
										<Trash2 className="h-4 w-4" />
										删除选中 ({state.selectedMemories.length})
									</Button>
								)}
							</div>

							{/* 过滤器信息 */}
							<div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
								<span>
									显示 {filteredMemories.length} / {state.memories.length} 条记忆
								</span>
								{state.filter.memoryType && state.filter.memoryType !== "all" && (
									<Badge variant="outline" className="text-xs">
										类型:{" "}
										{memoryTypeOptions.find((o) => o.value === state.filter.memoryType)?.label}
									</Badge>
								)}
								{state.filter.triggerType && state.filter.triggerType !== "all" && (
									<Badge variant="outline" className="text-xs">
										触发:{" "}
										{triggerTypeOptions.find((o) => o.value === state.filter.triggerType)?.label}
									</Badge>
								)}
							</div>
						</CardContent>
					</Card>

					{/* 记忆列表 */}
					<Card>
						<CardHeader>
							<div className="flex items-center justify-between">
								<CardTitle className="flex items-center gap-2">
									<Brain className="h-5 w-5" />
									记忆列表
								</CardTitle>
								<div className="flex items-center gap-2">
									<Checkbox
										checked={
											state.selectedMemories.length === filteredMemories.length &&
											filteredMemories.length > 0
										}
										onCheckedChange={toggleSelectAll}
									/>
									<span className="text-sm text-gray-500">全选</span>
								</div>
							</div>
						</CardHeader>
						<CardContent>
							{state.loading ? (
								<div className="flex items-center justify-center py-8">
									<RefreshCw className="h-6 w-6 animate-spin" />
									<span className="ml-2">加载中...</span>
								</div>
							) : filteredMemories.length === 0 ? (
								<div className="text-center py-8">
									<Brain className="h-12 w-12 text-gray-300 mx-auto mb-4" />
									<p className="text-gray-500">
										{state.memories.length === 0 ? "暂无记忆" : "没有符合过滤条件的记忆"}
									</p>
								</div>
							) : (
								<ScrollArea className="h-[600px]">
									<div className="space-y-3">{filteredMemories.map(renderMemoryCard)}</div>
								</ScrollArea>
							)}
						</CardContent>
					</Card>
				</>
			)}

			{/* 删除确认对话框 */}
			<AlertDialog
				open={state.showDeleteDialog}
				onOpenChange={(open) => setState((prev) => ({ ...prev, showDeleteDialog: open }))}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>确认删除</AlertDialogTitle>
						<AlertDialogDescription>
							{state.memoryToDelete
								? "确定要删除这条记忆吗？此操作无法撤销。"
								: `确定要删除选中的 ${state.selectedMemories.length} 条记忆吗？此操作无法撤销。`}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>取消</AlertDialogCancel>
						<AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
							删除
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* 导入对话框 */}
			<Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
				<DialogContent className="max-w-2xl">
					<DialogHeader>
						<DialogTitle>导入记忆</DialogTitle>
						<DialogDescription>粘贴JSON格式的记忆数据</DialogDescription>
					</DialogHeader>

					<div className="space-y-4">
						<div>
							<Label htmlFor="importData">记忆数据 (JSON格式)</Label>
							<Textarea
								id="importData"
								value={importData}
								onChange={(e) => setImportData(e.target.value)}
								rows={10}
								placeholder='[{"id": "...", "type": "episodic", "content": "..."}]'
							/>
						</div>
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => setShowImportDialog(false)}>
							取消
						</Button>
						<Button onClick={importMemories} disabled={!importData.trim()}>
							导入
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* 过滤对话框 */}
			<Dialog open={showFilterDialog} onOpenChange={setShowFilterDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>过滤条件</DialogTitle>
						<DialogDescription>设置记忆过滤条件</DialogDescription>
					</DialogHeader>

					<div className="space-y-4">
						<div>
							<Label>记忆类型</Label>
							<Select
								value={state.filter.memoryType || "all"}
								onValueChange={(value) =>
									setState((prev) => ({
										...prev,
										filter: { ...prev.filter, memoryType: value as any },
									}))
								}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{memoryTypeOptions.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div>
							<Label>触发类型</Label>
							<Select
								value={state.filter.triggerType || "all"}
								onValueChange={(value) =>
									setState((prev) => ({
										...prev,
										filter: { ...prev.filter, triggerType: value as any },
									}))
								}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{triggerTypeOptions.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div>
							<Label>常驻记忆</Label>
							<Select
								value={
									state.filter.isConstant === undefined ? "all" : state.filter.isConstant.toString()
								}
								onValueChange={(value) =>
									setState((prev) => ({
										...prev,
										filter: {
											...prev.filter,
											isConstant: value === "all" ? undefined : value === "true",
										},
									}))
								}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">全部</SelectItem>
									<SelectItem value="true">仅常驻</SelectItem>
									<SelectItem value="false">仅非常驻</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div>
							<Label>
								优先级范围: {state.filter.priorityRange?.min} - {state.filter.priorityRange?.max}
							</Label>
							<div className="flex items-center gap-2 mt-2">
								<Slider
									value={[state.filter.priorityRange?.min || 0]}
									onValueChange={([min]) =>
										setState((prev) => ({
											...prev,
											filter: {
												...prev.filter,
												priorityRange: { ...prev.filter.priorityRange!, min },
											},
										}))
									}
									max={100}
									step={5}
									className="flex-1"
								/>
								<span className="text-sm w-8 text-center">{state.filter.priorityRange?.min || 0}</span>
							</div>
							<div className="flex items-center gap-2 mt-1">
								<Slider
									value={[state.filter.priorityRange?.max || 100]}
									onValueChange={([max]) =>
										setState((prev) => ({
											...prev,
											filter: {
												...prev.filter,
												priorityRange: { ...prev.filter.priorityRange!, max },
											},
										}))
									}
									max={100}
									step={5}
									className="flex-1"
								/>
								<span className="text-sm w-8 text-center">
									{state.filter.priorityRange?.max || 100}
								</span>
							</div>
						</div>
					</div>

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() =>
								setState((prev) => ({
									...prev,
									filter: {
										search: "",
										memoryType: "all",
										triggerType: "all",
										priorityRange: { min: 0, max: 100 },
										isConstant: undefined,
									},
								}))
							}>
							重置
						</Button>
						<Button onClick={() => setShowFilterDialog(false)}>确定</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* 编辑对话框 */}
			{renderEditDialog()}

			{/* 错误提示 */}
			{state.error && (
				<Card className="border-red-200 bg-red-50">
					<CardContent className="p-4">
						<div className="flex items-center gap-2 text-red-700">
							<AlertCircle className="h-4 w-4" />
							<span className="text-sm">{state.error}</span>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setState((prev) => ({ ...prev, error: undefined }))}
								className="ml-auto h-6 w-6 p-0">
								<X className="h-3 w-3" />
							</Button>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	)
}
