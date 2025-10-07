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
					"relative inline-flex items-center justify-center gap-1.5",
					"bg-transparent border border-vscode-button-border",
					"rounded-md px-2 py-1.5 min-h-[28px]",
					"transition-all duration-150",
					!disabled && "hover:bg-vscode-button-hoverBackground",
					!disabled && "cursor-pointer",
					disabled && "opacity-40 cursor-not-allowed",
					"focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder",
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
