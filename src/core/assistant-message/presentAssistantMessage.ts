import cloneDeep from "clone-deep"
import { serializeError } from "serialize-error"

import type { ToolName, ClineAsk, ToolProgressStatus } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"

import { defaultModeSlug, getModeBySlug } from "../../shared/modes"
import type { ToolParamName, ToolResponse } from "../../shared/tools"

// XML解析器函数
function extractContentFromXml(xmlString: string): string {
	const extractTagContent = (tag: string): string => {
		const regex = new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, 'is')
		const match = xmlString.match(regex)
		return match ? match[1].trim() : ''
	}

	const extractAttribute = (tag: string, attr: string): string => {
		const regex = new RegExp(`<${tag}[^>]*${attr}=["']([^"']*)["'][^>]*>`, 'i')
		const match = xmlString.match(regex)
		return match ? match[1] : ''
	}

	return extractTagContent('content') || extractAttribute('memory', 'content') || ''
}

function extractTraitNamesFromXml(xmlString: string): string[] {
	const traitRegex = /<trait[^>]*>.*?<\/trait>/gis
	const traitMatches = xmlString.match(traitRegex)
	const traitNames: string[] = []

	if (traitMatches) {
		for (const traitMatch of traitMatches) {
			const extractTagContent = (tag: string): string => {
				const regex = new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, 'is')
				const match = traitMatch.match(regex)
				return match ? match[1].trim() : ''
			}

			const extractAttribute = (tag: string, attr: string): string => {
				const regex = new RegExp(`<${tag}[^>]*${attr}=["']([^"']*)["'][^>]*>`, 'i')
				const match = traitMatch.match(regex)
				return match ? match[1] : ''
			}

			const name = extractTagContent('name') || extractAttribute('trait', 'name')
			if (name) {
				traitNames.push(name)
			}
		}
	}

	return traitNames
}

function extractGoalDescriptionsFromXml(xmlString: string): string[] {
	const goalRegex = /<goal[^>]*>.*?<\/goal>/gis
	const goalMatches = xmlString.match(goalRegex)
	const goalDescriptions: string[] = []

	if (goalMatches) {
		for (const goalMatch of goalMatches) {
			const extractTagContent = (tag: string): string => {
				const regex = new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, 'is')
				const match = goalMatch.match(regex)
				return match ? match[1].trim() : ''
			}

			const extractAttribute = (tag: string, attr: string): string => {
				const regex = new RegExp(`<${tag}[^>]*${attr}=["']([^"']*)["'][^>]*>`, 'i')
				const match = goalMatch.match(regex)
				return match ? match[1] : ''
			}

			const value = extractTagContent('value') || extractAttribute('goal', 'value')
			if (value) {
				goalDescriptions.push(value)
			}
		}
	}

	return goalDescriptions
}

import { fetchInstructionsTool } from "../tools/fetchInstructionsTool"
import { listFilesTool } from "../tools/listFilesTool"
import { getReadFileToolDescription, readFileTool } from "../tools/readFileTool"
import { getSimpleReadFileToolDescription, simpleReadFileTool } from "../tools/simpleReadFileTool"
import { shouldUseSingleFileRead } from "@roo-code/types"
import { writeToFileTool } from "../tools/writeToFileTool"
import { applyDiffTool } from "../tools/multiApplyDiffTool"
import { insertContentTool } from "../tools/insertContentTool"
import { searchAndReplaceTool } from "../tools/searchAndReplaceTool"
import { listCodeDefinitionNamesTool } from "../tools/listCodeDefinitionNamesTool"
import { searchFilesTool } from "../tools/searchFilesTool"
import { browserActionTool } from "../tools/browserActionTool"
import { executeCommandTool } from "../tools/executeCommandTool"
import { useMcpToolTool } from "../tools/useMcpToolTool"
import { accessMcpResourceTool } from "../tools/accessMcpResourceTool"
import { askFollowupQuestionTool } from "../tools/askFollowupQuestionTool"
import { switchModeTool } from "../tools/switchModeTool"
import { attemptCompletionTool } from "../tools/attemptCompletionTool"
import { newTaskTool } from "../tools/newTaskTool"

