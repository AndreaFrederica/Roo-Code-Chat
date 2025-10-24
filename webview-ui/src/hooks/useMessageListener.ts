import { useEffect, useCallback } from "react"
import { vscode } from "@/utils/vscode"
import { isWebClient } from "@/utils/web-client-compat"

/**
 * 统一处理 VSCode 扩展环境和 Web 客户端环境的消息监听
 *
 * @param messageTypes 需要监听的消息类型数组
 * @param handler 消息处理函数
 * @param dependencies 依赖数组，当依赖变化时会重新设置监听器
 */
export const useMessageListener = (
	messageTypes: string[],
	handler: (message: any) => void,
	dependencies: any[] = []
) => {
	// 使用 useCallback 包装处理函数，避免不必要的重新创建
	const stableHandler = useCallback(handler, dependencies)

	useEffect(() => {
		// Window 消息监听器（VSCode 扩展环境）
		const handleWindowMessage = (event: MessageEvent) => {
			const message = event.data
			const messageType = message?.type
			const shouldHandle =
				messageTypes.includes("*") || (typeof messageType === "string" && messageTypes.includes(messageType))

			if (shouldHandle) {
				stableHandler(message)
			}
		}

		// 设置监听器
		window.addEventListener("message", handleWindowMessage)

		// 在 Web 客户端环境中，还需要监听 WebSocket 消息
		const cleanupFunctions: (() => void)[] = []
		if (isWebClient()) {
			messageTypes.forEach(messageType => {
				// Allow wildcard subscriptions for consistency with VS Code window messaging
				const cleanup = vscode.onMessage(messageType, stableHandler)
				cleanupFunctions.push(cleanup)
			})
		}

		return () => {
			window.removeEventListener("message", handleWindowMessage)
			cleanupFunctions.forEach(cleanup => cleanup())
		}
	}, [messageTypes, stableHandler])
}

/**
 * 简化版本：监听单个消息类型
 *
 * @param messageType 消息类型
 * @param handler 消息处理函数
 * @param dependencies 依赖数组
 */
export const useSingleMessageListener = (
	messageType: string,
	handler: (message: any) => void,
	dependencies: any[] = []
) => {
	return useMessageListener([messageType], handler, dependencies)
}

/**
 * VSCode 专用消息监听器（只在扩展环境中工作）
 *
 * @param handler 消息处理函数
 * @param dependencies 依赖数组
 */
export const useVSCodeMessageListener = (
	handler: (message: any) => void,
	dependencies: any[] = []
) => {
	useEffect(() => {
		if (isWebClient()) {
			// Web 客户端环境不使用此监听器
			return
		}

		const handleWindowMessage = (event: MessageEvent) => {
			handler(event.data)
		}

		window.addEventListener("message", handleWindowMessage)

		return () => {
			window.removeEventListener("message", handleWindowMessage)
		}
	}, [handler, ...dependencies])
}

/**
 * Web 客户端专用消息监听器（只在 Web 环境中工作）
 *
 * @param messageTypes 需要监听的消息类型数组
 * @param handler 消息处理函数
 * @param dependencies 依赖数组
 */
export const useWebClientMessageListener = (
	messageTypes: string[],
	handler: (message: any) => void,
	dependencies: any[] = []
) => {
	useEffect(() => {
		if (!isWebClient()) {
			// VSCode 扩展环境不使用此监听器
			return
		}

		const cleanupFunctions: (() => void)[] = []
		messageTypes.forEach(messageType => {
			const cleanup = vscode.onMessage(messageType, handler)
			cleanupFunctions.push(cleanup)
		})

		return () => {
			cleanupFunctions.forEach(cleanup => cleanup())
		}
	}, [messageTypes, handler, ...dependencies])
}

/**
 * 通用消息监听器 - 监听所有消息类型
 * 这是最强大的监听器，可以捕获所有类型的消息，适用于需要处理多种消息类型的组件
 *
 * @param handler 消息处理函数，接收所有消息
 * @param options 可选配置
 */
