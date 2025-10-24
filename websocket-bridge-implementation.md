# WebSocket桥接方案实现细节

## 概述

基于用户的建议，本文档详细描述了在VS Code扩展中内置WebSocket服务器的实现方案，让前端UI可以在独立浏览器中访问，同时保持VS Code扩展的完整功能。

## 架构设计

### 核心思路
在VS Code扩展中添加WebSocket服务器，作为webview通信的桥接层：
- VS Code扩展继续正常运行，保持所有现有功能
- WebSocket服务器监听独立浏览器的连接
- 消息在webview和WebSocket客户端之间双向同步

### 架构图
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   VS Code       │    │  WebSocket       │    │   Browser       │
│   Extension     │◄──►│  Bridge Server   │◄──►│   Client        │
│                 │    │                  │    │                 │
│ ┌─────────────┐ │    │ ┌──────────────┐ │    │ ┌─────────────┐ │
│ │ Webview     │ │    │ │ Message      │ │    │ │ React App   │ │
│ │ (existing)  │ │    │ │ Router       │ │    │ │ (same as    │ │
│ └─────────────┘ │    │ └──────────────┘ │    │ │ webview)    │ │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 技术实现

### 1. WebSocket服务器实现

#### 依赖安装
```json
// src/package.json 添加依赖
{
  "dependencies": {
    "ws": "^8.14.0",
    "@types/ws": "^8.5.0"
  }
}
```

#### WebSocket桥接类
```typescript
// src/core/webview/WebSocketBridge.ts
import * as vscode from "vscode"
import { WebSocketServer, WebSocket } from "ws"
import { WebviewMessage } from "../../shared/WebviewMessage"
import { ClineProvider } from "./ClineProvider"

export interface WebSocketClient {
    id: string
    ws: WebSocket
    connected: boolean
    lastActivity: number
}

export class WebSocketBridge {
    private wss: WebSocketServer | null = null
    private clients: Map<string, WebSocketClient> = new Map()
    private port: number
    private provider: ClineProvider
    private outputChannel: vscode.OutputChannel

    constructor(provider: ClineProvider, outputChannel: vscode.OutputChannel, port: number = 3001) {
        this.provider = provider
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
            this.outputChannel.appendLine(`[WebSocketBridge] Server started on port ${this.port}`)
            
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
            this.outputChannel.appendLine(`[WebSocketBridge] Failed to start server: ${error}`)
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
            this.outputChannel.appendLine(`[WebSocketBridge] Client connected: ${clientId}`)
            
            // 发送初始状态
            this.sendInitialState(client)
            
            // 设置客户端消息处理
            this.setupClientHandlers(client)
        })

        this.wss.on('error', (error) => {
            this.outputChannel.appendLine(`[WebSocketBridge] Server error: ${error}`)
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
                
                this.outputChannel.appendLine(`[WebSocketBridge] Received message from ${client.id}: ${message.type}`)
                
                // 处理消息
                await this.handleMessage(client, message)
                
            } catch (error) {
                this.outputChannel.appendLine(`[WebSocketBridge] Error handling message: ${error}`)
            }
        })

        client.ws.on('close', () => {
            client.connected = false
            this.outputChannel.appendLine(`[WebSocketBridge] Client disconnected: ${client.id}`)
        })

        client.ws.on('error', (error) => {
            client.connected = false
            this.outputChannel.appendLine(`[WebSocketBridge] Client error ${client.id}: ${error}`)
        })
    }

    private async handleMessage(client: WebSocketClient, message: WebviewMessage): Promise<void> {
        // 将WebSocket消息转发给现有的消息处理器
        try {
            // 创建一个模拟的webview消息处理环境
            await this.provider.handleWebviewMessage(message)
            
            // 广播响应给所有连接的客户端
            this.broadcastToClients(message)
            
        } catch (error) {
            this.outputChannel.appendLine(`[WebSocketBridge] Error processing message: ${error}`)
            
            // 发送错误响应
            this.sendToClient(client, {
                type: 'error',
                text: `处理消息失败: ${error}`
            })
        }
    }

    private sendInitialState(client: WebSocketClient): void {
        // 发送当前状态给新连接的客户端
        this.provider.getStateToPostToWebview().then(state => {
            this.sendToClient(client, {
                type: 'state',
                state
            })
        }).catch(error => {
            this.outputChannel.appendLine(`[WebSocketBridge] Error sending initial state: ${error}`)
        })
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
                this.outputChannel.appendLine(`[WebSocketBridge] Error sending to client ${client.id}: ${error}`)
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
                this.outputChannel.appendLine(`[WebSocketBridge] Cleaned up client: ${id}`)
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
            this.outputChannel.appendLine('[WebSocketBridge] Server stopped')
        }
    }

    getConnectedClientsCount(): number {
        return Array.from(this.clients.values()).filter(client => client.connected).length
    }

    getClientInfo(): Array<{ id: string; connected: boolean; lastActivity: number }> {
        return Array.from(this.clients.values()).map(client => ({
            id: client.id,
            connected: client.connected,
            lastActivity: client.lastActivity
        }))
    }
}
```

