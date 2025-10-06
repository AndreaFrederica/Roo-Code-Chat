import React from "react"
import { Fzf } from "fzf"
import { Check, X } from "lucide-react"

import { type Role, type RoleSummary } from "@roo-code/types"

import { vscode } from "@/utils/vscode"
import { telemetryClient } from "@/utils/TelemetryClient"
import { cn } from "@/lib/utils"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { useRooPortal } from "@/components/ui/hooks/useRooPortal"
import { Popover, PopoverContent, PopoverTrigger, StandardTooltip } from "@/components/ui"
import { useNotification } from "@/components/ui/Notification"

// Re-export types for backward compatibility
export type { Role, RoleSummary } from "@roo-code/types"

const SEARCH_THRESHOLD = 6

interface RoleSelectorProps {
	value?: Role
	onChange: (value: Role) => void
	disabled?: boolean
	title: string
	triggerClassName?: string
	roleShortcutText: string
}

export const RoleSelector: React.FC<RoleSelectorProps> = ({
	value,
	onChange,
	disabled = false,
	title,
	triggerClassName = "",
	roleShortcutText,
}) => {
	const [open, setOpen] = React.useState(false)
	const [searchValue, setSearchValue] = React.useState("")
	const [roles, setRoles] = React.useState<RoleSummary[]>([])
	const [hasLoaded, setHasLoaded] = React.useState(false)
	const [loadError, setLoadError] = React.useState(false)
	const searchInputRef = React.useRef<HTMLInputElement>(null)
	const selectedItemRef = React.useRef<HTMLDivElement>(null)
	const scrollContainerRef = React.useRef<HTMLDivElement>(null)
	const portalContainer = useRooPortal("roo-portal")
	const { t } = useAppTranslation()
	const { showRoleDebugInfo } = useNotification()

	// Load available roles
	React.useEffect(() => {
		vscode.postMessage({
			type: "getAnhRoles"
		})

		// Set timeout to detect loading failure
		const timeout = setTimeout(() => {
			if (!hasLoaded) {
				setLoadError(true)
			}
		}, 3000) // 3 seconds timeout

		return () => clearTimeout(timeout)
	}, [hasLoaded])

	// Handle messages from extension
	React.useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data

			switch (message.type) {
				case "anhRolesLoaded":
					console.log('=== ANH Roles Loaded ===');
					console.log('Received roles:', message.roles);
					setHasLoaded(true)
					setRoles(message.roles || [])
					break
				case "anhRoleLoaded":
					console.log('=== ANH Role Loaded ===');
					console.log('Received role:', message.role);
					if (message.role) {
						console.log('Role profile:', message.role.profile);
						// Show role debug info with the complete role object
						showRoleDebugInfo(message.role)
						onChange?.(message.role)
					}
					break
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [onChange, showRoleDebugInfo])

	const trackRoleSelectorOpened = React.useCallback(() => {
		// Track telemetry every time the role selector is opened.
		telemetryClient.capture("role_selector_opened")
	}, [])

	// Create default role for when no roles are loaded
	const defaultRole: Role = React.useMemo(() => ({
		uuid: "",
		name: t("chat:roleSelector.defaultRole"),
		type: "主角" as any,
		description: t("chat:roleSelector.defaultRole"),
		createdAt: Date.now(),
		updatedAt: Date.now(),
	}), [t])

	// Combine all roles including default role for display
	const allRoles = React.useMemo(() => {
		const roleList = roles.map((summary) => ({
			...summary,
			description: summary.name, // Use name as description for display
			createdAt: summary.lastUpdatedAt,
			updatedAt: summary.lastUpdatedAt,
		} as Role))

		// Add default role at the beginning
		return [defaultRole, ...roleList]
	}, [roles, defaultRole])

	// Find the selected role
	const selectedRole = React.useMemo(() => {
		if (value?.uuid) {
			return allRoles.find((role) => role.uuid === value.uuid) || defaultRole
		}
		return defaultRole
	}, [value, allRoles, defaultRole])

	// Memoize searchable items for fuzzy search with separate name and description search
	const nameSearchItems = React.useMemo(() => {
		return allRoles.map((role) => ({
			original: role,
			searchStr: [role.name, role.uuid].filter(Boolean).join(" "),
		}))
	}, [allRoles])

	const descriptionSearchItems = React.useMemo(() => {
		return allRoles.map((role) => ({
			original: role,
			searchStr: role.description || "",
		}))
	}, [allRoles])

	// Create memoized Fzf instances for name and description searches
	const nameFzfInstance = React.useMemo(
		() => new Fzf(nameSearchItems, { selector: (item) => item.searchStr }),
		[nameSearchItems],
	)

	const descriptionFzfInstance = React.useMemo(
		() => new Fzf(descriptionSearchItems, { selector: (item) => item.searchStr }),
		[descriptionSearchItems],
	)

	// Filter roles based on search value using fuzzy search with priority
	const filteredRoles = React.useMemo(() => {
		if (!searchValue) return allRoles

		// First search in names/uuids
		const nameMatches = nameFzfInstance.find(searchValue)
		const nameMatchedRoles = new Set(nameMatches.map((result) => result.item.original.uuid))

		// Then search in descriptions
		const descriptionMatches = descriptionFzfInstance.find(searchValue)

		// Combine results: name matches first, then description matches
		const combinedResults = [
			...nameMatches.map((result) => result.item.original),
			...descriptionMatches
				.filter((result) => !nameMatchedRoles.has(result.item.original.uuid))
				.map((result) => result.item.original),
		]

		return combinedResults
	}, [allRoles, searchValue, nameFzfInstance, descriptionFzfInstance])

	const onClearSearch = React.useCallback(() => {
		setSearchValue("")
		searchInputRef.current?.focus()
	}, [])

	const handleSelect = React.useCallback(
		(role: Role) => {
			onChange(role)
			setOpen(false)
			// Clear search after selection
			setSearchValue("")

			// Send message to backend to load the role
			if (role.uuid) {
				vscode.postMessage({
					type: "loadAnhRole",
					roleUuid: role.uuid
				})
			} else {
				// Default role selected
				vscode.postMessage({
					type: "loadAnhRole",
					roleUuid: ""
				})
			}
		},
		[onChange],
	)

	const onOpenChange = React.useCallback(
		(isOpen: boolean) => {
			if (isOpen) trackRoleSelectorOpened()
			setOpen(isOpen)

			// Clear search when closing
			if (!isOpen) {
				setSearchValue("")
			}
		},
		[trackRoleSelectorOpened],
	)

	// Auto-focus search input and scroll to selected item when popover opens
	React.useEffect(() => {
		if (open) {
			// Focus search input
			if (searchInputRef.current) {
				searchInputRef.current.focus()
			}

			requestAnimationFrame(() => {
				if (selectedItemRef.current && scrollContainerRef.current) {
					const container = scrollContainerRef.current
					const item = selectedItemRef.current

					// Calculate positions
					const containerHeight = container.clientHeight
					const itemTop = item.offsetTop
					const itemHeight = item.offsetHeight

					// Center the item in the container
					const scrollPosition = itemTop - containerHeight / 2 + itemHeight / 2

					// Ensure we don't scroll past boundaries
					const maxScroll = container.scrollHeight - containerHeight
					const finalScrollPosition = Math.min(Math.max(0, scrollPosition), maxScroll)

					container.scrollTo({
						top: finalScrollPosition,
						behavior: "instant",
					})
				}
			})
		}
	}, [open])

	// Determine if search should be shown
	const showSearch = !loadError && allRoles.length > SEARCH_THRESHOLD

	// Combine instruction text for tooltip
	const instructionText = `${t("chat:roleSelector.description")} ${roleShortcutText}`

	return (
		<Popover open={open} onOpenChange={onOpenChange} data-testid="role-selector-root">
			<StandardTooltip content={title}>
				<PopoverTrigger
					disabled={disabled}
					data-testid="role-selector-trigger"
					className={cn(
						"inline-flex items-center relative whitespace-nowrap px-1.5 py-1 text-xs",
						"bg-transparent border border-[rgba(255,255,255,0.08)] rounded-md text-vscode-foreground",
						"transition-all duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder focus-visible:ring-inset",
						disabled
							? "opacity-50 cursor-not-allowed"
							: "opacity-90 hover:opacity-100 hover:bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.15)] cursor-pointer",
						triggerClassName,
					)}>
					<span className="truncate">{selectedRole?.name || ""}</span>
				</PopoverTrigger>
			</StandardTooltip>
			<PopoverContent
				align="start"
				sideOffset={4}
				container={portalContainer}
				className="p-0 overflow-hidden min-w-80 max-w-9/10">
				<div className="flex flex-col w-full">
					{loadError ? (
						<div className="p-3 border-b border-vscode-dropdown-border">
							<p className="m-0 text-xs text-orange-500 text-center">
								{t("chat:roleSelector.loadError")}
							</p>
						</div>
					) : showSearch ? (
						<div className="relative p-2 border-b border-vscode-dropdown-border">
							<input
								aria-label="Search roles"
								ref={searchInputRef}
								value={searchValue}
								onChange={(e) => setSearchValue(e.target.value)}
								placeholder={t("chat:roleSelector.searchPlaceholder")}
								className="w-full h-8 px-2 py-1 text-xs bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded focus:outline-0"
								data-testid="role-search-input"
							/>
							{searchValue.length > 0 && (
								<div className="absolute right-4 top-0 bottom-0 flex items-center justify-center">
									<X
										className="text-vscode-input-foreground opacity-50 hover:opacity-100 size-4 p-0.5 cursor-pointer"
										onClick={onClearSearch}
									/>
								</div>
							)}
						</div>
					) : (
						<div className="p-3 border-b border-vscode-dropdown-border">
							<p className="m-0 text-xs text-vscode-descriptionForeground">{instructionText}</p>
						</div>
					)}

					{/* Role List */}
					<div ref={scrollContainerRef} className="max-h-[300px] overflow-y-auto">
						{filteredRoles.length === 0 && searchValue ? (
							<div className="py-2 px-3 text-sm text-vscode-foreground/70">
								{t("chat:roleSelector.noResults")}
							</div>
						) : (
							<div className="py-1">
								{filteredRoles.map((role) => {
									const isSelected = role.uuid === selectedRole?.uuid
									return (
										<div
											key={role.uuid}
											ref={isSelected ? selectedItemRef : null}
											onClick={() => handleSelect(role)}
											className={cn(
												"px-3 py-1.5 text-sm cursor-pointer flex items-center",
												"hover:bg-vscode-list-hoverBackground",
												isSelected
													? "bg-vscode-list-activeSelectionBackground text-vscode-list-activeSelectionForeground"
													: "",
											)}
											data-testid="role-selector-item">
											<div className="flex-1 min-w-0">
												<div className="font-bold truncate">{role.name}</div>
												{role.description && (
													<div className="text-xs text-vscode-descriptionForeground truncate">
														{role.description}
													</div>
												)}
											</div>
											{isSelected && <Check className="ml-auto size-4 p-0.5" />}
										</div>
									)
								})}
							</div>
						)}
					</div>

					{/* Bottom bar with info */}
					<div className="flex flex-row items-center justify-between px-2 py-2 border-t border-vscode-dropdown-border">
						<div className="flex flex-row gap-1">
							{/* Could add role management buttons here in the future */}
						</div>

						{/* Info icon and title on the right */}
						<div className="flex items-center gap-1 pr-1">
							{showSearch && (
								<StandardTooltip content={instructionText}>
									<span className="codicon codicon-info text-xs text-vscode-descriptionForeground opacity-70 hover:opacity-100 cursor-help" />
								</StandardTooltip>
							)}
							<h4 className="m-0 font-medium text-sm text-vscode-descriptionForeground">
								{t("chat:roleSelector.title")}
							</h4>
						</div>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	)
}

export default RoleSelector