import { STProfileProcessor, UserInputProcessor, AIOutputProcessor, PostProcessor, RegexTargetSource } from "@roo-code/types"
import { debugLog } from "../../utils/debug"

export interface RegexProcessors {
	userInput: UserInputProcessor
	aiOutput: AIOutputProcessor
	postProcess: PostProcessor
}

export interface ProcessingContext {
	variables?: Record<string, any>
	stage?: string
}

/**
 * 正则处理器管理器
 * 负责管理和协调各个阶段的正则处理器
 */
export class RegexProcessorManager {
	private processors: RegexProcessors | null = null
	private isEnabled: boolean = false
	private currentProfile: any = null
	private currentMixin: any = null

	constructor() {
		this.isEnabled = false
	}

	/**
	 * 启用或禁用正则处理器
	 */
	setEnabled(enabled: boolean): void {
		const wasEnabled = this.isEnabled
		this.isEnabled = enabled

		console.log(`[RegexProcessorManager] 🎛️ Regex processor ${enabled ? 'ENABLED' : 'DISABLED'} (was ${wasEnabled ? 'ENABLED' : 'DISABLED'})`)

		if (!enabled) {
			this.processors = null
			this.currentProfile = null
			this.currentMixin = null
			console.log(`[RegexProcessorManager] 🧹 Processors cleared due to disable`)
		} else if (!wasEnabled && enabled) {
			console.log(`[RegexProcessorManager] 🎬 Regex processor enabled - ready for initialization`)
		}

		debugLog(`Regex processor ${enabled ? 'enabled' : 'disabled'}`)
	}

	/**
	 * 检查是否启用
	 */
	isProcessorEnabled(): boolean {
		return this.isEnabled && this.processors !== null
	}

	/**
	 * 初始化处理器
	 */
	async initializeProcessors(profileData?: any, mixinData?: any): Promise<void> {
		console.log(`[RegexProcessorManager] 🚀 Initializing regex processors...`)
		console.log(`[RegexProcessorManager] 📋 Enabled: ${this.isEnabled}, Profile: ${profileData ? 'YES' : 'NO'}, Mixin: ${mixinData ? 'YES' : 'NO'}`)

		if (!this.isEnabled) {
			console.log(`[RegexProcessorManager] ⏭️ Regex processor is disabled, skipping initialization`)
			return
		}

		try {
			this.currentProfile = profileData
			this.currentMixin = mixinData

			// 创建主处理器
			console.log(`[RegexProcessorManager] 🔧 Creating STProfileProcessor...`)
			const processor = new STProfileProcessor()

			// 处理profile和mixin
			console.log(`[RegexProcessorManager] 🔄 Processing profile and mixin data...`)
			const startTime = Date.now()
			const result = await processor.process({ name: "user", type: "主角" } as any, profileData, mixinData)
			const processingTime = Date.now() - startTime

			console.log(`[RegexProcessorManager] ⏱️ Profile processing completed in ${processingTime}ms`)
			console.log(`[RegexProcessorManager] 📊 Processing result:`, {
				success: result.success,
				hasProcessors: !!result.processors,
				errors: result.errors || [],
				warnings: result.warnings || []
			})

			if (result.success && result.processors) {
				this.processors = {
					userInput: result.processors.userInput,
					aiOutput: result.processors.aiOutput,
					postProcess: result.processors.postProcess
				}
				console.log(`[RegexProcessorManager] ✅ Regex processors initialized successfully!`)
				console.log(`[RegexProcessorManager] 🎯 Available processors:`, {
					userInput: !!this.processors.userInput,
					aiOutput: !!this.processors.aiOutput,
					postProcess: !!this.processors.postProcess
				})

				// Log processor details if available
				if (this.processors.userInput) {
					console.log(`[RegexProcessorManager] 🔢 User input processor initialized`)
				}
				if (this.processors.aiOutput) {
					console.log(`[RegexProcessorManager] 🔢 AI output processor initialized`)
				}
				if (this.processors.postProcess) {
					console.log(`[RegexProcessorManager] 🔢 Post-process processor initialized`)
				}

				debugLog("Regex processors initialized successfully")
			} else {
				console.warn(`[RegexProcessorManager] ❌ Failed to initialize regex processors`)
				console.warn(`[RegexProcessorManager] 📋 Errors:`, result.errors || [])
				console.warn(`[RegexProcessorManager] 📋 Warnings:`, result.warnings || [])
				this.processors = null
			}
		} catch (error) {
			console.error("[RegexProcessorManager] 💥 Error initializing regex processors:", error)
			this.processors = null
		}
	}

