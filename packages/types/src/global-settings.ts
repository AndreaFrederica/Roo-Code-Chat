import { z } from "zod"

import { type Keys } from "./type-fu.js"
import { roleSchema } from "./anh-chat.js"
import {
	type ProviderSettings,
	PROVIDER_SETTINGS_KEYS,
	providerSettingsEntrySchema,
	providerSettingsSchema,
} from "./provider-settings.js"
import { historyItemSchema } from "./history.js"
import { codebaseIndexModelsSchema, codebaseIndexConfigSchema } from "./codebase-index.js"
import { experimentsSchema } from "./experiment.js"
import { telemetrySettingsSchema } from "./telemetry.js"
import { modeConfigSchema } from "./mode.js"
import { customModePromptsSchema, customSupportPromptsSchema } from "./mode.js"
import { languagesSchema } from "./vscode.js"

export const userAvatarVisibilitySchema = z.enum(["full", "summary", "name", "hidden"])
export type UserAvatarVisibility = z.infer<typeof userAvatarVisibilitySchema>

export const workspaceContextSettingsSchema = z.object({
	visibleFiles: z.boolean().optional(),
	openTabs: z.boolean().optional(),
	terminals: z.boolean().optional(),
	recentFiles: z.boolean().optional(),
	currentTime: z.boolean().optional(),
	currentCost: z.boolean().optional(),
	currentMode: z.boolean().optional(),
	workspaceFiles: z.boolean().optional(),
	todo: z.boolean().optional(),
})

export type WorkspaceContextSettings = z.infer<typeof workspaceContextSettingsSchema>

export const WORKSPACE_CONTEXT_SETTING_KEYS = [
	"visibleFiles",
	"openTabs",
	"terminals",
	"recentFiles",
	"currentTime",
	"currentCost",
	"currentMode",
	"workspaceFiles",
	"todo",
] as const

export type WorkspaceContextSettingKey = (typeof WORKSPACE_CONTEXT_SETTING_KEYS)[number]

export const DEFAULT_WORKSPACE_CONTEXT_SETTINGS: Record<WorkspaceContextSettingKey, boolean> = {
	visibleFiles: true,
	openTabs: true,
	terminals: true,
	recentFiles: true,
	currentTime: true,
	currentCost: true,
	currentMode: true,
	workspaceFiles: true,
	todo: true,
}

/**
 * Default delay in milliseconds after writes to allow diagnostics to detect potential problems.
 * This delay is particularly important for Go and other languages where tools like goimports
 * need time to automatically clean up unused imports.
 */
export const DEFAULT_WRITE_DELAY_MS = 1000

/**
 * Default terminal output character limit constant.
 * This provides a reasonable default that aligns with typical terminal usage
 * while preventing context window explosions from extremely long lines.
 */
export const DEFAULT_TERMINAL_OUTPUT_CHARACTER_LIMIT = 50_000

/**
 * GlobalSettings
 */

