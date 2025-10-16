import React from "react"
import { Layers, CheckCheck, X, Settings } from "lucide-react"

import { useExtensionState } from "@/context/ExtensionStateContext"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { useRooPortal } from "@/components/ui/hooks/useRooPortal"
import { Button, Popover, PopoverContent, PopoverTrigger, StandardTooltip } from "@/components/ui"
import { cn } from "@/lib/utils"

import type { WorkspaceContextSettingKey } from "@roo-code/types"
import { WORKSPACE_CONTEXT_SETTING_KEYS } from "@roo-code/types"

interface WorkspaceContextDropdownProps {
	disabled?: boolean
	triggerClassName?: string
}

type ContextOption = {
	key: WorkspaceContextSettingKey
	icon: string
	labelKey: string
	descriptionKey: string
}

const contextOptions: ContextOption[] = [
	{
		key: "visibleFiles",
		icon: "eye",
		labelKey: "chat:workspaceContext.options.visibleFiles.label",
		descriptionKey: "chat:workspaceContext.options.visibleFiles.description",
	},
	{
		key: "openTabs",
		icon: "files",
		labelKey: "chat:workspaceContext.options.openTabs.label",
		descriptionKey: "chat:workspaceContext.options.openTabs.description",
	},
	{
		key: "terminals",
		icon: "terminal",
		labelKey: "chat:workspaceContext.options.terminals.label",
		descriptionKey: "chat:workspaceContext.options.terminals.description",
	},
]

const additionalOptions: ContextOption[] = [
	{
		key: "recentFiles",
		icon: "history",
		labelKey: "chat:workspaceContext.options.recentFiles.label",
		descriptionKey: "chat:workspaceContext.options.recentFiles.description",
	},
	{
		key: "currentTime",
		icon: "clock",
		labelKey: "chat:workspaceContext.options.currentTime.label",
		descriptionKey: "chat:workspaceContext.options.currentTime.description",
	},
	{
		key: "currentCost",
		icon: "credit-card",
		labelKey: "chat:workspaceContext.options.currentCost.label",
		descriptionKey: "chat:workspaceContext.options.currentCost.description",
	},
	{
		key: "currentMode",
		icon: "settings",
		labelKey: "chat:workspaceContext.options.currentMode.label",
		descriptionKey: "chat:workspaceContext.options.currentMode.description",
	},
	{
		key: "workspaceFiles",
		icon: "list-tree",
		labelKey: "chat:workspaceContext.options.workspaceFiles.label",
		descriptionKey: "chat:workspaceContext.options.workspaceFiles.description",
	},
	{
		key: "todo",
		icon: "checklist",
		labelKey: "chat:workspaceContext.options.todo.label",
		descriptionKey: "chat:workspaceContext.options.todo.description",
	},
]

const allOptions: ContextOption[] = [...contextOptions, ...additionalOptions]

