import type {
  MemoryEntry,
  MemoryFilter,
  MemoryStats,
  MemoryManagementMessage,
  MemoryManagementResponse,
  MemoryOperationResult,
} from "@roo-code/types"
import { EnhancedRoleMemoryService } from "./EnhancedRoleMemoryService"
import { calculateMemoryStats } from "@roo-code/types"

export class MemoryManagementService {
  private memoryService: EnhancedRoleMemoryService

  private constructor(memoryService: EnhancedRoleMemoryService) {
    this.memoryService = memoryService
  }

  static async create(basePath: string): Promise<MemoryManagementService> {
    const memoryService = await EnhancedRoleMemoryService.create(basePath)
    return new MemoryManagementService(memoryService)
  }

  /**
   * 通过现有的 EnhancedRoleMemoryService 实例创建
   */
  static createWithService(memoryService: EnhancedRoleMemoryService): MemoryManagementService {
    return new MemoryManagementService(memoryService)
  }

  /**
   * 处理记忆管理消息
   */
  async handleMessage(message: MemoryManagementMessage): Promise<MemoryManagementResponse> {
    try {
      switch (message.type) {
        case "getMemoryList":
          return await this.getMemoryList(message.roleUuid, message.filter)

        case "getMemoryStats":
          return await this.getMemoryStats(message.roleUuid)

        case "updateMemory":
          return await this.updateMemory(message.roleUuid, message.memoryId, message.memory)

        case "deleteMemory":
          return await this.deleteMemory(message.roleUuid, message.memoryId)

        case "deleteMultipleMemories":
          return await this.deleteMultipleMemories(message.roleUuid, message.memoryIds)

        case "cleanupMemories":
          return await this.cleanupMemories(message.roleUuid, message.olderThan, message.importanceThreshold)

        case "importMemories":
          return await this.importMemories(message.roleUuid, message.memories)

        case "exportMemories":
          return await this.exportMemories(message.roleUuid, message.memoryIds)

        default:
          return {
            type: "memoryError",
            error: `Unknown message type: ${(message as any).type}`,
            operation: (message as any).type,
          }
      }
    } catch (error) {
      return {
        type: "memoryError",
        error: error instanceof Error ? error.message : "Unknown error",
        operation: message.type,
      }
    }
  }

