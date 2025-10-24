import type { WebviewApi } from "vscode-webview"

import { WebviewMessage } from "@roo/WebviewMessage"
import { WebSocketAdapter } from "./websocket-adapter"

// 延迟检测是否在独立浏览器环境，确保DOM加载完成
let isStandaloneBrowser: boolean = false
let wsAdapter: WebSocketAdapter | null = null
const pendingMessageSubscriptions: Array<{ type: string; handler: Function }> = []
const pendingConnectionListeners: Array<(connected: boolean) => void> = []
const ADAPTER_POLL_INTERVAL = 100

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
    // 检查是否有 acquireVsCodeApi 函数
    isStandaloneBrowser = typeof (window as any).acquireVsCodeApi !== "function"

	if (isStandaloneBrowser) {
		console.log('[VSCode API] Running in standalone browser mode, using existing WebSocket adapter')

		const adapter = ensureAdapter()
		if (!adapter) {
			console.log('[VSCode API] WebSocket adapter not ready, waiting...')
			setTimeout(initializeEnvironment, ADAPTER_POLL_INTERVAL)
			return
		}

		wsAdapter = adapter
		console.log('[VSCode API] Found WebSocket adapter:', !!wsAdapter, wsAdapter?.isConnected?.())
	} else {
        console.log('[VSCode API] Running in VS Code webview mode - no WebSocket adapter')
        // 确保WebSocket适配器不被创建
        wsAdapter = null
    }
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
	private readonly vsCodeApi: WebviewApi<unknown> | undefined

	constructor() {
		// Check if the acquireVsCodeApi function exists in the current development
		// context (i.e. VS Code development window or web browser)
		if (typeof (window as any).acquireVsCodeApi === "function") {
			this.vsCodeApi = (window as any).acquireVsCodeApi()
		}
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
		if (!isStandaloneBrowser && this.vsCodeApi) {
			// VS Code webview环境，使用原有API（优先级最高）
			this.vsCodeApi.postMessage(message)
		} else if (isStandaloneBrowser && wsAdapter) {
			// 独立浏览器环境，使用WebSocket
			wsAdapter.postMessage(message)
		} else {
			// 开发环境或其他情况，输出到控制台
			console.log(message)
		}
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
		return isStandaloneBrowser
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
export const vscode = new VSCodeAPIWrapper()

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
