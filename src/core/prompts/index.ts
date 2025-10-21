// 导出所有模块
export * from "./generators"
export * from "./builders"
export * from "./utils"

// 导出主要的类和函数
export { PromptBuilder, EnvironmentBuilder } from "./builders"
export { RoleGenerator, STProfileGenerator, WorldBookGenerator, VariableInjector } from "./generators"
export { TemplateProcessor, RoleOverrideProcessor } from "./utils"

// 导出类型定义 - 从正确的模块导出
export type {
	SystemPromptOptions,
	FilePromptOptions,
} from "./builders/prompt-builder"

export type {
	EnvironmentDetailsOptions,
	EnhancedRoleEnvironmentOptions,
} from "./builders/environment-builder"

export type {
	RoleSectionOptions,
	EnhancedRoleOptions,
	EnhancedRoleInfo,
} from "./generators/role-generator"

export type {
	STProfileOptions,
	ValidationResult,
	TSProfile,
} from "./generators/stprofile-generator"

export type {
	WorldBookOptions,
	WorldBookContent,
} from "./generators/worldbook-generator"

export type {
	VariableState,
	VariableInjectionOptions,
	VariableInjectionResult,
} from "./generators/variable-injector"

export type {
	TemplateProcessingOptions,
	ProcessingResult,
} from "./utils/template-processor"

export type {
	RoleOverrideOptions,
	ModeSelection,
} from "./utils/role-overrides"