export const globalSettingsSchema = z.object({
	currentApiConfigName: z.string().optional(),
	listApiConfigMeta: z.array(providerSettingsEntrySchema).optional(),
	pinnedApiConfigs: z.record(z.string(), z.boolean()).optional(),

	lastShownAnnouncementId: z.string().optional(),
	customInstructions: z.string().optional(),
	taskHistory: z.array(historyItemSchema).optional(),
	dismissedUpsells: z.array(z.string()).optional(),

	// Image generation settings (experimental) - flattened for simplicity
	openRouterImageApiKey: z.string().optional(),
	openRouterImageGenerationSelectedModel: z.string().optional(),

	condensingApiConfigId: z.string().optional(),
	customCondensingPrompt: z.string().optional(),

	autoApprovalEnabled: z.boolean().optional(),
	alwaysAllowReadOnly: z.boolean().optional(),
	alwaysAllowReadOnlyOutsideWorkspace: z.boolean().optional(),
	alwaysAllowWrite: z.boolean().optional(),
	alwaysAllowWriteOutsideWorkspace: z.boolean().optional(),
	alwaysAllowWriteProtected: z.boolean().optional(),
	writeDelayMs: z.number().min(0).optional(),
	alwaysAllowBrowser: z.boolean().optional(),
	alwaysApproveResubmit: z.boolean().optional(),
	requestDelaySeconds: z.number().optional(),
	alwaysAllowMcp: z.boolean().optional(),
	alwaysAllowModeSwitch: z.boolean().optional(),
	alwaysAllowSubtasks: z.boolean().optional(),
	alwaysAllowExecute: z.boolean().optional(),
	alwaysAllowFollowupQuestions: z.boolean().optional(),
	followupAutoApproveTimeoutMs: z.number().optional(),
	alwaysAllowUpdateTodoList: z.boolean().optional(),
	allowedCommands: z.array(z.string()).optional(),
	deniedCommands: z.array(z.string()).optional(),
	commandExecutionTimeout: z.number().optional(),
	commandTimeoutAllowlist: z.array(z.string()).optional(),
	preventCompletionWithOpenTodos: z.boolean().optional(),
	allowedMaxRequests: z.number().nullish(),
	allowedMaxCost: z.number().nullish(),
	autoCondenseContext: z.boolean().optional(),
	autoCondenseContextPercent: z.number().optional(),
	maxConcurrentFileReads: z.number().optional(),

	/**
	 * Whether to include diagnostic messages (errors, warnings) in tool outputs
	 * @default true
	 */
	includeDiagnosticMessages: z.boolean().optional(),
	/**
	 * Maximum number of diagnostic messages to include in tool outputs
	 * @default 50
	 */
	maxDiagnosticMessages: z.number().optional(),

	browserToolEnabled: z.boolean().optional(),
	browserViewportSize: z.string().optional(),
	screenshotQuality: z.number().optional(),
	remoteBrowserEnabled: z.boolean().optional(),
	remoteBrowserHost: z.string().optional(),
	cachedChromeHostUrl: z.string().optional(),

	enableCheckpoints: z.boolean().optional(),

	ttsEnabled: z.boolean().optional(),
	ttsSpeed: z.number().optional(),
	soundEnabled: z.boolean().optional(),
	soundVolume: z.number().optional(),

	maxOpenTabsContext: z.number().optional(),
	maxWorkspaceFiles: z.number().optional(),
	showRooIgnoredFiles: z.boolean().optional(),
	maxReadFileLine: z.number().optional(),
	maxImageFileSize: z.number().optional(),
	maxTotalImageSize: z.number().optional(),

	workspaceContextSettings: workspaceContextSettingsSchema.optional(),

	terminalOutputLineLimit: z.number().optional(),
	terminalOutputCharacterLimit: z.number().optional(),
	terminalShellIntegrationTimeout: z.number().optional(),
	terminalShellIntegrationDisabled: z.boolean().optional(),
	terminalCommandDelay: z.number().optional(),
	terminalPowershellCounter: z.boolean().optional(),
	terminalZshClearEolMark: z.boolean().optional(),
	terminalZshOhMy: z.boolean().optional(),
	terminalZshP10k: z.boolean().optional(),
	terminalZdotdir: z.boolean().optional(),
	terminalCompressProgressBar: z.boolean().optional(),

	diagnosticsEnabled: z.boolean().optional(),

	rateLimitSeconds: z.number().optional(),
	diffEnabled: z.boolean().optional(),
	fuzzyMatchThreshold: z.number().optional(),
	experiments: experimentsSchema.optional(),

	codebaseIndexModels: codebaseIndexModelsSchema.optional(),
	codebaseIndexConfig: codebaseIndexConfigSchema.optional(),

	language: languagesSchema.optional(),

	telemetrySetting: telemetrySettingsSchema.optional(),

	mcpEnabled: z.boolean().optional(),
	enableMcpServerCreation: z.boolean().optional(),

	mode: z.string().optional(),
	modeApiConfigs: z.record(z.string(), z.string()).optional(),
	customModes: z.array(modeConfigSchema).optional(),
	customModePrompts: customModePromptsSchema.optional(),
	customSupportPrompts: customSupportPromptsSchema.optional(),
	enhancementApiConfigId: z.string().optional(),
	includeTaskHistoryInEnhance: z.boolean().optional(),
	historyPreviewCollapsed: z.boolean().optional(),
	reasoningBlockCollapsed: z.boolean().optional(),
	profileThresholds: z.record(z.string(), z.number()).optional(),
	hasOpenedModeSelector: z.boolean().optional(),
	lastModeExportPath: z.string().optional(),
	lastModeImportPath: z.string().optional(),

	// ANH (Advanced Novel Helper) settings
	currentAnhRole: roleSchema.optional(),
	anhPersonaMode: z.enum(["hybrid", "chat"]).optional(),
	anhToneStrict: z.boolean().optional(),
	anhUseAskTool: z.boolean().optional(),
	anhChatModeHideTaskCompletion: z.boolean().optional(),
	anhShowRoleCardOnSwitch: z.boolean().optional(),
	allowNoToolsInChatMode: z.boolean().optional(),
	anhExtensionsEnabled: z.record(z.string(), z.boolean()).optional(),
	anhExtensionSettings: z
		.record(z.string(), z.record(z.string(), z.any()))
		.optional(),
	anhExtensionsHasChanges: z.boolean().optional(),

	// TSProfile (Tavern Style Profile) settings
	enabledTSProfiles: z.array(z.string()).optional(),
	anhTsProfileAutoInject: z.boolean().optional(),
	anhTsProfileVariables: z.record(z.string(), z.string()).optional(),
	tsProfilesHasChanges: z.boolean().optional(),
	
	// User avatar role settings
	userAvatarRole: roleSchema.optional(),
	enableUserAvatar: z.boolean().optional(),
	userAvatarHideFullData: z.boolean().optional(),
	userAvatarVisibility: userAvatarVisibilitySchema.optional(),
	hideRoleDescription: z.boolean().optional(),

	// UI Display settings
	displayMode: z.enum(["coding", "chat"]).optional(),

	// Worldset settings
	enabledWorldsets: z.array(z.string()).optional(),

	// SillyTavern WorldBook settings
	sillyTavernWorldBookConfigs: z.record(z.string(), z.object({
		filePath: z.string(),
		enabled: z.boolean(),
		markdownOptions: z.object({
			headingLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]).optional(),
			titleStrategy: z.enum(['auto', 'comment', 'key', 'uid']).optional(),
			includeDisabled: z.boolean().optional(),
			sortBy: z.enum(['order', 'displayIndex', 'uid', 'title', 'none']).optional(),
			includeFrontMatter: z.boolean().optional(),
			frontMatterStyle: z.enum(['table', 'yaml']).optional(),
			includeKeys: z.boolean().optional()
		}).optional(),
		autoReload: z.boolean().optional(),
		reloadInterval: z.number().optional()
	})).optional(),
	sillyTavernWorldBookActiveBooks: z.array(z.string()).optional(),

	// Memory system settings
	memoryToolsEnabled: z.boolean().optional(),
	memorySystemEnabled: z.boolean().optional(),
})

