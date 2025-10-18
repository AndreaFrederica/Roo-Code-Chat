import React, { useState } from "react"
import { StandardTooltip } from "@/components/ui"
import { cn } from "@/lib/utils"

interface RegexBinding {
	id: string
	scriptName: string
	findRegex: string
	replaceString: string
	trimStrings: string[]
	substituteRegex: number
	placement: number[]
	disabled: boolean
	markdownOnly: boolean
	promptOnly: boolean
	runOnEdit: boolean
	minDepth?: number
	maxDepth?: number
	runStages: string[]
	targetSource: string
	priority: number
}

interface RegexEditorProps {
	binding: RegexBinding
	onChange: (binding: RegexBinding) => void
	onDelete: () => void
	onReset?: (id: string) => void
	editMode: "mixin" | "source"
	originalBinding?: RegexBinding
}

export function RegexEditor({ binding, onChange, onDelete, onReset, editMode, originalBinding }: RegexEditorProps) {
	const [isExpanded, setIsExpanded] = useState(false)
	const [isEdited, setIsEdited] = useState(false)

	const handleReset = () => {
		if (onReset) {
			onReset(binding.id)
		}
	}

	// 检查是否有变化
	const hasChanges = originalBinding && (
		binding.scriptName !== originalBinding.scriptName ||
		binding.findRegex !== originalBinding.findRegex ||
		binding.replaceString !== originalBinding.replaceString ||
		binding.disabled !== originalBinding.disabled ||
		binding.priority !== originalBinding.priority
	)

	const handleChange = (field: keyof RegexBinding, value: any) => {
		const updatedBinding = { ...binding, [field]: value }
		onChange(updatedBinding)
		setIsEdited(true)
	}

	const handleDelete = () => {
		onDelete()
	}

	const runStageOptions = [
		{ value: "pre_processing", label: "预处理" },
		{ value: "ai_output", label: "AI输出" },
		{ value: "post_processing", label: "后处理" }
	]

	const targetSourceOptions = [
		{ value: "prompt_content", label: "提示词内容" },
		{ value: "ai_response", label: "AI回复" },
		{ value: "user_input", label: "用户输入" },
		{ value: "all_content", label: "所有内容" }
	]

	return (
		<div className="border border-vscode-editorGroup-border rounded mb-2">
			<div className="flex items-center justify-between p-3 bg-vscode-editor-background hover:bg-vscode-toolbar-hoverBackground cursor-pointer"
				 onClick={() => setIsExpanded(!isExpanded)}>
				<div className="flex items-center gap-2 flex-1 min-w-0">
					<input
						type="checkbox"
						checked={!binding.disabled}
						onChange={(e) => {
							e.stopPropagation()
							handleChange("disabled", !e.target.checked)
						}}
						className="rounded"
					/>
					<span className={cn(
						"font-medium text-vscode-editor-foreground",
						binding.disabled && "text-vscode-disabledForeground"
					)}>
						{binding.scriptName || "未命名正则"}
					</span>
					{isEdited && (
						<span className="text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-400">
							已修改
						</span>
					)}
				</div>
				<div className="flex items-center gap-2">
					<span className="text-xs text-vscode-descriptionForeground truncate max-w-48">
						{binding.findRegex || ""}
					</span>
					<StandardTooltip content={isExpanded ? "收起" : "展开"}>
						<span className={`codicon codicon-chevron-${isExpanded ? "down" : "right"} text-vscode-descriptionForeground`} />
					</StandardTooltip>
					{editMode === "mixin" && hasChanges && (
						<StandardTooltip content="还原到原始状态">
							<span
								className="codicon codicon-refresh text-vscode-warning-foreground hover:text-vscode-warning-foreground cursor-pointer"
								onClick={(e) => {
									e.stopPropagation()
									handleReset()
								}}
							/>
						</StandardTooltip>
					)}
					{editMode === "mixin" && (
						<StandardTooltip content="删除">
							<span
								className="codicon codicon-trash text-vscode-errorForeground hover:text-vscode-errorForeground cursor-pointer"
								onClick={(e) => {
									e.stopPropagation()
									handleDelete()
								}}
							/>
						</StandardTooltip>
					)}
				</div>
			</div>

			{isExpanded && (
				<div className="p-4 border-t border-vscode-editorGroup-border bg-vscode-editor-background">
					<div className="space-y-4">
						{/* 基本信息 */}
						<div className="grid grid-cols-2 gap-4">
							<div>
								<label className="block text-sm font-medium text-vscode-editor-foreground mb-1">
									名称
								</label>
								<input
									type="text"
									value={binding.scriptName}
									onChange={(e) => handleChange("scriptName", e.target.value)}
									className="w-full px-3 py-2 bg-vscode-input-background border border-vscode-input-border rounded text-vscode-input-foreground"
									placeholder="正则名称"
								/>
							</div>
							<div>
								<label className="block text-sm font-medium text-vscode-editor-foreground mb-1">
									优先级
								</label>
								<input
									type="number"
									value={binding.priority}
									onChange={(e) => handleChange("priority", parseInt(e.target.value) || 0)}
									className="w-full px-3 py-2 bg-vscode-input-background border border-vscode-input-border rounded text-vscode-input-foreground"
								/>
							</div>
						</div>

						{/* 正则表达式 */}
						<div>
							<label className="block text-sm font-medium text-vscode-editor-foreground mb-1">
								查找正则
							</label>
							<input
								type="text"
								value={binding.findRegex}
								onChange={(e) => handleChange("findRegex", e.target.value)}
								className="w-full px-3 py-2 bg-vscode-input-background border border-vscode-input-border rounded text-vscode-input-foreground font-mono"
								placeholder="正则表达式"
							/>
						</div>

						<div>
							<label className="block text-sm font-medium text-vscode-editor-foreground mb-1">
								替换字符串
							</label>
							<input
								type="text"
								value={binding.replaceString}
								onChange={(e) => handleChange("replaceString", e.target.value)}
								className="w-full px-3 py-2 bg-vscode-input-background border border-vscode-input-border rounded text-vscode-input-foreground font-mono"
								placeholder="替换字符串"
							/>
						</div>

						{/* 高级配置 */}
						<div className="grid grid-cols-2 gap-4">
							<div>
								<label className="block text-sm font-medium text-vscode-editor-foreground mb-1">
									运行阶段
								</label>
								<div className="space-y-1">
									{runStageOptions.map((option) => (
										<label key={option.value} className="flex items-center gap-2 text-sm">
											<input
												type="checkbox"
												checked={binding.runStages.includes(option.value)}
												onChange={(e) => {
													const stages = e.target.checked
														? [...binding.runStages, option.value]
														: binding.runStages.filter(s => s !== option.value)
													handleChange("runStages", stages)
												}}
												className="rounded"
											/>
											<span className="text-vscode-editor-foreground">{option.label}</span>
										</label>
									))}
								</div>
							</div>

							<div>
								<label className="block text-sm font-medium text-vscode-editor-foreground mb-1">
									目标源
								</label>
								<select
									value={binding.targetSource}
									onChange={(e) => handleChange("targetSource", e.target.value)}
									className="w-full px-3 py-2 bg-vscode-input-background border border-vscode-input-border rounded text-vscode-input-foreground"
								>
									{targetSourceOptions.map((option) => (
										<option key={option.value} value={option.value}>
											{option.label}
										</option>
									))}
								</select>
							</div>
						</div>

						{/* 深度限制 */}
						<div className="grid grid-cols-2 gap-4">
							<div>
								<label className="block text-sm font-medium text-vscode-editor-foreground mb-1">
									最小深度
								</label>
								<input
									type="number"
									value={binding.minDepth || ""}
									onChange={(e) => handleChange("minDepth", e.target.value ? parseInt(e.target.value) : undefined)}
									className="w-full px-3 py-2 bg-vscode-input-background border border-vscode-input-border rounded text-vscode-input-foreground"
									placeholder="无限制"
								/>
							</div>
							<div>
								<label className="block text-sm font-medium text-vscode-editor-foreground mb-1">
									最大深度
								</label>
								<input
									type="number"
									value={binding.maxDepth || ""}
									onChange={(e) => handleChange("maxDepth", e.target.value ? parseInt(e.target.value) : undefined)}
									className="w-full px-3 py-2 bg-vscode-input-background border border-vscode-input-border rounded text-vscode-input-foreground"
									placeholder="无限制"
								/>
							</div>
						</div>

						{/* 选项 */}
						<div>
							<label className="block text-sm font-medium text-vscode-editor-foreground mb-1">
								选项
							</label>
							<div className="flex flex-wrap gap-4">
								<label className="flex items-center gap-2 text-sm">
									<input
										type="checkbox"
										checked={binding.markdownOnly}
										onChange={(e) => handleChange("markdownOnly", e.target.checked)}
										className="rounded"
									/>
									<span className="text-vscode-editor-foreground">仅限Markdown</span>
								</label>
								<label className="flex items-center gap-2 text-sm">
									<input
										type="checkbox"
										checked={binding.promptOnly}
										onChange={(e) => handleChange("promptOnly", e.target.checked)}
										className="rounded"
									/>
									<span className="text-vscode-editor-foreground">仅限提示词</span>
								</label>
								<label className="flex items-center gap-2 text-sm">
									<input
										type="checkbox"
										checked={binding.runOnEdit}
										onChange={(e) => handleChange("runOnEdit", e.target.checked)}
										className="rounded"
									/>
									<span className="text-vscode-editor-foreground">编辑时运行</span>
								</label>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}