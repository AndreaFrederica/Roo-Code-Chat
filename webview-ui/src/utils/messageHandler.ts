/**
 * 独立的消息封包拆包处理器
 * 用于处理前后端通信的消息格式化
 */

export interface MessageEnvelope {
	type: string
	data?: any
	timestamp?: number
	id?: string
}

export interface MessageHandler {
	// 消息封包
	packMessage: (type: string, data?: any) => MessageEnvelope

	// 消息拆包
	unpackMessage: (envelope: MessageEnvelope) => { type: string; data?: any }

	// 发送消息到vscode
	sendMessage: (type: string, data?: any) => void

	// 处理接收到的消息
	onMessage: (envelope: MessageEnvelope) => void
}

/**
 * 创建消息处理器实例
 */
export function createMessageHandler(): MessageHandler {
	// 消息封包函数
	const packMessage = (type: string, data?: any): MessageEnvelope => {
		return {
			type,
			data,
			timestamp: Date.now(),
			id: Math.random().toString(36).substr(2, 9)
		}
	}

	// 消息拆包函数
	const unpackMessage = (envelope: MessageEnvelope): { type: string; data?: any } => {
		return {
			type: envelope.type,
			data: envelope.data
		}
	}

	// 发送消息到vscode
	const sendMessage = (type: string, data?: any): void => {
		const envelope = packMessage(type, data)
		// 这里假设vscode对象已经全局可用
		if (typeof window !== 'undefined' && (window as any).vscode) {
			;(window as any).vscode.postMessage(envelope)
		}
	}

	// 处理接收到的消息
	const onMessage = (envelope: MessageEnvelope): void => {
		const { type, data } = unpackMessage(envelope)
		console.log(`Received message: ${type}`, data)
		// 可以在这里添加具体的消息处理逻辑
	}

	return {
		packMessage,
		unpackMessage,
		sendMessage,
		onMessage
	}
}

/**
 * 默认的消息处理器实例
 */
export const messageHandler = createMessageHandler()

/**
 * 便捷函数：发送消息
 */
export const sendMessage = (type: string, data?: any) => {
	messageHandler.sendMessage(type, data)
}

/**
 * 便捷函数：处理消息
 */
export const handleIncomingMessage = (envelope: MessageEnvelope) => {
	messageHandler.onMessage(envelope)
}