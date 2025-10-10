import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Info, X } from "lucide-react"
import { Fzf } from "fzf"

import {
	type Role,
	type RoleSummary,
	DEFAULT_ASSISTANT_ROLE,
	DEFAULT_ASSISTANT_ROLE_UUID,
} from "@roo-code/types"

import { vscode } from "@/utils/vscode"
import { cn } from "@/lib/utils"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { StandardTooltip } from "@/components/ui"

import { Section } from "./Section"
import { SectionHeader } from "./SectionHeader"
import { SetCachedStateField } from "./types"
import type { ExtensionStateContextType } from "@/context/ExtensionStateContext"

interface AssistantRoleSettingsProps {
	currentRole?: Role
	setCachedStateField: SetCachedStateField<keyof ExtensionStateContextType>
}

const fieldsToRender: Array<{ key: keyof Role; translationId: string }> = [
	{ key: "type", translationId: "settings:assistantRole.fields.type" },
	{ key: "description", translationId: "settings:assistantRole.fields.description" },
	{ key: "personality", translationId: "settings:assistantRole.fields.personality" },
	{ key: "scenario", translationId: "settings:assistantRole.fields.scenario" },
	{ key: "first_mes", translationId: "settings:assistantRole.fields.greeting" },
	{ key: "system_prompt", translationId: "settings:assistantRole.fields.systemPrompt" },
]

const SEARCH_THRESHOLD = 6

