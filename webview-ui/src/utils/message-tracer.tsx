import { WebviewMessage } from "@roo/WebviewMessage"

/**
 * 消息追踪器 - 用于调试网页端到后端的消息流程
 */
export class MessageTracer {
	private static instance: MessageTracer
	private logs: Array<{
		timestamp: number
		direction: 'outgoing' | 'incoming'
		message: WebviewMessage
		source: string
	}> = []

	private constructor() {}

	public static getInstance(): MessageTracer {
		if (!MessageTracer.instance) {
			MessageTracer.instance = new MessageTracer()
		}
		return MessageTracer.instance
	}

	logOutgoing(message: WebviewMessage, source: string = 'unknown'): void {
		const log = {
			timestamp: Date.now(),
			direction: 'outgoing' as const,
			message,
			source
		}
		this.logs.push(log)
		console.log(`[MessageTracer] OUTGOING (${source}):`, message)
	}

	logIncoming(message: WebviewMessage, source: string = 'unknown'): void {
		const log = {
			timestamp: Date.now(),
			direction: 'incoming' as const,
			message,
			source
		}
		this.logs.push(log)
		console.log(`[MessageTracer] INCOMING (${source}):`, message)
	}

	getLogs(): Array<{
		timestamp: number
		direction: 'outgoing' | 'incoming'
		message: WebviewMessage
		source: string
	}> {
		return [...this.logs]
	}

	clearLogs(): void {
		this.logs = []
	}

	/**
	 * 查找特定消息类型的响应
	 */
	findResponse(messageType: string, timeout: number = 10000): Promise<WebviewMessage | null> {
		return new Promise((resolve) => {
			const startTime = Date.now()
			const checkInterval = setInterval(() => {
				const currentTime = Date.now()

				// 查找该消息类型的发送日志
				const outgoingLog = this.logs.find(log =>
					log.direction === 'outgoing' &&
					log.message.type === messageType &&
					log.timestamp >= startTime
				)

				if (outgoingLog) {
					// 查找该消息发送后的响应
					const responseLog = this.logs.find(log =>
						log.direction === 'incoming' &&
						log.timestamp > outgoingLog.timestamp &&
						this.isResponseTo(messageType, log.message.type)
					)

					if (responseLog) {
						clearInterval(checkInterval)
						resolve(responseLog.message)
						return
					}
				}

				// 超时检查
				if (currentTime - startTime > timeout) {
					clearInterval(checkInterval)
					resolve(null)
				}
			}, 100)
		})
	}

	/**
	 * 判断是否是对特定消息的响应
	 */
	private isResponseTo(requestType: string, responseType: string): boolean {
		const responseMap: { [key: string]: string } = {
			'loadTsProfiles': 'tsProfilesLoaded',
			'state': 'state',
			'loadApiConfiguration': 'state', // loadApiConfiguration发送state消息作为响应
			'getVSCodeSetting': 'vsCodeSetting',
			'validateTsProfile': 'tsProfileValidated',
			'browseTsProfile': 'tsProfileBrowserResult'
		}

		return responseMap[requestType] === responseType
	}

	/**
	 * 获取消息统计
	 */
	getStats(): {
		total: number
		outgoing: number
		incoming: number
		types: { [key: string]: number }
	} {
		const stats = {
			total: this.logs.length,
			outgoing: 0,
			incoming: 0,
			types: {} as { [key: string]: number }
		}

		this.logs.forEach(log => {
			stats[log.direction]++
			stats.types[log.message.type] = (stats.types[log.message.type] || 0) + 1
		})

		return stats
	}
}

// 导出单例实例
export const messageTracer = MessageTracer.getInstance()

/**
 * React Hook for message tracing
 */
export const useMessageTracer = () => {
	const tracer = MessageTracer.getInstance()

	const testMessageFlow = async (messageType: string, payload?: any): Promise<boolean> => {
		console.log(`[useMessageTracer] Testing message flow for: ${messageType}`)

		// 清除之前的日志
		tracer.clearLogs()

		// 导入vscode模块
		const { vscode } = await import('./vscode')

		// 发送测试消息
		const message: WebviewMessage = { type: messageType, ...payload }
		vscode.postMessage(message)

		// 等待响应
		const response = await tracer.findResponse(messageType, 10000)

		if (response) {
			console.log(`[useMessageTracer] ✅ Success: Received response for ${messageType}`, response)
			return true
		} else {
			console.log(`[useMessageTracer] ❌ Failed: No response for ${messageType}`)
			console.log(`[useMessageTracer] Logs:`, tracer.getLogs())
			return false
		}
	}

	return {
		tracer,
		testMessageFlow,
		getLogs: () => tracer.getLogs(),
		getStats: () => tracer.getStats(),
		clearLogs: () => tracer.clearLogs()
	}
}

export default messageTracer