import * as vscode from "vscode"
import { WebSocketServer, WebSocket } from "ws"
import { WebviewMessage } from "../../shared/WebviewMessage"
import { WebSocketMessageHandler } from "./interfaces"

export interface WebSocketClient {
    id: string
    ws: WebSocket
    connected: boolean
    lastActivity: number
    ip: string
    userAgent?: string
    origin?: string
}

export class ServerWebSocket {
    private wss: WebSocketServer | null = null
    private clients: Map<string, WebSocketClient> = new Map()
    private port: number
    private host: string
    private messageHandler: WebSocketMessageHandler
    private outputChannel: vscode.OutputChannel

    constructor(
        messageHandler: WebSocketMessageHandler,
        outputChannel: vscode.OutputChannel,
        port: number = 3001,
        host: string = 'localhost'
    ) {
        this.messageHandler = messageHandler
        this.outputChannel = outputChannel
        this.port = port
        this.host = host
    }

    async start(): Promise<void> {
        try {
            this.wss = new WebSocketServer({
                port: this.port,
                host: this.host,
                perMessageDeflate: false,
                verifyClient: (info: { origin: string; secure: boolean; req: any }) => {
                    return this.verifyClientConnection(info)
                }
            })

            this.setupServerHandlers()

            const accessModeText = this.host === '0.0.0.0' ? ' (网络访问模式)' : ' (本地访问模式)'
            this.outputChannel.appendLine(`[ServerWebSocket] Server started on ${this.host}:${this.port}${accessModeText}`)

            // 显示通知
            vscode.window.showInformationMessage(
                `Roo Code Chat WebSocket服务器已启动，端口: ${this.port}${accessModeText}`,
                '打开浏览器'
            ).then(selection => {
                if (selection === '打开浏览器') {
                    // 打开HTTP服务器而不是WebSocket服务器
                    vscode.env.openExternal(vscode.Uri.parse(`http://${this.host === '0.0.0.0' ? 'localhost' : this.host}:${this.port + 1}`))
                }
            })

        } catch (error) {
            this.outputChannel.appendLine(`[ServerWebSocket] Failed to start server: ${error}`)
            vscode.window.showErrorMessage(`WebSocket服务器启动失败: ${error}`)
        }
    }

    private setupServerHandlers(): void {
        if (!this.wss) return

        this.wss.on('connection', (ws: WebSocket, req) => {
            // 获取客户端信息
            const clientInfo = this.extractClientInfo(req)

            // 验证连接（可选的Origin验证等）
            if (!this.validateConnection(ws)) {
                this.outputChannel.appendLine(`[ServerWebSocket] Connection rejected from ${clientInfo.ip}`)
                ws.close(1008, 'Connection not allowed')
                return
            }

            const clientId = this.generateClientId()
            const client: WebSocketClient = {
                id: clientId,
                ws,
                connected: true,
                lastActivity: Date.now(),
                ip: clientInfo.ip,
                userAgent: clientInfo.userAgent,
                origin: clientInfo.origin
            }

            this.clients.set(clientId, client)
            this.outputChannel.appendLine(`[ServerWebSocket] Client connected: ${clientId} from ${clientInfo.ip}${clientInfo.origin ? ` (${clientInfo.origin})` : ''}`)

            // 发送初始状态
            this.sendInitialState(client)

            // 设置客户端消息处理
            this.setupClientHandlers(client)
        })

        this.wss.on('error', (error) => {
            this.outputChannel.appendLine(`[ServerWebSocket] Server error: ${error}`)
        })

        // 定期清理断开的连接
        setInterval(() => {
            this.cleanupDisconnectedClients()
        }, 30000) // 30秒清理一次
    }

    private setupClientHandlers(client: WebSocketClient): void {
        client.ws.on('message', async (data) => {
            try {
                const message: WebviewMessage = JSON.parse(data.toString())
                client.lastActivity = Date.now()

                this.outputChannel.appendLine(`[ServerWebSocket] Received message from ${client.id}: ${message.type}`)

                // 处理消息
                await this.handleMessage(client, message)

            } catch (error) {
                this.outputChannel.appendLine(`[ServerWebSocket] Error handling message: ${error}`)
            }
        })

        client.ws.on('close', (code, reason) => {
            client.connected = false
            const closeReason = reason ? reason.toString('utf8') : 'Unknown'
            this.outputChannel.appendLine(`[ServerWebSocket] Client disconnected: ${client.id} from ${client.ip} (code: ${code}, reason: ${closeReason})`)
        })

        client.ws.on('error', (error) => {
            client.connected = false
            this.outputChannel.appendLine(`[ServerWebSocket] Client error ${client.id} from ${client.ip}: ${error}`)
        })
    }

    private async handleMessage(client: WebSocketClient, message: WebviewMessage): Promise<void> {
        // 将WebSocket消息转发给消息处理器
        try {
            await this.messageHandler.handleMessage(message)

            // 广播响应给所有连接的客户端
            this.broadcastToClients(message)

        } catch (error) {
            this.outputChannel.appendLine(`[ServerWebSocket] Error processing message: ${error}`)

            // 发送错误响应
            this.sendToClient(client, {
                type: 'error',
                text: `处理消息失败: ${error}`
            })
        }
    }

