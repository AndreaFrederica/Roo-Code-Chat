import React, { useState, useEffect } from 'react'
import { RefreshCw, AlertCircle, CheckCircle, XCircle, Trash2 } from 'lucide-react'
import { useMessageTracer } from '@src/utils/message-tracer'
import { vscode } from '@src/utils/vscode'
import { cn } from '@src/lib/utils'

export const MessageTracerPanel: React.FC = () => {
	const { tracer, testMessageFlow, getLogs, getStats, clearLogs } = useMessageTracer()
	const [isTestRunning, setIsTestRunning] = useState(false)
	const [testResults, setTestResults] = useState<{[key: string]: boolean}>({})

	const stats = getStats()

	const runTest = async (messageType: string, payload?: any) => {
		setIsTestRunning(true)
		setTestResults(prev => ({ ...prev, [messageType]: false }))

		try {
			const success = await testMessageFlow(messageType, payload)
			setTestResults(prev => ({ ...prev, [messageType]: success }))
		} catch (error) {
			console.error(`[MessageTracerPanel] Test failed for ${messageType}:`, error)
			setTestResults(prev => ({ ...prev, [messageType]: false }))
		} finally {
			setIsTestRunning(false)
		}
	}

	const runAllTests = async () => {
		const tests = [
			{ type: 'loadTsProfiles', payload: {} },
			{ type: 'state', payload: {} },
			{ type: 'loadApiConfiguration', payload: { text: 'default' } },
			{ type: 'getVSCodeSetting', payload: { setting: 'workbench.colorTheme' } }
		]

		for (const test of tests) {
			await runTest(test.type, test.payload)
			await new Promise(resolve => setTimeout(resolve, 2000)) // 2秒间隔
		}
	}

	const getStatusIcon = (result: boolean) => {
		if (result === true) {
			return (
				<CheckCircle
					className="w-4 h-4"
					style={{
						color: "var(--vscode-charts-green, var(--vscode-button-background, var(--foreground)))",
					}}
				/>
			)
		}
		return <XCircle className="w-4 h-4" style={{ color: "var(--vscode-errorForeground, var(--foreground))" }} />
	}

	return (
		<div className="p-4 border border-vscode-panel-border rounded-md bg-vscode-editor-background">
			<div className="flex items-center justify-between mb-4">
				<h3 className="text-lg font-semibold">消息流程调试</h3>
				<div className="flex items-center gap-2">
					<button
						onClick={runAllTests}
						disabled={isTestRunning}
						className="px-3 py-1 bg-vscode-button-background hover:bg-vscode-button-hoverBackground text-vscode-button-foreground rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
					>
						<RefreshCw className={cn("w-4 h-4", isTestRunning && "animate-spin")} />
						运行所有测试
					</button>
					<button
						onClick={clearLogs}
						className="p-1 hover:bg-vscode-toolbar-hoverBackground rounded"
						title="清除日志"
					>
						<Trash2 className="w-4 h-4" />
					</button>
				</div>
			</div>

			{/* 统计信息 */}
			<div className="mb-4 p-3 bg-vscode-textBlockQuote-background rounded">
				<div className="grid grid-cols-3 gap-4 text-sm">
					<div>
						<span className="font-medium">总消息:</span> {stats.total}
					</div>
					<div>
						<span className="font-medium">发送:</span> {stats.outgoing}
					</div>
					<div>
						<span className="font-medium">接收:</span> {stats.incoming}
					</div>
				</div>
			</div>

			{/* 测试结果 */}
			<div className="mb-4">
				<h4 className="font-medium mb-2">测试结果:</h4>
				<div className="space-y-2">
					{[
						{ type: 'loadTsProfiles', label: '加载TS Profile' },
						{ type: 'state', label: '获取状态' },
						{ type: 'loadApiConfiguration', label: '加载API配置' },
						{ type: 'getVSCodeSetting', label: '获取VSCode设置' }
					].map(test => (
						<div key={test.type} className="flex items-center justify-between p-2 border border-vscode-panel-border rounded">
							<span className="text-sm">{test.label}</span>
							<div className="flex items-center gap-2">
								{getStatusIcon(testResults[test.type])}
								<button
									onClick={() => runTest(test.type)}
									disabled={isTestRunning}
									className="px-2 py-1 bg-vscode-button-secondary-background hover:bg-vscode-button-secondary-hoverBackground text-vscode-button-secondary-foreground rounded text-xs disabled:opacity-50"
								>
									测试
								</button>
							</div>
						</div>
					))}
				</div>
			</div>

			{/* 消息日志 */}
			<div>
				<div className="flex items-center justify-between mb-2">
					<h4 className="font-medium">消息日志:</h4>
					<span className="text-xs text-vscode-descriptionForeground">
						{getLogs().length} 条记录
					</span>
				</div>
				<div className="max-h-60 overflow-y-auto border border-vscode-panel-border rounded p-2 bg-vscode-textBlockQuote-background">
					{getLogs().length === 0 ? (
						<div className="text-center text-vscode-descriptionForeground py-4">
							暂无消息日志
						</div>
					) : (
						<div className="space-y-1 text-xs">
							{getLogs().map((log, index) => (
								<div key={index} className="flex items-start gap-2 p-1 border-b border-vscode-panel-border">
									<span
										className="mt-0.5 w-2 h-2 rounded-full flex-shrink-0"
										style={{
											background:
												log.direction === "outgoing"
													? "var(--vscode-charts-blue, var(--vscode-textLink-foreground, var(--foreground)))"
													: "var(--vscode-charts-green, var(--vscode-button-background, var(--foreground)))",
										}}
									/>
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2">
											<span
												className="font-medium"
												style={{
													color:
														log.direction === "outgoing"
															? "var(--vscode-charts-blue, var(--vscode-textLink-foreground, var(--foreground)))"
															: "var(--vscode-charts-green, var(--vscode-button-background, var(--foreground)))",
												}}>
												{log.direction === "outgoing" ? "→" : "←"}
											</span>
											<span className="font-mono">{log.message.type}</span>
											<span className="text-vscode-descriptionForeground">({log.source})</span>
										</div>
										{(log.message as any).type === 'tsProfilesLoaded' && (
											<div className="text-vscode-descriptionForeground mt-1">
												收到 {(log.message as any).tsProfiles?.length || 0} 个TS Profile
											</div>
										)}
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	)
}

export default MessageTracerPanel
