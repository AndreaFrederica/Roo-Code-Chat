import React, { useCallback, useEffect, useState } from "react"
import { Fzf } from "fzf"
import { Check, X, User, UserX, Globe, Folder, Bot } from "lucide-react"

import {
	type Role,
	type RoleSummary,
	type UserAvatarVisibility,
	DEFAULT_ASSISTANT_ROLE,
	DEFAULT_ASSISTANT_ROLE_UUID,
} from "@roo-code/types"

import { vscode } from "@src/utils/vscode"
import { cn } from "@src/lib/utils"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { ExtensionStateContextType } from "@src/context/ExtensionStateContext"
import { Button } from "@src/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@src/components/ui/select"
import { StandardTooltip } from "@src/components/ui"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { SetCachedStateField } from "./types"

interface UserAvatarSettingsProps {
	userAvatarRole?: Role
	enableUserAvatar?: boolean
	userAvatarVisibility?: UserAvatarVisibility
	setCachedStateField: SetCachedStateField<keyof ExtensionStateContextType>
}

export const UserAvatarSettings: React.FC<UserAvatarSettingsProps> = ({
	userAvatarRole,
	enableUserAvatar,
	userAvatarVisibility,
	setCachedStateField,
}) => {
	const { t } = useAppTranslation()
	const [open, setOpen] = useState(false)
	const [searchValue, setSearchValue] = useState("")
	const [roles, setRoles] = useState<RoleSummary[]>([])
	const [hasLoaded, setHasLoaded] = useState(false)
	const [loadError, setLoadError] = useState(false)
	const searchInputRef = React.useRef<HTMLInputElement>(null)
	const scrollContainerRef = React.useRef<HTMLDivElement>(null)

	// Load available roles
	useEffect(() => {
		vscode.postMessage({
			type: "getAnhRoles",
		})
		vscode.postMessage({
			type: "getGlobalAnhRoles",
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
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data

			switch (message.type) {
				case "anhRolesLoaded":
					console.log("=== UserAvatar: ANH Roles Loaded ===")
					console.log("Received roles:", message.roles)
					setHasLoaded(true)
					setRoles((prev) => {
						const workspaceRoles = (message.roles || []).map((role: RoleSummary) => ({
							...role,
							scope: "workspace" as const
						}))
						const existingGlobalRoles = prev.filter((role) => role.scope === "global")
						return [...existingGlobalRoles, ...workspaceRoles]
					})
					break
				case "anhGlobalRolesLoaded":
					console.log("=== UserAvatar: ANH Global Roles Loaded ===")
					console.log("Received global roles:", message.globalRoles)
					setRoles((prev) => {
						const globalRoles = (message.globalRoles || []).map((role: RoleSummary) => ({
							...role,
							scope: "global" as const
						}))
						const existingWorkspaceRoles = prev.filter((role) => role.scope === "workspace")
						return [...globalRoles, ...existingWorkspaceRoles]
					})
					break
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [])

	// Localized copy of the built-in default assistant role for settings view
	const defaultRole: Role = React.useMemo(
		() => ({
			...DEFAULT_ASSISTANT_ROLE,
			name: t("settings:userAvatar.noRole"),
			description: t("settings:userAvatar.noRoleDescription"),
		}),
		[t],
	)

	// Combine all roles including default role for display
	const allRoles = React.useMemo(() => {
		const roleList = roles
			.filter((summary) => summary.uuid !== DEFAULT_ASSISTANT_ROLE_UUID)
			.map(
				(summary) =>
					({
						...summary,
						description: summary.name, // Use name as description for display
						createdAt: summary.lastUpdatedAt,
						updatedAt: summary.lastUpdatedAt,
					}) as Role,
			)

		// Add default role at the beginning
		return [defaultRole, ...roleList]
	}, [roles, defaultRole])

	// Find the selected role
	const selectedRole = React.useMemo(() => {
		if (!userAvatarRole?.uuid) {
			return defaultRole
		}

		if (userAvatarRole.uuid === DEFAULT_ASSISTANT_ROLE_UUID) {
			return {
				...defaultRole,
				...userAvatarRole,
				name: defaultRole.name,
				description: defaultRole.description,
			}
		}

		if (userAvatarRole.profile && Object.keys(userAvatarRole.profile).length > 0) {
			return userAvatarRole
		}
		return allRoles.find((role) => role.uuid === userAvatarRole.uuid) || userAvatarRole
	}, [userAvatarRole, allRoles, defaultRole])

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

	const onClearSearch = useCallback(() => {
		setSearchValue("")
		searchInputRef.current?.focus()
	}, [])

	const handleSelect = useCallback(
		(role: Role) => {
			setOpen(false)
			setSearchValue("")
			
			const targetUuid = role.uuid ?? DEFAULT_ASSISTANT_ROLE_UUID
			if (targetUuid !== DEFAULT_ASSISTANT_ROLE_UUID) {
				// Load the complete role data using UserAvatar-specific message
				vscode.postMessage({
					type: "loadUserAvatarRole",
					roleUuid: targetUuid,
				})
				
				// Set a temporary role while loading
				setCachedStateField("userAvatarRole", role)
			} else {
				// Clear the role
				setCachedStateField("userAvatarRole", undefined)
			}
		},
		[setCachedStateField],
	)

	// Handle role loaded message to update with complete role data
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data

			if (message.type === "userAvatarRoleLoaded" && message.role) {
				// Check if this is the role we're waiting for
				if (message.role.uuid === userAvatarRole?.uuid || !userAvatarRole?.uuid) {
					setCachedStateField("userAvatarRole", message.role)
				}
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [userAvatarRole?.uuid, setCachedStateField])

	const onOpenChange = useCallback(
		(isOpen: boolean) => {
			setOpen(isOpen)

			// Clear search when closing
			if (!isOpen) {
				setSearchValue("")
			}
		},
		[],
	)

	// Auto-focus search input when popover opens
	useEffect(() => {
		if (open && searchInputRef.current) {
			searchInputRef.current.focus()
		}
	}, [open])

	const SEARCH_THRESHOLD = 6
	const showSearch = !loadError && allRoles.length > SEARCH_THRESHOLD

	return (
		<Section>
			<SectionHeader>
				<div className="flex items-center gap-2">
					<User className="w-4" />
					<div>{t("settings:userAvatar.title")}</div>
				</div>
			</SectionHeader>

			<div className="space-y-4">
				{/* Enable/Disable User Avatar */}
				<div className="flex items-center justify-between">
					<div className="flex flex-col gap-1">
						<div className="text-sm font-medium">{t("settings:userAvatar.enable")}</div>
						<div className="text-xs text-vscode-descriptionForeground">
							{t("settings:userAvatar.enableDescription")}
						</div>
					</div>
					<Button
						variant={enableUserAvatar ? "default" : "secondary"}
						size="sm"
						onClick={() => setCachedStateField("enableUserAvatar", !enableUserAvatar)}
						className="flex items-center gap-2">
						{enableUserAvatar ? <User className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
						{enableUserAvatar ? t("settings:common.enabled") : t("settings:common.disabled")}
					</Button>
				</div>

				{/* Visibility selection */}
				{enableUserAvatar && (
					<div className="flex flex-col gap-2">
						<div className="flex flex-col gap-1">
							<div className="text-sm font-medium">{t("settings:userAvatar.visibility.label")}</div>
							<div className="text-xs text-vscode-descriptionForeground">
								{t("settings:userAvatar.visibility.description")}
							</div>
						</div>
						<Select
							value={userAvatarVisibility ?? "full"}
							onValueChange={(value) => {
								setCachedStateField("userAvatarVisibility", value as UserAvatarVisibility)
								setCachedStateField("userAvatarHideFullData", value !== "full")
							}}>
							<SelectTrigger className="w-full sm:w-64">
								<SelectValue placeholder={t("settings:userAvatar.visibility.placeholder")} />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="full">{t("settings:userAvatar.visibility.options.full")}</SelectItem>
								<SelectItem value="summary">
									{t("settings:userAvatar.visibility.options.summary")}
								</SelectItem>
								<SelectItem value="name">{t("settings:userAvatar.visibility.options.name")}</SelectItem>
								<SelectItem value="hidden">
									{t("settings:userAvatar.visibility.options.hidden")}
								</SelectItem>
							</SelectContent>
						</Select>
					</div>
				)}

				{/* Role Selection */}
				{enableUserAvatar && (
					<div className="flex flex-col gap-2">
						<div className="text-sm font-medium">{t("settings:userAvatar.selectRole")}</div>
						<div className="text-xs text-vscode-descriptionForeground mb-2">
							{t("settings:userAvatar.selectRoleDescription")}
						</div>

						{/* Role Selector */}
						<div className="relative">
							<StandardTooltip content={t("settings:userAvatar.selectRoleTooltip")}>
								<button
									type="button"
									onClick={() => onOpenChange(!open)}
									className={cn(
										"w-full px-3 py-2 text-left bg-vscode-input-background border border-vscode-input-border rounded-md text-vscode-foreground",
										"flex items-center justify-between gap-2",
										"hover:bg-vscode-input-hoverBackground focus:outline-none focus:ring-1 focus:ring-vscode-focusBorder",
									)}>
									<div className="flex items-center gap-2 min-w-0 flex-1">
										{selectedRole?.color && (
											<div
												className="w-3 h-3 rounded-full flex-shrink-0"
												style={{ backgroundColor: selectedRole.color }}
											/>
										)}
										{/* Global/Workspace indicator */}
										{!selectedRole || selectedRole.uuid === DEFAULT_ASSISTANT_ROLE_UUID ? (
											<span title="默认角色">
												<Bot className="w-3 h-3 text-gray-400 flex-shrink-0" />
											</span>
										) : selectedRole.scope === "global" ? (
											<span title="全局角色">
												<Globe className="w-3 h-3 text-blue-400 flex-shrink-0" />
											</span>
										) : (
											<span title="工作区角色">
												<Folder className="w-3 h-3 text-green-400 flex-shrink-0" />
											</span>
										)}
										<span className="truncate">{selectedRole?.name || ""}</span>
									</div>
									<div className="flex items-center gap-1">
										<span className="text-xs text-vscode-descriptionForeground">
											{selectedRole?.type}
										</span>
									</div>
								</button>
							</StandardTooltip>

							{/* Dropdown */}
							{open && (
								<div className="absolute top-full left-0 right-0 z-50 mt-1 bg-vscode-dropdown-background border border-vscode-dropdown-border rounded-md shadow-lg">
									<div className="flex flex-col w-full">
										{loadError ? (
											<div className="p-3 border-b border-vscode-dropdown-border">
												<p className="m-0 text-xs text-orange-500 text-center">
													{t("settings:userAvatar.loadError")}
												</p>
											</div>
										) : showSearch ? (
											<div className="relative p-2 border-b border-vscode-dropdown-border">
												<input
													aria-label="Search roles"
													ref={searchInputRef}
													value={searchValue}
													onChange={(e) => setSearchValue(e.target.value)}
													placeholder={t("settings:userAvatar.searchPlaceholder")}
													className="w-full h-8 px-2 py-1 text-xs bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded focus:outline-0"
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
												<p className="m-0 text-xs text-vscode-descriptionForeground">
													{t("settings:userAvatar.description")}
												</p>
											</div>
										)}

										{/* Role List */}
										<div ref={scrollContainerRef} className="max-h-[300px] overflow-y-auto">
											{filteredRoles.length === 0 && searchValue ? (
												<div className="py-2 px-3 text-sm text-vscode-foreground/70">
													{t("settings:userAvatar.noResults")}
												</div>
											) : (
												<div className="py-1">
													{filteredRoles.map((role) => {
														const isSelected = role.uuid === selectedRole?.uuid
														return (
															<div
																key={role.uuid}
																onClick={() => handleSelect(role)}
																className={cn(
																	"px-3 py-1.5 text-sm cursor-pointer flex items-center gap-2",
																	"hover:bg-vscode-list-hoverBackground",
																	isSelected
																		? "bg-vscode-list-activeSelectionBackground text-vscode-list-activeSelectionForeground"
																		: "",
																)}>
																{role.color && (
																	<div
																		className="w-3 h-3 rounded-full flex-shrink-0"
																		style={{ backgroundColor: role.color }}
																	/>
																)}
																<div className="flex-1 min-w-0">
																	<div className="flex items-center gap-2">
																		{/* Global/Workspace indicator */}
																		{role.uuid === DEFAULT_ASSISTANT_ROLE_UUID ? (
																			<span title="默认角色">
																				<Bot className="w-3 h-3 text-gray-400 flex-shrink-0" />
																			</span>
																		) : role.scope === "global" ? (
																			<span title="全局角色">
																				<Globe className="w-3 h-3 text-blue-400 flex-shrink-0" />
																			</span>
																		) : (
																			<span title="工作区角色">
																				<Folder className="w-3 h-3 text-green-400 flex-shrink-0" />
																			</span>
																		)}
																		<div className="font-bold truncate">{role.name}</div>
																	</div>
																	{role.description && (
																		<div className="text-xs text-vscode-descriptionForeground truncate">
																			{role.description}
																		</div>
																	)}
																</div>
																{isSelected && <Check className="size-4 p-0.5" />}
															</div>
														)
													})}
												</div>
											)}
										</div>
									</div>
								</div>
							)}
						</div>

						{/* Selected Role Info */}
						{selectedRole && selectedRole.uuid && selectedRole.uuid !== DEFAULT_ASSISTANT_ROLE_UUID && (
							<div className="mt-3 p-3 bg-vscode-textBlockQuote-background border-l-4 border-vscode-textBlockQuote-border rounded-r-md">
								<div className="flex items-center gap-2 mb-2">
									{selectedRole.color && (
										<div
											className="w-4 h-4 rounded-full flex-shrink-0"
											style={{ backgroundColor: selectedRole.color }}
										/>
									)}
									{/* Global/Workspace indicator */}
									{selectedRole.uuid === DEFAULT_ASSISTANT_ROLE_UUID ? (
										<span title="默认角色">
											<Bot className="w-3 h-3 text-gray-400 flex-shrink-0" />
										</span>
									) : selectedRole.scope === "global" ? (
										<span title="全局角色">
											<Globe className="w-3 h-3 text-blue-400 flex-shrink-0" />
										</span>
									) : (
										<span title="工作区角色">
											<Folder className="w-3 h-3 text-green-400 flex-shrink-0" />
										</span>
									)}
									<div className="font-medium">{selectedRole.name}</div>
									<div className="text-xs text-vscode-descriptionForeground">
										({selectedRole.type})
									</div>
								</div>
								{selectedRole.description && (
									<div className="text-sm text-vscode-descriptionForeground mb-2">
										{selectedRole.description}
									</div>
								)}
								{selectedRole.aliases && selectedRole.aliases.length > 0 && (
									<div className="text-xs text-vscode-descriptionForeground">
										{t("settings:userAvatar.aliases")}: {selectedRole.aliases.join(", ")}
									</div>
								)}
							</div>
						)}
					</div>
				)}
			</div>
		</Section>
	)
}

export default UserAvatarSettings