export type GlobalSettings = z.infer<typeof globalSettingsSchema>

export const GLOBAL_SETTINGS_KEYS = globalSettingsSchema.keyof().options

/**
 * RooCodeSettings
 */

export const rooCodeSettingsSchema = providerSettingsSchema.merge(globalSettingsSchema)

export type RooCodeSettings = GlobalSettings & ProviderSettings

/**
 * SecretState
 */
export const SECRET_STATE_KEYS = [
	"apiKey",
	"glamaApiKey",
	"openRouterApiKey",
	"awsAccessKey",
	"awsApiKey",
	"awsSecretKey",
	"awsSessionToken",
	"openAiApiKey",
	"ollamaApiKey",
	"geminiApiKey",
	"openAiNativeApiKey",
	"cerebrasApiKey",
	"deepSeekApiKey",
	"doubaoApiKey",
	"moonshotApiKey",
	"mistralApiKey",
	"unboundApiKey",
	"requestyApiKey",
	"xaiApiKey",
	"groqApiKey",
	"chutesApiKey",
	"litellmApiKey",
	"deepInfraApiKey",
	"codeIndexOpenAiKey",
	"codeIndexQdrantApiKey",
	"codebaseIndexOpenAiCompatibleApiKey",
	"codebaseIndexGeminiApiKey",
	"codebaseIndexMistralApiKey",
	"codebaseIndexVercelAiGatewayApiKey",
	"huggingFaceApiKey",
	"sambaNovaApiKey",
	"zaiApiKey",
	"fireworksApiKey",
	"featherlessApiKey",
	"ioIntelligenceApiKey",
	"vercelAiGatewayApiKey",
] as const

// Global secrets that are part of GlobalSettings (not ProviderSettings)
export const GLOBAL_SECRET_KEYS = [
	"openRouterImageApiKey", // For image generation
] as const

