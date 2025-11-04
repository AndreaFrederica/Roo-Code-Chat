/**
 * Mixin File Service
 *
 * This service handles the creation and management of JSON-based mixin configuration files.
 * The system uses configuration-driven approach rather than code execution for security.
 */

import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import { DEFAULT_REGEX_RULES, RegexRule } from "../shared/builtin-regex-rules"
import { DEFAULT_AST_RULES, AstRule } from "../shared/builtin-ast-rules"

export interface CreateMixinFileOptions {
	fileType: 'regex' | 'ast'
	fileName: string
	builtinRuleKey?: string
	workspacePath?: string
}

export interface MixinFileInfo {
	filePath: string
	fileName: string
	fileType: 'regex' | 'ast'
	created: boolean
	basedOn?: string
}

export interface MixinConfig {
	version: string
	type: 'regex' | 'ast'
	name: string
	description?: string
	basedOn?: string // 内置规则key（如果基于内置规则创建）
	rules: Record<string, RegexRule | AstRule>
	enabled: boolean
	metadata: {
		createdAt: string
		updatedAt: string
		author?: string
	}
}

/**
 * Service for creating and managing mixin configuration files
 */
export class MixinFileService {
	private static instance: MixinFileService

	private constructor() {
	}

	public static getInstance(): MixinFileService {
		if (!MixinFileService.instance) {
			MixinFileService.instance = new MixinFileService()
		}
		return MixinFileService.instance
	}

	/**
	 * Get the settings directory path
	 */
	private async getSettingsDirectoryPath(globalStoragePath: string): Promise<string> {
		const settingsDir = path.join(globalStoragePath, "rules")
		await fs.mkdir(settingsDir, { recursive: true })
		return settingsDir
	}

	/**
	 * Get the rules directory path
	 */
	private async getRulesDirectoryPath(context: vscode.ExtensionContext): Promise<string> {
		const settingsDir = await this.getSettingsDirectoryPath(context.globalStorageUri.fsPath)
		const rulesDir = path.join(settingsDir, "rules")

		// Ensure rules directory exists
		await fs.mkdir(rulesDir, { recursive: true })

		return rulesDir
	}

	/**
	 * Create a new mixin configuration file (JSON format)
	 */
	public async createMixinFile(
		context: vscode.ExtensionContext,
		options: CreateMixinFileOptions
	): Promise<MixinFileInfo> {
		const { fileType, fileName, builtinRuleKey } = options

		if (!fileType || !fileName) {
			throw new Error("File type and file name are required")
		}

		// Ensure .json extension
		const jsonFileName = fileName.endsWith('.json') ? fileName : `${fileName}.json`

		// Get rules directory path
		const rulesDir = await this.getRulesDirectoryPath(context)
		const filePath = path.join(rulesDir, jsonFileName)

		// Create mixin configuration
		const config = this.createMixinConfig(fileType, jsonFileName, builtinRuleKey)

		// Write JSON file
		const jsonContent = JSON.stringify(config, null, 2)
		await fs.writeFile(filePath, jsonContent, 'utf8')

		// Open file for editing
		const document = await vscode.workspace.openTextDocument(filePath)
		await vscode.window.showTextDocument(document)

		return {
			filePath,
			fileName: jsonFileName,
			fileType,
			created: true,
			basedOn: builtinRuleKey
		}
	}

	/**
	 * Create mixin configuration object
	 */
	private createMixinConfig(
		fileType: 'regex' | 'ast',
		fileName: string,
		builtinRuleKey?: string
	): MixinConfig {
		const now = new Date().toISOString()
		const ruleName = fileName.replace('.json', '')

		let rules: Record<string, RegexRule | AstRule> = {}
		let description: string = `自定义${fileType === 'regex' ? '正则' : 'AST'}规则配置`
		let basedOn: string | undefined

		if (builtinRuleKey) {
			// Create based on built-in rule
			if (fileType === 'regex') {
				const builtinRule = DEFAULT_REGEX_RULES[builtinRuleKey]
				if (builtinRule) {
					rules[ruleName] = { ...builtinRule, enabled: true }
					description = `基于内置正则规则 "${builtinRuleKey}" 的自定义配置`
					basedOn = builtinRuleKey
				}
			} else {
				const builtinRule = DEFAULT_AST_RULES[builtinRuleKey]
				if (builtinRule) {
					rules[ruleName] = { ...builtinRule, enabled: true }
					description = `基于内置AST规则 "${builtinRuleKey}" 的自定义配置`
					basedOn = builtinRuleKey
				}
			}
		}

		return {
			version: "1.0.0",
			type: fileType,
			name: ruleName,
			description,
			basedOn,
			rules,
			enabled: true,
			metadata: {
				createdAt: now,
				updatedAt: now,
				author: "User"
			}
		}
	}

	/**
	 * Load existing mixin configuration
	 */
	public async loadMixinConfig(
		context: vscode.ExtensionContext,
		fileName: string
	): Promise<MixinConfig | null> {
		const rulesDir = await this.getRulesDirectoryPath(context)
		const filePath = path.join(rulesDir, fileName)

		try {
			const content = await fs.readFile(filePath, 'utf8')
			const config = JSON.parse(content) as MixinConfig
			return config
		} catch (error) {
			console.error(`Failed to load mixin config ${fileName}:`, error)
			return null
		}
	}

	/**
	 * Save mixin configuration
	 */
	public async saveMixinConfig(
		context: vscode.ExtensionContext,
		config: MixinConfig
	): Promise<void> {
		const rulesDir = await this.getRulesDirectoryPath(context)
		const filePath = path.join(rulesDir, `${config.name}.json`)

		// Update timestamp
		config.metadata.updatedAt = new Date().toISOString()

		const jsonContent = JSON.stringify(config, null, 2)
		await fs.writeFile(filePath, jsonContent, 'utf8')
	}

	/**
	 * Delete mixin file
	 */
	public async deleteMixinFile(
		context: vscode.ExtensionContext,
		fileName: string
	): Promise<boolean> {
		const rulesDir = await this.getRulesDirectoryPath(context)
		const filePath = path.join(rulesDir, fileName)

		try {
			await fs.unlink(filePath)
			return true
		} catch (error) {
			console.error(`Failed to delete mixin file ${fileName}:`, error)
			return false
		}
	}

	/**
	 * List all mixin files
	 */
	public async listMixinFiles(
		context: vscode.ExtensionContext
	): Promise<Array<{ fileName: string; type: 'regex' | 'ast' }>> {
		const rulesDir = await this.getRulesDirectoryPath(context)

		try {
			const files = await fs.readdir(rulesDir)
			const mixinFiles = files
				.filter(file => file.endsWith('.json'))
				.map(file => {
					// Try to determine type from filename or content
					const type: 'regex' | 'ast' = file.includes('regex') ? 'regex' :
														file.includes('ast') ? 'ast' : 'regex' // default to regex
					return { fileName: file, type }
				})

			return mixinFiles
		} catch (error) {
			console.error('Failed to list mixin files:', error)
			return []
		}
	}

	/**
	 * Open rules directory in explorer
	 */
	public async openRulesDirectory(context: vscode.ExtensionContext): Promise<void> {
		const rulesDir = await this.getRulesDirectoryPath(context)
		vscode.env.openExternal(vscode.Uri.file(rulesDir))
	}
}

// Export singleton instance
export const mixinFileService = MixinFileService.getInstance()