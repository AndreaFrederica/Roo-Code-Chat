import { useState, useCallback } from "react"

import { RouterModels } from "@roo/api"

import { vscode } from "@src/utils/vscode"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { useUniversalMessageListener } from "@/hooks/useMessageListener"

export const useRouterModels = () => {
	const { routerModels } = useExtensionState()
	const [isRequesting, setIsRequesting] = useState(false)
	const [requestError, setRequestError] = useState<string | null>(null)

	// 使用统一监听器来处理routerModels消息
	useUniversalMessageListener(
		useCallback((message: any) => {
			if (message.type === "routerModels") {
				console.log("[useRouterModels] Received routerModels message:", message.routerModels)
				setIsRequesting(false)
				setRequestError(null)
			}
		}, []),
		{
			filterInvalid: true,
			messageFilter: (message) => message.type === "routerModels"
		}
	)

	const refetch = useCallback(() => {
		if (isRequesting) return

		setIsRequesting(true)
		setRequestError(null)
		vscode.postMessage({ type: "requestRouterModels" })
	}, [isRequesting])

	// 在VSCode环境中，使用ExtensionStateContext中的routerModels
	// 在浏览器环境中，也使用ExtensionStateContext中的routerModels（通过统一监听器更新）
	return {
		data: routerModels,
		isLoading: !routerModels && isRequesting,
		isError: !!requestError,
		refetch
	}
}
