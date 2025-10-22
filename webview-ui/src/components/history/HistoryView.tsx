import React, { memo, useState } from "react"
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

import { Tab, TabContent, TabHeader } from "../common/Tab"
import { useTaskSearch } from "./useTaskSearch"
import TaskItem from "./TaskItem"
import { ImportTaskButton } from "./ImportTaskButton"
import WeChatHistoryView from "./WeChatHistoryView"

type HistoryViewProps = {
	onDone: () => void
}

type SortOption = "newest" | "oldest" | "mostExpensive" | "mostTokens" | "mostRelevant"
type ViewMode = "chat" | "list"

const HistoryView = ({ onDone }: HistoryViewProps) => {
	const {
		tasks,
		searchQuery,
		setSearchQuery,
		sortOption,
		setSortOption,
		showAllWorkspaces,
		setShowAllWorkspaces,
		showGlobalOnly,
		setShowGlobalOnly,
	} = useTaskSearch()
	const { t } = useAppTranslation()

	const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null)
	const [isSelectionMode, setIsSelectionMode] = useState(false)
	const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([])
	const [showBatchDeleteDialog, setShowBatchDeleteDialog] = useState<boolean>(false)
	const [viewMode, setViewMode] = useState<ViewMode>("chat")

	const isChatView = viewMode === "chat"
	const isListView = viewMode === "list"

	const handleViewModeChange = (mode: ViewMode) => {
		setViewMode(mode)
		if (mode === "chat") {
			setIsSelectionMode(false)
			setSelectedTaskIds([])
		}
	}

	const renderViewModeButtons = () => (
		<>
			<StandardTooltip content={isChatView ? "当前为聊天视图" : "切换到聊天视图"}>
				<Button
					variant={isChatView ? "default" : "secondary"}
					onClick={() => handleViewModeChange("chat")}
					data-testid="toggle-wechat-view-button">
					<span className="codicon codicon-comment-discussion mr-1" />
					聊天视图
				</Button>
			</StandardTooltip>
			<StandardTooltip content={isListView ? "当前为列表视图" : "切换到列表视图"}>
				<Button
					variant={isListView ? "default" : "secondary"}
					onClick={() => handleViewModeChange("list")}
					data-testid="toggle-list-view-button">
					<span className="codicon codicon-list-flat mr-1" />
					列表视图
				</Button>
			</StandardTooltip>
		</>
	)

	// Toggle selection mode
	const toggleSelectionMode = () => {
		const next = !isSelectionMode
		setIsSelectionMode(next)
		if (!next) {
			setSelectedTaskIds([])
		}
	}

	// Toggle selection for a single task
	const toggleTaskSelection = (taskId: string, isSelected: boolean) => {
		if (isSelected) {
			setSelectedTaskIds((prev) => [...prev, taskId])
		} else {
			setSelectedTaskIds((prev) => prev.filter((id) => id !== taskId))
		}
	}

	// Toggle select all
	const toggleSelectAll = (selectAll: boolean) => {
		if (selectAll) {
			setSelectedTaskIds(tasks.map((task) => task.id))
		} else {
			setSelectedTaskIds([])
		}
	}

	// Handle batch delete
	const handleBatchDelete = () => {
		if (selectedTaskIds.length > 0) {
			setShowBatchDeleteDialog(true)
		}
	}

	const renderListFilters = () => (
		<div className="flex flex-col gap-2">
			<VSCodeTextField
				className="w-full"
				placeholder={t("history:searchPlaceholder")}
				value={searchQuery}
				data-testid="history-search-input"
				onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
			/>
			<div className="flex gap-2">
				<Select
					value={showAllWorkspaces ? "all" : showGlobalOnly ? "global" : "current"}
					onValueChange={(value) => {
						setShowAllWorkspaces(value === "all")
						setShowGlobalOnly(value === "global")
					}}>
					<SelectTrigger className="flex-1">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="current">
							<div className="flex items-center gap-2">
								<span className="codicon codicon-folder" />
								{t("history:workspace.current")}
							</div>
						</SelectItem>
						<SelectItem value="all">
							<div className="flex items-center gap-2">
								<span className="codicon codicon-folder-opened" />
								{t("history:workspace.all")}
							</div>
						</SelectItem>
						<SelectItem value="global">
							<div className="flex items-center gap-2">
								<span className="codicon codicon-globe" />
								全局对话
							</div>
						</SelectItem>
					</SelectContent>
				</Select>
				<Select value={sortOption} onValueChange={(value) => setSortOption(value as SortOption)}>
					<SelectTrigger className="flex-1">
						<SelectValue>
							{t("history:sort.prefix")} {t(`history:sort.${sortOption}`)}
						</SelectValue>
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="newest" data-testid="select-newest">
							<div className="flex items-center gap-2">
								<span className="codicon codicon-arrow-down" />
								{t("history:newest")}
							</div>
						</SelectItem>
						<SelectItem value="oldest" data-testid="select-oldest">
							<div className="flex items-center gap-2">
								<span className="codicon codicon-arrow-up" />
								{t("history:oldest")}
							</div>
						</SelectItem>
						<SelectItem value="mostExpensive" data-testid="select-most-expensive">
							<div className="flex items-center gap-2">
								<span className="codicon codicon-credit-card" />
								{t("history:mostExpensive")}
							</div>
						</SelectItem>
						<SelectItem value="mostTokens" data-testid="select-most-tokens">
							<div className="flex items-center gap-2">
								<span className="codicon codicon-symbol-numeric" />
								{t("history:mostTokens")}
							</div>
						</SelectItem>
						<SelectItem value="mostRelevant" disabled={!searchQuery} data-testid="select-most-relevant">
							<div className="flex items-center gap-2">
								<span className="codicon codicon-search" />
								{t("history:mostRelevant")}
							</div>
						</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{/* Select all control in selection mode */}
			{isSelectionMode && tasks.length > 0 && (
				<div className="flex items-center py-1">
					<div className="flex items-center gap-2">
						<Checkbox
							checked={tasks.length > 0 && selectedTaskIds.length === tasks.length}
							onCheckedChange={(checked) => toggleSelectAll(checked === true)}
							variant="description"
						/>
						<span className="text-vscode-foreground">
							{selectedTaskIds.length === tasks.length ? t("history:deselectAll") : t("history:selectAll")}
						</span>
						<span className="ml-auto text-vscode-descriptionForeground text-xs">
							{t("history:selectedItems", {
								selected: selectedTaskIds.length,
								total: tasks.length,
							})}
						</span>
					</div>
				</div>
			)}
		</div>
	)

	const renderListContent = () => (
		<Virtuoso
			className="flex-1 overflow-y-scroll"
			data={tasks}
			data-testid="virtuoso-container"
			initialTopMostItemIndex={0}
			components={{
				List: React.forwardRef((props, ref) => (
					<div {...props} ref={ref} data-testid="virtuoso-item-list" />
				)),
			}}
			itemContent={(_index, item) => (
				<TaskItem
					key={item.id}
					item={item}
					variant="full"
					showWorkspace={showAllWorkspaces}
					isSelectionMode={isSelectionMode}
					isSelected={selectedTaskIds.includes(item.id)}
					onToggleSelection={toggleTaskSelection}
					onDelete={setDeleteTaskId}
					className="m-2"
				/>
			)}
		/>
	)

	const renderSelectionFooter = () =>
		isSelectionMode &&
		selectedTaskIds.length > 0 && (
			<div className="fixed bottom-0 left-0 right-2 bg-vscode-editor-background border-t border-vscode-panel-border p-2 flex justify-between items-center">
				<div className="text-vscode-foreground">
					{t("history:selectedItems", { selected: selectedTaskIds.length, total: tasks.length })}
				</div>
				<div className="flex gap-2">
					<Button variant="secondary" onClick={() => setSelectedTaskIds([])}>
						{t("history:clearSelection")}
					</Button>
					<Button variant="default" onClick={handleBatchDelete}>
						{t("history:deleteSelected")}
					</Button>
				</div>
			</div>
		)

	const renderDialogs = () => (
		<>
			{deleteTaskId && (
				<DeleteTaskDialog taskId={deleteTaskId} onOpenChange={(open) => !open && setDeleteTaskId(null)} open={!!deleteTaskId} />
			)}

			{showBatchDeleteDialog && (
				<BatchDeleteTaskDialog
					taskIds={selectedTaskIds}
					open={showBatchDeleteDialog}
					onOpenChange={(open) => {
						if (!open) {
							setShowBatchDeleteDialog(false)
							setSelectedTaskIds([])
							setIsSelectionMode(false)
						}
					}}
				/>
			)}
		</>
	)

	if (isChatView) {
		return (
			<WeChatHistoryView
				onDone={onDone}
				layout="embedded"
				headerActions={
					<div className="flex items-center gap-2">
						{renderViewModeButtons()}
					</div>
				}
			/>
		)
	}

	return (
		<Tab>
			<TabHeader className="flex flex-col gap-2">
				<div className="flex justify-between items-center">
					<h3 className="text-vscode-foreground m-0">{t("history:history")}</h3>
					<div className="flex gap-2 items-center">
						<ImportTaskButton />
						{renderViewModeButtons()}
						<StandardTooltip
							content={isSelectionMode ? `${t("history:exitSelectionMode")}` : `${t("history:enterSelectionMode")}`}>
							<Button
								variant={isSelectionMode ? "default" : "secondary"}
								onClick={toggleSelectionMode}
								data-testid="toggle-selection-mode-button">
								<span className={`codicon ${isSelectionMode ? "codicon-check-all" : "codicon-checklist"} mr-1`} />
								{isSelectionMode ? t("history:exitSelection") : t("history:selectionMode")}
							</Button>
						</StandardTooltip>
						<Button onClick={onDone}>{t("history:done")}</Button>
					</div>
				</div>
				{renderListFilters()}
			</TabHeader>

			<TabContent className="px-2 py-0">{renderListContent()}</TabContent>

			{renderSelectionFooter()}
			{renderDialogs()}
		</Tab>
	)
}

export default memo(HistoryView)
