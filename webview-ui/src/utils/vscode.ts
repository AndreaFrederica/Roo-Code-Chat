import type { WebviewApi } from "vscode-webview"

import { WebviewMessage } from "@roo/WebviewMessage"
import { WebSocketAdapter } from "./websocket-adapter"
import { messageTracer } from "./message-tracer"

// 延迟检测是否在独立浏览器环境，确保DOM加载完成
let isStandaloneBrowser: boolean = false
let wsAdapter: WebSocketAdapter | null = null
const pendingMessageSubscriptions: Array<{ type: string; handler: Function }> = []
const pendingConnectionListeners: Array<(connected: boolean) => void> = []
const ADAPTER_POLL_INTERVAL = 100

// 全局存储VSCode API实例，避免循环引用
let globalVsCodeApi: WebviewApi<unknown> | null = null

const queuePendingMessageSubscription = (type: string, handler: Function) => {
	pendingMessageSubscriptions.push({ type, handler })
}

const removePendingMessageSubscription = (type: string, handler: Function) => {
	const index = pendingMessageSubscriptions.findIndex(
		(subscription) => subscription.type === type && subscription.handler === handler,
	)
	if (index !== -1) {
		pendingMessageSubscriptions.splice(index, 1)
	}
}

const flushPendingMessageSubscriptions = () => {
	if (!wsAdapter || pendingMessageSubscriptions.length === 0) {
		return
	}

	const subscriptions = pendingMessageSubscriptions.splice(0, pendingMessageSubscriptions.length)
	for (const { type, handler } of subscriptions) {
		wsAdapter.onMessage(type, handler)
	}
}

const queuePendingConnectionListener = (handler: (connected: boolean) => void) => {
	pendingConnectionListeners.push(handler)
}

const removePendingConnectionListener = (handler: (connected: boolean) => void) => {
	const index = pendingConnectionListeners.findIndex((listener) => listener === handler)
	if (index !== -1) {
		pendingConnectionListeners.splice(index, 1)
	}
}

const flushPendingConnectionListeners = () => {
	if (!wsAdapter || pendingConnectionListeners.length === 0) {
		return
	}

	const listeners = pendingConnectionListeners.splice(0, pendingConnectionListeners.length)
	for (const handler of listeners) {
		wsAdapter.onConnectionStatusChange(handler)
		handler(wsAdapter.isConnected())
	}
}

const ensureAdapter = (): WebSocketAdapter | null => {
	if (wsAdapter) {
		return wsAdapter
	}

	const globalAdapter = (window as any).__webClientWebSocketAdapter as WebSocketAdapter | undefined
	if (globalAdapter) {
		wsAdapter = globalAdapter
		flushPendingMessageSubscriptions()
		flushPendingConnectionListeners()
		return wsAdapter
	}

	return null
}

function initializeEnvironment() {
    // 更准确的环境检测
    const hasVsCodeApi = typeof (window as any).acquireVsCodeApi === "function"
    const hasWebSocketAdapter = !!(window as any).__webClientWebSocketAdapter

    console.log('[VSCode API] Environment detection:', {
        hasVsCodeApi,
        hasWebSocketAdapter,
        documentReadyState: document.readyState
    })

    // 优先检测VSCode环境
    if (hasVsCodeApi) {
        isStandaloneBrowser = false
        console.log('[VSCode API] Running in VS Code webview mode')

        // 直接获取并存储VSCode API到全局变量
        try {
            const api = (window as any).acquireVsCodeApi()
            globalVsCodeApi = api
            console.log('[VSCode API] VSCode API stored for later use')
        } catch (error) {
            console.error('[VSCode API] Failed to acquire VSCode API:', error)
        }

        wsAdapter = null
        return
    }

    // 如果没有VSCode API但有WebSocket adapter，认为是独立浏览器模式
    if (hasWebSocketAdapter) {
        isStandaloneBrowser = true
        console.log('[VSCode API] Running in standalone browser mode')

        const adapter = ensureAdapter()
        if (!adapter) {
            console.log('[VSCode API] WebSocket adapter not ready, waiting...')
            setTimeout(initializeEnvironment, ADAPTER_POLL_INTERVAL)
            return
        }

        wsAdapter = adapter
        console.log('[VSCode API] Found WebSocket adapter:', !!wsAdapter, wsAdapter?.isConnected?.())
        return
    }

    // 如果都没有，可能是正在加载，继续等待
    console.log('[VSCode API] Environment not ready, waiting...')
    setTimeout(initializeEnvironment, ADAPTER_POLL_INTERVAL)
}

