import * as vscode from "vscode"
import { ServerWebSocket } from "./WebSocketServer"
import { ServerHttp } from "./HttpServer"
import { WebSocketMessageHandler, ServerConfig } from "./interfaces"
import { NetworkUtils } from "./network-utils"

// Re-export for convenience
export type { WebSocketMessageHandler } from "./interfaces"

export class WebSocketServerOutputChannel {
    private channel: vscode.OutputChannel

    constructor() {
        this.channel = vscode.window.createOutputChannel('Anh Chat WebSocket Server')
    }

    appendLine(message: string): void {
        const timestamp = new Date().toLocaleTimeString()
        this.channel.appendLine(`[${timestamp}] ${message}`)
    }

    append(message: string): void {
        this.channel.append(message)
    }

    show(): void {
        this.channel.show()
    }

    dispose(): void {
        this.channel.dispose()
    }
}

export class ExtensionServerManager {
    private webSocketServer: ServerWebSocket | null = null
    private httpServer: ServerHttp | null = null
    private extensionUri: vscode.Uri
    private outputChannel: vscode.OutputChannel
    private wsOutputChannel: WebSocketServerOutputChannel | null = null

    constructor(
        extensionUri: vscode.Uri,
        outputChannel: vscode.OutputChannel
    ) {
        this.extensionUri = extensionUri
        this.outputChannel = outputChannel
        this.wsOutputChannel = new WebSocketServerOutputChannel()
    }

    async start(config: ServerConfig, messageHandler: WebSocketMessageHandler): Promise<void> {
        try {
            if (config.enableWebSocket) {
                // 解析绑定主机
                const resolvedHost = NetworkUtils.parseBindHost(config.bindHost)

                // 创建一个集成HTTP和WebSocket的服务器
                this.httpServer = new ServerHttp(
                    this.extensionUri,
                    this.outputChannel,
                    config.httpPort,
                    config.webSocketPort,
                    resolvedHost
                )

                // 设置WebSocket专用输出通道
                if (this.wsOutputChannel) {
                    this.httpServer.setWebSocketOutputChannel(this.wsOutputChannel)
                }

                // 启动集成了WebSocket功能的HTTP服务器
                await this.httpServer.startWithWebSocket(messageHandler)

                // 显示服务器访问信息
                NetworkUtils.showServerAccessInfo(resolvedHost, config.httpPort, config.httpPort, this.outputChannel)

                const accessMode = resolvedHost === '0.0.0.0' ? '网络访问模式' : '本地访问模式'
                this.outputChannel.appendLine(`[ServerManager] Integrated HTTP/WebSocket server started on port ${config.httpPort} in ${accessMode}`)
            }
        } catch (error) {
            this.outputChannel.appendLine(`[ServerManager] Failed to initialize server: ${error}`)
            throw error
        }
    }

    stop(): void {
        if (this.httpServer) {
            this.httpServer.stop()
            this.httpServer = null
        }
        if (this.wsOutputChannel) {
            this.wsOutputChannel.appendLine('[ServerManager] WebSocket server stopped')
            this.wsOutputChannel.dispose()
            this.wsOutputChannel = null
        }
        this.outputChannel.appendLine('[ServerManager] Integrated HTTP/WebSocket server stopped')
    }

    broadcast(message: any): void {
        if (this.httpServer) {
            this.httpServer.broadcast(message)
        }
    }

    getConnectedClientsCount(): number {
        return this.httpServer ? this.httpServer.getConnectedClientsCount() : 0
    }

    getServerInfo(): {
        webSocket: { running: boolean; port: number; clients: number } | null
        http: { running: boolean; url: string } | null
    } {
        if (this.httpServer) {
            return {
                webSocket: {
                    running: true,
                    port: this.httpServer.getPort(),
                    clients: this.httpServer.getConnectedClientsCount()
                },
                http: {
                    running: this.httpServer.isRunning(),
                    url: this.httpServer.getServerUrl()
                }
            }
        }
        return {
            webSocket: null,
            http: null
        }
    }

    getClientInfo(): Array<{ id: string; connected: boolean; lastActivity: number }> {
        return this.httpServer ? this.httpServer.getWebSocketClientInfo() : []
    }

    isWebSocketRunning(): boolean {
        return this.httpServer?.isRunning() ?? false
    }

    isHttpRunning(): boolean {
        return this.httpServer?.isRunning() ?? false
    }

    showWebSocketLogs(): void {
        if (this.wsOutputChannel) {
            this.wsOutputChannel.show()
        } else {
            vscode.window.showInformationMessage('WebSocket服务器未运行')
        }
    }

    getWebSocketOutputChannel(): WebSocketServerOutputChannel | null {
        return this.wsOutputChannel
    }
}