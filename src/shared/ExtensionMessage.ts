import type {
	GlobalSettings,
	ProviderSettingsEntry,
	ProviderSettings,
	HistoryItem,
	ModeConfig,
	TelemetrySetting,
	Experiments,
	ClineMessage,
	MarketplaceItem,
	TodoItem,
	CloudUserInfo,
	CloudOrganizationMembership,
	OrganizationAllowList,
	ShareVisibility,
	QueuedMessage,
	Role,
	RoleSummary,
	RolePromptData,
	UserAvatarVisibility,
	AnhExtensionRuntimeState,
	AnhExtensionCapabilityRegistry,
} from "@roo-code/types"

import { GitCommit } from "../utils/git"

import { McpServer } from "./mcp"
import { Mode } from "./modes"
import { ModelRecord, RouterModels } from "./api"

// Command interface for frontend/backend communication
export interface Command {
	name: string
	source: "global" | "project" | "built-in"
	filePath?: string
	description?: string
	argumentHint?: string
}

// Worldset file interface
export interface WorldsetFile {
	name: string
	path: string
	scope?: "global" | "workspace"
}

// Type for marketplace installed metadata
export interface MarketplaceInstalledMetadata {
	project: Record<string, { type: string }>
	global: Record<string, { type: string }>
}

// Indexing status types
export interface IndexingStatus {
	systemStatus: string
	message?: string
	processedItems: number
	totalItems: number
	currentItemUnit?: string
	workspacePath?: string
}

export interface IndexingStatusUpdateMessage {
	type: "indexingStatusUpdate"
	values: IndexingStatus
}

export interface LanguageModelChatSelector {
	vendor?: string
	family?: string
	version?: string
	id?: string
}

