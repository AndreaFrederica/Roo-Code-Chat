import { Anthropic } from "@anthropic-ai/sdk"

import type { ProviderSettings, ModelInfo } from "@roo-code/types"

import { ApiStream } from "./transform/stream"

import {
	GlamaHandler,
	AnthropicHandler,
	AwsBedrockHandler,
	CerebrasHandler,
	OpenRouterHandler,
	VertexHandler,
	AnthropicVertexHandler,
	OpenAiHandler,
	LmStudioHandler,
	GeminiHandler,
	OpenAiNativeHandler,
	DeepSeekHandler,
	MoonshotHandler,
	MistralHandler,
	VsCodeLmHandler,
	UnboundHandler,
	RequestyHandler,
	HumanRelayHandler,
	FakeAIHandler,
	XAIHandler,
	GroqHandler,
	HuggingFaceHandler,
	ChutesHandler,
	LiteLLMHandler,
	ClaudeCodeHandler,
	QwenCodeHandler,
	SambaNovaHandler,
	IOIntelligenceHandler,
	DoubaoHandler,
	ZAiHandler,
	FireworksHandler,
	RooHandler,
	FeatherlessHandler,
	VercelAiGatewayHandler,
	DeepInfraHandler,
} from "./providers"
import { NativeOllamaHandler } from "./providers/native-ollama"

export interface SingleCompletionHandler {
	completePrompt(prompt: string): Promise<string>
}

export interface ApiHandlerCreateMessageMetadata {
	mode?: string
	taskId: string
	previousResponseId?: string
	/**
	 * When true, the provider must NOT fall back to internal continuity state
	 * (e.g., lastResponseId) if previousResponseId is absent.
	 * Used to enforce "skip once" after a condense operation.
	 */
	suppressPreviousResponseId?: boolean
	/**
	 * Controls whether the response should be stored for 30 days in OpenAI's Responses API.
	 * When true (default), responses are stored and can be referenced in future requests
	 * using the previous_response_id for efficient conversation continuity.
	 * Set to false to opt out of response storage for privacy or compliance reasons.
	 * @default true
	 */
	store?: boolean
}

export interface ApiHandler {
	createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream

	getModel(): { id: string; info: ModelInfo }

	/**
	 * Counts tokens for content blocks
	 * All providers extend BaseProvider which provides a default tiktoken implementation,
	 * but they can override this to use their native token counting endpoints
	 *
	 * @param content The content to count tokens for
	 * @returns A promise resolving to the token count
	 */
	countTokens(content: Array<Anthropic.Messages.ContentBlockParam>): Promise<number>
}

export function buildApiHandler(
	configuration: ProviderSettings, 
	customUserAgent?: string,
	customUserAgentMode?: "segments" | "full",
	customUserAgentFull?: string
): ApiHandler {
	const { apiProvider, ...options } = configuration
	
	// Pass all custom user agent parameters to options if provided
	const enhancedOptions = {
		...options,
		...(customUserAgent && { customUserAgent }),
		...(customUserAgentMode && { customUserAgentMode }),
		...(customUserAgentFull && { customUserAgentFull })
	}

	switch (apiProvider) {
		case "anthropic":
			return new AnthropicHandler(enhancedOptions)
		case "claude-code":
			return new ClaudeCodeHandler(enhancedOptions)
		case "glama":
			return new GlamaHandler(enhancedOptions)
		case "openrouter":
			return new OpenRouterHandler(enhancedOptions)
		case "bedrock":
			return new AwsBedrockHandler(enhancedOptions)
		case "vertex":
			return enhancedOptions.apiModelId?.startsWith("claude")
				? new AnthropicVertexHandler(enhancedOptions)
				: new VertexHandler(enhancedOptions)
		case "openai":
			return new OpenAiHandler(enhancedOptions)
		case "ollama":
			return new NativeOllamaHandler(enhancedOptions)
		case "lmstudio":
			return new LmStudioHandler(enhancedOptions)
		case "gemini":
			return new GeminiHandler(enhancedOptions)
		case "openai-native":
			return new OpenAiNativeHandler(enhancedOptions)
		case "deepseek":
			return new DeepSeekHandler(enhancedOptions)
		case "doubao":
			return new DoubaoHandler(enhancedOptions)
		case "qwen-code":
			return new QwenCodeHandler(enhancedOptions)
		case "moonshot":
			return new MoonshotHandler(enhancedOptions)
		case "vscode-lm":
			return new VsCodeLmHandler(enhancedOptions)
		case "mistral":
			return new MistralHandler(enhancedOptions)
		case "unbound":
			return new UnboundHandler(enhancedOptions)
		case "requesty":
			return new RequestyHandler(enhancedOptions)
		case "human-relay":
			return new HumanRelayHandler()
		case "fake-ai":
			return new FakeAIHandler(enhancedOptions)
		case "xai":
			return new XAIHandler(enhancedOptions)
		case "groq":
			return new GroqHandler(enhancedOptions)
		case "deepinfra":
			return new DeepInfraHandler(enhancedOptions)
		case "huggingface":
			return new HuggingFaceHandler(enhancedOptions)
		case "chutes":
			return new ChutesHandler(enhancedOptions)
		case "litellm":
			return new LiteLLMHandler(enhancedOptions)
		case "cerebras":
			return new CerebrasHandler(enhancedOptions)
		case "sambanova":
			return new SambaNovaHandler(enhancedOptions)
		case "zai":
			return new ZAiHandler(enhancedOptions)
		case "fireworks":
			return new FireworksHandler(enhancedOptions)
		case "io-intelligence":
			return new IOIntelligenceHandler(enhancedOptions)
		case "roo":
			// Never throw exceptions from provider constructors
			// The provider-proxy server will handle authentication and return appropriate error codes
			return new RooHandler(enhancedOptions)
		case "featherless":
			return new FeatherlessHandler(enhancedOptions)
		case "vercel-ai-gateway":
			return new VercelAiGatewayHandler(enhancedOptions)
		case "siliconflow":
			return new OpenAiHandler({
				...enhancedOptions,
				openAiApiKey: enhancedOptions.siliconFlowApiKey ?? "not-provided",
				openAiModelId: enhancedOptions.siliconFlowModelId ?? "Qwen/Qwen2.5-7B-Instruct",
				openAiBaseUrl: enhancedOptions.siliconFlowBaseUrl ?? "https://api.siliconflow.cn/v1",
				openAiStreamingEnabled: true,
			})
		case "volcengine":
			return new OpenAiHandler({
				...enhancedOptions,
				openAiApiKey: enhancedOptions.volcEngineApiKey ?? "not-provided",
				openAiModelId: enhancedOptions.volcEngineModelId ?? "doubao-pro-4k",
				openAiBaseUrl: enhancedOptions.volcEngineBaseUrl ?? "https://ark.cn-beijing.volces.com/api/v3",
				openAiStreamingEnabled: true,
			})
		case "dashscope":
			return new OpenAiHandler({
				...enhancedOptions,
				openAiApiKey: enhancedOptions.dashScopeApiKey ?? "not-provided",
				openAiModelId: enhancedOptions.dashScopeModelId ?? "qwen-turbo",
				openAiBaseUrl: enhancedOptions.dashScopeBaseUrl ?? "https://dashscope.aliyuncs.com/compatible-mode/v1",
				openAiStreamingEnabled: true,
			})
		case "gemini-cli":
			return new GeminiHandler(enhancedOptions)
		default:
			apiProvider satisfies "gemini-cli" | undefined
			return new AnthropicHandler(options)
	}
}
