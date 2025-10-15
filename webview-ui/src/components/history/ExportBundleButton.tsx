import { vscode } from "@/utils/vscode"
import { Button, StandardTooltip } from "@/components/ui"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { useCallback } from "react"

export const ExportBundleButton = ({ itemId }: { itemId: string }) => {
	const { t } = useAppTranslation()

	const handleExportClick = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation()
			vscode.postMessage({ type: "exportTaskBundleWithId", text: itemId })
		},
		[itemId],
	)

	return (
		<StandardTooltip content={t("history:exportTaskBundle")}>
			<Button
				data-testid="export-bundle"
				variant="ghost"
				size="icon"
				className="group-hover:opacity-100 opacity-50 transition-opacity"
				onClick={handleExportClick}>
				<span className="codicon codicon-cloud-download scale-80" />
			</Button>
		</StandardTooltip>
	)
}