	/**
	 * 处理用户输入
	 */
	processUserInput(userInput: string, context?: ProcessingContext): string {
		if (!this.isProcessorEnabled() || !this.processors) {
			debugLog(`[RegexProcessorManager] User input processor disabled or not initialized, returning original input`)
			return userInput
		}

		try {
			const startTime = Date.now()
			const processed = this.processors.userInput.processUserInput(userInput, {
				variables: context?.variables || {}
			})
			const processingTime = Date.now() - startTime

			// Always log when processor is enabled
			console.log(`[RegexProcessorManager] 🔍 User input processing (${processingTime}ms)`)
			console.log(`[RegexProcessorManager] 📥 Stage: user_input, Variables:`, context?.variables || {})

			if (processed !== userInput) {
				console.log(`[RegexProcessorManager] ✅ User input CHANGED by regex processing`)
				console.log(`[RegexProcessorManager] 📊 Before (${userInput.length} chars): "${userInput}"`)
				console.log(`[RegexProcessorManager] 📊 After (${processed.length} chars): "${processed}"`)

				// Show diff for changes
				this.logDiff(userInput, processed, "User Input")
			} else {
				console.log(`[RegexProcessorManager] ⏭️ User input unchanged by regex processing`)
				console.log(`[RegexProcessorManager] 📊 Content (${userInput.length} chars): "${userInput.substring(0, 100)}${userInput.length > 100 ? "..." : ""}"`)
			}

			debugLog(`User input processed: "${userInput}" -> "${processed}"`)
			return processed
		} catch (error) {
			console.warn("[RegexProcessorManager] ❌ Error processing user input:", error)
			return userInput
		}
	}

	/**
	 * 处理AI输出
	 */
	processAIOutput(aiOutput: string, context?: ProcessingContext): string {
		if (!this.isProcessorEnabled() || !this.processors) {
			debugLog(`[RegexProcessorManager] AI output processor disabled or not initialized, returning original output`)
			return aiOutput
		}

		try {
			const startTime = Date.now()
			const processed = this.processors.aiOutput.processAIOutput(aiOutput, {
				variables: context?.variables || {}
			})
			const processingTime = Date.now() - startTime

			// Always log when processor is enabled
			console.log(`[RegexProcessorManager] 🤖 AI output processing (${processingTime}ms)`)
			console.log(`[RegexProcessorManager] 📥 Stage: ai_output, Variables:`, context?.variables || {})
			console.log(`[RegexProcessorManager] 💡 Note: For streaming AI responses, this should be called only on the complete message, not individual chunks`)

			if (processed !== aiOutput) {
				console.log(`[RegexProcessorManager] ✅ AI output CHANGED by regex processing`)
				console.log(`[RegexProcessorManager] 📊 Before (${aiOutput.length} chars): "${aiOutput.substring(0, 200)}${aiOutput.length > 200 ? "..." : ""}"`)
				console.log(`[RegexProcessorManager] 📊 After (${processed.length} chars): "${processed.substring(0, 200)}${processed.length > 200 ? "..." : ""}"`)

				// Show diff for changes
				this.logDiff(aiOutput, processed, "AI Output")
			} else {
				console.log(`[RegexProcessorManager] ⏭️ AI output unchanged by regex processing`)
				console.log(`[RegexProcessorManager] 📊 Content (${aiOutput.length} chars): "${aiOutput.substring(0, 100)}${aiOutput.length > 100 ? "..." : ""}"`)
			}

			debugLog(`AI output processed: "${aiOutput.substring(0, 50)}..." -> "${processed.substring(0, 50)}..."`)
			return processed
		} catch (error) {
			console.warn("[RegexProcessorManager] ❌ Error processing AI output:", error)
			return aiOutput
		}
	}