// Type for the actual secret storage keys
type ProviderSecretKey = (typeof SECRET_STATE_KEYS)[number]
type GlobalSecretKey = (typeof GLOBAL_SECRET_KEYS)[number]

// Type representing all secrets that can be stored
export type SecretState = Pick<ProviderSettings, Extract<ProviderSecretKey, keyof ProviderSettings>> & {
	[K in GlobalSecretKey]?: string
}

export const isSecretStateKey = (key: string): key is Keys<SecretState> =>
	SECRET_STATE_KEYS.includes(key as ProviderSecretKey) || GLOBAL_SECRET_KEYS.includes(key as GlobalSecretKey)

/**
 * GlobalState
 */

export type GlobalState = Omit<RooCodeSettings, Keys<SecretState>>

export const GLOBAL_STATE_KEYS = [...GLOBAL_SETTINGS_KEYS, ...PROVIDER_SETTINGS_KEYS].filter(
	(key: Keys<RooCodeSettings>) => !isSecretStateKey(key),
) as Keys<GlobalState>[]

export const isGlobalStateKey = (key: string): key is Keys<GlobalState> =>
	GLOBAL_STATE_KEYS.includes(key as Keys<GlobalState>)

/**
 * Evals
 */

// Default settings when running evals (unless overridden).
export const EVALS_SETTINGS: RooCodeSettings = {
	apiProvider: "openrouter",
	openRouterUseMiddleOutTransform: false,

	lastShownAnnouncementId: "jul-09-2025-3-23-0",

	pinnedApiConfigs: {},

	autoApprovalEnabled: true,
	alwaysAllowReadOnly: true,
	alwaysAllowReadOnlyOutsideWorkspace: false,
	alwaysAllowWrite: true,
	alwaysAllowWriteOutsideWorkspace: false,
	alwaysAllowWriteProtected: false,
	writeDelayMs: 1000,
	alwaysAllowBrowser: true,
	alwaysApproveResubmit: true,
	requestDelaySeconds: 10,
	alwaysAllowMcp: true,
	alwaysAllowModeSwitch: true,
	alwaysAllowSubtasks: true,
	alwaysAllowExecute: true,
	alwaysAllowFollowupQuestions: true,
	alwaysAllowUpdateTodoList: true,
	followupAutoApproveTimeoutMs: 0,
	allowedCommands: ["*"],
	commandExecutionTimeout: 20,
	commandTimeoutAllowlist: [],
	preventCompletionWithOpenTodos: false,

	browserToolEnabled: false,
	browserViewportSize: "900x600",
	screenshotQuality: 75,
	remoteBrowserEnabled: false,

	ttsEnabled: false,
	ttsSpeed: 1,
	soundEnabled: false,
	soundVolume: 0.5,

	terminalOutputLineLimit: 500,
	terminalOutputCharacterLimit: DEFAULT_TERMINAL_OUTPUT_CHARACTER_LIMIT,
	terminalShellIntegrationTimeout: 30000,
	terminalCommandDelay: 0,
	terminalPowershellCounter: false,
	terminalZshOhMy: true,
	terminalZshClearEolMark: true,
	terminalZshP10k: false,
	terminalZdotdir: true,
	terminalCompressProgressBar: true,
	terminalShellIntegrationDisabled: true,

	diagnosticsEnabled: true,

	workspaceContextSettings: { ...DEFAULT_WORKSPACE_CONTEXT_SETTINGS },

	diffEnabled: true,
	fuzzyMatchThreshold: 1,

	enableCheckpoints: false,

	rateLimitSeconds: 0,
	maxOpenTabsContext: 20,
	maxWorkspaceFiles: 200,
	showRooIgnoredFiles: true,
	maxReadFileLine: -1, // -1 to enable full file reading.

	includeDiagnosticMessages: true,
	maxDiagnosticMessages: 50,

	language: "en",
	telemetrySetting: "enabled",

	anhPersonaMode: "hybrid",
	anhToneStrict: true,
	anhUseAskTool: true,
	anhChatModeHideTaskCompletion: true,
	allowNoToolsInChatMode: false,
	displayMode: "coding",
	mcpEnabled: false,
	enableUserAvatar: false,
	userAvatarHideFullData: false,
	userAvatarVisibility: "full",

	mode: "code", // "architect",

	customModes: [],
}

export const EVALS_TIMEOUT = 5 * 60 * 1_000
