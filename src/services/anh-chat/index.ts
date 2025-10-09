export { RoleRegistry } from "./RoleRegistry"
export { StorylineRepository } from "./StorylineRepository"
export { RoleMemoryService } from "./RoleMemoryService"
export { ConversationLogService } from "./ConversationLogService"
export { getAnhChatRoot, ensureAnhChatRoot } from "./pathUtils"
export { AnhExtensionManager } from "./ExtensionManager"

import type { RoleRegistry } from "./RoleRegistry"
import type { StorylineRepository } from "./StorylineRepository"
import type { RoleMemoryService } from "./RoleMemoryService"
import type { ConversationLogService } from "./ConversationLogService"
import type { AnhExtensionManager } from "./ExtensionManager"

export interface AnhChatServices {
	basePath: string
	roleRegistry: RoleRegistry
	storylineRepository: StorylineRepository
	roleMemoryService: RoleMemoryService
	conversationLogService: ConversationLogService
	extensionManager: AnhExtensionManager
}
