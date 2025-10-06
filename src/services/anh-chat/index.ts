export { RoleRegistry } from "./RoleRegistry"
export { StorylineRepository } from "./StorylineRepository"
export { RoleMemoryService } from "./RoleMemoryService"
export { ConversationLogService } from "./ConversationLogService"
export { getAnhChatRoot, ensureAnhChatRoot } from "./pathUtils"

import type { RoleRegistry } from "./RoleRegistry"
import type { StorylineRepository } from "./StorylineRepository"
import type { RoleMemoryService } from "./RoleMemoryService"
import type { ConversationLogService } from "./ConversationLogService"

export interface AnhChatServices {
	basePath: string
	roleRegistry: RoleRegistry
	storylineRepository: StorylineRepository
	roleMemoryService: RoleMemoryService
	conversationLogService: ConversationLogService
}
