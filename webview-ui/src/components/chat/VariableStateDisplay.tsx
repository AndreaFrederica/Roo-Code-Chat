import { useState, useRef, useMemo } from "react"
import { parseVariableCommands, ParsedCommand } from "../common/VariableCommandParser"
import { Database, Plus, Edit, Minus, ChevronUp, ChevronDown } from "lucide-react"

interface VariableStateDisplayProps {
	variables?: string[] // 从UpdateVariable块解析的变量命令字符串（已废弃，使用variableState）
	variableState?: Record<string, any> // 解析后的变量状态
	maxRows?: number // 最大显示行数
	maxColumns?: number // 最大显示列数
	className?: string
}

export function VariableStateDisplay({
	variables = [],
	variableState,
	maxRows = 2,
	maxColumns = 3,
	className
}: VariableStateDisplayProps) {
	const [isCollapsed, setIsCollapsed] = useState(true)
	const containerRef = useRef<HTMLDivElement>(null)

	// 解析所有变量命令 - 优先使用variableState，如果没有则使用variables
	const parsedCommands = useMemo(() => {
		// 如果直接提供了variableState，则使用它
		if (variableState && typeof variableState === 'object') {
			return Object.values(variableState) as ParsedCommand[]
		}

		// 否则从variables字符串解析（兼容旧版本）
		const allCommands: ParsedCommand[] = []
		variables.forEach(variableStr => {
			const commands = parseVariableCommands(variableStr)
			allCommands.push(...commands)
		})
		return allCommands
	}, [variables, variableState])

	// 按变量名分组，保留最新的值
	const variableStates = useMemo(() => {
		const states: Record<string, ParsedCommand> = {}

		parsedCommands.forEach(command => {
			const existing = states[command.variable]
			// 保留最新的命令，或者如果没有则设置
			if (!existing || command.position && existing.position &&
				command.position.start > existing.position.start) {
				states[command.variable] = command
			}
		})

		return states
	}, [parsedCommands])

	const variableNames = Object.keys(variableStates)
	const hasVariables = variableNames.length > 0

	// 如果没有变量，不显示
	if (!hasVariables) {
		return null
	}

	// 限制显示的变量数量（用于网格显示）
	const maxDisplayCount = maxRows * maxColumns
	const limitedVariableNames = variableNames.slice(0, maxDisplayCount)

	// 获取最重要的变量（按类型排序：set > add > insert > remove）
	const getMostImportantVariable = () => {
		const priorities = { set: 4, add: 3, insert: 2, remove: 1 }
		const sortedVars = limitedVariableNames
			.map(name => ({ name, command: variableStates[name] }))
			.sort((a, b) => (priorities[b.command.type as keyof typeof priorities] || 0) -
							   (priorities[a.command.type as keyof typeof priorities] || 0))
		return sortedVars[0]
	}

	const mostImportantVar = getMostImportantVariable()

	// 生成网格布局的变量数组
	const gridVariables = useMemo(() => {
		const grid: Array<{ name: string, command: ParsedCommand } | null> = []
		for (let i = 0; i < maxRows * maxColumns; i++) {
			if (i < limitedVariableNames.length) {
				grid.push({
					name: limitedVariableNames[i],
					command: variableStates[limitedVariableNames[i]]
				})
			} else {
				grid.push(null) // 空位
			}
		}
		return grid
	}, [limitedVariableNames, variableStates, maxRows, maxColumns])

	// 获取变量命令的图标
	const getVariableIcon = (type: ParsedCommand['type']) => {
		const iconClass = "w-3 h-3"
		switch (type) {
			case 'set':
				return <Edit className={iconClass} />
			case 'add':
				return <Plus className={iconClass} />
			case 'insert':
				return <Database className={iconClass} />
			case 'remove':
				return <Minus className={iconClass} />
			default:
				return <Database className={iconClass} />
		}
	}

	// 获取变量命令的颜色
	const getVariableColor = (type: ParsedCommand['type']) => {
		switch (type) {
			case 'set':
				return "var(--vscode-terminal-ansiBlue)"
			case 'add':
				return "var(--vscode-terminal-ansiGreen)"
			case 'insert':
				return "var(--vscode-terminal-ansiYellow)"
			case 'remove':
				return "var(--vscode-terminal-ansiRed)"
			default:
				return "var(--vscode-foreground)"
		}
	}

	// 格式化变量值显示
	const formatValue = (value: string | number | undefined) => {
		if (value === undefined) return ""
		if (typeof value === 'string') {
			// 截断长字符串
			return value.length > 30 ? `"${value.substring(0, 27)}..."` : `"${value}"`
		}
		return String(value)
	}

	// 获取变量命令的描述
	const getCommandDescription = (command: ParsedCommand) => {
		switch (command.type) {
			case 'set':
				return `Set ${command.variable}`
			case 'add':
				return `Add ${command.value} to ${command.variable}`
			case 'insert':
				return `Insert into ${command.variable}`
			case 'remove':
				return `Remove from ${command.variable}`
			default:
				return command.method
		}
	}

	return (
		<div
			className={`border border-t-0 rounded-b-xs relative ${className}`}
			style={{
				margin: "0",
				padding: "6px 10px",
				background: "var(--vscode-editor-background,transparent)",
				borderColor: "var(--vscode-panel-border)",
			}}
		>
			{/* 折叠状态显示 */}
			<div
				style={{
					cursor: "pointer",
					userSelect: "none",
				}}
				onClick={() => setIsCollapsed((v) => !v)}
			>
				{/* 网格显示 - 当变量数量大于1时显示网格 */}
				{variableNames.length > 1 ? (
					<div
						style={{
							display: "grid",
							gridTemplateColumns: `repeat(${maxColumns}, 1fr)`,
							gap: "4px 8px",
							marginBottom: "4px",
						}}
					>
						{gridVariables.map((variable, index) => {
							if (!variable) {
								// 空位，占位但不显示任何内容
								return <div key={`empty-${index}`} style={{}} />
							}

							return (
								<div
									key={variable.name}
									style={{
										display: "flex",
										alignItems: "center",
										gap: "2px",
										padding: "2px 4px",
										background: "var(--vscode-textBlock-background)",
										border: "1px solid var(--vscode-panel-border)",
										borderRadius: "2px",
										fontSize: "10px",
										whiteSpace: "nowrap",
										overflow: "hidden",
									}}
								>
									<div style={{ color: getVariableColor(variable.command.type), flexShrink: 0 }}>
										{getVariableIcon(variable.command.type)}
									</div>
									<span
										style={{
											color: getVariableColor(variable.command.type),
											fontWeight: 500,
											overflow: "hidden",
											textOverflow: "ellipsis",
											flex: 1,
											minWidth: 0,
										}}
										title={`${variable.name}: ${formatValue(variable.command.value)}`}
									>
										{variable.name}: {formatValue(variable.command.value)}
									</span>
								</div>
							)
						})}
					</div>
				) : (
					// 单个变量显示 - 传统显示方式
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: 2,
							marginBottom: 0,
						}}
					>
						<div style={{ color: "var(--vscode-terminal-ansiBlue)", flexShrink: 0 }}>
							{getVariableIcon(mostImportantVar.command.type)}
						</div>
						<span
							style={{
								fontWeight: 500,
								color: getVariableColor(mostImportantVar.command.type),
								flex: 1,
								overflow: "hidden",
								textOverflow: "ellipsis",
								whiteSpace: "nowrap",
								fontSize: "12px",
							}}
						>
							{mostImportantVar.name}: {formatValue(mostImportantVar.command.value)}
						</span>
					</div>
				)}

				{/* 底部信息栏 */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						marginTop: variableNames.length > 1 ? "2px" : "0",
					}}
				>
					{variableNames.length === 1 && (
						<span
							style={{
								color: "var(--vscode-descriptionForeground)",
								fontSize: "10px",
								fontWeight: 500,
							}}
						>
							{formatValue(mostImportantVar.command.value)}
						</span>
					)}

					<div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
						<span
							className="codicon codicon-database"
							style={{
								color: "var(--vscode-terminal-ansiBlue)",
								fontSize: 12,
							}}
						/>
						<span
							style={{
								color: "var(--vscode-descriptionForeground)",
								fontSize: 12,
								fontWeight: 500,
							}}
						>
							{variableNames.length}
							{variableNames.length > maxDisplayCount && `+${variableNames.length - maxDisplayCount}`}
						</span>
					</div>
				</div>
			</div>

			{/* 展开状态显示 */}
			{!isCollapsed && (
				<>
					{/* 背景遮罩 */}
					<div
						style={{
							position: "fixed",
							top: 0,
							left: 0,
							right: 0,
							bottom: 0,
							background: "rgba(0, 0, 0, 0.1)",
							zIndex: 1000,
						}}
						onClick={() => setIsCollapsed(true)}
					/>
					{/* 浮动面板 */}
					<div
						ref={containerRef}
						style={{
							position: "absolute",
							top: "100%",
							left: 0,
							right: 0,
							marginTop: 4,
							background: "var(--vscode-editor-background)",
							border: "1px solid var(--vscode-panel-border)",
							borderRadius: 6,
							boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
							zIndex: 1001,
							maxHeight: "400px",
							minHeight: "200px",
							overflow: "hidden",
						}}
					>
						{/* 面板头部 */}
						<div
							style={{
								display: "flex",
								alignItems: "center",
								justifyContent: "space-between",
								padding: "12px 16px",
								borderBottom: "1px solid var(--vscode-panel-border)",
								background: "var(--vscode-editor-background)",
							}}
						>
							<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
								<div style={{ color: "var(--vscode-terminal-ansiBlue)" }}>
									<Database className="w-4 h-4" />
								</div>
								<span style={{ fontWeight: "bold", fontSize: 14 }}>Variables</span>
								<span
									style={{
										color: "var(--vscode-descriptionForeground)",
										fontSize: 13,
										fontWeight: 500,
									}}
								>
									{variableNames.length} variables
								</span>
							</div>
							<span
								className="codicon codicon-chevron-up"
								style={{
									fontSize: 14,
									opacity: 0.7,
									cursor: "pointer",
									padding: "4px",
									borderRadius: "2px",
								}}
								onClick={(e) => {
									e.stopPropagation()
									setIsCollapsed(true)
								}}
								onMouseEnter={(e) => {
									e.currentTarget.style.opacity = "1"
									e.currentTarget.style.background = "var(--vscode-toolbar-hoverBackground)"
								}}
								onMouseLeave={(e) => {
									e.currentTarget.style.opacity = "0.7"
									e.currentTarget.style.background = "transparent"
								}}
							/>
						</div>

						{/* 变量列表 */}
						<div
							style={{
								maxHeight: "340px",
								overflowY: "auto",
								padding: "12px 16px",
							}}
						>
							{variableNames.map((variableName) => {
								const command = variableStates[variableName]
								return (
									<div
										key={variableName}
										style={{
											display: "flex",
											alignItems: "flex-start",
											gap: 8,
											marginBottom: 12,
											paddingBottom: 12,
											borderBottom: "1px solid var(--vscode-panel-border)",
										}}
									>
										<div style={{ color: getVariableColor(command.type), flexShrink: 0, marginTop: 2 }}>
											{getVariableIcon(command.type)}
										</div>
										<div style={{ flex: 1, minWidth: 0 }}>
											<div
												style={{
													fontWeight: 600,
													color: "var(--vscode-foreground)",
													fontSize: "13px",
													marginBottom: 2,
													wordBreak: "break-word",
												}}
											>
												{variableName}
											</div>
											<div
												style={{
													color: "var(--vscode-descriptionForeground)",
													fontSize: "11px",
													marginBottom: 4,
												}}
											>
												{getCommandDescription(command)}
											</div>
											{command.value !== undefined && (
												<div
													style={{
														display: "flex",
														alignItems: "center",
														gap: 4,
													}}
												>
													<span
														style={{
															color: "var(--vscode-terminal-ansiGreen)",
															fontSize: "11px",
															fontFamily: "monospace",
														}}
													>
														{formatValue(command.value)}
													</span>
												</div>
											)}
										</div>
									</div>
								)
							})}
						</div>
					</div>
				</>
			)}
		</div>
	)
}