    private async sendInitialState(client: WebSocketClient): Promise<void> {
        if (this.messageHandler.getCurrentState) {
            try {
                const state = await this.messageHandler.getCurrentState()
                this.sendToClient(client, {
                    type: 'state',
                    state
                })
            } catch (error) {
                this.outputChannel.appendLine(`[ServerWebSocket] Error sending initial state: ${error}`)
            }
        }
    }

    // 广播消息给所有WebSocket客户端
    broadcast(message: WebviewMessage): void {
        this.clients.forEach(client => {
            if (client.connected) {
                this.sendToClient(client, message)
            }
        })
    }

    // 发送消息给特定客户端
    private sendToClient(client: WebSocketClient, message: any): void {
        if (client.connected && client.ws.readyState === WebSocket.OPEN) {
            try {
                client.ws.send(JSON.stringify(message))
            } catch (error) {
                this.outputChannel.appendLine(`[ServerWebSocket] Error sending to client ${client.id}: ${error}`)
                client.connected = false
            }
        }
    }

    private broadcastToClients(message: WebviewMessage): void {
        this.clients.forEach(client => {
            if (client.connected) {
                this.sendToClient(client, message)
            }
        })
    }

    private cleanupDisconnectedClients(): void {
        const now = Date.now()
        this.clients.forEach((client, id) => {
            if (!client.connected || (now - client.lastActivity > 300000)) { // 5分钟超时
                if (client.ws.readyState === WebSocket.OPEN) {
                    client.ws.close()
                }
                this.clients.delete(id)
                this.outputChannel.appendLine(`[ServerWebSocket] Cleaned up client: ${id}`)
            }
        })
    }

    private generateClientId(): string {
        return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }

    stop(): void {
        if (this.wss) {
            this.clients.forEach(client => {
                if (client.ws.readyState === WebSocket.OPEN) {
                    client.ws.close()
                }
            })
            this.wss.close()
            this.wss = null
            this.clients.clear()
            this.outputChannel.appendLine('[ServerWebSocket] Server stopped')
        }
    }

    getConnectedClientsCount(): number {
        return Array.from(this.clients.values()).filter(client => client.connected).length
    }

    getPort(): number {
        return this.port
    }

    getClientInfo(): Array<{ id: string; connected: boolean; lastActivity: number; ip: string; origin?: string }> {
        return Array.from(this.clients.values()).map(client => ({
            id: client.id,
            connected: client.connected,
            lastActivity: client.lastActivity,
            ip: client.ip,
            origin: client.origin
        }))
    }

    /**
     * 验证客户端连接
     */
    private verifyClientConnection(info: { origin: string; secure: boolean; req: any }): boolean {
        try {
            const { origin, req } = info

            // 获取客户端IP
            const clientIP = req.socket?.remoteAddress || req.headers['x-forwarded-for'] || 'unknown'

            this.outputChannel.appendLine(`[ServerWebSocket] Connection attempt from ${clientIP}, origin: ${origin || 'none'}`)

            // 如果绑定到localhost，只允许本地连接
            if (this.host === 'localhost' || this.host === '127.0.0.1') {
                const isLocal = clientIP === '127.0.0.1' || clientIP === '::1' || clientIP === '::ffff:127.0.0.1'
                if (!isLocal) {
                    this.outputChannel.appendLine(`[ServerWebSocket] Rejected non-local connection ${clientIP} in localhost mode`)
                    return false
                }
            }

            // 如果绑定到0.0.0.0，允许所有连接
            if (this.host === '0.0.0.0') {
                this.outputChannel.appendLine(`[ServerWebSocket] Accepting external connection from ${clientIP} (network access mode)`)
                return true
            }

            this.outputChannel.appendLine(`[ServerWebSocket] Connection approved for ${clientIP}`)
            return true

        } catch (error) {
            this.outputChannel.appendLine(`[ServerWebSocket] Error verifying client connection: ${error}`)
            return false
        }
    }

    /**
     * 提取客户端信息
     */
    private extractClientInfo(req: any): { ip: string; userAgent?: string; origin?: string } {
        const ip = req.socket?.remoteAddress ||
                  req.headers['x-forwarded-for'] ||
                  req.headers['x-real-ip'] ||
                  'unknown'

        const userAgent = req.headers['user-agent']
        const origin = req.headers['origin']

        return {
            ip: Array.isArray(ip) ? ip[0] : ip,
            userAgent,
            origin
        }
    }

    /**
     * 验证连接（额外的连接验证）
     */
    private validateConnection(ws: WebSocket): boolean {
        try {
            // 可以在这里添加额外的连接验证逻辑
            // 例如检查认证头、速率限制等

            // 基本验证：检查连接状态
            if (ws.readyState !== WebSocket.CONNECTING) {
                return false
            }

            return true
        } catch (error) {
            this.outputChannel.appendLine(`[ServerWebSocket] Error validating connection: ${error}`)
            return false
        }
    }
}