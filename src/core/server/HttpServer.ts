import * as vscode from "vscode"
import * as http from 'http'
import * as fs from 'fs'
import * as path from 'path'
import * as url from 'url'
import * as os from 'os'
import { WebSocketServer } from 'ws'
import { WebSocketMessageHandler } from './interfaces'
import { WebviewMessage } from '../../shared/WebviewMessage'
import { NetworkInterfaceInfo } from 'os'

interface WebSocketClient {
    id: string
    ws: any
    connected: boolean
    lastActivity: number
    ip: string
    userAgent?: string
    origin?: string
}

export class ServerHttp {
    private server: http.Server | null = null
    private port: number
    private webSocketPort: number
    private host: string
    private extensionUri: vscode.Uri
    private outputChannel: vscode.OutputChannel
    private wsOutputChannel: any // WebSocketServerOutputChannel
    private wss: WebSocketServer | null = null
    private clients: Map<string, WebSocketClient> = new Map()
    private messageHandler: WebSocketMessageHandler | null = null

    constructor(
        extensionUri: vscode.Uri,
        outputChannel: vscode.OutputChannel,
        port: number = 3002,
        webSocketPort: number = 3001,
        host: string = 'localhost'
    ) {
        this.extensionUri = extensionUri
        this.outputChannel = outputChannel
        this.port = port
        this.webSocketPort = webSocketPort
        this.host = host
    }

    async start(): Promise<void> {
        try {
            // 创建HTTP服务器
            this.server = http.createServer((req, res) => {
                this.handleRequest(req, res)
            })

            // 启动服务器
            await new Promise<void>((resolve, reject) => {
                this.server!.listen(this.port, this.host, () => {
                    const serverUrl = this.getServerUrl()
                    this.outputChannel.appendLine(`[ServerHttp] Server started on ${serverUrl}`)
                    resolve()
                })

                this.server!.on('error', reject)
            })

            // 显示通知并提供打开浏览器的选项
            const accessModeText = this.host === '0.0.0.0' ? ' (网络访问模式)' : ' (本地访问模式)'
            vscode.window.showInformationMessage(
                `Roo Code Chat Web服务器已启动${accessModeText}`,
                '打开浏览器访问'
            ).then(selection => {
                if (selection === '打开浏览器访问') {
                    vscode.env.openExternal(vscode.Uri.parse(this.getServerUrl()))
                }
            })

        } catch (error) {
            this.outputChannel.appendLine(`[ServerHttp] Failed to start server: ${error}`)
            vscode.window.showErrorMessage(`Web服务器启动失败: ${error}`)
            throw error
        }
    }

    private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        try {
            const parsedUrl = url.parse(req.url || '/', true)
            const pathname = parsedUrl.pathname || '/'

            const clientIP = this.getClientIP(req)
            this.outputChannel.appendLine(`[ServerHttp] Request: ${req.method} ${pathname} from ${clientIP}`)

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
            if (pathname === '/ws') {
                // WebSocket升级处理
                await this.handleWebSocketUpgrade(req, res)
            } else if (pathname === '/') {
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
            this.outputChannel.appendLine(`[ServerHttp] Error handling request: ${error}`)
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
            this.outputChannel.appendLine(`[ServerHttp] Error serving web client: ${error}`)
            res.writeHead(500, { 'Content-Type': 'text/plain' })
            res.end('Error loading web client')
        }
    }