// 如果DOM已经加载完成，立即初始化；否则等待DOM加载
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeEnvironment)
} else {
    initializeEnvironment()
}

/**
 * A utility wrapper around the acquireVsCodeApi() function, which enables
 * message passing and state management between the webview and extension
 * contexts.
 *
 * This utility also enables webview code to be run in a web browser-based
 * dev server by using native web browser features that mock the functionality
 * enabled by acquireVsCodeApi.
 */
class VSCodeAPIWrapper {
	private vsCodeApi: WebviewApi<unknown> | undefined
	private isInitialized = false

	constructor() {
		// 不在构造函数中立即初始化，等待环境检测完成
		console.log('[VSCode API] VSCodeAPIWrapper constructed, waiting for environment detection')
	}

	/**
	 * 尝试初始化VSCode API（仅在VSCode环境中）
	 */
	public tryInitializeVsCodeApi() {
		if (this.isInitialized) {
			return
		}

		try {
			// 优先使用全局存储的VSCode API实例
			if (globalVsCodeApi) {
				this.vsCodeApi = globalVsCodeApi
				console.log('[VSCode API] Using global VSCode API instance')
			}
			// 如果没有全局实例，但在VSCode环境中，尝试直接获取
			else if (!isStandaloneBrowser && typeof (window as any).acquireVsCodeApi === "function") {
				this.vsCodeApi = (window as any).acquireVsCodeApi()
				if (this.vsCodeApi) {
					globalVsCodeApi = this.vsCodeApi // 存储到全局变量
					console.log('[VSCode API] VSCode API initialized successfully')
				}
			} else {
				console.log('[VSCode API] Not in VSCode environment or acquireVsCodeApi not available')
			}
		} catch (error) {
			console.error('[VSCode API] Failed to initialize VSCode API:', error)
		}

		this.isInitialized = true
	}

	/**
	 * Post a message (i.e. send arbitrary data) to the owner of the webview.
	 *
	 * @remarks When running webview code inside a web browser, postMessage will instead
	 * log the given message to the console.
	 *
	 * @param message Arbitrary data (must be JSON serializable) to send to the extension context.
	 */
	public postMessage(message: WebviewMessage) {
		messageTracer.logOutgoing(message, 'VSCodeAPIWrapper')

		// 确保API已初始化
		if (!this.isInitialized) {
			this.tryInitializeVsCodeApi()
		}

		console.log('[VSCode API] postMessage called:', {
			isStandaloneBrowser,
			hasVsCodeApi: !!this.vsCodeApi,
			hasWsAdapter: !!wsAdapter,
			messageType: message.type
		})

		// 优先使用VSCode API（如果在VSCode环境中）
		if (this.vsCodeApi) {
			console.log('[VSCode API] Using native VSCode API to post message')
			this.vsCodeApi.postMessage(message)
			return
		}

		// 如果没有VSCode API，但在独立浏览器环境且有WebSocket adapter
		if (isStandaloneBrowser && wsAdapter) {
			console.log('[VSCode API] Using WebSocket adapter to post message')
			wsAdapter.postMessage(message)
			return
		}

		// 最后的fallback
		console.log('[VSCode API] Fallback: logging message to console', message)
	}

	/**
	 * Get the persistent state stored for this webview.
	 *
	 * @remarks When running webview source code inside a web browser, getState will retrieve state
	 * from local storage (https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage).
	 *
	 * @return The current state or `undefined` if no state has been set.
	 */
	public getState(): unknown | undefined {
		if (this.vsCodeApi) {
			return this.vsCodeApi.getState()
		} else {
			const state = localStorage.getItem("vscodeState")
			return state ? JSON.parse(state) : undefined
		}
	}

