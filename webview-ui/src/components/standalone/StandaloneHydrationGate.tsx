import React, { useCallback, useEffect, useState } from "react"

import { vscode } from "@src/utils/vscode"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { WebviewMessage } from "@roo/WebviewMessage"
import { useUniversalMessageListener } from "@src/hooks/useMessageListener"

const containerStyle: React.CSSProperties = {
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	justifyContent: "center",
	position: "fixed",
	top: 0,
	left: 0,
	right: 0,
	bottom: 0,
	width: "100vw",
	height: "100vh",
	padding: "2.5rem 1.5rem",
	background:
		"linear-gradient(160deg, var(--background) 0%, color-mix(in srgb, var(--background) 85%, transparent) 60%, var(--background) 100%)",
	color: "var(--foreground)",
	textAlign: "center",
	gap: "1.5rem",
	zIndex: 9999,
}

const panelStyle: React.CSSProperties = {
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	gap: "0.75rem",
	backgroundColor: "color-mix(in srgb, var(--popover) 88%, transparent)",
	border: "1px solid color-mix(in srgb, var(--primary) 35%, transparent)",
	borderRadius: "16px",
	padding: "1.75rem 1.5rem",
	maxWidth: "480px",
	backdropFilter: "blur(16px)",
	boxShadow: "0 18px 45px color-mix(in srgb, var(--background) 60%, transparent)",
}


const actionRowStyle: React.CSSProperties = {
	display: "flex",
	flexWrap: "wrap",
	gap: "0.75rem",
	justifyContent: "center",
}

const buttonStyle: React.CSSProperties = {
	padding: "0.6rem 1.4rem",
	borderRadius: "999px",
	border: "1px solid color-mix(in srgb, var(--primary) 35%, transparent)",
	background:
		"linear-gradient(120deg, color-mix(in srgb, var(--primary) 28%, transparent), color-mix(in srgb, var(--primary) 22%, transparent))",
	color: "var(--primary-foreground)",
	cursor: "pointer",
	fontWeight: 600,
	letterSpacing: "0.02em",
	transition: "transform 120ms ease, box-shadow 120ms ease",
}

const secondaryButtonStyle: React.CSSProperties = {
	...buttonStyle,
	background: "color-mix(in srgb, var(--background) 82%, transparent)",
	color: "var(--foreground)",
}

const hintStyle: React.CSSProperties = {
	fontSize: "0.95rem",
	lineHeight: 1.55,
	color: "color-mix(in srgb, var(--muted-foreground) 85%, var(--foreground) 15%)",
}

const logStyle: React.CSSProperties = {
	fontFamily: "'DM Mono', ui-monospace, SFMono-Regular, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace",
	fontSize: "0.85rem",
	lineHeight: 1.5,
	color: "color-mix(in srgb, var(--muted-foreground) 80%, var(--foreground) 20%)",
	backgroundColor: "color-mix(in srgb, var(--background) 92%, transparent)",
	borderRadius: "12px",
	padding: "1rem 1.2rem",
	textAlign: "left",
	border: "1px solid color-mix(in srgb, var(--primary) 22%, transparent)",
	width: "100%",
	boxSizing: "border-box",
}

const dividerStyle: React.CSSProperties = {
	width: "100%",
	height: "1px",
	background:
		"linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--primary) 40%, transparent) 50%, transparent 100%)",
}

