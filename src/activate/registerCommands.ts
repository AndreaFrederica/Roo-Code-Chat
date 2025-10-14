import * as vscode from "vscode"
import delay from "delay"

import type { CommandId } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"

import { Package } from "../shared/package"
import { getCommand } from "../utils/commands"
import { ClineProvider } from "../core/webview/ClineProvider"
import { ContextProxy } from "../core/config/ContextProxy"
import { focusPanel } from "../utils/focusPanel"

import { registerHumanRelayCallback, unregisterHumanRelayCallback, handleHumanRelayResponse } from "./humanRelay"
import { handleNewTask } from "./handleTask"
import { CodeIndexManager } from "../services/code-index/manager"
import { importSettingsWithFeedback } from "../core/config/importExport"
import { MdmService } from "../services/mdm/MdmService"
import { t } from "../i18n"
import type { AnhChatServices } from "../services/anh-chat"

/**
 * Helper to get the visible ClineProvider instance or log if not found.
 */
export function getVisibleProviderOrLog(outputChannel: vscode.OutputChannel): ClineProvider | undefined {
	const visibleProvider = ClineProvider.getVisibleInstance()
	if (!visibleProvider) {
		outputChannel.appendLine("Cannot find any visible ANH CHAT instances.")
		return undefined
	}
	return visibleProvider
}

// Store panel references in both modes
let sidebarPanel: vscode.WebviewView | undefined = undefined
let tabPanel: vscode.WebviewPanel | undefined = undefined

/**
 * Get the currently active panel
 * @returns WebviewPanel或WebviewView
 */
export function getPanel(): vscode.WebviewPanel | vscode.WebviewView | undefined {
	return tabPanel || sidebarPanel
}

/**
 * Set panel references
 */
export function setPanel(
	newPanel: vscode.WebviewPanel | vscode.WebviewView | undefined,
	type: "sidebar" | "tab",
): void {
	if (type === "sidebar") {
		sidebarPanel = newPanel as vscode.WebviewView
		tabPanel = undefined
	} else {
		tabPanel = newPanel as vscode.WebviewPanel
		sidebarPanel = undefined
	}
}

export type RegisterCommandOptions = {
	context: vscode.ExtensionContext
	outputChannel: vscode.OutputChannel
	provider: ClineProvider
	anhChatServices?: AnhChatServices
}

export const registerCommands = (options: RegisterCommandOptions) => {
	const { context } = options

	for (const [id, callback] of Object.entries(getCommandsMap(options))) {
		const command = getCommand(id as CommandId)
		context.subscriptions.push(vscode.commands.registerCommand(command, callback))
	}
}

