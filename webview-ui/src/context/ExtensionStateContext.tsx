import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

import {
	type ProviderSettings,
	type ProviderSettingsEntry,
	type CustomModePrompts,
	type ModeConfig,
	type ExperimentId,
	type TodoItem,
	type TelemetrySetting,
	type OrganizationAllowList,
	type CloudOrganizationMembership,
	type Role,
	type UserAvatarVisibility,
	type AnhExtensionRuntimeState,
	type AnhExtensionCapabilityRegistry,
	type WorkspaceContextSettingKey,
	type WorkspaceContextSettings,
	ORGANIZATION_ALLOW_ALL,
} from "@roo-code/types"
import { DEFAULT_WORKSPACE_CONTEXT_SETTINGS, WORKSPACE_CONTEXT_SETTING_KEYS } from "@roo-code/types"

import { ExtensionMessage, ExtensionState, MarketplaceInstalledMetadata, Command } from "@roo/ExtensionMessage"
import { findLastIndex } from "@roo/array"
import { McpServer } from "@roo/mcp"
import { checkExistKey } from "@roo/checkExistApiConfig"
import { Mode, defaultModeSlug, defaultPrompts } from "@roo/modes"
import { CustomSupportPrompts } from "@roo/support-prompt"
import { experimentDefault } from "@roo/experiments"
import { RouterModels } from "@roo/api"

import { vscode } from "@src/utils/vscode"
import { convertTextMateToHljs } from "@src/utils/textMateToHljs"
import { useMessageListener } from "@src/hooks/useMessageListener"

// Add the normalizeWorkspaceContextSettings function
const normalizeWorkspaceContextSettings = (
	raw: WorkspaceContextSettings | undefined,
): Record<WorkspaceContextSettingKey, boolean> => {
	const resolved = { ...DEFAULT_WORKSPACE_CONTEXT_SETTINGS }

	if (raw) {
		for (const key of WORKSPACE_CONTEXT_SETTING_KEYS) {
			const value = raw[key]
			if (typeof value === "boolean") {
				resolved[key] = value
			}
		}
	}

	return resolved
}

// 扩展ExtensionState接口以包含内部状态
interface ExtendedExtensionState extends ExtensionState {
	_isResetting?: boolean
	_isSavingTSProfile?: boolean
	worldsetHasChanges?: boolean
	enableRooCloudServices?: boolean
	customUserAgent?: string
	customUserAgentMode?: "segments" | "full"
	customUserAgentFull?: string
	variableStateDisplayRows?: number
	variableStateDisplayColumns?: number
	useRefactoredSystemPrompt?: boolean
	enableInjectSystemPromptVariables?: boolean
	enableUIDebug?: boolean
	uiDebugComponents?: string[]
	outputStreamProcessorConfig?: any
}