import { updateTodoListTool } from "../tools/updateTodoListTool"
import { runSlashCommandTool } from "../tools/runSlashCommandTool"
import { generateImageTool } from "../tools/generateImageTool"
import { addEpisodicMemoryTool, addEpisodicMemoryFunction } from "../tools/memoryTools/addEpisodicMemoryTool"
import { addSemanticMemoryTool, addSemanticMemoryFunction } from "../tools/memoryTools/addSemanticMemoryTool"
import { updateTraitsTool, updateTraitsFunction } from "../tools/memoryTools/updateTraitsTool"
import { updateGoalsTool, updateGoalsFunction } from "../tools/memoryTools/updateGoalsTool"
import { searchMemoriesTool, searchMemoriesFunction } from "../tools/memoryTools/searchMemoriesTool"
import { getMemoryStatsTool, getMemoryStatsFunction } from "../tools/memoryTools/getMemoryStatsTool"
import { getRecentMemoriesTool, getRecentMemoriesFunction } from "../tools/memoryTools/getRecentMemoriesTool"
import { cleanupMemoriesTool, cleanupMemoriesFunction } from "../tools/memoryTools/cleanupMemoriesTool"

import { formatResponse } from "../prompts/responses"
import { validateToolUse } from "../tools/validateToolUse"
import { Task } from "../task/Task"
import { codebaseSearchTool } from "../tools/codebaseSearchTool"
import { experiments, EXPERIMENT_IDS } from "../../shared/experiments"
import { applyDiffToolLegacy } from "../tools/applyDiffTool"

/**
 * Processes and presents assistant message content to the user interface.
 *
 * This function is the core message handling system that:
 * - Sequentially processes content blocks from the assistant's response.
 * - Displays text content to the user.
 * - Executes tool use requests with appropriate user approval.
 * - Manages the flow of conversation by determining when to proceed to the next content block.
 * - Coordinates file system checkpointing for modified files.
 * - Controls the conversation state to determine when to continue to the next request.
 *
 * The function uses a locking mechanism to prevent concurrent execution and handles
 * partial content blocks during streaming. It's designed to work with the streaming
 * API response pattern, where content arrives incrementally and needs to be processed
 * as it becomes available.
 */