// Represents JSON data that is sent from extension to webview, called
// ExtensionMessage and has 'type' enum which can be 'plusButtonClicked' or
// 'settingsButtonClicked' or 'hello'. Webview will hold state.
export interface ExtensionMessage {
	type:
		| "action"
		| "state"
		| "selectedImages"
		| "theme"
		| "workspaceUpdated"
		| "invoke"
		| "messageUpdated"
		| "mcpServers"
		| "enhancedPrompt"
		| "commitSearchResults"
		| "listApiConfig"
		| "routerModels"
		| "openAiModels"
		| "ollamaModels"
		| "lmStudioModels"
		| "vsCodeLmModels"
		| "huggingFaceModels"
		| "vsCodeLmApiAvailable"
		| "updatePrompt"
		| "systemPrompt"
		| "autoApprovalEnabled"
		| "updateCustomMode"
		| "deleteCustomMode"
		| "exportModeResult"
		| "importModeResult"
		| "checkRulesDirectoryResult"
		| "deleteCustomModeCheck"
		| "currentCheckpointUpdated"
		| "showHumanRelayDialog"
		| "humanRelayResponse"
		| "humanRelayCancel"
		| "browserToolEnabled"
		| "browserConnectionResult"
		| "remoteBrowserEnabled"
		| "ttsStart"
		| "ttsStop"
		| "maxReadFileLine"
		| "fileSearchResults"
		| "toggleApiConfigPin"
		| "acceptInput"
		| "setHistoryPreviewCollapsed"
		| "commandExecutionStatus"
		| "mcpExecutionStatus"
		| "vsCodeSetting"
		| "authenticatedUser"
		| "condenseTaskContextResponse"
		| "singleRouterModelFetchResponse"
		| "indexingStatusUpdate"
		| "indexCleared"
		| "codebaseIndexConfig"
		| "marketplaceInstallResult"
		| "marketplaceRemoveResult"
		| "marketplaceData"
		| "shareTaskSuccess"
		| "codeIndexSettingsSaved"
		| "codeIndexSecretStatus"
		| "showDeleteMessageDialog"
		| "showEditMessageDialog"
		| "commands"
		| "insertTextIntoTextarea"
		| "dismissedUpsells"
		| "organizationSwitchResult"
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
		| "enableUserAvatar"
		| "userAvatarRole"
		| "worldsetList"
		| "worldsetFiles"
		| "worldsetContent"
		| "worldsetStatus"
		| "worldsetStatusUpdate"
		| "worldsetFolderCreated"
		| "tsProfilesLoaded"
		| "tsProfileValidated"
		| "tsProfileSelected"
		| "tsProfileContentLoaded"
		| "tsProfileMixinLoaded"
		| "tsProfileMixinSaved"
		| "tsProfileSourceSaved"
		| "STWordBookBrowseResponse"
		| "STWordBookValidateResponse"
	| "globalHistoryLoaded"
		| "globalHistoryItemAdded"
		| "globalHistoryItemDeleted"
		| "globalHistoryCleared"
		| "allWorldBooksLoaded"
		| "globalMemoryResponse"
		| "globalRoleMemoryResponse"
		| "globalRoleMemoriesListed"
		| "memoryManagementResponse"
		| "worldBookFileSelected"
		| "worldBookCopied"
		| "worldBookDeleted"
		| "globalExtensionsInfoLoaded"
		| "extensionCopiedToGlobal"
		| "STWordBookGetGlobalResponse"
		| "tsProfileFileSelected"
		| "tsProfileCopied"
		| "tsProfileDeleted"
		| "globalExtensionDeleted"
		| "globalRoleMemoryLoaded"
	| "saveGlobalRoleMemory"
	| "worldBookMixinLoaded"
	| "worldBookEntryMixinUpdated"
	| "worldBookEntryMixinRemoved"
	| "anhExtensionState"
	| "tsProfileState"
	text?: string
	payload?: any // Add a generic payload for now, can refine later
	action?:
		| "chatButtonClicked"
		| "mcpButtonClicked"
		| "settingsButtonClicked"
		| "historyButtonClicked"
		| "promptsButtonClicked"
		| "marketplaceButtonClicked"
		| "cloudButtonClicked"
		| "didBecomeVisible"
		| "focusInput"
		| "switchTab"
		| "toggleAutoApprove"
	invoke?: "newChat" | "sendMessage" | "primaryButtonClick" | "secondaryButtonClick" | "setChatBoxMessage"
	state?: ExtensionState
	images?: string[]
	filePaths?: string[]
	openedTabs?: Array<{
		label: string
		isActive: boolean
		path?: string
	}>
	clineMessage?: ClineMessage
	routerModels?: RouterModels
	openAiModels?: string[]
	ollamaModels?: ModelRecord
	lmStudioModels?: ModelRecord
	vsCodeLmModels?: { vendor?: string; family?: string; version?: string; id?: string }[]
	huggingFaceModels?: Array<{
		id: string
		object: string
		created: number
		owned_by: string
		providers: Array<{
			provider: string
			status: "live" | "staging" | "error"
			supports_tools?: boolean
			supports_structured_output?: boolean
			context_length?: number
			pricing?: {
				input: number
				output: number
			}
		}>
	}>
	mcpServers?: McpServer[]
	commits?: GitCommit[]
	listApiConfig?: ProviderSettingsEntry[]
	mode?: Mode
	customMode?: ModeConfig
	slug?: string
	success?: boolean
	values?: Record<string, any>
	requestId?: string
	promptText?: string
	results?: { path: string; type: "file" | "folder"; label?: string }[]
	error?: string
	setting?: string
	value?: any
	hasContent?: boolean // For checkRulesDirectoryResult
	items?: MarketplaceItem[]
	userInfo?: CloudUserInfo
	organizationAllowList?: OrganizationAllowList
	tab?: string
	marketplaceItems?: MarketplaceItem[]
	organizationMcps?: MarketplaceItem[]
	marketplaceInstalledMetadata?: MarketplaceInstalledMetadata
	errors?: string[]
	visibility?: ShareVisibility
	rulesFolderPath?: string
	settings?: any
	messageTs?: number
	hasCheckpoint?: boolean
	context?: string
	commands?: Command[]
	queuedMessages?: QueuedMessage[]
	list?: string[] // For dismissedUpsells
	organizationId?: string | null // For organizationSwitchResult
	roles?: RoleSummary[] // For anhRolesLoaded
	globalRoles?: RoleSummary[] // For anhGlobalRolesLoaded
	roleUuid?: string // For loadAnhRole
	role?: Role // For anhRoleLoaded
	worldsetList?: string[] // For worldsetList
	worldsetFiles?: WorldsetFile[] // For worldsetFiles
	worldsetName?: string // For worldsetFiles and other worldset operations
	worldsetContent?: string // For worldsetContent
	worldsetStatus?: { enabled: boolean; enabledWorldsets?: string[] } // For worldsetStatus
	tsProfiles?: any[] // For tsProfilesLoaded
	tsProfileSuccess?: boolean // For tsProfileValidated
	tsProfileName?: string // For tsProfileValidated
	tsProfilePromptsCount?: number // For tsProfileValidated
	tsProfileError?: string // For tsProfileValidated
	tsProfilePath?: string // For tsProfileValidated and tsProfileSelected
	tsProfileContent?: any // For tsProfileContentLoaded
	tsProfileMixin?: any // For tsProfileMixinLoaded
	tsProfileMixinSaved?: boolean // For tsProfileMixinSaved
	tsProfileSourceSaved?: boolean // For tsProfileSourceSaved
	profileData?: any // For tsProfileContentLoaded
	mixinData?: any // For tsProfileContentLoaded and tsProfileMixinLoaded
	mixinPath?: string // For tsProfileContentLoaded, tsProfileMixinLoaded and tsProfileMixinSaved
	profilePath?: string // For tsProfileSourceSaved
	// STWordBook-related properties
	worldBookFilePath?: string // For STWordBookBrowseResponse
	worldBookValid?: boolean // For STWordBookValidateResponse
	worldBookValidationError?: string // For STWordBookValidateResponse
	worldBookInfo?: any // For STWordBookValidateResponse (WorldBookInfo)
	// Global history-related properties
	globalHistoryItems?: any[] // For globalHistoryLoaded
	globalHistoryError?: string // For globalHistoryLoaded
	globalHistoryItemId?: string // For globalHistoryItemDeleted
	// Global world books-related properties
	allWorldBooks?: any[] // For allWorldBooksLoaded
	// Global memory-related properties
	globalMemoryData?: any // For globalMemoryResponse and globalRoleMemoryResponse
	globalRoleMemories?: any[] // For globalRoleMemoriesListed
	// World book-related properties
	worldBooks?: any[] // For worldBook operations
	worldBook?: any // For worldBook operations
	// Extension-related properties
	globalExtensions?: any[] // For globalExtensionsInfoLoaded
	// Role UUID list property
	roleUuids?: string[] // For globalRoleMemoriesListed
	// Additional missing properties
	globalHistory?: any[] // For globalHistoryLoaded
	historyItem?: any // For globalHistoryItemAdded
	historyItemId?: string // For globalHistoryItemDeleted
	extensionsInfo?: any[] // For globalExtensionsInfoLoaded
	sourceProfile?: any // For copyTsProfile operations
	profile?: any // For deleteTsProfile operations
	globalWorldBooks?: any[] // For STWordBookGetGlobalResponse
	globalWorldBooksPath?: string // For STWordBookGetGlobalResponse
	globalWorldBooksWithInfo?: any[] // For STWordBookGetGlobalResponse - detailed info with entry counts
	tsProfileFilePath?: string // For tsProfile operations
	memory?: any // For globalRoleMemory operations
	stats?: any // For globalRoleMemoryLoaded
	// World Book Mixin-related properties
	worldBookMixin?: any // For worldBookMixinLoaded
	mixinUpdated?: boolean // For worldBookEntryMixinUpdated
	mixinRemoved?: boolean // For worldBookEntryMixinRemoved
	entryUid?: number | string // For worldBookEntryMixinUpdated and worldBookEntryMixinRemoved
	mixin?: any // For worldBookEntryMixinUpdated
}

