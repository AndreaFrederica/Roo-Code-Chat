import { useCallback, useState, useEffect } from "react"
import { Checkbox } from "vscrui"
import { VSCodeTextField, VSCodeButton } from "@vscode/webview-ui-toolkit/react"

import type { ProviderSettings, ModelInfo, OrganizationAllowList } from "@roo-code/types"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"
import { Button as _Button, StandardTooltip } from "@src/components/ui"
import { openAiModelInfoSaneDefaults } from "@roo-code/types"
import { vscode } from "@src/utils/vscode"

import { convertHeadersToObject } from "../utils/headers"
import { inputEventTransform, noTransform } from "../transforms"
import { ModelPicker } from "../ModelPicker"
import { useUniversalMessageListener } from "@src/hooks/useMessageListener"

/**
 * 通用 Provider 组件配置接口
 */
export interface GenericProviderConfig {
	// 基础配置
	providerName: string
	providerLabel: string
	apiKeyField: keyof ProviderSettings
	baseUrlField?: keyof ProviderSettings
	modelIdField?: keyof ProviderSettings
	
	// 默认值
	defaultBaseUrl?: string
	defaultModelId?: string
	
	// 外部链接
	documentationUrl?: string
	apiKeyUrl?: string
	
	// 功能开关
	features?: {
		customBaseUrl?: boolean
		customHeaders?: boolean
		streaming?: boolean
		maxTokens?: boolean
		temperature?: boolean
		modelPicker?: boolean
		legacyFormat?: boolean
		azure?: boolean
	}
	
	// 自定义字段
	customFields?: Array<{
		key: keyof ProviderSettings
		type: 'text' | 'password' | 'url' | 'number' | 'checkbox'
		label: string
		placeholder?: string
		description?: string
		defaultValue?: any
		validation?: (value: any) => boolean
	}>
}

type GenericProviderTemplateProps = {
	config: GenericProviderConfig
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	organizationAllowList?: OrganizationAllowList
	modelValidationError?: string
	models?: Record<string, ModelInfo> | null
	fromWelcomeView?: boolean
}