	/**
	 * 处理最终内容
	 */
	processFinalContent(content: string, targetSource: RegexTargetSource = RegexTargetSource.ALL_CONTENT, context?: ProcessingContext): string {
		if (!this.isProcessorEnabled() || !this.processors) {
			debugLog(`[RegexProcessorManager] Final content processor disabled or not initialized, returning original content`)
			return content
		}

		try {
			const startTime = Date.now()
			const processed = this.processors.postProcess.processFinalContent(content, targetSource, {
				variables: context?.variables || {}
			})
			const processingTime = Date.now() - startTime

			// Always log when processor is enabled
			console.log(`[RegexProcessorManager] 📝 Final content processing (${processingTime}ms)`)
			console.log(`[RegexProcessorManager] 📥 Stage: ${context?.stage || 'unknown'}, Target: ${targetSource}, Variables:`, context?.variables || {})

			if (processed !== content) {
				console.log(`[RegexProcessorManager] ✅ Final content CHANGED by regex processing`)
				console.log(`[RegexProcessorManager] 📊 Before (${content.length} chars): "${content.substring(0, 300)}${content.length > 300 ? "..." : ""}"`)
				console.log(`[RegexProcessorManager] 📊 After (${processed.length} chars): "${processed.substring(0, 300)}${processed.length > 300 ? "..." : ""}"`)

				// Show diff for changes
				this.logDiff(content, processed, `Final Content (${targetSource}, ${context?.stage || 'unknown'})`)
			} else {
				console.log(`[RegexProcessorManager] ⏭️ Final content unchanged by regex processing`)
				console.log(`[RegexProcessorManager] 📊 Content (${content.length} chars): "${content.substring(0, 150)}${content.length > 150 ? "..." : ""}"`)
			}

			debugLog(`Final content processed (${targetSource}): "${content.substring(0, 50)}..." -> "${processed.substring(0, 50)}..."`)
			return processed
		} catch (error) {
			console.warn("[RegexProcessorManager] ❌ Error processing final content:", error)
			return content
		}
	}

	/**
	 * 记录两个文本之间的差异
	 */
	private logDiff(original: string, modified: string, context: string): void {
		if (original === modified) {
			return
		}

		const maxLines = 10
		const lines1 = original.split('\n')
		const lines2 = modified.split('\n')

		console.log(`[RegexProcessorManager] 🔍 Diff analysis for ${context}:`)
		console.log(`[RegexProcessorManager] 📏 Original: ${lines1.length} lines, Modified: ${lines2.length} lines`)

		// Find added/removed lines
		const addedLines: string[] = []
		const removedLines: string[] = []
		const changedLines: string[] = []

		const maxLineCount = Math.max(lines1.length, lines2.length)
		for (let i = 0; i < maxLineCount; i++) {
			const line1 = lines1[i] || ''
			const line2 = lines2[i] || ''

			if (line1 === line2) {
				continue
			}

			if (!line1 && line2) {
				addedLines.push(`+${i + 1}: ${line2}`)
			} else if (line1 && !line2) {
				removedLines.push(`-${i + 1}: ${line1}`)
			} else {
				changedLines.push(`~${i + 1}: "${line1}" → "${line2}"`)
			}
		}

		// Log differences
		if (addedLines.length > 0) {
			console.log(`[RegexProcessorManager] ➕ Added lines (${Math.min(addedLines.length, maxLines)}):`)
			addedLines.slice(0, maxLines).forEach(line => console.log(`[RegexProcessorManager]   ${line}`))
			if (addedLines.length > maxLines) {
				console.log(`[RegexProcessorManager]   ... and ${addedLines.length - maxLines} more added lines`)
			}
		}

		if (removedLines.length > 0) {
			console.log(`[RegexProcessorManager] ➖ Removed lines (${Math.min(removedLines.length, maxLines)}):`)
			removedLines.slice(0, maxLines).forEach(line => console.log(`[RegexProcessorManager]   ${line}`))
			if (removedLines.length > maxLines) {
				console.log(`[RegexProcessorManager]   ... and ${removedLines.length - maxLines} more removed lines`)
			}
		}

		if (changedLines.length > 0) {
			console.log(`[RegexProcessorManager] 🔄 Changed lines (${Math.min(changedLines.length, maxLines)}):`)
			changedLines.slice(0, maxLines).forEach(line => console.log(`[RegexProcessorManager]   ${line}`))
			if (changedLines.length > maxLines) {
				console.log(`[RegexProcessorManager]   ... and ${changedLines.length - maxLines} more changed lines`)
			}
		}

		// Character-level summary
		const charDiff = modified.length - original.length
		if (charDiff !== 0) {
			console.log(`[RegexProcessorManager] 📊 Character count change: ${charDiff > 0 ? '+' : ''}${charDiff} characters`)
		}
	}

	/**
	 * 获取当前处理器状态
	 */
	getStatus(): {
		enabled: boolean
		initialized: boolean
		hasProfile: boolean
		hasMixin: boolean
		processorsAvailable: {
			userInput: boolean
			aiOutput: boolean
			postProcess: boolean
		}
	} {
		return {
			enabled: this.isEnabled,
			initialized: this.processors !== null,
			hasProfile: this.currentProfile !== null,
			hasMixin: this.currentMixin !== null,
			processorsAvailable: {
				userInput: this.processors?.userInput !== null,
				aiOutput: this.processors?.aiOutput !== null,
				postProcess: this.processors?.postProcess !== null
			}
		}
	}

