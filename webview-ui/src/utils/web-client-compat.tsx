import React from "react"
import { vscode } from "./vscode"
import { AlertTriangle, Info } from "lucide-react"

/**
 * 网页端兼容性工具
 * 用于处理VSCode扩展功能在网页端环境中的兼容性问题
 */

export const isWebClient = (): boolean => {
	return vscode.isStandaloneMode?.() ?? false
}

/**
 * 网页端不可用功能提示组件
 */
export const WebClientUnavailableFeature: React.FC<{
	featureName: string
	description?: string
}> = ({ featureName, description }) => {
	return (
		<div className="flex items-center gap-3 p-4 border border-vscode-input-border rounded-md bg-vscode-input-background">
			<AlertTriangle className="w-5 h-5 text-yellow-500" />
			<div className="flex-1">
				<h4 className="font-medium text-vscode-foreground">{featureName}</h4>
				{description && (
					<p className="text-sm text-vscode-descriptionForeground mt-1">{description}</p>
				)}
				<p className="text-sm text-vscode-descriptionForeground mt-2">
					<Info className="inline w-4 h-4 mr-1" />
					此功能需要VSCode扩展环境，在网页客户端中不可用。
				</p>
			</div>
		</div>
	)
}

/**
 * 网页端兼容的API调用包装器
 */
export const webClientCompat = {
	/**
	 * 安全地发送消息到VSCode扩展，在网页端会提示不可用
	 */
	postMessage: (message: any, fallback?: () => void) => {
		if (isWebClient()) {
			console.warn(`[WebClient] VSCode API不可用: ${message.type}`, message)
			fallback?.()
			return false
		}

		vscode.postMessage(message)
		return true
	},

	/**
	 * 检查功能是否在网页端可用
	 */
	isFeatureAvailable: (featureType: string): boolean => {
		if (!isWebClient()) {
			return true
		}

		// 定义在网页端可用的功能
		const webClientAvailableFeatures = [
			// 基础设置功能
			"language",
			"theme",
			// 可以添加其他网页端可用的功能
		]

		return webClientAvailableFeatures.includes(featureType)
	},

	/**
	 * 获取功能的网页端替代方案
	 */
	getWebClientAlternative: (featureType: string): React.ReactNode | null => {
		if (!isWebClient()) {
			return null
		}

		const alternatives: Record<string, React.ReactNode> = {
			tsProfile: (
				<WebClientUnavailableFeature
					featureName="TS Profile配置"
					description="TypeScript配置文件管理功能在网页端不可用。请在VSCode扩展中使用此功能。"
				/>
			),
			roles: (
				<WebClientUnavailableFeature
					featureName="角色管理"
					description="项目角色配置功能在网页端不可用。请在VSCode扩展中使用此功能。"
				/>
			),
			customUserAgent: (
				<WebClientUnavailableFeature
					featureName="自定义User Agent"
					description="网络配置功能在网页端不可用。请在VSCode扩展中使用此功能。"
				/>
			),
			fileSystem: (
				<WebClientUnavailableFeature
					featureName="文件系统操作"
					description="文件系统访问功能在网页端不可用。请在VSCode扩展中使用此功能。"
				/>
			)
		}

		return alternatives[featureType] || null
	}
}

export default webClientCompat