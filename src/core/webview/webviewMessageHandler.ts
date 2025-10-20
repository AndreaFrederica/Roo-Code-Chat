import { safeWriteJson } from "../../utils/safeWriteJson"
import * as path from "path"
import * as os from "os"
import * as fs from "fs/promises"
import pWaitFor from "p-wait-for"
import * as vscode from "vscode"

import {
	type Language,
	type GlobalState,
	type ClineMessage,
	type TelemetrySetting,
	type Role,
	type WorkspaceContextSettingKey,
	TelemetryEventName,
	UserSettingsConfig,
	DEFAULT_ASSISTANT_ROLE,
	DEFAULT_ASSISTANT_ROLE_UUID,
} from "@roo-code/types"
import { STProfileProcessor } from "@roo-code/types"
import { CloudService } from "@roo-code/cloud"
import { TelemetryService } from "@roo-code/telemetry"

import { type ApiMessage } from "../task-persistence/apiMessages"
import { saveTaskMessages } from "../task-persistence"

import { ClineProvider } from "./ClineProvider"
import { handleCheckpointRestoreOperation } from "./checkpointRestoreHandler"
import { changeLanguage, t } from "../../i18n"
import { Package } from "../../shared/package"
import { type RouterName, type ModelRecord, toRouterName } from "../../shared/api"
import { MessageEnhancer } from "./messageEnhancer"

import {
	type WebviewMessage,
	type EditQueuedMessagePayload,
	checkoutDiffPayloadSchema,
	checkoutRestorePayloadSchema,
} from "../../shared/WebviewMessage"
import { checkExistKey } from "../../shared/checkExistApiConfig"
import { experimentDefault } from "../../shared/experiments"
import { Terminal } from "../../integrations/terminal/Terminal"
import { openFile } from "../../integrations/misc/open-file"
import { openImage, saveImage } from "../../integrations/misc/image-handler"
import { selectImages } from "../../integrations/misc/process-images"
import { getTheme } from "../../integrations/theme/getTheme"
import { discoverChromeHostUrl, tryChromeHostUrl } from "../../services/browser/browserDiscovery"
import { searchWorkspaceFiles } from "../../services/search/file-search"
import { fileExistsAtPath } from "../../utils/fs"
import { playTts, setTtsEnabled, setTtsSpeed, stopTts } from "../../utils/tts"
import { searchCommits } from "../../utils/git"
import { exportSettings, importSettingsWithFeedback } from "../config/importExport"
import type { WorldBookConfig } from "../../services/silly-tavern/sillyTavernWorldBookService"
import { getOpenAiModels } from "../../api/providers/openai"
import { getVsCodeLmModels } from "../../api/providers/vscode-lm"
import { openMention } from "../mentions"
import { getWorkspacePath } from "../../utils/path"
import { Mode, defaultModeSlug } from "../../shared/modes"
import { getModels, flushModels } from "../../api/providers/fetchers/modelCache"
import { GetModelsOptions } from "../../shared/api"
import { generateSystemPrompt } from "./generateSystemPrompt"
import { getCommand } from "../../utils/commands"
import { loadTsProfiles, validateTsProfile, browseTsProfile } from "../../services/anh-chat/tsProfileService"
import { getExtendedTSProfileService } from "../../services/anh-chat/ExtendedTSProfileService"
import { getExtendedWorldBookService } from "../../services/silly-tavern/ExtendedWorldBookService"
import { getGlobalStorageService } from "../../services/storage/GlobalStorageService"

const ALLOWED_VSCODE_SETTINGS = new Set(["terminal.integrated.inheritEnv"])

import { MarketplaceManager, MarketplaceItemType } from "../../services/marketplace"
import { setPendingTodoList } from "../tools/updateTodoListTool"
import { MemoryManagementHandler } from "../../services/role-memory/MemoryManagementHandler"

/**
 * Load profile mixin data for a given profile name
 */
async function loadProfileMixin(provider: ClineProvider, profileName: string): Promise<void> {
	try {
		const extendedTSProfileService = await getExtendedTSProfileService(provider.context)
		const profiles = await extendedTSProfileService.loadAllTsProfiles()

		// Find the profile by name
		const profile = profiles.find(p => p.name === profileName)
		if (!profile) {
			provider.log(`[TSProfile] Profile not found: ${profileName}`)
			return
		}

		// Construct mixin path
		const mixinPath = profile.path.replace(/\.jsonc?$/, '.mixin.json')

		let mixinData = null
		if (await fileExistsAtPath(mixinPath)) {
			const mixinContent = await fs.readFile(mixinPath, "utf-8")
			mixinData = JSON.parse(mixinContent)
			provider.log(`[TSProfile] Loaded mixin for ${profileName}: ${mixinPath}`)
		} else {
			provider.log(`[TSProfile] No mixin found for ${profileName}`)
		}

		// Note: currentTsProfile state will be updated by the webview
		// We just send the mixin data to the webview to handle the state update

		// Send mixin data to webview
		await provider.postMessageToWebview({
			type: "tsProfileMixinLoaded",
			mixinData,
			mixinPath,
		})
	} catch (error) {
		provider.log(`[TSProfile] Error loading profile mixin: ${error}`)
		await provider.postMessageToWebview({
			type: "tsProfileMixinLoaded",
			error: error instanceof Error ? error.message : String(error),
		})
	}
}