export type ExtensionState = Pick<
	GlobalSettings,
	| "currentApiConfigName"
	| "listApiConfigMeta"
	| "pinnedApiConfigs"
	// | "lastShownAnnouncementId"
	| "customInstructions"
	// | "taskHistory" // Optional in GlobalSettings, required here.
	| "dismissedUpsells"
	| "autoApprovalEnabled"
	| "alwaysAllowReadOnly"
	| "alwaysAllowReadOnlyOutsideWorkspace"
	| "alwaysAllowWrite"
	| "alwaysAllowWriteOutsideWorkspace"
	| "alwaysAllowWriteProtected"
	// | "writeDelayMs" // Optional in GlobalSettings, required here.
	| "alwaysAllowBrowser"
	| "alwaysApproveResubmit"
	// | "requestDelaySeconds" // Optional in GlobalSettings, required here.
	| "alwaysAllowMcp"
	| "alwaysAllowModeSwitch"
	| "alwaysAllowSubtasks"
	| "alwaysAllowFollowupQuestions"
	| "alwaysAllowExecute"
	| "alwaysAllowUpdateTodoList"
	| "followupAutoApproveTimeoutMs"
	| "allowedCommands"
	| "deniedCommands"
	| "allowedMaxRequests"
	| "allowedMaxCost"
	| "browserToolEnabled"
	| "browserViewportSize"
	| "screenshotQuality"
	| "remoteBrowserEnabled"
	| "cachedChromeHostUrl"
	| "remoteBrowserHost"
	// | "enableCheckpoints" // Optional in GlobalSettings, required here.
	| "ttsEnabled"
	| "ttsSpeed"
	| "soundEnabled"
	| "soundVolume"
	// | "maxOpenTabsContext" // Optional in GlobalSettings, required here.
	// | "maxWorkspaceFiles" // Optional in GlobalSettings, required here.
	// | "showRooIgnoredFiles" // Optional in GlobalSettings, required here.
	// | "maxReadFileLine" // Optional in GlobalSettings, required here.
	| "maxConcurrentFileReads" // Optional in GlobalSettings, required here.
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
	| "diagnosticsEnabled"
	| "diffEnabled"
	| "fuzzyMatchThreshold"
	// | "experiments" // Optional in GlobalSettings, required here.
	| "language"
	// | "telemetrySetting" // Optional in GlobalSettings, required here.
	// | "mcpEnabled" // Optional in GlobalSettings, required here.
	// | "enableMcpServerCreation" // Optional in GlobalSettings, required here.
	// | "mode" // Optional in GlobalSettings, required here.
	| "modeApiConfigs"
	// | "customModes" // Optional in GlobalSettings, required here.
	| "customModePrompts"
	| "customSupportPrompts"
	| "enhancementApiConfigId"
	| "condensingApiConfigId"
	| "customCondensingPrompt"
	| "codebaseIndexConfig"
	| "codebaseIndexModels"
	| "profileThresholds"
	| "includeDiagnosticMessages"
	| "maxDiagnosticMessages"
	| "openRouterImageGenerationSelectedModel"
	| "includeTaskHistoryInEnhance"
	| "reasoningBlockCollapsed"
	| "currentAnhRole"
	| "anhShowRoleCardOnSwitch"
	| "userAvatarRole"
	| "enableUserAvatar"
	| "userAvatarHideFullData"
	| "userAvatarVisibility"
	| "hideRoleDescription"
	| "enabledWorldsets"
	| "anhExtensionsEnabled"
	| "anhExtensionSettings"
	| "anhExtensionsHasChanges"
	| "tsProfilesHasChanges"
	| "memorySystemEnabled"
	| "memoryToolsEnabled"