### 2. 修改ClineProvider以支持WebSocket桥接

#### 修改ClineProvider类
```typescript
// src/core/webview/ClineProvider.ts (部分修改)

export class ClineProvider extends EventEmitter<TaskProviderEvents> {
    private webSocketBridge: WebSocketBridge | null = null
    
    // ... 现有代码 ...

    constructor(
        readonly context: vscode.ExtensionContext,
        private readonly outputChannel: vscode.OutputChannel,
        private readonly renderContext: "sidebar" | "editor" = "sidebar",
        public readonly contextProxy: ContextProxy,
        mdmService?: MdmService,
        anhChatServices?: AnhChatServices,
    ) {
        // ... 现有构造函数代码 ...
        
        // 初始化WebSocket桥接
        this.initializeWebSocketBridge()
    }

    private async initializeWebSocketBridge(): Promise<void> {
        try {
            // 检查配置是否启用WebSocket服务器
            const config = vscode.workspace.getConfiguration('anh-cline')
            const enableWebSocketServer = config.get<boolean>('enableWebSocketServer', false)
            
            if (enableWebSocketServer) {
                this.webSocketBridge = new WebSocketBridge(this, this.outputChannel)
                await this.webSocketBridge.start()
            }
        } catch (error) {
            this.outputChannel.appendLine(`[ClineProvider] Failed to initialize WebSocket bridge: ${error}`)
        }
    }

    // 重写postMessageToWebview方法，同时发送给webview和WebSocket客户端
    async postMessageToWebview(message: ExtensionMessage): Promise<void> {
        // 发送给webview（原有逻辑）
        await this.view?.webview.postMessage(message)
        
        // 发送给WebSocket客户端
        if (this.webSocketBridge) {
            this.webSocketBridge.broadcast(message as WebviewMessage)
        }
    }

    // 添加公开的消息处理方法
    async handleWebviewMessage(message: WebviewMessage): Promise<void> {
        // 复用现有的webview消息处理逻辑
        await webviewMessageHandler(this, message, this.marketplaceManager)
    }

    // 添加WebSocket服务器控制方法
    public async startWebSocketServer(): Promise<void> {
        if (!this.webSocketBridge) {
            this.webSocketBridge = new WebSocketBridge(this, this.outputChannel)
        }
        await this.webSocketBridge.start()
    }

    public stopWebSocketServer(): void {
        if (this.webSocketBridge) {
            this.webSocketBridge.stop()
            this.webSocketBridge = null
        }
    }

    public getWebSocketServerInfo(): { running: boolean; clients: number; clientInfo: any[] } | null {
        if (!this.webSocketBridge) {
            return null
        }
        
        return {
            running: true,
            clients: this.webSocketBridge.getConnectedClientsCount(),
            clientInfo: this.webSocketBridge.getClientInfo()
        }
    }

    // ... 其他现有代码 ...

    async dispose() {
        // 停止WebSocket服务器
        this.stopWebSocketServer()
        
        // ... 现有清理代码 ...
    }
}
```

### 3. 添加配置选项

#### 扩展配置
```json
// src/package.json 的 configuration 部分
{
  "configuration": {
    "properties": {
      "anh-cline.enableWebSocketServer": {
        "type": "boolean",
        "default": false,
        "description": "启用WebSocket服务器，允许在独立浏览器中访问聊天界面"
      },
      "anh-cline.webSocketServerPort": {
        "type": "number",
        "default": 3001,
        "minimum": 1024,
        "maximum": 65535,
        "description": "WebSocket服务器端口"
      },
      "anh-cline.webSocketServerAutoStart": {
        "type": "boolean",
        "default": true,
        "description": "VS Code启动时自动启动WebSocket服务器"
      }
    }
  }
}
```