  /**
   * 获取记忆列表
   */
  private async getMemoryList(roleUuid: string, filter?: MemoryFilter): Promise<MemoryManagementResponse> {
    const memories = await this.memoryService.getAllMemories(roleUuid)

    let filteredMemories = memories

    // 应用过滤器
    if (filter) {
      if (filter.search) {
        const searchLower = filter.search.toLowerCase()
        filteredMemories = filteredMemories.filter(memory =>
          memory.content.toLowerCase().includes(searchLower) ||
          memory.keywords.some((keyword: string) => keyword.toLowerCase().includes(searchLower))
        )
      }

      if (filter.memoryType && filter.memoryType !== "all") {
        filteredMemories = filteredMemories.filter(memory => memory.type === filter.memoryType)
      }

      if (filter.triggerType && filter.triggerType !== "all") {
        filteredMemories = filteredMemories.filter(memory => memory.triggerType === filter.triggerType)
      }

      if (filter.priorityRange) {
        const { min, max } = filter.priorityRange
        if (min !== undefined) {
          filteredMemories = filteredMemories.filter(memory => memory.priority >= min)
        }
        if (max !== undefined) {
          filteredMemories = filteredMemories.filter(memory => memory.priority <= max)
        }
      }

      if (filter.dateRange) {
        if (filter.dateRange.start) {
          const startDate = new Date(filter.dateRange.start)
          filteredMemories = filteredMemories.filter(memory => new Date(memory.createdAt) >= startDate)
        }
        if (filter.dateRange.end) {
          const endDate = new Date(filter.dateRange.end)
          filteredMemories = filteredMemories.filter(memory => new Date(memory.createdAt) <= endDate)
        }
      }

      if (filter.isConstant !== undefined) {
        filteredMemories = filteredMemories.filter(memory => memory.isConstant === filter.isConstant)
      }
    }

    // 排序：按优先级和创建时间
    filteredMemories.sort((a, b) => {
      if (a.isConstant && !b.isConstant) return -1
      if (!a.isConstant && b.isConstant) return 1

      if (a.priority !== b.priority) {
        return b.priority - a.priority
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    const stats = calculateMemoryStats(filteredMemories)

    return {
      type: "memoryList",
      memories: filteredMemories,
      stats,
    }
  }

  /**
   * 获取记忆统计
   */
  private async getMemoryStats(roleUuid: string): Promise<MemoryManagementResponse> {
    const memories = await this.memoryService.getAllMemories(roleUuid)
    const stats = calculateMemoryStats(memories)

    return {
      type: "memoryStats",
      stats,
    }
  }

  /**
   * 更新记忆
   */
  private async updateMemory(roleUuid: string, memoryId: string, memory: MemoryEntry): Promise<MemoryManagementResponse> {
    // 验证记忆数据
    const validationResult = this.validateMemoryEntry(memory)
    if (!validationResult.success) {
      return {
        type: "memoryError",
        error: validationResult.message,
        operation: "updateMemory",
      }
    }

    // 检查记忆是否存在
    const existingMemory = await this.memoryService.getMemoryById(roleUuid, memoryId)
    if (!existingMemory) {
      return {
        type: "memoryError",
        error: "Memory not found",
        operation: "updateMemory",
      }
    }

    // 更新记忆
    const updatedMemory = {
      ...memory,
      id: memoryId,
      updatedAt: new Date().toISOString(),
    }

    await this.memoryService.updateMemory(roleUuid, memoryId, updatedMemory)

    return {
      type: "memoryUpdated",
      memory: updatedMemory,
    }
  }

  /**
   * 删除记忆
   */
  private async deleteMemory(roleUuid: string, memoryId: string): Promise<MemoryManagementResponse> {
    // 检查记忆是否存在
    const existingMemory = await this.memoryService.getMemoryById(roleUuid, memoryId)
    if (!existingMemory) {
      return {
        type: "memoryError",
        error: "Memory not found",
        operation: "deleteMemory",
      }
    }

    // 删除记忆
    await this.memoryService.deleteMemory(roleUuid, memoryId)

    return {
      type: "memoryDeleted",
      memoryId,
    }
  }

  /**
   * 批量删除记忆
   */
  private async deleteMultipleMemories(roleUuid: string, memoryIds: string[]): Promise<MemoryManagementResponse> {
    const deletedIds: string[] = []
    const errors: string[] = []

    for (const memoryId of memoryIds) {
      try {
        const existingMemory = await this.memoryService.getMemoryById(roleUuid, memoryId)
        if (existingMemory) {
          await this.memoryService.deleteMemory(roleUuid, memoryId)
          deletedIds.push(memoryId)
        } else {
          errors.push(`Memory ${memoryId} not found`)
        }
      } catch (error) {
        errors.push(`Failed to delete memory ${memoryId}: ${error instanceof Error ? error.message : "Unknown error"}`)
      }
    }

    return {
      type: "multipleMemoriesDeleted",
      memoryIds: deletedIds,
    }
  }

  /**
   * 清理记忆
   */
  private async cleanupMemories(
    roleUuid: string,
    olderThan?: string,
    importanceThreshold?: number
  ): Promise<MemoryManagementResponse> {
    const memories = await this.memoryService.getAllMemories(roleUuid)
    let toDelete: string[] = []

    for (const memory of memories) {
      // 跳过常驻记忆
      if (memory.isConstant) continue

      let shouldDelete = false

      // 按时间过滤
      if (olderThan) {
        const cutoffDate = new Date(olderThan)
        if (new Date(memory.createdAt) < cutoffDate) {
          shouldDelete = true
        }
      }

      // 按重要性过滤
      if (!shouldDelete && importanceThreshold !== undefined) {
        const importance = memory.importanceScore || memory.priority
        if (importance < importanceThreshold) {
          shouldDelete = true
        }
      }

      if (shouldDelete) {
        toDelete.push(memory.id)
      }
    }

    // 执行删除
    for (const memoryId of toDelete) {
      await this.memoryService.deleteMemory(roleUuid, memoryId)
    }

    return {
      type: "memoriesCleaned",
      deletedCount: toDelete.length,
    }
  }

  /**
   * 导入记忆
   */
  private async importMemories(roleUuid: string, memories: MemoryEntry[]): Promise<MemoryManagementResponse> {
    const existingMemories = await this.memoryService.getAllMemories(roleUuid)
    const existingIds = new Set(existingMemories.map(m => m.id))

    let importedCount = 0
    const errors: string[] = []

    for (const memory of memories) {
      try {
        // 验证记忆数据
        const validationResult = this.validateMemoryEntry(memory)
        if (!validationResult.success) {
          errors.push(`Invalid memory ${memory.id}: ${validationResult.message}`)
          continue
        }

        // 生成新ID（如果已存在）
        let memoryId = memory.id
        if (existingIds.has(memoryId)) {
          memoryId = `imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }

        // 设置新的创建和更新时间
        const newMemory = {
          ...memory,
          id: memoryId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        // 添加记忆
        await this.memoryService.addMemory(roleUuid, newMemory)
        importedCount++
      } catch (error) {
        errors.push(`Failed to import memory ${memory.id}: ${error instanceof Error ? error.message : "Unknown error"}`)
      }
    }

    return {
      type: "memoriesImported",
      importedCount,
      errors: errors.length > 0 ? errors : undefined,
    }
  }

  /**
   * 导出记忆
   */
  private async exportMemories(roleUuid: string, memoryIds?: string[]): Promise<MemoryManagementResponse> {
    let memories: MemoryEntry[]

    if (memoryIds) {
      // 导出指定的记忆
      memories = []
      for (const memoryId of memoryIds) {
        const memory = await this.memoryService.getMemoryById(roleUuid, memoryId)
        if (memory) {
          memories.push(memory)
        }
      }
    } else {
      // 导出所有记忆
      memories = await this.memoryService.getAllMemories(roleUuid)
    }

    // 生成文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const fileName = `memory_export_${roleUuid}_${timestamp}.json`

    return {
      type: "memoriesExported",
      memories,
      fileName,
    }
  }

  /**
   * 验证记忆条目
   */
  private validateMemoryEntry(memory: MemoryEntry): MemoryOperationResult {
    if (!memory.content || memory.content.trim().length === 0) {
      return {
        success: false,
        message: "Memory content cannot be empty",
      }
    }

    if (memory.priority < 0 || memory.priority > 100) {
      return {
        success: false,
        message: "Priority must be between 0 and 100",
      }
    }

    if (!memory.type || !["episodic", "semantic", "trait", "goal"].includes(memory.type)) {
      return {
        success: false,
        message: "Invalid memory type",
      }
    }

    if (!memory.triggerType || !["keyword", "semantic", "temporal", "emotional"].includes(memory.triggerType)) {
      return {
        success: false,
        message: "Invalid trigger type",
      }
    }

    if (!Array.isArray(memory.keywords)) {
      return {
        success: false,
        message: "Keywords must be an array",
      }
    }

    return {
      success: true,
      message: "Memory entry is valid",
    }
  }

  /**
   * 获取所有角色的记忆统计概览
   */
  async getAllRolesMemoryOverview(): Promise<Record<string, { count: number; types: Record<string, number> }>> {
    // 这里需要实现获取所有角色UUID的逻辑
    // 暂时返回空对象，后续可以扩展
    return {}
  }
}