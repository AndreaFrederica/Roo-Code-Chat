import { z } from "zod"

// Memory management UI types
export const memoryFilterSchema = z.object({
  search: z.string().optional(),
  memoryType: z.enum(["all", "episodic", "semantic", "trait", "goal"]).optional(),
  triggerType: z.enum(["all", "keyword", "semantic", "temporal", "emotional"]).optional(),
  priorityRange: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
  }).optional(),
  dateRange: z.object({
    start: z.string().optional(),
    end: z.string().optional(),
  }).optional(),
  isConstant: z.boolean().optional(),
})

export type MemoryFilter = z.infer<typeof memoryFilterSchema>

export const memoryEntrySchema = z.object({
  id: z.string(),
  type: z.enum(["episodic", "semantic", "trait", "goal"]),
  content: z.string(),
  keywords: z.array(z.string()),
  triggerType: z.enum(["keyword", "semantic", "temporal", "emotional"]),
  priority: z.number(),
  isConstant: z.boolean(),
  importanceScore: z.number().optional(),
  emotionType: z.enum(["positive", "negative", "neutral"]).optional(),
  emotionScore: z.number().optional(),
  context: z.object({
    conversationId: z.string().optional(),
    messageId: z.string().optional(),
    timestamp: z.string(),
  }),
  accessCount: z.number().optional(),
  lastAccessed: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type MemoryEntry = z.infer<typeof memoryEntrySchema>

export const memoryStatsSchema = z.object({
  totalMemories: z.number(),
  typeDistribution: z.record(z.string(), z.number()),
  triggerTypeDistribution: z.record(z.string(), z.number()),
  emotionDistribution: z.record(z.string(), z.number()),
  averageImportance: z.number(),
  mostAccessedMemories: z.array(memoryEntrySchema),
  recentMemories: z.array(memoryEntrySchema),
  constantMemories: z.number(),
  lastCleanup: z.string().optional(),
  storageSize: z.number().optional(),
})

export type MemoryStats = z.infer<typeof memoryStatsSchema>

export const memoryOperationResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.any().optional(),
  error: z.string().optional(),
})

export type MemoryOperationResult = z.infer<typeof memoryOperationResultSchema>

export const memoryManagementStateSchema = z.object({
  selectedRoleUuid: z.string().optional(),
  memories: z.array(memoryEntrySchema),
  stats: memoryStatsSchema.optional(),
  filter: memoryFilterSchema,
  loading: z.boolean(),
  error: z.string().optional(),
  selectedMemories: z.array(z.string()),
  editMode: z.boolean(),
  editingMemory: memoryEntrySchema.optional(),
  showDeleteDialog: z.boolean(),
  memoryToDelete: z.string().optional(),
})

export type MemoryManagementState = z.infer<typeof memoryManagementStateSchema>

// API message types for memory management
export const memoryManagementMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("getMemoryList"),
    roleUuid: z.string(),
    filter: memoryFilterSchema.optional(),
  }),
  z.object({
    type: z.literal("getMemoryStats"),
    roleUuid: z.string(),
  }),
  z.object({
    type: z.literal("updateMemory"),
    roleUuid: z.string(),
    memoryId: z.string(),
    memory: memoryEntrySchema,
  }),
  z.object({
    type: z.literal("deleteMemory"),
    roleUuid: z.string(),
    memoryId: z.string(),
  }),
  z.object({
    type: z.literal("deleteMultipleMemories"),
    roleUuid: z.string(),
    memoryIds: z.array(z.string()),
  }),
  z.object({
    type: z.literal("cleanupMemories"),
    roleUuid: z.string(),
    olderThan: z.string().optional(),
    importanceThreshold: z.number().optional(),
  }),
  z.object({
    type: z.literal("importMemories"),
    roleUuid: z.string(),
    memories: z.array(memoryEntrySchema),
  }),
  z.object({
    type: z.literal("exportMemories"),
    roleUuid: z.string(),
    memoryIds: z.array(z.string()).optional(),
  }),
])

