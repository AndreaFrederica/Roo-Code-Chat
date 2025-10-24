import * as vscode from "vscode"
import * as http from 'http'
import * as fs from 'fs'
import * as path from 'path'
import * as url from 'url'

export class ServerHttp {
    private server: http.Server | null = null
    private port: number
    private webSocketPort: number
    private extensionUri: vscode.Uri
    private outputChannel: vscode.OutputChannel

    constructor(
        extensionUri: vscode.Uri,
        outputChannel: vscode.OutputChannel,
        port: number = 3002,
        webSocketPort: number = 3001
    ) {
        this.extensionUri = extensionUri
        this.outputChannel = outputChannel
        this.port = port
        this.webSocketPort = webSocketPort
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
                    this.outputChannel.appendLine(`[ServerHttp] Server started on http://localhost:${this.port}`)
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
            this.outputChannel.appendLine(`[ServerHttp] Failed to start server: ${error}`)
            vscode.window.showErrorMessage(`Web服务器启动失败: ${error}`)
            throw error
        }
    }

    private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        try {
            const parsedUrl = url.parse(req.url || '/', true)
            const pathname = parsedUrl.pathname || '/'

            this.outputChannel.appendLine(`[ServerHttp] Request: ${req.method} ${pathname}`)

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

        const bootstrapScript = `
    <script type="module">
        const sources = [
            "/web-client-entry.js",
            "/assets/index.js",
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
                bootstrapScript.trim(),
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

            // 特殊处理 web-client-entry.js 映射到 assets/index.js
            if (relativePath === 'web-client-entry.js') {
                relativePath = 'assets/index.js'
                this.outputChannel.appendLine(`[ServerHttp] Redirected web-client-entry.js to: ${relativePath}`)
            }
            // 特殊处理sourcemap文件名称转换
            else if (relativePath === 'web-client-entry.map.json' || relativePath === 'web-client-entry.sourcemap' || relativePath === 'web-client-entry.js.map') {
                relativePath = 'assets/index.js.map'
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
            port: this.webSocketPort,
            url: `ws://localhost:${this.webSocketPort}`
        }

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(wsInfo))
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

    isRunning(): boolean {
        return this.server !== null && this.server.listening
    }

    getServerUrl(): string {
        return `http://localhost:${this.port}`
    }
}