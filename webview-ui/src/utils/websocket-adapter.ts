import { WebviewMessage } from "@roo/WebviewMessage"
import { messageTracer } from "./message-tracer"

export class WebSocketAdapter {
    private ws: WebSocket | null = null
    private messageHandlers: Map<string, Function[]> = new Map()
    private messageQueue: WebviewMessage[] = []
    private reconnectAttempts = 0
    private maxReconnectAttempts = 5
    private reconnectDelay = 1000
    private isConnecting = false
    private url: string = ''
    private connectionListeners: Set<(connected: boolean) => void> = new Set()

    constructor() {}

    async connect(): Promise<void> {
        if (this.isConnecting) {
            throw new Error('Already connecting')
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
                    console.log('[WebSocketAdapter] Connected')
                    this.isConnecting = false
                    this.reconnectAttempts = 0
                    this.updateConnectionStatus(true)

                    // 发送队列中的消息
                    this.flushMessageQueue()

                    resolve()
                }

                this.ws!.onmessage = (event) => {
                    try {
                        const message: WebviewMessage = JSON.parse(event.data)
                        messageTracer.logIncoming(message, 'WebSocketAdapter')
                        this.handleMessage(message)
                    } catch (error) {
                        console.error('[WebSocketAdapter] Error parsing message:', error)
                    }
                }

                this.ws!.onclose = () => {
                    console.log('[WebSocketAdapter] Disconnected')
                    this.isConnecting = false
                    this.updateConnectionStatus(false)
                    this.attemptReconnect()
                }

                this.ws!.onerror = (error) => {
                    console.error('[WebSocketAdapter] WebSocket error:', error)
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
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
            const host = window.location.host
            this.url = `${protocol}//${host}/ws`
            console.log('[WebSocketAdapter] Using WebSocket URL:', this.url)
        } catch (error) {
            console.error('[WebSocketAdapter] Failed to construct WebSocket URL:', error)
            // 回退到默认URL
            this.url = 'ws://localhost:3002/ws'
            console.log('[WebSocketAdapter] Using fallback WebSocket URL:', this.url)
        }
    }

    private handleMessage(message: WebviewMessage): void {
        const handlers = [
            ...(this.messageHandlers.get(message.type) || []),
            ...(this.messageHandlers.get('*') || []),
        ]

        handlers.forEach(handler => {
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
        messageTracer.logOutgoing(message, 'WebSocketAdapter')
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message))
        } else {
            // 将消息添加到队列中，等待连接建立后发送
            this.messageQueue.push(message)
            console.log('[WebSocketAdapter] Message queued, will send when connected:', message.type)
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
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++
            const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)

            console.log(`[WebSocketAdapter] Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`)

            setTimeout(() => {
                this.connect().catch(error => {
                    console.error('[WebSocketAdapter] Reconnect failed:', error)
                })
            }, delay)
        } else {
            console.error('[WebSocketAdapter] Max reconnect attempts reached')
        }
    }

    private updateConnectionStatus(connected: boolean): void {
        // 只通知监听器，不再尝试更新已删除的DOM元素
        console.log(`[WebSocketAdapter] Connection status changed: ${connected ? 'connected' : 'disconnected'}`)

        this.connectionListeners.forEach(listener => {
            try {
                listener(connected)
            } catch (error) {
                console.error('[WebSocketAdapter] Error notifying connection listener:', error)
            }
        })
    }

    disconnect(): void {
        if (this.ws) {
            this.ws.close()
            this.ws = null
        }
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
}
