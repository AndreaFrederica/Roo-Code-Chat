import { useState, useEffect, useCallback } from "react"
import { MarketplaceViewStateManager, ViewState } from "./MarketplaceViewStateManager"
import { useMessageListener } from "@/hooks/useMessageListener"

export function useStateManager(existingManager?: MarketplaceViewStateManager) {
	const [manager] = useState(() => existingManager || new MarketplaceViewStateManager())
	const [state, setState] = useState(() => manager.getState())

	const handleStateChange = useCallback((newState: ViewState) => {
		setState((prevState) => {
			// Compare specific state properties that matter for rendering
			const hasChanged =
				prevState.isFetching !== newState.isFetching ||
				prevState.activeTab !== newState.activeTab ||
				JSON.stringify(prevState.allItems) !== JSON.stringify(newState.allItems) ||
				JSON.stringify(prevState.organizationMcps) !== JSON.stringify(newState.organizationMcps) ||
				JSON.stringify(prevState.displayItems) !== JSON.stringify(newState.displayItems) ||
				JSON.stringify(prevState.displayOrganizationMcps) !==
					JSON.stringify(newState.displayOrganizationMcps) ||
				JSON.stringify(prevState.filters) !== JSON.stringify(newState.filters)

			return hasChanged ? newState : prevState
		})
	}, [])

	const handleMessage = useCallback((message: any) => {
		manager.handleMessage(message)
	}, [manager])

	// 使用统一监听器来处理marketplace相关消息
	useMessageListener(
		["state", "marketplaceData", "marketplaceButtonClicked", "marketplaceInstallResult", "marketplaceRemoveResult"],
		handleMessage,
		[manager]
	)

	useEffect(() => {
		// Register state change handler
		const unsubscribe = manager.onStateChange(handleStateChange)

		// Force initial state sync
		handleStateChange(manager.getState())

		return () => {
			unsubscribe()
			// Don't cleanup the manager if it was provided externally
			if (!existingManager) {
				manager.cleanup()
			}
		}
	}, [manager, existingManager, handleStateChange])

	return [state, manager] as const
}
