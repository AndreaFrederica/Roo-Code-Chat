export { RoleRegistry } from "./RoleRegistry"
export { StorylineRepository } from "./StorylineRepository"
export { RoleMemoryService } from "./RoleMemoryService"
export { ConversationLogService } from "./ConversationLogService"
export { WorldBookService } from "../silly-tavern/sillyTavernWorldBookService"
export { SillyTavernWorldBookTriggerService } from "../silly-tavern/sillyTavernWorldBookTriggerService"
export { getAnhChatRoot, ensureAnhChatRoot } from "./pathUtils"
export { AnhExtensionManager } from "./ExtensionManager"

import type { RoleRegistry } from "./RoleRegistry"
import type { StorylineRepository } from "./StorylineRepository"
import type { RoleMemoryService } from "./RoleMemoryService"
import type { ConversationLogService } from "./ConversationLogService"
import type { WorldBookService } from "../silly-tavern/sillyTavernWorldBookService"
import type { SillyTavernWorldBookTriggerService } from "../silly-tavern/sillyTavernWorldBookTriggerService"
import type { AnhExtensionManager } from "./ExtensionManager"

export interface AnhChatServices {
	basePath: string
	roleRegistry: RoleRegistry
	storylineRepository: StorylineRepository
	roleMemoryService: RoleMemoryService
	conversationLogService: ConversationLogService
	worldBookService: WorldBookService
	worldBookTriggerService: SillyTavernWorldBookTriggerService
	extensionManager: AnhExtensionManager
}
