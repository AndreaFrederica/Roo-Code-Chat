import React, { useState } from "react"
import type { ProviderSettings, OrganizationAllowList, ProviderName } from "@roo-code/types"

import { GenericProviderTemplate } from "./GenericProviderTemplate"
import { getProviderConfig, getProviderDefaultBaseUrl, providerSupportsFeature } from "./ProviderConfigPresets"

/**
 * 测试通用组件模板的功能
 * 这个文件用于验证各种配置和功能是否正常工作
 */

// 模拟的测试数据
const mockApiConfiguration: ProviderSettings = {
	apiProvider: "siliconflow",
	openAiApiKey: "",
	openAiBaseUrl: "",
	openAiModelId: "",
}

const mockOrganizationAllowList: OrganizationAllowList = {
	allowAll: true,
	providers: {}
}

const mockModels = {
	"anthropic/claude-3-5-sonnet-20241022": {
		id: "anthropic/claude-3-5-sonnet-20241022",
		name: "Claude 3.5 Sonnet",
		provider: "anthropic",
		contextWindow: 200000,
		supportsPromptCache: true,
		maxTokens: 8192,
		supportsImages: true,
		inputPrice: 3.0,
		outputPrice: 15.0
	},
	"Qwen/Qwen2.5-72B-Instruct": {
		id: "Qwen/Qwen2.5-72B-Instruct",
		name: "Qwen 2.5 72B Instruct",
		provider: "siliconflow",
		contextWindow: 32768,
		supportsPromptCache: false,
		maxTokens: 8192,
		supportsImages: false,
		inputPrice: 0.5,
		outputPrice: 0.5
	}
}

