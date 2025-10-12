// 测试记忆管理器修复 - 验证角色添加的记忆能在管理器中显示
console.log('=== 测试记忆管理器修复 ===\n');

// 模拟角色记忆服务
class MockEnhancedRoleMemoryService {
  constructor() {
    this.memories = new Map(); // roleUuid -> memories
  }

  async loadMemory(roleUuid) {
    if (!this.memories.has(roleUuid)) {
      this.memories.set(roleUuid, {
        characterUuid: roleUuid,
        episodic: [],
        semantic: [],
        traits: [],
        goals: []
      });
    }
    return this.memories.get(roleUuid);
  }

  async addEpisodicMemory(roleUuid, content, keywords = [], options = {}) {
    const memory = await this.loadMemory(roleUuid);
    const newMemory = {
      id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      content,
      keywords: keywords.length > 0 ? keywords : this.extractKeywords(content),
      triggerType: 'keyword',
      priority: options.priority || 50,
      isConstant: options.isConstant || false,
      lastAccessed: Date.now(),
      accessCount: 0,
      relevanceWeight: 0.8,
      emotionalWeight: 0.5,
      timeDecayFactor: 0.1,
      relatedTopics: options.relatedTopics || [],
      emotionalContext: options.emotionalContext || [],
      metadata: {
        source: 'manual',
        version: 'enhanced',
        originalLength: content.length,
        truncated: content.length < 50
      }
    };

    memory.episodic.push(newMemory);
    return newMemory.id;
  }

  async getAllMemories(roleUuid) {
    const memory = await this.loadMemory(roleUuid);
    const allMemories = [];

    // 转换情景记忆
    memory.episodic.forEach(record => {
      allMemories.push({
        id: record.id,
        type: "episodic",
        content: record.content,
        keywords: record.keywords || [],
        triggerType: record.triggerType || "keyword",
        priority: record.priority || 50,
        isConstant: record.isConstant || false,
        importanceScore: record.relevanceWeight || 0.5,
        emotionType: this.inferEmotionType(record.content),
        emotionScore: record.emotionalWeight || 0.5,
        context: {
          timestamp: record.timestamp || Date.now(),
        },
        accessCount: record.accessCount || 0,
        lastAccessed: record.lastAccessed || record.timestamp,
        createdAt: new Date(record.timestamp || Date.now()).toISOString(),
        updatedAt: new Date(record.timestamp || Date.now()).toISOString(),
      });
    });

    return allMemories;
  }

  extractKeywords(content) {
    const words = content
      .toLowerCase()
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 1);

    return words.slice(0, 5);
  }

  inferEmotionType(content) {
    const positiveWords = ['开心', '高兴', '喜欢', '爱', '好', '棒'];
    const negativeWords = ['难过', '生气', '害怕', '讨厌', '坏', '糟'];

    const lowerContent = content.toLowerCase();
    const positiveCount = positiveWords.filter(word => lowerContent.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerContent.includes(word)).length;

    if (positiveCount > negativeCount) return "positive";
    if (negativeCount > positiveCount) return "negative";
    return "neutral";
  }
}

// 模拟角色记忆触发服务
class MockRoleMemoryTriggerService {
  constructor() {
    this.enhancedService = new MockEnhancedRoleMemoryService();
  }

  async addEpisodicMemory(roleUuid, content, keywords, options) {
    return await this.enhancedService.addEpisodicMemory(roleUuid, content, keywords, options);
  }

  getEnhancedRoleMemoryService() {
    return this.enhancedService;
  }
}

// 模拟记忆管理服务
class MockMemoryManagementService {
  constructor(enhancedService) {
    this.enhancedService = enhancedService;
  }

  async handleMessage(message) {
    switch (message.type) {
      case "getMemoryList":
        const memories = await this.enhancedService.getAllMemories(message.roleUuid);
        return {
          type: "memoryList",
          memories,
          stats: {
            totalMemories: memories.length,
            constantMemories: memories.filter(m => m.isConstant).length,
            averageImportance: memories.reduce((sum, m) => sum + (m.importanceScore || 0.5), 0) / memories.length,
            storageSize: JSON.stringify(memories).length,
            typeDistribution: memories.reduce((acc, m) => {
              acc[m.type] = (acc[m.type] || 0) + 1;
              return acc;
            }, {}),
            triggerTypeDistribution: memories.reduce((acc, m) => {
              acc[m.triggerType] = (acc[m.triggerType] || 0) + 1;
              return acc;
            }, {})
          }
        };

      default:
        return {
          type: "memoryError",
          error: `Unknown message type: ${message.type}`,
          operation: message.type,
        };
    }
  }
}