	/**
	 * Set the persistent state stored for this webview.
	 *
	 * @remarks When running webview source code inside a web browser, setState will set the given
	 * state using local storage (https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage).
	 *
	 * @param newState New persisted state. This must be a JSON serializable object. Can be retrieved
	 * using {@link getState}.
	 *
	 * @return The new state.
	 */
	public setState<T extends unknown | undefined>(newState: T): T {
		if (this.vsCodeApi) {
			return this.vsCodeApi.setState(newState)
		} else {
			localStorage.setItem("vscodeState", JSON.stringify(newState))
			return newState
		}
	}

	/**
	 * Add a message listener for WebSocket messages in standalone browser mode
	 */
	public onMessage(type: string, handler: Function): () => void {
		if (!isStandaloneBrowser) {
			return () => {}
		}

		const adapter = ensureAdapter()
		if (adapter) {
			adapter.onMessage(type, handler)
			return () => adapter.offMessage(type, handler)
		}

		queuePendingMessageSubscription(type, handler)
		setTimeout(initializeEnvironment, ADAPTER_POLL_INTERVAL)

		return () => {
			const activeAdapter = ensureAdapter()
			if (activeAdapter) {
				activeAdapter.offMessage(type, handler)
			} else {
				removePendingMessageSubscription(type, handler)
			}
		}
	}

	/**
	 * Remove a message listener
	 */
	public offMessage(type: string, handler: Function): void {
		if (!isStandaloneBrowser) {
			return
		}

		const adapter = ensureAdapter()
		if (adapter) {
			adapter.offMessage(type, handler)
		} else {
			removePendingMessageSubscription(type, handler)
		}
	}

	/**
	 * Check if connected to WebSocket server (in standalone browser mode)
	 */
	public isConnected(): boolean {
		return isStandaloneBrowser ? wsAdapter?.isConnected() ?? false : true
	}

	public isStandaloneMode(): boolean {
		// 更可靠的检测：检查是否有WebSocket适配器或没有VSCode API
		const hasVsCodeApi = typeof (window as any).acquireVsCodeApi === "function"
		const hasWebSocketAdapter = !!(window as any).__webClientWebSocketAdapter
		return !hasVsCodeApi && hasWebSocketAdapter
	}

	public onConnectionStatusChange(handler: (connected: boolean) => void): () => void {
		if (!isStandaloneBrowser) {
			handler(true)
			return () => {}
		}

		const adapter = ensureAdapter()
		if (adapter) {
			adapter.onConnectionStatusChange(handler)
			handler(adapter.isConnected())
			return () => adapter.offConnectionStatusChange(handler)
		}

		queuePendingConnectionListener(handler)
		setTimeout(initializeEnvironment, ADAPTER_POLL_INTERVAL)

		return () => {
			const activeAdapter = ensureAdapter()
			if (activeAdapter) {
				activeAdapter.offConnectionStatusChange(handler)
			} else {
				removePendingConnectionListener(handler)
			}
		}
	}
}

// Exports class singleton to prevent multiple invocations of acquireVsCodeApi.
// 简单的延迟初始化模式
let vscodeInstance: VSCodeAPIWrapper | null = null

function getVscodeInstance(): VSCodeAPIWrapper {
  if (!vscodeInstance) {
    vscodeInstance = new VSCodeAPIWrapper()
  }
  return vscodeInstance
}

export const vscode = getVscodeInstance()

// 为了向后兼容，导出一个包含原有API的对象（仅在需要时）
export const vscodeAPI = {
	// 在VS Code环境中，直接使用原有的vscode实例
	...(isStandaloneBrowser ? {} : {
		postMessage: (message: WebviewMessage) => {
			vscode.postMessage(message)
		},
		getState: () => vscode.getState(),
		setState: (state: any) => vscode.setState(state)
	}),

	// 在独立浏览器环境中，重写postMessage
	...(isStandaloneBrowser ? {
		postMessage: (message: WebviewMessage) => {
			if (wsAdapter) {
				wsAdapter.postMessage(message)
			}
		}
	} : {}),

	// 添加额外的方法
	onMessage: (type: string, handler: Function) => vscode.onMessage(type, handler),
	isConnected: () => vscode.isConnected(),
	isStandaloneMode: () => vscode.isStandaloneMode(),
	onConnectionStatusChange: (handler: (connected: boolean) => void) => vscode.onConnectionStatusChange(handler),
}

// 初始化环境检测
initializeEnvironment()
