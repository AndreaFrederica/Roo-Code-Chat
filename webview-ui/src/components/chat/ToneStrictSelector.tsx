import React from "react"
import { UserRound, Sparkles } from "lucide-react"
import { cn } from "@src/lib/utils"
import { StandardTooltip } from "@src/components/ui"
import { useAppTranslation } from "@src/i18n/TranslationContext"

interface ToneStrictSelectorProps {
	value: boolean
	onChange: (value: boolean) => void
	disabled?: boolean
	className?: string
}

export const ToneStrictSelector: React.FC<ToneStrictSelectorProps> = ({
	value,
	onChange,
	disabled = false,
	className,
}) => {
	const { t } = useAppTranslation()

	const handleToggle = () => {
		if (!disabled) {
			onChange(!value)
		}
	}

	return (
		<StandardTooltip
			content={value ? t("chat:toneStrict.strict") : t("chat:toneStrict.friendly")}
			side="top"
			align="center">
			<button
				onClick={handleToggle}
				disabled={disabled}
				className={cn(
					"inline-flex items-center gap-1.5 relative whitespace-nowrap px-1.5 py-1 text-xs",
					"bg-transparent border border-[rgba(255,255,255,0.08)] rounded-md text-vscode-foreground",
					"transition-all duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder focus-visible:ring-inset",
					disabled
						? "opacity-50 cursor-not-allowed"
						: "opacity-90 hover:opacity-100 hover:bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.15)] cursor-pointer",
					className,
				)}
				aria-label={value ? t("chat:toneStrict.strict") : t("chat:toneStrict.friendly")}>
				{value ? (
					<UserRound className="w-3.5 h-3.5 text-vscode-foreground" />
				) : (
					<Sparkles className="w-3.5 h-3.5 text-vscode-foreground" />
				)}
			</button>
		</StandardTooltip>
	)
}