    private async generateWebClientHTML(): Promise<string> {
        // 读取原始的index.html作为基础
        const indexPath = path.join(this.extensionUri.fsPath, 'webview-ui', 'index.html')
        let htmlContent = ''

        // CSS 链接标签
        const cssLinks = `
    <link rel="stylesheet" href="/assets/style.css">
    <link rel="preload" href="/assets/codicon.ttf" as="font" type="font/ttf" crossorigin>
    <style>
        @font-face {
            font-family: 'codicon';
            src: url('/assets/codicon.ttf') format('truetype');
            font-weight: normal;
            font-style: normal;
        }
    </style>`

        const bootstrapScript = `
    <script type="module">
        const sources = [
            "/web-client-entry.js",
            "/assets/web-client-entry.js",
            "/src/web-client-entry.tsx",
        ]

        let lastError
        for (const src of sources) {
            try {
                console.log(\`[WebClient] Bootstrapping with \${src}\`)
                await import(src)
                lastError = undefined
                break
            } catch (error) {
                console.warn(\`[WebClient] Failed to load \${src}\`, error)
                lastError = error
            }
        }

        if (lastError) {
            console.error("[WebClient] Unable to bootstrap web client", lastError)
        }
    <\/script>`

        if (fs.existsSync(indexPath)) {
            htmlContent = await fs.promises.readFile(indexPath, 'utf-8')
            htmlContent = htmlContent.replace(
                /<script[^>]*src="[^"]*"[^>]*><\/script>/,
                `${cssLinks.trim()}\n${bootstrapScript.trim()}`,
            )
        } else {
            // 基础HTML模板
            htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
    <title>Roo Code Chat - Web Client</title>
    ${cssLinks.trim()}
    <style>
        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; }
        #root { height: 100vh; width: 100vw; }
    </style>
</head>
<body>
    <div id="root"></div>
${bootstrapScript.trim()}
</body>
</html>`
        }

        return htmlContent
    }

    private async serveStaticFile(req: http.IncomingMessage, res: http.ServerResponse, pathname: string): Promise<void> {
        try {
            // 移除开头的斜杠
            let relativePath = pathname.startsWith('/') ? pathname.slice(1) : pathname

            this.outputChannel.appendLine(`[ServerHttp] Request for: ${pathname}, relativePath: ${relativePath}`)

            // 特殊处理：重定向特定的资源文件到assets目录
            const specificAssets = ['mermaid-bundle.js']
            const isChunk = relativePath.startsWith('chunk-') && relativePath.endsWith('.js')
            const isSourcemap = relativePath.endsWith('.map') || relativePath.endsWith('.js.map') ||
                               relativePath.endsWith('.map.json') || relativePath.endsWith('.sourcemap')
            const isAudioFile = relativePath.endsWith('.wav') || relativePath.endsWith('.mp3') || relativePath.endsWith('.ogg')

            // 特殊处理 web-client-entry.js 映射到 assets/web-client-entry.js
            if (relativePath === 'web-client-entry.js') {
                relativePath = 'assets/web-client-entry.js'
                this.outputChannel.appendLine(`[ServerHttp] Redirected web-client-entry.js to: ${relativePath}`)
            }
            // 特殊处理音频文件映射到 audio 目录
            else if (isAudioFile) {
                relativePath = `audio/${relativePath}`
                this.outputChannel.appendLine(`[ServerHttp] Redirected audio file to: ${relativePath}`)
            }
            // 特殊处理sourcemap文件名称转换
            else if (relativePath === 'web-client-entry.map.json' || relativePath === 'web-client-entry.sourcemap' || relativePath === 'web-client-entry.js.map') {
                relativePath = 'assets/web-client-entry.js.map'
                this.outputChannel.appendLine(`[ServerHttp] Redirected sourcemap to: ${relativePath}`)
            } else if (specificAssets.includes(relativePath) || isChunk || isSourcemap) {
                relativePath = `assets/${relativePath}`
                this.outputChannel.appendLine(`[ServerHttp] Redirected ${relativePath.replace('assets/', '')} to: ${relativePath}`)
            }

            // 优先从build目录查找文件（构建后的文件在 webview-ui/build）
            let filePath = path.join(this.extensionUri.fsPath, 'webview-ui', 'build', relativePath)

            this.outputChannel.appendLine(`[ServerHttp] Trying build path: ${filePath}`)

            // 如果build目录中不存在，尝试从webview-ui根目录查找（用于web-client.html等）
            if (!fs.existsSync(filePath)) {
                this.outputChannel.appendLine(`[ServerHttp] Build file not found, trying webview-ui root`)
                filePath = path.join(this.extensionUri.fsPath, 'webview-ui', relativePath)
                this.outputChannel.appendLine(`[ServerHttp] Trying root path: ${filePath}`)
            }

            // 安全检查：确保文件在允许的目录内
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
                res.end(`File Not Found: ${pathname}`)
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
            this.outputChannel.appendLine(`[ServerHttp] Error serving static file ${pathname}: ${error}`)
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
                case 'network-info':
                    await this.handleNetworkInfoApi(req, res)
                    break
                default:
                    res.writeHead(404, { 'Content-Type': 'application/json' })
                    res.end(JSON.stringify({ error: 'API endpoint not found' }))
            }
        } catch (error) {
            this.outputChannel.appendLine(`[ServerHttp] API error for ${pathname}: ${error}`)
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Internal server error' }))
        }
    }

    private async handleStatusApi(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        const status = {
            server: 'running',
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            webSocketPort: this.webSocketPort
        }

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(status))
    }

    private async handleWebSocketInfoApi(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        const wsInfo = {
            enabled: true,
            port: this.port,
            url: `ws://localhost:${this.port}/ws`,
            clients: this.getConnectedClientsCount(),
            boundHost: this.host
        }

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(wsInfo))
    }

    private async handleNetworkInfoApi(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        const clientIP = this.getClientIP(req)
        const networkInterfaces = os.networkInterfaces()

        // 获取所有网络接口
        const interfaces: Array<{ name: string; addresses: Array<{ address: string; family: string; internal: boolean }> }> = []

        for (const [name, nets] of Object.entries(networkInterfaces)) {
            if (nets) {
                const addresses = nets.map((net: NetworkInterfaceInfo) => ({
                    address: net.address,
                    family: net.family,
                    internal: net.internal
                }))
                interfaces.push({ name, addresses })
            }
        }

        const networkInfo = {
            clientIP,
            serverBoundHost: this.host,
            serverPort: this.port,
            networkInterfaces: interfaces,
            webSocketUrl: `ws://localhost:${this.port}/ws`,
            externalWebSocketUrls: this.getExternalWebSocketUrls(),
            clients: this.getWebSocketClientInfo(),
            timestamp: new Date().toISOString()
        }

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(networkInfo, null, 2))
    }

    private getExternalWebSocketUrls(): string[] {
        if (this.host !== '0.0.0.0') {
            return []
        }

        const networkInterfaces = os.networkInterfaces()
        const urls: string[] = []

        for (const nets of Object.values(networkInterfaces)) {
            if (nets) {
                for (const net of nets) {
                    if (net.family === 'IPv4' && !net.internal) {
                        urls.push(`ws://${net.address}:${this.port}/ws`)
                    }
                }
            }
        }

        return urls
    }

  private async serveDevelopmentScript(req: http.IncomingMessage, res: http.ServerResponse, filePath: string): Promise<void> {
        try {
            // 对于开发环境，我们需要编译TypeScript/JSX文件
            // 这里使用一个简单的方案：返回一个错误，提示用户使用编译后的文件

            this.outputChannel.appendLine(`[ServerHttp] Development script requested: ${filePath}`)

            // 检查是否有对应的编译后文件
            const relativePath = path.relative(path.join(this.extensionUri.fsPath, 'webview-ui'), filePath)
            const buildPath = path.join(this.extensionUri.fsPath, 'webview-ui', 'build', 'assets', `${path.basename(filePath, path.extname(filePath))}.js`)

            if (fs.existsSync(buildPath)) {
                const content = await fs.promises.readFile(buildPath, 'utf-8')
                res.writeHead(200, {
                    'Content-Type': 'application/javascript',
                    'Cache-Control': 'no-cache'
                })
                res.end(content)
            } else {
                // 返回一个简单的错误页面或重定向到编译说明
                const errorContent = `
console.error('Development file not found: ${relativePath}');
console.error('Please run "npm run build" in the webview-ui directory to compile the frontend');
document.body.innerHTML = \`
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;">
        <h2>开发模式</h2>
        <p>前端文件尚未编译</p>
        <p>请在 webview-ui 目录中运行 "npm run build" 来编译前端</p>
        <button onclick="window.location.reload()" style="padding: 8px 16px; margin-top: 16px;">重新加载</button>
    </div>
\`;
                `
                res.writeHead(200, {
                    'Content-Type': 'application/javascript',
                    'Cache-Control': 'no-cache'
                })
                res.end(errorContent)
            }
        } catch (error) {
            this.outputChannel.appendLine(`[ServerHttp] Error serving development script ${filePath}: ${error}`)
            res.writeHead(500, { 'Content-Type': 'text/plain' })
            res.end('Error serving development script')
        }
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
                this.outputChannel.appendLine('[ServerHttp] Server stopped')
            })
            this.server = null
        }
    }

    async startWithWebSocket(messageHandler: WebSocketMessageHandler): Promise<void> {
        this.messageHandler = messageHandler
        await this.start()
    }

    getServerUrl(): string {
        const host = this.host === '0.0.0.0' ? 'localhost' : this.host
        return `http://${host}:${this.port}`
    }

    getPort(): number {
        return this.port
    }

    isRunning(): boolean {
        return this.server !== null && this.server.listening
    }

    setWebSocketOutputChannel(wsOutputChannel: any): void {
        this.wsOutputChannel = wsOutputChannel
    }

    private logWebSocket(message: string): void {
        if (this.wsOutputChannel) {
            this.wsOutputChannel.appendLine(message)
        }
        // 同时也在主输出通道记录重要信息
        this.outputChannel.appendLine(`[WebSocket] ${message}`)
    }

    getNetworkUrl(): string | null {
        if (this.host === '0.0.0.0') {
            // 获取本机IP地址
            const { networkInterfaces } = require('os')
            const nets = networkInterfaces()

            for (const name of Object.keys(nets)) {
                for (const net of nets[name] || []) {
                    // 跳过内部地址和非IPv4地址
                    if (net.family === 'IPv4' && !net.internal) {
                        return `http://${net.address}:${this.port}`
                    }
                }
            }
        }
        return null
    }

    /**
     * 获取客户端IP地址
     */
    private getClientIP(req: http.IncomingMessage): string {
        const remoteAddr = req.socket?.remoteAddress
        const forwardedFor = req.headers['x-forwarded-for']

        if (Array.isArray(remoteAddr)) {
            return remoteAddr[0]
        }
        if (remoteAddr) {
            return remoteAddr
        }
        if (Array.isArray(forwardedFor)) {
            return forwardedFor[0]
        }
        if (forwardedFor) {
            return forwardedFor
        }
        return 'unknown'
    }

    /**
     * 处理WebSocket升级
     */
    private async handleWebSocketUpgrade(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        try {
            const clientIP = this.getClientIP(req)
            const upgrade = req.headers.upgrade
            const connection = req.headers.connection
            const userAgent = req.headers['user-agent']
            const origin = req.headers['origin']

            // 详细日志记录
            this.logWebSocket(`WebSocket upgrade request from ${clientIP}`)
            this.logWebSocket(`Headers: upgrade=${upgrade}, connection=${connection}`)
            this.logWebSocket(`User-Agent: ${userAgent}`)
            this.logWebSocket(`Origin: ${origin}`)
            this.logWebSocket(`Server bound to: ${this.host}`)

            // 检查是否是WebSocket升级请求
            if (upgrade === 'websocket' && connection && connection.toLowerCase().includes('upgrade')) {
                this.logWebSocket(`Valid WebSocket upgrade request, proceeding with upgrade`)
                // 执行WebSocket升级
                this.upgradeWebSocket(req)
                return
            }

            // 如果不是WebSocket升级请求，返回详细信息
            this.logWebSocket(`Invalid WebSocket upgrade request - upgrade: ${upgrade}, connection: ${connection}`)
            res.writeHead(400, { 'Content-Type': 'text/plain' })
            res.end(`Bad Request: WebSocket upgrade required\nReceived: upgrade=${upgrade}, connection=${connection}\nClient: ${clientIP}`)
        } catch (error) {
            this.logWebSocket(`WebSocket upgrade error: ${error}`)
            res.writeHead(500, { 'Content-Type': 'text/plain' })
            res.end('Internal Server Error')
        }
    }

    /**
     * 升级WebSocket连接
     */
    private upgradeWebSocket(req: http.IncomingMessage): void {
        if (!this.server || !this.messageHandler) {
            return
        }

        // 获取客户端信息
        const clientIP = this.getClientIP(req)
        const userAgent = req.headers['user-agent']
        const origin = req.headers['origin']

        // 验证连接
        if (!this.validateWebSocketConnection(req, clientIP)) {
            this.logWebSocket(`WebSocket connection rejected from ${clientIP}`)
            req.socket.destroy()
            return
        }

        // 创建WebSocket服务器（如果还没有创建）
        if (!this.wss) {
            this.wss = new WebSocketServer({
                noServer: true,
                perMessageDeflate: false
            })
            this.setupWebSocketHandlers()
        }

        // 执行升级
        this.wss.handleUpgrade(req, req.socket, Buffer.alloc(0), (ws) => {
            this.logWebSocket(`WebSocket upgrade completed, readyState: ${ws.readyState}`)
            // 手动触发open事件，因为ws库可能不会自动触发
            setImmediate(() => {
                if (ws.readyState === 1) { // WebSocket.OPEN
                    ws.emit('open')
                }
            })
            this.handleWebSocketConnection(ws, clientIP, userAgent, origin)
        })
    }

    /**
     * 验证WebSocket连接
     */
    private validateWebSocketConnection(req: http.IncomingMessage, clientIP: string): boolean {
        try {
            this.logWebSocket(`Validating WebSocket connection from ${clientIP}, server bound to ${this.host}`)

            // 如果绑定到localhost，只允许本地连接
            if (this.host === 'localhost' || this.host === '127.0.0.1') {
                const isLocal = clientIP === '127.0.0.1' || clientIP === '::1' || clientIP === '::ffff:127.0.0.1'
                this.logWebSocket(`Localhost mode: clientIP=${clientIP}, isLocal=${isLocal}`)
                if (!isLocal) {
                    this.logWebSocket(`REJECTED: Non-local WebSocket connection ${clientIP} in localhost mode`)
                    return false
                }
            }

            // 如果绑定到0.0.0.0，允许所有连接
            if (this.host === '0.0.0.0') {
                this.logWebSocket(`ACCEPTED: WebSocket connection from ${clientIP} (network access mode)`)
                return true
            }

            this.logWebSocket(`ACCEPTED: WebSocket connection from ${clientIP} (host=${this.host})`)
            return true
        } catch (error) {
            this.logWebSocket(`ERROR: Validating WebSocket connection: ${error}`)
            return false
        }
    }

    /**
     * 设置WebSocket事件处理器
     */
    private setupWebSocketHandlers(): void {
        if (!this.wss) return

        this.wss.on('error', (error) => {
            this.logWebSocket(`WebSocket server error: ${error}`)
        })

        // 定期清理断开的连接
        setInterval(() => {
            this.cleanupDisconnectedClients()
        }, 30000) // 30秒清理一次
    }

    /**
     * 处理WebSocket连接
     */
    private handleWebSocketConnection(ws: any, ip: string, userAgent?: string, origin?: string): void {
        const clientId = this.generateClientId()
        const client: WebSocketClient = {
            id: clientId,
            ws,
            connected: true,
            lastActivity: Date.now(),
            ip,
            userAgent,
            origin
        }

        this.clients.set(clientId, client)
        this.logWebSocket(`WebSocket client connected: ${clientId} from ${ip}${origin ? ` (${origin})` : ''}`)
        this.logWebSocket(`WebSocket readyState: ${ws.readyState} (CONNECTING=0, OPEN=1, CLOSING=2, CLOSED=3)`)

        // 设置客户端事件处理器
        this.setupWebSocketClientHandlers(client)

        // 发送初始状态
        this.sendInitialState(client)
    }

    /**
     * 设置WebSocket客户端事件处理器
     */
    private setupWebSocketClientHandlers(client: WebSocketClient): void {
        client.ws.on('open', () => {
            this.logWebSocket(`WebSocket client OPENED: ${client.id} from ${client.ip}`)
        })

        client.ws.on('message', async (data: any) => {
            try {
                const message: WebviewMessage = JSON.parse(data.toString())
                client.lastActivity = Date.now()

                this.logWebSocket(`WebSocket message from ${client.id}: ${message.type}`)

                // 处理消息
                await this.handleWebSocketMessage(client, message)

            } catch (error) {
                this.logWebSocket(`Error handling WebSocket message: ${error}`)
            }
        })

        client.ws.on('close', (code: number, reason: Buffer) => {
            client.connected = false
            const closeReason = reason ? reason.toString('utf8') : 'Unknown'
            this.logWebSocket(`WebSocket client CLOSED: ${client.id} from ${client.ip} (code: ${code}, reason: ${closeReason})`)
            this.logWebSocket(`Close code meanings: 1000=normal, 1001=going away, 1002=protocol error, 1003=unsupported data, 1004=reserved, 1005=no status, 1006=abnormal`)
        })

        client.ws.on('error', (error: Error) => {
            client.connected = false
            this.logWebSocket(`WebSocket client ERROR ${client.id}: ${error}`)
        })

        client.ws.on('ping', (data: Buffer) => {
            this.logWebSocket(`WebSocket PING from ${client.id}: ${data.toString()}`)
        })

        client.ws.on('pong', (data: Buffer) => {
            this.logWebSocket(`WebSocket PONG from ${client.id}: ${data.toString()}`)
        })
    }

    /**
     * 处理WebSocket消息
     */
    private async handleWebSocketMessage(client: WebSocketClient, message: WebviewMessage): Promise<void> {
        if (!this.messageHandler) return

        try {
            this.logWebSocket(`Processing WebSocket message: ${message.type} from client ${client.id}`)

            // 消息处理器会通过 postMessageToWebview 自动广播响应，这里不需要再广播原始消息
            await this.messageHandler.handleMessage(message)

            this.logWebSocket(`Successfully processed message: ${message.type}`)
        } catch (error) {
            this.logWebSocket(`Error processing WebSocket message: ${error}`)
            // 发送错误响应
            this.sendWebSocketToClient(client, {
                type: 'error',
                text: `处理消息失败: ${error}`
            })
        }
    }

    /**
     * 发送初始状态给WebSocket客户端
     */
    private async sendInitialState(client: WebSocketClient): Promise<void> {
        this.logWebSocket(`Sending initial state to ${client.id}, ws.readyState: ${client.ws.readyState}`)

        if (this.messageHandler?.getCurrentState) {
            try {
                const state = await this.messageHandler.getCurrentState()
                this.logWebSocket(`Got state, sending to ${client.id}`)
                this.sendWebSocketToClient(client, {
                    type: 'state',
                    state
                })
                this.logWebSocket(`Initial state sent to ${client.id}`)
            } catch (error) {
                this.logWebSocket(`Error sending initial state: ${error}`)
            }
        } else {
            this.logWebSocket(`No messageHandler available for ${client.id}`)
        }
    }

    /**
     * 广播消息给所有WebSocket客户端
     */
    public broadcast(message: WebviewMessage): void {
        this.broadcastToWebSocketClients(message)
    }

    /**
     * 广播消息给所有WebSocket客户端
     */
    private broadcastToWebSocketClients(message: WebviewMessage): void {
        this.clients.forEach(client => {
            if (client.connected) {
                this.sendWebSocketToClient(client, message)
            }
        })
    }

    /**
     * 发送消息给特定WebSocket客户端
     */
    private sendWebSocketToClient(client: WebSocketClient, message: any): void {
        const readyState = client.ws.readyState
        const messageType = message.type || 'unknown'

        this.logWebSocket(`Sending ${messageType} to ${client.id}, connected: ${client.connected}, readyState: ${readyState}`)

        if (client.connected && readyState === 1) { // WebSocket.OPEN = 1
            try {
                const messageStr = JSON.stringify(message)
                client.ws.send(messageStr)
                this.logWebSocket(`Successfully sent ${messageType} to ${client.id}, size: ${messageStr.length}`)
            } catch (error) {
                this.logWebSocket(`ERROR sending to WebSocket client ${client.id}: ${error}`)
                client.connected = false
            }
        } else {
            this.logWebSocket(`Cannot send ${messageType} to ${client.id}: not connected (${client.connected}) or not ready (${readyState})`)
        }
    }

    /**
     * 清理断开的WebSocket客户端
     */
    private cleanupDisconnectedClients(): void {
        const now = Date.now()
        this.clients.forEach((client, id) => {
            if (!client.connected || (now - client.lastActivity > 300000)) { // 5分钟超时
                if (client.ws.readyState === 1) { // WebSocket.OPEN = 1
                    client.ws.close()
                }
                this.clients.delete(id)
                this.logWebSocket(`Cleaned up WebSocket client: ${id}`)
            }
        })
    }

    /**
     * 生成客户端ID
     */
    private generateClientId(): string {
        return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }

    /**
     * 获取连接的WebSocket客户端数量
     */
    public getConnectedClientsCount(): number {
        return Array.from(this.clients.values()).filter(client => client.connected).length
    }

    /**
     * 获取WebSocket客户端信息
     */
    public getWebSocketClientInfo(): Array<{ id: string; connected: boolean; lastActivity: number; ip: string; origin?: string }> {
        return Array.from(this.clients.values()).map(client => ({
            id: client.id,
            connected: client.connected,
            lastActivity: client.lastActivity,
            ip: client.ip,
            origin: client.origin
        }))
    }
}