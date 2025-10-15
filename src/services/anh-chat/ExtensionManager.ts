import { promises as fs } from "fs"
import type { Dirent, Stats } from "fs"
import path from "path"
import { pathToFileURL } from "url"
import crypto from "crypto"

import type {
	AnhExtensionCapability,
	AnhExtensionCapabilityRegistry,
	AnhExtensionContext,
	AnhExtensionHooks,
	AnhExtensionManifest,
	AnhExtensionModule,
	AnhExtensionModuleId,
	AnhExtensionModuleMap,
	AnhExtensionRuntimeState,
	AnhExtensionSettingDefinition,
	AnhExtensionSettingsValues,
	AnhExtensionSystemPromptContext,
	AnhExtensionSystemPromptFinalContext,
	AnhExtensionSystemPromptResult,
	AnhExtensionToolDefinition,
	AnhExtensionToolHooks,
	AnhExtensionToolInvokeRequest,
	AnhExtensionToolResult,
} from "@roo-code/types"
import { isExtensionToolName } from "@roo-code/types"

type LoadedExtension = {
	id: string
	manifest: AnhExtensionManifest
	extensionPath: string
	entryPath: string
	context: AnhExtensionContext
	hooks: AnhExtensionHooks
	deactivate?: AnhExtensionModule["deactivate"]
	loadedAt: number
	registeredCapabilities: AnhExtensionCapability[]
	scope: 'global' | 'workspace'
	toolHooks?: {
		hooks: AnhExtensionToolHooks
		tools: RegisteredExtensionToolEntry[]
	}
}

type RegisteredExtensionToolEntry = {
	fullName: string
	localName: string
	displayName: string
	description?: string
	prompt: string
	modes?: string[]
	requiresApproval: boolean
}

type RegisteredExtensionTool = {
	extensionId: string
	entry: RegisteredExtensionToolEntry
	hooks: AnhExtensionToolHooks
	scope: 'global' | 'workspace'
}

const EXTENSION_MANIFEST_FILENAME = "extension.json"
const SUPPORTED_CAPABILITIES: AnhExtensionCapability[] = ["systemPrompt", "tools"]
const SUPPORTED_MODULES: AnhExtensionModuleId[] = ["vscode", "fs", "os", "path"]
const EXTENSION_TOOL_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/

export class AnhExtensionManager {
	private readonly extensionsDir: string
	private readonly globalExtensionsDir?: string
	private extensions: Map<string, LoadedExtension> = new Map()
	private capabilityRegistry: AnhExtensionCapabilityRegistry = { systemPrompt: [], tools: [] }
	private runtimeSnapshot: AnhExtensionRuntimeState[] = []
	private settingsGetter?: (id: string) => AnhExtensionSettingsValues | undefined
	private settingsUpdater?: (id: string, settings: AnhExtensionSettingsValues) => Promise<void>
	private currentSettings: Map<string, AnhExtensionSettingsValues> = new Map()
	private toolRegistry: Map<string, RegisteredExtensionTool> = new Map()

	constructor(
		private readonly basePath: string,
		private readonly logger: { info(message: string): void; warn(message: string): void; error(message: string): void },
		globalExtensionsDir?: string,
	) {
		this.extensionsDir = path.join(basePath, "extensions")
		this.globalExtensionsDir = globalExtensionsDir
		this.extensions = new Map()
		this.capabilityRegistry = { systemPrompt: [], tools: [] }
		this.runtimeSnapshot = []
		this.currentSettings = new Map()
	}

	public setSettingsHandlers(
		getter: (id: string) => AnhExtensionSettingsValues | undefined,
		updater: (id: string, settings: AnhExtensionSettingsValues) => Promise<void>,
	) {
		this.settingsGetter = getter
		this.settingsUpdater = updater
	}

	private buildFullToolName(extensionId: string, toolName: string): string {
		return `extension:${extensionId}/${toolName}`
	}

	/**
	 * 创建复合键，用于唯一标识插件
	 * 格式：id + scope + entryPath的hash
	 */
	private createCompositeKey(id: string, scope: 'global' | 'workspace', entryPath: string): string {
		// 使用简单的字符串哈希算法，与ExtensionsSettings.tsx保持一致
		const pathHash = entryPath
			.split('')
			.reduce((hash, char) => {
				const charCode = char.charCodeAt(0)
				hash = ((hash << 5) - hash) + charCode
				return hash & hash // Convert to 32bit integer
			}, 0)
			.toString(16)
			.substring(0, 8)
		return `${id}:${scope}:${pathHash}`
	}

