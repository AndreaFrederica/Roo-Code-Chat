import { useQuery } from "@tanstack/react-query"
import { useState, useCallback } from "react"

import { ModelRecord } from "@roo/api"
import { ExtensionMessage } from "@roo/ExtensionMessage"

import { vscode } from "@src/utils/vscode"
import { useMessageListener } from "@/hooks/useMessageListener"

export const useOllamaModels = (modelId?: string) => {
	const [data, setData] = useState<ModelRecord | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [_error, setError] = useState<string | null>(null)

	// 使用统一监听器监听ollamaModels消息
	useMessageListener(
		["ollamaModels"],
		useCallback((message: ExtensionMessage) => {
			console.log("[useOllamaModels] Received ollamaModels message:", message.ollamaModels)
			setData(message.ollamaModels || {})
			setIsLoading(false)
			setError(null)
		}, []),
	)

	const refetch = useCallback(() => {
		if (isLoading) return

		setIsLoading(true)
		setError(null)
		vscode.postMessage({ type: "requestOllamaModels" })
	}, [isLoading])

	return useQuery({
		queryKey: ["ollamaModels"],
		queryFn: async () => {
			if (!modelId) return {}

			// 如果还没有数据，先请求一次
			if (!data && !isLoading) {
				refetch()
			}

			return data || {}
		},
		enabled: !!modelId,
		staleTime: 60000, // 1分钟缓存
	})
}
