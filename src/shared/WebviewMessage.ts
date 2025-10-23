import { z } from "zod"

import {
	type ProviderSettings,
	type PromptComponent,
	type ModeConfig,
	type InstallMarketplaceItemOptions,
	type MarketplaceItem,
	type ShareVisibility,
	type QueuedMessage,
	type WorkspaceContextSettingKey,
	marketplaceItemSchema,
} from "@roo-code/types"

import { Mode } from "./modes"

export type ClineAskResponse = "yesButtonClicked" | "noButtonClicked" | "messageResponse" | "objectResponse"

export type PromptMode = Mode | "enhance"

export type AudioType = "notification" | "celebration" | "progress_loop"

export interface UpdateTodoListPayload {
	todos: any[]
}

export type EditQueuedMessagePayload = Pick<QueuedMessage, "id" | "text" | "images">

export interface WebviewMessage {
	type:
		| "updateTodoList"
		| "deleteMultipleTasksWithIds"
		| "currentApiConfigName"
		| "saveApiConfiguration"
		| "upsertApiConfiguration"
		| "deleteApiConfiguration"
		| "loadApiConfiguration"
		| "loadApiConfigurationById"
		| "renameApiConfiguration"
		| "getListApiConfiguration"
		| "customInstructions"
		| "allowedCommands"
		| "deniedCommands"
		| "alwaysAllowReadOnly"
		| "alwaysAllowReadOnlyOutsideWorkspace"
		| "alwaysAllowWrite"
		| "alwaysAllowWriteOutsideWorkspace"
		| "alwaysAllowWriteProtected"
		| "alwaysAllowExecute"
		| "alwaysAllowFollowupQuestions"
		| "alwaysAllowUpdateTodoList"
		| "followupAutoApproveTimeoutMs"
		| "webviewDidLaunch"
		| "newTask"
		| "askResponse"
		| "terminalOperation"
		| "clearTask"
		| "didShowAnnouncement"
		| "selectImages"
		| "exportCurrentTask"
		| "shareCurrentTask"
		| "showTaskWithId"
		| "deleteTaskWithId"
		| "exportTaskWithId"
		| "exportTaskBundleWithId"
		| "importTaskBundle"
		| "importSettings"
		| "exportSettings"
		| "resetState"
		| "flushRouterModels"
		| "requestRouterModels"
		| "requestOpenAiModels"
		| "requestOllamaModels"
		| "requestLmStudioModels"
		| "requestVsCodeLmModels"
		| "requestHuggingFaceModels"
		| "openImage"
		| "saveImage"
		| "openFile"
		| "openMention"
		| "cancelTask"
		| "updateVSCodeSetting"
		| "getVSCodeSetting"
		| "vsCodeSetting"
		| "alwaysAllowBrowser"
		| "alwaysAllowMcp"
		| "alwaysAllowModeSwitch"
		| "allowedMaxRequests"
		| "allowedMaxCost"
		| "alwaysAllowSubtasks"
		| "alwaysAllowUpdateTodoList"
		| "autoCondenseContext"
		| "autoCondenseContextPercent"
		| "condensingApiConfigId"
		| "updateCondensingPrompt"
		| "playSound"
		| "playTts"
		| "stopTts"
		| "soundEnabled"
		| "ttsEnabled"
		| "ttsSpeed"
		| "soundVolume"
		| "diffEnabled"
		| "enableCheckpoints"
		| "browserViewportSize"
		| "screenshotQuality"
		| "remoteBrowserHost"
		| "openKeyboardShortcuts"
		| "openMcpSettings"
		| "openProjectMcpSettings"
		| "restartMcpServer"
		| "refreshAllMcpServers"
		| "toggleToolAlwaysAllow"
		| "toggleToolEnabledForPrompt"
		| "toggleMcpServer"
		| "updateMcpTimeout"
		| "fuzzyMatchThreshold"
		| "writeDelayMs"
		| "diagnosticsEnabled"
		| "enhancePrompt"
		| "enhancedPrompt"
		| "draggedImages"
		| "deleteMessage"
		| "deleteMessageConfirm"
		| "submitEditedMessage"
		| "editMessageConfirm"
		| "terminalOutputLineLimit"
		| "terminalOutputCharacterLimit"
		| "terminalShellIntegrationTimeout"
		| "terminalShellIntegrationDisabled"
		| "terminalCommandDelay"
		| "terminalPowershellCounter"
		| "terminalZshClearEolMark"
		| "terminalZshOhMy"
		| "terminalZshP10k"
		| "terminalZdotdir"
		| "terminalCompressProgressBar"
		| "mcpEnabled"
		| "enableMcpServerCreation"
		| "remoteControlEnabled"
		| "taskSyncEnabled"
		| "searchCommits"
		| "alwaysApproveResubmit"
		| "requestDelaySeconds"
		| "setApiConfigPassword"
		| "mode"
		| "updatePrompt"
		| "updateSupportPrompt"
		| "getSystemPrompt"
		| "copySystemPrompt"
		| "systemPrompt"
		| "showSystemPrompt"
		| "enhancementApiConfigId"
		| "includeTaskHistoryInEnhance"
		| "updateExperimental"
		| "autoApprovalEnabled"
		| "updateCustomMode"
		| "deleteCustomMode"
		| "setopenAiCustomModelInfo"
		| "openCustomModesSettings"
		| "checkpointDiff"
		| "checkpointRestore"
		| "deleteMcpServer"
		| "maxOpenTabsContext"
		| "maxWorkspaceFiles"
		| "humanRelayResponse"
		| "humanRelayCancel"
		| "browserToolEnabled"
		| "codebaseIndexEnabled"
		| "telemetrySetting"
		| "showRooIgnoredFiles"
		| "testBrowserConnection"
		| "browserConnectionResult"
		| "remoteBrowserEnabled"
		| "language"
		| "maxReadFileLine"
		| "maxImageFileSize"
		| "maxTotalImageSize"
		| "maxConcurrentFileReads"
		| "includeDiagnosticMessages"
		| "maxDiagnosticMessages"
		| "searchFiles"
		| "toggleApiConfigPin"
		| "setHistoryPreviewCollapsed"
		| "hasOpenedModeSelector"
		| "cloudButtonClicked"
		| "rooCloudSignIn"
		| "cloudLandingPageSignIn"
		| "rooCloudSignOut"
		| "rooCloudManualUrl"
		| "switchOrganization"
		| "condenseTaskContextRequest"
		| "requestIndexingStatus"
		| "setWorkspaceContextSetting"
		| "setWorkspaceContextSettings"
		| "startIndexing"
		| "clearIndexData"
		| "indexingStatusUpdate"
		| "indexCleared"
		| "focusPanelRequest"
		| "profileThresholds"
		| "setHistoryPreviewCollapsed"
		| "setReasoningBlockCollapsed"
		| "openExternal"
		| "filterMarketplaceItems"
		| "marketplaceButtonClicked"
		| "installMarketplaceItem"
		| "installMarketplaceItemWithParameters"
		| "cancelMarketplaceInstall"
		| "removeInstalledMarketplaceItem"
		| "marketplaceInstallResult"
		| "fetchMarketplaceData"
		| "switchTab"
		| "profileThresholds"
		| "shareTaskSuccess"
		| "exportMode"
		| "exportModeResult"
		| "importMode"
		| "importModeResult"
		| "checkRulesDirectory"
		| "checkRulesDirectoryResult"
		| "saveCodeIndexSettingsAtomic"
		| "requestCodeIndexSecretStatus"
		| "requestCommands"
		| "openCommandFile"
		| "deleteCommand"
		| "createCommand"
		| "insertTextIntoTextarea"
		| "showMdmAuthRequiredNotification"
		| "imageGenerationSettings"
		| "openRouterImageApiKey"
		| "openRouterImageGenerationSelectedModel"
		| "queueMessage"
		| "removeQueuedMessage"
		| "editQueuedMessage"
		| "dismissUpsell"
		| "getDismissedUpsells"
		| "getAnhRoles"
		| "anhRolesLoaded"
		| "getGlobalAnhRoles"
		| "anhGlobalRolesLoaded"
		| "loadAnhRole"
		| "anhRoleLoaded"
		| "selectAnhRole"
		| "loadUserAvatarRole"
		| "userAvatarRoleLoaded"
		| "setAnhPersonaMode"
		| "setAnhToneStrict"
		| "setAnhUseAskTool"
		| "setDisplayMode"
		| "enableUserAvatar"
		| "userAvatarHideFullData"
		| "userAvatarVisibility"
		| "userAvatarRole"
		| "anhChatModeHideTaskCompletion"
		| "anhShowRoleCardOnSwitch"
		| "updateAnhExtensionSettings"
		| "toggleAnhExtension"
		| "getAnhExtensionState"
		| "anhExtensionState"
		| "saveSillyTavernWorldBookChanges"
	| "saveWorldviewChanges"
	| "saveAnhExtensionChanges"
		| "resetAnhExtensionChanges"
		| "saveTSProfileChanges"
		| "getTSProfileState"
		| "tsProfileState"
		| "createWorldsetFolder"
		| "getWorldsetList"
		| "getWorldsetFiles"
		| "readWorldsetFile"
		| "enableWorldset"
		| "disableWorldset"
		| "disableAllWorldsets"
		| "getWorldsetStatus"
		| "openWorldsetFolder"
		| "loadTsProfiles"
		| "validateTsProfile"
		| "browseTsProfile"
		| "enableTSProfile"
		| "disableTSProfile"
		| "anhTsProfileAutoInject"
		| "anhTsProfileVariables"
		| "hideRoleDescription"
		| "variableStateDisplayRows"
		| "variableStateDisplayColumns"
		| "enableInjectSystemPromptVariables"
		| "useRefactoredSystemPrompt"
		| "allowNoToolsInChatMode"
		| "STWordBookToggle"
		| "STWordBookAdd"
		| "STWordBookRemove"
		| "STWordBookUpdate"
		| "STWordBookReload"
		| "STWordBookBrowse"
		| "STWordBookValidate"
		| "STWordBookGetGlobal"
		| "STWordBookCopyToGlobal"
		| "STWordBookCopyFromGlobal"
		| "memorySystemEnabled"
		| "memoryToolsEnabled"
		| "memoryManagement"
		| "enableRooCloudServices"
		| "customUserAgent"
		| "customUserAgentMode"
		| "customUserAgentFull"
		| "enableUIDebug"
		| "uiDebugComponents"
		| "loadTsProfileContent"
		| "loadTsProfileMixin"
		| "saveTsProfileMixin"
		| "saveTsProfileSource"
		| "deleteTsProfileMixin"
		| "toggleAIOutputDisplayMode"
		| "loadGlobalHistory"
		| "addGlobalHistoryItem"
		| "deleteGlobalHistoryItem"
		| "clearGlobalHistory"
		| "loadAllWorldBooks"
		| "browseWorldBookFile"
		| "copyWorldBookToGlobal"
		| "copyWorldBookFromGlobal"
		| "copyWorldBook"
		| "deleteWorldBook"
		| "getGlobalExtensionsInfo"
		| "getWorldBookMixin"
		| "updateWorldBookEntryMixin"
		| "removeWorldBookEntryMixin"
		| "copyExtensionToGlobal"
		| "deleteGlobalExtension"
		| "copyTsProfile"
		| "deleteTsProfile"
		| "getGlobalMemory"
		| "setGlobalMemory"
		| "resetGlobalMemory"
		| "getGlobalRoleMemory"
		| "setGlobalRoleMemory"
		| "resetGlobalRoleMemory"
		| "appendGlobalEpisodicMemory"
		| "upsertGlobalSemanticMemory"
		| "updateGlobalRoleTraits"
		| "updateGlobalRoleGoals"
		| "deleteGlobalRoleMemory"
		| "listGlobalRoleMemories"
		| "loadGlobalRoleMemory"
		| "saveGlobalRoleMemory"
		| "updateGlobalSetting"
	text?: string
	editedMessageContent?: string
	tab?: "settings" | "history" | "mcp" | "modes" | "chat" | "marketplace" | "cloud"
	disabled?: boolean
	array?: string[]
	context?: string
	dataUri?: string
	askResponse?: ClineAskResponse
	apiConfiguration?: ProviderSettings
	images?: string[]
	bool?: boolean
	value?: number
	commands?: string[]
	audioType?: AudioType
	serverName?: string
	toolName?: string
	alwaysAllow?: boolean
	isEnabled?: boolean
	mode?: Mode
	promptMode?: PromptMode
	customPrompt?: PromptComponent
	dataUrls?: string[]
	values?: Record<string, any>
	query?: string
	setting?: string
	slug?: string
	modeConfig?: ModeConfig
	persona?: "hybrid" | "chat"
	timeout?: number
	payload?: WebViewMessagePayload
	source?: "global" | "project"
	requestId?: string
	ids?: string[]
	hasSystemPromptOverride?: boolean
	terminalOperation?: "continue" | "abort"
	messageTs?: number
	restoreCheckpoint?: boolean
	historyPreviewCollapsed?: boolean
	filters?: { type?: string; search?: string; tags?: string[] }
	settings?: any
	url?: string // For openExternal
	mpItem?: MarketplaceItem
	mpInstallOptions?: InstallMarketplaceItemOptions
	config?: Record<string, any> // Add config to the payload
	visibility?: ShareVisibility // For share visibility
	hasContent?: boolean // For checkRulesDirectoryResult
	checkOnly?: boolean // For deleteCustomMode check
	upsellId?: string // For dismissUpsell
	list?: string[] // For dismissedUpsells response
	organizationId?: string | null // For organization switching
	tsProfilePath?: string // For validateTsProfile and other path-based operations
	tsProfileName?: string // For enable/disable TSProfile operations
	// ANH role-related properties
	roles?: any[] // For anhRolesLoaded
	globalRoles?: any[] // For anhGlobalRolesLoaded
	roleUuid?: string // For loadAnhRole
	scope?: "global" | "workspace" // For role scope specification
	role?: any // For anhRoleLoaded
	codeIndexSettings?: {
		// Global state settings
		codebaseIndexEnabled: boolean
		codebaseIndexQdrantUrl: string
		codebaseIndexEmbedderProvider:
			| "openai"
			| "ollama"
			| "openai-compatible"
			| "gemini"
			| "mistral"
			| "vercel-ai-gateway"
		codebaseIndexEmbedderBaseUrl?: string
		codebaseIndexEmbedderModelId: string
		codebaseIndexEmbedderModelDimension?: number // Generic dimension for all providers
		codebaseIndexOpenAiCompatibleBaseUrl?: string
		codebaseIndexSearchMaxResults?: number
		codebaseIndexSearchMinScore?: number

		// Secret settings
		codeIndexOpenAiKey?: string
		codeIndexQdrantApiKey?: string
		codebaseIndexOpenAiCompatibleApiKey?: string
		codebaseIndexGeminiApiKey?: string
		codebaseIndexMistralApiKey?: string
		codebaseIndexVercelAiGatewayApiKey?: string
	}
	// Worldset-related properties
	worldsetName?: string
	worldsetFiles?: string[]
	worldsetContent?: string
	worldsetEnabled?: boolean
	worldsetStatus?: {
		enabled: boolean
		currentWorldset?: string
	}
	worldsetScope?: "global" | "workspace"
	// STWordBook-related properties
	worldBookFilePath?: string // For worldbook file path operations
	worldBookEnabled?: boolean // For toggling worldbook enabled state
	worldBookConfig?: any // For worldbook configuration (WorldBookConfig)
	worldBookFileName?: string // For global worldbook file name operations
	worldBookScope?: "global" | "workspace" // For worldbook scope-aware operations
	// Memory management-related properties
	data?: any // For memory management messages
	mixinData?: any // For saveTsProfileMixin
	profileData?: any // For saveTsProfileSource
	mixinPath?: string // For loadTsProfileMixin and saveTsProfileMixin
	profilePath?: string // For saveTsProfileSource
	// Global history-related properties
	historyItem?: any // For addGlobalHistoryItem
	historyItemId?: string // For deleteGlobalHistoryItem
	// World book-related properties
	worldBookPath?: string // For copyWorldBookToGlobal and copyWorldBookFromGlobal
	// Global memory-related properties
	memory?: any // For setGlobalMemory and setGlobalRoleMemory
	record?: any // For appendGlobalEpisodicMemory and upsertGlobalSemanticMemory
	traits?: any // For updateGlobalRoleTraits
	goals?: any // For updateGlobalRoleGoals
	// Global history-related properties
	globalHistory?: any[] // For loadGlobalHistory
	// World book-related properties
	isGlobal?: boolean // For copyWorldBook operations
	sourceWorldBook?: any // For copyWorldBook operations
	targetScope?: "global" | "workspace" // For copyWorldBook operations
	worldBook?: any // For deleteWorldBook operations
	// Extension-related properties
	sourceExtensionPath?: string // For copyExtensionToGlobal
	extensionName?: string // For copyExtensionToGlobal
	roleUuids?: string[] // For listGlobalRoleMemories
	extensionId?: string // For extension operations
	extensionEnabled?: boolean // For extension toggle operations
	extensionSettings?: Record<string, any> // For extension settings operations
	extensionChanges?: Record<string, any> // For extension changes operations
	// Additional missing properties
	tsProfileFilePath?: string // For tsProfile operations
	sourceProfile?: any // For copyTsProfile operations
	profile?: any // For deleteTsProfile operations
	// World Book Mixin-related properties
	worldBookMixin?: any // For getWorldBookMixin
	entryUid?: number | string // For updateWorldBookEntryMixin and removeWorldBookEntryMixin
	mixinUpdates?: any // For updateWorldBookEntryMixin
	// TSProfile-related properties
	enabledProfiles?: string[] // For saveTSProfileChanges
	autoInject?: boolean // For saveTSProfileChanges
	variables?: Record<string, string> // For saveTSProfileChanges
	workspaceContextKey?: WorkspaceContextSettingKey
	workspaceContextSettings?: Partial<Record<WorkspaceContextSettingKey, boolean>>
}

