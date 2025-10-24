import React from "react"
import { createRoot } from "react-dom/client"

import App from "./App"
import { WebSocketAdapter } from "./utils/websocket-adapter"

// 初始化WebSocket适配器并暴露给全局
const wsAdapter = new WebSocketAdapter()
;(window as any).__webClientWebSocketAdapter = wsAdapter
console.log("[WebClient] Exposed WebSocket adapter globally:", !!wsAdapter)

// 启动React应用，让内部逻辑处理连接状态
const container = document.getElementById("root")
if (!container) {
	throw new Error("Failed to find root element for web client")
}

const root = createRoot(container)
console.log("[WebClient] Rendering React app")
root.render(<App />)

// 尝试建立WebSocket连接，结果交由 UI 处理
wsAdapter
	.connect()
	.then(() => {
		console.log("[WebClient] WebSocket connected")
	})
	.catch((error) => {
		console.error("[WebClient] Failed to connect WebSocket:", error)
	})

export default wsAdapter
