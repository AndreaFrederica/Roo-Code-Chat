import * as vscode from "vscode"
import { WebSocketServer, WebSocket } from "ws"
import { WebviewMessage } from "../../shared/WebviewMessage"
import { WebSocketMessageHandler } from "./interfaces"

export interface WebSocketClient {
    id: string
    ws: WebSocket
    connected: boolean
    lastActivity: number
}

export class ServerWebSocket {
    private wss: WebSocketServer | null = null
    private clients: Map<string, WebSocketClient> = new Map()
    private port: number
    private messageHandler: WebSocketMessageHandler
    private outputChannel: vscode.OutputChannel

    constructor(
        messageHandler: WebSocketMessageHandler,
        outputChannel: vscode.OutputChannel,
        port: number = 3001
    ) {
        this.messageHandler = messageHandler
        this.outputChannel = outputChannel
        this.port = port
    }

    async start(): Promise<void> {
        try {
            this.wss = new WebSocketServer({
                port: this.port,
                perMessageDeflate: false
            })

            this.setupServerHandlers()
            this.outputChannel.appendLine(`[ServerWebSocket] Server started on port ${this.port}`)

            // 显示通知
            vscode.window.showInformationMessage(
                `Roo Code Chat WebSocket服务器已启动，端口: ${this.port}`,
                '打开浏览器'
            ).then(selection => {
                if (selection === '打开浏览器') {
                    vscode.env.openExternal(vscode.Uri.parse(`http://localhost:${this.port + 1}`))
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
            const clientId = this.generateClientId()
            const client: WebSocketClient = {
                id: clientId,
                ws,
                connected: true,
                lastActivity: Date.now()
            }

            this.clients.set(clientId, client)
            this.outputChannel.appendLine(`[ServerWebSocket] Client connected: ${clientId}`)

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

        client.ws.on('close', () => {
            client.connected = false
            this.outputChannel.appendLine(`[ServerWebSocket] Client disconnected: ${client.id}`)
        })

        client.ws.on('error', (error) => {
            client.connected = false
            this.outputChannel.appendLine(`[ServerWebSocket] Client error ${client.id}: ${error}`)
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

    getClientInfo(): Array<{ id: string; connected: boolean; lastActivity: number }> {
        return Array.from(this.clients.values()).map(client => ({
            id: client.id,
            connected: client.connected,
            lastActivity: client.lastActivity
        }))
    }
}