const getCommandsMap = ({
	context,
	outputChannel,
	provider,
	anhChatServices,
}: RegisterCommandOptions): Record<CommandId, any> => ({
	activationCompleted: () => {},
	cloudButtonClicked: () => {
		const visibleProvider = getVisibleProviderOrLog(outputChannel)

		if (!visibleProvider) {
			return
		}

		TelemetryService.instance.captureTitleButtonClicked("cloud")

		visibleProvider.postMessageToWebview({ type: "action", action: "cloudButtonClicked" })
	},
	plusButtonClicked: async () => {
		const visibleProvider = getVisibleProviderOrLog(outputChannel)

		if (!visibleProvider) {
			return
		}

		TelemetryService.instance.captureTitleButtonClicked("plus")

		await visibleProvider.removeClineFromStack()
		await visibleProvider.refreshWorkspace()
		await visibleProvider.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
		// Send focusInput action immediately after chatButtonClicked
		// This ensures the focus happens after the view has switched
		await visibleProvider.postMessageToWebview({ type: "action", action: "focusInput" })
	},
	mcpButtonClicked: () => {
		const visibleProvider = getVisibleProviderOrLog(outputChannel)

		if (!visibleProvider) {
			return
		}

		TelemetryService.instance.captureTitleButtonClicked("mcp")

		visibleProvider.postMessageToWebview({ type: "action", action: "mcpButtonClicked" })
	},
	promptsButtonClicked: () => {
		const visibleProvider = getVisibleProviderOrLog(outputChannel)

		if (!visibleProvider) {
			return
		}

		TelemetryService.instance.captureTitleButtonClicked("prompts")

		visibleProvider.postMessageToWebview({ type: "action", action: "promptsButtonClicked" })
	},
	popoutButtonClicked: () => {
		TelemetryService.instance.captureTitleButtonClicked("popout")

		return openClineInNewTab({ context, outputChannel, anhChatServices })
	},
	openInNewTab: () => openClineInNewTab({ context, outputChannel, anhChatServices }),
	settingsButtonClicked: () => {
		const visibleProvider = getVisibleProviderOrLog(outputChannel)

		if (!visibleProvider) {
			return
		}

		TelemetryService.instance.captureTitleButtonClicked("settings")

		visibleProvider.postMessageToWebview({ type: "action", action: "settingsButtonClicked" })
		// Also explicitly post the visibility message to trigger scroll reliably
		visibleProvider.postMessageToWebview({ type: "action", action: "didBecomeVisible" })
	},
	historyButtonClicked: () => {
		const visibleProvider = getVisibleProviderOrLog(outputChannel)

		if (!visibleProvider) {
			return
		}

		TelemetryService.instance.captureTitleButtonClicked("history")

		visibleProvider.postMessageToWebview({ type: "action", action: "historyButtonClicked" })
	},
	marketplaceButtonClicked: () => {
		const visibleProvider = getVisibleProviderOrLog(outputChannel)
		if (!visibleProvider) return
		visibleProvider.postMessageToWebview({ type: "action", action: "marketplaceButtonClicked" })
	},
	showHumanRelayDialog: (params: { requestId: string; promptText: string }) => {
		const panel = getPanel()

		if (panel) {
			panel?.webview.postMessage({
				type: "showHumanRelayDialog",
				requestId: params.requestId,
				promptText: params.promptText,
			})
		}
	},
	registerHumanRelayCallback: registerHumanRelayCallback,
	unregisterHumanRelayCallback: unregisterHumanRelayCallback,
	handleHumanRelayResponse: handleHumanRelayResponse,
	newTask: handleNewTask,
	setCustomStoragePath: async () => {
		const { promptForCustomStoragePath } = await import("../utils/storage")
		await promptForCustomStoragePath()
	},
	setGlobalStoragePath: async () => {
		const { setGlobalStoragePath } = await import("../commands/setGlobalStoragePath")
		await setGlobalStoragePath()
	},
	getGlobalStorageInfo: async () => {
		const { getGlobalStorageInfo } = await import("../commands/setGlobalStoragePath")
		await getGlobalStorageInfo()
	},
	importSettings: async (filePath?: string) => {
		const visibleProvider = getVisibleProviderOrLog(outputChannel)
		if (!visibleProvider) {
			return
		}

		await importSettingsWithFeedback(
			{
				providerSettingsManager: visibleProvider.providerSettingsManager,
				contextProxy: visibleProvider.contextProxy,
				customModesManager: visibleProvider.customModesManager,
				provider: visibleProvider,
			},
			filePath,
		)
	},
	focusInput: async () => {
		try {
			await focusPanel(tabPanel, sidebarPanel)

			// Send focus input message only for sidebar panels
			if (sidebarPanel && getPanel() === sidebarPanel) {
				provider.postMessageToWebview({ type: "action", action: "focusInput" })
			}
		} catch (error) {
			outputChannel.appendLine(`Error focusing input: ${error}`)
		}
	},
	focusPanel: async () => {
		try {
			await focusPanel(tabPanel, sidebarPanel)
		} catch (error) {
			outputChannel.appendLine(`Error focusing panel: ${error}`)
		}
	},
	acceptInput: () => {
		const visibleProvider = getVisibleProviderOrLog(outputChannel)

		if (!visibleProvider) {
			return
		}

		visibleProvider.postMessageToWebview({ type: "acceptInput" })
	},
	toggleAutoApprove: async () => {
		const visibleProvider = getVisibleProviderOrLog(outputChannel)

		if (!visibleProvider) {
			return
		}

		visibleProvider.postMessageToWebview({
			type: "action",
			action: "toggleAutoApprove",
		})
	},
	reloadRoleCards: async () => {
		if (!anhChatServices?.roleRegistry) {
			vscode.window.showErrorMessage("Role registry is not initialized yet.")
			return
		}

		try {
			await anhChatServices.roleRegistry.reload()
			await provider.postStateToWebview()
			vscode.window.showInformationMessage("Role cards reloaded.")
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			vscode.window.showErrorMessage(`Failed to reload role cards: ${message}`)
		}
	},
	reloadExtensions: async () => {
		try {
			await provider.refreshAnhExtensions()
			await provider.postStateToWebview()
			vscode.window.showInformationMessage("Extensions reloaded.")
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			vscode.window.showErrorMessage(`Failed to reload extensions: ${message}`)
		}
	},
	// 记忆相关指令
	addTestMemory: async () => {
		if (!anhChatServices?.roleMemoryTriggerService) {
			vscode.window.showErrorMessage("Memory service is not initialized.")
			return
		}

		try {
			// 获取当前角色
			const rolePromptData = await provider.getRolePromptData()
			if (!rolePromptData?.role?.uuid) {
				vscode.window.showErrorMessage("No active role found.")
				return
			}

			const roleUuid = rolePromptData.role.uuid
			const memoryService = anhChatServices.roleMemoryTriggerService

			// 创建测试记忆
			const testMemory = {
				id: `test-${Date.now()}`,
				type: 'episodic' as const,
				content: '这是一个测试记忆，用于验证记忆系统功能。用户在测试时添加了这条记忆。',
				keywords: ['测试', '验证', '记忆系统'],
				triggerType: 'keyword' as const,
				priority: 70,
				isConstant: false,
				roleUuid,
				timestamp: Date.now(),
				lastAccessed: Date.now(),
				accessCount: 1,
				relevanceWeight: 0.8,
				emotionalWeight: 0.6,
				timeDecayFactor: 0.1,
				relatedTopics: ['测试', '系统验证'],
				emotionalContext: ['中性'],
				metadata: { source: 'vscode-command', test: true }
			}

			// 添加记忆到数据库
			await memoryService.addEpisodicMemory(
				roleUuid,
				testMemory.content,
				testMemory.keywords,
				{
					priority: testMemory.priority,
					isConstant: false,
					emotionalContext: testMemory.emotionalContext,
					relatedTopics: testMemory.relatedTopics
				}
			)

			vscode.window.showInformationMessage(`测试记忆已添加: ${testMemory.content}`)
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			vscode.window.showErrorMessage(`添加测试记忆失败: ${message}`)
		}
	},
	viewMemories: async () => {
		if (!anhChatServices?.roleMemoryTriggerService) {
			vscode.window.showErrorMessage("Memory service is not initialized.")
			return
		}

		try {
			// 获取当前角色
			const rolePromptData = await provider.getRolePromptData()
			if (!rolePromptData?.role?.uuid) {
				vscode.window.showErrorMessage("No active role found.")
				return
			}

			const roleUuid = rolePromptData.role.uuid
			const memoryService = anhChatServices.roleMemoryTriggerService

			// 获取所有记忆
			const memories = await memoryService.getRecentMemories(roleUuid, 20)

			if (memories.length === 0) {
				vscode.window.showInformationMessage("当前角色没有记忆数据。")
				return
			}

			// 格式化记忆内容
			const memoryList = memories.map((memory, index) => {
				const lastAccessed = new Date(memory.lastAccessed).toLocaleString()
				return `${index + 1}. [${memory.type}] ${memory.content}\n   关键词: ${memory.keywords.join(', ')}\n   优先级: ${memory.priority}\n   最后访问: ${lastAccessed}\n`
			}).join('\n')

			// 显示记忆内容
			const document = await vscode.workspace.openTextDocument({
				content: `角色记忆列表 (${new Date().toLocaleString()})\n\n${memoryList}`,
				language: 'plaintext'
			})
			await vscode.window.showTextDocument(document)

			vscode.window.showInformationMessage(`已显示 ${memories.length} 条记忆。`)
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			vscode.window.showErrorMessage(`查看记忆失败: ${message}`)
		}
	},
	clearMemories: async () => {
		const result = await vscode.window.showWarningMessage(
			"确定要清空当前角色的所有记忆吗？此操作不可撤销。",
			{ modal: true },
			"确定",
			"取消"
		)

		if (result !== "确定") {
			return
		}

		if (!anhChatServices?.roleMemoryTriggerService) {
			vscode.window.showErrorMessage("Memory service is not initialized.")
			return
		}

		try {
			// 获取当前角色
			const rolePromptData = await provider.getRolePromptData()
			if (!rolePromptData?.role?.uuid) {
				vscode.window.showErrorMessage("No active role found.")
				return
			}

			const roleUuid = rolePromptData.role.uuid
			const memoryService = anhChatServices.roleMemoryTriggerService

			// 清空记忆
			await memoryService.clearRoleMemories(roleUuid)

			vscode.window.showInformationMessage("角色记忆已清空。")
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			vscode.window.showErrorMessage(`清空记忆失败: ${message}`)
		}
	},
	testMemoryRetrieval: async () => {
		if (!anhChatServices?.roleMemoryTriggerService) {
			vscode.window.showErrorMessage("Memory service is not initialized.")
			return
		}

		try {
			// 获取当前角色
			const rolePromptData = await provider.getRolePromptData()
			if (!rolePromptData?.role?.uuid) {
				vscode.window.showErrorMessage("No active role found.")
				return
			}

			const roleUuid = rolePromptData.role.uuid
			const memoryService = anhChatServices.roleMemoryTriggerService

			// 测试各种检索功能
			const testResults = []

			// 1. 测试最近记忆检索
			const recentMemories = await memoryService.getRecentMemories(roleUuid, 5)
			testResults.push(`最近记忆检索: ${recentMemories.length} 条`)

			// 2. 测试记忆统计
			const memoryStats = await memoryService.getMemoryStats(roleUuid)
			testResults.push(`记忆统计: 总计 ${memoryStats.total} 条`)

			// 3. 测试常驻记忆检索
			const constantMemories = await memoryService.getConstantMemories(roleUuid)
			testResults.push(`常驻记忆: ${constantMemories.length} 条`)

			// 4. 测试高优先级记忆检索
			const highPriorityMemories = await memoryService.getHighPriorityMemories(roleUuid, 70)
			testResults.push(`高优先级记忆: ${highPriorityMemories.length} 条`)

			// 5. 测试记忆搜索
			const searchResults = await memoryService.searchMemories(roleUuid, '测试')
			testResults.push(`搜索"测试": ${searchResults.length} 条`)

			// 显示测试结果
			const testOutput = `记忆检索测试结果 (${new Date().toLocaleString()})\n\n${testResults.join('\n')}`

			const document = await vscode.workspace.openTextDocument({
				content: testOutput,
				language: 'plaintext'
			})
			await vscode.window.showTextDocument(document)

			vscode.window.showInformationMessage("记忆检索测试完成。")
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			vscode.window.showErrorMessage(`记忆检索测试失败: ${message}`)
		}
	},
})

