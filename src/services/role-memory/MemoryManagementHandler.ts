import type { MemoryManagementMessage, MemoryManagementResponse } from "@roo-code/types"
import { MemoryManagementService } from "./MemoryManagementService"
import { EnhancedRoleMemoryService } from "./EnhancedRoleMemoryService"
import { RoleMemoryTriggerService } from "./RoleMemoryTriggerService"

export class MemoryManagementHandler {
  private memoryService: MemoryManagementService | null = null
  private initializationPromise: Promise<void> | null = null

  constructor() {
    // Service will be initialized lazily when needed
  }

  /**
   * 初始化记忆服务
   */
  async initialize(basePath?: string, existingService?: EnhancedRoleMemoryService | RoleMemoryTriggerService): Promise<void> {
    if (existingService) {
      // 如果传入的是 RoleMemoryTriggerService，获取其底层的 EnhancedRoleMemoryService
      let enhancedService: EnhancedRoleMemoryService
      if (existingService instanceof RoleMemoryTriggerService) {
        enhancedService = existingService.getEnhancedRoleMemoryService()
      } else {
        enhancedService = existingService
      }
      this.memoryService = MemoryManagementService.createWithService(enhancedService)
    } else if (basePath) {
      this.memoryService = await MemoryManagementService.create(basePath)
    } else {
      // 使用默认路径
      const defaultPath = process.cwd()
      this.memoryService = await MemoryManagementService.create(defaultPath)
    }
  }

  /**
   * 确保服务已初始化 - 使用 Promise 避免竞态条件
   */
  private async ensureServiceInitialized(): Promise<MemoryManagementService> {
    if (this.memoryService) {
      return this.memoryService
    }

    if (!this.initializationPromise) {
      this.initializationPromise = this.initialize()
    }

    await this.initializationPromise

    // 初始化完成后，memoryService 一定存在
    return this.memoryService!
  }

  /**
   * 处理来自前端的记忆管理消息
   */
  async handleMessage(message: MemoryManagementMessage): Promise<MemoryManagementResponse> {
    try {
      const service = await this.ensureServiceInitialized()
      return await service.handleMessage(message)
    } catch (error) {
      console.error("Memory management error:", error)
      return {
        type: "memoryError",
        error: error instanceof Error ? error.message : "Unknown error occurred",
        operation: message.type,
      }
    }
  }

  /**
   * 检查记忆系统是否启用
   */
  async isMemorySystemEnabled(): Promise<boolean> {
    // 这里可以检查全局设置来确定记忆系统是否启用
    // 暂时返回true，后续可以从设置中读取
    return true
  }

  /**
   * 检查记忆工具是否启用
   */
  async isMemoryToolsEnabled(): Promise<boolean> {
    // 这里可以检查全局设置来确定记忆工具是否启用
    // 暂时返回true，后续可以从设置中读取
    return true
  }
}