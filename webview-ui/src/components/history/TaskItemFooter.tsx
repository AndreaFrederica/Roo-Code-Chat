import React from "react"
import type { HistoryItem } from "@roo-code/types"
import { formatTimeAgo } from "@/utils/format"
import { getChatModePreviewFromHistoryItem } from "@/utils/messageParser"
import { CopyButton } from "./CopyButton"
import { ExportButton } from "./ExportButton"
import { ExportBundleButton } from "./ExportBundleButton"
import { DeleteButton } from "./DeleteButton"
import { StandardTooltip } from "../ui/standard-tooltip"

export interface TaskItemFooterProps {
	item: HistoryItem
	variant: "compact" | "full"
	isSelectionMode?: boolean
	onDelete?: (taskId: string) => void
	displayMode?: 'coding' | 'chat'
}

const TaskItemFooter: React.FC<TaskItemFooterProps> = ({
	item,
	variant,
	isSelectionMode = false,
	onDelete,
	displayMode = 'coding'
}) => {
	// 在聊天模式下，显示第一句话作为预览
	const chatModePreview = displayMode === 'chat' ? getChatModePreviewFromHistoryItem(item, 30) : null

	return (
		<div className="text-xs text-vscode-descriptionForeground flex justify-between items-center">
			<div className="flex gap-2 items-center text-vscode-descriptionForeground/60">
				{/* Role information */}
				{item.anhRoleName && (
					<>
						<span className="flex items-center gap-1">
							<span className="codicon codicon-account scale-75" />
							<span>{item.anhRoleName}</span>
						</span>
						<span>·</span>
					</>
				)}
				{/* Datetime with time-ago format */}
				<StandardTooltip content={new Date(item.ts).toLocaleString()}>
					<span className="first-letter:uppercase">{formatTimeAgo(item.ts)}</span>
				</StandardTooltip>
				{/* Chat mode: show first message preview */}
				{displayMode === 'chat' && chatModePreview && (
					<>
						<span>·</span>
						<span className="text-vscode-descriptionForeground/80 italic">
							{chatModePreview}
						</span>
					</>
				)}
				<span>·</span>
				{/* Cost */}
				{!!item.totalCost && (
					<span className="flex items-center" data-testid="cost-footer-compact">
						{"$" + item.totalCost.toFixed(2)}
					</span>
				)}
			</div>

			{/* Action Buttons for non-compact view */}
			{!isSelectionMode && (
				<div className="flex flex-row gap-0 items-center text-vscode-descriptionForeground/60 hover:text-vscode-descriptionForeground">
					<CopyButton itemTask={item.task} />
					{variant === "full" && (
						<>
							<ExportButton itemId={item.id} />
							<ExportBundleButton itemId={item.id} />
						</>
					)}
					{onDelete && <DeleteButton itemId={item.id} onDelete={onDelete} />}
				</div>
			)}
		</div>
	)
}

export default TaskItemFooter
