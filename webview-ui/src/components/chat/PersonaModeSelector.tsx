import React from "react"
import { MessageSquare, Code } from "lucide-react"

import { cn } from "@/lib/utils"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { StandardTooltip } from "@/components/ui"

interface PersonaModeSelectorProps {
	value: "hybrid" | "chat"
	onChange: (value: "hybrid" | "chat") => void
	disabled?: boolean
	title: string
	triggerClassName?: string
}

export const PersonaModeSelector: React.FC<PersonaModeSelectorProps> = ({
	value,
	onChange,
	disabled = false,
	title,
	triggerClassName = "",
}) => {
	const { t } = useAppTranslation()

	const handleToggle = () => {
		onChange(value === "hybrid" ? "chat" : "hybrid")
	}

	const icon = value === "chat" ? <MessageSquare className="w-3.5 h-3.5" /> : <Code className="w-3.5 h-3.5" />
	const label = value === "chat" ? t("chat:personaMode.chat") : t("chat:personaMode.hybrid")

	return (
		<StandardTooltip content={title}>
			<button
				disabled={disabled}
				onClick={handleToggle}
				data-testid="persona-mode-selector"
				className={cn(
					"inline-flex items-center gap-1 relative whitespace-nowrap px-1.5 py-1 text-xs",
					"bg-transparent border border-[rgba(255,255,255,0.08)] rounded-md text-vscode-foreground",
					"transition-all duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder focus-visible:ring-inset",
					disabled
						? "opacity-50 cursor-not-allowed"
						: "opacity-90 hover:opacity-100 hover:bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.15)] cursor-pointer",
					triggerClassName,
				)}>
				{icon}
				<span className="truncate">{label}</span>
			</button>
		</StandardTooltip>
	)
}

export default PersonaModeSelector