export const AssistantRoleSettings: React.FC<AssistantRoleSettingsProps> = ({
	currentRole,
	setCachedStateField,
}) => {
	const { t } = useAppTranslation()
	const { clineMessages, setCurrentAnhRole } = useExtensionState()
	const [detailedRole, setDetailedRole] = useState<Role | undefined>()
	const [roleDetails, setRoleDetails] = useState<Record<string, Role>>({
		[DEFAULT_ASSISTANT_ROLE_UUID]: DEFAULT_ASSISTANT_ROLE,
	})
	const [roles, setRoles] = useState<RoleSummary[]>([])
	const [hasLoaded, setHasLoaded] = useState(false)
	const [loadError, setLoadError] = useState(false)
	const [open, setOpen] = useState(false)
	const [searchValue, setSearchValue] = useState("")
	const searchInputRef = useRef<HTMLInputElement>(null)
	const selectedItemRef = useRef<HTMLDivElement>(null)
	const scrollContainerRef = useRef<HTMLDivElement>(null)
	const currentRoleUuidRef = useRef<string | undefined>(currentRole?.uuid)

	useEffect(() => {
		vscode.postMessage({ type: "getAnhRoles" })

		const timeout = setTimeout(() => {
			if (!hasLoaded) {
				setLoadError(true)
			}
		}, 3000)

		return () => clearTimeout(timeout)
	}, [hasLoaded])

	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data

			if (message.type === "anhRolesLoaded") {
				setHasLoaded(true)
				setLoadError(false)
				setRoles(message.roles || [])
			} else if (message.type === "anhRoleLoaded") {
				const role = message.role as Role | undefined
				const uuid = role?.uuid ?? DEFAULT_ASSISTANT_ROLE_UUID

				if (role) {
					setRoleDetails((prev) => ({
						...prev,
						[uuid]: role,
					}))

					if (uuid === currentRoleUuidRef.current) {
						setDetailedRole(role)
					}
				}
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [])

	useEffect(() => {
		if (open && searchInputRef.current) {
			searchInputRef.current.focus()
		}
	}, [open])

	useEffect(() => {
		currentRoleUuidRef.current = currentRole?.uuid ?? DEFAULT_ASSISTANT_ROLE_UUID
	}, [currentRole?.uuid])

	const defaultDisplayRole: Role = useMemo(
		() => ({
			...DEFAULT_ASSISTANT_ROLE,
			name: t("chat:roleSelector.defaultRole"),
			description: DEFAULT_ASSISTANT_ROLE.description,
		}),
		[t],
	)

	const allRoles = useMemo(() => {
		const roleList = roles.map(
			(summary) =>
				({
					...summary,
					description: summary.name,
					createdAt: summary.lastUpdatedAt,
					updatedAt: summary.lastUpdatedAt,
				}) as Role,
		)

		return [defaultDisplayRole, ...roleList]
	}, [roles, defaultDisplayRole])

	const selectedRole = useMemo(() => {
		const base = detailedRole ?? currentRole

		if (!base?.uuid || base.uuid === DEFAULT_ASSISTANT_ROLE_UUID) {
			return defaultDisplayRole
		}

	const match = allRoles.find((role) => role.uuid === base.uuid)
	return match ?? base
}, [detailedRole, currentRole, allRoles, defaultDisplayRole])

	useEffect(() => {
		if (!currentRole) {
			setDetailedRole(DEFAULT_ASSISTANT_ROLE)
			currentRoleUuidRef.current = DEFAULT_ASSISTANT_ROLE_UUID
			return
		}

		const uuid = currentRole.uuid ?? DEFAULT_ASSISTANT_ROLE_UUID
		const cached = roleDetails[uuid]

		if (cached) {
			setDetailedRole(cached)
		} else {
			setDetailedRole(currentRole)
			if (!roleDetails[uuid]) {
				vscode.postMessage({
					type: "loadAnhRole",
					roleUuid: uuid,
				})
			}
		}
	}, [currentRole, roleDetails])

	const nameSearchItems = useMemo(() => {
		return allRoles.map((role) => ({
			original: role,
			searchStr: [role.name, role.uuid].filter(Boolean).join(" "),
		}))
	}, [allRoles])

	const descriptionSearchItems = useMemo(() => {
		return allRoles.map((role) => ({
			original: role,
			searchStr: role.description || "",
		}))
	}, [allRoles])

	const nameFzfInstance = useMemo(
		() => new Fzf(nameSearchItems, { selector: (item) => item.searchStr }),
		[nameSearchItems],
	)
	const descriptionFzfInstance = useMemo(
		() => new Fzf(descriptionSearchItems, { selector: (item) => item.searchStr }),
		[descriptionSearchItems],
	)

	const filteredRoles = useMemo(() => {
		if (!searchValue) return allRoles

		const matches = new Map<string, Role>()
		for (const result of nameFzfInstance.find(searchValue)) {
			matches.set(result.item.original.uuid, result.item.original)
		}
		for (const result of descriptionFzfInstance.find(searchValue)) {
			matches.set(result.item.original.uuid, result.item.original)
		}
		return Array.from(matches.values())
	}, [allRoles, nameFzfInstance, descriptionFzfInstance, searchValue])

	useEffect(() => {
		if (open && selectedItemRef.current && scrollContainerRef.current) {
			const container = scrollContainerRef.current
			const item = selectedItemRef.current
			const itemTop = item.offsetTop
			const itemBottom = itemTop + item.offsetHeight
			if (itemTop < container.scrollTop) {
				container.scrollTop = itemTop
			} else if (itemBottom > container.scrollTop + container.clientHeight) {
				container.scrollTop = itemBottom - container.clientHeight
			}
		}
	}, [open, selectedRole])

	const allowImmediateSwitch = clineMessages.length === 0
	const showSearch = !loadError && allRoles.length > SEARCH_THRESHOLD

	const handleRoleChange = useCallback(
		(role: Role) => {
			if (!allowImmediateSwitch) {
				const confirmed = window.confirm(
					t("settings:assistantRole.forceSwitchConfirm", { role: role.name }),
				)
				if (!confirmed) {
					return
				}
			}

			setOpen(false)
			setSearchValue("")

			const resolvedRole =
				role.uuid === DEFAULT_ASSISTANT_ROLE_UUID ? DEFAULT_ASSISTANT_ROLE : role
			const resolvedUuid = resolvedRole.uuid ?? DEFAULT_ASSISTANT_ROLE_UUID

			vscode.postMessage({
				type: "loadAnhRole",
				roleUuid: resolvedUuid,
			})

			setDetailedRole(roleDetails[resolvedUuid] ?? resolvedRole)
			setCachedStateField("currentAnhRole", resolvedRole)
			setCurrentAnhRole?.(resolvedRole)
		},
		[allowImmediateSwitch, roleDetails, setCachedStateField, setCurrentAnhRole, t],
	)

	const profileEntries = useMemo(() => {
		const target = detailedRole ?? currentRole

		if (!target?.profile || Object.keys(target.profile).length === 0) {
			return []
		}

		return Object.entries(target.profile).map(([key, value]) => ({
			key,
			value,
		}))
	}, [detailedRole, currentRole])

	return (
		<Section>
			<SectionHeader description={t("settings:assistantRole.description")}>
				<div className="flex items-center gap-2">
					<Info className="w-4" />
					{t("settings:assistantRole.title")}
				</div>
			</SectionHeader>

			<div className="flex flex-col gap-4 lg:flex-row">
				<div className="lg:w-72 lg:flex-shrink-0 space-y-3">
					<p className="m-0 text-xs text-vscode-descriptionForeground">
						{t("settings:assistantRole.selectorDescription")}
					</p>
					<div className="relative">
						<StandardTooltip content={t("settings:assistantRole.selectorLabel")}>
							<button
								type="button"
								onClick={() => setOpen((prev) => !prev)}
								className={cn(
									"w-full h-10 px-3 py-2 flex items-center justify-between gap-2",
									"bg-vscode-input-background border border-vscode-input-border rounded-md text-left text-sm font-medium",
									"hover:bg-vscode-input-hoverBackground focus:outline-none focus:ring-1 focus:ring-vscode-focusBorder",
								)}>
								<div className="flex items-center gap-2 min-w-0 flex-1">
									{selectedRole?.color && (
										<div
											className="w-3 h-3 rounded-full flex-shrink-0"
											style={{ backgroundColor: selectedRole.color }}
										/>
									)}
									<span className="truncate">{selectedRole?.name || ""}</span>
								</div>
								<span className="codicon codicon-chevron-down text-xs opacity-70" />
							</button>
						</StandardTooltip>

						{open && (
							<div className="absolute top-full left-0 right-0 z-50 mt-1 bg-vscode-dropdown-background border border-vscode-dropdown-border rounded-md shadow-lg">
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
											/>
											{searchValue.length > 0 && (
												<div className="absolute right-4 top-0 bottom-0 flex items-center justify-center">
													<X
														className="text-vscode-input-foreground opacity-50 hover:opacity-100 size-4 p-0.5 cursor-pointer"
														onClick={() => setSearchValue("")}
													/>
												</div>
											)}
										</div>
									) : (
										<div className="p-3 border-b border-vscode-dropdown-border">
											<p className="m-0 text-xs text-vscode-descriptionForeground">
												{t("settings:assistantRole.description")}
											</p>
										</div>
									)}

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
															onClick={() => handleRoleChange(role)}
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
																<div className="font-bold truncate">{role.name}</div>
																{role.description && (
																	<div className="text-xs text-vscode-descriptionForeground truncate">
																		{role.description}
																	</div>
																)}
															</div>
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
				</div>

				<div className="flex-1 border border-vscode-dropdown-border rounded-md p-4 space-y-4 overflow-y-auto max-h-[420px]">
					{fieldsToRender.map(({ key, translationId }) => {
						const value = currentRole?.[key]
						if (!value) {
							return null
						}

						return (
							<div key={key as string} className="space-y-1">
								<p className="m-0 text-xs uppercase tracking-wide text-vscode-descriptionForeground">
									{t(translationId)}
								</p>
								<p className="m-0 text-sm whitespace-pre-wrap leading-relaxed">
									{Array.isArray(value) ? value.join(", ") : String(value)}
								</p>
							</div>
						)
					})}

					<div>
						<p className="m-0 mb-1 text-xs uppercase tracking-wide text-vscode-descriptionForeground">
							{t("settings:assistantRole.profileTitle")}
						</p>
						{profileEntries.length === 0 ? (
							<p className="m-0 text-sm text-vscode-descriptionForeground">
								{t("settings:assistantRole.noProfile")}
							</p>
						) : (
							<div className="space-y-2">
								{profileEntries.map(({ key, value }) => (
									<div
										key={key}
										className="border border-vscode-input-border rounded-md p-2 bg-vscode-input-background/40">
										<p className="m-0 text-xs font-semibold uppercase tracking-wide text-vscode-descriptionForeground">
											{key}
										</p>
										<p className="m-0 mt-1 text-sm whitespace-pre-wrap leading-relaxed">
											{Array.isArray(value)
												? value
														.map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
														.join("\n")
												: typeof value === "string"
													? value
													: JSON.stringify(value, null, 2)}
										</p>
									</div>
								))}
							</div>
						)}
					</div>
				</div>
			</div>
		</Section>
	)
}