export const GenericProviderTemplate = ({
	config,
	apiConfiguration,
	setApiConfigurationField,
	organizationAllowList,
	modelValidationError,
	models,
	fromWelcomeView = false,
}: GenericProviderTemplateProps) => {
	const { t } = useAppTranslation()

	// 状态管理
	const [customBaseUrlSelected, setCustomBaseUrlSelected] = useState(
		!!(config.baseUrlField && apiConfiguration?.[config.baseUrlField])
	)
	const [customHeaders, setCustomHeaders] = useState<[string, string][]>(() => {
		const headers = apiConfiguration?.openAiHeaders || {}
		return Object.entries(headers)
	})

	// 模型数据管理
	const [internalModels, setInternalModels] = useState<Record<string, ModelInfo> | null>(null)
	const [isRefreshingModels, setIsRefreshingModels] = useState(false)

	// 手动刷新模型列表
	const handleRefreshModels = useCallback(() => {
		setIsRefreshingModels(true)

		const apiKey = config.apiKeyField ? apiConfiguration?.[config.apiKeyField] : null
		const baseUrl = config.baseUrlField ? apiConfiguration?.[config.baseUrlField] : null
		const openAiHeaders = apiConfiguration?.openAiHeaders || {}

		console.log(`[GenericProviderTemplate] Manual refresh models for ${config.providerName}`, {
			providerName: config.providerName,
			apiKey: apiKey ? `${String(apiKey).substring(0, 10)}...` : null,
			baseUrl,
			apiKeyField: config.apiKeyField,
			baseUrlField: config.baseUrlField,
			hasOpenAiHeaders: Object.keys(openAiHeaders).length > 0,
			messageType: "requestOpenAiModels"
		})

		// 发送正确的消息格式，包含 values 字段
		vscode.postMessage({
			type: "requestOpenAiModels",
			values: {
				baseUrl,
				apiKey,
				openAiHeaders
			}
		})
		console.log('[GenericProviderTemplate] ✅ Sent requestOpenAiModels message with values:', {
			hasBaseUrl: !!baseUrl,
			hasApiKey: !!apiKey,
			hasHeaders: Object.keys(openAiHeaders).length > 0
		})

		// 3秒后重置刷新状态
		setTimeout(() => {
			console.log('[GenericProviderTemplate] ⏰ Timeout reached, resetting refresh state')
			setIsRefreshingModels(false)
		}, 3000)
	}, [config.providerName, apiConfiguration, config.apiKeyField, config.baseUrlField])

	// 监听模型数据更新
	const onMessage = useCallback((message: any) => {
		console.log(`[GenericProviderTemplate] Received message: ${message?.type || 'unknown'}`, {
			messageType: message?.type,
			hasData: !!message?.openAiModels,
			dataLength: message?.openAiModels?.length || 0,
			dataPreview: message?.openAiModels ? message.openAiModels.slice(0, 3) : null,
			fullMessage: message
		})

		switch (message?.type) {
			case "openAiModels": {
				const updatedModels = message?.openAiModels ?? []
				console.log(`[GenericProviderTemplate] 📋 Processing openAiModels:`, {
					modelCount: updatedModels.length,
					models: updatedModels.slice(0, 5) // 显示前5个模型
				})

				const modelObject = Object.fromEntries(updatedModels.map((item: string) => [item, openAiModelInfoSaneDefaults]))
				setInternalModels(modelObject)
				console.log(`[GenericProviderTemplate] ✅ Updated internal models:`, {
					modelKeys: Object.keys(modelObject).slice(0, 5),
					totalModels: Object.keys(modelObject).length
				})

				setIsRefreshingModels(false) // 重置刷新状态
				console.log('[GenericProviderTemplate] ✅ Reset refresh state')
				break
			}
			default:
				console.log(`[GenericProviderTemplate] 📋 Ignoring message type: ${message?.type || 'unknown'}`)
		}
	}, [])

	useUniversalMessageListener(onMessage, { debug: true })

	// 自动获取模型列表
	const apiKey = config.apiKeyField ? apiConfiguration?.[config.apiKeyField] : null
	const baseUrl = config.baseUrlField ? apiConfiguration?.[config.baseUrlField] : null

	useEffect(() => {
		console.log(`[GenericProviderTemplate] Auto-check for models: ${config.providerName}`, {
			providerName: config.providerName,
			hasApiKey: !!apiKey,
			hasBaseUrl: !!baseUrl,
			needsBaseUrl: !!config.baseUrlField
		})

		// 如果有API Key，或者有API Key和Base URL，则请求模型列表
		if ((apiKey && !config.baseUrlField) || (apiKey && baseUrl)) {
			console.log(`[GenericProviderTemplate] Auto-requesting models for ${config.providerName}`)
			const openAiHeaders = apiConfiguration?.openAiHeaders || {}
			vscode.postMessage({
				type: "requestOpenAiModels",
				values: {
					baseUrl,
					apiKey,
					openAiHeaders
				}
			})
		}
	}, [
		apiConfiguration,
		apiKey,
		baseUrl,
		config.apiKeyField,
		config.baseUrlField,
		config.providerName
	])

	// 使用传入的models或内部获取的models
	const effectiveModels = models || internalModels

	// 通用输入处理函数
	const handleInputChange = useCallback(
		<K extends keyof ProviderSettings, E>(
			field: K,
			transform: (event: E) => ProviderSettings[K] = inputEventTransform,
		) =>
			(event: E | Event) => {
				const newValue = transform(event as E)
				setApiConfigurationField(field, newValue)

				// 如果是API Key或Base URL变化，触发模型获取
				if (field === config.apiKeyField || field === config.baseUrlField) {
					// 使用setTimeout确保状态更新完成后再请求
					setTimeout(() => {
						const apiKey = config.apiKeyField ? apiConfiguration?.[config.apiKeyField] : null
						const baseUrl = config.baseUrlField ? apiConfiguration?.[config.baseUrlField] : null

						// 如果变化后仍然有必要的配置，则请求模型列表
						const updatedApiKey = field === config.apiKeyField ? newValue : apiKey
						const updatedBaseUrl = field === config.baseUrlField ? newValue : baseUrl

						if ((updatedApiKey && !config.baseUrlField) || (updatedApiKey && updatedBaseUrl)) {
							console.log(`[GenericProviderTemplate] Requesting models after input change for ${config.providerName}`)
							const currentHeaders = apiConfiguration?.openAiHeaders || {}
							vscode.postMessage({
								type: "requestOpenAiModels",
								values: {
									baseUrl: updatedBaseUrl,
									apiKey: updatedApiKey,
									openAiHeaders: currentHeaders
								}
							})
						}
					}, 100)
				}
			},
		[setApiConfigurationField, config.apiKeyField, config.baseUrlField, config.providerName],
	)

	// 自定义请求头处理
	const handleAddCustomHeader = useCallback(() => {
		setCustomHeaders((prev) => [...prev, ["", ""]])
	}, [])

	const handleUpdateHeaderKey = useCallback((index: number, newKey: string) => {
		setCustomHeaders((prev) => {
			const updated = [...prev]
			if (updated[index]) {
				updated[index] = [newKey, updated[index][1]]
			}
			return updated
		})
	}, [])

	const handleUpdateHeaderValue = useCallback((index: number, newValue: string) => {
		setCustomHeaders((prev) => {
			const updated = [...prev]
			if (updated[index]) {
				updated[index] = [updated[index][0], newValue]
			}
			return updated
		})
	}, [])

	const handleRemoveCustomHeader = useCallback((index: number) => {
		setCustomHeaders((prev) => prev.filter((_, i) => i !== index))
	}, [])

	// 更新自定义请求头到配置
	useEffect(() => {
		if (config.features?.customHeaders) {
			const timer = setTimeout(() => {
				const headerObject = convertHeadersToObject(customHeaders)
				setApiConfigurationField("openAiHeaders", headerObject)
			}, 300)
			return () => clearTimeout(timer)
		}
	}, [customHeaders, setApiConfigurationField, config.features?.customHeaders])

	// 设置默认 baseUrl
	useEffect(() => {
		if (config.defaultBaseUrl && config.baseUrlField && !apiConfiguration?.[config.baseUrlField]) {
			setApiConfigurationField(config.baseUrlField, config.defaultBaseUrl)
		}
	}, [config.defaultBaseUrl, config.baseUrlField, apiConfiguration, setApiConfigurationField])

	return (
		<>
			{/* API Key 字段 - 必需 */}
			<VSCodeTextField
				value={(apiConfiguration?.[config.apiKeyField] as string) || ""}
				type="password"
				onInput={handleInputChange(config.apiKeyField)}
				placeholder={t("settings:placeholders.apiKey")}
				className="w-full">
				<label className="block font-medium mb-1">
					{t(`settings:providers.${config.apiKeyField}`) || `${config.providerLabel} API Key`}
				</label>
			</VSCodeTextField>
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.apiKeyStorageNotice")}
			</div>

			{/* 获取 API Key 链接 */}
			{!apiConfiguration?.[config.apiKeyField] && config.apiKeyUrl && (
				<VSCodeButtonLink href={config.apiKeyUrl} appearance="secondary">
					{t(`settings:providers.get${config.providerName}ApiKey`) || `Get ${config.providerLabel} API Key`}
				</VSCodeButtonLink>
			)}

			{/* 自定义 Base URL */}
			{config.features?.customBaseUrl && config.baseUrlField && (
				<div>
					<Checkbox
						checked={customBaseUrlSelected}
						onChange={(checked: boolean) => {
							setCustomBaseUrlSelected(checked)
							if (!checked) {
								setApiConfigurationField(config.baseUrlField!, config.defaultBaseUrl || "")
							}
						}}>
						{t("settings:providers.useCustomBaseUrl")}
					</Checkbox>
					{customBaseUrlSelected && (
						<VSCodeTextField
							value={(apiConfiguration?.[config.baseUrlField] as string) || ""}
							type="url"
							onInput={handleInputChange(config.baseUrlField)}
							placeholder={config.defaultBaseUrl || t("settings:placeholders.baseUrl")}
							className="w-full mt-1"
						/>
					)}
				</div>
			)}

			{/* 直接的 Base URL 字段（不需要复选框） */}
			{!config.features?.customBaseUrl && config.baseUrlField && (
				<VSCodeTextField
					value={(apiConfiguration?.[config.baseUrlField] as string) || ""}
					type="url"
					onInput={handleInputChange(config.baseUrlField)}
					placeholder={config.defaultBaseUrl || t("settings:placeholders.baseUrl")}
					className="w-full">
					<label className="block font-medium mb-1">
						{t("settings:providers.openAiBaseUrl") || "Base URL"}
					</label>
				</VSCodeTextField>
			)}

			{/* 模型选择器 */}
			{config.features?.modelPicker && config.modelIdField && (
				<div>
					<div className="flex justify-between items-center mb-1">
						<label className="block font-medium">{t("settings:modelPicker.label")}</label>
						<VSCodeButton
							appearance="icon"
							onClick={handleRefreshModels}
							disabled={isRefreshingModels}
							title={t("settings:modelPicker.refreshModels") || "刷新模型列表"}
							className="text-vscode-foreground hover:bg-vscode-button-background">
							{isRefreshingModels ? (
								<span className="codicon codicon-loading animate-spin"></span>
							) : (
								<span className="codicon codicon-refresh"></span>
							)}
						</VSCodeButton>
					</div>
					<ModelPicker
						apiConfiguration={apiConfiguration}
						setApiConfigurationField={setApiConfigurationField}
						defaultModelId={config.defaultModelId || ""}
						models={effectiveModels}
						modelIdKey={config.modelIdField as any}
						serviceName={config.providerLabel}
						serviceUrl={config.documentationUrl || ""}
						organizationAllowList={organizationAllowList || { allowAll: true, providers: {} }}
						errorMessage={modelValidationError}
					/>
				</div>
			)}

			{/* 流式传输 */}
			{config.features?.streaming && (
				<Checkbox
					checked={apiConfiguration?.openAiStreamingEnabled ?? true}
					onChange={handleInputChange("openAiStreamingEnabled", noTransform)}>
					{t("settings:modelInfo.enableStreaming")}
				</Checkbox>
			)}

			{/* 最大 Token 数 */}
			{config.features?.maxTokens && (
				<div>
					<Checkbox
						checked={apiConfiguration?.includeMaxTokens ?? true}
						onChange={handleInputChange("includeMaxTokens", noTransform)}>
						{t("settings:includeMaxOutputTokens")}
					</Checkbox>
					<div className="text-sm text-vscode-descriptionForeground ml-6">
						{t("settings:includeMaxOutputTokensDescription")}
					</div>
				</div>
			)}

			{/* 温度设置 */}
			{config.features?.temperature && (
				<VSCodeTextField
					value={apiConfiguration?.modelTemperature?.toString() || ""}
					type="text"
					onInput={handleInputChange("modelTemperature", (e) => {
						const value = parseFloat((e.target as HTMLInputElement).value)
						return isNaN(value) ? null : value
					})}
					placeholder="0.7"
					className="w-full">
					<label className="block font-medium mb-1">
						{t("settings:providers.temperature") || "Temperature"}
					</label>
				</VSCodeTextField>
			)}

			{/* 自定义字段 */}
			{config.customFields?.map((field) => (
				<div key={field.key}>
					{field.type === 'checkbox' ? (
						<>
							<Checkbox
								checked={!!(apiConfiguration?.[field.key] ?? field.defaultValue)}
								onChange={handleInputChange(field.key, noTransform)}>
								{field.label}
							</Checkbox>
							{field.description && (
								<div className="text-sm text-vscode-descriptionForeground ml-6">
									{field.description}
								</div>
							)}
						</>
					) : (
						<VSCodeTextField
							value={(apiConfiguration?.[field.key] as string) || ""}
							type={field.type === 'number' ? 'text' : field.type}
							onInput={handleInputChange(field.key)}
							placeholder={field.placeholder || ""}
							className="w-full">
							<label className="block font-medium mb-1">{field.label}</label>
						</VSCodeTextField>
					)}
					{field.description && field.type !== 'checkbox' && (
						<div className="text-sm text-vscode-descriptionForeground -mt-2">
							{field.description}
						</div>
					)}
				</div>
			))}

			{/* 自定义请求头 */}
			{config.features?.customHeaders && !fromWelcomeView && (
				<div className="mb-4">
					<div className="flex justify-between items-center mb-2">
						<label className="block font-medium">{t("settings:providers.customHeaders")}</label>
						<StandardTooltip content={t("settings:common.add")}>
							<VSCodeButton appearance="icon" onClick={handleAddCustomHeader}>
								<span className="codicon codicon-add"></span>
							</VSCodeButton>
						</StandardTooltip>
					</div>
					{!customHeaders.length ? (
						<div className="text-sm text-vscode-descriptionForeground">
							{t("settings:providers.noCustomHeaders")}
						</div>
					) : (
						customHeaders.map(([key, value], index) => (
							<div key={index} className="flex items-center mb-2">
								<VSCodeTextField
									value={key}
									className="flex-1 mr-2"
									placeholder={t("settings:providers.headerName")}
									onInput={(e: any) => handleUpdateHeaderKey(index, e.target.value)}
								/>
								<VSCodeTextField
									value={value}
									className="flex-1 mr-2"
									placeholder={t("settings:providers.headerValue")}
									onInput={(e: any) => handleUpdateHeaderValue(index, e.target.value)}
								/>
								<StandardTooltip content={t("settings:common.remove")}>
									<VSCodeButton appearance="icon" onClick={() => handleRemoveCustomHeader(index)}>
										<span className="codicon codicon-trash"></span>
									</VSCodeButton>
								</StandardTooltip>
							</div>
						))
					)}
				</div>
			)}

			{/* 文档链接 */}
			{config.documentationUrl && (
				<VSCodeButtonLink href={config.documentationUrl} appearance="secondary">
					{t(`settings:providers.providerDocumentation`, { provider: config.providerLabel })}
				</VSCodeButtonLink>
			)}
		</>
	)
}

/**
 * 预定义的常用配置
 */
export const createSimpleProviderConfig = (
	providerName: string,
	providerLabel: string,
	apiKeyField: keyof ProviderSettings,
	apiKeyUrl?: string,
	documentationUrl?: string
): GenericProviderConfig => ({
	providerName,
	providerLabel,
	apiKeyField,
	apiKeyUrl,
	documentationUrl,
})

export const createOpenAICompatibleConfig = (
	providerName: string,
	providerLabel: string,
	apiKeyField: keyof ProviderSettings,
	baseUrlField: keyof ProviderSettings,
	modelIdField: keyof ProviderSettings,
	defaultBaseUrl?: string,
	defaultModelId?: string,
	apiKeyUrl?: string,
	documentationUrl?: string
): GenericProviderConfig => ({
	providerName,
	providerLabel,
	apiKeyField,
	baseUrlField,
	modelIdField,
	defaultBaseUrl,
	defaultModelId,
	apiKeyUrl,
	documentationUrl,
	features: {
		customBaseUrl: false, // 直接显示 baseUrl 字段
		customHeaders: true,
		streaming: true,
		maxTokens: true,
		modelPicker: true,
	},
})

export default GenericProviderTemplate