	private sanitizeToolLocalName(extensionId: string, name: string, extensionScope: 'global' | 'workspace'): string | undefined {
		const trimmed = name.trim()

		if (!trimmed) {
			this.logger.warn(`[AnhExtensions:${extensionId}@${extensionScope}] Tool definition is missing a name; skipping registration`)
			return undefined
		}

		if (!EXTENSION_TOOL_NAME_PATTERN.test(trimmed)) {
			this.logger.warn(
				`[AnhExtensions:${extensionId}@${extensionScope}] Tool name '${trimmed}' is invalid. Use alphanumeric characters, underscores, or hyphens.`,
			)
			return undefined
		}

		if (trimmed.includes("/")) {
			this.logger.warn(
				`[AnhExtensions:${extensionId}@${extensionScope}] Tool name '${trimmed}' must not contain '/'. The extension id is automatically prefixed.`,
			)
			return undefined
		}

		return trimmed
	}

	private normalizeToolDefinition(
		extensionId: string,
		definition: AnhExtensionToolDefinition,
		extensionScope: 'global' | 'workspace',
	): RegisteredExtensionToolEntry | undefined {
		const localName = this.sanitizeToolLocalName(extensionId, definition.name, extensionScope)

		if (!localName) {
			return undefined
		}

		if (!definition.prompt || !definition.prompt.trim()) {
			this.logger.warn(
				`[AnhExtensions:${extensionId}@${extensionScope}] Tool '${localName}' must provide a non-empty prompt description; skipping registration`,
			)
			return undefined
		}

		const fullName = this.buildFullToolName(extensionId, localName)

		if (!isExtensionToolName(fullName)) {
			this.logger.warn(
				`[AnhExtensions:${extensionId}@${extensionScope}] Generated tool name '${fullName}' is invalid. This should not happen but the tool will be skipped.`,
			)
			return undefined
		}

		// Check for existing tool with same name
		const existingTool = this.toolRegistry.get(fullName)
		if (existingTool) {
			// Get the existing extension to check its scope
			const existingExtension = this.extensions.get(this.createCompositeKey(existingTool.extensionId, 'global', '')) || 
									  this.extensions.get(this.createCompositeKey(existingTool.extensionId, 'workspace', ''))
			
			if (existingExtension) {
				// If current extension is workspace and existing is global, allow override
				if (extensionScope === 'workspace' && existingExtension.scope === 'global') {
					this.logger.info(
						`[AnhExtensions:${extensionId}@${extensionScope}] Workspace tool '${localName}' overriding global tool '${fullName}'`,
					)
					// Remove the existing tool to allow override
					this.toolRegistry.delete(fullName)
				} else if (extensionScope === 'global' && existingExtension.scope === 'workspace') {
					// If current is global and existing is workspace, skip registration
					this.logger.warn(
						`[AnhExtensions:${extensionId}@${extensionScope}] Global tool '${localName}' conflicts with workspace tool '${fullName}'. Workspace takes precedence.`,
					)
					return undefined
				} else {
					// Same scope conflict
					this.logger.warn(
						`[AnhExtensions:${extensionId}@${extensionScope}] Tool '${localName}' conflicts with an existing ${existingExtension.scope} tool '${fullName}'. Skipping duplicate registration.`,
					)
					return undefined
				}
			}
		}

		return {
			fullName,
			localName,
			displayName: definition.displayName?.trim() || localName,
			description: definition.description?.trim(),
			prompt: definition.prompt.trim(),
			modes: Array.isArray(definition.modes) ? definition.modes.map((mode) => mode.trim()).filter(Boolean) : undefined,
			requiresApproval: definition.requiresApproval !== false,
		}
	}

