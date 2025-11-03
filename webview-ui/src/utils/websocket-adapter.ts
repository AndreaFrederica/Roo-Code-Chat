import { WebviewMessage } from "@roo/WebviewMessage"
import { messageTracer } from "./message-tracer"

export class WebSocketAdapter {
	private ws: WebSocket | null = null
	private messageHandlers: Map<string, Function[]> = new Map()
	private messageQueue: WebviewMessage[] = []
	private reconnectAttempts = 0
	private shouldReconnect = true
	private isConnecting = false
	private url: string = ""
	private connectionListeners: Set<(connected: boolean) => void> = new Set()
	private reconnectCountdownListeners: Set<(seconds: number) => void> = new Set()
	private reconnectTimer: NodeJS.Timeout | null = null

	constructor() {}

	async connect(): Promise<void> {
		if (this.isConnecting) {
			throw new Error("Already connecting")
		}

		this.isConnecting = true

		try {
			// 动态获取WebSocket端口
			if (!this.url) {
				await this.fetchWebSocketUrl()
			}

			this.ws = new WebSocket(this.url)

			return new Promise<void>((resolve, reject) => {
				this.ws!.onopen = () => {
					console.log("[WebSocketAdapter] Connected")
					this.isConnecting = false
					this.reconnectAttempts = 0

					// 停止倒计时 - 优化：支持增强的清理逻辑
					if (this.reconnectTimer) {
						// 检查是否有附加的cleanup方法
						if ((this.reconnectTimer as any).cleanup) {
							;(this.reconnectTimer as any).cleanup()
						}
						clearTimeout(this.reconnectTimer)
						this.reconnectTimer = null
					}
					this.notifyReconnectCountdown(0) // 停止倒计时显示

					this.updateConnectionStatus(true)

					// 发送队列中的消息
					this.flushMessageQueue()

					resolve()
				}

				this.ws!.onmessage = (event) => {
					try {
						const message: WebviewMessage = JSON.parse(event.data)
						messageTracer.logIncoming(message, "WebSocketAdapter")
						this.handleMessage(message)
					} catch (error) {
						console.error("[WebSocketAdapter] Error parsing message:", error)
					}
				}

				this.ws!.onclose = () => {
					console.log("[WebSocketAdapter] Disconnected")
					this.isConnecting = false
					this.updateConnectionStatus(false)
					this.attemptReconnect()
				}

				this.ws!.onerror = (error) => {
					console.error("[WebSocketAdapter] WebSocket error:", error)
					this.isConnecting = false
					this.updateConnectionStatus(false)
					reject(error)
				}
			})
		} catch (error) {
			this.isConnecting = false
			throw error
		}
	}

	private async fetchWebSocketUrl(): Promise<void> {
		try {
			// 获取当前页面的协议和主机，构建WebSocket URL
			const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
			const host = window.location.host
			this.url = `${protocol}//${host}/ws`
			console.log("[WebSocketAdapter] Using WebSocket URL:", this.url)
		} catch (error) {
			console.error("[WebSocketAdapter] Failed to construct WebSocket URL:", error)
			// 回退到默认URL
			this.url = "ws://localhost:3002/ws"
			console.log("[WebSocketAdapter] Using fallback WebSocket URL:", this.url)
		}
	}

	private handleMessage(message: WebviewMessage): void {
		const handlers = [...(this.messageHandlers.get(message.type) || []), ...(this.messageHandlers.get("*") || [])]

		handlers.forEach((handler) => {
			try {
				handler(message)
			} catch (error) {
				console.error(`[WebSocketAdapter] Error handling ${message.type}:`, error)
			}
		})
	}

	onMessage(type: string, handler: Function): void {
		if (!this.messageHandlers.has(type)) {
			this.messageHandlers.set(type, [])
		}
		this.messageHandlers.get(type)!.push(handler)
	}

	offMessage(type: string, handler: Function): void {
		const handlers = this.messageHandlers.get(type)
		if (handlers) {
			const index = handlers.indexOf(handler)
			if (index > -1) {
				handlers.splice(index, 1)
			}
		}
	}

