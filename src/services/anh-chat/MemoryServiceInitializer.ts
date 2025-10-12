import { EnhancedRoleMemoryService } from "../role-memory/EnhancedRoleMemoryService.js"
import { RoleMemoryTriggerService } from "../role-memory/RoleMemoryTriggerService.js"
import { DEFAULT_MEMORY_TRIGGER_CONFIG } from "@roo-code/types"
import type { AnhChatServices } from "./index.js"

/**
 * 记忆服务初始化器
 * 负责初始化和配置记忆触发相关服务
 */
export class MemoryServiceInitializer {
  /**
   * 初始化记忆触发服务
   */
  static async initialize(services: AnhChatServices): Promise<void> {
    try {
      // 初始化增强的记忆服务
      if (!services.enhancedRoleMemoryService) {
        services.enhancedRoleMemoryService = await EnhancedRoleMemoryService.create(services.basePath)
      }

      // 初始化记忆触发服务
      if (!services.roleMemoryTriggerService && services.enhancedRoleMemoryService) {
        const config = {
          ...DEFAULT_MEMORY_TRIGGER_CONFIG,
          debugMode: false // 可以从配置中读取
        }

        services.roleMemoryTriggerService = new RoleMemoryTriggerService(
          services.enhancedRoleMemoryService,
          config
        )
      }

      console.log("[MemoryServiceInitializer] Memory trigger services initialized successfully")
    } catch (error) {
      console.error("[MemoryServiceInitializer] Failed to initialize memory services:", error)
      throw error
    }
  }

  /**
   * 清理记忆服务
   */
  static async cleanup(services: AnhChatServices): Promise<void> {
    try {
      if (services.roleMemoryTriggerService) {
        // 重置服务状态
        await services.roleMemoryTriggerService.reset()
      }

      console.log("[MemoryServiceInitializer] Memory services cleaned up successfully")
    } catch (error) {
      console.error("[MemoryServiceInitializer] Failed to cleanup memory services:", error)
    }
  }

  /**
   * 检查记忆服务是否已初始化
   */
  static isInitialized(services: AnhChatServices): boolean {
    return !!(services.enhancedRoleMemoryService && services.roleMemoryTriggerService)
  }

  /**
   * 获取记忆服务状态
   */
  static getStatus(services: AnhChatServices): {
    enhancedMemoryService: boolean;
    triggerService: boolean;
    config?: any;
  } {
    return {
      enhancedMemoryService: !!services.enhancedRoleMemoryService,
      triggerService: !!services.roleMemoryTriggerService,
      config: services.roleMemoryTriggerService?.getConfig()
    }
  }
}