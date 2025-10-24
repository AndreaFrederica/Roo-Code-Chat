import React, { useState, useEffect } from 'react'
import { vscode } from './vscode'
import { WebSocketAdapter } from './websocket-adapter'

/**
 * WebSocket连接测试工具
 */
export const useWebSocketTest = () => {
	const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')
	const [testResults, setTestResults] = useState<{[key: string]: 'pending' | 'success' | 'error'}>({})
	const [wsAdapter, setWsAdapter] = useState<WebSocketAdapter | null>(null)

	useEffect(() => {
		// 初始化WebSocket适配器
		const adapter = new WebSocketAdapter()
		setWsAdapter(adapter)

		// 监听连接状态
		const handleConnectionChange = (connected: boolean) => {
			setConnectionStatus(connected ? 'connected' : 'disconnected')
			console.log('[WebSocketTest] Connection status changed:', connected ? 'connected' : 'disconnected')
		}

		adapter.onConnectionStatusChange(handleConnectionChange)

		// 自动连接
		adapter.connect().catch(error => {
			console.error('[WebSocketTest] Failed to connect:', error)
			setConnectionStatus('disconnected')
		})

		return () => {
			adapter.disconnect()
		}
	}, [])

	// 测试特定消息类型
	const testMessage = async (messageType: string, payload?: any) => {
		if (!wsAdapter || connectionStatus !== 'connected') {
			console.warn('[WebSocketTest] Not connected, cannot test message:', messageType)
			return
		}

		setTestResults(prev => ({ ...prev, [messageType]: 'pending' }))

		// 设置消息监听器
		const timeout = setTimeout(() => {
			setTestResults(prev => ({ ...prev, [messageType]: 'error' }))
			console.warn(`[WebSocketTest] Timeout waiting for response to ${messageType}`)
		}, 10000) // 10秒超时

		// 监听响应
		const responseType = getResponseType(messageType)
		wsAdapter.onMessage(responseType, (message: any) => {
			clearTimeout(timeout)
			setTestResults(prev => ({ ...prev, [messageType]: 'success' }))
			console.log(`[WebSocketTest] Received response for ${messageType}:`, message)
		})

		// 发送测试消息
		try {
			console.log(`[WebSocketTest] Sending message: ${messageType}`, payload)
			vscode.postMessage({ type: messageType, ...payload })
		} catch (error) {
			clearTimeout(timeout)
			setTestResults(prev => ({ ...prev, [messageType]: 'error' }))
			console.error(`[WebSocketTest] Error sending ${messageType}:`, error)
		}
	}

	// 批量测试设置相关的消息
	const testSettingsMessages = async () => {
		const settingsTests = [
			{ type: 'loadTsProfiles', payload: {} },
			{ type: 'state', payload: {} },
			{ type: 'loadApiConfiguration', payload: {} },
			{ type: 'getVSCodeSetting', payload: { key: 'workbench.colorTheme' } }
		]

		for (const test of settingsTests) {
			await new Promise(resolve => setTimeout(resolve, 1000)) // 间隔1秒
			testMessage(test.type, test.payload)
		}
	}

	return {
		connectionStatus,
		testResults,
		testMessage,
		testSettingsMessages,
		isConnected: connectionStatus === 'connected'
	}
}

// 获取消息类型对应的响应类型
const getResponseType = (messageType: string): string => {
	const responseMap: { [key: string]: string } = {
		'loadTsProfiles': 'tsProfilesLoaded',
		'state': 'state',
		'loadApiConfiguration': 'apiConfigurationLoaded',
		'getVSCodeSetting': 'vsCodeSetting'
	}
	return responseMap[messageType] || messageType
}

/**
 * WebSocket测试组件
 */
export const WebSocketTestPanel: React.FC = () => {
	const { connectionStatus, testResults, testSettingsMessages, isConnected } = useWebSocketTest()

	return (
		<div className="p-4 border border-vscode-panel-border rounded-md bg-vscode-editor-background">
			<h3 className="text-lg font-semibold mb-4">WebSocket连接测试</h3>

			<div className="mb-4">
				<span className="font-medium">连接状态: </span>
				<span className={`ml-2 px-2 py-1 rounded text-sm ${
					connectionStatus === 'connected' ? 'bg-green-600 text-white' :
					connectionStatus === 'connecting' ? 'bg-yellow-600 text-white' :
					'bg-red-600 text-white'
				}`}>
					{connectionStatus === 'connected' ? '已连接' :
					 connectionStatus === 'connecting' ? '连接中...' : '未连接'}
				</span>
			</div>

			<div className="mb-4">
				<button
					onClick={testSettingsMessages}
					disabled={!isConnected}
					className="px-4 py-2 bg-vscode-button-background hover:bg-vscode-button-hoverBackground text-vscode-button-foreground rounded disabled:opacity-50 disabled:cursor-not-allowed"
				>
					测试设置页面功能
				</button>
			</div>

			<div className="space-y-2">
				<h4 className="font-medium">测试结果:</h4>
				{Object.entries(testResults).map(([messageType, result]) => (
					<div key={messageType} className="flex items-center justify-between p-2 border border-vscode-panel-border rounded">
						<span className="text-sm">{messageType}</span>
						<span className={`px-2 py-1 rounded text-xs ${
							result === 'success' ? 'bg-green-600 text-white' :
							result === 'pending' ? 'bg-yellow-600 text-white' :
							'bg-red-600 text-white'
						}`}>
							{result === 'success' ? '成功' :
							 result === 'pending' ? '等待中...' : '失败'}
						</span>
					</div>
				))}
			</div>
		</div>
	)
}

export default useWebSocketTest