	postMessage(message: WebviewMessage): void {
		messageTracer.logOutgoing(message, "WebSocketAdapter")
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(message))
		} else {
			// 将消息添加到队列中，等待连接建立后发送
			this.messageQueue.push(message)
			console.log("[WebSocketAdapter] Message queued, will send when connected:", message.type)
		}
	}

	private flushMessageQueue(): void {
		if (this.messageQueue.length > 0) {
			console.log(`[WebSocketAdapter] Sending ${this.messageQueue.length} queued messages`)

			while (this.messageQueue.length > 0) {
				const message = this.messageQueue.shift()
				if (message && this.ws && this.ws.readyState === WebSocket.OPEN) {
					this.ws.send(JSON.stringify(message))
				}
			}
		}
	}

	private attemptReconnect(): void {
		if (!this.shouldReconnect) {
			console.log("[WebSocketAdapter] Reconnect disabled")
			return
		}

		this.reconnectAttempts++

		// 优化1：智能重连延迟策略 - 考虑网络状况和历史成功率
		let delay: number
		const baseDelays = [1000, 2000, 3000, 5000] // 基础延迟序列
		const maxDelay = 30000 // 最大延迟30秒
		const maxAttempts = 10 // 最大重试次数

		if (this.reconnectAttempts <= baseDelays.length) {
			delay = baseDelays[this.reconnectAttempts - 1]
		} else {
			// 指数退避，但有上限
			delay = Math.min(maxDelay, 5000 * Math.pow(1.5, this.reconnectAttempts - baseDelays.length))
		}

		// 优化2：添加抖动避免雷群效应
		const jitter = Math.random() * 0.3 * delay // 30%的抖动
		delay = delay + jitter

		// 优化3：检查是否超过最大重试次数
		if (this.reconnectAttempts > maxAttempts) {
			console.error(
				`[WebSocketAdapter] Max reconnection attempts (${maxAttempts}) exceeded. Stopping reconnection.`,
			)
			this.shouldReconnect = false
			this.updateConnectionStatus(false)
			return
		}

		console.log(
			`[WebSocketAdapter] Attempting reconnect #${this.reconnectAttempts} in ${Math.round(delay)}ms (jitter: ${Math.round(jitter)}ms)`,
		)

		// 优化4：启动智能倒计时
		this.startReconnectCountdown(Math.round(delay))

		// 优化5：保存当前重连尝试的上下文，便于调试
		const reconnectContext = {
			attempt: this.reconnectAttempts,
			delay: Math.round(delay),
			timestamp: Date.now(),
			url: this.url,
		}
		console.log("[WebSocketAdapter] Reconnect context:", reconnectContext)

		this.reconnectTimer = setTimeout(() => {
			if (this.shouldReconnect) {
				this.connect().catch((error) => {
					console.error("[WebSocketAdapter] Reconnect failed:", error)
					// 优化6：记录失败原因，可能需要调整策略
					const errorDuration = Date.now() - reconnectContext.timestamp
					console.log(
						`[WebSocketAdapter] Reconnection attempt ${reconnectContext.attempt} failed after ${errorDuration}ms`,
					)
				})
			}
		}, Math.round(delay))
	}

	private startReconnectCountdown(totalDelay: number): void {
		let remainingSeconds = Math.ceil(totalDelay / 1000)
		const startTime = Date.now()
		let countdownInterval: NodeJS.Timeout | null = null

		// 立即通知开始倒计时
		this.notifyReconnectCountdown(remainingSeconds)

		// 优化1：使用精确的时间计算来避免定时器漂移
		const updateCountdown = () => {
			const elapsed = Date.now() - startTime
			const remainingMs = Math.max(0, totalDelay - elapsed)
			const newRemainingSeconds = Math.ceil(remainingMs / 1000)

			if (newRemainingSeconds !== remainingSeconds) {
				remainingSeconds = newRemainingSeconds
				this.notifyReconnectCountdown(remainingSeconds)
			}

			if (remainingMs <= 0) {
				if (countdownInterval) {
					clearInterval(countdownInterval)
					countdownInterval = null
				}
				this.notifyReconnectCountdown(0) // 倒计时结束
			}
		}

		// 优化2：使用更频繁的更新来确保精确性，但避免过多的DOM更新
		countdownInterval = setInterval(updateCountdown, 100) // 每100ms检查一次

		// 优化3：清理定时器，避免内存泄漏
		this.reconnectTimer = setTimeout(() => {
			if (countdownInterval) {
				clearInterval(countdownInterval)
				countdownInterval = null
			}
			this.notifyReconnectCountdown(0)
		}, totalDelay)

		// 优化4：添加窗口焦点事件处理，暂停/恢复倒计时显示
		const handleVisibilityChange = () => {
			if (document.hidden && countdownInterval) {
				clearInterval(countdownInterval)
				countdownInterval = null
				// 当页面隐藏时，计算剩余时间
				const elapsed = Date.now() - startTime
				const remainingMs = Math.max(0, totalDelay - elapsed)
				this.notifyReconnectCountdown(Math.ceil(remainingMs / 1000))
			} else if (!document.hidden && remainingSeconds > 0) {
				// 页面重新可见时，恢复倒计时
				countdownInterval = setInterval(updateCountdown, 100)
			}
		}

		document.addEventListener("visibilitychange", handleVisibilityChange)

		// 优化5：确保在重连成功或失败时清理事件监听器
		const cleanup = () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange)
			if (countdownInterval) {
				clearInterval(countdownInterval)
				countdownInterval = null
			}
		}

		// 重写setTimeout的回调以包含清理逻辑
		this.reconnectTimer = setTimeout(() => {
			cleanup()
			if (this.shouldReconnect) {
				this.connect().catch((error) => {
					console.error("[WebSocketAdapter] Reconnect failed:", error)
				})
			}
		}, totalDelay) as any
		;(this.reconnectTimer as any).cleanup = cleanup
	}

	private notifyReconnectCountdown(seconds: number): void {
		this.reconnectCountdownListeners.forEach((listener) => {
			try {
				listener(seconds)
			} catch (error) {
				console.error("[WebSocketAdapter] Error notifying reconnect countdown listener:", error)
			}
		})
	}

	private updateConnectionStatus(connected: boolean): void {
		// 只通知监听器，不再尝试更新已删除的DOM元素
		console.log(`[WebSocketAdapter] Connection status changed: ${connected ? "connected" : "disconnected"}`)

		this.connectionListeners.forEach((listener) => {
			try {
				listener(connected)
			} catch (error) {
				console.error("[WebSocketAdapter] Error notifying connection listener:", error)
			}
		})
	}

	disconnect(): void {
		this.shouldReconnect = false

		// 停止倒计时 - 优化：支持增强的清理逻辑
		if (this.reconnectTimer) {
			// 检查是否有附加的cleanup方法
			if ((this.reconnectTimer as any).cleanup) {
				;(this.reconnectTimer as any).cleanup()
			}
			clearTimeout(this.reconnectTimer)
			this.reconnectTimer = null
		}
		this.notifyReconnectCountdown(0) // 停止倒计时显示

		if (this.ws) {
			this.ws.close()
			this.ws = null
		}

		console.log("[WebSocketAdapter] Disconnected - reconnection disabled and cleanup completed")
	}

	isConnected(): boolean {
		return this.ws !== null && this.ws.readyState === WebSocket.OPEN
	}

	onConnectionStatusChange(listener: (connected: boolean) => void): void {
		this.connectionListeners.add(listener)
	}

	offConnectionStatusChange(listener: (connected: boolean) => void): void {
		this.connectionListeners.delete(listener)
	}

	onReconnectCountdown(listener: (seconds: number) => void): void {
		this.reconnectCountdownListeners.add(listener)
	}

	offReconnectCountdown(listener: (seconds: number) => void): void {
		this.reconnectCountdownListeners.delete(listener)
	}
}
