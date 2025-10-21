import * as vscode from "vscode"
import { WebviewMessage } from "../../shared/WebviewMessage"
import { defaultModeSlug, getModeBySlug, getGroupName } from "../../shared/modes"
import { buildApiHandler } from "../../api"
import { experiments as experimentsModule, EXPERIMENT_IDS } from "../../shared/experiments"
import { debugLog, debugError } from "../../utils/debug"

import { SYSTEM_PROMPT as LEGACY_SYSTEM_PROMPT } from "../prompts/system"
import { SYSTEM_PROMPT as REFACTORED_SYSTEM_PROMPT } from "../prompts/system-refactored"
import { MultiSearchReplaceDiffStrategy } from "../diff/strategies/multi-search-replace"
import { MultiFileSearchReplaceDiffStrategy } from "../diff/strategies/multi-file-search-replace"

import { ClineProvider } from "./ClineProvider"

export const generateSystemPrompt = async (provider: ClineProvider, message: WebviewMessage) => {
	const providerState = await provider.getState()
	const {
		apiConfiguration,
		customModePrompts,
		customInstructions,
		browserViewportSize,
		diffEnabled,
		mcpEnabled,
		fuzzyMatchThreshold,
		experiments,
		enableMcpServerCreation,
		browserToolEnabled,
		language,
		maxReadFileLine,
		maxConcurrentFileReads,
		anhPersonaMode,
		anhToneStrict,
		anhUseAskTool,
		userAvatarRole,
		enableUserAvatar,
		enabledWorldsets,
		userAvatarVisibility,
		userAvatarHideFullData,
		enableInjectSystemPromptVariables,
		useRefactoredSystemPrompt,
	} = providerState

	// Check experiment to determine which diff strategy to use
	const isMultiFileApplyDiffEnabled = experimentsModule.isEnabled(
		experiments ?? {},
		EXPERIMENT_IDS.MULTI_FILE_APPLY_DIFF,
	)

	const diffStrategy = isMultiFileApplyDiffEnabled
		? new MultiFileSearchReplaceDiffStrategy(fuzzyMatchThreshold)
		: new MultiSearchReplaceDiffStrategy(fuzzyMatchThreshold)

	const cwd = provider.cwd

	const mode = message.mode ?? defaultModeSlug
	const customModes = await provider.customModesManager.getCustomModes()

	const rooIgnoreInstructions = provider.getCurrentTask()?.rooIgnoreController?.getInstructions()

	// Determine if browser tools can be used based on model support, mode, and user settings
	let modelSupportsComputerUse = false

	// Create a temporary API handler to check if the model supports computer use
	// This avoids relying on an active Cline instance which might not exist during preview
	try {
		const customUserAgent = provider.contextProxy.getGlobalState("customUserAgent")
		const customUserAgentMode = provider.contextProxy.getGlobalState("customUserAgentMode")
		const customUserAgentFull = provider.contextProxy.getGlobalState("customUserAgentFull")
		const tempApiHandler = buildApiHandler(apiConfiguration, customUserAgent, customUserAgentMode, customUserAgentFull)
		modelSupportsComputerUse = tempApiHandler.getModel().info.supportsComputerUse ?? false
	} catch (error) {
		console.error("Error checking if model supports computer use:", error)
	}

	// Check if the current mode includes the browser tool group
	const modeConfig = getModeBySlug(mode, customModes)
	const modeSupportsBrowser = modeConfig?.groups.some((group) => getGroupName(group) === "browser") ?? false

	// Only enable browser tools if the model supports it, the mode includes browser tools,
	// and browser tools are enabled in settings
	const canUseBrowserTool = modelSupportsComputerUse && modeSupportsBrowser && (browserToolEnabled ?? true)

	const rolePromptData = await provider.getRolePromptData()

	// Get WorldBook content if available
	let worldBookContent = ""
	if (provider.anhChatServices?.worldBookService) {
		try {
			worldBookContent = await provider.anhChatServices.worldBookService.getActiveWorldBooksMarkdown()
			debugLog("generateSystemPrompt - WorldBook content loaded:", {
				contentLength: worldBookContent.length,
				hasContent: worldBookContent.length > 0,
			})
		} catch (error) {
			debugError("generateSystemPrompt - Error loading WorldBook content:", error)
		}
	}

	// Get triggered WorldBook content if available
	let triggeredWorldBookContent = ""
	if (provider.anhChatServices?.worldBookTriggerService) {
		try {
			// For now, we'll get the constant content. In a real implementation,
			// this would be called with actual message content and conversation history
			triggeredWorldBookContent = await provider.anhChatServices.worldBookTriggerService.getConstantContent()
			debugLog("generateSystemPrompt - Triggered WorldBook content loaded:", {
				contentLength: triggeredWorldBookContent.length,
				hasContent: triggeredWorldBookContent.length > 0,
			})
		} catch (error) {
			debugError("generateSystemPrompt - Error loading triggered WorldBook content:", error)
		}
	}

	const worldBookSegments: string[] = []
	if (worldBookContent) {
		worldBookSegments.push(worldBookContent)
	}
	if (triggeredWorldBookContent) {
		worldBookSegments.push(triggeredWorldBookContent)
	}

	const activeTask = provider.getCurrentTask()
	const taskWorldBookTrigger = activeTask?.getWorldBookTriggerResult()
	if (taskWorldBookTrigger?.fullContent) {
		worldBookSegments.push(taskWorldBookTrigger.fullContent)
	}

	const taskMemoryTrigger = activeTask?.getMemoryTriggerResult()

	if (worldBookSegments.length > 0) {
		const seen = new Set<string>()
		const uniqueSegments: string[] = []

		for (const segment of worldBookSegments) {
			const key = segment.trim()
			if (!key || seen.has(key)) {
				continue
			}
			seen.add(key)
			uniqueSegments.push(segment)
		}

		worldBookContent = uniqueSegments.join("\n\n---\n\n")
	}

	// Debug: Check if TSProfile data is present
	debugLog("generateSystemPrompt - rolePromptData:", {
		roleName: rolePromptData?.role?.name,
		hasSystemPrompt: !!rolePromptData?.role?.system_prompt,
		hasExtensions: !!rolePromptData?.role?.extensions,
		extensionsKeys: rolePromptData?.role?.extensions ? Object.keys(rolePromptData.role.extensions) : [],
		enabledTSProfiles: (await provider.getState()).enabledTSProfiles,
		worldBookContentLength: worldBookContent.length,
	})

	// Get current task's todo list and model ID
	const currentTask = provider.getCurrentTask()
	const todoList = currentTask?.todoList
	const modelId = currentTask?.api?.getModel().id

	// Get user avatar role if enabled - align with Task.getSystemPrompt() implementation
	debugLog("generateSystemPrompt - enableUserAvatar:", enableUserAvatar, "userAvatarRole:", userAvatarRole)

	const resolvedUserAvatarVisibility =
		userAvatarVisibility === "full" ||
		userAvatarVisibility === "summary" ||
		userAvatarVisibility === "name" ||
		userAvatarVisibility === "hidden"
			? userAvatarVisibility
			: userAvatarHideFullData
				? "summary"
				: "full"

	const systemPromptSettings = {
		maxConcurrentFileReads: maxConcurrentFileReads ?? 5,
		todoListEnabled: apiConfiguration?.todoListEnabled ?? true,
		useAgentRules: vscode.workspace.getConfiguration("anh-cline").get<boolean>("useAgentRules") ?? true,
		newTaskRequireTodos: vscode.workspace.getConfiguration("anh-cline").get<boolean>("newTaskRequireTodos", false),
		memoryToolsEnabled: providerState.memoryToolsEnabled,
		memorySystemEnabled: providerState.memorySystemEnabled,
	}
	const providerStateSnapshot = providerState as unknown as Record<string, unknown>

	const extensionTools = provider.getAnhExtensionToolsForMode(mode ?? defaultModeSlug)
	const extensionToolDescriptions = extensionTools.map((tool) => tool.prompt)

	// Get TSProfile settings from provider state
	const { enabledTSProfiles = [], anhTsProfileAutoInject = true, anhTsProfileVariables = {} } = providerState

	// 添加调试日志
	debugLog("generateSystemPrompt - System prompt generator selection:", {
		useRefactoredSystemPrompt: useRefactoredSystemPrompt ?? false,
		generator: useRefactoredSystemPrompt ? "REFACTORED" : "LEGACY",
		mode: mode,
		customInstructions: !!customInstructions,
		rolePromptData: !!rolePromptData,
		enableInjectSystemPromptVariables: enableInjectSystemPromptVariables ?? false
	})

	// 根据设置选择使用哪个系统提示词生成器
	debugLog("generateSystemPrompt - Using", useRefactoredSystemPrompt ? "REFACTORED" : "LEGACY", "system prompt generator")

	const systemPrompt = await (useRefactoredSystemPrompt ? REFACTORED_SYSTEM_PROMPT : LEGACY_SYSTEM_PROMPT)(
		provider.context,
		cwd,
		canUseBrowserTool,
		mcpEnabled ? provider.getMcpHub() : undefined,
		diffStrategy,
		browserViewportSize ?? "900x600",
		mode,
		customModePrompts,
		customModes,
		customInstructions,
		diffEnabled,
		experiments,
		enableMcpServerCreation,
		language,
		rooIgnoreInstructions,
		maxReadFileLine !== -1,
		systemPromptSettings,
		todoList, // 修复：传递实际的 todoList
		modelId, // 修复：传递实际的 modelId
		rolePromptData, // 修复：传递正确的角色数据
		anhPersonaMode,
		anhToneStrict,
		anhUseAskTool,
		userAvatarRole, // 直接传递 userAvatarRole，与 Task.getSystemPrompt() 保持一致
		enableUserAvatar, // 直接传递 enableUserAvatar
		enabledWorldsets, // 传递启用的世界观设定
		resolvedUserAvatarVisibility,
		extensionToolDescriptions,
		worldBookContent, // 传递世界书内容
		taskMemoryTrigger,
		// Pass TSProfile parameters
		enabledTSProfiles,
		anhTsProfileAutoInject,
		anhTsProfileVariables,
		// Pass variable state injection parameters
		enableInjectSystemPromptVariables,
		currentTask,
	)

	// 添加生成器完成后的日志
	debugLog("generateSystemPrompt - System prompt generation completed:", {
		generator: useRefactoredSystemPrompt ? "REFACTORED" : "LEGACY",
		systemPromptLength: systemPrompt.length,
		hasCustomInstructions: !!customInstructions,
		hasRolePromptData: !!rolePromptData
	})

	const finalPrompt = await provider.applySystemPromptExtensions(systemPrompt, {
		cwd,
		mode,
		providerState: providerStateSnapshot,
		taskId: currentTask?.taskId,
		canUseBrowserTool,
		browserViewportSize: browserViewportSize ?? "900x600",
		todoList,
		modelId,
		rolePromptData,
		personaMode: anhPersonaMode,
		toneStrict: anhToneStrict,
		useAskTool: anhUseAskTool,
		userAvatarRole,
		enableUserAvatar: enableUserAvatar ?? false,
		enabledWorldsets,
		userAvatarVisibility: resolvedUserAvatarVisibility,
		customModePrompts,
		customModes,
		customInstructions,
		diffEnabled,
		experiments,
		enableMcpServerCreation,
		language,
		rooIgnoreInstructions,
		partialReadsEnabled: maxReadFileLine !== -1,
		settings: systemPromptSettings,
	})

	return finalPrompt
}
