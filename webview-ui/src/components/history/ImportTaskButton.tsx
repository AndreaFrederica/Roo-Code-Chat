import { useCallback } from "react"

import { Button, StandardTooltip } from "@/components/ui"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { vscode } from "@/utils/vscode"

export const ImportTaskButton = () => {
	const { t } = useAppTranslation()

	const handleClick = useCallback(() => {
		vscode.postMessage({ type: "importTaskBundle" })
	}, [])

	return (
		<StandardTooltip content={t("history:importTask")}>
			<Button
				variant="secondary"
				onClick={(event) => {
					event.stopPropagation()
					handleClick()
				}}
				className="flex items-center gap-1">
				<span className="codicon codicon-cloud-upload" />
				{t("history:import")}
			</Button>
		</StandardTooltip>
	)
}

