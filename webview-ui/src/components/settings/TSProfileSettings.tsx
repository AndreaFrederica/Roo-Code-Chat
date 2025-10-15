import React, { HTMLAttributes, useState, useEffect } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import {
	FileText,
	FolderOpen,
	RefreshCw,
	Play,
	Square,
	Info,
	AlertTriangle,
	CheckCircle,
	Edit3,
	Save,
	X,
	FilePlus,
	ToggleLeft,
	ToggleRight,
	Globe,
	Folder,
	Copy,
	Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { vscode } from "@/utils/vscode"
import { StandardTooltip } from "@/components/ui"
import { useExtensionState } from "@/context/ExtensionStateContext"

import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { SetCachedStateField } from "./types"
import type { ExtensionStateContextType } from "@/context/ExtensionStateContext"

// Prompt 接口定义
interface PromptConfig {
	identifier: string
	name?: string
	role: "system" | "user" | "assistant"
	content: string
	enabled: boolean
	system_prompt: boolean
	marker: boolean
	injection: {
		position: number
		depth: number
		order: number
	}
	forbid_overrides: boolean
	variables: string[]
	dependencies: string[]
}

// Profile 完整数据结构
interface ProfileData {
	name?: string
	description?: string
	prompts: PromptConfig[]
	prompt_order?: Array<{
		identifier: string
		enabled: boolean
	}>
}

// Mixin 文件结构
interface ProfileMixin {
	version?: string
	description?: string
	prompts: Array<{
		identifier: string
		enabled?: boolean
		content?: string
	}>
	variables?: Record<string, any>
	metadata?: {
		createdAt?: number
		updatedAt?: number
		author?: string
		tags?: string[]
	}
}

interface ProfileInfo {
	name: string
	path: string
	description?: string
	promptsCount?: number
	enabledCount?: number
	lastModified?: number
	// 新增字段：mixin 相关信息
	hasMixin?: boolean
	mixinPromptsCount?: number
	mixinPath?: string
	isOrphanMixin?: boolean
	expectedMainProfile?: string
	// 全局/工作区标识
	scope?: "global" | "workspace"
}

interface ValidationError {
	field: string
	message: string
}

interface ValidationResult {
	isValid: boolean
	errors: ValidationError[]
	warnings: string[]
}

interface TSProfileSettingsProps {
	setCachedStateField: SetCachedStateField<keyof ExtensionStateContextType>
	anhTsProfileAutoInject?: boolean
	anhTsProfileVariables?: Record<string, string>
	tsProfilesHasChanges?: boolean
	enabledTSProfiles?: string[]
}

type TSProfileSettingsPropsExtended = HTMLAttributes<HTMLDivElement> & TSProfileSettingsProps

export const TSProfileSettings: React.FC<TSProfileSettingsPropsExtended> = ({
	className,
	setCachedStateField,
	anhTsProfileAutoInject: propAnhTsProfileAutoInject,
	anhTsProfileVariables: propAnhTsProfileVariables,
	tsProfilesHasChanges: propTsProfilesHasChanges,
	enabledTSProfiles: propEnabledTSProfiles,
	...props
}) => {
	const { t } = useAppTranslation()

	// 获取全局状态中的 TSProfile 设置
	const {
		saveTSProfileChanges,
		resetTSProfileChanges,
	} = useExtensionState() as ExtensionStateContextType

	// 使用props传入的缓存状态值，如果没有则使用默认值
	const anhTsProfileAutoInject = propAnhTsProfileAutoInject ?? true
	const anhTsProfileVariables = propAnhTsProfileVariables ?? {}
	const tsProfilesHasChanges = propTsProfilesHasChanges ?? false
	const enabledTSProfiles = propEnabledTSProfiles ?? []

	const [profiles, setProfiles] = useState<ProfileInfo[]>([])
	const [selectedProfile, setSelectedProfile] = useState<string | null>(null)
	const [selectedProfileScope, setSelectedProfileScope] = useState<"global" | "workspace">("workspace")
	const [profileContent, setProfileContent] = useState<string>("")
	const [loading, setLoading] = useState(false)
	const [validationError, setValidationError] = useState<string | null>(null)
	const [validationSuccess, setValidationSuccess] = useState<string | null>(null)

	// 新增状态：用于管理prompts编辑
	const [profileData, setProfileData] = useState<ProfileData | null>(null)
	const [editingPrompts, setEditingPrompts] = useState<Record<string, PromptConfig>>({})
	const [editMode, setEditMode] = useState<"source" | "mixin">("mixin") // 默认使用mixin模式
	const [mixinData, setMixinData] = useState<ProfileMixin | null>(null)
	const [mixinExists, setMixinExists] = useState(false)
	const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(new Set())
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

	// 验证和错误处理相关状态
	const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
	const [showValidationDetails, setShowValidationDetails] = useState(false)

	// 全局/工作区切换状态
	const [profileScope, setProfileScope] = useState<"all" | "global" | "workspace">("all")
	const [showCopyDialog, setShowCopyDialog] = useState(false)
	const [copyTargetProfile, setCopyTargetProfile] = useState<ProfileInfo | null>(null)
	const [copyTargetScope, setCopyTargetScope] = useState<"global" | "workspace">("workspace")

	// 初始化：创建profile文件夹并加载列表
	useEffect(() => {
		const initializeTSProfiles = async () => {
			try {
				console.log("[TSProfile] Initializing TSProfiles...")
				// 获取TSProfile文件列表
				vscode.postMessage({ type: "loadTsProfiles" })
			} catch (error) {
				console.error("Failed to initialize TSProfiles:", error)
			}
		}
		initializeTSProfiles()
	}, [])

	// 监听来自后端的消息
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data

			switch (message.type) {
				case "tsProfilesLoaded":
					console.log("[TSProfile] Received profiles:", message.tsProfiles)
					setProfiles(message.tsProfiles || [])
					break
				case "tsProfileValidated":
					if (message.tsProfileSuccess) {
						setValidationSuccess(
							t("settings:tsProfile.validation.success", {
								name: message.tsProfileName,
								promptsCount: message.tsProfilePromptsCount,
							}),
						)
					} else {
						setValidationError(t("settings:tsProfile.validation.error", { error: message.tsProfileError }))
					}
					break
				case "tsProfileSelected":
					// 当用户通过浏览器选择文件时
					const fileName = message.tsProfilePath ? message.tsProfilePath.split(/[/\\]/).pop() : ""
					if (fileName) {
						handleProfileSelect(fileName)
					}
					break
				case "tsProfileContentLoaded":
					// 处理加载的profile内容
					if (message.profileData) {
						setProfileData(message.profileData)
						// 初始化编辑状态 - 只有在没有现有编辑状态或者不在mixin模式时才重置
						if (Object.keys(editingPrompts).length === 0 || editMode !== "mixin") {
							const initialEditingState: Record<string, PromptConfig> = {}
							message.profileData.prompts?.forEach((prompt: PromptConfig) => {
								initialEditingState[prompt.identifier] = { ...prompt }
							})
							setEditingPrompts(initialEditingState)
						}
						// 如果已经有mixin数据且在mixin模式下，需要重新应用mixin
						if (message.mixinData && editMode === "mixin") {
							setMixinData(message.mixinData)
							applyMixinToEditingState(message.profileData, message.mixinData)
						} else {
							setMixinData(message.mixinData)
						}
					} else if (message.error) {
						setValidationError(message.error)
					}
					break
				case "tsProfileMixinLoaded":
					// 处理加载的mixin内容
					if (message.mixinData) {
						setMixinData(message.mixinData)
						setMixinExists(true)
						// 如果有profile数据，应用mixin到编辑状态
						if (profileData) {
							applyMixinToEditingState(profileData, message.mixinData)
						}
					} else {
						setMixinExists(false)
					}
					if (message.error) {
						setValidationError(message.error)
					}
					break
				case "tsProfileMixinSaved":
					// 处理mixin保存结果
					if (message.success) {
						setValidationSuccess("Mixin文件保存成功")
						setHasUnsavedChanges(false)
					} else {
						setValidationError(message.error || "Mixin文件保存失败")
					}
					break
				case "tsProfileSourceSaved":
					// 处理源文件保存结果
					if (message.success) {
						setValidationSuccess("源文件保存成功")
						setHasUnsavedChanges(false)
						// 重新加载profile数据
						if (selectedProfile) {
							loadProfileContent(selectedProfile)
						}
					} else {
						setValidationError(message.error || "源文件保存失败")
					}
					break
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [t, editingPrompts, profileData])

	// 验证profile数据
	const validateProfileData = (data: ProfileData | null): ValidationResult => {
		const errors: ValidationError[] = []
		const warnings: string[] = []

		if (!data) {
			errors.push({
				field: "profile",
				message: "Profile数据为空",
			})
			return { isValid: false, errors, warnings }
		}

		// 验证基本字段
		if (!data.name || data.name.trim() === "") {
			errors.push({
				field: "name",
				message: "Profile名称不能为空",
			})
		}

		// 验证prompts
		if (!data.prompts || data.prompts.length === 0) {
			warnings.push("Profile中没有定义任何prompt")
		} else {
			const identifierSet = new Set<string>()

			data.prompts.forEach((prompt, index) => {
				// 检查identifier唯一性
				if (!prompt.identifier || prompt.identifier.trim() === "") {
					errors.push({
						field: `prompts[${index}].identifier`,
						message: `Prompt #${index + 1} 的标识符不能为空`,
					})
				} else if (identifierSet.has(prompt.identifier)) {
					errors.push({
						field: `prompts[${index}].identifier`,
						message: `Prompt标识符 "${prompt.identifier}" 重复`,
					})
				} else {
					identifierSet.add(prompt.identifier)
				}

				// 检查content
				if (!prompt.content || prompt.content.trim() === "") {
					warnings.push(`Prompt "${prompt.identifier}" 的内容为空`)
				}

				// 检查role
				if (!["system", "user", "assistant"].includes(prompt.role)) {
					errors.push({
						field: `prompts[${index}].role`,
						message: `Prompt "${prompt.identifier}" 的角色类型无效`,
					})
				}

				// 检查模板变量语法
				if (prompt.content) {
					const templateVarRegex = /\{\{([^}]+)\}\}/g
					const matches = prompt.content.match(templateVarRegex)
					if (matches) {
						matches.forEach((match) => {
							const varName = match.slice(2, -2).trim()
							// 检查是否包含已知的内置变量
							const builtInVars = [
								"user",
								"char",
								"name",
								"description",
								"personality",
								"scenario",
								"first_mes",
								"mes_example",
								"isodate",
								"isotime",
							]
							if (!builtInVars.includes(varName) && !varName.startsWith("custom_")) {
								warnings.push(`Prompt "${prompt.identifier}" 包含未知的模板变量: ${match}`)
							}
						})
					}
				}
			})
		}

		// 验证prompt_order
		if (data.prompt_order) {
			const orderIdentifiers = data.prompt_order.map((po) => po.identifier)
			const promptIdentifiers = data.prompts?.map((p) => p.identifier) || []

			// 检查order中的identifier是否都存在于prompts中
			orderIdentifiers.forEach((identifier) => {
				if (!promptIdentifiers.includes(identifier)) {
					warnings.push(`prompt_order中引用了不存在的prompt: ${identifier}`)
				}
			})

			// 检查是否有prompt没有在order中
			promptIdentifiers.forEach((identifier) => {
				if (!orderIdentifiers.includes(identifier)) {
					warnings.push(`Prompt "${identifier}" 没有在prompt_order中定义`)
				}
			})
		}

		return {
			isValid: errors.length === 0,
			errors,
			warnings,
		}
	}

	// 验证当前编辑的prompts
	const validateEditingPrompts = (): ValidationResult => {
		const errors: ValidationError[] = []
		const warnings: string[] = []

		const editingPromptsList = Object.values(editingPrompts)
		const identifierSet = new Set<string>()

		editingPromptsList.forEach((prompt, index) => {
			// 检查identifier唯一性
			if (!prompt.identifier || prompt.identifier.trim() === "") {
				errors.push({
					field: `prompts[${index}].identifier`,
					message: `Prompt #${index + 1} 的标识符不能为空`,
				})
			} else if (identifierSet.has(prompt.identifier)) {
				errors.push({
					field: `prompts[${index}].identifier`,
					message: `Prompt标识符 "${prompt.identifier}" 重复`,
				})
			} else {
				identifierSet.add(prompt.identifier)
			}

			// 检查content
			if (!prompt.content || prompt.content.trim() === "") {
				warnings.push(`Prompt "${prompt.identifier}" 的内容为空`)
			}

			// 检查role
			if (!["system", "user", "assistant"].includes(prompt.role)) {
				errors.push({
					field: `prompts[${index}].role`,
					message: `Prompt "${prompt.identifier}" 的角色类型无效`,
				})
			}

			// 检查模板变量语法
			if (prompt.content) {
				const templateVarRegex = /\{\{([^}]+)\}\}/g
				const matches = prompt.content.match(templateVarRegex)
				if (matches) {
					matches.forEach((match) => {
						const varName = match.slice(2, -2).trim()
						// 检查是否包含已知的内置变量
						const builtInVars = [
							"user",
							"char",
							"name",
							"description",
							"personality",
							"scenario",
							"first_mes",
							"mes_example",
							"isodate",
							"isotime",
						]
						if (!builtInVars.includes(varName) && !varName.startsWith("custom_")) {
							warnings.push(`Prompt "${prompt.identifier}" 包含未知的模板变量: ${match}`)
						}
					})
				}
			}
		})

		return {
			isValid: errors.length === 0,
			errors,
			warnings,
		}
	}

	// 当编辑的prompts发生变化时，自动验证
	useEffect(() => {
		if (profileData && Object.keys(editingPrompts).length > 0) {
			const validation = validateEditingPrompts()
			setValidationResult(validation)
		}
	}, [editingPrompts, profileData])

	// 选择TSProfile文件
	const handleProfileSelect = (fileName: string, scope?: "global" | "workspace") => {
		const profile = profiles.find((p) => p.name === fileName && (scope ? p.scope === scope : true))
		if (!profile) return

		// 检查是否为孤立的mixin文件
		if (profile.isOrphanMixin) {
			setValidationError(
				`无法选择孤立的mixin文件: ${fileName}。请先创建对应的主profile文件: ${profile.expectedMainProfile}`,
			)
			return
		}

		setSelectedProfile(fileName)
		setSelectedProfileScope(profile.scope || "workspace")
		setLoading(true)
		setValidationError(null)
		setValidationSuccess(null)

		// 验证选择的profile
		if (profile) {
			vscode.postMessage({
				type: "validateTsProfile",
				tsProfilePath: profile.path,
			})
			// 同时加载profile内容
			loadProfileContent(fileName)
			// 同时加载mixin数据以确保显示一致性
			loadProfileMixin(fileName)
		}
		setLoading(false)
	}

	// 应用mixin到编辑状态的辅助函数
	const applyMixinToEditingState = (profileData: ProfileData, mixinData: ProfileMixin) => {
		if (mixinData.prompts && profileData.prompts) {
			const updatedEditingState = { ...editingPrompts }
			
			// 首先初始化所有原始prompts
			profileData.prompts.forEach((prompt: PromptConfig) => {
				if (!updatedEditingState[prompt.identifier]) {
					updatedEditingState[prompt.identifier] = { ...prompt }
				}
			})
			
			// 然后应用mixin修改
			mixinData.prompts.forEach((mixinPrompt: any) => {
				const originalPrompt = profileData.prompts.find(
					(p) => p.identifier === mixinPrompt.identifier,
				)
				if (originalPrompt) {
					updatedEditingState[mixinPrompt.identifier] = {
						...originalPrompt,
						enabled:
							mixinPrompt.enabled !== undefined
								? mixinPrompt.enabled
								: originalPrompt.enabled,
						content:
							mixinPrompt.content !== undefined
								? mixinPrompt.content
								: originalPrompt.content,
					}
				}
			})
			setEditingPrompts(updatedEditingState)
		}
	}

	// 加载profile内容的函数
	const loadProfileContent = (fileName: string) => {
		const profile = profiles.find((p) => p.name === fileName)
		if (profile) {
			vscode.postMessage({
				type: "loadTsProfileContent",
				tsProfilePath: profile.path,
			})
		}
	}

	// 加载mixin文件的函数
	const loadProfileMixin = (fileName: string) => {
		const profile = profiles.find((p) => p.name === fileName)
		if (profile) {
			vscode.postMessage({
				type: "loadTsProfileMixin",
				mixinPath: profile.path.replace(".json", ".mixin.json"),
			})
		}
	}

	// 切换编辑模式
	const handleEditModeToggle = (mode: "source" | "mixin") => {
		if (hasUnsavedChanges) {
			if (!confirm("切换模式将丢失未保存的更改，确定要继续吗？")) {
				return
			}
		}
		setEditMode(mode)
		setHasUnsavedChanges(false)

		if (mode === "mixin" && selectedProfile) {
			loadProfileMixin(selectedProfile)
		}
	}

	// 保存mixin文件
	const handleSaveMixin = () => {
		if (!selectedProfile || !profileData) return

		// 验证当前编辑的数据
		const validation = validateEditingPrompts()
		if (!validation.isValid) {
			setValidationError(`保存失败: ${validation.errors.map((e) => e.message).join(", ")}`)
			return
		}

		const mixinPrompts = Object.entries(editingPrompts)
			.map(([identifier, prompt]) => {
				const originalPrompt = profileData.prompts.find((p) => p.identifier === identifier)
				const mixinPrompt: any = { identifier }

				// 只有当值发生变化时才添加到mixin
				if (originalPrompt) {
					if (prompt.enabled !== originalPrompt.enabled) {
						mixinPrompt.enabled = prompt.enabled
					}
					if (prompt.content !== originalPrompt.content) {
						mixinPrompt.content = prompt.content
					}
				}

				return mixinPrompt
			})
			.filter((mixin) => Object.keys(mixin).length > 1) // 过滤掉只有identifier的项

		const mixinData: ProfileMixin = {
			version: "1.0.0",
			description: `Mixin for ${selectedProfile}`,
			prompts: mixinPrompts,
			metadata: {
				createdAt: Date.now(),
				updatedAt: Date.now(),
				author: "User",
			},
		}

		const profile = profiles.find((p) => p.name === selectedProfile)
		if (profile) {
			vscode.postMessage({
				type: "saveTsProfileMixin",
				mixinPath: profile.path.replace(".json", ".mixin.json"),
				mixinData,
			})
		}
	}

	// 保存源文件
	const handleSaveSource = () => {
		if (!selectedProfile || !profileData) return

		// 验证当前编辑的数据
		const validation = validateEditingPrompts()
		if (!validation.isValid) {
			setValidationError(`保存失败: ${validation.errors.map((e) => e.message).join(", ")}`)
			return
		}

		const updatedProfileData = {
			...profileData,
			prompts: Object.values(editingPrompts),
		}

		const profile = profiles.find((p) => p.name === selectedProfile)
		if (profile) {
			vscode.postMessage({
				type: "saveTsProfileSource",
				tsProfilePath: profile.path,
				profileData: updatedProfileData,
			})
		}
	}

	// 切换prompt的展开状态
	const togglePromptExpanded = (identifier: string) => {
		const newExpanded = new Set(expandedPrompts)
		if (newExpanded.has(identifier)) {
			newExpanded.delete(identifier)
		} else {
			newExpanded.add(identifier)
		}
		setExpandedPrompts(newExpanded)
	}

	// 更新prompt内容
	const updatePromptContent = (identifier: string, field: keyof PromptConfig, value: any) => {
		setEditingPrompts((prev) => ({
			...prev,
			[identifier]: {
				...prev[identifier],
				[field]: value,
			},
		}))
		setHasUnsavedChanges(true)
	}

	// 启用TSProfile - 暂存保存模式
	const handleEnableTSProfile = (fileName: string, scope: "global" | "workspace" = "workspace") => {
		console.log(`[TSProfile] Enabling profile: ${fileName}, scope: ${scope}`)
		// 为启用状态创建唯一标识：name|:|scope (使用|:|避免与文件名中的任何字符冲突)
		const enabledProfileKey = `${fileName}|:|${scope}`
		// 更新本地状态 - 添加到已启用列表
		const newEnabledTSProfiles = [...enabledTSProfiles, enabledProfileKey].filter(
			(key, index, arr) => arr.indexOf(key) === index,
		)
		console.log(`[TSProfile] New enabled profiles:`, newEnabledTSProfiles)
		setCachedStateField("enabledTSProfiles", newEnabledTSProfiles)
		setCachedStateField("tsProfilesHasChanges", true)
		// 不再立即发送给后端，而是等待用户点击保存
	}

	// 禁用TSProfile - 暂存保存模式
	const handleDisableTSProfile = (fileName: string, scope: "global" | "workspace" = "workspace") => {
		console.log(`[TSProfile] Disabling profile: ${fileName}, scope: ${scope}`)
		// 为启用状态创建唯一标识：name|:|scope (使用|:|避免与文件名中的任何字符冲突)
		const enabledProfileKey = `${fileName}|:|${scope}`
		// 更新本地状态 - 从已启用列表中移除
		const newEnabledTSProfiles = enabledTSProfiles?.filter((key) => key !== enabledProfileKey) || []
		console.log(`[TSProfile] New enabled profiles:`, newEnabledTSProfiles)
		setCachedStateField("enabledTSProfiles", newEnabledTSProfiles)
		setCachedStateField("tsProfilesHasChanges", true)
		// 不再立即发送给后端，而是等待用户点击保存
	}

	// 禁用所有TSProfile - 暂存保存模式
	const handleDisableAllTSProfiles = () => {
		setCachedStateField("enabledTSProfiles", [])
		setCachedStateField("tsProfilesHasChanges", true)
		// 不再立即发送给后端，而是等待用户点击保存
	}

	// 刷新TSProfile列表
	const handleRefresh = () => {
		vscode.postMessage({ type: "loadTsProfiles" })
	}

	// 浏览选择TSProfile文件
	const handleBrowseProfile = () => {
		const isGlobal = profileScope === "global"
		vscode.postMessage({
			type: "browseTsProfile",
			isGlobal,
		})
	}

	// 复制 profile 到全局或工作区
	const handleCopyProfile = (profile: ProfileInfo, targetScope: "global" | "workspace") => {
		setCopyTargetProfile(profile)
		setCopyTargetScope(targetScope)
		setShowCopyDialog(true)
	}

	// 确认复制 profile
	const confirmCopyProfile = () => {
		if (!copyTargetProfile) return

		vscode.postMessage({
			type: "copyTsProfile",
			sourceProfile: copyTargetProfile,
			targetScope: copyTargetScope,
		})

		setShowCopyDialog(false)
		setCopyTargetProfile(null)
	}

	// 删除 profile
	const handleDeleteProfile = (profile: ProfileInfo) => {
		if (confirm(`确定要删除 profile "${profile.name}" 吗？此操作不可撤销。`)) {
			vscode.postMessage({
				type: "deleteTsProfile",
				profile,
			})
		}
	}

	// 过滤显示的 profiles
	const getFilteredProfiles = () => {
		switch (profileScope) {
			case "global":
				return profiles.filter(p => p.scope === "global")
			case "workspace":
				return profiles.filter(p => p.scope === "workspace" || !p.scope)
			default:
				return profiles
		}
	}

	const filteredProfiles = getFilteredProfiles()

	// 处理自动注入开关变化 - 暂存保存模式
	const handleAutoInjectChange = (value: boolean) => {
		setCachedStateField("anhTsProfileAutoInject", value)
		setCachedStateField("tsProfilesHasChanges", true)
		// 不再立即发送给后端，而是等待用户点击保存
	}

	// 处理变量变化 - 暂存保存模式
	const handleVariableChange = (key: string, value: string) => {
		const newVariables = { ...anhTsProfileVariables, [key]: value }
		setCachedStateField("anhTsProfileVariables", newVariables)
		setCachedStateField("tsProfilesHasChanges", true)
		// 不再立即发送给后端，而是等待用户点击保存
	}

	const handleVariableRemove = (key: string) => {
		const newVariables = { ...anhTsProfileVariables }
		delete newVariables[key]
		setCachedStateField("anhTsProfileVariables", newVariables)
		setCachedStateField("tsProfilesHasChanges", true)
		// 不再立即发送给后端，而是等待用户点击保存
	}

	const handleVariableAdd = () => {
		const newKey = `variable_${Object.keys(anhTsProfileVariables).length + 1}`
		const newVariables = { ...anhTsProfileVariables, [newKey]: "" }
		setCachedStateField("anhTsProfileVariables", newVariables)
		setCachedStateField("tsProfilesHasChanges", true)
		// 不再立即发送给后端，而是等待用户点击保存
	}

	const currentProfile = profiles.find((p) => p.name === selectedProfile && p.scope === selectedProfileScope)

	return (
		<div className={cn("flex flex-col gap-4", className)} {...props}>
			<SectionHeader description={t("settings:tsProfile.description")}>
				<div className="flex items-center gap-2">
					<FileText className="w-4 h-4" />
					<div>{t("settings:tsProfile.title")}</div>
					{tsProfilesHasChanges && (
						<div className="flex items-center gap-2 ml-auto">
							<span className="text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-400">
								未保存的更改
							</span>
							<button
								className="px-2 py-1 text-xs bg-gray-500/20 text-gray-400 rounded hover:bg-gray-500/30"
								onClick={resetTSProfileChanges}>
								重置
							</button>
							<button
								className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30"
								onClick={saveTSProfileChanges}>
								保存更改
							</button>
						</div>
					)}
				</div>
			</SectionHeader>

			{/* 当前状态显示 */}
			<Section>
				<div className="flex items-center justify-between p-3 bg-vscode-editor-background rounded border border-vscode-widget-border">
					<div className="flex items-center gap-2">
						<div
							className={cn(
								"w-2 h-2 rounded-full",
								enabledTSProfiles?.length > 0 ? "bg-green-400" : "bg-gray-400",
							)}
						/>
						<span className="text-sm font-medium">
							{enabledTSProfiles?.length > 0 ? `已启用 (${enabledTSProfiles.length})` : "未启用"}
						</span>
						{enabledTSProfiles?.length > 0 && (
							<div className="flex flex-wrap gap-1 ml-2">
								{enabledTSProfiles.map((profileKey) => {
									const [profileName, scope] = profileKey.split('|:|')
									const profile = profiles.find(p => p.name === profileName && p.scope === scope)
									return (
										<span
											key={profileKey}
											className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400 flex items-center gap-1">
											{profileName}
											{scope === "global" && (
												<span title="全局">
													<Globe className="w-2 h-2" />
												</span>
											)}
											<button
												className="hover:bg-red-500/30 rounded-full p-0.5"
												onClick={() => handleDisableTSProfile(profileName, scope as "global" | "workspace")}
												title={`禁用 ${profileName} (${scope === "global" ? "全局" : "工作区"})`}>
												<Square className="w-2 h-2" />
											</button>
										</span>
									)
								})}
							</div>
						)}
					</div>
					{enabledTSProfiles?.length > 0 && (
						<button
							className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
							onClick={handleDisableAllTSProfiles}>
							<Square className="w-3 h-3 inline mr-1" />
							全部禁用
						</button>
					)}
				</div>
			</Section>

			{/* 自动注入开关 */}
			<Section>
				<div className="flex items-center justify-between py-3">
					<div className="flex items-center gap-2">
						<label htmlFor="ts-profile-auto-inject" className="text-sm font-medium">
							{t("settings:tsProfile.autoInjectLabel")}
						</label>
						<StandardTooltip content={t("settings:tsProfile.autoInjectTooltip")}>
							<Info className="w-4 h-4 text-vscode-descriptionForeground" />
						</StandardTooltip>
					</div>
					<input
						id="ts-profile-auto-inject"
						type="checkbox"
						checked={anhTsProfileAutoInject}
						onChange={(e) => handleAutoInjectChange(e.target.checked)}
						className="w-4 h-4 rounded border-vscode-input-border bg-vscode-input-background text-vscode-focusBorder focus:ring-vscode-focusBorder"
					/>
				</div>
			</Section>

			<Section>
				<div className="flex gap-4 h-96 overflow-hidden">
					{/* 左栏：TSProfile文件选择 */}
					<div className="flex-1 border-r border-vscode-sideBar-background pr-4 min-w-0">
						<div className="flex items-center justify-between mb-3">
							<div className="flex items-center gap-2">
								<FileText className="w-4 h-4" />
								<h3 className="text-sm font-medium">TSProfile文件</h3>
							</div>
							<div className="flex gap-1">
								{/* 全局/工作区切换 */}
								<div className="flex items-center gap-1 bg-vscode-editor-background border border-vscode-widget-border rounded p-1 mr-2">
									<button
										className={cn(
											"px-2 py-1 text-xs rounded flex items-center gap-1 transition-colors",
											profileScope === "all"
												? "bg-vscode-button-background text-vscode-button-foreground"
												: "text-vscode-descriptionForeground hover:bg-vscode-toolbar-hoverBackground",
										)}
										onClick={() => setProfileScope("all")}
										title="显示所有文件">
										全部
									</button>
									<button
										className={cn(
											"px-2 py-1 text-xs rounded flex items-center gap-1 transition-colors",
											profileScope === "workspace"
												? "bg-vscode-button-background text-vscode-button-foreground"
												: "text-vscode-descriptionForeground hover:bg-vscode-toolbar-hoverBackground",
										)}
										onClick={() => setProfileScope("workspace")}
										title="显示工作区文件">
										<Folder className="w-3 h-3" />
										工作区
									</button>
									<button
										className={cn(
											"px-2 py-1 text-xs rounded flex items-center gap-1 transition-colors",
											profileScope === "global"
												? "bg-vscode-button-background text-vscode-button-foreground"
												: "text-vscode-descriptionForeground hover:bg-vscode-toolbar-hoverBackground",
										)}
										onClick={() => setProfileScope("global")}
										title="显示全局文件">
										<Globe className="w-3 h-3" />
										全局
									</button>
								</div>
								<button
									className="p-1 text-xs hover:bg-vscode-toolbar-hoverBackground rounded"
									onClick={handleRefresh}
									title="刷新列表">
									<RefreshCw className="w-3 h-3" />
								</button>
								<button
									className="p-1 text-xs hover:bg-vscode-toolbar-hoverBackground rounded"
									onClick={handleBrowseProfile}
									title="浏览文件">
									<FolderOpen className="w-3 h-3" />
								</button>
							</div>
						</div>

						<div className="space-y-2 max-h-80 overflow-y-auto">
							{filteredProfiles.length === 0 ? (
								<div className="text-sm text-vscode-descriptionForeground text-center py-4">
									{profileScope === "all"
										? "暂无TSProfile文件"
										: profileScope === "global"
											? "暂无全局TSProfile文件"
											: "暂无工作区TSProfile文件"}
								</div>
							) : (
								filteredProfiles.map((profile) => (
									<div
										key={`${profile.name}-${profile.scope || "workspace"}`}
										className={cn(
											"p-3 rounded border transition-colors",
											"hover:bg-vscode-list-hoverBackground",
											selectedProfile === profile.name && selectedProfileScope === (profile.scope || "workspace")
												? "bg-vscode-list-activeSelectionBackground border-vscode-focusBorder"
												: "border-vscode-widget-border",
										)}
										onClick={() => handleProfileSelect(profile.name, profile.scope || "workspace")}>
										<div className="flex items-center justify-between mb-1">
											<h4 className="text-sm font-medium truncate">{profile.name}</h4>
											<div className="flex gap-1">
												{profile.isOrphanMixin ? (
													<span
														className="text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-400"
														title="孤立mixin文件无法启用">
														不可启用
													</span>
												) : enabledTSProfiles?.includes(`${profile.name}|:|${profile.scope || "workspace"}`) ? (
													<>
														<span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400">
															已启用
														</span>
														<button
															className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
															onClick={(e) => {
																e.stopPropagation()
																handleDisableTSProfile(profile.name, profile.scope || "workspace")
															}}>
															<Square className="w-3 h-3 inline mr-1" />
															禁用
														</button>
													</>
												) : (
													<button
														className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
														onClick={(e) => {
															e.stopPropagation()
															handleEnableTSProfile(profile.name, profile.scope || "workspace")
														}}>
														<Play className="w-3 h-3 inline mr-1" />
														启用
													</button>
												)}
												{/* 复制按钮 */}
												<button
													className="text-xs px-1.5 py-1 rounded bg-gray-500/20 text-gray-400 hover:bg-gray-500/30"
													onClick={(e) => {
														e.stopPropagation()
														handleCopyProfile(profile, profile.scope === "global" ? "workspace" : "global")
													}}
													title={`复制到${profile.scope === "global" ? "工作区" : "全局"}`}>
													<Copy className="w-3 h-3" />
												</button>
												{/* 删除按钮 */}
												<button
													className="text-xs px-1.5 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
													onClick={(e) => {
														e.stopPropagation()
														handleDeleteProfile(profile)
													}}
													title="删除">
													<Trash2 className="w-3 h-3" />
												</button>
											</div>
										</div>
										<p className="text-xs text-vscode-descriptionForeground mb-1">
											{profile.description}
										</p>
										<div className="flex items-center justify-between text-xs text-vscode-descriptionForeground">
											<div className="flex items-center gap-1 truncate flex-1 mr-2">
												{/* 全局/工作区标识 */}
												{profile.scope === "global" ? (
													<span title="全局文件">
														<Globe className="w-3 h-3 text-blue-400 flex-shrink-0" />
													</span>
												) : (
													<span title="工作区文件">
														<Folder className="w-3 h-3 text-green-400 flex-shrink-0" />
													</span>
												)}
												<span className="truncate">{profile.path}</span>
											</div>
											<div className="flex items-center gap-1">
												{profile.isOrphanMixin ? (
													<span
														className="px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 text-xs"
														title="孤立的mixin文件">
														孤立mixin
													</span>
												) : profile.hasMixin ? (
													<span
														className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 text-xs"
														title="有对应的mixin文件">
														有mixin ({profile.mixinPromptsCount})
													</span>
												) : (
													<span className="px-1.5 py-0.5 rounded bg-gray-500/20 text-gray-400 text-xs">
														无mixin
													</span>
												)}
												{profile.promptsCount && (
													<span className="text-xs">{profile.promptsCount} 个</span>
												)}
											</div>
										</div>
									</div>
								))
							)}
						</div>
					</div>

					{/* 右栏：TSProfile详情和验证状态 */}
					<div className="flex-1 pl-4 min-w-0">
						<div className="flex items-center gap-2 mb-3">
							<FileText className="w-4 h-4" />
							<h3 className="text-sm font-medium">详情信息</h3>
						</div>

						{selectedProfile ? (
							<div className="border border-vscode-widget-border rounded p-3 h-full overflow-y-auto">
								<h4 className="text-sm font-medium mb-2 break-words">{selectedProfile}</h4>
								{currentProfile && (
									<div className="space-y-2 text-xs text-vscode-descriptionForeground">
										<div>
											<strong>路径:</strong>{" "}
											<span className="break-all text-wrap">{currentProfile.path}</span>
										</div>
										{currentProfile.description && (
											<div>
												<strong>描述:</strong> {currentProfile.description}
											</div>
										)}
										{currentProfile.promptsCount && (
											<div>
												<strong>提示词数量:</strong> {currentProfile.promptsCount}
											</div>
										)}
										{currentProfile.enabledCount && (
											<div>
												<strong>启用数量:</strong> {currentProfile.enabledCount}
											</div>
										)}

										{/* Mixin 相关信息 */}
										{currentProfile.isOrphanMixin ? (
											<div className="text-yellow-400">
												<strong>状态:</strong> 孤立的 Mixin 文件
												<br />
												<span className="opacity-80">
													期望的主 profile: {currentProfile.expectedMainProfile}
												</span>
											</div>
										) : currentProfile.hasMixin ? (
											<div className="text-purple-400">
												<strong>Mixin 状态:</strong> 已关联 Mixin 文件
												<br />
												<span className="opacity-80">
													Mixin 路径: {currentProfile?.mixinPath?.split(/[/\\]/).pop()}
													{currentProfile.mixinPromptsCount && ` (${currentProfile.mixinPromptsCount} 个修改项)`}
													{mixinData?.prompts && ` - 已加载 ${mixinData.prompts.length} 个修改项`}
												</span>
											</div>
										) : (
											<div className="text-gray-400">
												<strong>Mixin 状态:</strong> 无 Mixin 文件
											</div>
										)}
									</div>
								)}

								{/* 验证状态 */}
								{validationError && (
									<div className="flex items-center gap-2 text-xs text-vscode-errorForeground bg-red-500/10 p-2 rounded mt-2">
										<AlertTriangle className="w-3 h-3" />
										{validationError}
									</div>
								)}
								{validationSuccess && (
									<div className="flex items-center gap-2 text-xs text-vscode-charts-green bg-green-500/10 p-2 rounded mt-2">
										<CheckCircle className="w-3 h-3" />
										{validationSuccess}
									</div>
								)}
							</div>
						) : (
							<div className="text-sm text-vscode-descriptionForeground text-center py-8 border border-vscode-widget-border rounded">
								请选择一个TSProfile文件查看详情
							</div>
						)}
					</div>
				</div>
			</Section>

			{/* Prompts 编辑区域 - 按profile分类 */}
			{selectedProfile && profileData && (
				<Section>
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<Edit3 className="w-4 h-4" />
								<h3 className="text-sm font-medium">提示词编辑</h3>
								<span className="text-xs text-vscode-descriptionForeground">({selectedProfile})</span>
								{hasUnsavedChanges && (
									<span className="text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-400">
										未保存的更改
									</span>
								)}
							</div>
							<div className="flex items-center gap-2">
								{/* 编辑模式切换 */}
								<div className="flex items-center gap-1 bg-vscode-editor-background border border-vscode-widget-border rounded p-1">
									<button
										className={cn(
											"px-2 py-1 text-xs rounded flex items-center gap-1 transition-colors",
											editMode === "mixin"
												? "bg-vscode-button-background text-vscode-button-foreground"
												: "text-vscode-descriptionForeground hover:bg-vscode-toolbar-hoverBackground",
										)}
										onClick={() => handleEditModeToggle("mixin")}>
										<FilePlus className="w-3 h-3" />
										Mixin
									</button>
									<button
										className={cn(
											"px-2 py-1 text-xs rounded flex items-center gap-1 transition-colors",
											editMode === "source"
												? "bg-vscode-button-background text-vscode-button-foreground"
												: "text-vscode-descriptionForeground hover:bg-vscode-toolbar-hoverBackground",
										)}
										onClick={() => handleEditModeToggle("source")}>
										<FileText className="w-3 h-3" />
										源文件
									</button>
								</div>

								{/* 保存按钮 */}
								{hasUnsavedChanges && (
									<button
										className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 flex items-center gap-1"
										onClick={editMode === "mixin" ? handleSaveMixin : handleSaveSource}>
										<Save className="w-3 h-3" />
										保存{editMode === "mixin" ? "Mixin" : "源文件"}
									</button>
								)}
							</div>
						</div>

						{/* 编辑模式说明 */}
						<div className="text-xs text-vscode-descriptionForeground bg-vscode-textBlockQuote-background p-2 rounded">
							<div className="flex items-center gap-2">
								<span>
									{editMode === "mixin"
										? "Mixin模式：修改将保存到单独的mixin文件，不会影响原始profile文件。推荐用于个性化定制。"
										: "源文件模式：直接修改原始profile文件。请谨慎使用，建议先备份原文件。"}
								</span>
								{editMode === "mixin" &&
									mixinData &&
									mixinData.prompts &&
									mixinData.prompts.length > 0 && (
										<span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 text-xs">
											{mixinData.prompts.length} 个Mixin项已加载
										</span>
									)}
							</div>
							{editMode === "mixin" && (
								<div className="mt-1 pt-1 border-t border-vscode-widget-border">
									<span className="text-xs">标签说明：</span>
									<span className="ml-2 text-xs text-purple-400">🟣 Mixin</span>
									<span className="ml-2 text-xs text-red-400">🟥 已禁用</span>
									<span className="ml-2 text-xs text-green-400">🟩 已启用</span>
									<span className="ml-2 text-xs text-blue-400">🟦 内容已改</span>
									<span className="ml-2 text-xs text-yellow-400">🟨 未保存</span>
								</div>
							)}
						</div>

						{/* Profile 容器 */}
						<div className="border border-vscode-widget-border rounded">
							{/* Profile 头部 */}
							<div className="p-3 border-b border-vscode-widget-border bg-vscode-editor-background">
								<div className="flex items-center gap-2">
									<FileText className="w-4 h-4" />
									<h4 className="text-sm font-medium">{selectedProfile}</h4>
									<span className="text-xs text-vscode-descriptionForeground">
										({profileData.prompts?.length || 0} 个提示词)
									</span>

									{/* Mixin 状态统计 */}
									{mixinData && mixinData.prompts && (
										<div className="flex items-center gap-1">
											<span className="text-xs px-2 py-1 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
												{mixinData.prompts.length} 个Mixin项
											</span>

											{/* 计算各种mixin修改的数量 */}
											{(() => {
												const disabledCount = mixinData.prompts.filter(
													(m: any) =>
														m.enabled === false &&
														profileData.prompts?.find(
															(p: any) => p.identifier === m.identifier,
														)?.enabled,
												).length

												const enabledCount = mixinData.prompts.filter(
													(m: any) =>
														m.enabled === true &&
														!profileData.prompts?.find(
															(p: any) => p.identifier === m.identifier,
														)?.enabled,
												).length

												const contentChangedCount = mixinData.prompts.filter(
													(m: any) =>
														m.content !== undefined &&
														m.content !==
															profileData.prompts?.find(
																(p: any) => p.identifier === m.identifier,
															)?.content,
												).length

												return (
													<>
														{disabledCount > 0 && (
															<span
																className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400"
																title={`在Mixin中禁用了 ${disabledCount} 个提示词`}>
																-{disabledCount}
															</span>
														)}
														{enabledCount > 0 && (
															<span
																className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-400"
																title={`在Mixin中启用了 ${enabledCount} 个提示词`}>
																+{enabledCount}
															</span>
														)}
														{contentChangedCount > 0 && (
															<span
																className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400"
																title={`在Mixin中修改了 ${contentChangedCount} 个提示词内容`}>
																📝{contentChangedCount}
															</span>
														)}
													</>
												)
											})()}
										</div>
									)}
								</div>
								{currentProfile && (
									<div className="mt-1 space-y-1">
										<p className="text-xs text-vscode-descriptionForeground break-all">
											路径: {currentProfile.path}
										</p>
										{currentProfile.hasMixin && (
											<p className="text-xs text-purple-400 break-all">
												Mixin路径: {currentProfile.mixinPath?.split(/[/\\]/).pop()}
											</p>
										)}
									</div>
								)}
							</div>

							{/* Prompts 列表 */}
							<div className="max-h-96 overflow-y-auto">
								<div className="p-3 space-y-2">
									{profileData.prompts?.map((prompt) => {
										const editingPrompt = editingPrompts[prompt.identifier]
										if (!editingPrompt) return null

										const isExpanded = expandedPrompts.has(prompt.identifier)
										const hasChanges =
											profileData &&
											(editingPrompt.enabled !== prompt.enabled ||
												editingPrompt.content !== prompt.content)

										// 检查此prompt是否被mixin修改
										const isModifiedByMixin =
											mixinData &&
											mixinData.prompts &&
											mixinData.prompts.some((m: any) => m.identifier === prompt.identifier)
										const isDisabledByMixin =
											editMode === "mixin" &&
											mixinData &&
											mixinData.prompts &&
											mixinData.prompts.some(
												(m: any) =>
													m.identifier === prompt.identifier &&
													m.enabled === false &&
													prompt.enabled,
											)
										const isEnabledByMixin =
											editMode === "mixin" &&
											mixinData &&
											mixinData.prompts &&
											mixinData.prompts.some(
												(m: any) =>
													m.identifier === prompt.identifier &&
													m.enabled === true &&
													!prompt.enabled,
											)

										return (
											<div
												key={prompt.identifier}
												className={cn(
													"border rounded transition-colors",
													"border-vscode-widget-border",
													isModifiedByMixin &&
														"border-l-4 border-l-purple-500 bg-purple-500/5",
													isDisabledByMixin && "border-l-4 border-l-red-500 bg-red-500/5",
													isEnabledByMixin && "border-l-4 border-l-green-500 bg-green-500/5",
												)}>
												{/* Prompt 头部 */}
												<div
													className="flex items-center justify-between p-3 cursor-pointer hover:bg-vscode-list-hoverBackground"
													onClick={() => togglePromptExpanded(prompt.identifier)}>
													<div className="flex items-center gap-2">
														<div
															className={cn(
																"w-2 h-2 rounded-full",
																editingPrompt.enabled ? "bg-green-400" : "bg-gray-400",
															)}
														/>
														<span className="text-sm font-medium">
															{editingPrompt.name || prompt.identifier}
														</span>
														<span className="text-xs text-vscode-descriptionForeground">
															{editingPrompt.role}
														</span>

														{/* 显示各种状态标签 */}
														<div className="flex items-center gap-1">
															{/* 被mixin修改的标签 */}
															{mixinData &&
																mixinData.prompts &&
																mixinData.prompts.some(
																	(m: any) => m.identifier === prompt.identifier,
																) && (
																	<span
																		className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30"
																		title="此提示词被Mixin修改">
																		Mixin
																	</span>
																)}

															{/* 在mixin模式下被禁用的标签 */}
															{editMode === "mixin" &&
																mixinData &&
																mixinData.prompts &&
																mixinData.prompts.some(
																	(m: any) =>
																		m.identifier === prompt.identifier &&
																		m.enabled === false &&
																		prompt.enabled,
																) && (
																	<span
																		className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30"
																		title="在Mixin中被禁用">
																		已禁用
																	</span>
																)}

															{/* 在mixin中被启用的标签 */}
															{editMode === "mixin" &&
																mixinData &&
																mixinData.prompts &&
																mixinData.prompts.some(
																	(m: any) =>
																		m.identifier === prompt.identifier &&
																		m.enabled === true &&
																		!prompt.enabled,
																) && (
																	<span
																		className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30"
																		title="在Mixin中启用">
																		已启用
																	</span>
																)}

															{/* 在mixin中内容被修改的标签 */}
															{editMode === "mixin" &&
																mixinData &&
																mixinData.prompts &&
																mixinData.prompts.some(
																	(m: any) =>
																		m.identifier === prompt.identifier &&
																		m.content !== undefined &&
																		m.content !== prompt.content,
																) && (
																	<span
																		className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30"
																		title="内容被Mixin修改">
																		内容已改
																	</span>
																)}

															{/* 有未保存的修改 */}
															{hasChanges && (
																<span
																	className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
																	title="有未保存的更改">
																	未保存
																</span>
															)}
														</div>
													</div>
													<div className="flex items-center gap-1">
														{/* 启用/禁用切换 */}
														<button
															className={cn(
																"p-1 text-xs rounded transition-colors",
																editingPrompt.enabled
																	? "text-green-400 hover:bg-green-500/10"
																	: "text-gray-400 hover:bg-gray-500/10",
															)}
															onClick={(e) => {
																e.stopPropagation()
																updatePromptContent(
																	prompt.identifier,
																	"enabled",
																	!editingPrompt.enabled,
																)
															}}>
															{editingPrompt.enabled ? (
																<ToggleRight className="w-4 h-4" />
															) : (
																<ToggleLeft className="w-4 h-4" />
															)}
														</button>

														{/* 展开/收起 */}
														{isExpanded ? (
															<X className="w-4 h-4" />
														) : (
															<Edit3 className="w-4 h-4" />
														)}
													</div>
												</div>

												{/* Prompt 详细内容 */}
												{isExpanded && (
													<div className="border-t border-vscode-widget-border p-3 space-y-3">
														{/* 显示当前prompt的mixin状态 */}
														{(isModifiedByMixin ||
															isDisabledByMixin ||
															isEnabledByMixin) && (
															<div className="flex items-center gap-2 p-2 rounded bg-vscode-textBlockQuote-background">
																<span className="text-xs font-medium">Mixin状态:</span>
																{isModifiedByMixin && (
																	<span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
																		被Mixin修改
																	</span>
																)}
																{isDisabledByMixin && (
																	<span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
																		在Mixin中禁用
																	</span>
																)}
																{isEnabledByMixin && (
																	<span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30">
																		在Mixin中启用
																	</span>
																)}
																{editMode === "mixin" && (
																	<span className="text-xs text-vscode-descriptionForeground ml-auto">
																		{hasChanges
																			? "当前有未保存的修改"
																			: "与Mixin文件同步"}
																	</span>
																)}
															</div>
														)}

														<div className="grid grid-cols-2 gap-3">
															<div>
																<label className="text-xs font-medium text-vscode-descriptionForeground">
																	标识符
																</label>
																<input
																	type="text"
																	value={editingPrompt.identifier}
																	disabled
																	className="w-full px-2 py-1 text-xs bg-vscode-input-background border border-vscode-input-border rounded opacity-60"
																/>
															</div>
															<div>
																<label className="text-xs font-medium text-vscode-descriptionForeground">
																	名称
																</label>
																<input
																	type="text"
																	value={editingPrompt.name || ""}
																	onChange={(e) =>
																		updatePromptContent(
																			prompt.identifier,
																			"name",
																			e.target.value,
																		)
																	}
																	className="w-full px-2 py-1 text-xs bg-vscode-input-background border border-vscode-input-border rounded focus:outline-none focus:ring-1 focus:ring-vscode-focusBorder"
																/>
															</div>
														</div>

														<div>
															<label className="text-xs font-medium text-vscode-descriptionForeground">
																内容
															</label>
															<textarea
																value={editingPrompt.content}
																onChange={(e) =>
																	updatePromptContent(
																		prompt.identifier,
																		"content",
																		e.target.value,
																	)
																}
																rows={6}
																className="w-full px-2 py-1 text-xs bg-vscode-input-background border border-vscode-input-border rounded focus:outline-none focus:ring-1 focus:ring-vscode-focusBorder resize-vertical"
																placeholder="输入提示词内容..."
															/>
														</div>

														<div className="grid grid-cols-3 gap-3">
															<div>
																<label className="text-xs font-medium text-vscode-descriptionForeground">
																	角色
																</label>
																<select
																	value={editingPrompt.role}
																	onChange={(e) =>
																		updatePromptContent(
																			prompt.identifier,
																			"role",
																			e.target.value,
																		)
																	}
																	className="w-full px-2 py-1 text-xs bg-vscode-input-background border border-vscode-input-border rounded focus:outline-none focus:ring-1 focus:ring-vscode-focusBorder">
																	<option value="system">系统</option>
																	<option value="user">用户</option>
																	<option value="assistant">助手</option>
																</select>
															</div>
															<div className="flex items-center gap-2">
																<input
																	type="checkbox"
																	id={`system-prompt-${prompt.identifier}`}
																	checked={editingPrompt.system_prompt}
																	onChange={(e) =>
																		updatePromptContent(
																			prompt.identifier,
																			"system_prompt",
																			e.target.checked,
																		)
																	}
																	className="w-3 h-3 rounded border-vscode-input-border bg-vscode-input-background text-vscode-focusBorder focus:ring-vscode-focusBorder"
																/>
																<label
																	htmlFor={`system-prompt-${prompt.identifier}`}
																	className="text-xs text-vscode-descriptionForeground">
																	系统提示词
																</label>
															</div>
															<div className="flex items-center gap-2">
																<input
																	type="checkbox"
																	id={`marker-${prompt.identifier}`}
																	checked={editingPrompt.marker}
																	onChange={(e) =>
																		updatePromptContent(
																			prompt.identifier,
																			"marker",
																			e.target.checked,
																		)
																	}
																	className="w-3 h-3 rounded border-vscode-input-border bg-vscode-input-background text-vscode-focusBorder focus:ring-vscode-focusBorder"
																/>
																<label
																	htmlFor={`marker-${prompt.identifier}`}
																	className="text-xs text-vscode-descriptionForeground">
																	标记
																</label>
															</div>
														</div>
													</div>
												)}
											</div>
										)
									})}
								</div>
							</div>
						</div>
					</div>
				</Section>
			)}

			{/* 验证结果显示 */}
			{selectedProfile && validationResult && (
				<Section>
					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<h3 className="text-sm font-medium">验证结果</h3>
								<span
									className={cn(
										"px-2 py-1 text-xs rounded",
										validationResult.isValid
											? "bg-green-500/20 text-green-400"
											: "bg-red-500/20 text-red-400",
									)}>
									{validationResult.isValid ? "验证通过" : "验证失败"}
								</span>
							</div>
							{(validationResult.errors.length > 0 || validationResult.warnings.length > 0) && (
								<button
									className="text-xs text-vscode-descriptionForeground hover:text-vscode-foreground"
									onClick={() => setShowValidationDetails(!showValidationDetails)}>
									{showValidationDetails ? "隐藏详情" : "显示详情"}
								</button>
							)}
						</div>

						{showValidationDetails && (
							<div className="space-y-2">
								{validationResult.errors.length > 0 && (
									<div className="border border-red-500/30 rounded p-2">
										<h4 className="text-xs font-medium text-red-400 mb-1">错误</h4>
										<ul className="space-y-1">
											{validationResult.errors.map((error, index) => (
												<li key={index} className="text-xs text-red-300">
													<span className="font-mono">{error.field}</span>: {error.message}
												</li>
											))}
										</ul>
									</div>
								)}

								{validationResult.warnings.length > 0 && (
									<div className="border border-yellow-500/30 rounded p-2">
										<h4 className="text-xs font-medium text-yellow-400 mb-1">警告</h4>
										<ul className="space-y-1">
											{validationResult.warnings.map((warning, index) => (
												<li key={index} className="text-xs text-yellow-300">
													{warning}
												</li>
											))}
										</ul>
									</div>
								)}

								{validationResult.errors.length === 0 && validationResult.warnings.length === 0 && (
									<div className="text-xs text-green-400">没有发现任何问题</div>
								)}
							</div>
						)}
					</div>
				</Section>
			)}

			{/* 模板变量设置 */}
			<Section>
				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<label className="text-sm font-medium">{t("settings:tsProfile.variablesLabel")}</label>
							<StandardTooltip content={t("settings:tsProfile.variablesTooltip")}>
								<Info className="w-4 h-4 text-vscode-descriptionForeground" />
							</StandardTooltip>
						</div>
						<button
							onClick={handleVariableAdd}
							className="px-2 py-1 text-xs bg-vscode-button-background hover:bg-vscode-button-hoverBackground text-vscode-button-foreground rounded flex items-center gap-1">
							<Play className="w-3 h-3" />
							{t("common:add")}
						</button>
					</div>

					<div className="space-y-2 max-h-48 overflow-y-auto">
						{Object.entries(anhTsProfileVariables).map(([key, value]) => (
							<div key={key} className="flex items-center gap-2">
								<input
									type="text"
									value={key}
									onChange={(e) => {
										const newVariables = { ...anhTsProfileVariables }
										delete newVariables[key]
										newVariables[e.target.value] = value
										setCachedStateField("anhTsProfileVariables", newVariables)
										setCachedStateField("tsProfilesHasChanges", true)
										// 不再立即发送给后端，而是等待用户点击保存
									}}
									placeholder={t("settings:tsProfile.variableNamePlaceholder")}
									className="flex-1 px-2 py-1 text-xs bg-vscode-input-background border border-vscode-input-border rounded focus:outline-none focus:ring-1 focus:ring-vscode-focusBorder"
								/>
								<input
									type="text"
									value={value}
									onChange={(e) => handleVariableChange(key, e.target.value)}
									placeholder={t("settings:tsProfile.variableValuePlaceholder")}
									className="flex-1 px-2 py-1 text-xs bg-vscode-input-background border border-vscode-input-border rounded focus:outline-none focus:ring-1 focus:ring-vscode-focusBorder"
								/>
								<button
									onClick={() => handleVariableRemove(key)}
									className="p-1 text-xs text-vscode-errorForeground hover:bg-vscode-errorForeground/10 rounded">
									<Square className="w-3 h-3" />
								</button>
							</div>
						))}
						{Object.keys(anhTsProfileVariables).length === 0 && (
							<div className="text-center text-vscode-descriptionForeground text-xs py-4">
								{t("settings:tsProfile.noVariables")}
							</div>
						)}
					</div>

					<div className="text-xs text-vscode-descriptionForeground bg-vscode-textBlockQuote-background p-2 rounded">
						{t("settings:tsProfile.variablesHelp")}
					</div>
				</div>
			</Section>

			{/* 复制确认对话框 */}
			{showCopyDialog && copyTargetProfile && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
					<div className="bg-vscode-editor-background border border-vscode-widget-border rounded p-4 max-w-md w-full">
						<h3 className="text-sm font-medium mb-3">复制 Profile</h3>
						<p className="text-xs text-vscode-descriptionForeground mb-4">
							确定要将 profile "{copyTargetProfile.name}" 复制到{copyTargetScope === "global" ? "全局" : "工作区"}吗？
						</p>
						<div className="flex justify-end gap-2">
							<button
								className="px-3 py-1 text-xs bg-vscode-button-secondary-background hover:bg-vscode-button-secondary-hoverBackground text-vscode-button-secondary-foreground rounded"
								onClick={() => setShowCopyDialog(false)}>
								取消
							</button>
							<button
								className="px-3 py-1 text-xs bg-vscode-button-background hover:bg-vscode-button-hoverBackground text-vscode-button-foreground rounded"
								onClick={confirmCopyProfile}>
								确认复制
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