export const openClineInNewTab = async ({
	context,
	outputChannel,
	anhChatServices,
}: Omit<RegisterCommandOptions, "provider">) => {
	// (This example uses webviewProvider activation event which is necessary to
	// deserialize cached webview, but since we use retainContextWhenHidden, we
	// don't need to use that event).
	// https://github.com/microsoft/vscode-extension-samples/blob/main/webview-sample/src/extension.ts
	const contextProxy = await ContextProxy.getInstance(context)
	const codeIndexManager = CodeIndexManager.getInstance(context)

	// Get the existing MDM service instance to ensure consistent policy enforcement
	let mdmService: MdmService | undefined
	try {
		mdmService = MdmService.getInstance()
	} catch (error) {
		// MDM service not initialized, which is fine - extension can work without it
		mdmService = undefined
	}

	const tabProvider = new ClineProvider(context, outputChannel, "editor", contextProxy, mdmService, anhChatServices)
	const lastCol = Math.max(...vscode.window.visibleTextEditors.map((editor) => editor.viewColumn || 0))

	// Check if there are any visible text editors, otherwise open a new group
	// to the right.
	const hasVisibleEditors = vscode.window.visibleTextEditors.length > 0

	if (!hasVisibleEditors) {
		await vscode.commands.executeCommand("workbench.action.newGroupRight")
	}

	const targetCol = hasVisibleEditors ? Math.max(lastCol + 1, 1) : vscode.ViewColumn.Two

	const newPanel = vscode.window.createWebviewPanel(ClineProvider.tabPanelId, "ANH CHAT", targetCol, {
		enableScripts: true,
		retainContextWhenHidden: true,
		localResourceRoots: [context.extensionUri],
	})

	// Save as tab type panel.
	setPanel(newPanel, "tab")

	// TODO: Use better svg icon with light and dark variants (see
	// https://stackoverflow.com/questions/58365687/vscode-extension-iconpath).
	newPanel.iconPath = {
		light: vscode.Uri.joinPath(context.extensionUri, "assets", "icons", "panel_light.png"),
		dark: vscode.Uri.joinPath(context.extensionUri, "assets", "icons", "panel_dark.png"),
	}

	await tabProvider.resolveWebviewView(newPanel)

	// Add listener for visibility changes to notify webview
	newPanel.onDidChangeViewState(
		(e) => {
			const panel = e.webviewPanel
			if (panel.visible) {
				panel.webview.postMessage({ type: "action", action: "didBecomeVisible" }) // Use the same message type as in SettingsView.tsx
			}
		},
		null, // First null is for `thisArgs`
		context.subscriptions, // Register listener for disposal
	)

	// Handle panel closing events.
	newPanel.onDidDispose(
		() => {
			setPanel(undefined, "tab")
		},
		null,
		context.subscriptions, // Also register dispose listener
	)

	// Lock the editor group so clicking on files doesn't open them over the panel.
	await delay(100)
	await vscode.commands.executeCommand("workbench.action.lockEditorGroup")

	return tabProvider
}
