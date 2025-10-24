import * as vscode from "vscode"
import * as os from 'os'

/**
 * 网络配置工具类
 */
export class NetworkUtils {
    /**
     * 解析服务器绑定主机配置
     * @param bindHost 配置的主机地址
     * @returns 解析后的实际绑定地址
     */
    static parseBindHost(bindHost: string): string {
        // 处理localhost
        if (bindHost === 'localhost' || bindHost === '127.0.0.1') {
            return '127.0.0.1'
        }

        // 处理0.0.0.0（绑定所有接口）
        if (bindHost === '0.0.0.0') {
            return '0.0.0.0'
        }

        // 处理网段配置 (如 192.168.1.0/24)
        if (bindHost.includes('/')) {
            return this.resolveNetworkSegment(bindHost)
        }

        // 处理具体IP地址
        if (this.isValidIP(bindHost)) {
            return bindHost
        }

        // 默认返回localhost
        vscode.window.showWarningMessage(`无效的服务器绑定地址: ${bindHost}，将使用localhost`)
        return '127.0.0.1'
    }

    /**
     * 解析网段配置，返回本机在该网段内的第一个可用IP
     * @param networkSegment 网段配置，如 "192.168.1.0/24"
     * @returns 绑定的IP地址
     */
    private static resolveNetworkSegment(networkSegment: string): string {
        try {
            const [networkIP, cidr] = networkSegment.split('/')
            const networkBase = networkIP.substring(0, networkIP.lastIndexOf('.')) + '.'

            // 获取本机所有网络接口
            const networkInterfaces = os.networkInterfaces()

            for (const interfaceName of Object.keys(networkInterfaces)) {
                const interfaces = networkInterfaces[interfaceName] || []

                for (const net of interfaces) {
                    // 只考虑IPv4且非内部地址
                    if (net.family === 'IPv4' && !net.internal && net.address) {
                        // 检查IP是否在指定网段内
                        if (net.address.startsWith(networkBase)) {
                            return net.address
                        }
                    }
                }
            }

            vscode.window.showWarningMessage(`未找到在网段 ${networkSegment} 内的可用IP地址，将使用localhost`)
            return '127.0.0.1'

        } catch (error) {
            vscode.window.showWarningMessage(`解析网段配置失败: ${networkSegment}，错误: ${error}`)
            return '127.0.0.1'
        }
    }

    /**
     * 验证IP地址格式
     * @param ip IP地址字符串
     * @returns 是否为有效的IP地址
     */
    static isValidIP(ip: string): boolean {
        const ipRegex = /^([0-9]{1,3}\.){3}[0-9]{1,3}$/
        if (!ipRegex.test(ip)) {
            return false
        }

        const parts = ip.split('.')
        for (const part of parts) {
            const num = parseInt(part, 10)
            if (num < 0 || num > 255) {
                return false
            }
        }

        return true
    }

    /**
     * 获取服务器的访问URL列表
     * @param bindHost 绑定主机
     * @param port 端口
     * @returns 可访问的URL列表
     */
    static getServerUrls(bindHost: string, port: number): Array<{ type: string; url: string }> {
        const urls: Array<{ type: string; url: string }> = []
        const protocol = 'http'

        // 本地访问URL
        const localHost = bindHost === '0.0.0.0' ? 'localhost' : bindHost
        urls.push({
            type: '本地访问',
            url: `${protocol}://${localHost}:${port}`
        })

        // 如果绑定到0.0.0.0，提供网络访问URL
        if (bindHost === '0.0.0.0') {
            const networkInterfaces = os.networkInterfaces()

            for (const interfaceName of Object.keys(networkInterfaces)) {
                const interfaces = networkInterfaces[interfaceName] || []

                for (const net of interfaces) {
                    if (net.family === 'IPv4' && !net.internal && net.address) {
                        urls.push({
                            type: `网络访问 (${interfaceName})`,
                            url: `${protocol}://${net.address}:${port}`
                        })
                        break // 每个接口只取一个IP
                    }
                }
            }
        }

        return urls
    }

    /**
     * 获取WebSocket服务器的访问URL列表
     * @param bindHost 绑定主机
     * @param port 端口
     * @returns 可访问的WebSocket URL列表
     */
    static getWebSocketUrls(bindHost: string, port: number): Array<{ type: string; url: string }> {
        const urls = this.getServerUrls(bindHost, port)
        return urls.map(item => ({
            ...item,
            url: item.url.replace('http://', 'ws://') + '/ws'
        }))
    }

    /**
     * 显示服务器访问信息
     * @param bindHost 绑定主机
     * @param httpPort HTTP端口
     * @param wsPort WebSocket端口
     */
    static showServerAccessInfo(bindHost: string, httpPort: number, wsPort: number, outputChannel: vscode.OutputChannel): void {
        const httpUrls = this.getServerUrls(bindHost, httpPort)
        const wsUrls = this.getWebSocketUrls(bindHost, wsPort)

        outputChannel.appendLine('\n=== 服务器访问信息 ===')
        outputChannel.appendLine(`绑定地址: ${bindHost}`)

        outputChannel.appendLine('\nHTTP服务器访问地址:')
        httpUrls.forEach(url => {
            outputChannel.appendLine(`  ${url.type}: ${url.url}`)
        })

        outputChannel.appendLine('\nWebSocket服务器访问地址:')
        wsUrls.forEach(url => {
            outputChannel.appendLine(`  ${url.type}: ${url.url}`)
        })

        outputChannel.appendLine('==================\n')
    }
}