export interface ExtensionStateContextType extends ExtendedExtensionState {
	historyPreviewCollapsed?: boolean // Add the new state property
	didHydrateState: boolean
	activateStandaloneDemoMode: () => void
	showWelcome: boolean
	theme: any
	mcpServers: McpServer[]
	hasSystemPromptOverride?: boolean
	currentCheckpoint?: string
	currentTaskTodos?: TodoItem[] // Initial todos for the current task
	filePaths: string[]
	openedTabs: Array<{ label: string; isActive: boolean; path?: string }>
	commands: Command[]
	organizationAllowList: OrganizationAllowList
	organizationSettingsVersion: number
	cloudIsAuthenticated: boolean
	cloudOrganizations?: CloudOrganizationMembership[]
	sharingEnabled: boolean
	maxConcurrentFileReads?: number
	mdmCompliant?: boolean
	hasOpenedModeSelector: boolean // New property to track if user has opened mode selector
	setHasOpenedModeSelector: (value: boolean) => void // Setter for the new property
	alwaysAllowFollowupQuestions: boolean // New property for follow-up questions auto-approve
	setAlwaysAllowFollowupQuestions: (value: boolean) => void // Setter for the new property
	followupAutoApproveTimeoutMs: number | undefined // Timeout in ms for auto-approving follow-up questions
	setFollowupAutoApproveTimeoutMs: (value: number) => void // Setter for the timeout
	condensingApiConfigId?: string
	setCondensingApiConfigId: (value: string) => void
	customCondensingPrompt?: string
	setCustomCondensingPrompt: (value: string) => void
	marketplaceItems?: any[]
	marketplaceInstalledMetadata?: MarketplaceInstalledMetadata
	profileThresholds: Record<string, number>
	setProfileThresholds: (value: Record<string, number>) => void
	setApiConfiguration: (config: ProviderSettings) => void
	setCustomInstructions: (value?: string) => void
	setAlwaysAllowReadOnly: (value: boolean) => void
	setAlwaysAllowReadOnlyOutsideWorkspace: (value: boolean) => void
	setAlwaysAllowWrite: (value: boolean) => void
	setAlwaysAllowWriteOutsideWorkspace: (value: boolean) => void
	setAlwaysAllowExecute: (value: boolean) => void
	setAlwaysAllowBrowser: (value: boolean) => void
	setAlwaysAllowMcp: (value: boolean) => void
	setAlwaysAllowModeSwitch: (value: boolean) => void
	setAlwaysAllowSubtasks: (value: boolean) => void
	setBrowserToolEnabled: (value: boolean) => void
	setShowRooIgnoredFiles: (value: boolean) => void
	setShowAnnouncement: (value: boolean) => void
	setAllowedCommands: (value: string[]) => void
	setDeniedCommands: (value: string[]) => void
	setAllowedMaxRequests: (value: number | undefined) => void
	setAllowedMaxCost: (value: number | undefined) => void
	setSoundEnabled: (value: boolean) => void
	setSoundVolume: (value: number) => void
	terminalShellIntegrationTimeout?: number
	setTerminalShellIntegrationTimeout: (value: number) => void
	terminalShellIntegrationDisabled?: boolean
	setTerminalShellIntegrationDisabled: (value: boolean) => void
	terminalZdotdir?: boolean
	setTerminalZdotdir: (value: boolean) => void
	setTtsEnabled: (value: boolean) => void
	setTtsSpeed: (value: number) => void
	setDiffEnabled: (value: boolean) => void
	setEnableCheckpoints: (value: boolean) => void
	setBrowserViewportSize: (value: string) => void
	setFuzzyMatchThreshold: (value: number) => void
	setWriteDelayMs: (value: number) => void
	screenshotQuality?: number
	setScreenshotQuality: (value: number) => void
	terminalOutputLineLimit?: number
	setTerminalOutputLineLimit: (value: number) => void
	terminalOutputCharacterLimit?: number
	setTerminalOutputCharacterLimit: (value: number) => void
	mcpEnabled: boolean
	setMcpEnabled: (value: boolean) => void
	enableMcpServerCreation: boolean
	setEnableMcpServerCreation: (value: boolean) => void
	remoteControlEnabled: boolean
	setRemoteControlEnabled: (value: boolean) => void
	taskSyncEnabled: boolean
	setTaskSyncEnabled: (value: boolean) => void
	featureRoomoteControlEnabled: boolean
	setFeatureRoomoteControlEnabled: (value: boolean) => void
	workspaceContextSettings: Record<WorkspaceContextSettingKey, boolean>
	setWorkspaceContextSetting: (key: WorkspaceContextSettingKey, value: boolean) => void
	setAllWorkspaceContextSettings: (value: boolean) => void
	alwaysApproveResubmit?: boolean
	setAlwaysApproveResubmit: (value: boolean) => void
	requestDelaySeconds: number
	setRequestDelaySeconds: (value: number) => void
	setCurrentApiConfigName: (value: string) => void
	setListApiConfigMeta: (value: ProviderSettingsEntry[]) => void
	mode: Mode
	setMode: (value: Mode) => void
	setCustomModePrompts: (value: CustomModePrompts) => void
	setCustomSupportPrompts: (value: CustomSupportPrompts) => void
	enhancementApiConfigId?: string
	setEnhancementApiConfigId: (value: string) => void
	setExperimentEnabled: (id: ExperimentId, enabled: boolean) => void
	setAutoApprovalEnabled: (value: boolean) => void
	customModes: ModeConfig[]
	setCustomModes: (value: ModeConfig[]) => void
	setMaxOpenTabsContext: (value: number) => void
	maxWorkspaceFiles: number
	setMaxWorkspaceFiles: (value: number) => void
	setTelemetrySetting: (value: TelemetrySetting) => void
	remoteBrowserEnabled?: boolean
	setRemoteBrowserEnabled: (value: boolean) => void
	awsUsePromptCache?: boolean
	setAwsUsePromptCache: (value: boolean) => void
	maxReadFileLine: number
	setMaxReadFileLine: (value: number) => void
	maxImageFileSize: number
	setMaxImageFileSize: (value: number) => void
	maxTotalImageSize: number
	setMaxTotalImageSize: (value: number) => void
	machineId?: string
	pinnedApiConfigs?: Record<string, boolean>
	setPinnedApiConfigs: (value: Record<string, boolean>) => void
	togglePinnedApiConfig: (configName: string) => void
	terminalCompressProgressBar?: boolean
	setTerminalCompressProgressBar: (value: boolean) => void
	setHistoryPreviewCollapsed: (value: boolean) => void
	setReasoningBlockCollapsed: (value: boolean) => void
	autoCondenseContext: boolean
	setAutoCondenseContext: (value: boolean) => void
	autoCondenseContextPercent: number
	setAutoCondenseContextPercent: (value: number) => void
	routerModels?: RouterModels
	alwaysAllowUpdateTodoList?: boolean
	setAlwaysAllowUpdateTodoList: (value: boolean) => void
	includeDiagnosticMessages?: boolean
	setIncludeDiagnosticMessages: (value: boolean) => void
	maxDiagnosticMessages?: number
	setMaxDiagnosticMessages: (value: number) => void
	includeTaskHistoryInEnhance?: boolean
	setIncludeTaskHistoryInEnhance: (value: boolean) => void
	currentAnhRole?: Role
	setCurrentAnhRole: (value: Role | undefined) => void
	anhPersonaMode?: "hybrid" | "chat"
	setAnhPersonaMode: (value: "hybrid" | "chat") => void
	anhToneStrict?: boolean
	setAnhToneStrict: (value: boolean) => void
	anhUseAskTool?: boolean
	setAnhUseAskTool: (value: boolean) => void
	anhChatModeHideTaskCompletion?: boolean
	setAnhChatModeHideTaskCompletion: (value: boolean) => void
	anhShowRoleCardOnSwitch?: boolean
	setAnhShowRoleCardOnSwitch: (value: boolean) => void
	enabledTSProfiles?: string[]
	setEnabledTSProfiles: (value: string[]) => void
	anhTsProfileAutoInject?: boolean
	setAnhTsProfileAutoInject: (value: boolean) => void
	anhTsProfileVariables?: Record<string, string>
	setAnhTsProfileVariables: (value: Record<string, string>) => void
	displayMode?: "coding" | "chat"
	setDisplayMode: (value: "coding" | "chat") => void
	enableUserAvatar?: boolean
	setEnableUserAvatar: (value: boolean) => void
	userAvatarVisibility?: UserAvatarVisibility
	setUserAvatarVisibility: (value: UserAvatarVisibility) => void
	userAvatarHideFullData?: boolean
	setUserAvatarHideFullData: (value: boolean) => void
	userAvatarRole?: Role
	setUserAvatarRole: (value: Role | undefined) => void
	hideRoleDescription?: boolean
	setHideRoleDescription: (value: boolean) => void
	allowNoToolsInChatMode?: boolean
	setAllowNoToolsInChatMode: (value: boolean) => void
	variableStateDisplayRows?: number
	setVariableStateDisplayRows: (value: number) => void
	variableStateDisplayColumns?: number
	setVariableStateDisplayColumns: (value: number) => void
	enableInjectSystemPromptVariables?: boolean
	setEnableInjectSystemPromptVariables: (value: boolean) => void
	setUseRefactoredSystemPrompt: (value: boolean) => void
	enableUIDebug?: boolean
	setEnableUIDebug: (value: boolean) => void
	uiDebugComponents?: string[]
	setUIDebugComponents: (value: string[]) => void
	anhExtensionsRuntime?: AnhExtensionRuntimeState[]
	anhExtensionCapabilityRegistry?: AnhExtensionCapabilityRegistry
	setAnhExtensionEnabled: (compositeKey: string, enabled: boolean) => void
	anhExtensionSettings?: Record<string, Record<string, unknown>>
	setAnhExtensionSettings: (value: Record<string, Record<string, unknown>>) => void
	updateAnhExtensionSetting: (id: string, key: string, value: unknown) => void
	saveAnhExtensionChanges: () => void
	resetAnhExtensionChanges: () => void
	tsProfilesHasChanges?: boolean
	saveTSProfileChanges: () => void
	resetTSProfileChanges: () => void
	worldsetHasChanges?: boolean
	setWorldsetHasChanges: (value: boolean) => void
	resetWorldsetChanges: () => void
	memorySystemEnabled?: boolean
	memoryToolsEnabled?: boolean
	enableRooCloudServices?: boolean
	setEnableRooCloudServices: (value: boolean) => void
	customUserAgent?: string
	setCustomUserAgent: (value: string) => void
	customUserAgentMode?: "segments" | "full"
	setCustomUserAgentMode: (value: "segments" | "full") => void
	customUserAgentFull?: string
	setCustomUserAgentFull: (value: string) => void
	outputStreamProcessorConfig?: any
	setOutputStreamProcessorConfig: (value: any) => void
}

export const ExtensionStateContext = createContext<ExtensionStateContextType | undefined>(undefined)