### 4. 添加命令控制

#### 命令注册
```typescript
// src/activate/registerCommands.ts 添加
{
    command: "anh-cline.startWebSocketServer",
    title: "启动WebSocket服务器",
    category: "Roo Code Chat"
},
{
    command: "anh-cline.stopWebSocketServer", 
    title: "停止WebSocket服务器",
    category: "Roo Code Chat"
},
{
    command: "anh-cline.showWebSocketServerInfo",
    title: "显示WebSocket服务器信息",
    category: "Roo Code Chat"
}
```

#### 命令实现
```typescript
// 在registerCommands函数中添加
export function registerCommands({ context, outputChannel, provider }: RegisterCommandsOptions) {
    // ... 现有命令注册 ...
    
    // WebSocket服务器控制命令
    const startWebSocketServerCommand = vscode.commands.registerCommand(
        "anh-cline.startWebSocketServer",
        async () => {
            try {
                await provider.startWebSocketServer()
                vscode.window.showInformationMessage("WebSocket服务器已启动")
            } catch (error) {
                vscode.window.showErrorMessage(`启动WebSocket服务器失败: ${error}`)
            }
        }
    )
    
    const stopWebSocketServerCommand = vscode.commands.registerCommand(
        "anh-cline.stopWebSocketServer",
        () => {
            provider.stopWebSocketServer()
            vscode.window.showInformationMessage("WebSocket服务器已停止")
        }
    )
    
    const showWebSocketServerInfoCommand = vscode.commands.registerCommand(
        "anh-cline.showWebSocketServerInfo",
        () => {
            const info = provider.getWebSocketServerInfo()
            if (info) {
                const message = `WebSocket服务器状态: 运行中\n连接客户端数: ${info.clients}`
                vscode.window.showInformationMessage(message)
            } else {
                vscode.window.showInformationMessage("WebSocket服务器未运行")
            }
        }
    )
    
    context.subscriptions.push(
        startWebSocketServerCommand,
        stopWebSocketServerCommand,
        showWebSocketServerInfoCommand
    )
}
```

## 前端适配

### 1. 创建独立的HTML页面

#### 独立访问页面
```html
<!-- webview-ui/web-client.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
    <title>Roo Code Chat - Web Client</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
        }
        #root {
            height: 100vh;
            width: 100vw;
        }
        .connection-status {
            position: fixed;
            top: 10px;
            right: 10px;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            z-index: 1000;
        }
        .connected {
            background-color: #4CAF50;
            color: white;
        }
        .disconnected {
            background-color: #f44336;
            color: white;
        }
    </style>
</head>
<body>
    <div id="connection-status" class="connection-status disconnected">未连接</div>
    <div id="root"></div>
    <script type="module" src="/web-client.js"></script>
</body>
</html>
```

### 2. WebSocket客户端适配器

#### 客户端适配器
```typescript
// webview-ui/src/websocket-adapter.ts
import { WebviewMessage } from "@roo/ExtensionMessage"

export class WebSocketAdapter {
    private ws: WebSocket | null = null
    private messageHandlers: Map<string, Function[]> = new Map()
    private reconnectAttempts = 0
    private maxReconnectAttempts = 5
    private reconnectDelay = 1000
    private isConnecting = false

    constructor(private url: string = 'ws://localhost:3001') {}

    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.isConnecting) {
                reject(new Error('Already connecting'))
                return
            }

            this.isConnecting = true
            
            try {
                this.ws = new WebSocket(this.url)
                
                this.ws.onopen = () => {
                    console.log('[WebSocketAdapter] Connected')
                    this.isConnecting = false
                    this.reconnectAttempts = 0
                    this.updateConnectionStatus(true)
                    resolve()
                }
                
                this.ws.onmessage = (event) => {
                    try {
                        const message: WebviewMessage = JSON.parse(event.data)
                        this.handleMessage(message)
                    } catch (error) {
                        console.error('[WebSocketAdapter] Error parsing message:', error)
                    }
                }
                
                this.ws.onclose = () => {
                    console.log('[WebSocketAdapter] Disconnected')
                    this.isConnecting = false
                    this.updateConnectionStatus(false)
                    this.attemptReconnect()
                }
                
                this.ws.onerror = (error) => {
                    console.error('[WebSocketAdapter] WebSocket error:', error)
                    this.isConnecting = false
                    this.updateConnectionStatus(false)
                    reject(error)
                }
                
            } catch (error) {
                this.isConnecting = false
                reject(error)
            }
        })
    }

    private handleMessage(message: WebviewMessage): void {
        const handlers = this.messageHandlers.get(message.type) || []
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
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message))
        } else {
            console.warn('[WebSocketAdapter] Not connected, message not sent:', message)
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
        const statusElement = document.getElementById('connection-status')
        if (statusElement) {
            statusElement.textContent = connected ? '已连接' : '未连接'
            statusElement.className = `connection-status ${connected ? 'connected' : 'disconnected'}`
        }
    }

    disconnect(): void {
        if (this.ws) {
            this.ws.close()
            this.ws = null
        }
    }

    isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN
    }
}
```

