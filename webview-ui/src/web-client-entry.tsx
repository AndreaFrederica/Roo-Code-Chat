import React from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import "@vscode/codicons/dist/codicon.css"
import App from "./App"
import { WebSocketAdapter } from "./utils/websocket-adapter"
import { getThemeManager, isStandaloneThemeEnvironment } from "./utils/theme-manager"
import standaloneThemeStyles from "./standalone-theme.css?raw"

const injectStandaloneThemeStyles = () => {
	if (!isStandaloneThemeEnvironment()) {
		return
	}

	if (typeof document === "undefined") {
		return
	}

	if (document.getElementById("standalone-theme-style")) {
		return
	}

	const styleEl = document.createElement("style")
	styleEl.id = "standalone-theme-style"
	styleEl.textContent = standaloneThemeStyles
	document.head.appendChild(styleEl)
}

async function initializeWebClient() {
	console.log("[WebClient] Initializing web client...")

	injectStandaloneThemeStyles()

	// 初始化主题管理器
	const themeManager = getThemeManager()
	if (!themeManager) {
		console.warn("[WebClient] Theme manager unavailable in this environment")
	}

	const theme = themeManager?.getEffectiveTheme()
	console.log(
		`[WebClient] Theme initialized: ${theme ?? "unknown"} (system preference: ${themeManager?.getCurrentTheme() ?? "n/a"})`,
	)

	// 初始化WebSocket适配器并暴露给全局
	const wsAdapter = new WebSocketAdapter()
	;(window as any).__webClientWebSocketAdapter = wsAdapter
	if (themeManager) {
		;(window as any).__themeManager = themeManager
	}
	console.log("[WebClient] Exposed WebSocket adapter globally:", !!wsAdapter)

	try {
		// 先建立WebSocket连接
		console.log("[WebClient] Establishing WebSocket connection...")
		await wsAdapter.connect()
		console.log("[WebClient] WebSocket connected successfully!")

		// 连接成功后再渲染React应用
		const container = document.getElementById("root")
		if (!container) {
			throw new Error("Failed to find root element for web client")
		}

		const root = createRoot(container)
		console.log("[WebClient] Rendering React app (WebSocket ready)")
		root.render(<App />)

	} catch (error) {
		console.error("[WebClient] Failed to connect WebSocket:", error)

		// 即使连接失败也渲染App，让UI显示连接状态
		const container = document.getElementById("root")
		if (container) {
			const root = createRoot(container)
			console.log("[WebClient] Rendering React app (WebSocket failed)")
			root.render(<App />)
		}
	}

	return wsAdapter
}

// 启动初始化过程
initializeWebClient().then(() => {
	console.log("[WebClient] Web client initialized successfully")
}).catch((error) => {
	console.error("[WebClient] Web client initialization failed:", error)
})

export default initializeWebClient