export const mergeExtensionState = (prevState: ExtendedExtensionState, newState: ExtensionState) => {
		// 安全检查：如果newState为undefined，返回prevState
		if (!newState) {
			console.warn("[ExtensionStateContext] mergeExtensionState called with undefined newState")
			return prevState
		}

		// 如果正在重置，只保留重置相关的状态，避免被其他状态更新覆盖
	if (prevState._isResetting) {
		const resetState: Partial<ExtendedExtensionState> = {}
		
		// 只合并允许在重置期间更新的状态
		if ('anhExtensionsEnabled' in newState) {
			resetState.anhExtensionsEnabled = newState.anhExtensionsEnabled
		}
		if ('anhExtensionSettings' in newState) {
			resetState.anhExtensionSettings = newState.anhExtensionSettings
		}
		if ('enabledTSProfiles' in newState) {
			resetState.enabledTSProfiles = newState.enabledTSProfiles
		}
		if ('anhTsProfileAutoInject' in newState) {
			resetState.anhTsProfileAutoInject = newState.anhTsProfileAutoInject
		}
		if ('anhTsProfileVariables' in newState) {
			resetState.anhTsProfileVariables = newState.anhTsProfileVariables
		}
		if ('worldsetHasChanges' in newState) {
			resetState.worldsetHasChanges = newState.worldsetHasChanges as boolean
		}
		
		return {
			...prevState,
			...resetState,
			_isResetting: false, // 清除重置标记
		} as ExtensionState
	}

	const { customModePrompts: prevCustomModePrompts, experiments: prevExperiments, ...prevRest } = prevState

	const {
		apiConfiguration,
		customModePrompts: newCustomModePrompts,
		customSupportPrompts,
		experiments: newExperiments,
		...newRest
	} = newState

	const customModePrompts = { ...prevCustomModePrompts, ...newCustomModePrompts }
	const experiments = { ...prevExperiments, ...newExperiments }
	const rest = { ...prevRest, ...newRest }
	const workspaceContextSettings = normalizeWorkspaceContextSettings(rest.workspaceContextSettings)
	console.debug("[WorkspaceContext] hydrate state", workspaceContextSettings)
	rest.workspaceContextSettings = workspaceContextSettings

	const resolveVisibility = (): UserAvatarVisibility => {
		const incomingVisibility = newRest.userAvatarVisibility
		if (
			incomingVisibility === "full" ||
			incomingVisibility === "summary" ||
			incomingVisibility === "name" ||
			incomingVisibility === "hidden"
		) {
			return incomingVisibility
		}

		if (typeof newRest.userAvatarHideFullData === "boolean") {
			return newRest.userAvatarHideFullData ? "summary" : "full"
		}

		const previousVisibility = prevRest.userAvatarVisibility
		if (
			previousVisibility === "full" ||
			previousVisibility === "summary" ||
			previousVisibility === "name" ||
			previousVisibility === "hidden"
		) {
			return previousVisibility
		}

		if (typeof prevRest.userAvatarHideFullData === "boolean") {
			return prevRest.userAvatarHideFullData ? "summary" : "full"
		}

		return "full"
	}

	rest.userAvatarVisibility = resolveVisibility()
	rest.userAvatarHideFullData =
		typeof rest.userAvatarHideFullData === "boolean"
			? rest.userAvatarHideFullData
			: rest.userAvatarVisibility !== "full"

	// Note that we completely replace the previous apiConfiguration and customSupportPrompts objects
	// with new ones since the state that is broadcast is the entire objects so merging is not necessary.
	return { ...rest, apiConfiguration, customModePrompts, customSupportPrompts, experiments }
}