export const WorkspaceContextDropdown = ({
	disabled = false,
	triggerClassName = "",
}: WorkspaceContextDropdownProps) => {
	const [open, setOpen] = React.useState(false)
	const portalContainer = useRooPortal("roo-portal")
	const { t } = useAppTranslation()
	const {
		workspaceContextSettings,
		setWorkspaceContextSetting,
		setAllWorkspaceContextSettings,
	} = useExtensionState()

	const enabledCount = WORKSPACE_CONTEXT_SETTING_KEYS.reduce(
		(acc, key) => (workspaceContextSettings[key] ? acc + 1 : acc),
		0,
	)
	const totalCount = WORKSPACE_CONTEXT_SETTING_KEYS.length
	const summaryLabel =
		enabledCount === totalCount
			? t("chat:workspaceContext.allOn")
			: enabledCount === 0
				? t("chat:workspaceContext.allOff")
				: t("chat:workspaceContext.summary", { enabled: enabledCount, total: totalCount })

	const handleToggle = React.useCallback(
		(key: WorkspaceContextSettingKey) => {
			const current = workspaceContextSettings[key]
			console.debug("[WorkspaceContext] dropdown toggle", { key, next: !current })
			setWorkspaceContextSetting(key, !current)
		},
		[workspaceContextSettings, setWorkspaceContextSetting],
	)

	const handleSelectAll = React.useCallback(() => {
		console.debug("[WorkspaceContext] dropdown select all")
		setAllWorkspaceContextSettings(true)
	}, [setAllWorkspaceContextSettings])

	const handleSelectNone = React.useCallback(() => {
		console.debug("[WorkspaceContext] dropdown select none")
		setAllWorkspaceContextSettings(false)
	}, [setAllWorkspaceContextSettings])

	const renderOption = (option: ContextOption) => {
		const isEnabled = workspaceContextSettings[option.key]
		return (
			<StandardTooltip key={option.key} content={t(option.descriptionKey)}>
				<button
					onClick={() => handleToggle(option.key)}
					className={cn(
						"flex items-center gap-2 px-2 py-2 rounded text-sm text-left transition-all duration-150",
						"opacity-100 hover:opacity-70 cursor-pointer",
						isEnabled
							? "bg-vscode-button-background text-vscode-button-foreground"
							: "bg-vscode-button-background/15 text-vscode-foreground hover:bg-vscode-list-hoverBackground",
						disabled && "opacity-50 cursor-not-allowed hover:opacity-50",
					)}
					disabled={disabled}
					data-testid={`workspace-context-${option.key}`}>
					<span className={`codicon codicon-${option.icon} text-sm flex-shrink-0`} />
					<span className="flex-1 truncate">{t(option.labelKey)}</span>
				</button>
			</StandardTooltip>
		)
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<StandardTooltip content={t("chat:workspaceContext.description")}>
				<PopoverTrigger
					asChild
					disabled={disabled}
					className={cn(
						"inline-flex items-center gap-1.5 relative whitespace-nowrap px-1.5 py-1 text-xs",
						"bg-transparent border border-[rgba(255,255,255,0.08)] rounded-md text-vscode-foreground",
						"transition-all duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder focus-visible:ring-inset",
						disabled
							? "opacity-50 cursor-not-allowed"
							: "opacity-90 hover:opacity-100 hover:bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.15)] cursor-pointer",
						triggerClassName,
					)}>
					<button
						className={cn(
							"inline-flex items-center gap-1.5 relative whitespace-nowrap px-1.5 py-1 text-xs",
							"bg-transparent border border-[rgba(255,255,255,0.08)] rounded-md text-vscode-foreground",
							"transition-all duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder focus-visible:ring-inset",
							disabled
								? "opacity-50 cursor-not-allowed"
								: "opacity-90 hover:opacity-100 hover:bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.15)] cursor-pointer",
						)}>
						<Layers className="w-3 h-3" />
						<span className="truncate min-w-0">{summaryLabel}</span>
					</button>
				</PopoverTrigger>
			</StandardTooltip>
			<PopoverContent
				align="start"
				sideOffset={4}
				container={portalContainer}
				className="p-0 overflow-hidden w-[min(440px,calc(100vw-2rem))]"
				onOpenAutoFocus={(e) => e.preventDefault()}>
				<div className="flex flex-col w-full">
					<div className="p-3 border-b border-vscode-dropdown-border">
						<div className="flex items-center justify-between gap-1 pr-1 pb-2">
							<h4 className="m-0 font-bold text-base text-vscode-foreground">
								{t("chat:workspaceContext.title")}
							</h4>
							<Settings className="inline mb-0.5 mr-1 size-4 opacity-70" />
						</div>
						<p className="m-0 text-xs text-vscode-descriptionForeground">
							{t("chat:workspaceContext.description")}
						</p>
					</div>
					<div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-x-2 gap-y-2 p-3">
						{allOptions.map(renderOption)}
					</div>
					<div className="flex flex-row items-center justify-between px-2 py-2 border-t border-vscode-dropdown-border">
						<div className="flex flex-row gap-1">
							<button
								aria-label={t("chat:workspaceContext.allOn")}
								onClick={handleSelectAll}
								className={cn(
									"relative inline-flex items-center justify-center gap-1",
									"bg-transparent border-none px-2 py-1",
									"rounded-md text-base font-bold",
									"text-vscode-foreground",
									"transition-all duration-150",
									"hover:opacity-100 hover:bg-[rgba(255,255,255,0.03)]",
									"focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder",
									"active:bg-[rgba(255,255,255,0.1)]",
								)}>
								<CheckCheck className="w-3.5 h-3.5" />
								<span>{t("chat:workspaceContext.allOn")}</span>
							</button>
							<button
								aria-label={t("chat:workspaceContext.allOff")}
								onClick={handleSelectNone}
								className={cn(
									"relative inline-flex items-center justify-center gap-1",
									"bg-transparent border-none px-2 py-1",
									"rounded-md text-base font-bold",
									"text-vscode-foreground",
									"transition-all duration-150",
									"hover:opacity-100 hover:bg-[rgba(255,255,255,0.03)]",
									"focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder",
									"active:bg-[rgba(255,255,255,0.1)]",
								)}>
								<X className="w-3.5 h-3.5" />
								<span>{t("chat:workspaceContext.allOff")}</span>
							</button>
						</div>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	)
}