export const useUniversalMessageListener = (
	handler: (message: any) => void,
	options?: {
		/** 是否过滤无效消息，默认 true */
		filterInvalid?: boolean
		/** 是否启用调试模式，默认 false */
		debug?: boolean
		/** 自定义消息过滤函数 */
		messageFilter?: (message: any) => boolean
	}
) => {
	const { filterInvalid = true, debug = false, messageFilter } = options || {}

	useEffect(() => {
		// Window 消息监听器（VSCode 扩展环境）
		const handleWindowMessage = (event: MessageEvent) => {
			const message = event.data

			// 过滤无效消息
			if (filterInvalid && (!message || typeof message !== 'object')) {
				if (debug) {
					console.log('[UniversalMessageListener] Filtered invalid message:', message)
				}
				return
			}

			// 应用自定义过滤器
			if (messageFilter && !messageFilter(message)) {
				if (debug) {
					console.log('[UniversalMessageListener] Message filtered by custom filter:', message)
				}
				return
			}

			if (debug) {
				console.log('[UniversalMessageListener] Received message:', message)
			}

			handler(message)
		}

		// 设置 Window 监听器
		window.addEventListener("message", handleWindowMessage)

		// 在 Web 客户端环境中，还需要监听 WebSocket 消息
		const cleanupFunctions: (() => void)[] = []
		if (isWebClient()) {
			// 监听所有消息类型
			const cleanup = vscode.onMessage("*", handler)
			cleanupFunctions.push(cleanup)
		}

		if (debug) {
			console.log('[UniversalMessageListener] Listener setup complete', {
				isWebClient: isWebClient(),
				filterInvalid,
				hasCustomFilter: !!messageFilter
			})
		}

		return () => {
			window.removeEventListener("message", handleWindowMessage)
			cleanupFunctions.forEach(cleanup => cleanup())

			if (debug) {
				console.log('[UniversalMessageListener] Listener cleaned up')
			}
		}
	}, [handler, filterInvalid, debug, messageFilter])
}

/**
 * 临时消息监听器接口
 */
export interface TemporaryListener<T = any> {
	/** 等待消息的Promise */
	promise: Promise<T>
	/** 手动清理监听器 */
	cleanup: () => void
	/** 检查监听器是否仍然活跃 */
	isActive: () => boolean
}

/**
 * 临时消息监听器 - 跨环境的一次性消息监听
 * 这个函数提供了一个临时监听器，可以在异步操作中使用，支持手动注册和卸载
 *
 * @param messageTypes 要监听的消息类型数组
 * @param options 可选配置
 * @returns TemporaryListener对象，包含promise和cleanup方法
 */
export const createTemporaryListener = <T = any>(
	messageTypes: string[],
	options?: {
		/** 超时时间（毫秒），默认不超时 */
		timeout?: number
		/** 是否为一次性监听器，默认true */
		once?: boolean
		/** 是否启用调试模式 */
		debug?: boolean
	}
): TemporaryListener<T> => {
	const { timeout, once = true, debug = false } = options || {}

	let isActive = true
	let timeoutId: NodeJS.Timeout | null = null
	let isResolved = false

	// Window消息监听器（VSCode 扩展环境）
	const handleWindowMessage = (event: MessageEvent) => {
		if (!isActive) return

		const message = event.data
		const messageType = message?.type
		const shouldHandle =
			messageTypes.includes("*") || (typeof messageType === "string" && messageTypes.includes(messageType))

		if (debug) {
			console.log('[TemporaryListener] Received message:', {
				message,
				messageType,
				shouldHandle,
				isActive
			})
		}

		if (shouldHandle) {
			if (once) {
				cleanup()
			}
			if (!isResolved) {
				isResolved = true
				;(resolve as any)(message as T)
			}
		}
	}

	// 设置监听器
	window.addEventListener("message", handleWindowMessage)

	// 在 Web 客户端环境中，还需要监听 WebSocket 消息
	const cleanupFunctions: (() => void)[] = []
	if (isWebClient()) {
		messageTypes.forEach(messageType => {
			const cleanup = vscode.onMessage(messageType, (message: any) => {
				if (!isActive) return

				const shouldHandle =
					messageTypes.includes("*") || (typeof message?.type === "string" && messageTypes.includes(message.type))

				if (debug) {
					console.log('[TemporaryListener] WebSocket received message:', {
						message,
						messageType,
						shouldHandle,
						isActive
					})
				}

				if (shouldHandle) {
					if (once) {
						cleanup()
					}
					if (!isResolved) {
						isResolved = true
						;(resolve as any)(message as T)
					}
				}
			})
			cleanupFunctions.push(cleanup)
		})
	}

	// 清理函数
	const cleanup = () => {
		if (!isActive) return

		isActive = false

		if (timeoutId) {
			clearTimeout(timeoutId)
			timeoutId = null
		}

		window.removeEventListener("message", handleWindowMessage)
		cleanupFunctions.forEach(cleanup => cleanup())

		if (debug) {
			console.log('[TemporaryListener] Listener cleaned up for messageTypes:', messageTypes)
		}
	}

	// Promise处理器
	let resolve: (value: T) => void
	let reject: (reason?: any) => void

	const promise = new Promise<T>((res, rej) => {
		resolve = res
		reject = rej

		// 设置超时（如果指定）
		if (timeout && timeout > 0) {
			timeoutId = setTimeout(() => {
				if (isActive && !isResolved) {
					cleanup()
					reject(new Error(`Timeout waiting for message: ${messageTypes.join(', ')}`))
				}
			}, timeout)
		}
	})

	if (debug) {
		console.log('[TemporaryListener] Listener created for messageTypes:', messageTypes, {
			timeout,
			once,
			isWebClient: isWebClient()
		})
	}

	return {
		promise,
		cleanup,
		isActive: () => isActive
	}
}
