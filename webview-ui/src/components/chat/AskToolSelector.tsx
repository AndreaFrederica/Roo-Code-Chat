import React from "react"
import { MessageCircle, MessageCircleOff } from "lucide-react"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { StandardTooltip } from "@src/components/ui"
import { cn } from "@src/lib/utils"
import { vscode } from "@src/utils/vscode"

interface AskToolSelectorProps {
	className?: string
}

export const AskToolSelector: React.FC<AskToolSelectorProps> = ({ className }) => {
	const { t } = useAppTranslation()
	const { anhUseAskTool, setAnhUseAskTool } = useExtensionState()

	const toggleUseAskTool = () => {
		const newValue = !anhUseAskTool
		setAnhUseAskTool(newValue)
		// Send message to backend to update state
		vscode.postMessage({
			type: "setAnhUseAskTool",
			bool: newValue,
		})
	}

	return (
		<StandardTooltip content={anhUseAskTool ? t("chat:askTool.enabled") : t("chat:askTool.disabled")}>
			<button
				onClick={toggleUseAskTool}
				className={cn(
					"inline-flex items-center relative whitespace-nowrap px-1.5 py-1 text-xs",
					"bg-transparent border border-[rgba(255,255,255,0.08)] rounded-md text-vscode-foreground",
					"transition-all duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder focus-visible:ring-inset",
					"opacity-90 hover:opacity-100 hover:bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.15)] cursor-pointer",
					className
				)}
			>
				{anhUseAskTool ? (
					<MessageCircle className="w-3.5 h-3.5" />
				) : (
					<MessageCircleOff className="w-3.5 h-3.5" />
				)}
			</button>
		</StandardTooltip>
	)
}