> & {
	enabledTSProfiles?: string[]
	anhTsProfileAutoInject?: boolean
	anhTsProfileVariables?: Record<string, string>
} & {
	version: string
	clineMessages: ClineMessage[]
	currentTaskItem?: HistoryItem
	currentTaskTodos?: TodoItem[] // Initial todos for the current task
	apiConfiguration: ProviderSettings
	uriScheme?: string
	shouldShowAnnouncement: boolean

	taskHistory: HistoryItem[]

	writeDelayMs: number
	requestDelaySeconds: number

	enableCheckpoints: boolean
	maxOpenTabsContext: number // Maximum number of VSCode open tabs to include in context (0-500)
	maxWorkspaceFiles: number // Maximum number of files to include in current working directory details (0-500)
	showRooIgnoredFiles: boolean // Whether to show .rooignore'd files in listings
	maxReadFileLine: number // Maximum number of lines to read from a file before truncating
	maxImageFileSize: number // Maximum size of image files to process in MB
	maxTotalImageSize: number // Maximum total size for all images in a single read operation in MB

	experiments: Experiments // Map of experiment IDs to their enabled state

	mcpEnabled: boolean
	enableMcpServerCreation: boolean

	mode: Mode
	customModes: ModeConfig[]
	toolRequirements?: Record<string, boolean> // Map of tool names to their requirements (e.g. {"apply_diff": true} if diffEnabled)

	cwd?: string // Current working directory
	telemetrySetting: TelemetrySetting
	telemetryKey?: string
	machineId?: string

	renderContext: "sidebar" | "editor"
	settingsImportedAt?: number
	historyPreviewCollapsed?: boolean

	cloudUserInfo: CloudUserInfo | null
	cloudIsAuthenticated: boolean
	cloudApiUrl?: string
	cloudOrganizations?: CloudOrganizationMembership[]
	sharingEnabled: boolean
	organizationAllowList: OrganizationAllowList
	organizationSettingsVersion?: number

	autoCondenseContext: boolean
	autoCondenseContextPercent: number
	marketplaceItems?: MarketplaceItem[]
	marketplaceInstalledMetadata?: { project: Record<string, any>; global: Record<string, any> }
	profileThresholds: Record<string, number>
	hasOpenedModeSelector: boolean
	openRouterImageApiKey?: string
	openRouterUseMiddleOutTransform?: boolean
	messageQueue?: QueuedMessage[]
	lastShownAnnouncementId?: string
	apiModelId?: string
	mcpServers?: McpServer[]
	hasSystemPromptOverride?: boolean
	mdmCompliant?: boolean
	remoteControlEnabled: boolean
	taskSyncEnabled: boolean
	featureRoomoteControlEnabled: boolean
	currentAnhRole?: Role // Currently selected ANH role
	anhPersonaMode?: "chat" | "hybrid" // Current persona mode
	anhToneStrict?: boolean // Whether to use strict tone
	anhUseAskTool?: boolean // Whether to use Ask Tool for direct queries
	anhChatModeHideTaskCompletion?: boolean // Whether to hide task completion in chat mode
	anhShowRoleCardOnSwitch?: boolean // Whether to show role card when switching roles
	displayMode?: "coding" | "chat" // Current display mode for history view
	rolePromptData?: RolePromptData // Role prompt data for system prompt generation (optional, not part of core state)
	userAvatarRole?: Role // Currently selected user avatar role
	enableUserAvatar?: boolean // Whether to enable user avatar feature
	userAvatarHideFullData?: boolean // Whether to share only a summary of the user avatar with roles
	userAvatarVisibility?: UserAvatarVisibility // Level of user avatar detail shared with roles
	anhExtensionsRuntime?: AnhExtensionRuntimeState[]
	anhExtensionCapabilityRegistry?: AnhExtensionCapabilityRegistry
	anhExtensionSettings?: Record<string, Record<string, unknown>>
	memorySystemEnabled?: boolean // Whether the memory system is enabled
	memoryToolsEnabled?: boolean // Whether the memory tools are enabled
	sillyTavernWorldBookState?: {
		loadedWorldBooks: Array<{
			name: string
			path: string
			entryCount: number
			fileSize: number
			lastModified: number
			loaded: boolean
			error?: string
		}>
		activeWorldBooks: string[]
		configs: Record<string, any>
		lastUpdated: number
	}
	globalWorldBooksPath?: string // Global world books directory path
}