	private async registerToolsForExtension(
		id: string,
		hooks: AnhExtensionToolHooks | undefined,
		extensionScope: 'global' | 'workspace',
	): Promise<RegisteredExtensionToolEntry[] | undefined> {
		if (!hooks || typeof hooks.invoke !== "function") {
			return undefined
		}

		let definitions: AnhExtensionToolDefinition[] = []

		if (typeof hooks.getTools === "function") {
			try {
				const resolved = await hooks.getTools()
				definitions = resolved ?? []
			} catch (error) {
				this.logger.error(
					`[AnhExtensions:${id}@${extensionScope}] Error while retrieving tool definitions: ${error instanceof Error ? error.message : String(error)}`,
				)
				return []
			}
		}

		const entries: RegisteredExtensionToolEntry[] = []

		for (const definition of definitions) {
			const entry = this.normalizeToolDefinition(id, definition, extensionScope)
			if (!entry) {
				continue
			}

			this.toolRegistry.set(entry.fullName, {
				extensionId: id,
				entry,
				hooks,
				scope: extensionScope,
			})

			entries.push(entry)
		}

		return entries
	}

	private unregisterToolsForExtension(extensionId: string) {
		for (const [toolName, registered] of this.toolRegistry.entries()) {
			if (registered.extensionId === extensionId) {
				this.toolRegistry.delete(toolName)
			}
		}

		const existing = this.extensions.get(extensionId)
		if (existing) {
			existing.toolHooks = undefined
		}
	}

	public getExtensionToolsForMode(mode?: string): RegisteredExtensionToolEntry[] {
		return [...this.toolRegistry.values()]
			.map((registered) => registered.entry)
			.filter((entry) => {
				if (!entry.modes || entry.modes.length === 0 || !mode) {
					return true
				}

				return entry.modes.includes(mode)
			})
	}

	public getExtensionToolByName(fullToolName: string): RegisteredExtensionToolEntry | undefined {
		return this.toolRegistry.get(fullToolName)?.entry
	}