export const webviewMessageHandler = async (
	provider: ClineProvider,
	message: WebviewMessage,
	marketplaceManager?: MarketplaceManager,
) => {
	// Utility functions provided for concise get/update of global state via contextProxy API.
	const getGlobalState = <K extends keyof GlobalState>(key: K) => provider.contextProxy.getValue(key)
	const updateGlobalState = async <K extends keyof GlobalState>(key: K, value: GlobalState[K]) =>
		await provider.contextProxy.setValue(key, value)

	const getCurrentCwd = () => {
		return provider.getCurrentTask()?.cwd || provider.cwd
	}

	const ensureScopedWorldsetKeys = async (): Promise<string[]> => {
		const rawWorldsets = getGlobalState("enabledWorldsets")

		if (!Array.isArray(rawWorldsets) || rawWorldsets.length === 0) {
			return []
		}

		let changed = false
		const normalized = new Set<string>()

		const workspacePath = getWorkspacePath()
		const workspaceWorldsetDir = workspacePath
			? path.join(workspacePath, "novel-helper", ".anh-chat", "worldset")
			: undefined

		let globalWorldsetDir: string | undefined
		let globalStorageService: Awaited<ReturnType<typeof getGlobalStorageService>> | undefined

		for (const entry of rawWorldsets) {
			if (typeof entry !== "string") {
				changed = true
				continue
			}

			const trimmed = entry.trim()
			if (!trimmed) {
				changed = true
				continue
			}

			const lastDashIndex = trimmed.lastIndexOf("-")
			if (lastDashIndex > 0) {
				const suffix = trimmed.substring(lastDashIndex + 1)
				if (suffix === "global" || suffix === "workspace") {
					normalized.add(trimmed)
					continue
				}
			}

			changed = true
			const fileName = trimmed
			let scope: "global" | "workspace" = "workspace"

			try {
				const workspaceCandidate =
					workspaceWorldsetDir !== undefined ? path.join(workspaceWorldsetDir, fileName) : undefined
				const existsInWorkspace =
					workspaceCandidate !== undefined ? await fileExistsAtPath(workspaceCandidate) : false

				if (!existsInWorkspace) {
					if (!globalWorldsetDir) {
						try {
							globalStorageService = globalStorageService ?? (await getGlobalStorageService(provider.context))
							globalWorldsetDir = globalStorageService.getGlobalWorldsetsPath()
						} catch (error) {
							provider.log(
								`[Worldset] Failed to resolve global worldset directory: ${
									error instanceof Error ? error.message : String(error)
								}`,
							)
						}
					}

					if (globalWorldsetDir) {
						const globalCandidate = path.join(globalWorldsetDir, fileName)
						if (await fileExistsAtPath(globalCandidate)) {
							scope = "global"
						}
					}
				}
			} catch (error) {
				provider.log(
					`[Worldset] Failed to normalize legacy worldset key ${fileName}: ${
						error instanceof Error ? error.message : String(error)
					}`,
				)
			}

			normalized.add(`${fileName}-${scope}`)
		}

		const normalizedList = Array.from(normalized)

		if (changed) {
			try {
				await updateGlobalState("enabledWorldsets", normalizedList)
			} catch (error) {
				provider.log(
					`[Worldset] Failed to persist normalized worldset keys: ${
						error instanceof Error ? error.message : String(error)
					}`,
				)
			}
		}

		return normalizedList
	}
	/**
	 * Shared utility to find message indices based on timestamp
	 */
	const findMessageIndices = (messageTs: number, currentCline: any) => {
		// Find the exact message by timestamp, not the first one after a cutoff
		const messageIndex = currentCline.clineMessages.findIndex((msg: ClineMessage) => msg.ts === messageTs)
		const apiConversationHistoryIndex = currentCline.apiConversationHistory.findIndex(
			(msg: ApiMessage) => msg.ts === messageTs,
		)
		return { messageIndex, apiConversationHistoryIndex }
	}

	/**
	 * Fallback: find first API history index at or after a timestamp.
	 * Used when the exact user message isn't present in apiConversationHistory (e.g., after condense).
	 */
	const findFirstApiIndexAtOrAfter = (ts: number, currentCline: any) => {
		if (typeof ts !== "number") return -1
		return currentCline.apiConversationHistory.findIndex(
			(msg: ApiMessage) => typeof msg?.ts === "number" && (msg.ts as number) >= ts,
		)
	}

	/**
	 * Removes the target message and all subsequent messages
	 */
	const removeMessagesThisAndSubsequent = async (
		currentCline: any,
		messageIndex: number,
		apiConversationHistoryIndex: number,
	) => {
		// Delete this message and all that follow
		await currentCline.overwriteClineMessages(currentCline.clineMessages.slice(0, messageIndex))

		if (apiConversationHistoryIndex !== -1) {
			await currentCline.overwriteApiConversationHistory(
				currentCline.apiConversationHistory.slice(0, apiConversationHistoryIndex),
			)
		}
	}

	/**
	 * Handles message deletion operations with user confirmation
	 */
	const handleDeleteOperation = async (messageTs: number): Promise<void> => {
		// Check if there's a checkpoint before this message
		const currentCline = provider.getCurrentTask()
		let hasCheckpoint = false

		if (!currentCline) {
			await vscode.window.showErrorMessage(t("common:errors.message.no_active_task_to_delete"))
			return
		}

		const { messageIndex } = findMessageIndices(messageTs, currentCline)

		if (messageIndex !== -1) {
			// Find the last checkpoint before this message
			const checkpoints = currentCline.clineMessages.filter(
				(msg) => msg.say === "checkpoint_saved" && msg.ts > messageTs,
			)
			hasCheckpoint = checkpoints.length > 0
		}

		// Send message to webview to show delete confirmation dialog
		await provider.postMessageToWebview({
			type: "showDeleteMessageDialog",
			messageTs,
			hasCheckpoint,
		})
	}

	/**
	 * Handles confirmed message deletion from webview dialog
	 */
	const handleDeleteMessageConfirm = async (messageTs: number, restoreCheckpoint?: boolean): Promise<void> => {
		const currentCline = provider.getCurrentTask()
		if (!currentCline) {
			console.error("[handleDeleteMessageConfirm] No current cline available")
			return
		}

		const { messageIndex, apiConversationHistoryIndex } = findMessageIndices(messageTs, currentCline)
		// Determine API truncation index with timestamp fallback if exact match not found
		let apiIndexToUse = apiConversationHistoryIndex
		const tsThreshold = currentCline.clineMessages[messageIndex]?.ts
		if (apiIndexToUse === -1 && typeof tsThreshold === "number") {
			apiIndexToUse = findFirstApiIndexAtOrAfter(tsThreshold, currentCline)
		}

		if (messageIndex === -1) {
			await vscode.window.showErrorMessage(t("common:errors.message.message_not_found", { messageTs }))
			return
		}

		try {
			const targetMessage = currentCline.clineMessages[messageIndex]

			// If checkpoint restoration is requested, find and restore to the last checkpoint before this message
			if (restoreCheckpoint) {
				// Find the last checkpoint before this message
				const checkpoints = currentCline.clineMessages.filter(
					(msg) => msg.say === "checkpoint_saved" && msg.ts > messageTs,
				)

				const nextCheckpoint = checkpoints[0]

				if (nextCheckpoint && nextCheckpoint.text) {
					await handleCheckpointRestoreOperation({
						provider,
						currentCline,
						messageTs: targetMessage.ts!,
						messageIndex,
						checkpoint: { hash: nextCheckpoint.text },
						operation: "delete",
					})
				} else {
					// No checkpoint found before this message
					console.log("[handleDeleteMessageConfirm] No checkpoint found before message")
					vscode.window.showWarningMessage("No checkpoint found before this message")
				}
			} else {
				// For non-checkpoint deletes, preserve checkpoint associations for remaining messages
				// Store checkpoints from messages that will be preserved
				const preservedCheckpoints = new Map<number, any>()
				for (let i = 0; i < messageIndex; i++) {
					const msg = currentCline.clineMessages[i]
					if (msg?.checkpoint && msg.ts) {
						preservedCheckpoints.set(msg.ts, msg.checkpoint)
					}
				}

				// Delete this message and all subsequent messages
				await removeMessagesThisAndSubsequent(currentCline, messageIndex, apiIndexToUse)

				// Restore checkpoint associations for preserved messages
				for (const [ts, checkpoint] of preservedCheckpoints) {
					const msgIndex = currentCline.clineMessages.findIndex((msg) => msg.ts === ts)
					if (msgIndex !== -1) {
						currentCline.clineMessages[msgIndex].checkpoint = checkpoint
					}
				}

				// Save the updated messages with restored checkpoints
				await saveTaskMessages({
					messages: currentCline.clineMessages,
					taskId: currentCline.taskId,
					globalStoragePath: provider.contextProxy.globalStorageUri.fsPath,
				})

				// Update the UI to reflect the deletion
				await provider.postStateToWebview()
			}
		} catch (error) {
			console.error("Error in delete message:", error)
			vscode.window.showErrorMessage(
				t("common:errors.message.error_deleting_message", {
					error: error instanceof Error ? error.message : String(error),
				}),
			)
		}
	}

	/**
	 * Handles message editing operations with user confirmation
	 */
	const handleEditOperation = async (messageTs: number, editedContent: string, images?: string[]): Promise<void> => {
		// Check if there's a checkpoint before this message
		const currentCline = provider.getCurrentTask()
		let hasCheckpoint = false
		if (currentCline) {
			const { messageIndex } = findMessageIndices(messageTs, currentCline)
			if (messageIndex !== -1) {
				// Find the last checkpoint before this message
				const checkpoints = currentCline.clineMessages.filter(
					(msg) => msg.say === "checkpoint_saved" && msg.ts > messageTs,
				)

				hasCheckpoint = checkpoints.length > 0
			} else {
				console.log("[webviewMessageHandler] Edit - Message not found in clineMessages!")
			}
		} else {
			console.log("[webviewMessageHandler] Edit - No currentCline available!")
		}

		// Send message to webview to show edit confirmation dialog
		await provider.postMessageToWebview({
			type: "showEditMessageDialog",
			messageTs,
			text: editedContent,
			hasCheckpoint,
			images,
		})
	}

	/**
	 * Handles confirmed message editing from webview dialog
	 */
	const handleEditMessageConfirm = async (
		messageTs: number,
		editedContent: string,
		restoreCheckpoint?: boolean,
		images?: string[],
	): Promise<void> => {
		const currentCline = provider.getCurrentTask()
		if (!currentCline) {
			console.error("[handleEditMessageConfirm] No current cline available")
			return
		}

		// Use findMessageIndices to find messages based on timestamp
		const { messageIndex, apiConversationHistoryIndex } = findMessageIndices(messageTs, currentCline)

		if (messageIndex === -1) {
			const errorMessage = t("common:errors.message.message_not_found", { messageTs })
			console.error("[handleEditMessageConfirm]", errorMessage)
			await vscode.window.showErrorMessage(errorMessage)
			return
		}

		try {
			const targetMessage = currentCline.clineMessages[messageIndex]

			// If checkpoint restoration is requested, find and restore to the last checkpoint before this message
			if (restoreCheckpoint) {
				// Find the last checkpoint before this message
				const checkpoints = currentCline.clineMessages.filter(
					(msg) => msg.say === "checkpoint_saved" && msg.ts > messageTs,
				)

				const nextCheckpoint = checkpoints[0]

				if (nextCheckpoint && nextCheckpoint.text) {
					await handleCheckpointRestoreOperation({
						provider,
						currentCline,
						messageTs: targetMessage.ts!,
						messageIndex,
						checkpoint: { hash: nextCheckpoint.text },
						operation: "edit",
						editData: {
							editedContent,
							images,
							apiConversationHistoryIndex,
						},
					})
					// The task will be cancelled and reinitialized by checkpointRestore
					// The pending edit will be processed in the reinitialized task
					return
				} else {
					// No checkpoint found before this message
					console.log("[handleEditMessageConfirm] No checkpoint found before message")
					vscode.window.showWarningMessage("No checkpoint found before this message")
					// Continue with non-checkpoint edit
				}
			}

			// For non-checkpoint edits, remove the ORIGINAL user message being edited and all subsequent messages
			// Determine the correct starting index to delete from (prefer the last preceding user_feedback message)
			let deleteFromMessageIndex = messageIndex
			let deleteFromApiIndex = apiConversationHistoryIndex

			// Find the nearest preceding user message to ensure we replace the original, not just the assistant reply
			for (let i = messageIndex; i >= 0; i--) {
				const m = currentCline.clineMessages[i]
				if (m?.say === "user_feedback") {
					deleteFromMessageIndex = i
					// Align API history truncation to the same user message timestamp if present
					const userTs = m.ts
					if (typeof userTs === "number") {
						const apiIdx = currentCline.apiConversationHistory.findIndex(
							(am: ApiMessage) => am.ts === userTs,
						)
						if (apiIdx !== -1) {
							deleteFromApiIndex = apiIdx
						}
					}
					break
				}
			}

			// Timestamp fallback for API history when exact user message isn't present
			if (deleteFromApiIndex === -1) {
				const tsThresholdForEdit = currentCline.clineMessages[deleteFromMessageIndex]?.ts
				if (typeof tsThresholdForEdit === "number") {
					deleteFromApiIndex = findFirstApiIndexAtOrAfter(tsThresholdForEdit, currentCline)
				}
			}

			// Store checkpoints from messages that will be preserved
			const preservedCheckpoints = new Map<number, any>()
			for (let i = 0; i < deleteFromMessageIndex; i++) {
				const msg = currentCline.clineMessages[i]
				if (msg?.checkpoint && msg.ts) {
					preservedCheckpoints.set(msg.ts, msg.checkpoint)
				}
			}

			// Delete the original (user) message and all subsequent messages
			await removeMessagesThisAndSubsequent(currentCline, deleteFromMessageIndex, deleteFromApiIndex)

			// Restore checkpoint associations for preserved messages
			for (const [ts, checkpoint] of preservedCheckpoints) {
				const msgIndex = currentCline.clineMessages.findIndex((msg) => msg.ts === ts)
				if (msgIndex !== -1) {
					currentCline.clineMessages[msgIndex].checkpoint = checkpoint
				}
			}

			// Save the updated messages with restored checkpoints
			await saveTaskMessages({
				messages: currentCline.clineMessages,
				taskId: currentCline.taskId,
				globalStoragePath: provider.contextProxy.globalStorageUri.fsPath,
			})

			// Update the UI to reflect the deletion
			await provider.postStateToWebview()

			await currentCline.submitUserMessage(editedContent, images)
		} catch (error) {
			console.error("Error in edit message:", error)
			vscode.window.showErrorMessage(
				t("common:errors.message.error_editing_message", {
					error: error instanceof Error ? error.message : String(error),
				}),
			)
		}
	}

	/**
	 * Handles message modification operations (delete or edit) with confirmation dialog
	 * @param messageTs Timestamp of the message to operate on
	 * @param operation Type of operation ('delete' or 'edit')
	 * @param editedContent New content for edit operations
	 * @returns Promise<void>
	 */
	const handleMessageModificationsOperation = async (
		messageTs: number,
		operation: "delete" | "edit",
		editedContent?: string,
		images?: string[],
	): Promise<void> => {
		if (operation === "delete") {
			await handleDeleteOperation(messageTs)
		} else if (operation === "edit" && editedContent) {
			await handleEditOperation(messageTs, editedContent, images)
		}
	}

	switch (message.type) {
		case "webviewDidLaunch":
			// Load custom modes first
			const customModes = await provider.customModesManager.getCustomModes()
			await updateGlobalState("customModes", customModes)

			provider.postStateToWebview()
			provider.workspaceTracker?.initializeFilePaths() // Don't await.

			getTheme().then((theme) => provider.postMessageToWebview({ type: "theme", text: JSON.stringify(theme) }))

			// If MCP Hub is already initialized, update the webview with
			// current server list.
			const mcpHub = provider.getMcpHub()

			if (mcpHub) {
				provider.postMessageToWebview({ type: "mcpServers", mcpServers: mcpHub.getAllServers() })
			}

			provider.providerSettingsManager
				.listConfig()
				.then(async (listApiConfig) => {
					if (!listApiConfig) {
						return
					}

					if (listApiConfig.length === 1) {
						// Check if first time init then sync with exist config.
						if (!checkExistKey(listApiConfig[0])) {
							const { apiConfiguration } = await provider.getState()

							await provider.providerSettingsManager.saveConfig(
								listApiConfig[0].name ?? "default",
								apiConfiguration,
							)

							listApiConfig[0].apiProvider = apiConfiguration.apiProvider
						}
					}

					const currentConfigName = getGlobalState("currentApiConfigName")

					if (currentConfigName) {
						if (!(await provider.providerSettingsManager.hasConfig(currentConfigName))) {
							// Current config name not valid, get first config in list.
							const name = listApiConfig[0]?.name
							await updateGlobalState("currentApiConfigName", name)

							if (name) {
								await provider.activateProviderProfile({ name })
								return
							}
						}
					}

					await Promise.all([
						await updateGlobalState("listApiConfigMeta", listApiConfig),
						await provider.postMessageToWebview({ type: "listApiConfig", listApiConfig }),
					])
				})
				.catch((error) =>
					provider.log(
						`Error list api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
					),
				)

			// Enable telemetry by default (when unset) or when explicitly enabled
			provider.getStateToPostToWebview().then((state) => {
				const { telemetrySetting } = state
				const isOptedIn = telemetrySetting !== "disabled"
				TelemetryService.instance.updateTelemetryState(isOptedIn)
			})

			provider.isViewLaunched = true
			break
		case "newTask":
			// Initializing new instance of Cline will make sure that any
			// agentically running promises in old instance don't affect our new
			// task. This essentially creates a fresh slate for the new task.
			try {
				await provider.createTask(message.text, message.images)
				// Task created successfully - notify the UI to reset
				await provider.postMessageToWebview({
					type: "invoke",
					invoke: "newChat",
				})
			} catch (error) {
				// For all errors, reset the UI and show error
				await provider.postMessageToWebview({
					type: "invoke",
					invoke: "newChat",
				})
				// Show error to user
				vscode.window.showErrorMessage(
					`Failed to create task: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
			break
		case "customInstructions":
			await provider.updateCustomInstructions(message.text)
			break
		case "alwaysAllowReadOnly":
			await updateGlobalState("alwaysAllowReadOnly", message.bool ?? undefined)
			await provider.postStateToWebview()
			break
		case "alwaysAllowReadOnlyOutsideWorkspace":
			await updateGlobalState("alwaysAllowReadOnlyOutsideWorkspace", message.bool ?? undefined)
			await provider.postStateToWebview()
			break
		case "alwaysAllowWrite":
			await updateGlobalState("alwaysAllowWrite", message.bool ?? undefined)
			await provider.postStateToWebview()
			break
		case "alwaysAllowWriteOutsideWorkspace":
			await updateGlobalState("alwaysAllowWriteOutsideWorkspace", message.bool ?? undefined)
			await provider.postStateToWebview()
			break
		case "alwaysAllowWriteProtected":
			await updateGlobalState("alwaysAllowWriteProtected", message.bool ?? undefined)
			await provider.postStateToWebview()
			break
		case "alwaysAllowExecute":
			await updateGlobalState("alwaysAllowExecute", message.bool ?? undefined)
			await provider.postStateToWebview()
			break
		case "alwaysAllowBrowser":
			await updateGlobalState("alwaysAllowBrowser", message.bool ?? undefined)
			await provider.postStateToWebview()
			break
		case "alwaysAllowMcp":
			await updateGlobalState("alwaysAllowMcp", message.bool)
			await provider.postStateToWebview()
			break
		case "alwaysAllowModeSwitch":
			await updateGlobalState("alwaysAllowModeSwitch", message.bool)
			await provider.postStateToWebview()
			break
		case "allowedMaxRequests":
			await updateGlobalState("allowedMaxRequests", message.value)
			await provider.postStateToWebview()
			break
		case "allowedMaxCost":
			await updateGlobalState("allowedMaxCost", message.value)
			await provider.postStateToWebview()
			break
		case "alwaysAllowSubtasks":
			await updateGlobalState("alwaysAllowSubtasks", message.bool)
			await provider.postStateToWebview()
			break
		case "alwaysAllowUpdateTodoList":
			await updateGlobalState("alwaysAllowUpdateTodoList", message.bool)
			await provider.postStateToWebview()
			break
		case "askResponse":
			provider.getCurrentTask()?.handleWebviewAskResponse(message.askResponse!, message.text, message.images)
			break
		case "autoCondenseContext":
			await updateGlobalState("autoCondenseContext", message.bool)
			await provider.postStateToWebview()
			break
		case "autoCondenseContextPercent":
			await updateGlobalState("autoCondenseContextPercent", message.value)
			await provider.postStateToWebview()
			break
		case "terminalOperation":
			if (message.terminalOperation) {
				provider.getCurrentTask()?.handleTerminalOperation(message.terminalOperation)
			}
			break
		case "clearTask":
			// Clear task resets the current session and allows for a new task
			// to be started, if this session is a subtask - it allows the
			// parent task to be resumed.
			// Check if the current task actually has a parent task.
			const currentTask = provider.getCurrentTask()

			if (currentTask && currentTask.parentTask) {
				await provider.finishSubTask(t("common:tasks.canceled"))
			} else {
				// Regular task - just clear it
				await provider.clearTask()
			}

			await provider.postStateToWebview()
			break
		case "didShowAnnouncement":
			await updateGlobalState("lastShownAnnouncementId", provider.latestAnnouncementId)
			await provider.postStateToWebview()
			break
		case "selectImages":
			const images = await selectImages()
			await provider.postMessageToWebview({
				type: "selectedImages",
				images,
				context: message.context,
				messageTs: message.messageTs,
			})
			break
		case "exportCurrentTask":
			const currentTaskId = provider.getCurrentTask()?.taskId
			if (currentTaskId) {
				provider.exportTaskWithId(currentTaskId)
			}
			break
		case "shareCurrentTask":
			const shareTaskId = provider.getCurrentTask()?.taskId
			const clineMessages = provider.getCurrentTask()?.clineMessages

			if (!shareTaskId) {
				vscode.window.showErrorMessage(t("common:errors.share_no_active_task"))
				break
			}

			try {
				const visibility = message.visibility || "organization"
				const result = await CloudService.instance.shareTask(shareTaskId, visibility, clineMessages)

				if (result.success && result.shareUrl) {
					// Show success notification
					const messageKey =
						visibility === "public"
							? "common:info.public_share_link_copied"
							: "common:info.organization_share_link_copied"
					vscode.window.showInformationMessage(t(messageKey))

					// Send success feedback to webview for inline display
					await provider.postMessageToWebview({
						type: "shareTaskSuccess",
						visibility,
						text: result.shareUrl,
					})
				} else {
					// Handle error
					const errorMessage = result.error || "Failed to create share link"
					if (errorMessage.includes("Authentication")) {
						vscode.window.showErrorMessage(t("common:errors.share_auth_required"))
					} else if (errorMessage.includes("sharing is not enabled")) {
						vscode.window.showErrorMessage(t("common:errors.share_not_enabled"))
					} else if (errorMessage.includes("not found")) {
						vscode.window.showErrorMessage(t("common:errors.share_task_not_found"))
					} else {
						vscode.window.showErrorMessage(errorMessage)
					}
				}
			} catch (error) {
				provider.log(`[shareCurrentTask] Unexpected error: ${error}`)
				vscode.window.showErrorMessage(t("common:errors.share_task_failed"))
			}
			break
		case "showTaskWithId":
			provider.showTaskWithId(message.text!)
			break
		case "condenseTaskContextRequest":
			provider.condenseTaskContext(message.text!)
			break
		case "deleteTaskWithId":
			provider.deleteTaskWithId(message.text!)
			break
		case "deleteMultipleTasksWithIds": {
			const ids = message.ids

			if (Array.isArray(ids)) {
				// Process in batches of 20 (or another reasonable number)
				const batchSize = 20
				const results = []

				// Only log start and end of the operation
				console.log(`Batch deletion started: ${ids.length} tasks total`)

				for (let i = 0; i < ids.length; i += batchSize) {
					const batch = ids.slice(i, i + batchSize)

					const batchPromises = batch.map(async (id) => {
						try {
							await provider.deleteTaskWithId(id)
							return { id, success: true }
						} catch (error) {
							// Keep error logging for debugging purposes
							console.log(
								`Failed to delete task ${id}: ${error instanceof Error ? error.message : String(error)}`,
							)
							return { id, success: false }
						}
					})

					// Process each batch in parallel but wait for completion before starting the next batch
					const batchResults = await Promise.all(batchPromises)
					results.push(...batchResults)

					// Update the UI after each batch to show progress
					await provider.postStateToWebview()
				}

				// Log final results
				const successCount = results.filter((r) => r.success).length
				const failCount = results.length - successCount
				console.log(
					`Batch deletion completed: ${successCount}/${ids.length} tasks successful, ${failCount} tasks failed`,
				)
			}
			break
		}
		case "exportTaskWithId":
			provider.exportTaskWithId(message.text!)
			break
		case "exportTaskBundleWithId":
			provider.exportTaskBundleWithId(message.text!)
			break
		case "importTaskBundle":
			await provider.importTaskBundle()
			break
		case "importSettings": {
			await importSettingsWithFeedback({
				providerSettingsManager: provider.providerSettingsManager,
				contextProxy: provider.contextProxy,
				customModesManager: provider.customModesManager,
				provider: provider,
			})

			break
		}
		case "exportSettings":
			await exportSettings({
				providerSettingsManager: provider.providerSettingsManager,
				contextProxy: provider.contextProxy,
			})

			break
		case "resetState":
			await provider.resetState()
			break
		case "flushRouterModels":
			const routerNameFlush: RouterName = toRouterName(message.text)
			await flushModels(routerNameFlush)
			break
		case "requestRouterModels":
			const { apiConfiguration } = await provider.getState()

			const routerModels: Record<RouterName, ModelRecord> = {
				openrouter: {},
				"vercel-ai-gateway": {},
				huggingface: {},
				litellm: {},
				deepinfra: {},
				"io-intelligence": {},
				requesty: {},
				unbound: {},
				glama: {},
				ollama: {},
				lmstudio: {},
				siliconflow: {},
				volcengine: {},
				dashscope: {},
			}

			const safeGetModels = async (options: GetModelsOptions): Promise<ModelRecord> => {
				try {
					return await getModels(options)
				} catch (error) {
					console.error(
						`Failed to fetch models in webviewMessageHandler requestRouterModels for ${options.provider}:`,
						error,
					)

					throw error // Re-throw to be caught by Promise.allSettled.
				}
			}

			const modelFetchPromises: { key: RouterName; options: GetModelsOptions }[] = [
				{ key: "openrouter", options: { provider: "openrouter" } },
				{
					key: "requesty",
					options: {
						provider: "requesty",
						apiKey: apiConfiguration.requestyApiKey,
						baseUrl: apiConfiguration.requestyBaseUrl,
					},
				},
				{ key: "glama", options: { provider: "glama" } },
				{ key: "unbound", options: { provider: "unbound", apiKey: apiConfiguration.unboundApiKey } },
				{ key: "vercel-ai-gateway", options: { provider: "vercel-ai-gateway" } },
				{
					key: "deepinfra",
					options: {
						provider: "deepinfra",
						apiKey: apiConfiguration.deepInfraApiKey,
						baseUrl: apiConfiguration.deepInfraBaseUrl,
					},
				},
			]

			// Add IO Intelligence if API key is provided.
			const ioIntelligenceApiKey = apiConfiguration.ioIntelligenceApiKey

			if (ioIntelligenceApiKey) {
				modelFetchPromises.push({
					key: "io-intelligence",
					options: { provider: "io-intelligence", apiKey: ioIntelligenceApiKey },
				})
			}

			// Don't fetch Ollama and LM Studio models by default anymore.
			// They have their own specific handlers: requestOllamaModels and requestLmStudioModels.

			const litellmApiKey = apiConfiguration.litellmApiKey || message?.values?.litellmApiKey
			const litellmBaseUrl = apiConfiguration.litellmBaseUrl || message?.values?.litellmBaseUrl

			if (litellmApiKey && litellmBaseUrl) {
				modelFetchPromises.push({
					key: "litellm",
					options: { provider: "litellm", apiKey: litellmApiKey, baseUrl: litellmBaseUrl },
				})
			}

			const results = await Promise.allSettled(
				modelFetchPromises.map(async ({ key, options }) => {
					const models = await safeGetModels(options)
					return { key, models } // The key is `ProviderName` here.
				}),
			)

			results.forEach((result, index) => {
				const routerName = modelFetchPromises[index].key

				if (result.status === "fulfilled") {
					routerModels[routerName] = result.value.models

					// Ollama and LM Studio settings pages still need these events.
					if (routerName === "ollama" && Object.keys(result.value.models).length > 0) {
						provider.postMessageToWebview({
							type: "ollamaModels",
							ollamaModels: result.value.models,
						})
					} else if (routerName === "lmstudio" && Object.keys(result.value.models).length > 0) {
						provider.postMessageToWebview({
							type: "lmStudioModels",
							lmStudioModels: result.value.models,
						})
					}
				} else {
					// Handle rejection: Post a specific error message for this provider.
					const errorMessage = result.reason instanceof Error ? result.reason.message : String(result.reason)
					console.error(`Error fetching models for ${routerName}:`, result.reason)

					routerModels[routerName] = {} // Ensure it's an empty object in the main routerModels message.

					provider.postMessageToWebview({
						type: "singleRouterModelFetchResponse",
						success: false,
						error: errorMessage,
						values: { provider: routerName },
					})
				}
			})

			provider.postMessageToWebview({ type: "routerModels", routerModels })
			break
		case "requestOllamaModels": {
			// Specific handler for Ollama models only.
			const { apiConfiguration: ollamaApiConfig } = await provider.getState()
			try {
				// Flush cache first to ensure fresh models.
				await flushModels("ollama")

				const ollamaModels = await getModels({
					provider: "ollama",
					baseUrl: ollamaApiConfig.ollamaBaseUrl,
					apiKey: ollamaApiConfig.ollamaApiKey,
				})

				if (Object.keys(ollamaModels).length > 0) {
					provider.postMessageToWebview({ type: "ollamaModels", ollamaModels: ollamaModels })
				}
			} catch (error) {
				// Silently fail - user hasn't configured Ollama yet
				console.debug("Ollama models fetch failed:", error)
			}
			break
		}
		case "requestLmStudioModels": {
			// Specific handler for LM Studio models only.
			const { apiConfiguration: lmStudioApiConfig } = await provider.getState()
			try {
				// Flush cache first to ensure fresh models.
				await flushModels("lmstudio")

				const lmStudioModels = await getModels({
					provider: "lmstudio",
					baseUrl: lmStudioApiConfig.lmStudioBaseUrl,
				})

				if (Object.keys(lmStudioModels).length > 0) {
					provider.postMessageToWebview({
						type: "lmStudioModels",
						lmStudioModels: lmStudioModels,
					})
				}
			} catch (error) {
				// Silently fail - user hasn't configured LM Studio yet.
				console.debug("LM Studio models fetch failed:", error)
			}
			break
		}
		case "requestOpenAiModels":
			if (message?.values?.baseUrl && message?.values?.apiKey) {
				const openAiModels = await getOpenAiModels(
					message?.values?.baseUrl,
					message?.values?.apiKey,
					message?.values?.openAiHeaders,
				)

				provider.postMessageToWebview({ type: "openAiModels", openAiModels })
			}

			break
		case "requestVsCodeLmModels":
			const vsCodeLmModels = await getVsCodeLmModels()
			// TODO: Cache like we do for OpenRouter, etc?
			provider.postMessageToWebview({ type: "vsCodeLmModels", vsCodeLmModels })
			break
		case "requestHuggingFaceModels":
			// TODO: Why isn't this handled by `requestRouterModels` above?
			try {
				const { getHuggingFaceModelsWithMetadata } = await import("../../api/providers/fetchers/huggingface")
				const huggingFaceModelsResponse = await getHuggingFaceModelsWithMetadata()

				provider.postMessageToWebview({
					type: "huggingFaceModels",
					huggingFaceModels: huggingFaceModelsResponse.models,
				})
			} catch (error) {
				console.error("Failed to fetch Hugging Face models:", error)
				provider.postMessageToWebview({ type: "huggingFaceModels", huggingFaceModels: [] })
			}
			break
		case "openImage":
			openImage(message.text!, { values: message.values })
			break
		case "saveImage":
			saveImage(message.dataUri!)
			break
		case "openFile":
			let filePath: string = message.text!
			if (!path.isAbsolute(filePath)) {
				filePath = path.join(getCurrentCwd(), filePath)
			}
			openFile(filePath, message.values as { create?: boolean; content?: string; line?: number })
			break
		case "openMention":
			openMention(getCurrentCwd(), message.text)
			break
		case "openExternal":
			if (message.url) {
				vscode.env.openExternal(vscode.Uri.parse(message.url))
			}
			break
		case "checkpointDiff":
			const result = checkoutDiffPayloadSchema.safeParse(message.payload)

			if (result.success) {
				await provider.getCurrentTask()?.checkpointDiff(result.data)
			}

			break
		case "checkpointRestore": {
			const result = checkoutRestorePayloadSchema.safeParse(message.payload)

			if (result.success) {
				await provider.cancelTask()

				try {
					await pWaitFor(() => provider.getCurrentTask()?.isInitialized === true, { timeout: 3_000 })
				} catch (error) {
					vscode.window.showErrorMessage(t("common:errors.checkpoint_timeout"))
				}

				try {
					await provider.getCurrentTask()?.checkpointRestore(result.data)
				} catch (error) {
					vscode.window.showErrorMessage(t("common:errors.checkpoint_failed"))
				}
			}

			break
		}
		case "cancelTask":
			await provider.cancelTask()
			break
		case "allowedCommands": {
			// Validate and sanitize the commands array
			const commands = message.commands ?? []
			const validCommands = Array.isArray(commands)
				? commands.filter((cmd) => typeof cmd === "string" && cmd.trim().length > 0)
				: []

			await updateGlobalState("allowedCommands", validCommands)

			// Also update workspace settings.
			await vscode.workspace
				.getConfiguration(Package.name)
				.update("allowedCommands", validCommands, vscode.ConfigurationTarget.Global)

			break
		}
		case "deniedCommands": {
			// Validate and sanitize the commands array
			const commands = message.commands ?? []
			const validCommands = Array.isArray(commands)
				? commands.filter((cmd) => typeof cmd === "string" && cmd.trim().length > 0)
				: []

			await updateGlobalState("deniedCommands", validCommands)

			// Also update workspace settings.
			await vscode.workspace
				.getConfiguration(Package.name)
				.update("deniedCommands", validCommands, vscode.ConfigurationTarget.Global)

			break
		}
		case "openCustomModesSettings": {
			const customModesFilePath = await provider.customModesManager.getCustomModesFilePath()

			if (customModesFilePath) {
				openFile(customModesFilePath)
			}

			break
		}
		case "openKeyboardShortcuts": {
			// Open VSCode keyboard shortcuts settings and optionally filter to show the ANH CHAT commands
			const searchQuery = message.text || ""
			if (searchQuery) {
				// Open with a search query pre-filled
				await vscode.commands.executeCommand("workbench.action.openGlobalKeybindings", searchQuery)
			} else {
				// Just open the keyboard shortcuts settings
				await vscode.commands.executeCommand("workbench.action.openGlobalKeybindings")
			}
			break
		}
		case "openMcpSettings": {
			const mcpSettingsFilePath = await provider.getMcpHub()?.getMcpSettingsFilePath()

			if (mcpSettingsFilePath) {
				openFile(mcpSettingsFilePath)
			}

			break
		}
		case "openProjectMcpSettings": {
			if (!vscode.workspace.workspaceFolders?.length) {
				vscode.window.showErrorMessage(t("common:errors.no_workspace"))
				return
			}

			const workspaceFolder = getCurrentCwd()
			const rooDir = path.join(workspaceFolder, ".roo")
			const mcpPath = path.join(rooDir, "mcp.json")

			try {
				await fs.mkdir(rooDir, { recursive: true })
				const exists = await fileExistsAtPath(mcpPath)

				if (!exists) {
					await safeWriteJson(mcpPath, { mcpServers: {} })
				}

				await openFile(mcpPath)
			} catch (error) {
				vscode.window.showErrorMessage(t("mcp:errors.create_json", { error: `${error}` }))
			}

			break
		}
		case "deleteMcpServer": {
			if (!message.serverName) {
				break
			}

			try {
				provider.log(`Attempting to delete MCP server: ${message.serverName}`)
				await provider.getMcpHub()?.deleteServer(message.serverName, message.source as "global" | "project")
				provider.log(`Successfully deleted MCP server: ${message.serverName}`)

				// Refresh the webview state
				await provider.postStateToWebview()
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error)
				provider.log(`Failed to delete MCP server: ${errorMessage}`)
				// Error messages are already handled by McpHub.deleteServer
			}
			break
		}
		case "restartMcpServer": {
			try {
				await provider.getMcpHub()?.restartConnection(message.text!, message.source as "global" | "project")
			} catch (error) {
				provider.log(
					`Failed to retry connection for ${message.text}: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
				)
			}
			break
		}
		case "toggleToolAlwaysAllow": {
			try {
				await provider
					.getMcpHub()
					?.toggleToolAlwaysAllow(
						message.serverName!,
						message.source as "global" | "project",
						message.toolName!,
						Boolean(message.alwaysAllow),
					)
			} catch (error) {
				provider.log(
					`Failed to toggle auto-approve for tool ${message.toolName}: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
				)
			}
			break
		}
		case "toggleToolEnabledForPrompt": {
			try {
				await provider
					.getMcpHub()
					?.toggleToolEnabledForPrompt(
						message.serverName!,
						message.source as "global" | "project",
						message.toolName!,
						Boolean(message.isEnabled),
					)
			} catch (error) {
				provider.log(
					`Failed to toggle enabled for prompt for tool ${message.toolName}: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
				)
			}
			break
		}
		case "toggleMcpServer": {
			try {
				await provider
					.getMcpHub()
					?.toggleServerDisabled(
						message.serverName!,
						message.disabled!,
						message.source as "global" | "project",
					)
			} catch (error) {
				provider.log(
					`Failed to toggle MCP server ${message.serverName}: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
				)
			}
			break
		}
		case "mcpEnabled":
			const mcpEnabled = message.bool ?? true
			await updateGlobalState("mcpEnabled", mcpEnabled)

			const mcpHubInstance = provider.getMcpHub()

			if (mcpHubInstance) {
				await mcpHubInstance.handleMcpEnabledChange(mcpEnabled)
			}

			await provider.postStateToWebview()
			break
		case "enableMcpServerCreation":
			await updateGlobalState("enableMcpServerCreation", message.bool ?? true)
			await provider.postStateToWebview()
			break
		case "memorySystemEnabled":
			await updateGlobalState("memorySystemEnabled", message.bool ?? true)
			await provider.postStateToWebview()
			break
		case "memoryToolsEnabled":
			await updateGlobalState("memoryToolsEnabled", message.bool ?? true)
			await provider.postStateToWebview()
			break
		case "remoteControlEnabled":
			try {
				await CloudService.instance.updateUserSettings({ extensionBridgeEnabled: message.bool ?? false })
			} catch (error) {
				provider.log(
					`CloudService#updateUserSettings failed: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
			break
		case "taskSyncEnabled":
			const enabled = message.bool ?? false
			const updatedSettings: Partial<UserSettingsConfig> = {
				taskSyncEnabled: enabled,
			}
			// If disabling task sync, also disable remote control
			if (!enabled) {
				updatedSettings.extensionBridgeEnabled = false
			}
			try {
				await CloudService.instance.updateUserSettings(updatedSettings)
			} catch (error) {
				provider.log(`Failed to update cloud settings for task sync: ${error}`)
			}
			break
		case "refreshAllMcpServers": {
			const mcpHub = provider.getMcpHub()

			if (mcpHub) {
				await mcpHub.refreshAllConnections()
			}

			break
		}
		case "soundEnabled":
			const soundEnabled = message.bool ?? true
			await updateGlobalState("soundEnabled", soundEnabled)
			await provider.postStateToWebview()
			break
		case "soundVolume":
			const soundVolume = message.value ?? 0.5
			await updateGlobalState("soundVolume", soundVolume)
			await provider.postStateToWebview()
			break
		case "ttsEnabled":
			const ttsEnabled = message.bool ?? true
			await updateGlobalState("ttsEnabled", ttsEnabled)
			setTtsEnabled(ttsEnabled)
			await provider.postStateToWebview()
			break
		case "ttsSpeed":
			const ttsSpeed = message.value ?? 1.0
			await updateGlobalState("ttsSpeed", ttsSpeed)
			setTtsSpeed(ttsSpeed)
			await provider.postStateToWebview()
			break
		case "playTts":
			if (message.text) {
				playTts(message.text, {
					onStart: () => provider.postMessageToWebview({ type: "ttsStart", text: message.text }),
					onStop: () => provider.postMessageToWebview({ type: "ttsStop", text: message.text }),
				})
			}

			break
		case "stopTts":
			stopTts()
			break
		case "diffEnabled":
			const diffEnabled = message.bool ?? true
			await updateGlobalState("diffEnabled", diffEnabled)
			await provider.postStateToWebview()
			break
		case "enableCheckpoints":
			const enableCheckpoints = message.bool ?? true
			await updateGlobalState("enableCheckpoints", enableCheckpoints)
			await provider.postStateToWebview()
			break
		case "enableRooCloudServices":
			const enableRooCloudServices = message.bool ?? true
			await updateGlobalState("enableRooCloudServices", enableRooCloudServices)
			
			// When disabling Roo cloud services, also disable telemetry
			if (!enableRooCloudServices) {
				const telemetrySetting = "disabled"
				await updateGlobalState("telemetrySetting", telemetrySetting)
				if (TelemetryService.hasInstance()) {
					TelemetryService.instance.updateTelemetryState(false)
				}
			}
			
			await provider.postStateToWebview()
			break
		case "customUserAgent":
			const customUserAgent = message.text ?? ""
			await updateGlobalState("customUserAgent", customUserAgent)
			await provider.postStateToWebview()
			break
		case "customUserAgentMode":
			const customUserAgentMode = (message.text === "full" || message.text === "segments") ? message.text : "segments"
			await updateGlobalState("customUserAgentMode", customUserAgentMode)
			await provider.postStateToWebview()
			break
		case "customUserAgentFull":
			const customUserAgentFull = message.text ?? ""
			await updateGlobalState("customUserAgentFull", customUserAgentFull)
			await provider.postStateToWebview()
			break
		case "browserViewportSize":
			const browserViewportSize = message.text ?? "900x600"
			await updateGlobalState("browserViewportSize", browserViewportSize)
			await provider.postStateToWebview()
			break
		case "remoteBrowserHost":
			await updateGlobalState("remoteBrowserHost", message.text)
			await provider.postStateToWebview()
			break
		case "remoteBrowserEnabled":
			// Store the preference in global state
			// remoteBrowserEnabled now means "enable remote browser connection"
			await updateGlobalState("remoteBrowserEnabled", message.bool ?? false)
			// If disabling remote browser connection, clear the remoteBrowserHost
			if (!message.bool) {
				await updateGlobalState("remoteBrowserHost", undefined)
			}
			await provider.postStateToWebview()
			break
		case "testBrowserConnection":
			// If no text is provided, try auto-discovery
			if (!message.text) {
				// Use testBrowserConnection for auto-discovery
				const chromeHostUrl = await discoverChromeHostUrl()

				if (chromeHostUrl) {
					// Send the result back to the webview
					await provider.postMessageToWebview({
						type: "browserConnectionResult",
						success: !!chromeHostUrl,
						text: `Auto-discovered and tested connection to Chrome: ${chromeHostUrl}`,
						values: { endpoint: chromeHostUrl },
					})
				} else {
					await provider.postMessageToWebview({
						type: "browserConnectionResult",
						success: false,
						text: "No Chrome instances found on the network. Make sure Chrome is running with remote debugging enabled (--remote-debugging-port=9222).",
					})
				}
			} else {
				// Test the provided URL
				const customHostUrl = message.text
				const hostIsValid = await tryChromeHostUrl(message.text)

				// Send the result back to the webview
				await provider.postMessageToWebview({
					type: "browserConnectionResult",
					success: hostIsValid,
					text: hostIsValid
						? `Successfully connected to Chrome: ${customHostUrl}`
						: "Failed to connect to Chrome",
				})
			}
			break
		case "fuzzyMatchThreshold":
			await updateGlobalState("fuzzyMatchThreshold", message.value)
			await provider.postStateToWebview()
			break
		case "updateVSCodeSetting": {
			const { setting, value } = message

			if (setting !== undefined && value !== undefined) {
				if (ALLOWED_VSCODE_SETTINGS.has(setting)) {
					await vscode.workspace.getConfiguration().update(setting, value, true)
				} else {
					vscode.window.showErrorMessage(`Cannot update restricted VSCode setting: ${setting}`)
				}
			}

			break
		}
		case "getVSCodeSetting":
			const { setting } = message

			if (setting) {
				try {
					await provider.postMessageToWebview({
						type: "vsCodeSetting",
						setting,
						value: vscode.workspace.getConfiguration().get(setting),
					})
				} catch (error) {
					console.error(`Failed to get VSCode setting ${message.setting}:`, error)

					await provider.postMessageToWebview({
						type: "vsCodeSetting",
						setting,
						error: `Failed to get setting: ${error.message}`,
						value: undefined,
					})
				}
			}

			break
		case "alwaysApproveResubmit":
			await updateGlobalState("alwaysApproveResubmit", message.bool ?? false)
			await provider.postStateToWebview()
			break
		case "requestDelaySeconds":
			await updateGlobalState("requestDelaySeconds", message.value ?? 5)
			await provider.postStateToWebview()
			break
		case "writeDelayMs":
			await updateGlobalState("writeDelayMs", message.value)
			await provider.postStateToWebview()
			break
		case "diagnosticsEnabled":
			await updateGlobalState("diagnosticsEnabled", message.bool ?? true)
			await provider.postStateToWebview()
			break
		case "terminalOutputLineLimit":
			// Validate that the line limit is a positive number
			const lineLimit = message.value
			if (typeof lineLimit === "number" && lineLimit > 0) {
				await updateGlobalState("terminalOutputLineLimit", lineLimit)
				await provider.postStateToWebview()
			} else {
				vscode.window.showErrorMessage(
					t("common:errors.invalid_line_limit") || "Terminal output line limit must be a positive number",
				)
			}
			break
		case "terminalOutputCharacterLimit":
			// Validate that the character limit is a positive number
			const charLimit = message.value
			if (typeof charLimit === "number" && charLimit > 0) {
				await updateGlobalState("terminalOutputCharacterLimit", charLimit)
				await provider.postStateToWebview()
			} else {
				vscode.window.showErrorMessage(
					t("common:errors.invalid_character_limit") ||
						"Terminal output character limit must be a positive number",
				)
			}
			break
		case "terminalShellIntegrationTimeout":
			await updateGlobalState("terminalShellIntegrationTimeout", message.value)
			await provider.postStateToWebview()
			if (message.value !== undefined) {
				Terminal.setShellIntegrationTimeout(message.value)
			}
			break
		case "terminalShellIntegrationDisabled":
			await updateGlobalState("terminalShellIntegrationDisabled", message.bool)
			await provider.postStateToWebview()
			if (message.bool !== undefined) {
				Terminal.setShellIntegrationDisabled(message.bool)
			}
			break
		case "terminalCommandDelay":
			await updateGlobalState("terminalCommandDelay", message.value)
			await provider.postStateToWebview()
			if (message.value !== undefined) {
				Terminal.setCommandDelay(message.value)
			}
			break
		case "terminalPowershellCounter":
			await updateGlobalState("terminalPowershellCounter", message.bool)
			await provider.postStateToWebview()
			if (message.bool !== undefined) {
				Terminal.setPowershellCounter(message.bool)
			}
			break
		case "terminalZshClearEolMark":
			await updateGlobalState("terminalZshClearEolMark", message.bool)
			await provider.postStateToWebview()
			if (message.bool !== undefined) {
				Terminal.setTerminalZshClearEolMark(message.bool)
			}
			break
		case "terminalZshOhMy":
			await updateGlobalState("terminalZshOhMy", message.bool)
			await provider.postStateToWebview()
			if (message.bool !== undefined) {
				Terminal.setTerminalZshOhMy(message.bool)
			}
			break
		case "terminalZshP10k":
			await updateGlobalState("terminalZshP10k", message.bool)
			await provider.postStateToWebview()
			if (message.bool !== undefined) {
				Terminal.setTerminalZshP10k(message.bool)
			}
			break
		case "terminalZdotdir":
			await updateGlobalState("terminalZdotdir", message.bool)
			await provider.postStateToWebview()
			if (message.bool !== undefined) {
				Terminal.setTerminalZdotdir(message.bool)
			}
			break
		case "terminalCompressProgressBar":
			await updateGlobalState("terminalCompressProgressBar", message.bool)
			await provider.postStateToWebview()
			if (message.bool !== undefined) {
				Terminal.setCompressProgressBar(message.bool)
			}
			break
		case "mode":
			await provider.handleModeSwitch(message.text as Mode)
			break
		case "updateSupportPrompt":
			try {
				if (!message?.values) {
					return
				}

				// Replace all prompts with the new values from the cached state
				await updateGlobalState("customSupportPrompts", message.values)
				await provider.postStateToWebview()
			} catch (error) {
				provider.log(
					`Error update support prompt: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
				)
				vscode.window.showErrorMessage(t("common:errors.update_support_prompt"))
			}
			break
		case "updatePrompt":
			if (message.promptMode && message.customPrompt !== undefined) {
				const existingPrompts = getGlobalState("customModePrompts") ?? {}
				const updatedPrompts = { ...existingPrompts, [message.promptMode]: message.customPrompt }
				await updateGlobalState("customModePrompts", updatedPrompts)
				const currentState = await provider.getStateToPostToWebview()
				const stateWithPrompts = {
					...currentState,
					customModePrompts: updatedPrompts,
					hasOpenedModeSelector: currentState.hasOpenedModeSelector ?? false,
				}
				provider.postMessageToWebview({ type: "state", state: stateWithPrompts })

				if (TelemetryService.hasInstance()) {
					// Determine which setting was changed by comparing objects
					const oldPrompt = existingPrompts[message.promptMode] || {}
					const newPrompt = message.customPrompt
					const changedSettings = Object.keys(newPrompt).filter(
						(key) =>
							JSON.stringify((oldPrompt as Record<string, unknown>)[key]) !==
							JSON.stringify((newPrompt as Record<string, unknown>)[key]),
					)

					if (changedSettings.length > 0) {
						TelemetryService.instance.captureModeSettingChanged(changedSettings[0])
					}
				}
			}
			break
		case "deleteMessage": {
			if (!provider.getCurrentTask()) {
				await vscode.window.showErrorMessage(t("common:errors.message.no_active_task_to_delete"))
				break
			}

			if (typeof message.value !== "number" || !message.value) {
				await vscode.window.showErrorMessage(t("common:errors.message.invalid_timestamp_for_deletion"))
				break
			}

			await handleMessageModificationsOperation(message.value, "delete")
			break
		}
		case "submitEditedMessage": {
			if (
				provider.getCurrentTask() &&
				typeof message.value === "number" &&
				message.value &&
				message.editedMessageContent
			) {
				await handleMessageModificationsOperation(
					message.value,
					"edit",
					message.editedMessageContent,
					message.images,
				)
			}
			break
		}
		case "screenshotQuality":
			await updateGlobalState("screenshotQuality", message.value)
			await provider.postStateToWebview()
			break
		case "maxOpenTabsContext":
			const tabCount = Math.min(Math.max(0, message.value ?? 20), 500)
			await updateGlobalState("maxOpenTabsContext", tabCount)
			await provider.postStateToWebview()
			break
		case "maxWorkspaceFiles":
			const fileCount = Math.min(Math.max(0, message.value ?? 200), 500)
			await updateGlobalState("maxWorkspaceFiles", fileCount)
			await provider.postStateToWebview()
			break
		case "alwaysAllowFollowupQuestions":
			await updateGlobalState("alwaysAllowFollowupQuestions", message.bool ?? false)
			await provider.postStateToWebview()
			break
		case "followupAutoApproveTimeoutMs":
			await updateGlobalState("followupAutoApproveTimeoutMs", message.value)
			await provider.postStateToWebview()
			break
		case "browserToolEnabled":
			await updateGlobalState("browserToolEnabled", message.bool ?? true)
			await provider.postStateToWebview()
			break
		case "language":
			changeLanguage(message.text ?? "en")
			await updateGlobalState("language", message.text as Language)
			await provider.postStateToWebview()
			break
		case "openRouterImageApiKey":
			await provider.contextProxy.setValue("openRouterImageApiKey", message.text)
			await provider.postStateToWebview()
			break
		case "openRouterImageGenerationSelectedModel":
			await provider.contextProxy.setValue("openRouterImageGenerationSelectedModel", message.text)
			await provider.postStateToWebview()
			break
		case "showRooIgnoredFiles":
			await updateGlobalState("showRooIgnoredFiles", message.bool ?? false)
			await provider.postStateToWebview()
			break
		case "hasOpenedModeSelector":
			await updateGlobalState("hasOpenedModeSelector", message.bool ?? true)
			await provider.postStateToWebview()
			break
		case "maxReadFileLine":
			await updateGlobalState("maxReadFileLine", message.value)
			await provider.postStateToWebview()
			break
		case "maxImageFileSize":
			await updateGlobalState("maxImageFileSize", message.value)
			await provider.postStateToWebview()
			break
		case "maxTotalImageSize":
			await updateGlobalState("maxTotalImageSize", message.value)
			await provider.postStateToWebview()
			break
		case "maxConcurrentFileReads":
			const valueToSave = message.value // Capture the value intended for saving
			await updateGlobalState("maxConcurrentFileReads", valueToSave)
			await provider.postStateToWebview()
			break
		case "includeDiagnosticMessages":
			// Only apply default if the value is truly undefined (not false)
			const includeValue = message.bool !== undefined ? message.bool : true
			await updateGlobalState("includeDiagnosticMessages", includeValue)
			await provider.postStateToWebview()
			break
		case "maxDiagnosticMessages":
			await updateGlobalState("maxDiagnosticMessages", message.value ?? 50)
			await provider.postStateToWebview()
			break
	case "setHistoryPreviewCollapsed": // Add the new case handler
		await updateGlobalState("historyPreviewCollapsed", message.bool ?? false)
		// No need to call postStateToWebview here as the UI already updated optimistically
		break
	case "setWorkspaceContextSetting": {
		const key = message.workspaceContextKey as WorkspaceContextSettingKey | undefined
		if (!key) {
			break
		}

		const currentSettings: Record<WorkspaceContextSettingKey, boolean> =
			(getGlobalState("workspaceContextSettings") as Record<WorkspaceContextSettingKey, boolean> | undefined) ?? {} as Record<WorkspaceContextSettingKey, boolean>

		const updatedSettings = {
			...currentSettings,
			[key]: message.bool ?? false,
		}

		// provider.log(
		// 	`[WorkspaceContext] setWorkspaceContextSetting ${key} -> ${updatedSettings[key]} | before=${JSON.stringify(currentSettings)}`,
		// )
		await updateGlobalState("workspaceContextSettings", updatedSettings)
		await provider.postStateToWebview()
		break
	}
	case "setWorkspaceContextSettings": {
		const settings = message.workspaceContextSettings
		if (!settings) {
			break
		}

		provider.log(`[WorkspaceContext] setWorkspaceContextSettings bulk=${JSON.stringify(settings)}`)
		await updateGlobalState("workspaceContextSettings", settings as Record<WorkspaceContextSettingKey, boolean>)
		await provider.postStateToWebview()
		break
	}
		case "setReasoningBlockCollapsed":
			await updateGlobalState("reasoningBlockCollapsed", message.bool ?? true)
			// No need to call postStateToWebview here as the UI already updated optimistically
			break
		case "loadGlobalHistory": {
			try {
				provider.log("[GlobalHistory] Loading global history...")
				const globalService = await getGlobalStorageService(provider.context)
				const history = await globalService.getGlobalHistory()
				provider.log(`[GlobalHistory] Loaded ${history.length} global history items`)
				provider.postMessageToWebview({
					type: "globalHistoryLoaded",
					globalHistory: history,
				})
			} catch (error) {
				provider.log(`Error loading global history: ${error}`)
				vscode.window.showErrorMessage(`Failed to load global history: ${error}`)
			}
			break
		}
		case "addGlobalHistoryItem": {
			try {
				if (!message.historyItem) {
					throw new Error("History item is required")
				}

				provider.log("[GlobalHistory] Adding global history item...")
				const globalService = await getGlobalStorageService(provider.context)
				const addedItem = await globalService.addGlobalHistoryItem(message.historyItem)

				provider.log(`[GlobalHistory] Added global history item: ${addedItem.id}`)
				provider.postMessageToWebview({
					type: "globalHistoryItemAdded",
					historyItem: addedItem,
				})
			} catch (error) {
				provider.log(`Error adding global history item: ${error}`)
				vscode.window.showErrorMessage(`Failed to add global history item: ${error}`)
			}
			break
		}
		case "deleteGlobalHistoryItem": {
			try {
				if (!message.historyItemId) {
					throw new Error("History item ID is required")
				}

				provider.log(`[GlobalHistory] Deleting global history item: ${message.historyItemId}`)
				const globalService = await getGlobalStorageService(provider.context)
				const success = await globalService.deleteGlobalHistoryItem(message.historyItemId)

				if (success) {
					provider.log(`[GlobalHistory] Deleted global history item: ${message.historyItemId}`)
					provider.postMessageToWebview({
						type: "globalHistoryItemDeleted",
						historyItemId: message.historyItemId,
					})
					vscode.window.showInformationMessage("全局历史记录已删除")
				} else {
					throw new Error("删除失败，项目不存在")
				}
			} catch (error) {
				provider.log(`Error deleting global history item: ${error}`)
				vscode.window.showErrorMessage(`删除全局历史记录失败: ${error}`)
			}
			break
		}
		case "clearGlobalHistory": {
			try {
				provider.log("[GlobalHistory] Clearing global history...")
				const globalService = await getGlobalStorageService(provider.context)
				await globalService.clearGlobalHistory()

				provider.log("[GlobalHistory] Cleared global history")
				provider.postMessageToWebview({
					type: "globalHistoryCleared",
				})
				vscode.window.showInformationMessage("全局历史记录已清空")
			} catch (error) {
				provider.log(`Error clearing global history: ${error}`)
				vscode.window.showErrorMessage(`清空全局历史记录失败: ${error}`)
			}
			break
		}
		case "loadAllWorldBooks": {
			try {
				provider.log("[WorldBook] Loading all world books...")
				const extendedService = await getExtendedWorldBookService(provider.context)
				const worldBooks = await extendedService.getAllWorldBooks()
				provider.log(`[WorldBook] Loaded ${worldBooks.length} world books (global+workspace)`)
				provider.postMessageToWebview({
					type: "allWorldBooksLoaded",
					worldBooks,
				})
			} catch (error) {
				provider.log(`Error loading all world books: ${error}`)
				vscode.window.showErrorMessage(`Failed to load world books: ${error}`)
			}
			break
		}
		case "browseWorldBookFile": {
			try {
				const isGlobal = message.isGlobal || false
				const scopeInfo = isGlobal ? "global" : "workspace"
				provider.log(`[WorldBook] Browsing for world book file (${scopeInfo})...`)
				const extendedService = await getExtendedWorldBookService(provider.context)
				const filePath = await extendedService.browseWorldBookFile(isGlobal)

				if (filePath) {
					provider.log(`[WorldBook] Selected file: ${filePath}`)
					provider.postMessageToWebview({
						type: "worldBookFileSelected",
						worldBookFilePath: filePath,
					})
				}
			} catch (error) {
				provider.log(`Error browsing world book file: ${error}`)
				vscode.window.showErrorMessage(`Failed to browse world book file: ${error}`)
			}
			break
		}
		case "copyWorldBook": {
			try {
				if (!message.sourceWorldBook || !message.targetScope) {
					throw new Error("Source world book and target scope are required")
				}

				provider.log(`[WorldBook] Copying world book "${message.sourceWorldBook.name}" to ${message.targetScope}...`)
				const extendedService = await getExtendedWorldBookService(provider.context)
				const success = await extendedService.copyWorldBook(message.sourceWorldBook, message.targetScope === "global")

				if (success) {
					// 刷新列表
					const worldBooks = await extendedService.getAllWorldBooks()
					provider.postMessageToWebview({
						type: "allWorldBooksLoaded",
						worldBooks,
					})

					const location = message.targetScope === "global" ? "全局" : "工作区"
					vscode.window.showInformationMessage(`世界书已成功复制到${location}`)
				} else {
					throw new Error("复制失败")
				}
			} catch (error) {
				provider.log(`Error copying world book: ${error}`)
				vscode.window.showErrorMessage(`复制世界书失败: ${error}`)
			}
			break
		}
		case "deleteWorldBook": {
			try {
				if (!message.worldBook) {
					throw new Error("World book is required for deletion")
				}

				provider.log(`[WorldBook] Deleting world book "${message.worldBook.name}"...`)
				const extendedService = await getExtendedWorldBookService(provider.context)
				const success = await extendedService.deleteWorldBook(message.worldBook)

				if (success) {
					// 刷新列表
					const worldBooks = await extendedService.getAllWorldBooks()
					provider.postMessageToWebview({
						type: "allWorldBooksLoaded",
						worldBooks,
					})

					vscode.window.showInformationMessage(`世界书 "${message.worldBook.name}" 已删除`)
				} else {
					throw new Error("删除失败")
				}
			} catch (error) {
				provider.log(`Error deleting world book: ${error}`)
				vscode.window.showErrorMessage(`删除世界书失败: ${error}`)
			}
			break
		}
		case "getGlobalExtensionsInfo": {
			try {
				provider.log("[Extension] Getting global extensions info...")
				const globalService = await getGlobalStorageService(provider.context)
				const extensionsInfo = await globalService.getGlobalExtensionsInfo()

				provider.log(`[Extension] Found ${extensionsInfo.extensions.length} global extensions`)
				provider.postMessageToWebview({
					type: "globalExtensionsInfoLoaded",
					extensionsInfo: extensionsInfo.extensions,
				})
			} catch (error) {
				provider.log(`Error getting global extensions info: ${error}`)
				vscode.window.showErrorMessage(`获取全局扩展信息失败: ${error}`)
			}
			break
		}
		case "copyExtensionToGlobal": {
			try {
				if (!message.sourceExtensionPath || !message.extensionName) {
					throw new Error("Source extension path and extension name are required")
				}

				provider.log(`[Extension] Copying extension "${message.extensionName}" to global...`)
				const globalService = await getGlobalStorageService(provider.context)
				const success = await globalService.copyExtensionToGlobal(
					message.sourceExtensionPath,
					message.extensionName
				)

				if (success) {
					vscode.window.showInformationMessage(`扩展 "${message.extensionName}" 已复制到全局存储`)
				} else {
					throw new Error("复制失败")
				}
			} catch (error) {
				provider.log(`Error copying extension to global: ${error}`)
				vscode.window.showErrorMessage(`复制扩展到全局存储失败: ${error}`)
			}
			break
		}
		case "deleteGlobalExtension": {
			try {
				if (!message.extensionName) {
					throw new Error("Extension name is required for deletion")
				}

				provider.log(`[Extension] Deleting global extension "${message.extensionName}"...`)
				const globalService = await getGlobalStorageService(provider.context)
				const success = await globalService.deleteGlobalExtension(message.extensionName)

				if (success) {
					vscode.window.showInformationMessage(`全局扩展 "${message.extensionName}" 已删除`)
				} else {
					throw new Error("删除失败，扩展不存在")
				}
			} catch (error) {
				provider.log(`Error deleting global extension: ${error}`)
				vscode.window.showErrorMessage(`删除全局扩展失败: ${error}`)
			}
			break
		}
		case "anhChatModeHideTaskCompletion":
			await updateGlobalState("anhChatModeHideTaskCompletion", message.bool ?? true)
			// No need to call postStateToWebview here as the UI already updated optimistically
			break
		case "anhShowRoleCardOnSwitch":
			await updateGlobalState("anhShowRoleCardOnSwitch", message.bool ?? false)
			// No need to call postStateToWebview here as the UI already updated optimistically
			break
		case "hideRoleDescription":
		await updateGlobalState("hideRoleDescription", message.bool ?? false)
		// No need to call postStateToWebview here as the UI already updated optimistically
		break
	case "allowNoToolsInChatMode":
		await updateGlobalState("allowNoToolsInChatMode", message.bool ?? false)
		// No need to call postStateToWebview here as the UI already updated optimistically
		break
	case "updateAnhExtensionSettings":
			if (message.text && message.values) {
				const current = getGlobalState("anhExtensionSettings") ?? {}
				const extensionId = message.text as string
				const updatedSettings = {
					...current,
					[extensionId]: {
						...(current[extensionId] ?? {}),
						...(message.values as Record<string, unknown>),
					},
				}
				await updateGlobalState("anhExtensionSettings", updatedSettings)
				await provider.refreshAnhExtensions()
				await provider.postStateToWebview()
			}
			break
		case "toggleAnhExtension":
			if (typeof message.text === "string") {
				const current = getGlobalState("anhExtensionsEnabled") ?? {}
				const updated = { ...current, [message.text]: message.bool ?? false }
				await updateGlobalState("anhExtensionsEnabled", updated)
				await provider.refreshAnhExtensions()
				await provider.postStateToWebview()
			}
			break
		case "getAnhExtensionState": {
			try {
				const enabledExtensions = getGlobalState("anhExtensionsEnabled") ?? {}
				const extensionSettings = getGlobalState("anhExtensionSettings") ?? {}

				await provider.postMessageToWebview({
					type: "anhExtensionState",
					text: "anhExtensionState",
					payload: {
						enabledExtensions,
						extensionSettings
					}
				})
			} catch (error) {
				provider.log(`Error getting anh extension state: ${error instanceof Error ? error.message : String(error)}`)
				await provider.postMessageToWebview({
					type: "anhExtensionState",
					text: "anhExtensionState",
					payload: {
						enabledExtensions: {},
						extensionSettings: {}
					}
				})
			}
			break
		}
		case "saveSillyTavernWorldBookChanges": {
			try {
				provider.log("Saving SillyTavern WorldBook changes...")
				// WorldBook设置的保存逻辑在SillyTavernWorldBookSettings组件内部处理
				// 这里主要是触发状态同步
				await provider.postStateToWebview()
				vscode.window.showInformationMessage("世界书设置已保存")
			} catch (error) {
				provider.log(`Error saving worldbook changes: ${error instanceof Error ? error.message : String(error)}`)
				vscode.window.showErrorMessage("保存世界书设置失败")
			}
			break
		}
		case "saveWorldviewChanges": {
			try {
				provider.log("Saving Worldview changes...")
				// Worldview设置的保存逻辑在WorldviewSettings组件内部处理
				// 这里主要是触发状态同步
				await provider.postStateToWebview()
				vscode.window.showInformationMessage("世界观设置已保存")
			} catch (error) {
				provider.log(`Error saving worldview changes: ${error instanceof Error ? error.message : String(error)}`)
				vscode.window.showErrorMessage("保存世界观设置失败")
			}
			break
		}
		case "saveAnhExtensionChanges": {
			try {
				console.log("[Extension] Saving ANH extension changes...")
				
				// 消息应该包含 extensionChanges 和 extensionSettings
				const extensionChanges = message.extensionChanges as Record<string, boolean> || {}
				const extensionSettings = message.extensionSettings as Record<string, Record<string, unknown>> || {}

				console.log("[Extension] Saving changes:", {
					extensionChanges: Object.keys(extensionChanges).length,
					extensionSettings: Object.keys(extensionSettings).length
				})

				// 保存启用状态更改
				if (Object.keys(extensionChanges).length > 0) {
					const currentEnabled = getGlobalState("anhExtensionsEnabled") ?? {}
					const updatedEnabled = { ...currentEnabled, ...extensionChanges }
					await updateGlobalState("anhExtensionsEnabled", updatedEnabled)
				}

				// 保存设置更改
				if (Object.keys(extensionSettings).length > 0) {
					const currentSettings = getGlobalState("anhExtensionSettings") ?? {}
					const updatedSettings = { ...currentSettings, ...extensionSettings }
					await updateGlobalState("anhExtensionSettings", updatedSettings)
				}

				// 清除变更标志
				await updateGlobalState("anhExtensionsHasChanges", false)

				// 刷新扩展状态
				await provider.refreshAnhExtensions()
				await provider.postStateToWebview()

				provider.log(`Saved ${Object.keys(extensionChanges).length} extension enabled changes and ${Object.keys(extensionSettings).length} extension settings changes`)
				vscode.window.showInformationMessage("扩展设置已保存")
			} catch (error) {
				provider.log(`Error saving anh extension changes: ${error instanceof Error ? error.message : String(error)}`)
				vscode.window.showErrorMessage("保存扩展设置失败")
			}
			break
		}
		case "resetAnhExtensionChanges": {
			try {
				// 发送当前状态给前端，让前端重置到当前状态
				const enabledExtensions = getGlobalState("anhExtensionsEnabled") ?? {}
				const extensionSettings = getGlobalState("anhExtensionSettings") ?? {}

				await provider.postMessageToWebview({
					type: "anhExtensionState",
					text: "anhExtensionState",
					payload: {
						enabledExtensions,
						extensionSettings
					}
				})

				provider.log("Reset anh extension changes to current state")
			} catch (error) {
				provider.log(`Error resetting anh extension changes: ${error instanceof Error ? error.message : String(error)}`)
			}
			break
		}
		case "saveTSProfileChanges": {
			try {
				console.log("[TSProfile] Saving TSProfile changes...")
				
				// 消息应该包含 enabledProfiles, autoInject, variables
				const enabledProfiles = message.enabledProfiles as string[] || []
				const autoInject = message.autoInject as boolean ?? true
				const variables = message.variables as Record<string, string> || {}

				console.log("[TSProfile] Saving settings:", {
					enabledProfiles,
					autoInject,
					variables: Object.keys(variables).length
				})

				// 保存启用状态更改
				await updateGlobalState("enabledTSProfiles", enabledProfiles)

				// 保存自动注入设置
				await updateGlobalState("anhTsProfileAutoInject", autoInject)

				// 保存变量设置
				await updateGlobalState("anhTsProfileVariables", variables)

				// 清除变更标志
				await updateGlobalState("tsProfilesHasChanges", false)

				// 刷新状态
				await provider.postStateToWebview()

				// 重新初始化正则处理器（如果启用）
				provider.reloadRegexProcessors().catch((error) => {
					provider.log(`Failed to reinitialize regex processor after TSProfile changes: ${error}`)
				})

				provider.log(`Saved TSProfile changes: ${enabledProfiles.length} enabled profiles, autoInject: ${autoInject}, ${Object.keys(variables).length} variables`)
				vscode.window.showInformationMessage("TSProfile设置已保存")

				// 发送确认消息给前端，确保前端状态同步
				await provider.postMessageToWebview({
					type: "tsProfileState",
					text: "tsProfileState",
					payload: {
						enabledProfiles,
						autoInject,
						variables
					}
				})
			} catch (error) {
				provider.log(`Error saving TSProfile changes: ${error instanceof Error ? error.message : String(error)}`)
				vscode.window.showErrorMessage("保存TSProfile设置失败")
				
				// 发送错误状态给前端，清除保存中状态
				await provider.postMessageToWebview({
					type: "tsProfileState",
					text: "tsProfileState",
					payload: {
						enabledProfiles: getGlobalState("enabledTSProfiles") ?? [],
						autoInject: getGlobalState("anhTsProfileAutoInject") ?? true,
						variables: getGlobalState("anhTsProfileVariables") ?? {}
					}
				})
			}
			break
		}
		case "getTSProfileState": {
			try {
				const enabledProfiles = getGlobalState("enabledTSProfiles") ?? []
				const autoInject = getGlobalState("anhTsProfileAutoInject") ?? true
				const variables = getGlobalState("anhTsProfileVariables") ?? {}

				await provider.postMessageToWebview({
					type: "tsProfileState",
					text: "tsProfileState",
					payload: {
						enabledProfiles,
						autoInject,
						variables
					}
				})
			} catch (error) {
				provider.log(`Error getting TSProfile state: ${error instanceof Error ? error.message : String(error)}`)
				await provider.postMessageToWebview({
					type: "tsProfileState",
					text: "tsProfileState",
					payload: {
						enabledProfiles: [],
						autoInject: true,
						variables: {}
					}
				})
			}
			break
		}
		case "toggleApiConfigPin":
			if (message.text) {
				const currentPinned = getGlobalState("pinnedApiConfigs") ?? {}
				const updatedPinned: Record<string, boolean> = { ...currentPinned }

				if (currentPinned[message.text]) {
					delete updatedPinned[message.text]
				} else {
					updatedPinned[message.text] = true
				}

				await updateGlobalState("pinnedApiConfigs", updatedPinned)
				await provider.postStateToWebview()
			}
			break
		case "enhancementApiConfigId":
			await updateGlobalState("enhancementApiConfigId", message.text)
			await provider.postStateToWebview()
			break
		case "includeTaskHistoryInEnhance":
			await updateGlobalState("includeTaskHistoryInEnhance", message.bool ?? true)
			await provider.postStateToWebview()
			break
		case "condensingApiConfigId":
			await updateGlobalState("condensingApiConfigId", message.text)
			await provider.postStateToWebview()
			break
		case "updateCondensingPrompt":
			// Store the condensing prompt in customSupportPrompts["CONDENSE"] instead of customCondensingPrompt
			const currentSupportPrompts = getGlobalState("customSupportPrompts") ?? {}
			const updatedSupportPrompts = { ...currentSupportPrompts, CONDENSE: message.text }
			await updateGlobalState("customSupportPrompts", updatedSupportPrompts)
			// Also update the old field for backward compatibility during migration
			await updateGlobalState("customCondensingPrompt", message.text)
			await provider.postStateToWebview()
			break
		case "profileThresholds":
			await updateGlobalState("profileThresholds", message.values)
			await provider.postStateToWebview()
			break
		case "autoApprovalEnabled":
			await updateGlobalState("autoApprovalEnabled", message.bool ?? false)
			await provider.postStateToWebview()
			break
		case "enhancePrompt":
			if (message.text) {
				try {
					const state = await provider.getState()

					const {
						apiConfiguration,
						customSupportPrompts,
						listApiConfigMeta = [],
						enhancementApiConfigId,
						includeTaskHistoryInEnhance,
					} = state

					const currentCline = provider.getCurrentTask()

					const result = await MessageEnhancer.enhanceMessage({
						text: message.text,
						apiConfiguration,
						customSupportPrompts,
						listApiConfigMeta,
						enhancementApiConfigId,
						includeTaskHistoryInEnhance,
						currentClineMessages: currentCline?.clineMessages,
						providerSettingsManager: provider.providerSettingsManager,
					})

					if (result.success && result.enhancedText) {
						// Capture telemetry for prompt enhancement
						MessageEnhancer.captureTelemetry(currentCline?.taskId, includeTaskHistoryInEnhance)
						await provider.postMessageToWebview({ type: "enhancedPrompt", text: result.enhancedText })
					} else {
						throw new Error(result.error || "Unknown error")
					}
				} catch (error) {
					provider.log(
						`Error enhancing prompt: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
					)

					vscode.window.showErrorMessage(t("common:errors.enhance_prompt"))
					await provider.postMessageToWebview({ type: "enhancedPrompt" })
				}
			}
			break
		case "getSystemPrompt":
			try {
				const systemPrompt = await generateSystemPrompt(provider, message)

				await provider.postMessageToWebview({
					type: "systemPrompt",
					text: systemPrompt,
					mode: message.mode,
				})
			} catch (error) {
				provider.log(
					`Error getting system prompt:  ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
				)
				vscode.window.showErrorMessage(t("common:errors.get_system_prompt"))
			}
			break
		case "copySystemPrompt":
			try {
				const systemPrompt = await generateSystemPrompt(provider, message)

				await vscode.env.clipboard.writeText(systemPrompt)
				await vscode.window.showInformationMessage(t("common:info.clipboard_copy"))
			} catch (error) {
				provider.log(
					`Error getting system prompt:  ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
				)
				vscode.window.showErrorMessage(t("common:errors.get_system_prompt"))
			}
			break
		case "searchCommits": {
			const cwd = getCurrentCwd()
			if (cwd) {
				try {
					const commits = await searchCommits(message.query || "", cwd)
					await provider.postMessageToWebview({
						type: "commitSearchResults",
						commits,
					})
				} catch (error) {
					provider.log(
						`Error searching commits: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
					)
					vscode.window.showErrorMessage(t("common:errors.search_commits"))
				}
			}
			break
		}
		case "searchFiles": {
			const workspacePath = getCurrentCwd()

			if (!workspacePath) {
				// Handle case where workspace path is not available
				await provider.postMessageToWebview({
					type: "fileSearchResults",
					results: [],
					requestId: message.requestId,
					error: "No workspace path available",
				})
				break
			}
			try {
				// Call file search service with query from message
				const results = await searchWorkspaceFiles(
					message.query || "",
					workspacePath,
					20, // Use default limit, as filtering is now done in the backend
				)

				// Send results back to webview
				await provider.postMessageToWebview({
					type: "fileSearchResults",
					results,
					requestId: message.requestId,
				})
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error)

				// Send error response to webview
				await provider.postMessageToWebview({
					type: "fileSearchResults",
					results: [],
					error: errorMessage,
					requestId: message.requestId,
				})
			}
			break
		}
		case "updateTodoList": {
			const payload = message.payload as { todos?: any[] }
			const todos = payload?.todos
			if (Array.isArray(todos)) {
				await setPendingTodoList(todos)
			}
			break
		}
		case "saveApiConfiguration":
			if (message.text && message.apiConfiguration) {
				try {
					await provider.providerSettingsManager.saveConfig(message.text, message.apiConfiguration)
					const listApiConfig = await provider.providerSettingsManager.listConfig()
					await updateGlobalState("listApiConfigMeta", listApiConfig)
				} catch (error) {
					provider.log(
						`Error save api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
					)
					vscode.window.showErrorMessage(t("common:errors.save_api_config"))
				}
			}
			break
		case "upsertApiConfiguration":
			if (message.text && message.apiConfiguration) {
				await provider.upsertProviderProfile(message.text, message.apiConfiguration)
			}
			break
		case "renameApiConfiguration":
			if (message.values && message.apiConfiguration) {
				try {
					const { oldName, newName } = message.values

					if (oldName === newName) {
						break
					}

					// Load the old configuration to get its ID.
					const { id } = await provider.providerSettingsManager.getProfile({ name: oldName })

					// Create a new configuration with the new name and old ID.
					await provider.providerSettingsManager.saveConfig(newName, { ...message.apiConfiguration, id })

					// Delete the old configuration.
					await provider.providerSettingsManager.deleteConfig(oldName)

					// Re-activate to update the global settings related to the
					// currently activated provider profile.
					await provider.activateProviderProfile({ name: newName })
				} catch (error) {
					provider.log(
						`Error rename api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
					)

					vscode.window.showErrorMessage(t("common:errors.rename_api_config"))
				}
			}
			break
		case "loadApiConfiguration":
			if (message.text) {
				try {
					await provider.activateProviderProfile({ name: message.text })
				} catch (error) {
					provider.log(
						`Error load api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
					)
					vscode.window.showErrorMessage(t("common:errors.load_api_config"))
				}
			}
			break
		case "loadApiConfigurationById":
			if (message.text) {
				try {
					await provider.activateProviderProfile({ id: message.text })
				} catch (error) {
					provider.log(
						`Error load api configuration by ID: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
					)
					vscode.window.showErrorMessage(t("common:errors.load_api_config"))
				}
			}
			break
		case "deleteApiConfiguration":
			if (message.text) {
				const answer = await vscode.window.showInformationMessage(
					t("common:confirmation.delete_config_profile"),
					{ modal: true },
					t("common:answers.yes"),
				)

				if (answer !== t("common:answers.yes")) {
					break
				}

				const oldName = message.text

				const newName = (await provider.providerSettingsManager.listConfig()).filter(
					(c) => c.name !== oldName,
				)[0]?.name

				if (!newName) {
					vscode.window.showErrorMessage(t("common:errors.delete_api_config"))
					return
				}

				try {
					await provider.providerSettingsManager.deleteConfig(oldName)
					await provider.activateProviderProfile({ name: newName })
				} catch (error) {
					provider.log(
						`Error delete api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
					)

					vscode.window.showErrorMessage(t("common:errors.delete_api_config"))
				}
			}
			break
		case "deleteMessageConfirm":
			if (!message.messageTs) {
				await vscode.window.showErrorMessage(t("common:errors.message.cannot_delete_missing_timestamp"))
				break
			}

			if (typeof message.messageTs !== "number") {
				await vscode.window.showErrorMessage(t("common:errors.message.cannot_delete_invalid_timestamp"))
				break
			}

			await handleDeleteMessageConfirm(message.messageTs, message.restoreCheckpoint)
			break
		case "editMessageConfirm":
			if (message.messageTs && message.text) {
				await handleEditMessageConfirm(
					message.messageTs,
					message.text,
					message.restoreCheckpoint,
					message.images,
				)
			}
			break
		case "getListApiConfiguration":
			try {
				const listApiConfig = await provider.providerSettingsManager.listConfig()
				await updateGlobalState("listApiConfigMeta", listApiConfig)
				provider.postMessageToWebview({ type: "listApiConfig", listApiConfig })
			} catch (error) {
				provider.log(
					`Error get list api configuration: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
				)
				vscode.window.showErrorMessage(t("common:errors.list_api_config"))
			}
			break
	case "updateExperimental": {
		if (!message.values) {
			break
		}

		const updatedExperiments = {
			...(getGlobalState("experiments") ?? experimentDefault),
			...message.values,
		}

		await updateGlobalState("experiments", updatedExperiments)

		// Reinitialize regex processor if ST_REGEX_PROCESSOR setting changed
		if ("stRegexProcessor" in message.values) {
			const enabled = !!message.values.stRegexProcessor
			provider.setRegexProcessorEnabled(enabled)

			if (enabled) {
				provider.reloadRegexProcessors().catch((error) => {
					provider.log(`Failed to reinitialize regex processor after experimental setting change: ${error}`)
				})
			} else {
				provider.log("[RegexProcessor] Disabled via experimental settings")
			}
		}

		await provider.postStateToWebview()
		break
	}
		case "updateMcpTimeout":
			if (message.serverName && typeof message.timeout === "number") {
				try {
					await provider
						.getMcpHub()
						?.updateServerTimeout(
							message.serverName,
							message.timeout,
							message.source as "global" | "project",
						)
				} catch (error) {
					provider.log(
						`Failed to update timeout for ${message.serverName}: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
					)
					vscode.window.showErrorMessage(t("common:errors.update_server_timeout"))
				}
			}
			break
		case "updateCustomMode":
			if (message.modeConfig) {
				// Check if this is a new mode or an update to an existing mode
				const existingModes = await provider.customModesManager.getCustomModes()
				const isNewMode = !existingModes.some((mode) => mode.slug === message.modeConfig?.slug)

				await provider.customModesManager.updateCustomMode(message.modeConfig.slug, message.modeConfig)
				// Update state after saving the mode
				const customModes = await provider.customModesManager.getCustomModes()
				await updateGlobalState("customModes", customModes)
				await updateGlobalState("mode", message.modeConfig.slug)
				await provider.postStateToWebview()

				// Track telemetry for custom mode creation or update
				if (TelemetryService.hasInstance()) {
					if (isNewMode) {
						// This is a new custom mode
						TelemetryService.instance.captureCustomModeCreated(
							message.modeConfig.slug,
							message.modeConfig.name,
						)
					} else {
						// Determine which setting was changed by comparing objects
						const existingMode = existingModes.find((mode) => mode.slug === message.modeConfig?.slug)
						const changedSettings = existingMode
							? Object.keys(message.modeConfig).filter(
									(key) =>
										JSON.stringify((existingMode as Record<string, unknown>)[key]) !==
										JSON.stringify((message.modeConfig as Record<string, unknown>)[key]),
								)
							: []

						if (changedSettings.length > 0) {
							TelemetryService.instance.captureModeSettingChanged(changedSettings[0])
						}
					}
				}
			}
			break
		case "deleteCustomMode":
			if (message.slug) {
				// Get the mode details to determine source and rules folder path
				const customModes = await provider.customModesManager.getCustomModes()
				const modeToDelete = customModes.find((mode) => mode.slug === message.slug)

				if (!modeToDelete) {
					break
				}

				// Determine the scope based on source (project or global)
				const scope = modeToDelete.source || "global"

				// Determine the rules folder path
				let rulesFolderPath: string
				if (scope === "project") {
					const workspacePath = getWorkspacePath()
					if (workspacePath) {
						rulesFolderPath = path.join(workspacePath, ".roo", `rules-${message.slug}`)
					} else {
						rulesFolderPath = path.join(".roo", `rules-${message.slug}`)
					}
				} else {
					// Global scope - use OS home directory
					const homeDir = os.homedir()
					rulesFolderPath = path.join(homeDir, ".roo", `rules-${message.slug}`)
				}

				// Check if the rules folder exists
				const rulesFolderExists = await fileExistsAtPath(rulesFolderPath)

				// If this is a check request, send back the folder info
				if (message.checkOnly) {
					await provider.postMessageToWebview({
						type: "deleteCustomModeCheck",
						slug: message.slug,
						rulesFolderPath: rulesFolderExists ? rulesFolderPath : undefined,
					})
					break
				}

				// Delete the mode
				await provider.customModesManager.deleteCustomMode(message.slug)

				// Delete the rules folder if it exists
				if (rulesFolderExists) {
					try {
						await fs.rm(rulesFolderPath, { recursive: true, force: true })
						provider.log(`Deleted rules folder for mode ${message.slug}: ${rulesFolderPath}`)
					} catch (error) {
						provider.log(`Failed to delete rules folder for mode ${message.slug}: ${error}`)
						// Notify the user about the failure
						vscode.window.showErrorMessage(
							t("common:errors.delete_rules_folder_failed", {
								rulesFolderPath,
								error: error instanceof Error ? error.message : String(error),
							}),
						)
						// Continue with mode deletion even if folder deletion fails
					}
				}

				// Switch back to default mode after deletion
				await updateGlobalState("mode", defaultModeSlug)
				await provider.postStateToWebview()
			}
			break
		case "exportMode":
			if (message.slug) {
				try {
					// Get custom mode prompts to check if built-in mode has been customized
					const customModePrompts = getGlobalState("customModePrompts") || {}
					const customPrompt = customModePrompts[message.slug]

					// Export the mode with any customizations merged directly
					const result = await provider.customModesManager.exportModeWithRules(message.slug, customPrompt)

					if (result.success && result.yaml) {
						// Get last used directory for export
						const lastExportPath = getGlobalState("lastModeExportPath")
						let defaultUri: vscode.Uri

						if (lastExportPath) {
							// Use the directory from the last export
							const lastDir = path.dirname(lastExportPath)
							defaultUri = vscode.Uri.file(path.join(lastDir, `${message.slug}-export.yaml`))
						} else {
							// Default to workspace or home directory
							const workspaceFolders = vscode.workspace.workspaceFolders
							if (workspaceFolders && workspaceFolders.length > 0) {
								defaultUri = vscode.Uri.file(
									path.join(workspaceFolders[0].uri.fsPath, `${message.slug}-export.yaml`),
								)
							} else {
								defaultUri = vscode.Uri.file(`${message.slug}-export.yaml`)
							}
						}

						// Show save dialog
						const saveUri = await vscode.window.showSaveDialog({
							defaultUri,
							filters: {
								"YAML files": ["yaml", "yml"],
							},
							title: "Save mode export",
						})

						if (saveUri && result.yaml) {
							// Save the directory for next time
							await updateGlobalState("lastModeExportPath", saveUri.fsPath)

							// Write the file to the selected location
							await fs.writeFile(saveUri.fsPath, result.yaml, "utf-8")

							// Send success message to webview
							provider.postMessageToWebview({
								type: "exportModeResult",
								success: true,
								slug: message.slug,
							})

							// Show info message
							vscode.window.showInformationMessage(t("common:info.mode_exported", { mode: message.slug }))
						} else {
							// User cancelled the save dialog
							provider.postMessageToWebview({
								type: "exportModeResult",
								success: false,
								error: "Export cancelled",
								slug: message.slug,
							})
						}
					} else {
						// Send error message to webview
						provider.postMessageToWebview({
							type: "exportModeResult",
							success: false,
							error: result.error,
							slug: message.slug,
						})
					}
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error)
					provider.log(`Failed to export mode ${message.slug}: ${errorMessage}`)

					// Send error message to webview
					provider.postMessageToWebview({
						type: "exportModeResult",
						success: false,
						error: errorMessage,
						slug: message.slug,
					})
				}
			}
			break
		case "importMode":
			try {
				// Get last used directory for import
				const lastImportPath = getGlobalState("lastModeImportPath")
				let defaultUri: vscode.Uri | undefined

				if (lastImportPath) {
					// Use the directory from the last import
					const lastDir = path.dirname(lastImportPath)
					defaultUri = vscode.Uri.file(lastDir)
				} else {
					// Default to workspace or home directory
					const workspaceFolders = vscode.workspace.workspaceFolders
					if (workspaceFolders && workspaceFolders.length > 0) {
						defaultUri = vscode.Uri.file(workspaceFolders[0].uri.fsPath)
					}
				}

				// Show file picker to select YAML file
				const fileUri = await vscode.window.showOpenDialog({
					canSelectFiles: true,
					canSelectFolders: false,
					canSelectMany: false,
					defaultUri,
					filters: {
						"YAML files": ["yaml", "yml"],
					},
					title: "Select mode export file to import",
				})

				if (fileUri && fileUri[0]) {
					// Save the directory for next time
					await updateGlobalState("lastModeImportPath", fileUri[0].fsPath)

					// Read the file content
					const yamlContent = await fs.readFile(fileUri[0].fsPath, "utf-8")

					// Import the mode with the specified source level
					const result = await provider.customModesManager.importModeWithRules(
						yamlContent,
						message.source || "project", // Default to project if not specified
					)

					if (result.success) {
						// Update state after importing
						const customModes = await provider.customModesManager.getCustomModes()
						await updateGlobalState("customModes", customModes)
						await provider.postStateToWebview()

						// Send success message to webview
						provider.postMessageToWebview({
							type: "importModeResult",
							success: true,
						})

						// Show success message
						vscode.window.showInformationMessage(t("common:info.mode_imported"))
					} else {
						// Send error message to webview
						provider.postMessageToWebview({
							type: "importModeResult",
							success: false,
							error: result.error,
						})

						// Show error message
						vscode.window.showErrorMessage(t("common:errors.mode_import_failed", { error: result.error }))
					}
				} else {
					// User cancelled the file dialog - reset the importing state
					provider.postMessageToWebview({
						type: "importModeResult",
						success: false,
						error: "cancelled",
					})
				}
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error)
				provider.log(`Failed to import mode: ${errorMessage}`)

				// Send error message to webview
				provider.postMessageToWebview({
					type: "importModeResult",
					success: false,
					error: errorMessage,
				})

				// Show error message
				vscode.window.showErrorMessage(t("common:errors.mode_import_failed", { error: errorMessage }))
			}
			break
		case "checkRulesDirectory":
			if (message.slug) {
				const hasContent = await provider.customModesManager.checkRulesDirectoryHasContent(message.slug)

				provider.postMessageToWebview({
					type: "checkRulesDirectoryResult",
					slug: message.slug,
					hasContent: hasContent,
				})
			}
			break
		case "humanRelayResponse":
			if (message.requestId && message.text) {
				vscode.commands.executeCommand(getCommand("handleHumanRelayResponse"), {
					requestId: message.requestId,
					text: message.text,
					cancelled: false,
				})
			}
			break

		case "humanRelayCancel":
			if (message.requestId) {
				vscode.commands.executeCommand(getCommand("handleHumanRelayResponse"), {
					requestId: message.requestId,
					cancelled: true,
				})
			}
			break

		case "telemetrySetting": {
			const telemetrySetting = message.text as TelemetrySetting
			const previousSetting = getGlobalState("telemetrySetting") || "unset"
			const isOptedIn = telemetrySetting !== "disabled"
			const wasPreviouslyOptedIn = previousSetting !== "disabled"

			// If turning telemetry OFF, fire event BEFORE disabling
			if (wasPreviouslyOptedIn && !isOptedIn && TelemetryService.hasInstance()) {
				TelemetryService.instance.captureTelemetrySettingsChanged(previousSetting, telemetrySetting)
			}
			// Update the telemetry state
			await updateGlobalState("telemetrySetting", telemetrySetting)
			if (TelemetryService.hasInstance()) {
				TelemetryService.instance.updateTelemetryState(isOptedIn)
			}

			// If turning telemetry ON, fire event AFTER enabling
			if (!wasPreviouslyOptedIn && isOptedIn && TelemetryService.hasInstance()) {
				TelemetryService.instance.captureTelemetrySettingsChanged(previousSetting, telemetrySetting)
			}

			await provider.postStateToWebview()
			break
		}
		case "cloudButtonClicked": {
			// Navigate to the cloud tab.
			provider.postMessageToWebview({ type: "action", action: "cloudButtonClicked" })
			break
		}
		case "rooCloudSignIn": {
			try {
				TelemetryService.instance.captureEvent(TelemetryEventName.AUTHENTICATION_INITIATED)
				await CloudService.instance.login()
			} catch (error) {
				provider.log(`AuthService#login failed: ${error}`)
				vscode.window.showErrorMessage("Sign in failed.")
			}

			break
		}
		case "cloudLandingPageSignIn": {
			try {
				const landingPageSlug = message.text || "supernova"
				TelemetryService.instance.captureEvent(TelemetryEventName.AUTHENTICATION_INITIATED)
				await CloudService.instance.login(landingPageSlug)
			} catch (error) {
				provider.log(`CloudService#login failed: ${error}`)
				vscode.window.showErrorMessage("Sign in failed.")
			}
			break
		}
		case "rooCloudSignOut": {
			try {
				await CloudService.instance.logout()
				await provider.postStateToWebview()
				provider.postMessageToWebview({ type: "authenticatedUser", userInfo: undefined })
			} catch (error) {
				provider.log(`AuthService#logout failed: ${error}`)
				vscode.window.showErrorMessage("Sign out failed.")
			}

			break
		}
		case "rooCloudManualUrl": {
			try {
				if (!message.text) {
					vscode.window.showErrorMessage(t("common:errors.manual_url_empty"))
					break
				}

				// Parse the callback URL to extract parameters
				const callbackUrl = message.text.trim()
				const uri = vscode.Uri.parse(callbackUrl)

				if (!uri.query) {
					throw new Error(t("common:errors.manual_url_no_query"))
				}

				const query = new URLSearchParams(uri.query)
				const code = query.get("code")
				const state = query.get("state")
				const organizationId = query.get("organizationId")

				if (!code || !state) {
					throw new Error(t("common:errors.manual_url_missing_params"))
				}

				// Reuse the existing authentication flow
				await CloudService.instance.handleAuthCallback(
					code,
					state,
					organizationId === "null" ? null : organizationId,
				)

				await provider.postStateToWebview()
			} catch (error) {
				provider.log(`ManualUrl#handleAuthCallback failed: ${error}`)
				const errorMessage = error instanceof Error ? error.message : t("common:errors.manual_url_auth_failed")

				// Show error message through VS Code UI
				vscode.window.showErrorMessage(`${t("common:errors.manual_url_auth_error")}: ${errorMessage}`)
			}

			break
		}
		case "switchOrganization": {
			try {
				const organizationId = message.organizationId ?? null

				// Switch to the new organization context
				await CloudService.instance.switchOrganization(organizationId)

				// Refresh the state to update UI
				await provider.postStateToWebview()

				// Send success response back to webview
				await provider.postMessageToWebview({
					type: "organizationSwitchResult",
					success: true,
					organizationId: organizationId,
				})
			} catch (error) {
				provider.log(`Organization switch failed: ${error}`)
				const errorMessage = error instanceof Error ? error.message : String(error)

				// Send error response back to webview
				await provider.postMessageToWebview({
					type: "organizationSwitchResult",
					success: false,
					error: errorMessage,
					organizationId: message.organizationId ?? null,
				})

				vscode.window.showErrorMessage(`Failed to switch organization: ${errorMessage}`)
			}
			break
		}

		case "saveCodeIndexSettingsAtomic": {
			if (!message.codeIndexSettings) {
				break
			}

			const settings = message.codeIndexSettings

			try {
				// Check if embedder provider has changed
				const currentConfig = getGlobalState("codebaseIndexConfig") || {}
				const embedderProviderChanged =
					currentConfig.codebaseIndexEmbedderProvider !== settings.codebaseIndexEmbedderProvider

				// Save global state settings atomically
				const globalStateConfig = {
					...currentConfig,
					codebaseIndexEnabled: settings.codebaseIndexEnabled,
					codebaseIndexQdrantUrl: settings.codebaseIndexQdrantUrl,
					codebaseIndexEmbedderProvider: settings.codebaseIndexEmbedderProvider,
					codebaseIndexEmbedderBaseUrl: settings.codebaseIndexEmbedderBaseUrl,
					codebaseIndexEmbedderModelId: settings.codebaseIndexEmbedderModelId,
					codebaseIndexEmbedderModelDimension: settings.codebaseIndexEmbedderModelDimension, // Generic dimension
					codebaseIndexOpenAiCompatibleBaseUrl: settings.codebaseIndexOpenAiCompatibleBaseUrl,
					codebaseIndexSearchMaxResults: settings.codebaseIndexSearchMaxResults,
					codebaseIndexSearchMinScore: settings.codebaseIndexSearchMinScore,
				}

				// Save global state first
				await updateGlobalState("codebaseIndexConfig", globalStateConfig)

				// Save secrets directly using context proxy
				if (settings.codeIndexOpenAiKey !== undefined) {
					await provider.contextProxy.storeSecret("codeIndexOpenAiKey", settings.codeIndexOpenAiKey)
				}
				if (settings.codeIndexQdrantApiKey !== undefined) {
					await provider.contextProxy.storeSecret("codeIndexQdrantApiKey", settings.codeIndexQdrantApiKey)
				}
				if (settings.codebaseIndexOpenAiCompatibleApiKey !== undefined) {
					await provider.contextProxy.storeSecret(
						"codebaseIndexOpenAiCompatibleApiKey",
						settings.codebaseIndexOpenAiCompatibleApiKey,
					)
				}
				if (settings.codebaseIndexGeminiApiKey !== undefined) {
					await provider.contextProxy.storeSecret(
						"codebaseIndexGeminiApiKey",
						settings.codebaseIndexGeminiApiKey,
					)
				}
				if (settings.codebaseIndexMistralApiKey !== undefined) {
					await provider.contextProxy.storeSecret(
						"codebaseIndexMistralApiKey",
						settings.codebaseIndexMistralApiKey,
					)
				}
				if (settings.codebaseIndexVercelAiGatewayApiKey !== undefined) {
					await provider.contextProxy.storeSecret(
						"codebaseIndexVercelAiGatewayApiKey",
						settings.codebaseIndexVercelAiGatewayApiKey,
					)
				}

				// Send success response first - settings are saved regardless of validation
				await provider.postMessageToWebview({
					type: "codeIndexSettingsSaved",
					success: true,
					settings: globalStateConfig,
				})

				// Update webview state
				await provider.postStateToWebview()

				// Then handle validation and initialization for the current workspace
				const currentCodeIndexManager = provider.getCurrentWorkspaceCodeIndexManager()
				if (currentCodeIndexManager) {
					// If embedder provider changed, perform proactive validation
					if (embedderProviderChanged) {
						try {
							// Force handleSettingsChange which will trigger validation
							await currentCodeIndexManager.handleSettingsChange()
						} catch (error) {
							// Validation failed - the error state is already set by handleSettingsChange
							provider.log(
								`Embedder validation failed after provider change: ${error instanceof Error ? error.message : String(error)}`,
							)
							// Send validation error to webview
							await provider.postMessageToWebview({
								type: "indexingStatusUpdate",
								values: currentCodeIndexManager.getCurrentStatus(),
							})
							// Exit early - don't try to start indexing with invalid configuration
							break
						}
					} else {
						// No provider change, just handle settings normally
						try {
							await currentCodeIndexManager.handleSettingsChange()
						} catch (error) {
							// Log but don't fail - settings are saved
							provider.log(
								`Settings change handling error: ${error instanceof Error ? error.message : String(error)}`,
							)
						}
					}

					// Wait a bit more to ensure everything is ready
					await new Promise((resolve) => setTimeout(resolve, 200))

					// Auto-start indexing if now enabled and configured
					if (currentCodeIndexManager.isFeatureEnabled && currentCodeIndexManager.isFeatureConfigured) {
						if (!currentCodeIndexManager.isInitialized) {
							try {
								await currentCodeIndexManager.initialize(provider.contextProxy)
								provider.log(`Code index manager initialized after settings save`)
							} catch (error) {
								provider.log(
									`Code index initialization failed: ${error instanceof Error ? error.message : String(error)}`,
								)
								// Send error status to webview
								await provider.postMessageToWebview({
									type: "indexingStatusUpdate",
									values: currentCodeIndexManager.getCurrentStatus(),
								})
							}
						}
					}
				} else {
					// No workspace open - send error status
					provider.log("Cannot save code index settings: No workspace folder open")
					await provider.postMessageToWebview({
						type: "indexingStatusUpdate",
						values: {
							systemStatus: "Error",
							message: t("embeddings:orchestrator.indexingRequiresWorkspace"),
							processedItems: 0,
							totalItems: 0,
							currentItemUnit: "items",
						},
					})
				}
			} catch (error) {
				provider.log(`Error saving code index settings: ${error.message || error}`)
				await provider.postMessageToWebview({
					type: "codeIndexSettingsSaved",
					success: false,
					error: error.message || "Failed to save settings",
				})
			}
			break
		}

		case "requestIndexingStatus": {
			const manager = provider.getCurrentWorkspaceCodeIndexManager()
			if (!manager) {
				// No workspace open - send error status
				provider.postMessageToWebview({
					type: "indexingStatusUpdate",
					values: {
						systemStatus: "Error",
						message: t("embeddings:orchestrator.indexingRequiresWorkspace"),
						processedItems: 0,
						totalItems: 0,
						currentItemUnit: "items",
						workerspacePath: undefined,
					},
				})
				return
			}

			const status = manager
				? manager.getCurrentStatus()
				: {
						systemStatus: "Standby",
						message: "No workspace folder open",
						processedItems: 0,
						totalItems: 0,
						currentItemUnit: "items",
						workspacePath: undefined,
					}

			provider.postMessageToWebview({
				type: "indexingStatusUpdate",
				values: status,
			})
			break
		}
		case "requestCodeIndexSecretStatus": {
			// Check if secrets are set using the VSCode context directly for async access
			const hasOpenAiKey = !!(await provider.context.secrets.get("codeIndexOpenAiKey"))
			const hasQdrantApiKey = !!(await provider.context.secrets.get("codeIndexQdrantApiKey"))
			const hasOpenAiCompatibleApiKey = !!(await provider.context.secrets.get(
				"codebaseIndexOpenAiCompatibleApiKey",
			))
			const hasGeminiApiKey = !!(await provider.context.secrets.get("codebaseIndexGeminiApiKey"))
			const hasMistralApiKey = !!(await provider.context.secrets.get("codebaseIndexMistralApiKey"))
			const hasVercelAiGatewayApiKey = !!(await provider.context.secrets.get(
				"codebaseIndexVercelAiGatewayApiKey",
			))

			provider.postMessageToWebview({
				type: "codeIndexSecretStatus",
				values: {
					hasOpenAiKey,
					hasQdrantApiKey,
					hasOpenAiCompatibleApiKey,
					hasGeminiApiKey,
					hasMistralApiKey,
					hasVercelAiGatewayApiKey,
				},
			})
			break
		}
		case "startIndexing": {
			try {
				const manager = provider.getCurrentWorkspaceCodeIndexManager()
				if (!manager) {
					// No workspace open - send error status
					provider.postMessageToWebview({
						type: "indexingStatusUpdate",
						values: {
							systemStatus: "Error",
							message: t("embeddings:orchestrator.indexingRequiresWorkspace"),
							processedItems: 0,
							totalItems: 0,
							currentItemUnit: "items",
						},
					})
					provider.log("Cannot start indexing: No workspace folder open")
					return
				}
				if (manager.isFeatureEnabled && manager.isFeatureConfigured) {
					if (!manager.isInitialized) {
						await manager.initialize(provider.contextProxy)
					}

					// startIndexing now handles error recovery internally
					manager.startIndexing()

					// If startIndexing recovered from error, we need to reinitialize
					if (!manager.isInitialized) {
						await manager.initialize(provider.contextProxy)
						// Try starting again after initialization
						manager.startIndexing()
					}
				}
			} catch (error) {
				provider.log(`Error starting indexing: ${error instanceof Error ? error.message : String(error)}`)
			}
			break
		}
		case "loadTsProfiles": {
			try {
				provider.log("[TSProfile] Loading all TSProfiles...")
				const extendedService = await getExtendedTSProfileService(provider.context)
				const profiles = await extendedService.loadAllTsProfiles()
				provider.log(`[TSProfile] Loaded ${profiles.length} profiles (global+workspace)`)
				provider.postMessageToWebview({
					type: "tsProfilesLoaded",
					tsProfiles: profiles,
				})
			} catch (error) {
				provider.log(`Error loading TSProfiles: ${error}`)
				vscode.window.showErrorMessage(`Failed to load TSProfiles: ${error}`)
			}
			break
		}
		case "browseTsProfile": {
			try {
				const isGlobal = message.isGlobal || false
				const scopeInfo = isGlobal ? "global" : "workspace"
				provider.log(`[TSProfile] Browsing for TSProfile file (${scopeInfo})...`)
				const extendedService = await getExtendedTSProfileService(provider.context)
				const filePath = await extendedService.browseTsProfile(isGlobal)

				if (filePath) {
					provider.log(`[TSProfile] Selected file: ${filePath}`)
					provider.postMessageToWebview({
						type: "tsProfileFileSelected",
						tsProfileFilePath: filePath,
					})
				}
			} catch (error) {
				provider.log(`Error browsing TSProfile: ${error}`)
				vscode.window.showErrorMessage(`Failed to browse TSProfile: ${error}`)
			}
			break
		}
		case "copyTsProfile": {
			try {
				if (!message.sourceProfile || !message.targetScope) {
					throw new Error("Source profile and target scope are required")
				}

				provider.log(`[TSProfile] Copying profile "${message.sourceProfile.name}" to ${message.targetScope}...`)
				const extendedService = await getExtendedTSProfileService(provider.context)
				const success = await extendedService.copyProfile(message.sourceProfile, message.targetScope === "global")

				if (success) {
					// 刷新列表
					const profiles = await extendedService.loadAllTsProfiles()
					provider.postMessageToWebview({
						type: "tsProfilesLoaded",
						tsProfiles: profiles,
					})

					const location = message.targetScope === "global" ? "全局" : "工作区"
					vscode.window.showInformationMessage(`Profile 已成功复制到${location}`)
				} else {
					throw new Error("复制失败")
				}
			} catch (error) {
				provider.log(`Error copying TSProfile: ${error}`)
				vscode.window.showErrorMessage(`复制 Profile 失败: ${error}`)
			}
			break
		}
		case "deleteTsProfile": {
			try {
				if (!message.profile) {
					throw new Error("Profile is required for deletion")
				}

				provider.log(`[TSProfile] Deleting profile "${message.profile.name}"...`)
				const extendedService = await getExtendedTSProfileService(provider.context)
				const success = await extendedService.deleteProfile(message.profile)

				if (success) {
					// 刷新列表
					const profiles = await extendedService.loadAllTsProfiles()
					provider.postMessageToWebview({
						type: "tsProfilesLoaded",
						tsProfiles: profiles,
					})

					vscode.window.showInformationMessage(`Profile "${message.profile.name}" 已删除`)
				} else {
					throw new Error("删除失败")
				}
			} catch (error) {
				provider.log(`Error deleting TSProfile: ${error}`)
				vscode.window.showErrorMessage(`删除 Profile 失败: ${error}`)
			}
			break
		}
		case "deleteTsProfileMixin": {
			try {
				if (!message.mixinPath) {
					throw new Error("Mixin path is required for deletion")
				}

				provider.log(`[TSProfile] Deleting mixin file "${message.mixinPath}"...`)
				const extendedService = await getExtendedTSProfileService(provider.context)
				const success = await extendedService.deleteMixinFile(message.mixinPath)

				if (success) {
					vscode.window.showInformationMessage(`Mixin文件已删除`)

					// 如果有当前选中的profile，重新加载其mixin状态
					const state = await provider.getState()
					if (state.currentTsProfile?.profilePath && state.currentTsProfile.profileName) {
						const profileName = state.currentTsProfile.profileName
						await loadProfileMixin(provider, profileName)
					}
				} else {
					throw new Error("删除Mixin文件失败")
				}
			} catch (error) {
				provider.log(`Error deleting TSProfile mixin: ${error}`)
				vscode.window.showErrorMessage(`删除Mixin文件失败: ${error}`)
			}
			break
		}
		case "toggleAIOutputDisplayMode": {
			try {
				// 获取当前活动的task
				const activeTask = provider.getCurrentTask()
				if (!activeTask) {
					throw new Error("没有活动的任务可以切换显示模式")
				}

				provider.log(`[Task] Toggling AI output display mode...`)
				const result = activeTask.toggleAIOutputDisplayMode()

				// 通知前端显示模式已切换
				provider.postMessageToWebview({
					type: "aiOutputDisplayModeToggled",
					displayMode: result.mode,
					message: `已切换到${result.mode === 'original' ? '原始' : '处理后'}AI输出显示模式`
				})

				provider.log(`[Task] AI output display mode toggled to: ${result.mode}`)
			} catch (error) {
				provider.log(`Error toggling AI output display mode: ${error}`)
				vscode.window.showErrorMessage(`切换AI输出显示模式失败: ${error}`)
			}
			break
		}
		case "validateTsProfile": {
			try {
				if (!message.tsProfilePath) {
					throw new Error("Path is required for validating TSProfile")
				}
				const result = await validateTsProfile(message.tsProfilePath)
				provider.postMessageToWebview({
					type: "tsProfileValidated",
					tsProfileSuccess: result.success,
					tsProfileName: result.profileName,
					tsProfilePromptsCount: result.promptsCount,
					tsProfileError: result.error,
					tsProfilePath: result.path,
				})
			} catch (error) {
				provider.log(`Error validating TSProfile: ${error}`)
				provider.postMessageToWebview({
					type: "tsProfileValidated",
					success: false,
					error: error instanceof Error ? error.message : String(error),
				})
			}
			break
		}
		case "browseTsProfile": {
			try {
				const filePath = await browseTsProfile()
				if (filePath) {
					provider.postMessageToWebview({
						type: "tsProfileSelected",
						tsProfilePath: filePath,
					})
				}
			} catch (error) {
				provider.log(`Error browsing TSProfile: ${error}`)
				vscode.window.showErrorMessage(`Failed to browse TSProfile: ${error}`)
			}
			break
		}
		case "enableTSProfile": {
			// 已废弃：现在由 saveTSProfileChanges 处理
			// 保留此代码以防有其他地方仍在使用
			if (message.tsProfileName) {
				provider.log("[TSProfile] Warning: enableTSProfile is deprecated, use saveTSProfileChanges instead")
				// 暂时仍然处理此消息以确保兼容性
				const currentProfiles = (provider.contextProxy.getValue("enabledTSProfiles") as string[]) || []
				const newProfiles = [...currentProfiles, message.tsProfileName].filter(
					(name, index, arr) => arr.indexOf(name) === index,
				)
				await updateGlobalState("enabledTSProfiles", newProfiles)
				await provider.postStateToWebview()
			}
			break
		}
		case "disableTSProfile": {
			// 已废弃：现在由 saveTSProfileChanges 处理
			// 保留此代码以防有其他地方仍在使用
			provider.log("[TSProfile] Warning: disableTSProfile is deprecated, use saveTSProfileChanges instead")
			const currentProfiles = (provider.contextProxy.getValue("enabledTSProfiles") as string[]) || []
			if (message.tsProfileName) {
				// 禁用特定的TSProfile
				const newProfiles = currentProfiles.filter((name) => name !== message.tsProfileName)
				await updateGlobalState("enabledTSProfiles", newProfiles)
			} else {
				// 禁用所有TSProfiles
				await updateGlobalState("enabledTSProfiles", [])
			}
			await provider.postStateToWebview()
			break
		}
		case "anhTsProfileAutoInject": {
			// 已废弃：现在由 saveTSProfileChanges 处理
			// 保留此代码以防有其他地方仍在使用
			provider.log("[TSProfile] Warning: anhTsProfileAutoInject is deprecated, use saveTSProfileChanges instead")
			await updateGlobalState("anhTsProfileAutoInject", message.bool ?? true)
			await provider.postStateToWebview()
			break
		}
		case "anhTsProfileVariables": {
			// 已废弃：现在由 saveTSProfileChanges 处理
			// 保留此代码以防有其他地方仍在使用
			provider.log("[TSProfile] Warning: anhTsProfileVariables is deprecated, use saveTSProfileChanges instead")
			await updateGlobalState("anhTsProfileVariables", message.values ?? {})
			await provider.postStateToWebview()
			break
		}
		case "clearIndexData": {
			try {
				const manager = provider.getCurrentWorkspaceCodeIndexManager()
				if (!manager) {
					provider.log("Cannot clear index data: No workspace folder open")
					provider.postMessageToWebview({
						type: "indexCleared",
						values: {
							success: false,
							error: t("embeddings:orchestrator.indexingRequiresWorkspace"),
						},
					})
					return
				}
				await manager.clearIndexData()
				provider.postMessageToWebview({ type: "indexCleared", values: { success: true } })
			} catch (error) {
				provider.log(`Error clearing index data: ${error instanceof Error ? error.message : String(error)}`)
				provider.postMessageToWebview({
					type: "indexCleared",
					values: {
						success: false,
						error: error instanceof Error ? error.message : String(error),
					},
				})
			}
			break
		}
		case "focusPanelRequest": {
			// Execute the focusPanel command to focus the WebView
			await vscode.commands.executeCommand(getCommand("focusPanel"))
			break
		}
		case "filterMarketplaceItems": {
			if (marketplaceManager && message.filters) {
				try {
					await marketplaceManager.updateWithFilteredItems({
						type: message.filters.type as MarketplaceItemType | undefined,
						search: message.filters.search,
						tags: message.filters.tags,
					})
					await provider.postStateToWebview()
				} catch (error) {
					console.error("Marketplace: Error filtering items:", error)
					vscode.window.showErrorMessage("Failed to filter marketplace items")
				}
			}
			break
		}

		case "fetchMarketplaceData": {
			// Fetch marketplace data on demand
			await provider.fetchMarketplaceData()
			break
		}

		case "installMarketplaceItem": {
			if (marketplaceManager && message.mpItem && message.mpInstallOptions) {
				try {
					const configFilePath = await marketplaceManager.installMarketplaceItem(
						message.mpItem,
						message.mpInstallOptions,
					)
					await provider.postStateToWebview()
					console.log(`Marketplace item installed and config file opened: ${configFilePath}`)

					// Send success message to webview
					provider.postMessageToWebview({
						type: "marketplaceInstallResult",
						success: true,
						slug: message.mpItem.id,
					})
				} catch (error) {
					console.error(`Error installing marketplace item: ${error}`)
					// Send error message to webview
					provider.postMessageToWebview({
						type: "marketplaceInstallResult",
						success: false,
						error: error instanceof Error ? error.message : String(error),
						slug: message.mpItem.id,
					})
				}
			}
			break
		}

		case "removeInstalledMarketplaceItem": {
			if (marketplaceManager && message.mpItem && message.mpInstallOptions) {
				try {
					await marketplaceManager.removeInstalledMarketplaceItem(message.mpItem, message.mpInstallOptions)
					await provider.postStateToWebview()

					// Send success message to webview
					provider.postMessageToWebview({
						type: "marketplaceRemoveResult",
						success: true,
						slug: message.mpItem.id,
					})
				} catch (error) {
					console.error(`Error removing marketplace item: ${error}`)

					// Show error message to user
					vscode.window.showErrorMessage(
						`Failed to remove marketplace item: ${error instanceof Error ? error.message : String(error)}`,
					)

					// Send error message to webview
					provider.postMessageToWebview({
						type: "marketplaceRemoveResult",
						success: false,
						error: error instanceof Error ? error.message : String(error),
						slug: message.mpItem.id,
					})
				}
			} else {
				// MarketplaceManager not available or missing required parameters
				const errorMessage = !marketplaceManager
					? "Marketplace manager is not available"
					: "Missing required parameters for marketplace item removal"
				console.error(errorMessage)

				vscode.window.showErrorMessage(errorMessage)

				if (message.mpItem?.id) {
					provider.postMessageToWebview({
						type: "marketplaceRemoveResult",
						success: false,
						error: errorMessage,
						slug: message.mpItem.id,
					})
				}
			}
			break
		}

		case "installMarketplaceItemWithParameters": {
			if (marketplaceManager && message.payload && "item" in message.payload && "parameters" in message.payload) {
				try {
					const configFilePath = await marketplaceManager.installMarketplaceItem(message.payload.item, {
						parameters: message.payload.parameters,
					})
					await provider.postStateToWebview()
					console.log(`Marketplace item with parameters installed and config file opened: ${configFilePath}`)
				} catch (error) {
					console.error(`Error installing marketplace item with parameters: ${error}`)
					vscode.window.showErrorMessage(
						`Failed to install marketplace item: ${error instanceof Error ? error.message : String(error)}`,
					)
				}
			}
			break
		}

		case "switchTab": {
			if (message.tab) {
				// Capture tab shown event for all switchTab messages (which are user-initiated)
				if (TelemetryService.hasInstance()) {
					TelemetryService.instance.captureTabShown(message.tab)
				}

				await provider.postMessageToWebview({
					type: "action",
					action: "switchTab",
					tab: message.tab,
					values: message.values,
				})
			}
			break
		}
		case "requestCommands": {
			try {
				const { getCommands } = await import("../../services/command/commands")
				const commands = await getCommands(getCurrentCwd())

				// Convert to the format expected by the frontend
				const commandList = commands.map((command) => ({
					name: command.name,
					source: command.source,
					filePath: command.filePath,
					description: command.description,
					argumentHint: command.argumentHint,
				}))

				await provider.postMessageToWebview({
					type: "commands",
					commands: commandList,
				})
			} catch (error) {
				provider.log(`Error fetching commands: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`)
				// Send empty array on error
				await provider.postMessageToWebview({
					type: "commands",
					commands: [],
				})
			}
			break
		}
		case "openCommandFile": {
			try {
				if (message.text) {
					const { getCommand } = await import("../../services/command/commands")
					const command = await getCommand(getCurrentCwd(), message.text)

					if (command && command.filePath) {
						openFile(command.filePath)
					} else {
						vscode.window.showErrorMessage(t("common:errors.command_not_found", { name: message.text }))
					}
				}
			} catch (error) {
				provider.log(
					`Error opening command file: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
				)
				vscode.window.showErrorMessage(t("common:errors.open_command_file"))
			}
			break
		}
		case "deleteCommand": {
			try {
				if (message.text && message.values?.source) {
					const { getCommand } = await import("../../services/command/commands")
					const command = await getCommand(getCurrentCwd(), message.text)

					if (command && command.filePath) {
						// Delete the command file
						await fs.unlink(command.filePath)
						provider.log(`Deleted command file: ${command.filePath}`)
					} else {
						vscode.window.showErrorMessage(t("common:errors.command_not_found", { name: message.text }))
					}
				}
			} catch (error) {
				provider.log(`Error deleting command: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`)
				vscode.window.showErrorMessage(t("common:errors.delete_command"))
			}
			break
		}
		case "createCommand": {
			try {
				const source = message.values?.source as "global" | "project"
				const fileName = message.text // Custom filename from user input

				if (!source) {
					provider.log("Missing source for createCommand")
					break
				}

				// Determine the commands directory based on source
				let commandsDir: string
				if (source === "global") {
					const globalConfigDir = path.join(os.homedir(), ".roo")
					commandsDir = path.join(globalConfigDir, "commands")
				} else {
					if (!vscode.workspace.workspaceFolders?.length) {
						vscode.window.showErrorMessage(t("common:errors.no_workspace"))
						return
					}
					// Project commands
					const workspaceRoot = getCurrentCwd()
					if (!workspaceRoot) {
						vscode.window.showErrorMessage(t("common:errors.no_workspace_for_project_command"))
						break
					}
					commandsDir = path.join(workspaceRoot, ".roo", "commands")
				}

				// Ensure the commands directory exists
				await fs.mkdir(commandsDir, { recursive: true })

				// Use provided filename or generate a unique one
				let commandName: string
				if (fileName && fileName.trim()) {
					let cleanFileName = fileName.trim()

					// Strip leading slash if present
					if (cleanFileName.startsWith("/")) {
						cleanFileName = cleanFileName.substring(1)
					}

					// Remove .md extension if present BEFORE slugification
					if (cleanFileName.toLowerCase().endsWith(".md")) {
						cleanFileName = cleanFileName.slice(0, -3)
					}

					// Slugify the command name: lowercase, replace spaces with dashes, remove special characters
					commandName = cleanFileName
						.toLowerCase()
						.replace(/\s+/g, "-") // Replace spaces with dashes
						.replace(/[^a-z0-9-]/g, "") // Remove special characters except dashes
						.replace(/-+/g, "-") // Replace multiple dashes with single dash
						.replace(/^-|-$/g, "") // Remove leading/trailing dashes

					// Ensure we have a valid command name
					if (!commandName || commandName.length === 0) {
						commandName = "new-command"
					}
				} else {
					// Generate a unique command name
					commandName = "new-command"
					let counter = 1
					let filePath = path.join(commandsDir, `${commandName}.md`)

					while (
						await fs
							.access(filePath)
							.then(() => true)
							.catch(() => false)
					) {
						commandName = `new-command-${counter}`
						filePath = path.join(commandsDir, `${commandName}.md`)
						counter++
					}
				}

				const filePath = path.join(commandsDir, `${commandName}.md`)

				// Check if file already exists
				if (
					await fs
						.access(filePath)
						.then(() => true)
						.catch(() => false)
				) {
					vscode.window.showErrorMessage(t("common:errors.command_already_exists", { commandName }))
					break
				}

				// Create the command file with template content
				const templateContent = t("common:errors.command_template_content")

				await fs.writeFile(filePath, templateContent, "utf8")
				provider.log(`Created new command file: ${filePath}`)

				// Open the new file in the editor
				openFile(filePath)

				// Refresh commands list
				const { getCommands } = await import("../../services/command/commands")
				const commands = await getCommands(getCurrentCwd() || "")
				const commandList = commands.map((command) => ({
					name: command.name,
					source: command.source,
					filePath: command.filePath,
					description: command.description,
					argumentHint: command.argumentHint,
				}))
				await provider.postMessageToWebview({
					type: "commands",
					commands: commandList,
				})
			} catch (error) {
				provider.log(`Error creating command: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`)
				vscode.window.showErrorMessage(t("common:errors.create_command_failed"))
			}
			break
		}

		case "insertTextIntoTextarea": {
			const text = message.text
			if (text) {
				// Send message to insert text into the chat textarea
				await provider.postMessageToWebview({
					type: "insertTextIntoTextarea",
					text: text,
				})
			}
			break
		}
		case "showMdmAuthRequiredNotification": {
			// Show notification that organization requires authentication
			vscode.window.showWarningMessage(t("common:mdm.info.organization_requires_auth"))
			break
		}

		/**
		 * Chat Message Queue
		 */

		case "queueMessage": {
			provider.getCurrentTask()?.messageQueueService.addMessage(message.text ?? "", message.images)
			break
		}
		case "removeQueuedMessage": {
			provider.getCurrentTask()?.messageQueueService.removeMessage(message.text ?? "")
			break
		}
		case "editQueuedMessage": {
			if (message.payload) {
				const { id, text, images } = message.payload as EditQueuedMessagePayload
				provider.getCurrentTask()?.messageQueueService.updateMessage(id, text, images)
			}

			break
		}
		case "dismissUpsell": {
			if (message.upsellId) {
				try {
					// Get current list of dismissed upsells
					const dismissedUpsells = getGlobalState("dismissedUpsells") || []

					// Add the new upsell ID if not already present
					let updatedList = dismissedUpsells
					if (!dismissedUpsells.includes(message.upsellId)) {
						updatedList = [...dismissedUpsells, message.upsellId]
						await updateGlobalState("dismissedUpsells", updatedList)
					}

					// Send updated list back to webview (use the already computed updatedList)
					await provider.postMessageToWebview({
						type: "dismissedUpsells",
						list: updatedList,
					})
				} catch (error) {
					// Fail silently as per Bruno's comment - it's OK to fail silently in this case
					provider.log(`Failed to dismiss upsell: ${error instanceof Error ? error.message : String(error)}`)
				}
			}
			break
		}
		case "getDismissedUpsells": {
			// Send the current list of dismissed upsells to the webview
			const dismissedUpsells = getGlobalState("dismissedUpsells") || []
			await provider.postMessageToWebview({
				type: "dismissedUpsells",
				list: dismissedUpsells,
			})
			break
		}
		case "getAnhRoles": {
			try {
				const { RoleRegistry } = await import("../../services/anh-chat")
				const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
				if (!workspaceRoot) {
					throw new Error("No workspace folder found")
				}
				const registry = await RoleRegistry.create(workspaceRoot)
				const roles = registry.listSummaries()
				await provider.postMessageToWebview({
					type: "anhRolesLoaded",
					roles: roles,
				})
			} catch (error) {
				provider.log(`Error loading ANH roles: ${error instanceof Error ? error.message : String(error)}`)
				await provider.postMessageToWebview({
					type: "anhRolesLoaded",
					roles: [],
				})
			}
			break
		}

		case "getGlobalAnhRoles": {
			try {
				const globalService = await getGlobalStorageService(provider.context)
				const globalRoleSummaries = await globalService.getGlobalRoleSummaries()
				await provider.postMessageToWebview({
					type: "anhGlobalRolesLoaded",
					globalRoles: globalRoleSummaries,
				})
			} catch (error) {
				provider.log(`Error loading global ANH roles: ${error instanceof Error ? error.message : String(error)}`)
				await provider.postMessageToWebview({
					type: "anhGlobalRolesLoaded",
					globalRoles: [],
				})
			}
			break
		}
		case "loadAnhRole": {
			try {
				const targetUuid = message.roleUuid ?? DEFAULT_ASSISTANT_ROLE_UUID
				const targetScope = message.scope // 获取scope参数
				const { RoleRegistry } = await import("../../services/anh-chat")
				const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
				if (!workspaceRoot) {
					throw new Error("No workspace folder found")
				}
				
				let role: Role | undefined

				// 根据scope参数决定加载策略
				if (targetScope === "global") {
					// 只从全局存储加载
					try {
						const globalService = await getGlobalStorageService(provider.context)
						role = await globalService.getGlobalRole(targetUuid)
						if (role) {
							provider.log(`Global ANH role loaded: ${role.name}`)
						}
					} catch (globalError) {
						provider.log(`Error loading global role: ${globalError instanceof Error ? globalError.message : String(globalError)}`)
					}
				} else if (targetScope === "workspace") {
					// 只从工作区加载
					const registry = await RoleRegistry.create(workspaceRoot)
					role = await registry.loadRole(targetUuid)
				} else {
					// 默认行为：先尝试工作区，再尝试全局
					const registry = await RoleRegistry.create(workspaceRoot)
					role = await registry.loadRole(targetUuid)

					// If not found in workspace, try to load from global storage
					if (!role && targetUuid !== DEFAULT_ASSISTANT_ROLE_UUID) {
						try {
							const globalService = await getGlobalStorageService(provider.context)
							role = await globalService.getGlobalRole(targetUuid)
							if (role) {
								provider.log(`Global ANH role loaded: ${role.name}`)
							}
						} catch (globalError) {
							provider.log(`Error loading global role: ${globalError instanceof Error ? globalError.message : String(globalError)}`)
						}
					}
				}

				if (!role && targetUuid === DEFAULT_ASSISTANT_ROLE_UUID) {
					role = JSON.parse(JSON.stringify(DEFAULT_ASSISTANT_ROLE)) as Role
				}

				if (role) {
					provider.log(`ANH role loaded successfully: ${role.name}`)
					provider.log(`Role has profile: ${!!role.profile}`)

					if (targetUuid !== DEFAULT_ASSISTANT_ROLE_UUID) {
						try {
							const { StorylineRepository } = await import("../../services/anh-chat")
							const storylineRepo = await StorylineRepository.create(workspaceRoot)
							const storyline = await storylineRepo.getStoryline(role.uuid)
							if (storyline) {
								provider.log(`Timeline loaded: ${storyline.arcs.length} arcs`)
								;(role as any).timeline = storyline
							} else {
								provider.log("No timeline file found")
							}
						} catch (timelineError) {
							provider.log(
								`Error loading timeline: ${timelineError instanceof Error ? timelineError.message : String(timelineError)}`,
							)
						}
					}

					await provider.setCurrentAnhRole(role)
					await provider.postMessageToWebview({
						type: "anhRoleLoaded",
						role,
					})
				} else {
					provider.log(`ANH role not found: ${targetUuid}`)
					await provider.postMessageToWebview({
						type: "anhRoleLoaded",
						role: undefined,
					})
				}
			} catch (error) {
				provider.log(`Error loading ANH role: ${error instanceof Error ? error.message : String(error)}`)
				await provider.postMessageToWebview({
					type: "anhRoleLoaded",
					role: undefined,
				})
			}
			break
		}
		case "selectAnhRole": {
			try {
				const incomingRole = message.role as Role | undefined
				const resolvedRole = incomingRole ?? (JSON.parse(JSON.stringify(DEFAULT_ASSISTANT_ROLE)) as Role)

				await provider.setCurrentAnhRole(resolvedRole)

				if (resolvedRole.uuid === DEFAULT_ASSISTANT_ROLE_UUID) {
					provider.log("ANH default assistant selected")
				} else {
					provider.log(`ANH role selected: ${resolvedRole.name} (${resolvedRole.uuid})`)
				}
			} catch (error) {
				provider.log(`Error selecting ANH role: ${error instanceof Error ? error.message : String(error)}`)
			}
			break
		}
		case "loadUserAvatarRole": {
			try {
				const targetUuid = message.roleUuid ?? DEFAULT_ASSISTANT_ROLE_UUID
				const targetScope = message.scope // 获取scope参数
				
				if (targetUuid === DEFAULT_ASSISTANT_ROLE_UUID) {
					await provider.postMessageToWebview({
						type: "userAvatarRoleLoaded",
						role: JSON.parse(JSON.stringify(DEFAULT_ASSISTANT_ROLE)) as Role,
					})
					break
				}

				let role: Role | undefined

				// 根据scope参数决定从哪里加载角色
				if (targetScope === "workspace") {
					// 只从workspace加载
					try {
						const { RoleRegistry } = await import("../../services/anh-chat")
						const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
						if (workspaceRoot) {
							const registry = await RoleRegistry.create(workspaceRoot)
							role = await registry.loadRole(targetUuid)
							if (role) {
								provider.log(`User Avatar role loaded from workspace: ${role.name}`)
							}
						}
					} catch (error) {
						provider.log(`Error loading User Avatar role from workspace: ${error instanceof Error ? error.message : String(error)}`)
					}
				} else if (targetScope === "global") {
					// 只从global storage加载
					try {
						const globalService = await getGlobalStorageService(provider.context)
						role = await globalService.getGlobalRole(targetUuid)
						if (role) {
							provider.log(`User Avatar role loaded from global storage: ${role.name}`)
						}
					} catch (error) {
						provider.log(`Error loading User Avatar role from global storage: ${error instanceof Error ? error.message : String(error)}`)
					}
				} else {
					// 如果没有指定scope，按原来的逻辑：先workspace后global
					// First try to load from workspace
					try {
						const { RoleRegistry } = await import("../../services/anh-chat")
						const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
						if (workspaceRoot) {
							const registry = await RoleRegistry.create(workspaceRoot)
							role = await registry.loadRole(targetUuid)
							if (role) {
								provider.log(`User Avatar role loaded from workspace: ${role.name}`)
							}
						}
					} catch (error) {
						provider.log(`Error loading User Avatar role from workspace: ${error instanceof Error ? error.message : String(error)}`)
					}

					// If not found in workspace, try to load from global storage
					if (!role) {
						try {
							const globalService = await getGlobalStorageService(provider.context)
							role = await globalService.getGlobalRole(targetUuid)
							if (role) {
								provider.log(`User Avatar role loaded from global storage: ${role.name}`)
							}
						} catch (error) {
							provider.log(`Error loading User Avatar role from global storage: ${error instanceof Error ? error.message : String(error)}`)
						}
					}
				}

				if (role) {
					await provider.postMessageToWebview({
						type: "userAvatarRoleLoaded",
						role,
					})
				} else {
					provider.log(`User Avatar role not found in ${targetScope || 'workspace or global storage'}: ${targetUuid}`)
					await provider.postMessageToWebview({
						type: "userAvatarRoleLoaded",
						role: undefined,
					})
				}
			} catch (error) {
				provider.log(
					`Error loading User Avatar role: ${error instanceof Error ? error.message : String(error)}`,
				)
				await provider.postMessageToWebview({
					type: "userAvatarRoleLoaded",
					role: undefined,
				})
			}
			break
		}
		case "setAnhPersonaMode": {
			try {
				provider.log(`[ANH-Chat:Webview] Received setAnhPersonaMode message: ${JSON.stringify(message)}`)
				const personaMode = message.text as "chat" | "hybrid"
				provider.log(`[ANH-Chat:Webview] Extracted persona mode: ${personaMode}`)
				if (personaMode === "chat" || personaMode === "hybrid") {
					await provider.setAnhPersonaMode(personaMode)
					provider.log(`ANH persona mode set to: ${personaMode}`)

					// 立即更新当前任务的设置，使其在聊天中途也能生效
					const currentTask = provider.getCurrentTask()
					if (currentTask) {
						// 使用公共方法更新任务的设置
						currentTask.updatePersonaMode(personaMode)
						provider.log(
							`[ANH-Chat:Task#${currentTask.taskId}] Updated persona mode during conversation: ${personaMode}`,
						)
					}
				} else {
					provider.log(`[ANH-Chat:Webview] Invalid persona mode: ${personaMode}`)
				}
			} catch (error) {
				provider.log(
					`Error setting ANH persona mode: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
			break
		}
		case "setAnhToneStrict": {
			try {
				const toneStrict = message.bool ?? true
				await provider.setAnhToneStrict(toneStrict)
				provider.log(`ANH tone strict set to: ${toneStrict}`)

				// 立即更新当前任务的设置，使其在聊天中途也能生效
				const currentTask = provider.getCurrentTask()
				if (currentTask) {
					// 使用公共方法更新任务的设置
					currentTask.updateToneStrict(toneStrict)
					provider.log(
						`[ANH-Chat:Task#${currentTask.taskId}] Updated tone strict during conversation: ${toneStrict}`,
					)
				}
			} catch (error) {
				provider.log(`Error setting ANH tone strict: ${error instanceof Error ? error.message : String(error)}`)
			}
			break
		}
		case "setAnhUseAskTool": {
			try {
				const useAskTool = message.bool ?? true
				await provider.setAnhUseAskTool(useAskTool)
				provider.log(`ANH use ask tool set to: ${useAskTool}`)
			} catch (error) {
				provider.log(
					`Error setting ANH use ask tool: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
			break
		}
		case "setDisplayMode": {
			try {
				const displayMode = message.text as "coding" | "chat"
				if (displayMode === "coding" || displayMode === "chat") {
					await provider.setDisplayMode(displayMode)
					provider.log(`Display mode set to: ${displayMode}`)
				} else {
					provider.log(`Invalid display mode: ${displayMode}`)
				}
			} catch (error) {
				provider.log(`Error setting display mode: ${error instanceof Error ? error.message : String(error)}`)
			}
			break
		}
		case "enableUserAvatar": {
			try {
				const enableUserAvatar = message.bool ?? false
				await updateGlobalState("enableUserAvatar", enableUserAvatar)
				await provider.postStateToWebview()
				provider.log(`User avatar enabled set to: ${enableUserAvatar}`)
			} catch (error) {
				provider.log(
					`Error setting user avatar enabled: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
			break
		}
		case "userAvatarHideFullData": {
			try {
				const hideFullData = message.bool ?? false
				await updateGlobalState("userAvatarHideFullData", hideFullData)
				await updateGlobalState("userAvatarVisibility", hideFullData ? "summary" : "full")
				await provider.postStateToWebview()
				provider.log(`User avatar hide full data set to: ${hideFullData}`)
			} catch (error) {
				provider.log(
					`Error setting user avatar hide full data: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
			break
		}
		case "userAvatarVisibility": {
			try {
				const rawVisibility =
					(typeof message.text === "string" && message.text) ||
					(typeof message.value === "string" && message.value) ||
					(typeof (message as any).visibility === "string" && (message as any).visibility)

				const allowedVisibilities = new Set(["full", "summary", "name", "hidden"])
				const visibility = allowedVisibilities.has(rawVisibility ?? "")
					? (rawVisibility as "full" | "summary" | "name" | "hidden")
					: "full"

				await updateGlobalState("userAvatarVisibility", visibility)
				await updateGlobalState("userAvatarHideFullData", visibility !== "full")
				await provider.postStateToWebview()
				provider.log(`User avatar visibility set to: ${visibility}`)
			} catch (error) {
				provider.log(
					`Error setting user avatar visibility: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
			break
		}
		case "userAvatarRole": {
			try {
				let userAvatarRole: Role | undefined

				const roleFromValues = message.values as Role | undefined
				const roleFromMessage = message.role as Role | undefined

				if (roleFromValues && typeof roleFromValues === "object") {
					userAvatarRole = roleFromValues
				} else if (roleFromMessage && typeof roleFromMessage === "object") {
					userAvatarRole = roleFromMessage
				} else {
					const userAvatarRoleText = message.text

					if (typeof userAvatarRoleText === "string" && userAvatarRoleText.trim() !== "") {
						try {
							userAvatarRole = JSON.parse(userAvatarRoleText)
						} catch (parseError) {
							provider.log(
								`Error parsing user avatar role JSON: ${
									parseError instanceof Error ? parseError.message : String(parseError)
								}`,
							)
							userAvatarRole = undefined
						}
					}
				}

				// Treat empty uuid as a cleared selection
				if (userAvatarRole && typeof userAvatarRole.uuid === "string" && userAvatarRole.uuid.trim() === "") {
					userAvatarRole = undefined
				}

				await updateGlobalState("userAvatarRole", userAvatarRole)
				await provider.postStateToWebview()
				provider.log(`User avatar role set to: ${userAvatarRole ? userAvatarRole.name : "none"}`)
			} catch (error) {
				provider.log(
					`Error setting user avatar role: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
			break
		}
		case "showSystemPrompt": {
			try {
				const currentTask = provider.getCurrentTask()
				if (!currentTask) {
					vscode.window.showWarningMessage("No active task found to show system prompt.")
					break
				}

				// Get the current task mode using the async method
				const taskMode = await currentTask.getTaskMode()

				// Generate the system prompt for the current task
				const systemPrompt = await generateSystemPrompt(provider, {
					type: "getSystemPrompt",
					mode: taskMode,
				})

				// Create a new document to show the system prompt
				const document = await vscode.workspace.openTextDocument({
					content: systemPrompt,
					language: "markdown",
				})

				// Show the document in a new tab
				await vscode.window.showTextDocument(document, {
					preview: false,
					viewColumn: vscode.ViewColumn.Beside,
				})

				// Also show a notification
				vscode.window.showInformationMessage("System prompt opened in a new tab")
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error)
				vscode.window.showErrorMessage(`Failed to show system prompt: ${errorMessage}`)
				provider.log(`Error showing system prompt: ${errorMessage}`)
			}
			break
		}

		// Worldset management cases
		case "createWorldsetFolder": {
			try {
				const workspacePath = getWorkspacePath()
				if (!workspacePath) {
					vscode.window.showErrorMessage("No workspace folder found")
					break
				}

				const worldsetDir = path.join(workspacePath, "novel-helper", ".anh-chat", "worldset")

				// Create worldset directory if it doesn't exist
				await fs.mkdir(worldsetDir, { recursive: true })

				// Create a default worldset if none exists
				const defaultWorldsetPath = path.join(worldsetDir, "default_worldset.md")
				if (
					!(await fs
						.access(defaultWorldsetPath)
						.then(() => true)
						.catch(() => false))
				) {
					const defaultContent = `# 默认世界观设定

## 世界背景
这是一个默认的世界观设定文件。

## 角色设定
### 主要角色
- 角色名称：描述

## 规则设定
- 规则1
- 规则2
`
					await fs.writeFile(defaultWorldsetPath, defaultContent, "utf8")
				}

				provider.log(`Created worldset folder: ${worldsetDir}`)

				// Send success response
				await provider.postMessageToWebview({
					type: "worldsetFolderCreated",
					text: worldsetDir,
				})
			} catch (error) {
				provider.log(
					`Error creating worldset folder: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
				)
				vscode.window.showErrorMessage("Failed to create worldset folder")
			}
			break
		}

		case "getWorldsetList": {
			try {
				const worldsetFiles: any[] = []

				// Load workspace worldsets
				const workspacePath = getWorkspacePath()
				if (workspacePath) {
					const worldsetDir = path.join(workspacePath, "novel-helper", ".anh-chat", "worldset")

					// Check if worldset directory exists
					if (
						await fs
							.access(worldsetDir)
							.then(() => true)
							.catch(() => false)
					) {
						// Read all .md files in worldset directory
						const files = await fs.readdir(worldsetDir)
						const mdFiles = files.filter((file) => file.endsWith(".md"))

						// Convert to WorldsetFile objects with name, path, and scope
						const workspaceWorldsetFiles = mdFiles.map((fileName) => ({
							name: fileName,
							path: `worldset/${fileName}`,
							scope: "workspace" as const,
						}))
						worldsetFiles.push(...workspaceWorldsetFiles)
					}
				}

				// Load global worldsets
				try {
					const globalStorageService = await getGlobalStorageService(provider.context)
					const globalWorldsetDir = globalStorageService.getGlobalWorldsetsPath()

					// Check if global worldset directory exists
					if (
						await fs
							.access(globalWorldsetDir)
							.then(() => true)
							.catch(() => false)
					) {
						// Read all .md files in global worldset directory
						const files = await fs.readdir(globalWorldsetDir)
						const mdFiles = files.filter((file) => file.endsWith(".md"))

						// Convert to WorldsetFile objects with name, path, and scope
						const globalWorldsetFiles = mdFiles.map((fileName) => ({
							name: fileName,
							path: path.join(globalWorldsetDir, fileName),
							scope: "global" as const,
						}))
						worldsetFiles.push(...globalWorldsetFiles)
					}
				} catch (error) {
					provider.log(`Error loading global worldsets: ${error}`)
				}

				await provider.postMessageToWebview({
					type: "worldsetList",
					worldsetFiles: worldsetFiles,
				})
			} catch (error) {
				provider.log(
					`Error getting worldset list: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
				)
				await provider.postMessageToWebview({
					type: "worldsetList",
					worldsetFiles: [],
				})
			}
			break
		}

		case "getWorldsetFiles": {
			try {
				const worldsetName = message.worldsetName
				if (!worldsetName) {
					break
				}

				const workspacePath = getWorkspacePath()
				if (!workspacePath) {
					await provider.postMessageToWebview({
						type: "worldsetFiles",
						worldsetName: worldsetName,
						worldsetFiles: [],
					})
					break
				}

				const worldsetDir = path.join(workspacePath, "novel-helper", ".anh-chat", "worldset")
				const worldsetPath = path.join(worldsetDir, worldsetName)

				// For now, we just return the main worldset file
				// In the future, this could be expanded to support multiple files per worldset
				const files = [
					{
						name: worldsetName,
						path: worldsetPath,
					},
				]

				await provider.postMessageToWebview({
					type: "worldsetFiles",
					worldsetName: worldsetName,
					worldsetFiles: files,
				})
			} catch (error) {
				provider.log(
					`Error getting worldset files: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
				)
				await provider.postMessageToWebview({
					type: "worldsetFiles",
					worldsetName: message.worldsetName || "",
					worldsetFiles: [],
				})
			}
			break
		}

		case "readWorldsetFile": {
			try {
				const worldsetName = message.worldsetName
				const isGlobal = message.isGlobal || false
				if (!worldsetName) {
					break
				}

				const scopeInfo = isGlobal ? "global" : "workspace"
				provider.log(`[Worldset] Reading worldset file: ${worldsetName} (${scopeInfo})`)

				let content = ""

				if (isGlobal) {
					// Load from global storage
					const globalStorageService = await getGlobalStorageService(provider.context)
					const worldsetData = await globalStorageService.loadGlobalWorldset(worldsetName)
					if (worldsetData) {
						content = worldsetData.content || JSON.stringify(worldsetData, null, 2)
					}
				} else {
					// Load from workspace
					const workspacePath = getWorkspacePath()
					if (workspacePath) {
						const worldsetDir = path.join(workspacePath, "novel-helper", ".anh-chat", "worldset")
						const worldsetPath = path.join(worldsetDir, worldsetName)
						content = await fs.readFile(worldsetPath, "utf8")
					}
				}

				await provider.postMessageToWebview({
					type: "worldsetContent",
					worldsetName: worldsetName,
					worldsetContent: content,
				})
			} catch (error) {
				provider.log(
					`Error reading worldset file: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
				)
				await provider.postMessageToWebview({
					type: "worldsetContent",
					worldsetName: message.worldsetName || "",
					worldsetContent: "",
				})
			}
			break
		}

		case "enableWorldset": {
			try {
				const worldsetName = message.worldsetName
				const worldsetScope = message.worldsetScope || "workspace"
				if (!worldsetName) {
					break
				}

				// Create scope-aware key
				const worldsetKey = `${worldsetName}-${worldsetScope}`

				const currentEnabledWorldsets = await ensureScopedWorldsetKeys()
				const updatedWorldsetsSet = new Set(currentEnabledWorldsets)

				// Remove possible legacy key without scope suffix to avoid duplicates
				if (updatedWorldsetsSet.has(worldsetName)) {
					updatedWorldsetsSet.delete(worldsetName)
				}

				if (!updatedWorldsetsSet.has(worldsetKey)) {
					updatedWorldsetsSet.add(worldsetKey)
					await updateGlobalState("enabledWorldsets", Array.from(updatedWorldsetsSet))
					provider.log(`Enabled worldset: ${worldsetKey}`)
				} else {
					provider.log(`Worldset already enabled: ${worldsetKey}`)
				}

				const enabledWorldsets = Array.from(updatedWorldsetsSet)
				await provider.postMessageToWebview({
					type: "worldsetStatusUpdate",
					worldsetStatus: {
						enabled: enabledWorldsets.length > 0,
						enabledWorldsets: enabledWorldsets,
					},
				})
			} catch (error) {
				provider.log(`Error enabling worldset: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`)
			}
			break
		}

		case "disableWorldset": {
			try {
				const worldsetName = message.worldsetName
				const worldsetScope = message.worldsetScope || "workspace"
				if (!worldsetName) {
					break
				}

				// Create scope-aware key
				const worldsetKey = `${worldsetName}-${worldsetScope}`

				const currentEnabledWorldsets = await ensureScopedWorldsetKeys()
				const updatedWorldsets = currentEnabledWorldsets.filter(
					(key) => key !== worldsetKey && key !== worldsetName,
				)
				await updateGlobalState("enabledWorldsets", updatedWorldsets)

				provider.log(`Disabled worldset: ${worldsetKey}`)

				// Send status update
				await provider.postMessageToWebview({
					type: "worldsetStatusUpdate",
					worldsetStatus: {
						enabled: updatedWorldsets.length > 0,
						enabledWorldsets: updatedWorldsets,
					},
				})
			} catch (error) {
				provider.log(`Error disabling worldset: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`)
			}
			break
		}

		case "disableAllWorldsets": {
			try {
				await ensureScopedWorldsetKeys()
				// Clear all enabled worldsets
				await updateGlobalState("enabledWorldsets", [])

				provider.log("Disabled all worldsets")

				// Send status update
				await provider.postMessageToWebview({
					type: "worldsetStatusUpdate",
					worldsetStatus: {
						enabled: false,
						enabledWorldsets: [],
					},
				})
			} catch (error) {
				provider.log(`Error disabling all worldsets: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`)
			}
			break
		}

		case "getWorldsetStatus": {
			try {
				const enabledWorldsets = await ensureScopedWorldsetKeys()

				await provider.postMessageToWebview({
					type: "worldsetStatusUpdate",
					worldsetStatus: {
						enabled: enabledWorldsets.length > 0,
						enabledWorldsets: enabledWorldsets,
					},
				})
			} catch (error) {
				provider.log(
					`Error getting worldset status: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
				)
				await provider.postMessageToWebview({
					type: "worldsetStatusUpdate",
					worldsetStatus: {
						enabled: false,
						enabledWorldsets: [],
					},
				})
			}
			break
		}

		case "openWorldsetFolder": {
			try {
				const workspacePath = getWorkspacePath()
				if (!workspacePath) {
					vscode.window.showErrorMessage("No workspace folder found")
					break
				}

				const worldsetDir = path.join(workspacePath, "novel-helper", ".anh-chat", "worldset")

				// Create worldset directory if it doesn't exist
				await fs.mkdir(worldsetDir, { recursive: true })

				// Use VS Code's built-in command to reveal the folder in the system's file explorer
				const worldsetUri = vscode.Uri.file(worldsetDir)
				await vscode.commands.executeCommand("revealFileInOS", worldsetUri)

				provider.log(`Opened worldset folder: ${worldsetDir}`)
			} catch (error) {
				provider.log(
					`Error opening worldset folder: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
				)
				vscode.window.showErrorMessage("Failed to open worldset folder")
			}
			break
		}

		// STWordBook management cases
		case "STWordBookToggle": {
			try {
				const filePath = message.worldBookFilePath
				const enabled = message.worldBookEnabled
				const worldBookScope = message.worldBookScope || "workspace"

				if (!filePath || typeof enabled !== "boolean") {
					vscode.window.showErrorMessage("Invalid worldbook toggle parameters")
					break
				}

				// Create scope-aware key for the worldbook
				const worldBookKey = `${filePath}-${worldBookScope}`

				const success = await provider.anhChatServices?.worldBookService.toggleWorldBook(worldBookKey, enabled)
				if (success) {
					await provider.postStateToWebview()
					provider.log(`WorldBook ${enabled ? "enabled" : "disabled"}: ${filePath} (${worldBookScope})`)
				} else {
					vscode.window.showErrorMessage(`Failed to ${enabled ? "enable" : "disable"} worldbook`)
				}
			} catch (error) {
				provider.log(`Error toggling worldbook: ${error instanceof Error ? error.message : String(error)}`)
				vscode.window.showErrorMessage("Failed to toggle worldbook")
			}
			break
		}

		case "STWordBookAdd": {
			try {
				const config = message.worldBookConfig as WorldBookConfig
				const worldBookScope = message.worldBookScope || "workspace"

				if (!config || !config.filePath) {
					vscode.window.showErrorMessage("Invalid worldbook configuration")
					break
				}

				// Create scope-aware key for the worldbook
				const worldBookKey = `${config.filePath}-${worldBookScope}`
				const scopedConfig = { ...config, scope: worldBookScope, key: worldBookKey }

				const success = await provider.anhChatServices?.worldBookService.addWorldBookConfig(scopedConfig)
				if (success) {
					await provider.postStateToWebview()
					provider.log(`WorldBook added: ${config.filePath} (${worldBookScope})`)
				} else {
					vscode.window.showErrorMessage("Failed to add worldbook")
				}
			} catch (error) {
				provider.log(`Error adding worldbook: ${error instanceof Error ? error.message : String(error)}`)
				vscode.window.showErrorMessage("Failed to add worldbook")
			}
			break
		}

		case "STWordBookRemove": {
			try {
				const filePath = message.worldBookFilePath
				const worldBookScope = message.worldBookScope || "workspace"

				if (!filePath) {
					vscode.window.showErrorMessage("Invalid worldbook file path")
					break
				}

				// Create scope-aware key for the worldbook
				const worldBookKey = `${filePath}-${worldBookScope}`

				const success = await provider.anhChatServices?.worldBookService.removeWorldBookConfig(worldBookKey)
				if (success) {
					await provider.postStateToWebview()
					provider.log(`WorldBook removed: ${filePath} (${worldBookScope})`)
				} else {
					vscode.window.showErrorMessage("Failed to remove worldbook")
				}
			} catch (error) {
				provider.log(`Error removing worldbook: ${error instanceof Error ? error.message : String(error)}`)
				vscode.window.showErrorMessage("Failed to remove worldbook")
			}
			break
		}

		case "STWordBookUpdate": {
			try {
				const filePath = message.worldBookFilePath
				const config = message.worldBookConfig as WorldBookConfig
				const worldBookScope = message.worldBookScope || "workspace"

				if (!filePath || !config) {
					vscode.window.showErrorMessage("Invalid worldbook update parameters")
					break
				}

				// Create scope-aware keys for the worldbook
				const oldWorldBookKey = `${filePath}-${worldBookScope}`
				const scopedConfig = { ...config, scope: worldBookScope, key: oldWorldBookKey }

				// Use the service's update method to avoid race conditions
				const success = await provider.anhChatServices?.worldBookService.updateWorldBookConfig(oldWorldBookKey, scopedConfig)
				if (success) {
					await provider.postStateToWebview()
					provider.log(`WorldBook updated: ${filePath} (${worldBookScope})`)
				} else {
					vscode.window.showErrorMessage("Failed to update worldbook")
				}
			} catch (error) {
				provider.log(`Error updating worldbook: ${error instanceof Error ? error.message : String(error)}`)
				vscode.window.showErrorMessage("Failed to update worldbook")
			}
			break
		}

		case "STWordBookReload": {
			try {
				const filePath = message.worldBookFilePath
				const worldBookScope = message.worldBookScope || "workspace"

				if (!filePath) {
					vscode.window.showErrorMessage("Invalid worldbook file path")
					break
				}

				// Create scope-aware key for the worldbook
				const worldBookKey = `${filePath}-${worldBookScope}`

				const success = await provider.anhChatServices?.worldBookService.reloadWorldBook(worldBookKey)
				if (success) {
					await provider.postStateToWebview()
					provider.log(`WorldBook reloaded: ${filePath} (${worldBookScope})`)
				} else {
					vscode.window.showErrorMessage("Failed to reload worldbook")
				}
			} catch (error) {
				provider.log(`Error reloading worldbook: ${error instanceof Error ? error.message : String(error)}`)
				vscode.window.showErrorMessage("Failed to reload worldbook")
			}
			break
		}

		case "STWordBookBrowse": {
			try {
				const options: vscode.OpenDialogOptions = {
					canSelectMany: false,
					openLabel: "Select WorldBook File",
					filters: {
						"JSON Files": ["json"],
					},
				}

				const fileUri = await vscode.window.showOpenDialog(options)
				if (fileUri && fileUri[0]) {
					await provider.postMessageToWebview({
						type: "STWordBookBrowseResponse",
						worldBookFilePath: fileUri[0].fsPath,
					})
				}
			} catch (error) {
				provider.log(`Error browsing worldbook file: ${error instanceof Error ? error.message : String(error)}`)
				vscode.window.showErrorMessage("Failed to browse worldbook file")
			}
			break
		}

		case "STWordBookValidate": {
			try {
				const filePath = message.worldBookFilePath
				const worldBookScope = message.worldBookScope || "workspace"

				if (!filePath) {
					await provider.postMessageToWebview({
						type: "STWordBookValidateResponse",
						worldBookValid: false,
						worldBookValidationError: "Invalid file path",
					})
					break
				}

				// Create scope-aware key for the worldbook
				const worldBookKey = `${filePath}-${worldBookScope}`

				const validation = await provider.anhChatServices?.worldBookService.validateWorldBookFile(worldBookKey)
				await provider.postMessageToWebview({
					type: "STWordBookValidateResponse",
					worldBookValid: validation?.valid,
					worldBookInfo: validation?.info,
					worldBookValidationError: validation?.error,
				})
			} catch (error) {
				provider.log(`Error validating worldbook: ${error instanceof Error ? error.message : String(error)}`)
				await provider.postMessageToWebview({
					type: "STWordBookValidateResponse",
					worldBookValid: false,
					worldBookValidationError: error instanceof Error ? error.message : String(error),
				})
			}
			break
		}

		// Global STWordBook management cases
		case "STWordBookGetGlobal": {
			try {
				const globalService = await getGlobalStorageService(provider.context)
				const globalPath = globalService.getGlobalWorldBooksPath()
				provider.log(`Global WorldBooks path: ${globalPath}`)

				const globalFiles = await globalService.getGlobalWorldBooks()
				provider.log(`Global WorldBooks found: ${globalFiles.length} files: ${globalFiles.join(', ')}`)

				// 使用WorldBookConverter获取每个文件的详细信息，包括词条数
				const { WorldBookConverter } = await import("../../../packages/types/src/silly-tavern-worldbook-converter")
				const converter = new WorldBookConverter()
				
				const globalWorldBooksWithInfo = []
				for (const fileName of globalFiles) {
					try {
						const filePath = path.join(globalPath, fileName)
						const info = await converter.getWorldBookInfo(filePath)
						globalWorldBooksWithInfo.push({
							fileName,
							entryCount: info.entryCount,
							name: info.name,
							fileSize: info.fileSize,
							lastModified: info.lastModified,
							loaded: info.loaded,
							error: info.error
						})
					} catch (error) {
						provider.log(`Error getting info for ${fileName}: ${error instanceof Error ? error.message : String(error)}`)
						globalWorldBooksWithInfo.push({
							fileName,
							entryCount: 0,
							name: fileName.replace(/\.(json|jsonl)$/, ''),
							fileSize: 0,
							lastModified: 0,
							loaded: false,
							error: error instanceof Error ? error.message : String(error)
						})
					}
				}

				await provider.postMessageToWebview({
					type: "STWordBookGetGlobalResponse",
					globalWorldBooks: globalFiles,
					globalWorldBooksPath: globalPath,
					globalWorldBooksWithInfo,
				})
			} catch (error) {
				provider.log(`Error getting global worldbooks: ${error instanceof Error ? error.message : String(error)}`)
				provider.log(`Error stack: ${error instanceof Error ? error.stack : 'No stack available'}`)
				await provider.postMessageToWebview({
					type: "STWordBookGetGlobalResponse",
					globalWorldBooks: [],
					globalWorldBooksPath: "",
					globalWorldBooksWithInfo: [],
					error: error instanceof Error ? error.message : String(error),
				})
			}
			break
		}

		case "STWordBookCopyToGlobal": {
			try {
				const filePath = message.worldBookFilePath
				if (!filePath) {
					vscode.window.showErrorMessage("Invalid worldbook file path")
					break
				}

				// 读取当前世界书文件
				const worldBookData = await provider.anhChatServices?.worldBookService.loadWorldBookFile(filePath)
				if (!worldBookData) {
					vscode.window.showErrorMessage("Failed to load worldbook file")
					break
				}

				// 保存到全局存储
				const globalService = await getGlobalStorageService(provider.context)
				const fileName = path.basename(filePath)
				await globalService.saveGlobalWorldBook(fileName, worldBookData)

				vscode.window.showInformationMessage(`世界书已复制到全局存储: ${fileName}`)
				await provider.postStateToWebview()
			} catch (error) {
				provider.log(`Error copying worldbook to global: ${error instanceof Error ? error.message : String(error)}`)
				vscode.window.showErrorMessage("复制到全局存储失败")
			}
			break
		}

		case "STWordBookCopyFromGlobal": {
			try {
				const fileName = message.worldBookFileName
				if (!fileName) {
					vscode.window.showErrorMessage("Invalid worldbook file name")
					break
				}

				// 从全局存储读取
				const globalService = await getGlobalStorageService(provider.context)
				const worldBookData = await globalService.loadGlobalWorldBook(fileName)
				if (!worldBookData) {
					vscode.window.showErrorMessage("Failed to load global worldbook file")
					break
				}

				// 保存到工作区
				const workspaceWorldBookPath = path.join(provider.anhChatServices?.worldBookService.getWorldBooksPath() || "", fileName)
				await fs.writeFile(workspaceWorldBookPath, JSON.stringify(worldBookData, null, 2))

				vscode.window.showInformationMessage(`世界书已从全局存储复制到工作区: ${fileName}`)
				await provider.postStateToWebview()
			} catch (error) {
				provider.log(`Error copying worldbook from global: ${error instanceof Error ? error.message : String(error)}`)
				vscode.window.showErrorMessage("从全局存储复制失败")
			}
			break
		}

		// World Book Mixin management cases
		case "getWorldBookMixin": {
			try {
				const { worldBookPath, isGlobal = false, worldBookScope } = message

				if (!worldBookPath) {
					await provider.postMessageToWebview({
						type: "worldBookMixinLoaded",
						worldBookMixin: null,
						error: "World book path is required"
					})
					break
				}

				const scopeInfo = worldBookScope || (isGlobal ? "global" : "workspace")
				provider.log(`[WorldBookMixin] Loading mixin for: ${worldBookPath} (${scopeInfo})`)

				// Load the world book service
				const { WorldBookConverter } = await import('../../../packages/types/src/silly-tavern-worldbook-converter')
				const converter = new WorldBookConverter()

				// Get the mixin service
				const { WorldBookMixinService } = await import('../../services/silly-tavern/WorldBookMixinService')
				const mixinService = new WorldBookMixinService(provider.context)

				// Load original world book entries
				const fs = await import('fs/promises')
				const worldBookRawData = await fs.readFile(worldBookPath, 'utf8')
				const worldBookData = JSON.parse(worldBookRawData)

				// Extract entries from the world book data
				let originalEntries: any[] = []
				if (worldBookData.entries) {
					if (Array.isArray(worldBookData.entries)) {
						originalEntries = worldBookData.entries
					} else if (typeof worldBookData.entries === 'object') {
						originalEntries = Object.values(worldBookData.entries)
					}
				} else if (Array.isArray(worldBookData)) {
					originalEntries = worldBookData
				} else {
					originalEntries = Object.values(worldBookData).filter((item: any) =>
						item && typeof item === 'object' && (item.uid !== undefined || item.key !== undefined)
					)
				}

				// Ensure all entries have a uid, generate one if missing
				originalEntries = originalEntries.map((entry: any, index: number) => {
					if (entry.uid === undefined || entry.uid === null) {
						// Generate a uid based on content hash for consistency
						const contentForHash = JSON.stringify({
							key: entry.key || [],
							content: entry.content || '',
							comment: entry.comment || ''
						})

						// Simple hash function
						let hash = 0
						for (let i = 0; i < contentForHash.length; i++) {
							const char = contentForHash.charCodeAt(i)
							hash = ((hash << 5) - hash) + char
							hash = hash & hash // Convert to 32-bit integer
						}

						// Create a unique but deterministic uid
						entry.uid = `generated_${Math.abs(hash)}_${index}`
						provider.log(`[WorldBookMixin] Generated uid for entry ${index}: ${entry.uid}`)
					} else {
						provider.log(`[WorldBookMixin] Keeping original uid for entry ${index}: ${entry.uid}`)
					}
					return entry
				})

				// Load existing mixin
				const mixin = await mixinService.loadWorldBookMixin(worldBookPath, isGlobal)

				await provider.postMessageToWebview({
					type: "worldBookMixinLoaded",
					worldBookMixin: {
						entries: mixin?.entries || [],
						originalEntries
					}
				})

				provider.log(`[WorldBookMixin] Loaded mixin with ${mixin?.entries.length || 0} entries and ${originalEntries.length} original entries`)
			} catch (error) {
				provider.log(`Error loading world book mixin: ${error instanceof Error ? error.message : String(error)}`)
				await provider.postMessageToWebview({
					type: "worldBookMixinLoaded",
					worldBookMixin: null,
					error: error instanceof Error ? error.message : String(error)
				})
			}
			break
		}

		case "updateWorldBookEntryMixin": {
			try {
				const { worldBookPath, entryUid, mixinUpdates, isGlobal = false, worldBookScope } = message

				if (!worldBookPath || entryUid === undefined || !mixinUpdates) {
					vscode.window.showErrorMessage("Missing required parameters for updating entry mixin")
					break
				}

				const scopeInfo = worldBookScope || (isGlobal ? "global" : "workspace")
				provider.log(`[WorldBookMixin] Updating entry ${entryUid} for: ${worldBookPath} (${scopeInfo})`)

				// Get the mixin service
				const { WorldBookMixinService } = await import('../../services/silly-tavern/WorldBookMixinService')
				const mixinService = new WorldBookMixinService(provider.context)

				// Update the entry mixin
				await mixinService.updateEntryMixin(worldBookPath, isGlobal, entryUid, {
					...mixinUpdates,
					updatedAt: Date.now()
				})

				// Load updated mixin
				const updatedMixin = await mixinService.loadWorldBookMixin(worldBookPath, isGlobal)

				await provider.postMessageToWebview({
					type: "worldBookEntryMixinUpdated",
					entryUid,
					mixin: updatedMixin
				})

				vscode.window.showInformationMessage(`条目Mixin已更新`)
				provider.log(`[WorldBookMixin] Successfully updated entry ${entryUid} (${isGlobal ? 'global' : 'workspace'})`)
			} catch (error) {
				provider.log(`Error updating world book entry mixin: ${error instanceof Error ? error.message : String(error)}`)
				vscode.window.showErrorMessage("更新条目Mixin失败: " + (error instanceof Error ? error.message : String(error)))
			}
			break
		}

		case "removeWorldBookEntryMixin": {
			try {
				const { worldBookPath, entryUid, isGlobal = false, worldBookScope } = message

				if (!worldBookPath || entryUid === undefined) {
					vscode.window.showErrorMessage("Missing required parameters for removing entry mixin")
					break
				}

				const scopeInfo = worldBookScope || (isGlobal ? "global" : "workspace")
				provider.log(`[WorldBookMixin] Removing entry ${entryUid} for: ${worldBookPath} (${scopeInfo})`)

				// Get the mixin service
				const { WorldBookMixinService } = await import('../../services/silly-tavern/WorldBookMixinService')
				const mixinService = new WorldBookMixinService(provider.context)

				// Remove the entry mixin
				await mixinService.removeEntryMixin(worldBookPath, isGlobal, entryUid)

				await provider.postMessageToWebview({
					type: "worldBookEntryMixinRemoved",
					entryUid
				})

				vscode.window.showInformationMessage(`条目Mixin已删除`)
				provider.log(`[WorldBookMixin] Successfully removed entry ${entryUid} (${scopeInfo})`)
			} catch (error) {
				provider.log(`Error removing world book entry mixin: ${error instanceof Error ? error.message : String(error)}`)
				vscode.window.showErrorMessage("删除条目Mixin失败: " + (error instanceof Error ? error.message : String(error)))
			}
			break
		}

		case "memoryManagement": {
			try {
				// 使用现有的角色记忆触发服务，而不是创建新的实例
				if (!provider?.anhChatServices?.roleMemoryTriggerService) {
					await provider.postMessageToWebview({
						type: "memoryManagementResponse",
						payload: {
							type: "memoryError",
							error: "角色记忆服务未初始化",
							operation: message.data?.type || "unknown",
						},
					})
					break
				}

				const memoryHandler = new MemoryManagementHandler()

				// 使用现有的服务实例初始化记忆管理器
				await memoryHandler.initialize(undefined, provider.anhChatServices.roleMemoryTriggerService)

				const response = await memoryHandler.handleMessage(message.data)

				await provider.postMessageToWebview({
					type: "memoryManagementResponse",
					payload: response,
				})
			} catch (error) {
				provider.log(
					`Error handling memory management: ${error instanceof Error ? error.message : String(error)}`,
				)
				await provider.postMessageToWebview({
					type: "memoryManagementResponse",
					payload: {
						type: "memoryError",
						error: error instanceof Error ? error.message : "Unknown error occurred",
						operation: message.data?.type || "unknown",
					},
				})
			}
			break
		}

		case "loadTsProfileContent": {
			try {
				if (!message.tsProfilePath) {
					throw new Error("Profile path is required for loading profile content")
				}

				// Read the profile file content
				const profileContent = await fs.readFile(message.tsProfilePath, "utf-8")
				const profileData = JSON.parse(profileContent)

				// Use STProfileProcessor to process and validate the profile
				const processor = new STProfileProcessor()
				const processedProfile = processor.parse(profileData)

				if (!processedProfile) {
					throw new Error("Failed to process TSProfile with STProfileProcessor")
				}

				// Generate mixin file path (same directory with .mixin.json extension)
				const profileDir = path.dirname(message.tsProfilePath)
				const profileName = path.basename(message.tsProfilePath, ".json")
				const mixinPath = path.join(profileDir, `${profileName}.mixin.json`)

				// Check if mixin file exists and load it
				let mixinData = null
				try {
					if (await fileExistsAtPath(mixinPath)) {
						const mixinContent = await fs.readFile(mixinPath, "utf-8")
						const rawMixinData = JSON.parse(mixinContent)

						// Process mixin data with STProfileProcessor as well
						mixinData = processor.parse(rawMixinData)
						if (!mixinData) {
							provider.log(`Warning: Failed to process mixin file with STProfileProcessor, using raw data`)
							mixinData = rawMixinData
						}
					}
				} catch (error) {
					provider.log(`Error loading mixin file: ${error}`)
					// Continue without mixin data
				}

				provider.log(`TSProfile loaded successfully: ${message.tsProfilePath}`)
				provider.log(`Processed profile contains ${processedProfile.extensions?.SPreset?.RegexBinding?.length || 0} regex bindings in extensions`)
				provider.log(`Processed profile contains ${processedProfile.regexBindings?.length || 0} regex bindings in root level`)

				// 添加详细的profile数据结构日志
				provider.log(`Profile data structure: ${JSON.stringify({
					hasRootRegex: !!processedProfile.regexBindings,
					rootRegexCount: processedProfile.regexBindings?.length || 0,
					hasExtensions: !!processedProfile.extensions,
					hasSPreset: !!processedProfile.extensions?.SPreset,
					hasExtensionRegex: !!processedProfile.extensions?.SPreset?.RegexBinding,
					extensionRegexCount: processedProfile.extensions?.SPreset?.RegexBinding?.length || 0
				}, null, 2)}`)

				// 记录正则绑定的详细信息
				if (processedProfile.regexBindings && processedProfile.regexBindings.length > 0) {
					provider.log(`Root level regex bindings: ${JSON.stringify(processedProfile.regexBindings.map(rb => ({
						id: rb.id,
						scriptName: rb.scriptName,
						findRegex: rb.findRegex
					})), null, 2)}`)
				}

				if (processedProfile.extensions?.SPreset?.RegexBinding && processedProfile.extensions.SPreset.RegexBinding.length > 0) {
					provider.log(`Extension regex bindings: ${JSON.stringify(processedProfile.extensions.SPreset.RegexBinding.map(rb => ({
						id: rb.id,
						scriptName: rb.scriptName,
						findRegex: rb.findRegex
					})), null, 2)}`)
				}

				provider.postMessageToWebview({
					type: "tsProfileContentLoaded",
					profileData: processedProfile,
					mixinData: mixinData,
					profilePath: message.tsProfilePath,
					mixinPath: mixinPath,
				})
			} catch (error) {
				provider.log(`Error loading TSProfile content: ${error}`)
				await provider.postMessageToWebview({
					type: "tsProfileContentLoaded",
					error: error instanceof Error ? error.message : String(error),
				})
			}
			break
		}

		case "loadTsProfileMixin": {
			try {
				if (!message.mixinPath) {
					throw new Error("Mixin path is required for loading mixin")
				}

				let mixinData = null
				if (await fileExistsAtPath(message.mixinPath)) {
					const mixinContent = await fs.readFile(message.mixinPath, "utf-8")
					mixinData = JSON.parse(mixinContent)
				}

				provider.postMessageToWebview({
					type: "tsProfileMixinLoaded",
					mixinData: mixinData,
					mixinPath: message.mixinPath,
				})
			} catch (error) {
				provider.log(`Error loading TSProfile mixin: ${error}`)
				await provider.postMessageToWebview({
					type: "tsProfileMixinLoaded",
					error: error instanceof Error ? error.message : String(error),
				})
			}
			break
		}

		case "saveTsProfileMixin": {
			try {
				if (!message.mixinPath || !message.mixinData) {
					throw new Error("Mixin path and data are required for saving mixin")
				}

				// Ensure directory exists
				const mixinDir = path.dirname(message.mixinPath)
				await fs.mkdir(mixinDir, { recursive: true })

				// Save mixin data using safeWriteJson
				await safeWriteJson(message.mixinPath, message.mixinData)

				provider.postMessageToWebview({
					type: "tsProfileMixinSaved",
					success: true,
					mixinPath: message.mixinPath,
				})

				vscode.window.showInformationMessage("Profile mixin saved successfully")
			} catch (error) {
				provider.log(`Error saving TSProfile mixin: ${error}`)
				await provider.postMessageToWebview({
					type: "tsProfileMixinSaved",
					success: false,
					error: error instanceof Error ? error.message : String(error),
				})
				vscode.window.showErrorMessage(
					`Failed to save profile mixin: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
			break
		}

		case "saveTsProfileSource": {
			try {
				if (!message.tsProfilePath || !message.profileData) {
					throw new Error("Profile path and data are required for saving profile")
				}

				// Save profile data using safeWriteJson
				await safeWriteJson(message.tsProfilePath, message.profileData)

				provider.postMessageToWebview({
					type: "tsProfileSourceSaved",
					success: true,
					profilePath: message.tsProfilePath,
				})

				vscode.window.showInformationMessage("Profile source saved successfully")
			} catch (error) {
				provider.log(`Error saving TSProfile source: ${error}`)
				await provider.postMessageToWebview({
					type: "tsProfileSourceSaved",
					success: false,
					error: error instanceof Error ? error.message : String(error),
				})
				vscode.window.showErrorMessage(
					`Failed to save profile source: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
			break
		}
		case "loadGlobalRoleMemory": {
			try {
				if (!message.roleUuid) {
					throw new Error("Role UUID is required")
				}

				provider.log(`[GlobalMemory] Loading memory for role: ${message.roleUuid}`)
				const globalService = await getGlobalStorageService(provider.context)
				const memory = await globalService.loadGlobalRoleMemory(message.roleUuid)
				const stats = await globalService.getGlobalRoleMemoryStats(message.roleUuid)

				provider.log(`[GlobalMemory] Loaded memory for role ${message.roleUuid}`)
				provider.postMessageToWebview({
					type: "globalRoleMemoryLoaded",
					roleUuid: message.roleUuid,
					memory,
					stats,
				})
			} catch (error) {
				provider.log(`Error loading global role memory: ${error}`)
				vscode.window.showErrorMessage(`加载全局角色记忆失败: ${error}`)
			}
			break
		}
		case "saveGlobalRoleMemory": {
			try {
				if (!message.roleUuid || !message.memory) {
					throw new Error("Role UUID and memory data are required")
				}

				provider.log(`[GlobalMemory] Saving memory for role: ${message.roleUuid}`)
				const globalService = await getGlobalStorageService(provider.context)
				await globalService.saveGlobalRoleMemory(message.roleUuid, message.memory)

				provider.log(`[GlobalMemory] Saved memory for role ${message.roleUuid}`)
				vscode.window.showInformationMessage("全局角色记忆已保存")
			} catch (error) {
				provider.log(`Error saving global role memory: ${error}`)
				vscode.window.showErrorMessage(`保存全局角色记忆失败: ${error}`)
			}
			break
		}
		case "appendGlobalEpisodicMemory": {
			try {
				if (!message.roleUuid || !message.record) {
					throw new Error("Role UUID and episodic record are required")
				}

				provider.log(`[GlobalMemory] Adding episodic memory for role: ${message.roleUuid}`)
				const globalService = await getGlobalStorageService(provider.context)
				await globalService.appendGlobalEpisodicMemory(message.roleUuid, message.record)

				provider.log(`[GlobalMemory] Added episodic memory for role ${message.roleUuid}`)
			} catch (error) {
				provider.log(`Error adding global episodic memory: ${error}`)
				vscode.window.showErrorMessage(`添加全局情景记忆失败: ${error}`)
			}
			break
		}
		case "upsertGlobalSemanticMemory": {
			try {
				if (!message.roleUuid || !message.record) {
					throw new Error("Role UUID and semantic record are required")
				}

				provider.log(`[GlobalMemory] Updating semantic memory for role: ${message.roleUuid}`)
				const globalService = await getGlobalStorageService(provider.context)
				await globalService.upsertGlobalSemanticMemory(message.roleUuid, message.record)

				provider.log(`[GlobalMemory] Updated semantic memory for role ${message.roleUuid}`)
			} catch (error) {
				provider.log(`Error updating global semantic memory: ${error}`)
				vscode.window.showErrorMessage(`更新全局语义记忆失败: ${error}`)
			}
			break
		}
		case "updateGlobalRoleTraits": {
			try {
				if (!message.roleUuid || !message.traits) {
					throw new Error("Role UUID and traits are required")
				}

				provider.log(`[GlobalMemory] Updating traits for role: ${message.roleUuid}`)
				const globalService = await getGlobalStorageService(provider.context)
				await globalService.updateGlobalRoleTraits(message.roleUuid, message.traits)

				provider.log(`[GlobalMemory] Updated traits for role ${message.roleUuid}`)
			} catch (error) {
				provider.log(`Error updating global role traits: ${error}`)
				vscode.window.showErrorMessage(`更新全局角色特征失败: ${error}`)
			}
			break
		}
		case "updateGlobalRoleGoals": {
			try {
				if (!message.roleUuid || !message.goals) {
					throw new Error("Role UUID and goals are required")
				}

				provider.log(`[GlobalMemory] Updating goals for role: ${message.roleUuid}`)
				const globalService = await getGlobalStorageService(provider.context)
				await globalService.updateGlobalRoleGoals(message.roleUuid, message.goals)

				provider.log(`[GlobalMemory] Updated goals for role ${message.roleUuid}`)
			} catch (error) {
				provider.log(`Error updating global role goals: ${error}`)
				vscode.window.showErrorMessage(`更新全局角色目标失败: ${error}`)
			}
			break
		}
		case "deleteGlobalRoleMemory": {
			try {
				if (!message.roleUuid) {
					throw new Error("Role UUID is required")
				}

				provider.log(`[GlobalMemory] Deleting memory for role: ${message.roleUuid}`)
				const globalService = await getGlobalStorageService(provider.context)
				const success = await globalService.deleteGlobalRoleMemory(message.roleUuid)

				if (success) {
					provider.log(`[GlobalMemory] Deleted memory for role ${message.roleUuid}`)
					vscode.window.showInformationMessage("全局角色记忆已删除")
				} else {
					throw new Error("删除失败，记忆不存在")
				}
			} catch (error) {
				provider.log(`Error deleting global role memory: ${error}`)
				vscode.window.showErrorMessage(`删除全局角色记忆失败: ${error}`)
			}
			break
		}
		case "listGlobalRoleMemories": {
			try {
				provider.log("[GlobalMemory] Listing all global role memories...")
				const globalService = await getGlobalStorageService(provider.context)
				const roleUuids = await globalService.listGlobalRoleMemories()

				provider.log(`[GlobalMemory] Found ${roleUuids.length} global role memories`)
				provider.postMessageToWebview({
					type: "globalRoleMemoriesListed",
					roleUuids,
				})
			} catch (error) {
				provider.log(`Error listing global role memories: ${error}`)
				vscode.window.showErrorMessage(`获取全局角色记忆列表失败: ${error}`)
			}
			break
		}
	}
}