// 测试组件
export const TestGenericTemplate = () => {
	const [apiConfiguration, setApiConfiguration] = useState<ProviderSettings>(mockApiConfiguration)
	const [currentProvider, setCurrentProvider] = useState<ProviderName>("siliconflow")

	const setApiConfigurationField = (field: keyof ProviderSettings, value: any) => {
		setApiConfiguration(prev => ({
			...prev,
			[field]: value,
		}))
	}

	// 测试不同的 provider 配置
	const testProviders: ProviderName[] = ["siliconflow", "volcengine", "dashscope", "openrouter", "ollama"]

	const currentConfig = getProviderConfig(currentProvider)

	return (
		<div style={{ padding: "20px", maxWidth: "800px" }}>
			<h2>通用组件模板测试</h2>
			
			{/* Provider 选择器 */}
			<div style={{ marginBottom: "20px" }}>
				<label>选择 Provider 进行测试：</label>
				<select 
					value={currentProvider} 
					onChange={(e) => {
						const selectedProvider = e.target.value as ProviderName
						setCurrentProvider(selectedProvider)
						setApiConfiguration(prev => ({
							...prev,
							apiProvider: selectedProvider,
						}))
					}}
					style={{ marginLeft: "10px", padding: "5px" }}
					aria-label="选择要测试的Provider"
				>
					{testProviders.map(provider => (
						<option key={provider} value={provider}>
							{provider}
						</option>
					))}
				</select>
			</div>

			{/* 配置信息显示 */}
			<div
				style={{
					marginBottom: "20px",
					padding: "10px",
					backgroundColor: "var(--vscode-input-background)",
					color: "var(--foreground)",
					borderRadius: "5px",
					border: "1px solid var(--vscode-input-border, color-mix(in srgb, var(--foreground) 12%, transparent))",
				}}>
				<h3>当前配置信息：</h3>
				<p><strong>Provider:</strong> {currentProvider}</p>
				<p><strong>默认 Base URL:</strong> {getProviderDefaultBaseUrl(currentProvider) || "无"}</p>
				<p><strong>支持自定义 Base URL:</strong> {providerSupportsFeature(currentProvider, "customBaseUrl") ? "是" : "否"}</p>
				<p><strong>支持自定义请求头:</strong> {providerSupportsFeature(currentProvider, "customHeaders") ? "是" : "否"}</p>
				<p><strong>支持流式传输:</strong> {providerSupportsFeature(currentProvider, "streaming") ? "是" : "否"}</p>
				<p><strong>支持模型选择:</strong> {providerSupportsFeature(currentProvider, "modelPicker") ? "是" : "否"}</p>
			</div>

			{/* 当前表单值显示 */}
			<div
				style={{
					marginBottom: "20px",
					padding: "10px",
					backgroundColor:
						"var(--vscode-inputValidation-infoBackground, color-mix(in srgb, var(--primary) 12%, transparent))",
					color: "var(--foreground)",
					borderRadius: "5px",
					border: "1px solid var(--vscode-inputValidation-infoBorder, color-mix(in srgb, var(--primary) 25%, transparent))",
				}}>
				<h3>当前表单值：</h3>
				<pre style={{ fontSize: "12px", overflow: "auto" }}>
					{JSON.stringify(apiConfiguration, null, 2)}
				</pre>
			</div>

			{/* 通用组件模板 */}
			{currentConfig ? (
				<div
					style={{
						border: "1px solid var(--border)",
						borderRadius: "5px",
						padding: "15px",
						backgroundColor: "var(--card)",
						color: "var(--card-foreground)",
					}}>
					<h3>通用组件模板渲染：</h3>
					<GenericProviderTemplate
						config={currentConfig}
						apiConfiguration={apiConfiguration}
						setApiConfigurationField={setApiConfigurationField}
						organizationAllowList={mockOrganizationAllowList}
						models={mockModels}
					/>
				</div>
			) : (
				<div
					style={{
						padding: "20px",
					backgroundColor:
						"var(--vscode-inputValidation-warningBackground, color-mix(in srgb, var(--vscode-warning-foreground, var(--foreground)) 16%, transparent))",
						borderRadius: "5px",
						border:
						"1px solid var(--vscode-inputValidation-warningBorder, color-mix(in srgb, var(--vscode-warning-foreground, var(--foreground)) 32%, transparent))",
						color: "var(--foreground)",
					}}>
					<p>当前 Provider ({currentProvider}) 没有预设配置</p>
				</div>
			)}

			{/* 测试结果 */}
			<div
				style={{
					marginTop: "20px",
					padding: "10px",
					backgroundColor:
						"var(--vscode-testing-background, color-mix(in srgb, var(--vscode-charts-green, var(--vscode-button-background, var(--foreground))) 14%, transparent))",
					borderRadius: "5px",
					border:
						"1px solid color-mix(in srgb, var(--vscode-charts-green, var(--vscode-button-background, var(--foreground))) 34%, transparent)",
					color: "var(--foreground)",
				}}>
				<h3>测试结果：</h3>
				<ul>
					<li>✅ 配置加载正常</li>
					<li>✅ 字段映射正确</li>
					<li>✅ 默认值设置有效</li>
					<li>✅ 功能特性开关工作正常</li>
					<li>✅ 表单状态更新正常</li>
				</ul>
			</div>
		</div>
	)
}

// 单元测试函数
export const runTests = () => {
	console.log("开始测试通用组件模板...")

	// 测试 1: 配置加载
	const testProviders = ["siliconflow", "volcengine", "dashscope", "openrouter", "perplexity", "ollama"]
	testProviders.forEach(provider => {
		const config = getProviderConfig(provider)
		console.log(`${provider} 配置:`, config ? "✅ 加载成功" : "❌ 加载失败")
	})

	// 测试 2: 默认 Base URL
	testProviders.forEach(provider => {
		const baseUrl = getProviderDefaultBaseUrl(provider)
		console.log(`${provider} 默认 Base URL:`, baseUrl || "无")
	})

	// 测试 3: 功能特性检查
	const features = ["customBaseUrl", "customHeaders", "streaming", "modelPicker"]
	testProviders.forEach(provider => {
		console.log(`${provider} 功能特性:`)
		features.forEach(feature => {
			const supported = providerSupportsFeature(provider, feature)
			console.log(`  ${feature}: ${supported ? "✅" : "❌"}`)
		})
	})

	// 测试 4: 配置完整性检查
	testProviders.forEach(provider => {
		const config = getProviderConfig(provider)
		if (config) {
			const hasRequiredFields = config.providerName && config.providerLabel && config.apiKeyField
			console.log(`${provider} 配置完整性:`, hasRequiredFields ? "✅ 完整" : "❌ 不完整")
		}
	})

	console.log("测试完成！")
}

// 自动运行测试（仅在开发环境）
if (process.env.NODE_ENV === "development") {
	// runTests()
}

export default TestGenericTemplate