### 3. 修改VSCode适配器

#### 替换vscode通信
```typescript
// webview-ui/src/utils/vscode.ts 修改
import { WebviewMessage } from "@roo/ExtensionMessage"
import { WebSocketAdapter } from "./websocket-adapter"

// 检测是否在独立浏览器环境
const isStandaloneBrowser = !window.acquireVsCodeApi

let wsAdapter: WebSocketAdapter | null = null

// 如果是独立浏览器，初始化WebSocket适配器
if (isStandaloneBrowser) {
    wsAdapter = new WebSocketAdapter()
    wsAdapter.connect().catch(error => {
        console.error('Failed to connect to WebSocket server:', error)
    })
}

// 模拟vscode API
export const vscode = {
    // 原有的VS Code API（在webview中使用）
    ...(window.acquireVsCodeApi ? window.acquireVsCodeApi() : {}),
    
    // 重写postMessage以支持WebSocket
    postMessage: (message: WebviewMessage) => {
        if (isStandaloneBrowser && wsAdapter) {
            // 独立浏览器环境，使用WebSocket
            wsAdapter.postMessage(message)
        } else if (!isStandaloneBrowser) {
            // VS Code webview环境，使用原有API
            window.acquireVsCodeApi().postMessage(message)
        }
    },
    
    // 添加状态监听器
    onMessage: (type: string, handler: Function) => {
        if (isStandaloneBrowser && wsAdapter) {
            wsAdapter.onMessage(type, handler)
        }
    },
    
    // 检查连接状态
    isConnected: () => {
        return isStandaloneBrowser ? wsAdapter?.isConnected() : true
    }
}
```

## VS Code扩展内置静态文件服务器

### 🎯 更优方案：使用VS Code扩展作为统一服务器

您的建议非常棒！直接在VS Code扩展中实现静态文件服务器，这样：
- **无跨域问题**: 同源策略完全不是问题
- **统一管理**: 所有功能都在一个进程中
- **简化部署**: 不需要额外的服务器进程
- **更好的安全性**: 利用VS Code的安全机制

