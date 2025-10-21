// 导出所有生成器类
export { RoleGenerator } from "./role-generator"
export { STProfileGenerator } from "./stprofile-generator"
export { WorldBookGenerator } from "./worldbook-generator"
export { VariableInjector } from "./variable-injector"

// 导出类型定义
export type {
	RoleSectionOptions,
	EnhancedRoleOptions,
	EnhancedRoleInfo,
} from "./role-generator"

export type {
	STProfileOptions,
	ValidationResult,
	TSProfile,
} from "./stprofile-generator"

export type {
	WorldBookOptions,
	WorldBookContent,
} from "./worldbook-generator"

export type {
	VariableState,
	VariableInjectionOptions,
	VariableInjectionResult,
} from "./variable-injector"