export interface ClineSayTool {
	tool:
		| "editedExistingFile"
		| "appliedDiff"
		| "newFileCreated"
		| "codebaseSearch"
		| "readFile"
		| "fetchInstructions"
		| "listFilesTopLevel"
		| "listFilesRecursive"
		| "listCodeDefinitionNames"
		| "searchFiles"
		| "switchMode"
		| "newTask"
		| "finishTask"
		| "searchAndReplace"
		| "insertContent"
		| "generateImage"
		| "imageGenerated"
		| "runSlashCommand"
	path?: string
	diff?: string
	content?: string
	regex?: string
	filePattern?: string
	mode?: string
	reason?: string
	isOutsideWorkspace?: boolean
	isProtected?: boolean
	additionalFileCount?: number // Number of additional files in the same read_file request
	search?: string
	replace?: string
	useRegex?: boolean
	ignoreCase?: boolean
	startLine?: number
	endLine?: number
	lineNumber?: number
	query?: string
	batchFiles?: Array<{
		path: string
		lineSnippet: string
		isOutsideWorkspace?: boolean
		key: string
		content?: string
	}>
	batchDiffs?: Array<{
		path: string
		changeCount: number
		key: string
		content: string
		diffs?: Array<{
			content: string
			startLine?: number
		}>
	}>
	question?: string
	imageData?: string // Base64 encoded image data for generated images
	// Properties for runSlashCommand tool
	command?: string
	args?: string
	source?: string
	description?: string
}

// Must keep in sync with system prompt.
export const browserActions = [
	"launch",
	"click",
	"hover",
	"type",
	"scroll_down",
	"scroll_up",
	"resize",
	"close",
] as const

export type BrowserAction = (typeof browserActions)[number]

export interface ClineSayBrowserAction {
	action: BrowserAction
	coordinate?: string
	size?: string
	text?: string
}

export type BrowserActionResult = {
	screenshot?: string
	logs?: string
	currentUrl?: string
	currentMousePosition?: string
}

export interface ClineAskUseMcpServer {
	serverName: string
	type: "use_mcp_tool" | "access_mcp_resource"
	toolName?: string
	arguments?: string
	uri?: string
	response?: string
}

export interface ClineApiReqInfo {
	request?: string
	tokensIn?: number
	tokensOut?: number
	cacheWrites?: number
	cacheReads?: number
	cost?: number
	cancelReason?: ClineApiReqCancelReason
	streamingFailedMessage?: string
	apiProtocol?: "anthropic" | "openai"
}

export type ClineApiReqCancelReason = "streaming_failed" | "user_cancelled"