export async function presentAssistantMessage(cline: Task) {
	if (cline.abort) {
		throw new Error(`[ANH-Chat:Task#presentAssistantMessage] task ${cline.taskId}.${cline.instanceId} aborted`)
	}

	if (cline.presentAssistantMessageLocked) {
		cline.presentAssistantMessageHasPendingUpdates = true
		return
	}

	cline.presentAssistantMessageLocked = true
	cline.presentAssistantMessageHasPendingUpdates = false

	if (cline.currentStreamingContentIndex >= cline.assistantMessageContent.length) {
		// This may happen if the last content block was completed before
		// streaming could finish. If streaming is finished, and we're out of
		// bounds then this means we already  presented/executed the last
		// content block and are ready to continue to next request.
		if (cline.didCompleteReadingStream) {
			cline.userMessageContentReady = true
			// Notify frontend that user message content is ready
			await cline.providerRef.deref()?.postStateToWebview()
		}

		cline.presentAssistantMessageLocked = false
		return
	}

	const block = cloneDeep(cline.assistantMessageContent[cline.currentStreamingContentIndex]) // need to create copy bc while stream is updating the array, it could be updating the reference block properties too

	switch (block.type) {
		case "text": {
			if (cline.didRejectTool || cline.didAlreadyUseTool) {
				break
			}

			let content = block.content

			if (content) {
				// Have to do this for partial and complete since sending
				// content in thinking tags to markdown renderer will
				// automatically be removed.
				// Remove end substrings of <thinking or </thinking (below xml
				// parsing is only for opening tags).
				// Tthis is done with the xml parsing below now, but keeping
				// here for reference.
				// content = content.replace(/<\/?t(?:h(?:i(?:n(?:k(?:i(?:n(?:g)?)?)?$/, "")
				//
				// Remove all instances of <thinking> (with optional line break
				// after) and </thinking> (with optional line break before).
				// - Needs to be separate since we dont want to remove the line
				//   break before the first tag.
				// - Needs to happen before the xml parsing below.
				content = content.replace(/<thinking>\s?/g, "")
				content = content.replace(/\s?<\/thinking>/g, "")

				// Remove partial XML tag at the very end of the content (for
				// tool use and thinking tags), Prevents scrollview from
				// jumping when tags are automatically removed.
				const lastOpenBracketIndex = content.lastIndexOf("<")

				if (lastOpenBracketIndex !== -1) {
					const possibleTag = content.slice(lastOpenBracketIndex)

					// Check if there's a '>' after the last '<' (i.e., if the
					// tag is complete) (complete thinking and tool tags will
					// have been removed by now.)
					const hasCloseBracket = possibleTag.includes(">")

					if (!hasCloseBracket) {
						// Extract the potential tag name.
						let tagContent: string

						if (possibleTag.startsWith("</")) {
							tagContent = possibleTag.slice(2).trim()
						} else {
							tagContent = possibleTag.slice(1).trim()
						}

						// Check if tagContent is likely an incomplete tag name
						// (letters and underscores only).
						const isLikelyTagName = /^[a-zA-Z_]+$/.test(tagContent)

						// Preemptively remove < or </ to keep from these
						// artifacts showing up in chat (also handles closing
						// thinking tags).
						const isOpeningOrClosing = possibleTag === "<" || possibleTag === "</"

						// If the tag is incomplete and at the end, remove it
						// from the content.
						if (isOpeningOrClosing || isLikelyTagName) {
							content = content.slice(0, lastOpenBracketIndex).trim()
						}
					}
				}
			}

			await cline.say("text", content, undefined, block.partial)
			break
		}
		case "tool_use":
			const provider = cline.providerRef.deref()
			const toolDescription = (): string => {
				switch (block.name) {
					case "execute_command":
						return `[${block.name} for '${block.params.command}']`
					case "read_file":
						// Check if this model should use the simplified description
						const modelId = cline.api.getModel().id
						if (shouldUseSingleFileRead(modelId)) {
							return getSimpleReadFileToolDescription(block.name, block.params)
						} else {
							return getReadFileToolDescription(block.name, block.params)
						}
					case "fetch_instructions":
						return `[${block.name} for '${block.params.task}']`
					case "write_to_file":
						return `[${block.name} for '${block.params.path}']`
					case "apply_diff":
						// Handle both legacy format and new multi-file format
						if (block.params.path) {
							return `[${block.name} for '${block.params.path}']`
						} else if (block.params.args) {
							// Try to extract first file path from args for display
							const match = block.params.args.match(/<file>.*?<path>([^<]+)<\/path>/s)
							if (match) {
								const firstPath = match[1]
								// Check if there are multiple files
								const fileCount = (block.params.args.match(/<file>/g) || []).length
								if (fileCount > 1) {
									return `[${block.name} for '${firstPath}' and ${fileCount - 1} more file${fileCount > 2 ? "s" : ""}]`
								} else {
									return `[${block.name} for '${firstPath}']`
								}
							}
						}
						return `[${block.name}]`
					case "search_files":
						return `[${block.name} for '${block.params.regex}'${block.params.file_pattern ? ` in '${block.params.file_pattern}'` : ""
							}]`
					case "insert_content":
						return `[${block.name} for '${block.params.path}']`
					case "search_and_replace":
						return `[${block.name} for '${block.params.path}']`
					case "list_files":
						return `[${block.name} for '${block.params.path}']`
					case "list_code_definition_names":
						return `[${block.name} for '${block.params.path}']`
					case "browser_action":
						return `[${block.name} for '${block.params.action}']`
					case "use_mcp_tool":
						return `[${block.name} for '${block.params.server_name}']`
					case "access_mcp_resource":
						return `[${block.name} for '${block.params.server_name}']`
					case "ask_followup_question":
						return `[${block.name} for '${block.params.question}']`
					case "attempt_completion":
						return `[${block.name}]`
					case "switch_mode":
						return `[${block.name} to '${block.params.mode_slug}'${block.params.reason ? ` because: ${block.params.reason}` : ""}]`
					case "codebase_search": // Add case for the new tool
						return `[${block.name} for '${block.params.query}']`
					case "update_todo_list":
						return `[${block.name}]`
					case "new_task": {
						const mode = block.params.mode ?? defaultModeSlug
						const message = block.params.message ?? "(no message)"
						const modeName = getModeBySlug(mode, customModes)?.name ?? mode
						return `[${block.name} in ${modeName} mode: '${message}']`
					}
					case "run_slash_command":
						return `[${block.name} for '${block.params.command}'${block.params.args ? ` with args: ${block.params.args}` : ""}]`
					case "generate_image":
						return `[${block.name} for '${block.params.path}']`
					case "add_episodic_memory":
						return `[${block.name} for 添加情景记忆]`
					case "add_semantic_memory":
						return `[${block.name} for 添加语义记忆]`
					case "update_traits":
						return `[${block.name} for 更新角色特质]`
					case "update_goals":
						return `[${block.name} for 更新角色目标]`
					case "search_memories":
						return `[${block.name} for '${(block.params as any).search_text || "搜索记忆"}']`
					case "get_memory_stats":
						return `[${block.name} for 获取记忆统计]`
					case "get_recent_memories":
						return `[${block.name} for 获取最近记忆]`
					case "cleanup_memories":
						return `[${block.name} for 清理过期记忆]`
					default: {
						const extensionTool = provider?.getAnhExtensionToolByName(block.name)
						if (extensionTool) {
							return `[${extensionTool.displayName}]`
						}

						return `[${block.name}]`
					}
				}
			}

			if (cline.didRejectTool) {
				// Ignore any tool content after user has rejected tool once.
				if (!block.partial) {
					cline.userMessageContent.push({
						type: "text",
						text: `Skipping tool ${toolDescription()} due to user rejecting a previous tool.`,
					})
				} else {
					// Partial tool after user rejected a previous tool.
					cline.userMessageContent.push({
						type: "text",
						text: `Tool ${toolDescription()} was interrupted and not executed due to user rejecting a previous tool.`,
					})
				}

				break
			}

			if (cline.didAlreadyUseTool) {
				// Ignore any content after a tool has already been used.
				cline.userMessageContent.push({
					type: "text",
					text: `Tool [${block.name}] was not executed because a tool has already been used in this message. Only one tool may be used per message. You must assess the first tool's result before proceeding to use the next tool.`,
				})

				break
			}

			const pushToolResult = (content: ToolResponse) => {
				if (true) {
					cline.userMessageContent.push({ type: "text", text: `${toolDescription()} Result:` })
				}

				if (typeof content === "string") {
					cline.userMessageContent.push({ type: "text", text: content || "(tool did not return anything)" })
				} else {
					cline.userMessageContent.push(...content)
				}

				// Once a tool result has been collected, ignore all other tool
				// uses since we should only ever present one tool result per
				// message.
				cline.didAlreadyUseTool = true
			}

			const askApproval = async (
				type: ClineAsk,
				partialMessage?: string,
				progressStatus?: ToolProgressStatus,
				isProtected?: boolean,
			) => {
				const { response, text, images } = await cline.ask(
					type,
					partialMessage,
					false,
					progressStatus,
					isProtected || false,
				)

				if (response !== "yesButtonClicked") {
					// Handle both messageResponse and noButtonClicked with text.
					if (text) {
						await cline.say("user_feedback", text, images)
						pushToolResult(formatResponse.toolResult(formatResponse.toolDeniedWithFeedback(text), images))
					} else {
						pushToolResult(formatResponse.toolDenied())
					}
					cline.didRejectTool = true
					return false
				}

				// Handle yesButtonClicked with text.
				if (text) {
					await cline.say("user_feedback", text, images)
					pushToolResult(formatResponse.toolResult(formatResponse.toolApprovedWithFeedback(text), images))
				}

				return true
			}

			const askFinishSubTaskApproval = async () => {
				// Ask the user to approve this task has completed, and he has
				// reviewed it, and we can declare task is finished and return
				// control to the parent task to continue running the rest of
				// the sub-tasks.
				const toolMessage = JSON.stringify({ tool: "finishTask" })
				return await askApproval("tool", toolMessage)
			}

			const handleError = async (action: string, error: Error) => {
				const errorString = `Error ${action}: ${JSON.stringify(serializeError(error))}`

				await cline.say(
					"error",
					`Error ${action}:\n${error.message ?? JSON.stringify(serializeError(error), null, 2)}`,
				)

				pushToolResult(formatResponse.toolError(errorString))
			}

			// If block is partial, remove partial closing tag so its not
			// presented to user.
			const removeClosingTag = (tag: ToolParamName, text?: string): string => {
				if (!block.partial) {
					return text || ""
				}

				if (!text) {
					return ""
				}

				// This regex dynamically constructs a pattern to match the
				// closing tag:
				// - Optionally matches whitespace before the tag.
				// - Matches '<' or '</' optionally followed by any subset of
				//   characters from the tag name.
				const tagRegex = new RegExp(
					`\\s?<\/?${tag
						.split("")
						.map((char) => `(?:${char})?`)
						.join("")}$`,
					"g",
				)

				return text.replace(tagRegex, "")
			}

			if (block.name !== "browser_action") {
				await cline.browserSession.closeBrowser()
			}

			if (!block.partial) {
				cline.recordToolUsage(block.name)
				TelemetryService.instance.captureToolUsage(cline.taskId, block.name)
			}

			// Validate tool use before execution.
			const { mode, customModes } = (await cline.providerRef.deref()?.getState()) ?? {}

			try {
				validateToolUse(
					block.name as ToolName,
					mode ?? defaultModeSlug,
					customModes ?? [],
					{ apply_diff: cline.diffEnabled },
					block.params,
				)
			} catch (error) {
				cline.consecutiveMistakeCount++
				pushToolResult(formatResponse.toolError(error.message))
				break
			}

			// Check for identical consecutive tool calls.
			if (!block.partial) {
				// Use the detector to check for repetition, passing the ToolUse
				// block directly.
				const repetitionCheck = cline.toolRepetitionDetector.check(block)

				// If execution is not allowed, notify user and break.
				if (!repetitionCheck.allowExecution && repetitionCheck.askUser) {
					// Handle repetition similar to mistake_limit_reached pattern.
					const { response, text, images } = await cline.ask(
						repetitionCheck.askUser.messageKey as ClineAsk,
						repetitionCheck.askUser.messageDetail.replace("{toolName}", block.name),
					)

					if (response === "messageResponse") {
						// Add user feedback to userContent.
						cline.userMessageContent.push(
							{
								type: "text" as const,
								text: `Tool repetition limit reached. User feedback: ${text}`,
							},
							...formatResponse.imageBlocks(images),
						)

						// Add user feedback to chat.
						await cline.say("user_feedback", text, images)

						// Track tool repetition in telemetry.
						TelemetryService.instance.captureConsecutiveMistakeError(cline.taskId)
					}

					// Return tool result message about the repetition
					pushToolResult(
						formatResponse.toolError(
							`Tool call repetition limit reached for ${block.name}. Please try a different approach.`,
						),
					)
					break
				}
			}

			switch (block.name) {
				case "write_to_file":
					await checkpointSaveAndMark(cline)
					await writeToFileTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
					break
				case "update_todo_list":
					await updateTodoListTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
					break
				case "apply_diff": {
					// Get the provider and state to check experiment settings
					const provider = cline.providerRef.deref()
					let isMultiFileApplyDiffEnabled = false

					if (provider) {
						const state = await provider.getState()
						isMultiFileApplyDiffEnabled = experiments.isEnabled(
							state.experiments ?? {},
							EXPERIMENT_IDS.MULTI_FILE_APPLY_DIFF,
						)
					}

					if (isMultiFileApplyDiffEnabled) {
						await checkpointSaveAndMark(cline)
						await applyDiffTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
					} else {
						await checkpointSaveAndMark(cline)
						await applyDiffToolLegacy(
							cline,
							block,
							askApproval,
							handleError,
							pushToolResult,
							removeClosingTag,
						)
					}
					break
				}
				case "insert_content":
					await checkpointSaveAndMark(cline)
					await insertContentTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
					break
				case "search_and_replace":
					await checkpointSaveAndMark(cline)
					await searchAndReplaceTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
					break
				case "read_file":
					// Check if this model should use the simplified single-file read tool
					const modelId = cline.api.getModel().id
					if (shouldUseSingleFileRead(modelId)) {
						await simpleReadFileTool(
							cline,
							block,
							askApproval,
							handleError,
							pushToolResult,
							removeClosingTag,
						)
					} else {
						await readFileTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
					}
					break
				case "fetch_instructions":
					await fetchInstructionsTool(cline, block, askApproval, handleError, pushToolResult)
					break
				case "list_files":
					await listFilesTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
					break
				case "codebase_search":
					await codebaseSearchTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
					break
				case "list_code_definition_names":
					await listCodeDefinitionNamesTool(
						cline,
						block,
						askApproval,
						handleError,
						pushToolResult,
						removeClosingTag,
					)
					break
				case "search_files":
					await searchFilesTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
					break
				case "browser_action":
					await browserActionTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
					break
				case "execute_command":
					await executeCommandTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
					break
				case "use_mcp_tool":
					await useMcpToolTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
					break
				case "access_mcp_resource":
					await accessMcpResourceTool(
						cline,
						block,
						askApproval,
						handleError,
						pushToolResult,
						removeClosingTag,
					)
					break
				case "ask_followup_question":
					await askFollowupQuestionTool(
						cline,
						block,
						askApproval,
						handleError,
						pushToolResult,
						removeClosingTag,
					)
					break
				case "switch_mode":
					await switchModeTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
					break
				case "new_task":
					await newTaskTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
					break
				case "attempt_completion":
					await attemptCompletionTool(
						cline,
						block,
						askApproval,
						handleError,
						pushToolResult,
						removeClosingTag,
						toolDescription,
						askFinishSubTaskApproval,
					)
					break
				case "run_slash_command":
					await runSlashCommandTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
					break
				case "generate_image":
					await generateImageTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
					break
				case "add_episodic_memory":
					// 等待参数完全解析后再执行
					if (block.partial) {
						break
					}
					try {
						const result = await addEpisodicMemoryFunction(cline, block)
						if (result?.message || result?.success) {
							// 使用动态的用户消息
							const userMessage = (block.params as any).user_message || "我将这段珍贵的经历保存到了我的记忆中"
							await cline.say("text", userMessage)
							pushToolResult("记忆已保存")
						} else {
							await cline.say("text", "抱歉，我在保存这段记忆时遇到了一些问题。")
							pushToolResult("记忆保存失败")
						}
					} catch (error) {
						await cline.say("text", "我在尝试保存记忆时感到了困惑，让我再想想...")
						await handleError("添加情景记忆", error as Error)
					}
					break
				case "add_semantic_memory":
					// 等待参数完全解析后再执行
					if (block.partial) {
						break
					}
					try {
						const result = await addSemanticMemoryFunction(cline, block)
						if (result?.message || result?.success) {
							// 使用动态的用户消息
							const userMessage = (block.params as any).user_message || "我记下了这个重要的信息"
							await cline.say("text", userMessage)
							pushToolResult("信息已记录")
						} else {
							await cline.say("text", "抱歉，我在记录这条信息时遇到了一些问题。")
							pushToolResult("信息记录失败")
						}
					} catch (error) {
						await cline.say("text", "我在尝试记录信息时感到了困惑，让我再想想...")
						await handleError("添加语义记忆", error as Error)
					}
					break
				case "update_traits":
					// 等待参数完全解析后再执行
					if (block.partial) {
						break
					}
					try {
						const result = await updateTraitsFunction(cline, block)
						if (result?.message || result?.success) {
							// 使用动态的用户消息
							const userMessage = (block.params as any).user_message || "我对你的理解又加深了一些"
							await cline.say("text", userMessage)
							pushToolResult("特质已更新")
						} else {
							await cline.say("text", "抱歉，我在更新对你的理解时遇到了一些问题。")
							pushToolResult("特质更新失败")
						}
					} catch (error) {
						await cline.say("text", "我在尝试理解你的特质时感到了困惑，让我再想想...")
						await handleError("更新角色特质", error as Error)
					}
					break
				case "update_goals":
					// 等待参数完全解析后再执行
					if (block.partial) {
						break
					}
					try {
						const result = await updateGoalsFunction(cline, block)
						if (result?.message || result?.success) {
							// 使用动态的用户消息
							const userMessage = (block.params as any).user_message || "我记下了你的目标，会支持你实现它们"
							await cline.say("text", userMessage)
							pushToolResult("目标已更新")
						} else {
							await cline.say("text", "抱歉，我在记录你的目标时遇到了一些问题。")
							pushToolResult("目标更新失败")
						}
					} catch (error) {
						await cline.say("text", "我在尝试记录你的目标时感到了困惑，让我再想想...")
						await handleError("更新角色目标", error as Error)
					}
					break
				case "search_memories":
					// 等待参数完全解析后再执行
					if (block.partial) {
						break
					}
					try {
						const searchText = (block.params as any).search_text || "相关内容"
						await cline.say("text", `让我在记忆中搜索关于"${searchText}"的内容...`)
						const result = await searchMemoriesFunction(cline, block)
						if (result?.success && result?.results && result.results.length > 0) {
							await cline.say("text", "我想起了一些相关的事情...")

							// 格式化搜索结果
							const memoryContent = result.results.map((memory: any) => {
								const relevanceScore = memory.relevanceScore ? ` (相关性: ${Math.round(memory.relevanceScore * 100)}%)` : ''
								const timestamp = memory.timestamp || '未知时间'
								const type = memory.type || '未知类型'
								const content = memory.content || '无内容'
								return `[${type}] ${timestamp}${relevanceScore}: ${content}`
							}).join('\n')

							const summary = `找到了 ${result.results.length} 条相关记忆：\n\n${memoryContent}`
							pushToolResult(summary)
						} else if (result?.success && (!result.results || result.results.length === 0)) {
							await cline.say("text", "我想不起来关于这个的内容...")
							pushToolResult("没有找到相关记忆")
						} else {
							await cline.say("text", "抱歉，我在回忆相关内容时遇到了一些问题。")
							pushToolResult(result?.error || "记忆搜索失败")
						}
					} catch (error) {
						await cline.say("text", "我在尝试回忆时感到了困惑，让我再想想...")
						await handleError("搜索记忆", error as Error)
					}
					break
				case "get_memory_stats":
					// 等待参数完全解析后再执行
					if (block.partial) {
						break
					}
					try {
						await cline.say("text", "让我整理一下我的记忆...")
						const result = await getMemoryStatsFunction(cline, block)
						if (result?.success && result?.stats) {
							await cline.say("text", "我已经整理好了我的记忆，现在可以和你分享了。")

							// 格式化统计信息
							const stats = result.stats
							const statsContent = `
总计记忆: ${stats.total || 0} 条
情景记忆: ${stats.episodic || 0} 条
语义记忆: ${stats.semantic || 0} 条
角色特质: ${stats.traits || 0} 条
角色目标: ${stats.goals || 0} 条
常驻记忆: ${stats.constant || 0} 条
高优先级记忆: ${stats.highPriority || 0} 条
平均访问次数: ${stats.avgAccessCount || 0}
最后访问: ${stats.lastAccess || '从未'}
`.trim()

							pushToolResult(statsContent)
						} else {
							await cline.say("text", "抱歉，我在整理记忆时遇到了一些问题。")
							pushToolResult(result?.error || "记忆统计失败")
						}
					} catch (error) {
						await cline.say("text", "我在尝试整理记忆时感到了困惑，让我再想想...")
						await handleError("获取记忆统计", error as Error)
					}
					break
				case "get_recent_memories":
					// 等待参数完全解析后再执行
					if (block.partial) {
						break
					}
					try {
						await cline.say("text", "让我回想一下最近发生的事情...")
						const result = await getRecentMemoriesFunction(cline, block)
						if (result?.success && result?.memories && result.memories.length > 0) {
							await cline.say("text", "我想起了一些最近的经历...")

							// 格式化记忆内容用于显示
							const memoryContent = result.memories.map((memory: any) => {
								const timestamp = memory.timestamp || '未知时间'
								const type = memory.type || '未知类型'
								const content = memory.content || '无内容'
								return `[${type}] ${timestamp}: ${content}`
							}).join('\n')

							const summary = `找到了 ${result.memories.length} 条最近的记忆：\n\n${memoryContent}`
							pushToolResult(summary)
						} else if (result?.success && (!result.memories || result.memories.length === 0)) {
							await cline.say("text", "我最近似乎没有特别的记忆...")
							pushToolResult("没有找到最近的记忆")
						} else {
							await cline.say("text", "抱歉，我在回想最近的事情时遇到了一些问题。")
							pushToolResult(result?.error || "最近记忆获取失败")
						}
					} catch (error) {
						await cline.say("text", "我在尝试回想时感到了困惑，让我再想想...")
						await handleError("获取最近记忆", error as Error)
					}
					break
				case "cleanup_memories":
					// 等待参数完全解析后再执行
					if (block.partial) {
						break
					}
					try {
						await cline.say("text", "让我整理一下我的记忆，清理一些不再那么重要的内容...")
						const result = await cleanupMemoriesFunction(cline, block)
						if (result?.message || result?.success) {
							await cline.say("text", "我已经整理好了我的记忆，保留下了真正重要的瞬间。")
							pushToolResult("记忆清理完成")
						} else {
							await cline.say("text", "抱歉，我在整理记忆时遇到了一些问题。")
							pushToolResult("记忆清理失败")
						}
					} catch (error) {
						await cline.say("text", "我在尝试整理记忆时感到了困惑，让我再想想...")
						await handleError("清理记忆", error as Error)
					}
					break
				default: {
					if (block.partial) {
						break
					}

					if (!provider) {
						pushToolResult(formatResponse.toolError(`Extension tool '${block.name}' cannot run without a provider context.`))
						break
					}

					const extensionTool = provider.getAnhExtensionToolByName(block.name)
					if (!extensionTool) {
						pushToolResult(formatResponse.toolError(`Unknown tool '${block.name}'.`))
						break
					}

					let approved = true
					if (extensionTool.requiresApproval) {
						const approvalPayload = JSON.stringify({ tool: block.name, params: block.params })
						approved = await askApproval("tool", approvalPayload)
						if (!approved) {
							break
						}
					}

					try {
						const mode = await cline.getTaskMode().catch(() => undefined)
						const providerState = await provider.getState()
						const result = await provider.invokeAnhExtensionTool(block.name, {
							parameters: block.params,
							taskId: cline.taskId,
							cwd: cline.cwd,
							workspacePath: cline.workspacePath,
							mode,
							providerState,
						})

						if (!result) {
							cline.consecutiveMistakeCount = 0
							pushToolResult("")
							break
						}

						if (!result.success) {
							cline.consecutiveMistakeCount++
							pushToolResult(formatResponse.toolError(result.error))
							break
						}

						cline.consecutiveMistakeCount = 0

						if (result.blocks?.length) {
							const blockResponses = result.blocks.map((toolBlock) => {
								if (toolBlock.type === "text") {
									return { type: "text" as const, text: toolBlock.text }
								}

								return {
									type: "image" as const,
									source: { type: "base64", media_type: toolBlock.mimeType, data: toolBlock.base64 },
									alt_text: toolBlock.altText,
								}
							})

							pushToolResult(blockResponses as ToolResponse)
						} else {
							pushToolResult(result.message ?? "")
						}
					} catch (error) {
						await handleError("executing extension tool", error as Error)
					}

					break
				}
			}

			break
	}

	// Seeing out of bounds is fine, it means that the next too call is being
	// built up and ready to add to assistantMessageContent to present.
	// When you see the UI inactive during this, it means that a tool is
	// breaking without presenting any UI. For example the write_to_file tool
	// was breaking when relpath was undefined, and for invalid relpath it never
	// presented UI.
	// This needs to be placed here, if not then calling
	// cline.presentAssistantMessage below would fail (sometimes) since it's
	// locked.
	cline.presentAssistantMessageLocked = false

	// NOTE: When tool is rejected, iterator stream is interrupted and it waits
	// for `userMessageContentReady` to be true. Future calls to present will
	// skip execution since `didRejectTool` and iterate until `contentIndex` is
	// set to message length and it sets userMessageContentReady to true itself
	// (instead of preemptively doing it in iterator).
	if (!block.partial || cline.didRejectTool || cline.didAlreadyUseTool) {
		// Block is finished streaming and executing.
		if (cline.currentStreamingContentIndex === cline.assistantMessageContent.length - 1) {
			// It's okay that we increment if !didCompleteReadingStream, it'll
			// just return because out of bounds and as streaming continues it
			// will call `presentAssitantMessage` if a new block is ready. If
			// streaming is finished then we set `userMessageContentReady` to
			// true when out of bounds. This gracefully allows the stream to
			// continue on and all potential content blocks be presented.
			// Last block is complete and it is finished executing
			cline.userMessageContentReady = true // Will allow `pWaitFor` to continue.
			// Notify frontend that user message content is ready
			await cline.providerRef.deref()?.postStateToWebview()
			console.debug(
				"[Task] userMessageContentReady set true - Backend ready for new input",
				JSON.stringify({
					taskId: cline.taskId,
					instanceId: cline.instanceId,
					blockType: block.type,
					didRejectTool: cline.didRejectTool,
					didAlreadyUseTool: cline.didAlreadyUseTool,
					timestamp: Date.now()
				}),
			)
		}

		// Call next block if it exists (if not then read stream will call it
		// when it's ready).
		// Need to increment regardless, so when read stream calls this function
		// again it will be streaming the next block.
		cline.currentStreamingContentIndex++

		if (cline.currentStreamingContentIndex < cline.assistantMessageContent.length) {
			// There are already more content blocks to stream, so we'll call
			// this function ourselves.
			presentAssistantMessage(cline)
			return
		}
	}

	// Block is partial, but the read stream may have finished.
	if (cline.presentAssistantMessageHasPendingUpdates) {
		presentAssistantMessage(cline)
	} else {
		// 🔧 NEW: In chat mode, if stream is complete and no more content, ensure userMessageContentReady
		const state = await cline.providerRef.deref()?.getState()
		const allowNoToolsInChatMode = state?.allowNoToolsInChatMode ?? false
		const currentMode = state?.mode ?? defaultModeSlug

		if (allowNoToolsInChatMode &&
			currentMode === "chat" &&
			cline.didCompleteReadingStream &&
			cline.currentStreamingContentIndex >= cline.assistantMessageContent.length &&
			!cline.userMessageContentReady) {
			cline.userMessageContentReady = true
			cline.providerRef.deref()?.log("[Task] Chat mode: Stream complete, setting userMessageContentReady")
			// Notify frontend that user message content is ready
			await cline.providerRef.deref()?.postStateToWebview()
		}
	}
}

/**
 * save checkpoint and mark done in the current streaming task.
 * @param task The Task instance to checkpoint save and mark.
 * @returns
 */
async function checkpointSaveAndMark(task: Task) {
	if (task.currentStreamingDidCheckpoint) {
		return
	}
	try {
		await task.checkpointSave(true)
		task.currentStreamingDidCheckpoint = true
	} catch (error) {
		console.error(`[ANH-Chat:Task#presentAssistantMessage] Error saving checkpoint: ${error.message}`, error)
	}
}