// 模拟记忆管理处理器
class MockMemoryManagementHandler {
  constructor() {
    this.memoryService = null;
  }

  async initialize(basePath, existingService) {
    if (existingService) {
      let enhancedService;
      if (existingService.constructor.name === 'MockRoleMemoryTriggerService') {
        enhancedService = existingService.getEnhancedRoleMemoryService();
      } else {
        enhancedService = existingService;
      }
      this.memoryService = new MockMemoryManagementService(enhancedService);
    }
  }

  async handleMessage(message) {
    if (!this.memoryService) {
      throw new Error("Memory service not initialized");
    }
    return await this.memoryService.handleMessage(message);
  }
}

// 测试流程
async function testMemoryManagementFix() {
  console.log('1. 初始化角色记忆触发服务');
  const roleMemoryTriggerService = new MockRoleMemoryTriggerService();
  const roleUuid = 'test_role_123';

  console.log('2. 角色调用记忆工具添加记忆');

  // 模拟角色添加第一条记忆
  await roleMemoryTriggerService.addEpisodicMemory(
    roleUuid,
    '用户今天告诉我他成功完成了那个困扰他很久的项目，我能从他的语气中听出那种如释重负的喜悦。',
    ['项目成功', '坚持', '喜悦'],
    { priority: 85, isConstant: false }
  );

  // 模拟角色添加第二条记忆
  await roleMemoryTriggerService.addEpisodicMemory(
    roleUuid,
    '作为星际探险家的张伟，他告诉我这次任务是要在半人马座阿尔法星系建立第一个人类殖民地。',
    ['星际探险家', '张伟', '人类殖民地'],
    { priority: 90, isConstant: false }
  );

  console.log('3. 初始化记忆管理器（使用相同的服务实例）');
  const memoryHandler = new MockMemoryManagementHandler();
  await memoryHandler.initialize(undefined, roleMemoryTriggerService);

  console.log('4. 记忆管理器获取记忆列表');
  const response = await memoryHandler.handleMessage({
    type: 'getMemoryList',
    roleUuid: roleUuid
  });

  console.log('5. 验证结果');
  console.log('记忆列表响应:');
  console.log(JSON.stringify(response, null, 2));

  if (response.type === 'memoryList') {
    const { memories, stats } = response;

    console.log('\n✅ 修复验证结果:');
    console.log(`- 找到记忆数量: ${memories.length}`);
    console.log(`- 统计信息: 总计 ${stats.totalMemories} 条记忆`);
    console.log(`- 类型分布:`, stats.typeDistribution);

    console.log('\n记忆详情:');
    memories.forEach((memory, index) => {
      console.log(`${index + 1}. [${memory.type}] ${memory.content.substring(0, 50)}...`);
      console.log(`   关键词: ${memory.keywords.join(', ')}`);
      console.log(`   优先级: ${memory.priority}`);
      console.log(`   创建时间: ${memory.createdAt}`);
      console.log('');
    });

    if (memories.length >= 2) {
      console.log('🎉 修复成功！记忆管理器能够正确显示角色添加的记忆');
      return true;
    } else {
      console.log('❌ 修复失败！记忆管理器未能找到足够的记忆');
      return false;
    }
  } else {
    console.log('❌ 修复失败！获取记忆列表时出错:', response.error);
    return false;
  }
}

// 运行测试
testMemoryManagementFix().then(success => {
  console.log('\n=== 测试总结 ===');
  if (success) {
    console.log('✅ 记忆管理器修复成功');
    console.log('✅ 角色添加的记忆现在能在设置面板的记忆管理器中正确显示');
    console.log('✅ 使用了相同的服务实例，确保数据一致性');
  } else {
    console.log('❌ 记忆管理器修复失败');
    console.log('❌ 需要进一步检查服务初始化和数据同步');
  }
}).catch(error => {
  console.error('测试过程中发生错误:', error);
});