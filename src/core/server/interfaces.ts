import { WebviewMessage } from "../../shared/WebviewMessage"

/**
 * WebSocket消息处理器接口
 * 用于解耦WebSocket服务器和具体的消息处理逻辑
 */
export interface WebSocketMessageHandler {
	/**
	 * 处理来自WebSocket客户端的消息
	 */
	handleMessage(message: WebviewMessage): Promise<void>

	/**
	 * 获取当前状态，用于发送给新连接的客户端
	 */
	getCurrentState?(): Promise<any>
}

/**
 * 服务器配置接口
 */
export interface ServerConfig {
	webSocketPort: number
	httpPort: number
	enableWebSocket: boolean
	autoStart: boolean
	bindHost: string
}