export const ExtensionStateContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const [state, setState] = useState<ExtendedExtensionState>({
		apiConfiguration: {},
		version: "",
		clineMessages: [],
		taskHistory: [],
		shouldShowAnnouncement: false,
		allowedCommands: [],
		deniedCommands: [],
		soundEnabled: false,
		soundVolume: 0.5,
		ttsEnabled: false,
		ttsSpeed: 1.0,
		diffEnabled: false,
		enableCheckpoints: true,
		useRefactoredSystemPrompt: false,
		fuzzyMatchThreshold: 1.0,
		language: "en", // Default language code
		writeDelayMs: 1000,
		browserViewportSize: "900x600",
		screenshotQuality: 75,
		terminalOutputLineLimit: 500,
		terminalOutputCharacterLimit: 50000,
		workspaceContextSettings: { ...DEFAULT_WORKSPACE_CONTEXT_SETTINGS },
		terminalShellIntegrationTimeout: 4000,
		mcpEnabled: true,
		enableMcpServerCreation: false,
		remoteControlEnabled: false,
		taskSyncEnabled: false,
		featureRoomoteControlEnabled: false,
		alwaysApproveResubmit: false,
		requestDelaySeconds: 5,
		currentApiConfigName: "default",
		listApiConfigMeta: [],
		mode: defaultModeSlug,
		customModePrompts: defaultPrompts,
		customSupportPrompts: {},
		experiments: experimentDefault,
		enhancementApiConfigId: "",
		condensingApiConfigId: "", // Default empty string for condensing API config ID
		customCondensingPrompt: "", // Default empty string for custom condensing prompt
		hasOpenedModeSelector: false, // Default to false (not opened yet)
		autoApprovalEnabled: false,
		customModes: [],
		maxOpenTabsContext: 20,
		maxWorkspaceFiles: 200,
		cwd: "",
		browserToolEnabled: true,
		telemetrySetting: "unset",
		showRooIgnoredFiles: true, // Default to showing .rooignore'd files with lock symbol (current behavior).
		renderContext: "sidebar",
		maxReadFileLine: -1, // Default max read file line limit
		maxImageFileSize: 5, // Default max image file size in MB
		maxTotalImageSize: 20, // Default max total image size in MB
		pinnedApiConfigs: {}, // Empty object for pinned API configs
		terminalZshOhMy: false, // Default Oh My Zsh integration setting
		maxConcurrentFileReads: 5, // Default concurrent file reads
		terminalZshP10k: false, // Default Powerlevel10k integration setting
		terminalZdotdir: false, // Default ZDOTDIR handling setting
		terminalCompressProgressBar: true, // Default to compress progress bar output
		historyPreviewCollapsed: false, // Initialize the new state (default to expanded)
		reasoningBlockCollapsed: true, // Default to collapsed
		cloudUserInfo: null,
		cloudIsAuthenticated: false,
		cloudOrganizations: [],
		sharingEnabled: false,
		organizationAllowList: ORGANIZATION_ALLOW_ALL,
		organizationSettingsVersion: -1,
		autoCondenseContext: true,
		autoCondenseContextPercent: 100,
		profileThresholds: {},
		codebaseIndexConfig: {
			codebaseIndexEnabled: true,
			codebaseIndexQdrantUrl: "http://localhost:6333",
			codebaseIndexEmbedderProvider: "openai",
			codebaseIndexEmbedderBaseUrl: "",
			codebaseIndexEmbedderModelId: "",
			codebaseIndexSearchMaxResults: undefined,
			codebaseIndexSearchMinScore: undefined,
		},
		codebaseIndexModels: { ollama: {}, openai: {} },
		alwaysAllowUpdateTodoList: true,
		includeDiagnosticMessages: true,
		maxDiagnosticMessages: 50,
		openRouterImageApiKey: "",
		openRouterImageGenerationSelectedModel: "",
		enableUserAvatar: false,
		userAvatarVisibility: "full",
		userAvatarHideFullData: false,
		userAvatarRole: undefined,
		hideRoleDescription: false,
		allowNoToolsInChatMode: false,
		variableStateDisplayRows: 2,
		variableStateDisplayColumns: 3,
		anhShowRoleCardOnSwitch: false,
		anhExtensionsEnabled: {},
		anhExtensionSettings: {},
		anhExtensionsHasChanges: false,
		anhExtensionsRuntime: [],
		anhExtensionCapabilityRegistry: { systemPrompt: [], tools: [] },
		tsProfilesHasChanges: false,
		worldsetHasChanges: false,
	})

	const [didHydrateState, setDidHydrateState] = useState(false)
	const [showWelcome, setShowWelcome] = useState(false)
	const [theme, setTheme] = useState<any>(undefined)
	const [filePaths, setFilePaths] = useState<string[]>([])
	const [openedTabs, setOpenedTabs] = useState<Array<{ label: string; isActive: boolean; path?: string }>>([])
	const [commands, setCommands] = useState<Command[]>([])
	const [mcpServers, setMcpServers] = useState<McpServer[]>([])
	const [currentCheckpoint, setCurrentCheckpoint] = useState<string>()
	const [extensionRouterModels, setExtensionRouterModels] = useState<RouterModels | undefined>(undefined)
	const [marketplaceItems, setMarketplaceItems] = useState<any[]>([])
	const [alwaysAllowFollowupQuestions, setAlwaysAllowFollowupQuestions] = useState(false) // Add state for follow-up questions auto-approve
	const [followupAutoApproveTimeoutMs, setFollowupAutoApproveTimeoutMs] = useState<number | undefined>(undefined) // Will be set from global settings
	const [anhUseAskTool, setAnhUseAskTool] = useState(true) // Default to true (use ask tool)
	const [marketplaceInstalledMetadata, setMarketplaceInstalledMetadata] = useState<MarketplaceInstalledMetadata>({
		project: {},
		global: {},
	})
	const [includeTaskHistoryInEnhance, setIncludeTaskHistoryInEnhance] = useState(true)

	const activateStandaloneDemoMode = useCallback(() => {
		setState((prevState) => ({
			...prevState,
			renderContext: prevState.renderContext ?? "sidebar",
		}))
		setTheme((prevTheme: any) => prevTheme ?? { kind: "vs-dark" })
		setDidHydrateState(true)
	}, [])

	const setListApiConfigMeta = useCallback(
		(value: ProviderSettingsEntry[]) => setState((prevState) => ({ ...prevState, listApiConfigMeta: value })),
		[],
	)

	const setApiConfiguration = useCallback((value: ProviderSettings) => {
		setState((prevState) => ({
			...prevState,
			apiConfiguration: {
				...prevState.apiConfiguration,
				...value,
			},
		}))
	}, [])

	const processExtensionMessage = useCallback(
		(messageOrEvent: ExtensionMessage | undefined) => {
			if (!messageOrEvent || typeof messageOrEvent.type !== "string") {
				return
			}

			const message = messageOrEvent
			switch (message.type) {
				case "state": {
					const newState = message.state
					console.log("[ExtensionStateContext] Received state message, state data:", newState)
					if (!newState) {
						console.warn("[ExtensionStateContext] Received state message without state data:", message)
						return
					}
					setState((prevState) => mergeExtensionState(prevState, newState))
					setShowWelcome(!checkExistKey(newState.apiConfiguration))
					setDidHydrateState(true)
					console.log("[ExtensionStateContext] Setting didHydrateState to true, should hide StandaloneHydrationGate")
					// Update alwaysAllowFollowupQuestions if present in state message
					if ((newState as any).alwaysAllowFollowupQuestions !== undefined) {
						setAlwaysAllowFollowupQuestions((newState as any).alwaysAllowFollowupQuestions)
					}
					// Update followupAutoApproveTimeoutMs if present in state message
					if ((newState as any).followupAutoApproveTimeoutMs !== undefined) {
						setFollowupAutoApproveTimeoutMs((newState as any).followupAutoApproveTimeoutMs)
					}
					// Update includeTaskHistoryInEnhance if present in state message
					if ((newState as any).includeTaskHistoryInEnhance !== undefined) {
						setIncludeTaskHistoryInEnhance((newState as any).includeTaskHistoryInEnhance)
					}
					// Update anhUseAskTool if present in state message
					if ((newState as any).anhUseAskTool !== undefined) {
						setAnhUseAskTool((newState as any).anhUseAskTool)
					}
					// Update enableUserAvatar if present in state message
					if ((newState as any).enableUserAvatar !== undefined) {
						setState((prevState) => ({ ...prevState, enableUserAvatar: (newState as any).enableUserAvatar }))
					}
					// Update memorySystemEnabled if present in state message
					if ((newState as any).memorySystemEnabled !== undefined) {
						setState((prevState) => ({ ...prevState, memorySystemEnabled: (newState as any).memorySystemEnabled }))
					}
					// Update memoryToolsEnabled if present in state message
					if ((newState as any).memoryToolsEnabled !== undefined) {
						setState((prevState) => ({ ...prevState, memoryToolsEnabled: (newState as any).memoryToolsEnabled }))
					}
					// Update userAvatarRole if present in state message
					if ((newState as any).userAvatarRole !== undefined) {
						setState((prevState) => ({ ...prevState, userAvatarRole: (newState as any).userAvatarRole }))
					}
					// Update hideRoleDescription if present in state message
					if ((newState as any).hideRoleDescription !== undefined) {
						setState((prevState) => ({ ...prevState, hideRoleDescription: (newState as any).hideRoleDescription }))
					}
					// Update anhShowRoleCardOnSwitch if present in state message
					if ((newState as any).anhShowRoleCardOnSwitch !== undefined) {
						setState((prevState) => ({ ...prevState, anhShowRoleCardOnSwitch: (newState as any).anhShowRoleCardOnSwitch }))
					}
					// Update allowNoToolsInChatMode if present in state message
					if ((newState as any).allowNoToolsInChatMode !== undefined) {
						setState((prevState) => ({ ...prevState, allowNoToolsInChatMode: (newState as any).allowNoToolsInChatMode }))
					}
					// Update variableStateDisplayRows if present in state message
					if ((newState as any).variableStateDisplayRows !== undefined) {
						setState((prevState) => ({ ...prevState, variableStateDisplayRows: (newState as any).variableStateDisplayRows }))
					}
					// Update variableStateDisplayColumns if present in state message
					if ((newState as any).variableStateDisplayColumns !== undefined) {
						setState((prevState) => ({ ...prevState, variableStateDisplayColumns: (newState as any).variableStateDisplayColumns }))
					}
		// Update enableInjectSystemPromptVariables if present in state message
					if ((newState as any).enableInjectSystemPromptVariables !== undefined) {
						setState((prevState) => ({ ...prevState, enableInjectSystemPromptVariables: (newState as any).enableInjectSystemPromptVariables }))
					}
					// Update useRefactoredSystemPrompt if present in state message
					if ((newState as any).useRefactoredSystemPrompt !== undefined) {
						setState((prevState) => ({ ...prevState, useRefactoredSystemPrompt: (newState as any).useRefactoredSystemPrompt }))
					}
					// Update enableRooCloudServices if present in state message
					if ((newState as any).enableRooCloudServices !== undefined) {
						setState((prevState) => ({ ...prevState, enableRooCloudServices: (newState as any).enableRooCloudServices }))
					}
					// Update customUserAgent if present in state message
					if ((newState as any).customUserAgent !== undefined) {
						setState((prevState) => ({ ...prevState, customUserAgent: (newState as any).customUserAgent }))
					}
					// Update customUserAgentMode if present in state message
					if ((newState as any).customUserAgentMode !== undefined) {
						setState((prevState) => ({ ...prevState, customUserAgentMode: (newState as any).customUserAgentMode }))
					}
					// Update customUserAgentFull if present in state message
					if ((newState as any).customUserAgentFull !== undefined) {
						setState((prevState) => ({ ...prevState, customUserAgentFull: (newState as any).customUserAgentFull }))
					}
					// Update outputStreamProcessorConfig if present in state message
					if ((newState as any).outputStreamProcessorConfig !== undefined) {
						setState((prevState) => ({ ...prevState, outputStreamProcessorConfig: (newState as any).outputStreamProcessorConfig }))
					}
					// Update enableUIDebug if present in state message
					if ((newState as any).enableUIDebug !== undefined) {
						setState((prevState) => ({ ...prevState, enableUIDebug: (newState as any).enableUIDebug }))
					}
					// Update uiDebugComponents if present in state message
					if ((newState as any).uiDebugComponents !== undefined) {
						setState((prevState) => ({ ...prevState, uiDebugComponents: (newState as any).uiDebugComponents }))
					}
					// Handle marketplace data if present in state message
					if (newState.marketplaceItems !== undefined) {
						setMarketplaceItems(newState.marketplaceItems)
					}
					if (newState.marketplaceInstalledMetadata !== undefined) {
						setMarketplaceInstalledMetadata(newState.marketplaceInstalledMetadata)
					}
					break
				}
				case "action": {
					if (message.action === "toggleAutoApprove") {
						// Toggle the auto-approval state
						setState((prevState) => {
							const newValue = !(prevState.autoApprovalEnabled ?? false)
							// Also send the update to the extension
							vscode.postMessage({ type: "autoApprovalEnabled", bool: newValue })
							return { ...prevState, autoApprovalEnabled: newValue }
						})
					}
					break
				}
				case "theme": {
					if (message.text) {
						setTheme(convertTextMateToHljs(JSON.parse(message.text)))
					}
					break
				}
				case "workspaceUpdated": {
					const paths = message.filePaths ?? []
					const tabs = message.openedTabs ?? []

					setFilePaths(paths)
					setOpenedTabs(tabs)
					break
				}
				case "commands": {
					setCommands(message.commands ?? [])
					break
				}
				case "messageUpdated": {
					const clineMessage = message.clineMessage!
					setState((prevState) => {
						// worth noting it will never be possible for a more up-to-date message to be sent here or in normal messages post since the presentAssistantContent function uses lock
						const lastIndex = findLastIndex(prevState.clineMessages, (msg) => msg.ts === clineMessage.ts)
						if (lastIndex !== -1) {
							const newClineMessages = [...prevState.clineMessages]
							newClineMessages[lastIndex] = clineMessage
							return { ...prevState, clineMessages: newClineMessages }
						}
						return prevState
					})
					break
				}
				case "mcpServers": {
					setMcpServers(message.mcpServers ?? [])
					break
				}
				case "currentCheckpointUpdated": {
					setCurrentCheckpoint(message.text)
					break
				}
				case "listApiConfig": {
					setListApiConfigMeta(message.listApiConfig ?? [])
					break
				}
				case "routerModels": {
					setExtensionRouterModels(message.routerModels)
					break
				}
				case "marketplaceData": {
					if (message.marketplaceItems !== undefined) {
						setMarketplaceItems(message.marketplaceItems)
					}
					if (message.marketplaceInstalledMetadata !== undefined) {
						setMarketplaceInstalledMetadata(message.marketplaceInstalledMetadata)
					}
					break
				}
				case "anhExtensionState": {
					if (message.payload) {
						const payload = message.payload as any
						setState((prevState) => ({
							...prevState,
							anhExtensionsEnabled: payload.enabledExtensions || {},
							anhExtensionSettings: payload.extensionSettings || {},
							anhExtensionsHasChanges: false,
							_isResetting: false,
						}))
					}
					break
				}
				case "tsProfileState": {
					if (message.payload) {
						const payload = message.payload as any
						setState((prevState) => ({
							...prevState,
							enabledTSProfiles: payload.enabledProfiles || [],
							anhTsProfileAutoInject: payload.autoInject ?? true,
							anhTsProfileVariables: payload.variables || {},
							tsProfilesHasChanges: false,
							_isResetting: false,
							_isSavingTSProfile: false, // 清除保存中状态
						}))
					}
					break
				}
			}
		},
		[setListApiConfigMeta],
	)

	const handleMessage = useCallback(
		(message: ExtensionMessage) => {
			if (!message || typeof message !== "object") {
				return
			}
			processExtensionMessage(message)
		},
		[processExtensionMessage],
	)

	// 直接使用 VSCode 消息监听器
	const handleStateMessage = useCallback(
		(message: any) => {
			if (!message || typeof message !== "object") {
				return
			}
			processExtensionMessage(message)
		},
		[processExtensionMessage],
	)

	const stateMessageTypes = useMemo(() => ["*"], [])

	useMessageListener(stateMessageTypes, handleStateMessage, [handleStateMessage])

	useEffect(() => {
		if (vscode.isConnected()) {
			vscode.postMessage({ type: "webviewDidLaunch" })
			return
		}

		const unsubscribe = vscode.onConnectionStatusChange((connected) => {
			if (connected) {
				vscode.postMessage({ type: "webviewDidLaunch" })
				unsubscribe?.()
			}
		})

		return () => {
			unsubscribe?.()
		}
	}, [])

	const normalizedWorkspaceContextSettings = normalizeWorkspaceContextSettings(state.workspaceContextSettings)
