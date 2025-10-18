import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/common/Modal'
import { IconButton } from '@/components/common/IconButton'

// 临时定义类型，直到类型包更新
enum RegexRunStage {
	PRE_PROCESSING = "pre_processing",
	AI_OUTPUT = "ai_output",
	POST_PROCESSING = "post_processing"
}

enum RegexTargetSource {
	PROMPT_CONTENT = "prompt_content",
	AI_RESPONSE = "ai_response",
	ALL_CONTENT = "all_content"
}

interface STRegexBinding {
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
	runStages: RegexRunStage[]
	targetSource: RegexTargetSource
	priority: number
	description?: string
}

interface RegexSettingsProps {
	isOpen: boolean
	onClose: () => void
	regexBindings: STRegexBinding[]
	onSave: (bindings: STRegexBinding[]) => void
}

interface RegexFormData {
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
	runStages: RegexRunStage[]
	targetSource: RegexTargetSource
	priority: number
	description?: string
}

export function RegexSettings({ isOpen, onClose, regexBindings, onSave }: RegexSettingsProps) {
	const [bindings, setBindings] = useState<STRegexBinding[]>([])
	const [editingBinding, setEditingBinding] = useState<RegexFormData | null>(null)
	const [isEditing, setIsEditing] = useState(false)
	const [searchTerm, setSearchTerm] = useState('')

	useEffect(() => {
		// 确保regexBindings是数组
		if (Array.isArray(regexBindings)) {
			setBindings(regexBindings)
		} else {
			setBindings([])
		}
	}, [regexBindings])

	const filteredBindings = bindings.filter(binding =>
		binding.scriptName.toLowerCase().includes(searchTerm.toLowerCase()) ||
		binding.findRegex.toLowerCase().includes(searchTerm.toLowerCase())
	)

	const handleCreateNew = () => {
		const newBinding: RegexFormData = {
			id: `regex-${Date.now()}`,
			scriptName: '',
			findRegex: '',
			replaceString: '',
			trimStrings: [],
			substituteRegex: 1,
			placement: [1],
			disabled: false,
			markdownOnly: false,
			promptOnly: false,
			runOnEdit: false,
			runStages: [RegexRunStage.AI_OUTPUT],
			targetSource: RegexTargetSource.AI_RESPONSE,
			priority: 100,
			description: ''
		}
		setEditingBinding(newBinding)
		setIsEditing(true)
	}

	const handleEdit = (binding: STRegexBinding) => {
		const formData: RegexFormData = {
			...binding,
			runStages: binding.runStages || [],
			description: binding.description || ''
		}
		setEditingBinding(formData)
		setIsEditing(true)
	}

	const handleDelete = (id: string) => {
		setBindings(bindings.filter(b => b.id !== id))
	}

	const handleSave = () => {
		if (!editingBinding) return

		if (isEditing) {
			const updatedBinding: STRegexBinding = {
				...editingBinding,
				runStages: editingBinding.runStages,
				description: editingBinding.description
			}
			setBindings(bindings.map(b => b.id === editingBinding.id ? updatedBinding : b))
		}

		setEditingBinding(null)
		setIsEditing(false)
	}

	const handleSaveAll = () => {
		onSave(bindings)
		onClose()
	}

	const handleCancel = () => {
		setEditingBinding(null)
		setIsEditing(false)
	}

	const updateEditingBinding = (field: keyof RegexFormData, value: any) => {
		if (!editingBinding) return
		setEditingBinding({
			...editingBinding,
			[field]: value
		})
	}

	const runStageLabels = {
		[RegexRunStage.PRE_PROCESSING]: '预处理',
		[RegexRunStage.AI_OUTPUT]: 'AI输出',
		[RegexRunStage.POST_PROCESSING]: '后处理'
	}

	const targetSourceLabels = {
		[RegexTargetSource.PROMPT_CONTENT]: '提示词内容',
		[RegexTargetSource.AI_RESPONSE]: 'AI回复',
		[RegexTargetSource.ALL_CONTENT]: '所有内容'
	}

	return (
		<Modal isOpen={isOpen} onClose={onClose}>
			<div className="flex flex-col h-full">
				{/* Header */}
				<div className="flex items-center justify-between p-4 border-b border-vscode-editorGroup-border">
					<h2 className="text-lg font-semibold text-vscode-editor-foreground">正则表达式设置</h2>
					<div className="flex items-center gap-2">
						<Button onClick={handleSaveAll} variant="default" size="sm">
							保存所有
						</Button>
						<IconButton icon="close" onClick={onClose} title="关闭" />
					</div>
				</div>

				{/* Main Content */}
				<div className="flex-1 flex overflow-hidden">
					{/* Left Panel - List */}
					<div className="w-1/3 border-r border-vscode-editorGroup-border flex flex-col">
						<div className="p-4 border-b border-vscode-editorGroup-border">
							<div className="flex items-center gap-2 mb-3">
								<input
									type="text"
									placeholder="搜索正则..."
									value={searchTerm}
									onChange={(e) => setSearchTerm(e.target.value)}
									className="flex-1 px-3 py-2 bg-vscode-input-background border border-vscode-input-border rounded text-vscode-input-foreground placeholder-vscode-input-placeholderForeground"
								/>
								<Button onClick={handleCreateNew} variant="outline" size="sm">
									新建
								</Button>
							</div>
						</div>
						<div className="flex-1 overflow-y-auto">
							{filteredBindings.map((binding) => (
								<div
									key={binding.id}
									className={`p-3 border-b border-vscode-editorGroup-border cursor-pointer hover:bg-vscode-toolbar-hoverBackground ${
										editingBinding?.id === binding.id ? 'bg-vscode-list-activeSelectionBackground' : ''
									}`}
									onClick={() => handleEdit(binding)}
								>
									<div className="flex items-center justify-between">
										<div className="flex-1 min-w-0">
											<div className="font-medium text-vscode-editor-foreground truncate">
												{binding.scriptName || '未命名正则'}
											</div>
											<div className="text-sm text-vscode-descriptionForeground truncate">
												{binding.findRegex}
											</div>
											<div className="flex items-center gap-2 mt-1">
												<span className="text-xs px-2 py-1 bg-vscode-button-secondaryBackground rounded text-vscode-button-secondaryForeground">
													{runStageLabels[binding.runStages[0] || RegexRunStage.AI_OUTPUT]}
												</span>
												{binding.disabled && (
													<span className="text-xs px-2 py-1 bg-vscode-errorBackground rounded text-vscode-errorForeground">
														已禁用
													</span>
												)}
											</div>
										</div>
										<IconButton
											icon="trash"
											onClick={(e) => {
												e.stopPropagation()
												handleDelete(binding.id)
											}}
											title="删除"
											size="small"
										/>
									</div>
								</div>
							))}
						</div>
					</div>

					{/* Right Panel - Editor */}
					<div className="flex-1 flex flex-col">
						{editingBinding ? (
							<>
								<div className="p-4 border-b border-vscode-editorGroup-border">
									<div className="flex items-center justify-between">
										<h3 className="text-base font-semibold text-vscode-editor-foreground">
											{isEditing ? '编辑正则' : '查看正则'}
										</h3>
										{isEditing && (
											<div className="flex items-center gap-2">
												<Button onClick={handleSave} variant="outline" size="sm">
													保存
												</Button>
												<Button onClick={handleCancel} variant="ghost" size="sm">
													取消
												</Button>
											</div>
										)}
									</div>
								</div>
								<div className="flex-1 overflow-y-auto p-4">
									<div className="space-y-4">
										{/* 基本信息 */}
										<div>
											<label className="block text-sm font-medium text-vscode-editor-foreground mb-1">
												名称
											</label>
											<input
												type="text"
												value={editingBinding.scriptName}
												onChange={(e) => updateEditingBinding('scriptName', e.target.value)}
												disabled={!isEditing}
												className="w-full px-3 py-2 bg-vscode-input-background border border-vscode-input-border rounded text-vscode-input-foreground disabled:opacity-50"
											/>
										</div>

										<div>
											<label className="block text-sm font-medium text-vscode-editor-foreground mb-1">
												描述
											</label>
											<textarea
												value={editingBinding.description || ''}
												onChange={(e) => updateEditingBinding('description', e.target.value)}
												disabled={!isEditing}
												rows={2}
												className="w-full px-3 py-2 bg-vscode-input-background border border-vscode-input-border rounded text-vscode-input-foreground disabled:opacity-50"
											/>
										</div>

										{/* 正则表达式 */}
										<div>
											<label className="block text-sm font-medium text-vscode-editor-foreground mb-1">
												查找正则
											</label>
											<input
												type="text"
												value={editingBinding.findRegex}
												onChange={(e) => updateEditingBinding('findRegex', e.target.value)}
												disabled={!isEditing}
												className="w-full px-3 py-2 bg-vscode-input-background border border-vscode-input-border rounded text-vscode-input-foreground disabled:opacity-50 font-mono"
											/>
										</div>

										<div>
											<label className="block text-sm font-medium text-vscode-editor-foreground mb-1">
												替换字符串
											</label>
											<input
												type="text"
												value={editingBinding.replaceString}
												onChange={(e) => updateEditingBinding('replaceString', e.target.value)}
												disabled={!isEditing}
												className="w-full px-3 py-2 bg-vscode-input-background border border-vscode-input-border rounded text-vscode-input-foreground disabled:opacity-50 font-mono"
											/>
										</div>

										{/* 运行阶段 */}
										<div>
											<label className="block text-sm font-medium text-vscode-editor-foreground mb-1">
												运行阶段
											</label>
											<div className="space-y-2">
												{Object.entries(runStageLabels).map(([stage, label]) => (
													<label key={stage} className="flex items-center gap-2">
														<input
															type="checkbox"
															checked={editingBinding.runStages.includes(stage as RegexRunStage)}
															onChange={(e) => {
																const stages = e.target.checked
																	? [...editingBinding.runStages, stage as RegexRunStage]
																	: editingBinding.runStages.filter(s => s !== stage)
																updateEditingBinding('runStages', stages)
															}}
															disabled={!isEditing}
															className="rounded"
														/>
														<span className="text-sm text-vscode-editor-foreground">{label}</span>
													</label>
												))}
											</div>
										</div>

										{/* 目标源 */}
										<div>
											<label className="block text-sm font-medium text-vscode-editor-foreground mb-1">
												目标源
											</label>
											<select
												value={editingBinding.targetSource}
												onChange={(e) => updateEditingBinding('targetSource', e.target.value)}
												disabled={!isEditing}
												className="w-full px-3 py-2 bg-vscode-input-background border border-vscode-input-border rounded text-vscode-input-foreground disabled:opacity-50"
											>
												{Object.entries(targetSourceLabels).map(([source, label]) => (
													<option key={source} value={source}>
														{label}
													</option>
												))}
											</select>
										</div>

										{/* 优先级 */}
										<div>
											<label className="block text-sm font-medium text-vscode-editor-foreground mb-1">
												优先级 (数值越大优先级越高)
											</label>
											<input
												type="number"
												value={editingBinding.priority}
												onChange={(e) => updateEditingBinding('priority', parseInt(e.target.value))}
												disabled={!isEditing}
												className="w-full px-3 py-2 bg-vscode-input-background border border-vscode-input-border rounded text-vscode-input-foreground disabled:opacity-50"
											/>
										</div>

										{/* 选项 */}
										<div>
											<label className="block text-sm font-medium text-vscode-editor-foreground mb-1">
												选项
											</label>
											<div className="space-y-2">
												<label className="flex items-center gap-2">
													<input
														type="checkbox"
														checked={editingBinding.disabled}
														onChange={(e) => updateEditingBinding('disabled', e.target.checked)}
														disabled={!isEditing}
														className="rounded"
													/>
													<span className="text-sm text-vscode-editor-foreground">禁用</span>
												</label>
												<label className="flex items-center gap-2">
													<input
														type="checkbox"
														checked={editingBinding.markdownOnly}
														onChange={(e) => updateEditingBinding('markdownOnly', e.target.checked)}
														disabled={!isEditing}
														className="rounded"
													/>
													<span className="text-sm text-vscode-editor-foreground">仅限Markdown</span>
												</label>
												<label className="flex items-center gap-2">
													<input
														type="checkbox"
														checked={editingBinding.promptOnly}
														onChange={(e) => updateEditingBinding('promptOnly', e.target.checked)}
														disabled={!isEditing}
														className="rounded"
													/>
													<span className="text-sm text-vscode-editor-foreground">仅限提示词</span>
												</label>
												<label className="flex items-center gap-2">
													<input
														type="checkbox"
														checked={editingBinding.runOnEdit}
														onChange={(e) => updateEditingBinding('runOnEdit', e.target.checked)}
														disabled={!isEditing}
														className="rounded"
													/>
													<span className="text-sm text-vscode-editor-foreground">编辑时运行</span>
												</label>
											</div>
										</div>
									</div>
								</div>
							</>
						) : (
							<div className="flex-1 flex items-center justify-center">
								<div className="text-center text-vscode-descriptionForeground">
									<div className="mb-4">
										<span className="codicon codicon-search text-4xl"></span>
									</div>
									<div>选择一个正则进行查看或编辑</div>
									<div>或创建一个新的正则</div>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
		</Modal>
	)
}