export type MemoryManagementMessage = z.infer<typeof memoryManagementMessageSchema>

export const memoryManagementResponseSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("memoryList"),
    memories: z.array(memoryEntrySchema),
    stats: memoryStatsSchema.optional(),
  }),
  z.object({
    type: z.literal("memoryStats"),
    stats: memoryStatsSchema,
  }),
  z.object({
    type: z.literal("memoryUpdated"),
    memory: memoryEntrySchema,
  }),
  z.object({
    type: z.literal("memoryDeleted"),
    memoryId: z.string(),
  }),
  z.object({
    type: z.literal("multipleMemoriesDeleted"),
    memoryIds: z.array(z.string()),
  }),
  z.object({
    type: z.literal("memoriesCleaned"),
    deletedCount: z.number(),
  }),
  z.object({
    type: z.literal("memoriesImported"),
    importedCount: z.number(),
    errors: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal("memoriesExported"),
    memories: z.array(memoryEntrySchema),
    fileName: z.string(),
  }),
  z.object({
    type: z.literal("memoryError"),
    error: z.string(),
    operation: z.string(),
  }),
])

export type MemoryManagementResponse = z.infer<typeof memoryManagementResponseSchema>

// Helper functions
export const formatMemoryTypeLabel = (type: string): string => {
  const labels = {
    episodic: "情景记忆",
    semantic: "语义记忆",
    trait: "特质",
    goal: "目标",
  }
  return labels[type as keyof typeof labels] || type
}

export const formatTriggerTypeLabel = (triggerType: string): string => {
  const labels = {
    keyword: "关键词",
    semantic: "语义",
    temporal: "时间",
    emotional: "情感",
  }
  return labels[triggerType as keyof typeof labels] || triggerType
}

export const formatEmotionTypeLabel = (emotionType: string): string => {
  const labels = {
    positive: "积极",
    negative: "消极",
    neutral: "中性",
  }
  return labels[emotionType as keyof typeof labels] || emotionType
}

export const getMemoryTypeColor = (type: string): string => {
  const colors = {
    episodic: "blue",
    semantic: "green",
    trait: "purple",
    goal: "orange",
  }
  return colors[type as keyof typeof colors] || "gray"
}

export const getEmotionTypeColor = (emotionType: string): string => {
  const colors = {
    positive: "text-green-600",
    negative: "text-red-600",
    neutral: "text-gray-600",
  }
  return colors[emotionType as keyof typeof colors] || "text-gray-600"
}

export const formatMemoryDate = (dateString: string): string => {
  return new Date(dateString).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export const calculateMemoryStats = (memories: MemoryEntry[]): MemoryStats => {
  const totalMemories = memories.length

  const typeDistribution = memories.reduce((acc, memory) => {
    acc[memory.type] = (acc[memory.type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const triggerTypeDistribution = memories.reduce((acc, memory) => {
    acc[memory.triggerType] = (acc[memory.triggerType] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const emotionDistribution = memories.reduce((acc, memory) => {
    if (memory.emotionType) {
      acc[memory.emotionType] = (acc[memory.emotionType] || 0) + 1
    }
    return acc
  }, {} as Record<string, number>)

  const averageImportance = memories.length > 0
    ? memories.reduce((sum, memory) => sum + (memory.importanceScore || 0), 0) / memories.length
    : 0

  const mostAccessedMemories = memories
    .filter(m => m.accessCount && m.accessCount > 0)
    .sort((a, b) => (b.accessCount || 0) - (a.accessCount || 0))
    .slice(0, 5)

  const recentMemories = memories
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10)

  const constantMemories = memories.filter(m => m.isConstant).length

  return {
    totalMemories,
    typeDistribution,
    triggerTypeDistribution,
    emotionDistribution,
    averageImportance,
    mostAccessedMemories,
    recentMemories,
    constantMemories,
    storageSize: JSON.stringify(memories).length,
  }
}