	public async invokeExtensionTool(
		fullToolName: string,
		request: Omit<AnhExtensionToolInvokeRequest, "toolName" | "fullToolName">,
	): Promise<AnhExtensionToolResult | undefined> {
		const registered = this.toolRegistry.get(fullToolName)

		if (!registered) {
			this.logger.warn(`[AnhExtensions] Attempted to invoke unknown tool '${fullToolName}'`)
			return undefined
		}

		try {
			const result = await registered.hooks.invoke({
				...request,
				toolName: registered.entry.localName,
				fullToolName,
			})

			if (!result) {
				return { success: true }
			}

			return result
		} catch (error) {
			this.logger.error(
				`[AnhExtensions:${registered.extensionId}:${registered.scope}] Tool '${registered.entry.localName}' invocation failed: ${
					error instanceof Error ? error.message : String(error)
				}`,
			)
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			}
		}
	}

	private createLogger(id: string, scope?: 'global' | 'workspace') {
		const scopeInfo = scope ? `@${scope}` : ''
		return {
			info: (message: string, ...details: unknown[]) =>
				this.logger.info(this.withDetails(`[AnhExtensions:${id}${scopeInfo}] ${message}`, details)),
			warn: (message: string, ...details: unknown[]) =>
				this.logger.warn(this.withDetails(`[AnhExtensions:${id}${scopeInfo}] ${message}`, details)),
			error: (message: string, ...details: unknown[]) =>
				this.logger.error(this.withDetails(`[AnhExtensions:${id}${scopeInfo}] ${message}`, details)),
		}
	}

	private withDetails(message: string, details: unknown[]): string {
		if (!details.length) {
			return message
		}

		return `${message} ${details.map((detail) => this.stringifyDetail(detail)).join(" ")}`
	}

	private stringifyDetail(detail: unknown): string {
		if (detail instanceof Error) {
			return detail.stack ?? detail.message
		}

		if (typeof detail === "object") {
			return JSON.stringify(detail)
		}

		return String(detail)
	}

	private mergeSettingsWithDefaults(
		definitions: AnhExtensionSettingDefinition[] | undefined,
		provided: AnhExtensionSettingsValues | undefined,
	): AnhExtensionSettingsValues {
		const result: AnhExtensionSettingsValues = { ...(provided ?? {}) }

		if (!definitions || definitions.length === 0) {
			return result
		}

		for (const definition of definitions) {
			if (result[definition.id] !== undefined) {
				continue
			}

			switch (definition.type) {
				case "boolean": {
					const fallback = "default" in definition ? definition.default ?? false : false
					result[definition.id] = fallback
					break
				}
				case "number": {
					if ("default" in definition && definition.default !== undefined) {
						result[definition.id] = definition.default
					}
					break
				}
				case "select": {
					if (definition.default !== undefined) {
						result[definition.id] = definition.default
					} else if (definition.options?.length) {
						result[definition.id] = definition.options[0]?.value
					}
					break
				}
				case "string": {
					if ("default" in definition && definition.default !== undefined) {
						result[definition.id] = definition.default
					}
					break
				}
				default:
					break
			}
		}

		return result
	}

	private settingsAreEqual(
		a: AnhExtensionSettingsValues | undefined,
		b: AnhExtensionSettingsValues | undefined,
	): boolean {
		const serialize = (value: AnhExtensionSettingsValues | undefined) => {
			const entries = Object.entries(value ?? {}).sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
			return JSON.stringify(entries)
		}

		return serialize(a) === serialize(b)
	}

	private async persistSettings(id: string, settings: AnhExtensionSettingsValues): Promise<void> {
		this.currentSettings.set(id, settings)

		if (!this.settingsUpdater) {
			return
		}

		try {
			await this.settingsUpdater(id, settings)
		} catch (error) {
			this.logger.error(
				`[AnhExtensions:${id}] Failed to persist settings: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	private async loadRequestedModules(
		id: string,
		moduleIds: AnhExtensionModuleId[] | undefined,
		scope: 'global' | 'workspace',
	): Promise<Partial<AnhExtensionModuleMap>> {
		const modules: Partial<AnhExtensionModuleMap> = {}

		if (!moduleIds || moduleIds.length === 0) {
			return modules
		}

		for (const moduleId of moduleIds) {
			try {
				switch (moduleId) {
					case "vscode":
						modules.vscode = (await import("vscode")) as AnhExtensionModuleMap["vscode"]
						break
					case "fs":
						modules.fs = (await import("fs")) as AnhExtensionModuleMap["fs"]
						break
					case "os":
						modules.os = (await import("os")) as AnhExtensionModuleMap["os"]
						break
					case "path":
						modules.path = (await import("path")) as AnhExtensionModuleMap["path"]
						break
					default:
						this.logger.warn(`[AnhExtensions:${id}@${scope}] Unsupported module requested: ${moduleId}`)
						break
				}
			} catch (error) {
				this.logger.error(
					`[AnhExtensions:${id}@${scope}] Failed to load module '${moduleId}': ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		}

		return modules
	}

	public async refresh(
		enabledMap: Record<string, boolean> = {},
		suppliedSettings: Record<string, AnhExtensionSettingsValues> = {},
	): Promise<void> {
		const workspaceEntries = await this.readExtensionDirectories(this.extensionsDir)
		const globalEntries = this.globalExtensionsDir ? await this.readExtensionDirectories(this.globalExtensionsDir) : []

		// 创建插件优先级映射：workspace > global（仅用于运行时优先级，不用于UI显示）
		const extensionPriorityMap = new Map<string, { scope: 'global' | 'workspace', dirent: Dirent }>()
		
		// 先添加global插件（低优先级）
		for (const dirent of globalEntries) {
			extensionPriorityMap.set(dirent.name, { scope: 'global', dirent })
		}
		
		// 再添加workspace插件（高优先级），会覆盖同名的global插件
		for (const dirent of workspaceEntries) {
			extensionPriorityMap.set(dirent.name, { scope: 'workspace', dirent })
		}

		const nextExtensions: Map<string, LoadedExtension> = new Map()
		const nextCapabilityRegistry: AnhExtensionCapabilityRegistry = { systemPrompt: [], tools: [] }
		const runtimeSnapshot: AnhExtensionRuntimeState[] = []
		const processedIds = new Set<string>()

		// 处理所有扩展（包括全局和本地），而不仅仅是优先级映射中的
		const allExtensions: Array<{ id: string, scope: 'global' | 'workspace', dirent: Dirent }> = []
		
		// 添加所有全局扩展
		for (const dirent of globalEntries) {
			allExtensions.push({ id: dirent.name, scope: 'global', dirent })
		}
		
		// 添加所有工作区扩展
		for (const dirent of workspaceEntries) {
			allExtensions.push({ id: dirent.name, scope: 'workspace', dirent })
		}

		// 处理所有扩展
		for (const { id, scope, dirent } of allExtensions) {
			// 检查是否为目录
			const extensionDir = scope === 'global' ? this.globalExtensionsDir! : this.extensionsDir
			const isDir = await fs.stat(path.join(extensionDir, dirent.name)).then(stats => stats.isDirectory()).catch(() => false)
			if (!isDir) {
				continue
			}

			const extensionPath = path.join(extensionDir, id)
			
			// 使用复合键：id + scope + entryPath hash 来避免同名插件覆盖
			const entryPath = path.resolve(extensionPath, 'extension.json') // 临时路径，后面会被实际的main路径替换
			const compositeKey = this.createCompositeKey(id, scope, entryPath)

			// 只清理相同复合键的扩展实例
			if (this.extensions.has(compositeKey)) {
				const existing = this.extensions.get(compositeKey)!
				await this.deactivateExtension(compositeKey, existing)
				this.unregisterToolsForExtension(compositeKey)
			}

			const manifestResult = await this.readManifest(id, extensionPath, scope)

			if ("error" in manifestResult) {
				runtimeSnapshot.push(manifestResult.error)
				continue
			}

			const { manifest } = manifestResult
			const manifestSettings = manifest.settings ?? []
			const requestedModules: (AnhExtensionModuleId | string)[] = Array.isArray(manifest.modules)
				? manifest.modules
				: []
			const filteredModules = requestedModules.filter(
				(module): module is AnhExtensionModuleId =>
					SUPPORTED_MODULES.includes(module as AnhExtensionModuleId),
			)
			manifest.modules = filteredModules
			manifest.settings = manifestSettings
			if (filteredModules.length !== requestedModules.length) {
				this.logger.warn(
					`[AnhExtensions:${id}] Manifest declares unsupported modules. Supported: ${SUPPORTED_MODULES.join(", ")}`,
				)
			}
			const incomingSettings =
				suppliedSettings[id] ?? this.currentSettings.get(compositeKey) ?? this.settingsGetter?.(id) ?? {}
			const resolvedSettings = this.mergeSettingsWithDefaults(manifestSettings, incomingSettings)
			this.currentSettings.set(compositeKey, resolvedSettings)
			if (!this.settingsAreEqual(incomingSettings, resolvedSettings)) {
				await this.persistSettings(id, resolvedSettings)
			}

			// 更新复合键，使用实际的main路径
			const actualEntryPath = path.resolve(extensionPath, manifest.main)
			const finalCompositeKey = this.createCompositeKey(id, scope, actualEntryPath)
			processedIds.add(finalCompositeKey)

			const enabled = enabledMap[finalCompositeKey] ?? manifest.enabled ?? true
			let registeredCapabilities: AnhExtensionCapability[] = []
			let loadedExtension: LoadedExtension | undefined
			let error: string | undefined

			if (enabled && manifest.capabilities.length) {
				try {
					loadedExtension = await this.loadExtension(id, extensionPath, manifest, scope)
					// 更新实际的entryPath
					const actualEntryPath = loadedExtension.entryPath
					const actualCompositeKey = this.createCompositeKey(id, scope, actualEntryPath)
					
					registeredCapabilities = loadedExtension.registeredCapabilities
					for (const capability of registeredCapabilities) {
						nextCapabilityRegistry[capability] = nextCapabilityRegistry[capability] ?? []
						nextCapabilityRegistry[capability]!.push(actualCompositeKey)
					}
					nextExtensions.set(actualCompositeKey, loadedExtension)
					processedIds.add(actualCompositeKey)
					
					// 添加激活成功的日志
					this.logger.info(`[AnhExtensions:${id}@${scope}] ${manifest.name} activated at ${extensionPath}`)
				} catch (err) {
					error = err instanceof Error ? err.message : String(err)
					this.logger.error(`[AnhExtensions:${id}@${scope}] Failed to activate: ${error}`)
				}
			} else if (enabled && manifest.capabilities.length === 0) {
				this.logger.warn(`[AnhExtensions:${id}@${scope}] Manifest declares no capabilities; skipping activation`)
			} else if (!enabled) {
				this.logger.info(`[AnhExtensions:${id}@${scope}] Extension disabled; skipping activation`)
			}

			runtimeSnapshot.push({
				id,
				manifest,
				enabled,
				registeredCapabilities,
				entryPath: loadedExtension?.entryPath ?? actualEntryPath,
				lastLoadedAt: loadedExtension?.loadedAt,
				error,
				settingsSchema: manifestSettings,
			})
		}

		// Deactivate any extensions that no longer exist or are now disabled
		for (const [compositeKey, loaded] of this.extensions.entries()) {
			if (!processedIds.has(compositeKey)) {
				await this.deactivateExtension(compositeKey, loaded)
				this.unregisterToolsForExtension(compositeKey)
				runtimeSnapshot.push({
					id: loaded.id,
					manifest: loaded.manifest,
					enabled: false,
					registeredCapabilities: [],
					entryPath: loaded.entryPath,
					lastLoadedAt: loaded.loadedAt,
					error: "Extension directory removed",
					settingsSchema: loaded.manifest.settings ?? [],
				})
			}
		}

		// Additionally, deactivate extensions that are now disabled
		for (const [compositeKey, loaded] of this.extensions.entries()) {
			const enabled = enabledMap[compositeKey] ?? loaded.manifest.enabled ?? true
			if (!enabled && processedIds.has(compositeKey)) {
				// Extension exists but is now disabled, need to deactivate it
				await this.deactivateExtension(compositeKey, loaded)
				this.unregisterToolsForExtension(compositeKey)
				this.logger.info(`[AnhExtensions:${loaded.id}@${loaded.scope}] Extension disabled; deactivating`)
			}
		}

		this.extensions = nextExtensions
		this.capabilityRegistry = nextCapabilityRegistry
		this.runtimeSnapshot = runtimeSnapshot
	}

	private async readExtensionDirectories(directory: string): Promise<Dirent[]> {
		try {
			await fs.mkdir(directory, { recursive: true })
			return await fs.readdir(directory, { withFileTypes: true })
		} catch (error) {
			this.logger.error(
				`[AnhExtensions] Unable to read extensions directory ${directory}: ${error instanceof Error ? error.message : String(error)}`,
			)
			return []
		}
	}

	private async readManifest(
		id: string,
		extensionPath: string,
		scope?: 'global' | 'workspace',
	): Promise<{ manifest: AnhExtensionManifest } | { error: AnhExtensionRuntimeState }> {
		const manifestPath = path.join(extensionPath, EXTENSION_MANIFEST_FILENAME)

		try {
			const manifestRaw = await fs.readFile(manifestPath, "utf-8")
			const manifest = JSON.parse(manifestRaw) as Partial<AnhExtensionManifest>

			if (!manifest || typeof manifest !== "object") {
				throw new Error("Manifest must be a JSON object")
			}

			if (typeof manifest.name !== "string") {
				manifest.name = id
			}

			if (typeof manifest.main !== "string" || !manifest.main.trim()) {
				throw new Error("Manifest must define a non-empty 'main' field pointing to the entry file")
			}

			if (!Array.isArray(manifest.capabilities)) {
				manifest.capabilities = []
			}

			const filteredCapabilities = manifest.capabilities.filter((cap): cap is AnhExtensionCapability =>
				SUPPORTED_CAPABILITIES.includes(cap as AnhExtensionCapability),
			)

			if (filteredCapabilities.length !== manifest.capabilities.length) {
				this.logger.warn(
					`[AnhExtensions:${id}] Manifest declares unsupported capabilities. Supported: ${SUPPORTED_CAPABILITIES.join(", ")}`,
				)
			}

			const settings = Array.isArray(manifest.settings) ? manifest.settings : undefined

			return {
				manifest: {
					name: manifest.name,
					version: manifest.version,
					description: manifest.description,
					main: manifest.main,
					capabilities: filteredCapabilities,
					enabled: manifest.enabled,
					settings,
				},
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			const scopeInfo = scope ? `@${scope}` : ''
			this.logger.error(`[AnhExtensions:${id}${scopeInfo}] Failed to read manifest: ${message}`)
			return {
				error: {
					id,
					manifest: {
						name: id,
						main: "",
						capabilities: [],
					},
					enabled: false,
					registeredCapabilities: [],
					entryPath: "",
					error: message,
				},
			}
		}
	}

	private async loadExtension(
		id: string,
		extensionPath: string,
		manifest: AnhExtensionManifest,
		scope: 'global' | 'workspace',
	): Promise<LoadedExtension> {
		const resolvedEntry = path.resolve(extensionPath, manifest.main)
		let stats: Stats | undefined

		try {
			stats = await fs.stat(resolvedEntry)
		} catch (error) {
			throw new Error(
				`Entry file does not exist at ${resolvedEntry}: ${error instanceof Error ? error.message : String(error)}`,
			)
		}

		const moduleUrl = pathToFileURL(resolvedEntry)
		const cacheBust = stats?.mtimeMs ?? Date.now()
		const imported = await import(`${moduleUrl.href}?t=${cacheBust}`)
		const resolvedModule = this.resolveModule(imported)
		const logger = this.createLogger(id, scope)
		const loadedModules = await this.loadRequestedModules(id, manifest.modules, scope)
		const settingsView = new Proxy(
			{},
			{
				get: (_target, prop: string | symbol) => {
					if (typeof prop !== "string") {
						return undefined
					}
					const current = this.currentSettings.get(id) ?? {}
					return current[prop]
				},
				ownKeys: () => Reflect.ownKeys(this.currentSettings.get(id) ?? {}),
				getOwnPropertyDescriptor: (_target, prop: string | symbol) => {
					if (typeof prop !== "string") {
						return undefined
					}
					const current = this.currentSettings.get(id) ?? {}
					if (!(prop in current)) {
						return undefined
					}
					return {
						configurable: true,
						enumerable: true,
						value: current[prop],
						writable: false,
					}
				},
			},
		) as AnhExtensionSettingsValues

		const context: AnhExtensionContext = {
			id,
			manifest,
			extensionPath: extensionPath,
			basePath: this.basePath,
			scope,
			logger,
			settings: settingsView,
			modules: Object.freeze(loadedModules),
			getSetting: <T = unknown>(key: string) => {
				const current = this.currentSettings.get(id) ?? {}
				return current[key] as T | undefined
			},
			setSetting: async <T = unknown>(key: string, value: T) => {
				const current = this.currentSettings.get(id) ?? {}
				const next: AnhExtensionSettingsValues = { ...current, [key]: value }
				await this.persistSettings(id, next)
			},
			updateSettings: async (values: Partial<AnhExtensionSettingsValues>) => {
				const current = this.currentSettings.get(id) ?? {}
				const next: AnhExtensionSettingsValues = { ...current, ...values }
				await this.persistSettings(id, next)
			},
			getModule: (moduleId) => loadedModules[moduleId],
		}

		const hooks = (await resolvedModule.activate(context)) ?? {}
		const toolEntries = await this.registerToolsForExtension(id, hooks.tools, scope)
		const registeredCapabilities = this.determineRegisteredCapabilities(id, manifest.capabilities, hooks, scope)

		return {
			id,
			manifest,
			extensionPath,
			entryPath: resolvedEntry,
			context,
			hooks,
			deactivate: resolvedModule.deactivate,
			loadedAt: Date.now(),
			registeredCapabilities,
			scope,
			toolHooks:
				hooks.tools && typeof hooks.tools.invoke === "function"
					? { hooks: hooks.tools, tools: toolEntries ?? [] }
					: undefined,
		}
	}

	private resolveModule(module: any): { activate: AnhExtensionModule["activate"]; deactivate?: AnhExtensionModule["deactivate"] } {
		const candidates = [
			module,
			module?.default,
			module?.module?.default,
			module?.module,
		]

		for (const candidate of candidates) {
			if (typeof candidate === "function") {
				return { activate: candidate as AnhExtensionModule["activate"], deactivate: undefined }
			}

			if (candidate && typeof candidate === "object") {
				const activate = candidate.activate ?? module.activate
				const deactivate = candidate.deactivate ?? module.deactivate

				if (typeof activate === "function") {
					return {
						activate: activate.bind(candidate),
						deactivate: typeof deactivate === "function" ? deactivate.bind(candidate) : undefined,
					}
				}
			}
		}

		throw new Error("Extension module must export an activate function")
	}

	private determineRegisteredCapabilities(
		id: string,
		declared: AnhExtensionCapability[],
		hooks: AnhExtensionHooks,
		scope?: 'global' | 'workspace',
	): AnhExtensionCapability[] {
		const registered: AnhExtensionCapability[] = []
		const hasSystemPromptHook = typeof hooks.systemPrompt === "function"
		const hasSystemPromptFinalHook = typeof hooks.systemPromptFinal === "function"
		const hasToolHooks = typeof hooks.tools?.invoke === "function"

		for (const capability of declared) {
			if (capability === "systemPrompt") {
				if (hasSystemPromptHook || hasSystemPromptFinalHook) {
					registered.push("systemPrompt")
				} else {
					this.logger.warn(`[AnhExtensions:${id}:${scope || 'unknown'}] Capability 'systemPrompt' declared but no handler registered`)
				}
			} else if (capability === "tools") {
				if (hasToolHooks) {
					registered.push("tools")
				} else {
					this.logger.warn(`[AnhExtensions:${id}:${scope || 'unknown'}] Capability 'tools' declared but no handler registered`)
				}
			}
		}

		for (const capability of SUPPORTED_CAPABILITIES) {
			if (
				!declared.includes(capability) &&
				((capability === "systemPrompt" && (hasSystemPromptHook || hasSystemPromptFinalHook)) ||
					(capability === "tools" && hasToolHooks))
			) {
				this.logger.warn(
					`[AnhExtensions:${id}:${scope || 'unknown'}] Handler provided for capability '${capability}' but manifest does not declare it`,
				)
			}
		}

		return registered
	}

	private async deactivateExtension(id: string, extension: LoadedExtension) {
		if (typeof extension.deactivate === "function") {
			try {
				await extension.deactivate({
					...extension.context,
					logger: this.createLogger(id, extension.scope),
				})
			} catch (error) {
				this.logger.error(
					`[AnhExtensions:${id}@${extension.scope}] Error during deactivate: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		}
	}

	public getRuntimeState(): AnhExtensionRuntimeState[] {
		return [...this.runtimeSnapshot]
	}

	public getCapabilityRegistry(): AnhExtensionCapabilityRegistry {
		return { ...this.capabilityRegistry }
	}

	private getExtensionsWithCapability(capability: AnhExtensionCapability): LoadedExtension[] {
		return [...this.extensions.values()].filter((extension) => extension.registeredCapabilities.includes(capability))
	}

	public async applySystemPromptHooks(
		basePrompt: string,
		context: Omit<AnhExtensionSystemPromptContext, "basePrompt">,
	): Promise<string> {
		let prompt = basePrompt
		const extensions = this.getExtensionsWithCapability("systemPrompt")

		for (const extension of extensions) {
			const hook = extension.hooks.systemPrompt

			if (!hook) {
				continue
			}

			try {
				const result = await hook({ ...context, basePrompt: prompt })

				if (typeof result === "string") {
					const normalized = this.normalizeSegment(result)
					if (normalized) {
						prompt = `${prompt}\n\n${normalized}`
					}
				} else if (result && typeof result === "object") {
					prompt = this.applySystemPromptResult(prompt, result)
				}
			} catch (error) {
				this.logger.error(
					`[AnhExtensions:${extension.id}@${extension.scope}] systemPrompt hook failed: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		}

		await this.invokeSystemPromptFinalHooks(prompt, context, extensions)

		return prompt
	}

	private applySystemPromptResult(prompt: string, result: AnhExtensionSystemPromptResult): string {
		let nextPrompt = prompt

		if (typeof result.replace === "string") {
			nextPrompt = result.replace
		}

		if (result.prepend) {
			const prependBlock = this.normalizeSegment(result.prepend)
			if (prependBlock) {
				nextPrompt = `${prependBlock}\n\n${nextPrompt}`
			}
		}

		if (result.append) {
			const appendBlock = this.normalizeSegment(result.append)
			if (appendBlock) {
				nextPrompt = `${nextPrompt}\n\n${appendBlock}`
			}
		}

		return nextPrompt
	}

	private normalizeSegment(segment: string | string[]): string {
		if (Array.isArray(segment)) {
			return segment.map((part) => part.trim()).filter(Boolean).join("\n\n")
		}

		return segment.trim()
	}

	private async invokeSystemPromptFinalHooks(
		finalPrompt: string,
		context: Omit<AnhExtensionSystemPromptContext, "basePrompt">,
		extensions: LoadedExtension[],
	) {
		const finalContext: AnhExtensionSystemPromptFinalContext = {
			...context,
			finalPrompt,
		}

		for (const extension of extensions) {
			const hook = extension.hooks.systemPromptFinal

			if (!hook) {
				continue
			}

			try {
				await hook({ ...finalContext })
			} catch (error) {
				this.logger.error(
					`[AnhExtensions:${extension.id}@${extension.scope}] systemPromptFinal hook failed: ${
						error instanceof Error ? error.message : String(error)
					}`,
				)
			}
		}
	}
}




