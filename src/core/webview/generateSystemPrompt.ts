import * as vscode from "vscode"
import { WebviewMessage } from "../../shared/WebviewMessage"
import { defaultModeSlug, getModeBySlug, getGroupName } from "../../shared/modes"
import { buildApiHandler } from "../../api"
import { experiments as experimentsModule, EXPERIMENT_IDS } from "../../shared/experiments"

import { SYSTEM_PROMPT } from "../prompts/system"
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
		const tempApiHandler = buildApiHandler(apiConfiguration)
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

	// Get current task's todo list and model ID
	const currentTask = provider.getCurrentTask()
	const todoList = currentTask?.todoList
	const modelId = currentTask?.api?.getModel().id

	// Get user avatar role if enabled - align with Task.getSystemPrompt() implementation
	console.log('[DEBUG] generateSystemPrompt - enableUserAvatar:', enableUserAvatar, 'userAvatarRole:', userAvatarRole)
	
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
		newTaskRequireTodos: vscode.workspace
			.getConfiguration("anh-cline")
			.get<boolean>("newTaskRequireTodos", false),
	}
	const providerStateSnapshot = providerState as unknown as Record<string, unknown>

	const systemPrompt = await SYSTEM_PROMPT(
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
	)

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