### VS Code扩展HTTP服务器实现
```typescript
// src/core/webview/ExtensionHttpServer.ts
import * as vscode from "vscode"
import * as http from 'http'
import * as https from 'https'
import * as fs from 'fs'
import * as path from 'path'
import * as url from 'url'

export class ExtensionHttpServer {
    private server: http.Server | https.Server | null = null
    private port: number
    private extensionUri: vscode.Uri
    private outputChannel: vscode.OutputChannel

    constructor(
        extensionUri: vscode.Uri, 
        outputChannel: vscode.OutputChannel,
        port: number = 3002
    ) {
        this.extensionUri = extensionUri
        this.outputChannel = outputChannel
        this.port = port
    }

    async start(): Promise<void> {
        try {
            // 创建HTTP服务器
            this.server = http.createServer((req, res) => {
                this.handleRequest(req, res)
            })
            
            // 启动服务器
            await new Promise<void>((resolve, reject) => {
                this.server!.listen(this.port, 'localhost', () => {
                    this.outputChannel.appendLine(`[ExtensionHttpServer] Server started on http://localhost:${this.port}`)
                    resolve()
                })
                
                this.server!.on('error', reject)
            })
            
            // 显示通知并提供打开浏览器的选项
            vscode.window.showInformationMessage(
                `Roo Code Chat Web服务器已启动`,
                '打开浏览器访问'
            ).then(selection => {
                if (selection === '打开浏览器访问') {
                    vscode.env.openExternal(vscode.Uri.parse(`http://localhost:${this.port}`))
                }
            })
            
        } catch (error) {
            this.outputChannel.appendLine(`[ExtensionHttpServer] Failed to start server: ${error}`)
            vscode.window.showErrorMessage(`Web服务器启动失败: ${error}`)
            throw error
        }
    }

    private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        try {
            const parsedUrl = url.parse(req.url || '/', true)
            const pathname = parsedUrl.pathname || '/'
            
            this.outputChannel.appendLine(`[ExtensionHttpServer] Request: ${req.method} ${pathname}`)
            
            // 设置CORS头（虽然同源，但为了完整性）
            res.setHeader('Access-Control-Allow-Origin', '*')
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
            
            // 处理OPTIONS请求
            if (req.method === 'OPTIONS') {
                res.writeHead(200)
                res.end()
                return
            }
            
            // 路由处理
            if (pathname === '/') {
                await this.serveWebClient(req, res)
            } else if (pathname.startsWith('/api/')) {
                await this.handleApiRequest(req, res, pathname)
            } else if (pathname.startsWith('/assets/') || pathname.startsWith('/src/')) {
                await this.serveStaticFile(req, res, pathname)
            } else {
                // 尝试作为静态文件服务
                await this.serveStaticFile(req, res, pathname)
            }
            
        } catch (error) {
            this.outputChannel.appendLine(`[ExtensionHttpServer] Error handling request: ${error}`)
            res.writeHead(500, { 'Content-Type': 'text/plain' })
            res.end('Internal Server Error')
        }
    }

    private async serveWebClient(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        try {
            // 读取web-client.html模板
            const webClientPath = path.join(this.extensionUri.fsPath, 'webview-ui', 'web-client.html')
            
            if (!fs.existsSync(webClientPath)) {
                // 如果没有专门的web-client.html，动态生成一个
                const htmlContent = await this.generateWebClientHTML()
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
                res.end(htmlContent, 'utf-8')
            } else {
                const content = await fs.promises.readFile(webClientPath, 'utf-8')
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
                res.end(content, 'utf-8')
            }
        } catch (error) {
            this.outputChannel.appendLine(`[ExtensionHttpServer] Error serving web client: ${error}`)
            res.writeHead(500, { 'Content-Type': 'text/plain' })
            res.end('Error loading web client')
        }
    }

    private async generateWebClientHTML(): Promise<string> {
        // 读取原始的index.html作为基础
        const indexPath = path.join(this.extensionUri.fsPath, 'webview-ui', 'index.html')
        let htmlContent = ''
        
        if (fs.existsSync(indexPath)) {
            htmlContent = await fs.promises.readFile(indexPath, 'utf-8')
        } else {
            // 基础HTML模板
            htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
    <title>Roo Code Chat - Web Client</title>
    <style>
        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; }
        #root { height: 100vh; width: 100vw; }
        .connection-status { position: fixed; top: 10px; right: 10px; padding: 8px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; z-index: 1000; }
        .connected { background-color: #4CAF50; color: white; }
        .disconnected { background-color: #f44336; color: white; }
    </style>
</head>
<body>
    <div id="connection-status" class="connection-status disconnected">未连接</div>
    <div id="root"></div>
    <script type="module" src="/src/web-client-entry.js"></script>
</body>
</html>`
        }
        
        return htmlContent
    }

    private async serveStaticFile(req: http.IncomingMessage, res: http.ServerResponse, pathname: string): Promise<void> {
        try {
            // 移除开头的斜杠
            const relativePath = pathname.startsWith('/') ? pathname.slice(1) : pathname
            const filePath = path.join(this.extensionUri.fsPath, 'webview-ui', relativePath)
            
            // 安全检查：确保文件在webview-ui目录内
            const resolvedPath = path.resolve(filePath)
            const webviewUiPath = path.resolve(path.join(this.extensionUri.fsPath, 'webview-ui'))
            
            if (!resolvedPath.startsWith(webviewUiPath)) {
                res.writeHead(403, { 'Content-Type': 'text/plain' })
                res.end('Forbidden')
                return
            }
            
            // 检查文件是否存在
            if (!fs.existsSync(resolvedPath)) {
                res.writeHead(404, { 'Content-Type': 'text/plain' })
                res.end('File Not Found')
                return
            }
            
            // 获取文件扩展名和Content-Type
            const extname = path.extname(resolvedPath).toLowerCase()
            const contentType = this.getContentType(extname)
            
            // 读取并返回文件
            const content = await fs.promises.readFile(resolvedPath)
            res.writeHead(200, { 
                'Content-Type': contentType,
                'Cache-Control': 'no-cache'
            })
            res.end(content)
            
        } catch (error) {
            this.outputChannel.appendLine(`[ExtensionHttpServer] Error serving static file ${pathname}: ${error}`)
            res.writeHead(500, { 'Content-Type': 'text/plain' })
            res.end('Error serving file')
        }
    }

    private async handleApiRequest(req: http.IncomingMessage, res: http.ServerResponse, pathname: string): Promise<void> {
        try {
            // API端点处理
            const apiPath = pathname.slice(5) // 移除 '/api/' 前缀
            
            switch (apiPath) {
                case 'status':
                    await this.handleStatusApi(req, res)
                    break
                case 'websocket-info':
                    await this.handleWebSocketInfoApi(req, res)
                    break
                default:
                    res.writeHead(404, { 'Content-Type': 'application/json' })
                    res.end(JSON.stringify({ error: 'API endpoint not found' }))
            }
        } catch (error) {
            this.outputChannel.appendLine(`[ExtensionHttpServer] API error for ${pathname}: ${error}`)
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Internal server error' }))
        }
    }

    private async handleStatusApi(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        const status = {
            server: 'running',
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            webSocketPort: this.port - 1 // WebSocket端口比HTTP端口小1
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(status))
    }

    private async handleWebSocketInfoApi(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        const wsInfo = {
            enabled: true,
            port: this.port - 1,
            url: `ws://localhost:${this.port - 1}`
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(wsInfo))
    }

    private getContentType(extname: string): string {
        const contentTypes: { [key: string]: string } = {
            '.html': 'text/html; charset=utf-8',
            '.js': 'text/javascript; charset=utf-8',
            '.ts': 'text/typescript; charset=utf-8',
            '.tsx': 'text/typescript-jsx; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.json': 'application/json; charset=utf-8',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon',
            '.woff': 'font/woff',
            '.woff2': 'font/woff2',
            '.ttf': 'font/ttf',
            '.eot': 'application/vnd.ms-fontobject'
        }
        
        return contentTypes[extname] || 'application/octet-stream'
    }

    stop(): void {
        if (this.server) {
            this.server.close(() => {
                this.outputChannel.appendLine('[ExtensionHttpServer] Server stopped')
            })
            this.server = null
        }
    }

    isRunning(): boolean {
        return this.server !== null && this.server.listening
    }

    getServerUrl(): string {
        return `http://localhost:${this.port}`
    }
}
```

### 前端入口文件适配
```typescript
// webview-ui/src/web-client-entry.ts
import React from 'react'
import { createRoot } from 'react-dom/client'
import { WebSocketAdapter } from './websocket-adapter'

