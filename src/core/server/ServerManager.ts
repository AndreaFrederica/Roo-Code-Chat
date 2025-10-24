import * as vscode from "vscode"
import { ServerWebSocket } from "./WebSocketServer"
import { ServerHttp } from "./HttpServer"
import { WebSocketMessageHandler, ServerConfig } from "./interfaces"

// Re-export for convenience
export type { WebSocketMessageHandler } from "./interfaces"

export class ExtensionServerManager {
    private webSocketServer: ServerWebSocket | null = null
    private httpServer: ServerHttp | null = null
    private extensionUri: vscode.Uri
    private outputChannel: vscode.OutputChannel

    constructor(
        extensionUri: vscode.Uri,
        outputChannel: vscode.OutputChannel
    ) {
        this.extensionUri = extensionUri
        this.outputChannel = outputChannel
    }

    async start(config: ServerConfig, messageHandler: WebSocketMessageHandler): Promise<void> {
        try {
            if (config.enableWebSocket) {
                // 启动WebSocket服务器
                this.webSocketServer = new ServerWebSocket(
                    messageHandler,
                    this.outputChannel,
                    config.webSocketPort
                )
                await this.webSocketServer.start()

                // 启动HTTP静态文件服务器
                this.httpServer = new ServerHttp(
                    this.extensionUri,
                    this.outputChannel,
                    config.httpPort,
                    config.webSocketPort
                )
                await this.httpServer.start()

                this.outputChannel.appendLine(`[ServerManager] Both WebSocket (port ${config.webSocketPort}) and HTTP (port ${config.httpPort}) servers started`)
            }
        } catch (error) {
            this.outputChannel.appendLine(`[ServerManager] Failed to initialize servers: ${error}`)
            throw error
        }
    }

    stop(): void {
        if (this.webSocketServer) {
            this.webSocketServer.stop()
            this.webSocketServer = null
        }
        if (this.httpServer) {
            this.httpServer.stop()
            this.httpServer = null
        }
        this.outputChannel.appendLine('[ServerManager] All servers stopped')
    }

    broadcast(message: any): void {
        if (this.webSocketServer) {
            this.webSocketServer.broadcast(message)
        }
    }

    getConnectedClientsCount(): number {
        return this.webSocketServer ? this.webSocketServer.getConnectedClientsCount() : 0
    }

    getServerInfo(): {
        webSocket: { running: boolean; port: number; clients: number } | null
        http: { running: boolean; url: string } | null
    } {
        return {
            webSocket: this.webSocketServer ? {
                running: true,
                port: this.webSocketServer.getPort(),
                clients: this.webSocketServer.getConnectedClientsCount()
            } : null,
            http: this.httpServer ? {
                running: this.httpServer.isRunning(),
                url: this.httpServer.getServerUrl()
            } : null
        }
    }

    getClientInfo(): Array<{ id: string; connected: boolean; lastActivity: number }> {
        return this.webSocketServer ? this.webSocketServer.getClientInfo() : []
    }

    isWebSocketRunning(): boolean {
        return this.webSocketServer !== null
    }

    isHttpRunning(): boolean {
        return this.httpServer?.isRunning() ?? false
    }
}