export const checkoutDiffPayloadSchema = z.object({
	ts: z.number(),
	previousCommitHash: z.string().optional(),
	commitHash: z.string(),
	mode: z.enum(["full", "checkpoint"]),
})

export type CheckpointDiffPayload = z.infer<typeof checkoutDiffPayloadSchema>

export const checkoutRestorePayloadSchema = z.object({
	ts: z.number(),
	commitHash: z.string(),
	mode: z.enum(["preview", "restore"]),
})

export type CheckpointRestorePayload = z.infer<typeof checkoutRestorePayloadSchema>

export interface IndexingStatusPayload {
	state: "Standby" | "Indexing" | "Indexed" | "Error"
	message: string
}

export interface IndexClearedPayload {
	success: boolean
	error?: string
}

export interface ValidateTsProfilePayload {
	path: string
}

export const installMarketplaceItemWithParametersPayloadSchema = z.object({
	item: marketplaceItemSchema,
	parameters: z.record(z.string(), z.any()),
})

export type InstallMarketplaceItemWithParametersPayload = z.infer<
	typeof installMarketplaceItemWithParametersPayloadSchema
>

export type WebViewMessagePayload =
	| CheckpointDiffPayload
	| CheckpointRestorePayload
	| IndexingStatusPayload
	| IndexClearedPayload
	| InstallMarketplaceItemWithParametersPayload
	| UpdateTodoListPayload
	| EditQueuedMessagePayload
	| ValidateTsProfilePayload