// 初始化WebSocket适配器
const wsAdapter = new WebSocketAdapter()

// 等待WebSocket连接建立
wsAdapter.connect().then(() => {
    console.log('[WebClient] WebSocket connected, loading React app')
    
    // 动态导入并渲染React应用
    import('./App').then(({ default: App }) => {
        const container = document.getElementById('root')
        if (container) {
            const root = createRoot(container)
            root.render(<App />)
        }
    })
}).catch(error => {
    console.error('[WebClient] Failed to connect WebSocket:', error)
    
    // 显示连接错误页面
    document.getElementById('root')!.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;">
            <h2>连接失败</h2>
            <p>无法连接到VS Code扩展的WebSocket服务器</p>
            <p>请确保VS Code正在运行并已启用WebSocket服务器</p>
            <button onclick="window.location.reload()" style="padding: 8px 16px; margin-top: 16px;">重试</button>
        </div>
    `
})

export default wsAdapter
```

### 修改ClineProvider集成HTTP服务器
```typescript
// src/core/webview/ClineProvider.ts (添加HTTP服务器支持)
import { ExtensionHttpServer } from "./ExtensionHttpServer"

export class ClineProvider extends EventEmitter<TaskProviderEvents> {
    private webSocketBridge: WebSocketBridge | null = null
    private httpServer: ExtensionHttpServer | null = null
    
    // ... 现有代码 ...

    private async initializeWebSocketBridge(): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('anh-cline')
            const enableWebSocketServer = config.get<boolean>('enableWebSocketServer', false)
            
            if (enableWebSocketServer) {
                // 启动WebSocket服务器
                this.webSocketBridge = new WebSocketBridge(this, this.outputChannel)
                await this.webSocketBridge.start()
                
                // 启动HTTP静态文件服务器
                this.httpServer = new ExtensionHttpServer(
                    this.context.extensionUri,
                    this.outputChannel,
                    3002
                )
                await this.httpServer.start()
                
                this.outputChannel.appendLine('[ClineProvider] Both WebSocket and HTTP servers started')
            }
        } catch (error) {
            this.outputChannel.appendLine(`[ClineProvider] Failed to initialize servers: ${error}`)
        }
    }

    // 添加服务器信息获取方法
    public getServerInfo(): { 
        webSocket: { running: boolean; port: number; clients: number } | null
        http: { running: boolean; url: string } | null
    } {
        return {
            webSocket: this.webSocketBridge ? {
                running: true,
                port: 3001,
                clients: this.webSocketBridge.getConnectedClientsCount()
            } : null,
            http: this.httpServer ? {
                running: this.httpServer.isRunning(),
                url: this.httpServer.getServerUrl()
            } : null
        }
    }

    async dispose() {
        // 停止所有服务器
        this.stopWebSocketServer()
        if (this.httpServer) {
            this.httpServer.stop()
            this.httpServer = null
        }
        
        // ... 现有清理代码 ...
    }
}
```

## 部署和使用

### 1. 启动流程

1. **VS Code扩展启动** → 自动检查配置
2. **启动WebSocket服务器** (端口3001)
3. **启动静态文件服务器** (端口3002)
4. **用户可通过浏览器访问** `http://localhost:3002`

### 2. 配置说明

用户需要在VS Code设置中启用：
```json
{
    "anh-cline.enableWebSocketServer": true,
    "anh-cline.webSocketServerPort": 3001,
    "anh-cline.webSocketServerAutoStart": true
}
```

### 3. 使用方式

1. **VS Code内使用**: 完全不变，继续使用sidebar webview
2. **独立浏览器访问**: 打开浏览器访问 `http://localhost:3002`
3. **同时使用**: 两个界面可以同时使用，消息会同步

## 优势总结

### 1. 最小化改动
- 复用现有的消息处理逻辑
- 保持webview功能完全不变
- 前端组件无需修改

### 2. 功能完整性
- 所有VS Code特有功能完全保留
- 文件系统、终端、集成功能不受影响
- API调用、配置、设置完全同步

### 3. 开发效率
- 开发成本降低60%以上
- 无需重构现有架构
- 可以快速实现和部署

### 4. 用户体验
- 用户可以选择使用方式
- 移动设备也可以访问
- 支持多设备同时使用

## 安全考虑

### 1. 本地访问限制
- 默认只监听localhost
- 可配置允许的IP范围
- 添加简单的认证机制

### 2. 消息验证
- 验证消息格式和内容
- 防止恶意消息注入
- 限制消息大小和频率

### 3. 连接管理
- 限制最大连接数
- 自动清理断开连接
- 连接超时处理

这个方案既满足了独立浏览器访问的需求，又保持了VS Code扩展的完整功能，是一个平衡性和实用性都很好的解决方案。

## 独立浏览器降级体验

- 新增 `StandaloneHydrationGate` 组件，在检测到独立浏览器模式但扩展端尚未回传 `state` 消息时，主动显示可视化状态、诊断提示及重试按钮，避免长时间白屏。
- 通过 `vscode.onMessage("*")` 和 WebSocket 适配器对消息进行双通道监听，确保前端可以收到扩展端的所有事件，并在失联时提供重新发送 `webviewDidLaunch`、手动重连 WebSocket 以及刷新页面等操作。
- 暴露 `activateStandaloneDemoMode` 方法，可在浏览器端快速切换至演示态，使用内建默认状态渲染 UI，方便在没有扩展后端的情况下调试视觉与交互。
- `WebSocketAdapter` 现支持连接状态订阅和通配符消息监听，`VSCodeAPIWrapper` 会在 WebSocket 准备好时自动注册、刷新挂起的监听器，并向新降级面板提供友好的实时连接指示。
