import React from "react"
import type { ProviderSettings, OrganizationAllowList } from "@roo-code/types"

import { GenericProviderTemplate, createSimpleProviderConfig, createOpenAICompatibleConfig } from "./GenericProviderTemplate"
import { getProviderConfig, OPENAI_COMPATIBLE_PROVIDER_CONFIGS } from "./ProviderConfigPresets"

/**
 * 使用示例：如何使用通用组件模板
 */

// 示例 1: 使用预设配置
export const SiliconFlowExample = ({
	apiConfiguration,
	setApiConfigurationField,
	organizationAllowList,
	modelValidationError,
	models,
}: {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	organizationAllowList: OrganizationAllowList
	modelValidationError?: string
	models?: Record<string, any> | null
}) => {
	const config = getProviderConfig("siliconflow")
	
	if (!config) {
		return <div>Provider configuration not found</div>
	}

	return (
		<GenericProviderTemplate
			config={config}
			apiConfiguration={apiConfiguration}
			setApiConfigurationField={setApiConfigurationField}
			organizationAllowList={organizationAllowList}
			modelValidationError={modelValidationError}
			models={models}
		/>
	)
}

// 示例 2: 使用辅助函数创建简单配置
export const SimpleProviderExample = ({
	apiConfiguration,
	setApiConfigurationField,
}: {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
}) => {
	const config = createSimpleProviderConfig(
		"CustomProvider",
		"Custom Provider",
		"apiKey", // 使用通用的 apiKey 字段
		"https://custom-provider.com/api-keys",
		"https://custom-provider.com/docs"
	)

	return (
		<GenericProviderTemplate
			config={config}
			apiConfiguration={apiConfiguration}
			setApiConfigurationField={setApiConfigurationField}
		/>
	)
}

// 示例 3: 使用辅助函数创建 OpenAI 兼容配置
export const OpenAICompatibleExample = ({
	apiConfiguration,
	setApiConfigurationField,
	organizationAllowList,
	modelValidationError,
	models,
}: {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	organizationAllowList: OrganizationAllowList
	modelValidationError?: string
	models?: Record<string, any> | null
}) => {
	const config = createOpenAICompatibleConfig(
		"CustomOpenAI",
		"Custom OpenAI Provider",
		"openAiApiKey",
		"openAiBaseUrl",
		"openAiModelId",
		"https://api.custom-openai.com/v1",
		"gpt-4",
		"https://custom-openai.com/api-keys",
		"https://custom-openai.com/docs"
	)

	return (
		<GenericProviderTemplate
			config={config}
			apiConfiguration={apiConfiguration}
			setApiConfigurationField={setApiConfigurationField}
			organizationAllowList={organizationAllowList}
			modelValidationError={modelValidationError}
			models={models}
		/>
	)
}

// 示例 4: 完全自定义配置
export const FullyCustomProviderExample = ({
	apiConfiguration,
	setApiConfigurationField,
	organizationAllowList,
	modelValidationError,
	models,
}: {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	organizationAllowList: OrganizationAllowList
	modelValidationError?: string
	models?: Record<string, any> | null
}) => {
	const config = {
		providerName: "AdvancedProvider",
		providerLabel: "Advanced Custom Provider",
		apiKeyField: "apiKey" as keyof ProviderSettings,
		baseUrlField: "openAiBaseUrl" as keyof ProviderSettings,
		modelIdField: "openAiModelId" as keyof ProviderSettings,
		defaultBaseUrl: "https://api.advanced-provider.com/v1",
		defaultModelId: "advanced-model-v1",
		apiKeyUrl: "https://advanced-provider.com/keys",
		documentationUrl: "https://advanced-provider.com/docs",
		features: {
			customBaseUrl: true,
			customHeaders: true,
			streaming: true,
			maxTokens: true,
			temperature: true,
			modelPicker: true,
		},
		customFields: [
			{
				key: "modelTemperature" as keyof ProviderSettings,
				type: "number" as const,
				label: "Temperature",
				placeholder: "0.7",
				description: "Controls randomness in responses (0.0 to 2.0)",
			},
			{
				key: "rateLimitSeconds" as keyof ProviderSettings,
				type: "number" as const,
				label: "Rate Limit (seconds)",
				placeholder: "60",
				description: "Minimum seconds between requests",
			},
			{
				key: "diffEnabled" as keyof ProviderSettings,
				type: "checkbox" as const,
				label: "Enable Diff Mode",
				description: "Show changes in diff format",
				defaultValue: false,
			},
			{
				key: "todoListEnabled" as keyof ProviderSettings,
				type: "checkbox" as const,
				label: "Enable Todo Lists",
				description: "Automatically create todo lists for complex tasks",
				defaultValue: true,
			},
		],
	}

	return (
		<GenericProviderTemplate
			config={config}
			apiConfiguration={apiConfiguration}
			setApiConfigurationField={setApiConfigurationField}
			organizationAllowList={organizationAllowList}
			modelValidationError={modelValidationError}
			models={models}
		/>
	)
}

// 示例 5: 替换现有的 OpenAICompatible 组件
export const ImprovedOpenAICompatible = ({
	apiConfiguration,
	setApiConfigurationField,
	organizationAllowList,
	modelValidationError,
	models,
}: {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	organizationAllowList: OrganizationAllowList
	modelValidationError?: string
	models?: Record<string, any> | null
}) => {
	// 根据当前选择的 provider 获取默认配置
	const currentProvider = apiConfiguration?.apiProvider || "openai"
	let config = getProviderConfig(currentProvider)
	
	// 如果没有预设配置，使用通用的 OpenAI 兼容配置
	if (!config) {
		config = {
			providerName: "OpenAI",
			providerLabel: "OpenAI Compatible",
			apiKeyField: "openAiApiKey",
			baseUrlField: "openAiBaseUrl",
			modelIdField: "openAiModelId",
			defaultBaseUrl: "https://api.openai.com/v1",
			defaultModelId: "gpt-4o",
			features: {
				customBaseUrl: false,
				customHeaders: true,
				streaming: true,
				maxTokens: true,
				modelPicker: true,
				legacyFormat: true,
				azure: true,
			},
		}
	}

	return (
		<GenericProviderTemplate
			config={config}
			apiConfiguration={apiConfiguration}
			setApiConfigurationField={setApiConfigurationField}
			organizationAllowList={organizationAllowList}
			modelValidationError={modelValidationError}
			models={models}
		/>
	)
}

/**
 * 使用说明：
 * 
 * 1. 简单 Provider（只需要 API Key）：
 *    使用 createSimpleProviderConfig() 或预设的 SIMPLE_PROVIDER_CONFIGS
 * 
 * 2. OpenAI 兼容 Provider：
 *    使用 createOpenAICompatibleConfig() 或预设的 OPENAI_COMPATIBLE_PROVIDER_CONFIGS
 * 
 * 3. 本地 Provider：
 *    使用预设的 LOCAL_PROVIDER_CONFIGS
 * 
 * 4. 完全自定义：
 *    直接创建 GenericProviderConfig 对象
 * 
 * 5. 替换现有组件：
 *    使用 getProviderConfig() 获取预设配置，或创建兼容的配置
 */

export default {
	SiliconFlowExample,
	SimpleProviderExample,
	OpenAICompatibleExample,
	FullyCustomProviderExample,
	ImprovedOpenAICompatible,
}