const contextValue: ExtensionStateContextType = {
	...state,
	workspaceContextSettings: normalizedWorkspaceContextSettings,
	anhExtensionsRuntime: state.anhExtensionsRuntime ?? [],
	anhExtensionCapabilityRegistry: state.anhExtensionCapabilityRegistry,
		reasoningBlockCollapsed: state.reasoningBlockCollapsed ?? true,
		didHydrateState,
		activateStandaloneDemoMode,
		showWelcome,
		theme,
		mcpServers,
		currentCheckpoint,
		filePaths,
		openedTabs,
		commands,
		soundVolume: state.soundVolume,
		ttsSpeed: state.ttsSpeed,
		fuzzyMatchThreshold: state.fuzzyMatchThreshold,
		writeDelayMs: state.writeDelayMs,
		screenshotQuality: state.screenshotQuality,
		routerModels: extensionRouterModels,
		cloudIsAuthenticated: state.cloudIsAuthenticated ?? false,
		cloudOrganizations: state.cloudOrganizations ?? [],
		organizationSettingsVersion: state.organizationSettingsVersion ?? -1,
		marketplaceItems,
		marketplaceInstalledMetadata,
		profileThresholds: state.profileThresholds ?? {},
		alwaysAllowFollowupQuestions,
		followupAutoApproveTimeoutMs,
		remoteControlEnabled: state.remoteControlEnabled ?? false,
		taskSyncEnabled: state.taskSyncEnabled,
		featureRoomoteControlEnabled: state.featureRoomoteControlEnabled ?? false,
		setExperimentEnabled: (id, enabled) =>
			setState((prevState) => ({ ...prevState, experiments: { ...prevState.experiments, [id]: enabled } })),
		setApiConfiguration,
		setCustomInstructions: (value) => setState((prevState) => ({ ...prevState, customInstructions: value })),
		setAlwaysAllowReadOnly: (value) => setState((prevState) => ({ ...prevState, alwaysAllowReadOnly: value })),
		setAlwaysAllowReadOnlyOutsideWorkspace: (value) =>
			setState((prevState) => ({ ...prevState, alwaysAllowReadOnlyOutsideWorkspace: value })),
		setAlwaysAllowWrite: (value) => setState((prevState) => ({ ...prevState, alwaysAllowWrite: value })),
		setAlwaysAllowWriteOutsideWorkspace: (value) =>
			setState((prevState) => ({ ...prevState, alwaysAllowWriteOutsideWorkspace: value })),
		setAlwaysAllowExecute: (value) => setState((prevState) => ({ ...prevState, alwaysAllowExecute: value })),
		setAlwaysAllowBrowser: (value) => setState((prevState) => ({ ...prevState, alwaysAllowBrowser: value })),
		setAlwaysAllowMcp: (value) => setState((prevState) => ({ ...prevState, alwaysAllowMcp: value })),
		setAlwaysAllowModeSwitch: (value) => setState((prevState) => ({ ...prevState, alwaysAllowModeSwitch: value })),
		setAlwaysAllowSubtasks: (value) => setState((prevState) => ({ ...prevState, alwaysAllowSubtasks: value })),
		setAlwaysAllowFollowupQuestions,
		setFollowupAutoApproveTimeoutMs: (value) =>
			setState((prevState) => ({ ...prevState, followupAutoApproveTimeoutMs: value })),
		setShowAnnouncement: (value) => setState((prevState) => ({ ...prevState, shouldShowAnnouncement: value })),
		setAllowedCommands: (value) => setState((prevState) => ({ ...prevState, allowedCommands: value })),
		setDeniedCommands: (value) => setState((prevState) => ({ ...prevState, deniedCommands: value })),
		setAllowedMaxRequests: (value) => setState((prevState) => ({ ...prevState, allowedMaxRequests: value })),
		setAllowedMaxCost: (value) => setState((prevState) => ({ ...prevState, allowedMaxCost: value })),
		setSoundEnabled: (value) => setState((prevState) => ({ ...prevState, soundEnabled: value })),
		setSoundVolume: (value) => setState((prevState) => ({ ...prevState, soundVolume: value })),
		setTtsEnabled: (value) => setState((prevState) => ({ ...prevState, ttsEnabled: value })),
		setTtsSpeed: (value) => setState((prevState) => ({ ...prevState, ttsSpeed: value })),
		setDiffEnabled: (value) => setState((prevState) => ({ ...prevState, diffEnabled: value })),
		setEnableCheckpoints: (value) => setState((prevState) => ({ ...prevState, enableCheckpoints: value })),
		setBrowserViewportSize: (value: string) =>
			setState((prevState) => ({ ...prevState, browserViewportSize: value })),
		setFuzzyMatchThreshold: (value) => setState((prevState) => ({ ...prevState, fuzzyMatchThreshold: value })),
		setWriteDelayMs: (value) => setState((prevState) => ({ ...prevState, writeDelayMs: value })),
		setScreenshotQuality: (value) => setState((prevState) => ({ ...prevState, screenshotQuality: value })),
		setTerminalOutputLineLimit: (value) =>
			setState((prevState) => ({ ...prevState, terminalOutputLineLimit: value })),
		setTerminalOutputCharacterLimit: (value) =>
			setState((prevState) => ({ ...prevState, terminalOutputCharacterLimit: value })),
		setTerminalShellIntegrationTimeout: (value) =>
			setState((prevState) => ({ ...prevState, terminalShellIntegrationTimeout: value })),
		setTerminalShellIntegrationDisabled: (value) =>
			setState((prevState) => ({ ...prevState, terminalShellIntegrationDisabled: value })),
		setTerminalZdotdir: (value) => setState((prevState) => ({ ...prevState, terminalZdotdir: value })),
		setMcpEnabled: (value) => setState((prevState) => ({ ...prevState, mcpEnabled: value })),
		setEnableMcpServerCreation: (value) =>
			setState((prevState) => ({ ...prevState, enableMcpServerCreation: value })),
		setRemoteControlEnabled: (value) => setState((prevState) => ({ ...prevState, remoteControlEnabled: value })),
		setTaskSyncEnabled: (value) => setState((prevState) => ({ ...prevState, taskSyncEnabled: value }) as any),
		setFeatureRoomoteControlEnabled: (value) =>
			setState((prevState) => ({ ...prevState, featureRoomoteControlEnabled: value })),
		setAlwaysApproveResubmit: (value) => setState((prevState) => ({ ...prevState, alwaysApproveResubmit: value })),
		setRequestDelaySeconds: (value) => setState((prevState) => ({ ...prevState, requestDelaySeconds: value })),
		setCurrentApiConfigName: (value) => setState((prevState) => ({ ...prevState, currentApiConfigName: value })),
		setListApiConfigMeta,
		setMode: (value: Mode) => setState((prevState) => ({ ...prevState, mode: value })),
		setCustomModePrompts: (value) => setState((prevState) => ({ ...prevState, customModePrompts: value })),
		setCustomSupportPrompts: (value) => setState((prevState) => ({ ...prevState, customSupportPrompts: value })),
		setEnhancementApiConfigId: (value) =>
			setState((prevState) => ({ ...prevState, enhancementApiConfigId: value })),
		setAutoApprovalEnabled: (value) => setState((prevState) => ({ ...prevState, autoApprovalEnabled: value })),
		setCustomModes: (value) => setState((prevState) => ({ ...prevState, customModes: value })),
		setMaxOpenTabsContext: (value) => setState((prevState) => ({ ...prevState, maxOpenTabsContext: value })),
		setMaxWorkspaceFiles: (value) => setState((prevState) => ({ ...prevState, maxWorkspaceFiles: value })),
		setWorkspaceContextSetting: (key, value) => {
			setState((prevState) => ({
				...prevState,
				workspaceContextSettings: normalizeWorkspaceContextSettings({
					...prevState.workspaceContextSettings,
					[key]: value,
					}),
			}))
			console.debug("[WorkspaceContext] setWorkspaceContextSetting", { key, value })
			vscode.postMessage({ type: "setWorkspaceContextSetting", workspaceContextKey: key, bool: value })
		},
		setAllWorkspaceContextSettings: (value) => {
			const next = WORKSPACE_CONTEXT_SETTING_KEYS.reduce<Record<WorkspaceContextSettingKey, boolean>>((acc, settingKey) => {
				acc[settingKey] = value
				return acc
			}, { ...DEFAULT_WORKSPACE_CONTEXT_SETTINGS })
			setState((prevState) => ({ ...prevState, workspaceContextSettings: next }))
			console.debug("[WorkspaceContext] setAllWorkspaceContextSettings", next)
			vscode.postMessage({ type: "setWorkspaceContextSettings", workspaceContextSettings: next })
		},
		setBrowserToolEnabled: (value) => setState((prevState) => ({ ...prevState, browserToolEnabled: value })),
		setTelemetrySetting: (value) => setState((prevState) => ({ ...prevState, telemetrySetting: value })),
		setShowRooIgnoredFiles: (value) => setState((prevState) => ({ ...prevState, showRooIgnoredFiles: value })),
		setRemoteBrowserEnabled: (value) => setState((prevState) => ({ ...prevState, remoteBrowserEnabled: value })),
		setAwsUsePromptCache: (value) => setState((prevState) => ({ ...prevState, awsUsePromptCache: value })),
		setMaxReadFileLine: (value) => setState((prevState) => ({ ...prevState, maxReadFileLine: value })),
		setMaxImageFileSize: (value) => setState((prevState) => ({ ...prevState, maxImageFileSize: value })),
		setMaxTotalImageSize: (value) => setState((prevState) => ({ ...prevState, maxTotalImageSize: value })),
		setPinnedApiConfigs: (value) => setState((prevState) => ({ ...prevState, pinnedApiConfigs: value })),
		setTerminalCompressProgressBar: (value) =>
			setState((prevState) => ({ ...prevState, terminalCompressProgressBar: value })),
		togglePinnedApiConfig: (configId) =>
			setState((prevState) => {
				const currentPinned = prevState.pinnedApiConfigs || {}
				const newPinned = {
					...currentPinned,
					[configId]: !currentPinned[configId],
				}

				// If the config is now unpinned, remove it from the object
				if (!newPinned[configId]) {
					delete newPinned[configId]
				}

				return { ...prevState, pinnedApiConfigs: newPinned }
			}),
		setHistoryPreviewCollapsed: (value) =>
			setState((prevState) => ({ ...prevState, historyPreviewCollapsed: value })),
		setReasoningBlockCollapsed: (value) =>
			setState((prevState) => ({ ...prevState, reasoningBlockCollapsed: value })),
		setHasOpenedModeSelector: (value) => setState((prevState) => ({ ...prevState, hasOpenedModeSelector: value })),
		setAutoCondenseContext: (value) => setState((prevState) => ({ ...prevState, autoCondenseContext: value })),
		setAutoCondenseContextPercent: (value) =>
			setState((prevState) => ({ ...prevState, autoCondenseContextPercent: value })),
		setCondensingApiConfigId: (value) => setState((prevState) => ({ ...prevState, condensingApiConfigId: value })),
		setCustomCondensingPrompt: (value) =>
			setState((prevState) => ({ ...prevState, customCondensingPrompt: value })),
		setProfileThresholds: (value) => setState((prevState) => ({ ...prevState, profileThresholds: value })),
		alwaysAllowUpdateTodoList: state.alwaysAllowUpdateTodoList,
		setAlwaysAllowUpdateTodoList: (value) => {
			setState((prevState) => ({ ...prevState, alwaysAllowUpdateTodoList: value }))
		},
		includeDiagnosticMessages: state.includeDiagnosticMessages,
		setIncludeDiagnosticMessages: (value) => {
			setState((prevState) => ({ ...prevState, includeDiagnosticMessages: value }))
		},
		maxDiagnosticMessages: state.maxDiagnosticMessages,
		setMaxDiagnosticMessages: (value) => {
			setState((prevState) => ({ ...prevState, maxDiagnosticMessages: value }))
		},
		includeTaskHistoryInEnhance,
		setIncludeTaskHistoryInEnhance,
		currentAnhRole: state.currentAnhRole,
		setCurrentAnhRole: (value) => setState((prevState) => ({ ...prevState, currentAnhRole: value })),
		anhPersonaMode: state.anhPersonaMode ?? "hybrid",
		setAnhPersonaMode: (value) => setState((prevState) => ({ ...prevState, anhPersonaMode: value })),
		anhToneStrict: state.anhToneStrict ?? true,
		setAnhToneStrict: (value) => setState((prevState) => ({ ...prevState, anhToneStrict: value })),
		anhUseAskTool: state.anhUseAskTool ?? true,
		setAnhUseAskTool: (value) => setState((prevState) => ({ ...prevState, anhUseAskTool: value })),
		anhChatModeHideTaskCompletion: state.anhChatModeHideTaskCompletion ?? true,
		setAnhChatModeHideTaskCompletion: (value) => setState((prevState) => ({ ...prevState, anhChatModeHideTaskCompletion: value })),
		anhShowRoleCardOnSwitch: state.anhShowRoleCardOnSwitch ?? false,
		setAnhShowRoleCardOnSwitch: (value) => setState((prevState) => ({ ...prevState, anhShowRoleCardOnSwitch: value })),
		enabledTSProfiles: state.enabledTSProfiles ?? [],
		setEnabledTSProfiles: (value: string[]) => setState((prevState) => ({ ...prevState, enabledTSProfiles: value })),
		anhTsProfileAutoInject: state.anhTsProfileAutoInject ?? true,
		setAnhTsProfileAutoInject: (value: boolean) => setState((prevState) => ({ ...prevState, anhTsProfileAutoInject: value })),
		anhTsProfileVariables: state.anhTsProfileVariables ?? {},
		setAnhTsProfileVariables: (value: Record<string, string>) => setState((prevState) => ({ ...prevState, anhTsProfileVariables: value })),
		displayMode: state.displayMode ?? "coding",
		setDisplayMode: (value) => setState((prevState) => ({ ...prevState, displayMode: value })),
		enableUserAvatar: state.enableUserAvatar ?? false,
		setEnableUserAvatar: (value) => setState((prevState) => ({ ...prevState, enableUserAvatar: value })),
		userAvatarVisibility:
			state.userAvatarVisibility ??
			(state.userAvatarHideFullData ? ("summary" as UserAvatarVisibility) : "full"),
		setUserAvatarVisibility: (value) =>
			setState((prevState) => ({
				...prevState,
				userAvatarVisibility: value,
				userAvatarHideFullData: value !== "full" ? true : false,
			})),
		userAvatarHideFullData: state.userAvatarHideFullData ?? false,
		setUserAvatarHideFullData: (value) =>
			setState((prevState) => ({
				...prevState,
				userAvatarHideFullData: value,
				userAvatarVisibility: value ? "summary" : prevState.userAvatarVisibility ?? "full",
			})),
		userAvatarRole: state.userAvatarRole,
		setUserAvatarRole: (value) => setState((prevState) => ({ ...prevState, userAvatarRole: value })),
	hideRoleDescription: state.hideRoleDescription ?? false,
	setHideRoleDescription: (value) => setState((prevState) => ({ ...prevState, hideRoleDescription: value })),
	allowNoToolsInChatMode: state.allowNoToolsInChatMode ?? false,
	setAllowNoToolsInChatMode: (value) => setState((prevState) => ({ ...prevState, allowNoToolsInChatMode: value })),
	variableStateDisplayRows: state.variableStateDisplayRows ?? 2,
	setVariableStateDisplayRows: (value) => setState((prevState) => ({ ...prevState, variableStateDisplayRows: value })),
	variableStateDisplayColumns: state.variableStateDisplayColumns ?? 3,
	setVariableStateDisplayColumns: (value) => setState((prevState) => ({ ...prevState, variableStateDisplayColumns: value })),
	useRefactoredSystemPrompt: state.useRefactoredSystemPrompt ?? false,
	setUseRefactoredSystemPrompt: (value) => {
		setState((prevState) => ({ ...prevState, useRefactoredSystemPrompt: value }))
		vscode.postMessage({ type: "useRefactoredSystemPrompt", bool: value })
	},
	enableInjectSystemPromptVariables: state.enableInjectSystemPromptVariables ?? false,
	setEnableInjectSystemPromptVariables: (value) => {
		setState((prevState) => ({ ...prevState, enableInjectSystemPromptVariables: value }))
		vscode.postMessage({ type: "enableInjectSystemPromptVariables", bool: value })
	},
	anhExtensionSettings: state.anhExtensionSettings ?? {},
	setAnhExtensionSettings: (value) => setState((prevState) => ({ ...prevState, anhExtensionSettings: value })),
	updateAnhExtensionSetting: (id, key, value) => {
		setState((prevState) => {
			const prevSettings = prevState.anhExtensionSettings ?? {}
			return {
				...prevState,
				anhExtensionSettings: {
					...prevSettings,
					[id]: {
						...(prevSettings[id] ?? {}),
						[key]: value,
					},
				},
				anhExtensionsHasChanges: true,
			}
		})
		// 不再立即发送给后端，而是等待保存
	},
	setAnhExtensionEnabled: (compositeKey, enabled) => {
		setState((prevState) => ({
			...prevState,
			anhExtensionsEnabled: {
				...(prevState.anhExtensionsEnabled ?? {}),
				[compositeKey]: enabled,
			},
			anhExtensionsHasChanges: true,
		}))
		// 不再立即发送给后端，而是等待保存
	},
	saveAnhExtensionChanges: () => {
		setState((prevState) => {
			// 批量发送所有更改给后端，使用统一的保存消息
			const extensionChanges = prevState.anhExtensionsEnabled ?? {}
			const extensionSettings = prevState.anhExtensionSettings ?? {}

			// 使用统一的保存消息格式
			vscode.postMessage({
				type: "saveAnhExtensionChanges",
				extensionChanges: extensionChanges,
				extensionSettings: extensionSettings
			})

			return {
				...prevState,
				anhExtensionsHasChanges: false,
			}
		})
	},
	resetAnhExtensionChanges: () => {
		// 发送请求获取当前保存的状态，而不是立即清除标记
		vscode.postMessage({ type: "getAnhExtensionState" })
		// 标记正在重置，避免被其他状态更新覆盖
		setState((prevState) => ({
			...prevState,
			_isResetting: true,
		}))
	},
	tsProfilesHasChanges: state.tsProfilesHasChanges ?? false,
	saveTSProfileChanges: () => {
		setState((prevState) => {
			// 设置loading状态，防止重复保存
			if (prevState._isSavingTSProfile) {
				console.log("TSProfile save already in progress, skipping...")
				return prevState
			}

			// 批量发送所有更改给后端
			const enabledProfiles = prevState.enabledTSProfiles ?? []
			const autoInject = prevState.anhTsProfileAutoInject ?? true
			const variables = prevState.anhTsProfileVariables ?? {}

			try {
				// 发送启用状态更改
				vscode.postMessage({
					type: "saveTSProfileChanges",
					enabledProfiles,
					autoInject,
					variables
				})

				console.log("TSProfile save request sent, waiting for backend confirmation...")

				// 只设置保存中状态，不清除tsProfilesHasChanges
				// tsProfilesHasChanges将在收到后端的tsProfileState消息时清除
				return {
					...prevState,
					_isSavingTSProfile: true,
				}
			} catch (error) {
				console.error("Failed to send TSProfile save request:", error)
				return {
					...prevState,
					_isSavingTSProfile: false,
				}
			}
		})
	},
	resetTSProfileChanges: () => {
		// 发送请求获取当前保存的状态，而不是立即清除标记
		vscode.postMessage({ type: "getTSProfileState" })
		// 标记正在重置，避免被其他状态更新覆盖
		setState((prevState) => ({
			...prevState,
			_isResetting: true,
		}))
	},
	worldsetHasChanges: (state as ExtendedExtensionState).worldsetHasChanges ?? false,
	setWorldsetHasChanges: (value: boolean) => setState((prevState) => ({ ...prevState, worldsetHasChanges: value })),
	resetWorldsetChanges: () => {
		// 发送请求获取当前保存的世界观状态
		vscode.postMessage({ type: "getWorldsetStatus" })
		// 标记正在重置，避免被其他状态更新覆盖
		setState((prevState) => ({
			...prevState,
			_isResetting: true,
		}))
	},
	memorySystemEnabled: state.memorySystemEnabled ?? true,
	memoryToolsEnabled: state.memoryToolsEnabled ?? true,
	enableRooCloudServices: state.enableRooCloudServices ?? false,
	setEnableRooCloudServices: (value: boolean) => {
		vscode.postMessage({ type: "enableRooCloudServices", bool: value })
	},
	customUserAgent: state.customUserAgent ?? "",
	setCustomUserAgent: (value: string) => {
		vscode.postMessage({ type: "customUserAgent", text: value })
	},
	customUserAgentMode: state.customUserAgentMode ?? "segments",
	setCustomUserAgentMode: (value: "segments" | "full") => {
		vscode.postMessage({ type: "customUserAgentMode", text: value })
	},
	customUserAgentFull: state.customUserAgentFull ?? "",
	setCustomUserAgentFull: (value: string) => {
		vscode.postMessage({ type: "customUserAgentFull", text: value })
	},
	outputStreamProcessorConfig: state.outputStreamProcessorConfig ?? {},
	setOutputStreamProcessorConfig: (value: any) => {
		setState((prevState) => ({ ...prevState, outputStreamProcessorConfig: value }))
		vscode.postMessage({ type: "outputStreamProcessorConfig" as any, config: value })
	},
	enableUIDebug: state.enableUIDebug ?? false,
	setEnableUIDebug: (value: boolean) => {
		setState((prevState) => ({ ...prevState, enableUIDebug: value }))
		vscode.postMessage({ type: "enableUIDebug", bool: value })
	},
	uiDebugComponents: state.uiDebugComponents ?? [],
	setUIDebugComponents: (value: string[]) => {
		setState((prevState) => ({ ...prevState, uiDebugComponents: value }))
		vscode.postMessage({ type: "uiDebugComponents", array: value })
	},
}

	return <ExtensionStateContext.Provider value={contextValue}>{children}</ExtensionStateContext.Provider>
}

export const useExtensionState = () => {
	const context = useContext(ExtensionStateContext)

	if (context === undefined) {
		throw new Error("useExtensionState must be used within an ExtensionStateContextProvider")
	}

	return context
}