const StandaloneHydrationGate: React.FC = () => {
	const { activateStandaloneDemoMode } = useExtensionState()
	const isStandalone = vscode.isStandaloneMode()
	const [connected, setConnected] = useState<boolean>(vscode.isConnected())
	const [elapsedSeconds, setElapsedSeconds] = useState(0)
	const [handshakeCount, setHandshakeCount] = useState(0)
	const [connectionError, setConnectionError] = useState<string>()

	useEffect(() => {
		const cleanup = vscode.onConnectionStatusChange((status) => {
			setConnected(status)
			if (status) {
				setConnectionError(undefined)
			}
		})
		return () => {
			if (typeof cleanup === "function") {
				cleanup()
			}
		}
	}, [])

	useEffect(() => {
		if (!connected) {
			const timer = window.setInterval(() => setElapsedSeconds((prev) => prev + 1), 1000)
			return () => window.clearInterval(timer)
		}
		setElapsedSeconds(0)
		return
	}, [connected])

	// Universal message listener for state messages
	useUniversalMessageListener(
		useCallback((message: any) => {
			if (message.type === "state") {
				setHandshakeCount((prev) => prev + 1)
			}
		}, []),
		{
			filterInvalid: true,
			messageFilter: (message) => message.type === "state"
		}
	)

	
	const handleResendHandshake = useCallback(() => {
		const message: WebviewMessage = { type: "webviewDidLaunch" }
		vscode.postMessage(message)
	}, [])

	const handleRetryConnection = useCallback(() => {
		const adapter = (window as any).__webClientWebSocketAdapter as { connect?: () => Promise<void> } | undefined
		if (adapter?.connect) {
			adapter
				.connect()
				.then(() => setConnectionError(undefined))
				.catch((error) => {
					console.error("[StandaloneHydrationGate] Retry connection failed", error)
					setConnectionError(error?.message ?? "无法重新建立 WebSocket 连接")
				})
		} else {
			window.location.reload()
		}
	}, [])

	const handleLaunchDemoMode = useCallback(() => {
		activateStandaloneDemoMode()
	}, [activateStandaloneDemoMode])

	return (
		<div style={containerStyle}>
			<div style={panelStyle}>
				<div style={{ fontSize: "1.8rem", fontWeight: 600, letterSpacing: "0.01em", marginBottom: "1rem" }}>
					{isStandalone ? "浏览器模式需要扩展端的支持" : "正在启动聊天界面"}
				</div>

				<p style={hintStyle}>
					{isStandalone
						? "我们检测到当前运行在独立浏览器环境。请确保 VS Code 扩展正在运行并启动了 WebSocket 代理，或使用下面的选项进行诊断。"
						: "正在等待 VS Code 扩展注入初始会话状态，这通常只需数秒时间。"}
				</p>

				<div style={actionRowStyle}>
					<button style={buttonStyle} onClick={handleResendHandshake}>
						重新发送握手
					</button>
					{isStandalone && (
						<button style={buttonStyle} onClick={handleRetryConnection}>
							重新连接扩展
						</button>
					)}
					<button style={secondaryButtonStyle} onClick={() => window.location.reload()}>
						刷新页面
					</button>
					{isStandalone && (
						<button style={secondaryButtonStyle} onClick={handleLaunchDemoMode}>
							加载演示界面
						</button>
					)}
				</div>

				<div style={dividerStyle} />

				<div style={hintStyle}>
					{isStandalone
						? "如果仍然无法连接，请确认 VS Code 端口转发、CORS 设置以及扩展 WebSocket 代理均已启用。"
						: "若长时间无响应，可尝试在 VS Code 中重新加载扩展或查看开发者控制台日志。"}
				</div>

				<div style={logStyle}>
					<div>运行模式：{isStandalone ? "Standalone Web Browser" : "VS Code Webview"}</div>
					<div>等待时长：{elapsedSeconds}s</div>
					<div>收到 state 消息：{handshakeCount} 次</div>
					{connectionError && (
						<div style={{ color: "var(--vscode-errorForeground, var(--foreground))", marginTop: "0.5rem" }}>
							最近错误：{connectionError}
						</div>
					)}
				</div>
			</div>

			<p style={{ ...hintStyle, maxWidth: "520px" }}>
				提示：可在浏览器地址栏中访问 <code style={{ color: "var(--primary)" }}>/api/websocket-info</code> 检查代理服务配置，或查阅
				`websocket-bridge-implementation.md` 了解搭建步骤。
			</p>
		</div>
	)
}

export default StandaloneHydrationGate