	/**
	 * 获取详细状态信息（用于调试）
	 */
	getDetailedStatus(): any {
		const status = this.getStatus()

		console.log(`[RegexProcessorManager] 📊 Detailed Status Report:`)
		console.log(`[RegexProcessorManager] 🎛️ Enabled: ${status.enabled}`)
		console.log(`[RegexProcessorManager] 🚀 Initialized: ${status.initialized}`)
		console.log(`[RegexProcessorManager] 📋 Has Profile: ${status.hasProfile}`)
		console.log(`[RegexProcessorManager] 📋 Has Mixin: ${status.hasMixin}`)
		console.log(`[RegexProcessorManager] 🔧 Processors Available:`, status.processorsAvailable)

		if (this.processors) {
			// Get regex counts if available
			const regexCounts = {
				userInput: 0,
				aiOutput: 0,
				postProcess: 0
			}

			try {
				// Since getRegexCount method doesn't exist on the processor types,
				// we'll just indicate that processors are available
				regexCounts.userInput = this.processors.userInput ? 1 : 0
				regexCounts.aiOutput = this.processors.aiOutput ? 1 : 0
				regexCounts.postProcess = this.processors.postProcess ? 1 : 0
			} catch (error) {
				console.warn(`[RegexProcessorManager] ⚠️ Error getting regex counts:`, error)
			}

			console.log(`[RegexProcessorManager] 🔢 Regex Counts:`, regexCounts)
			return { ...status, regexCounts }
		}

		return status
	}

	/**
	 * 重新加载处理器
	 */
	async reloadProcessors(profileData?: any, mixinData?: any): Promise<void> {
		debugLog("Reloading regex processors...")
		await this.initializeProcessors(profileData, mixinData)
	}

	/**
	 * 清理处理器
	 */
	dispose(): void {
		this.processors = null
		this.currentProfile = null
		this.currentMixin = null
		this.isEnabled = false
		debugLog("Regex processor manager disposed")
	}
}

// 单例实例
let regexProcessorManagerInstance: RegexProcessorManager | null = null

export function getRegexProcessorManager(): RegexProcessorManager {
	if (!regexProcessorManagerInstance) {
		regexProcessorManagerInstance = new RegexProcessorManager()
	}
	return regexProcessorManagerInstance
}

/**
 * 调试函数：输出当前正则处理器状态
 * 可以在控制台中调用：window.anthropicDebug?.getRegexProcessorStatus?.()
 */
export function debugRegexProcessorStatus(): void {
	console.log(`🔍 [Debug] Regex Processor Status Check`)
	const manager = getRegexProcessorManager()
	const status = manager.getDetailedStatus()

	// Also attach to global object for debugging
	if (typeof window !== 'undefined') {
		(window as any).anthropicDebug = (window as any).anthropicDebug || {}
		;(window as any).anthropicDebug.getRegexProcessorStatus = () => status
		;(window as any).anthropicDebug.getRegexProcessorManager = () => manager
		console.log(`📋 [Debug] Regex processor status attached to window.anthropicDebug.getRegexProcessorStatus()`)
	}
}

/**
 * 调试函数：测试正则处理器
 */
export async function debugRegexProcessorTest(text: string): Promise<void> {
	console.log(`🧪 [Debug] Testing Regex Processor with text: "${text}"`)
	const manager = getRegexProcessorManager()

	if (!manager.isProcessorEnabled()) {
		console.log(`❌ [Debug] Regex processor is not enabled`)
		return
	}

	// Test user input processing
	const userInputResult = manager.processUserInput(text, {
		variables: { user: "测试用户", char: "测试角色" }
	})
	console.log(`🔍 [Debug] User Input Result: "${userInputResult}"`)

	// Test AI output processing
	const aiOutputResult = manager.processAIOutput(text, {
		variables: { user: "测试用户", char: "测试角色" }
	})
	console.log(`🤖 [Debug] AI Output Result: "${aiOutputResult}"`)

	// Test final content processing
	const finalContentResult = manager.processFinalContent(text, RegexTargetSource.ALL_CONTENT, {
		variables: { user: "测试用户", char: "测试角色" },
		stage: "test"
	})
	console.log(`📝 [Debug] Final Content Result: "${finalContentResult}"`)
}