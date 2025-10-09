import { promises as fs } from "fs"
import type { Dirent, Stats } from "fs"
import path from "path"
import { pathToFileURL } from "url"

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
}

const EXTENSION_MANIFEST_FILENAME = "extension.json"
const SUPPORTED_CAPABILITIES: AnhExtensionCapability[] = ["systemPrompt", "tools"]
const SUPPORTED_MODULES: AnhExtensionModuleId[] = ["vscode", "fs", "os", "path"]
const EXTENSION_TOOL_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/

export class AnhExtensionManager {
	private readonly extensionsDir: string
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
	) {
		this.extensionsDir = path.join(basePath, "extensions")
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

	private sanitizeToolLocalName(extensionId: string, name: string): string | undefined {
		const trimmed = name.trim()

		if (!trimmed) {
			this.logger.warn(`[AnhExtensions:${extensionId}] Tool definition is missing a name; skipping registration`)
			return undefined
		}

		if (!EXTENSION_TOOL_NAME_PATTERN.test(trimmed)) {
			this.logger.warn(
				`[AnhExtensions:${extensionId}] Tool name '${trimmed}' is invalid. Use alphanumeric characters, underscores, or hyphens.`,
			)
			return undefined
		}

		if (trimmed.includes("/")) {
			this.logger.warn(
				`[AnhExtensions:${extensionId}] Tool name '${trimmed}' must not contain '/'. The extension id is automatically prefixed.`,
			)
			return undefined
		}

		return trimmed
	}

	private normalizeToolDefinition(
		extensionId: string,
		definition: AnhExtensionToolDefinition,
	): RegisteredExtensionToolEntry | undefined {
		const localName = this.sanitizeToolLocalName(extensionId, definition.name)

		if (!localName) {
			return undefined
		}

		if (!definition.prompt || !definition.prompt.trim()) {
			this.logger.warn(
				`[AnhExtensions:${extensionId}] Tool '${localName}' must provide a non-empty prompt description; skipping registration`,
			)
			return undefined
		}

		const fullName = this.buildFullToolName(extensionId, localName)

		if (!isExtensionToolName(fullName)) {
			this.logger.warn(
				`[AnhExtensions:${extensionId}] Generated tool name '${fullName}' is invalid. This should not happen but the tool will be skipped.`,
			)
			return undefined
		}

		if (this.toolRegistry.has(fullName)) {
			this.logger.warn(
				`[AnhExtensions:${extensionId}] Tool '${localName}' conflicts with an existing tool '${fullName}'. Skipping duplicate registration.`,
			)
			return undefined
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
					`[AnhExtensions:${id}] Error while retrieving tool definitions: ${error instanceof Error ? error.message : String(error)}`,
				)
				return []
			}
		}

		const entries: RegisteredExtensionToolEntry[] = []

		for (const definition of definitions) {
			const entry = this.normalizeToolDefinition(id, definition)
			if (!entry) {
				continue
			}

			this.toolRegistry.set(entry.fullName, {
				extensionId: id,
				entry,
				hooks,
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
				`[AnhExtensions:${registered.extensionId}] Tool '${registered.entry.localName}' invocation failed: ${
					error instanceof Error ? error.message : String(error)
				}`,
			)
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
			}
		}
	}

	private createLogger(id: string) {
		return {
			info: (message: string, ...details: unknown[]) =>
				this.logger.info(this.withDetails(`[AnhExtensions:${id}] ${message}`, details)),
			warn: (message: string, ...details: unknown[]) =>
				this.logger.warn(this.withDetails(`[AnhExtensions:${id}] ${message}`, details)),
			error: (message: string, ...details: unknown[]) =>
				this.logger.error(this.withDetails(`[AnhExtensions:${id}] ${message}`, details)),
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
						this.logger.warn(`[AnhExtensions:${id}] Unsupported module requested: ${moduleId}`)
						break
				}
			} catch (error) {
				this.logger.error(
					`[AnhExtensions:${id}] Failed to load module '${moduleId}': ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		}

		return modules
	}

	public async refresh(
		enabledMap: Record<string, boolean> = {},
		suppliedSettings: Record<string, AnhExtensionSettingsValues> = {},
	): Promise<void> {
		const dirEntries = await this.readExtensionDirectories()
		const nextExtensions: Map<string, LoadedExtension> = new Map()
		const nextCapabilityRegistry: AnhExtensionCapabilityRegistry = { systemPrompt: [], tools: [] }
		const runtimeSnapshot: AnhExtensionRuntimeState[] = []
		const processedIds = new Set<string>()

		for (const dirent of dirEntries) {
			if (!dirent.isDirectory()) {
				continue
			}

			const id = dirent.name
			processedIds.add(id)
			const extensionPath = path.join(this.extensionsDir, id)

			const previous = this.extensions.get(id)
			if (previous) {
				await this.deactivateExtension(id, previous)
				this.unregisterToolsForExtension(id)
			}

			const manifestResult = await this.readManifest(id, extensionPath)

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
				suppliedSettings[id] ?? this.currentSettings.get(id) ?? this.settingsGetter?.(id) ?? {}
			const resolvedSettings = this.mergeSettingsWithDefaults(manifestSettings, incomingSettings)
			this.currentSettings.set(id, resolvedSettings)
			if (!this.settingsAreEqual(incomingSettings, resolvedSettings)) {
				await this.persistSettings(id, resolvedSettings)
			}

			const enabled = enabledMap[id] ?? manifest.enabled ?? true
			let registeredCapabilities: AnhExtensionCapability[] = []
			let loadedExtension: LoadedExtension | undefined
			let error: string | undefined

			if (enabled && manifest.capabilities.length) {
				try {
					loadedExtension = await this.loadExtension(id, extensionPath, manifest)
					registeredCapabilities = loadedExtension.registeredCapabilities
					for (const capability of registeredCapabilities) {
						nextCapabilityRegistry[capability] = nextCapabilityRegistry[capability] ?? []
						nextCapabilityRegistry[capability]!.push(id)
					}
					nextExtensions.set(id, loadedExtension)
				} catch (err) {
					error = err instanceof Error ? err.message : String(err)
					this.logger.error(`[AnhExtensions:${id}] Failed to activate: ${error}`)
				}
			} else if (enabled && manifest.capabilities.length === 0) {
				this.logger.warn(`[AnhExtensions:${id}] Manifest declares no capabilities; skipping activation`)
			} else if (!enabled) {
				this.logger.info(`[AnhExtensions:${id}] Extension disabled; skipping activation`)
			}

			runtimeSnapshot.push({
				id,
				manifest,
				enabled,
				registeredCapabilities,
				entryPath: loadedExtension?.entryPath ?? path.resolve(extensionPath, manifest.main),
				lastLoadedAt: loadedExtension?.loadedAt,
				error,
				settingsSchema: manifestSettings,
			})
		}

		// Deactivate any extensions that no longer exist
		for (const [id, loaded] of this.extensions.entries()) {
			if (!processedIds.has(id)) {
				await this.deactivateExtension(id, loaded)
				this.unregisterToolsForExtension(id)
				runtimeSnapshot.push({
					id,
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

		this.extensions = nextExtensions
		this.capabilityRegistry = nextCapabilityRegistry
		this.runtimeSnapshot = runtimeSnapshot
	}

	private async readExtensionDirectories(): Promise<Dirent[]> {
		try {
			await fs.mkdir(this.extensionsDir, { recursive: true })
			return await fs.readdir(this.extensionsDir, { withFileTypes: true })
		} catch (error) {
			this.logger.error(
				`[AnhExtensions] Unable to read extensions directory: ${error instanceof Error ? error.message : String(error)}`,
			)
			return []
		}
	}

	private async readManifest(
		id: string,
		extensionPath: string,
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
			this.logger.error(`[AnhExtensions:${id}] Failed to read manifest: ${message}`)
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
		const logger = this.createLogger(id)
		const loadedModules = await this.loadRequestedModules(id, manifest.modules)
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
		const toolEntries = await this.registerToolsForExtension(id, hooks.tools)
		const registeredCapabilities = this.determineRegisteredCapabilities(id, manifest.capabilities, hooks)

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
					this.logger.warn(`[AnhExtensions:${id}] Capability 'systemPrompt' declared but no handler registered`)
				}
			} else if (capability === "tools") {
				if (hasToolHooks) {
					registered.push("tools")
				} else {
					this.logger.warn(`[AnhExtensions:${id}] Capability 'tools' declared but no handler registered`)
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
					`[AnhExtensions:${id}] Handler provided for capability '${capability}' but manifest does not declare it`,
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
					logger: this.createLogger(id),
				})
			} catch (error) {
				this.logger.error(
					`[AnhExtensions:${id}] Error during deactivate: ${error instanceof Error ? error.message : String(error)}`,
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
					`[AnhExtensions:${extension.id}] systemPrompt hook failed: ${error instanceof Error ? error.message : String(error)}`,
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
					`[AnhExtensions:${extension.id}] systemPromptFinal hook failed: ${
						error instanceof Error ? error.message : String(error)
					}`,
				)
			}
		}
	}
}




