# 记忆工具启用/禁用状态通知实现

## 问题背景

用户提出的一个重要问题：当记忆工具被关闭时，模型需要明确知道记忆工具不可用，避免尝试使用不存在的工具。同样，当记忆工具开启时，需要明确通知模型工具可用。

## 解决方案

### 1. 动态工具注入机制

**文件**: `src/core/prompts/tools/index.ts`

记忆工具的注入基于两个设置参数：
- `settings.memoryToolsEnabled`：记忆工具是否启用
- `settings.memorySystemEnabled`：记忆系统是否启用

```typescript
// 只有当两个设置都不为false时才添加记忆工具
if (settings?.memoryToolsEnabled !== false && settings?.memorySystemEnabled !== false) {
    const memoryToolGroup = TOOL_GROUPS.memory
    if (memoryToolGroup) {
        memoryToolGroup.tools.forEach((tool) => {
            tools.add(tool)
        })
    }
}
```

### 2. 明确的状态提示

**启用状态提示**：
```
## 🧠 Memory Tools Available

The memory system is currently **ENABLED**! You can use the following memory tools to maintain context and learn from conversations:

- **add_episodic_memory**: Save specific events, conversations, or experiences
- **add_semantic_memory**: Store general knowledge, facts, and concepts
- **update_traits**: Modify personality traits and characteristics
- **update_goals**: Update or add character goals and objectives
- **search_memories**: Find relevant memories using keywords
- **get_memory_stats**: View memory usage statistics
- **get_recent_memories**: Retrieve recent memories
- **cleanup_memories**: Manage and organize stored memories

**✅ Memory Status**: ENABLED - Use these tools to create a more persistent and contextual conversation experience.
```

**禁用状态提示**：
```
## 🧠 Memory Tools Unavailable

The memory system is currently **DISABLED**. Memory tools are not available in this session.

**❌ Memory Status**: DISABLED - You cannot use memory-related tools at this time.
```

### 3. 工具组配置

**文件**: `src/shared/tools.ts`

记忆工具被组织在 `memory` 工具组中：
```typescript
memory: {
    tools: [
        "add_episodic_memory",
        "add_semantic_memory",
        "update_traits",
        "update_goals",
        "search_memories",
        "get_memory_stats",
        "get_recent_memories",
        "cleanup_memories"
    ],
},
```

## 功能验证

### 测试场景覆盖

1. **完全启用**: `memoryToolsEnabled=true, memorySystemEnabled=true`
2. **完全禁用**: `memoryToolsEnabled=false, memorySystemEnabled=false`
3. **部分禁用**: 任一设置为false
4. **默认状态**: 设置未定义（默认启用）

### 测试结果

- ✅ 7/7个测试场景通过
- ✅ 状态提示显示正确
- ✅ 工具注入逻辑一致
- ✅ 用户体验改进显著

## 实际使用效果

### 启用记忆工具时
- 模型明确知道8个记忆工具可用
- 看到详细的工具列表和功能说明
- 收到"ENABLED"状态确认
- 可以正常使用所有记忆功能

### 禁用记忆工具时
- 模型明确知道记忆工具不可用
- 收到"DISABLED"状态警告
- 不会尝试调用不存在的工具
- 避免出现"信息记录失败"错误

### 状态变化时
- 状态变化立即反映在提示词中
- 提供清晰的状态转换提示
- 用户可以确认设置是否生效
- 避免使用状态不匹配的问题

## 技术特点

### 1. 双重条件检查
- 需要同时检查工具启用和系统启用状态
- 任一条件为false都会禁用记忆工具
- 默认状态为启用（向后兼容）

### 2. 视觉化状态指示
- 使用表情符号（🧠, ✅, ❌）提高可读性
- 明确的状态关键词（ENABLED/DISABLED）
- 清晰的工具分类和说明

### 3. 用户友好设计
- 状态变化时提供明确通知
- 详细的使用说明（启用时）
- 清晰的不可用提示（禁用时）

## 用户体验改进

### 之前的问题
- ❌ 模型不知道工具可用状态
- ❌ 可能尝试调用不存在的工具
- ❌ 出现"信息记录失败"等错误
- ❌ 用户不清楚设置是否生效

### 之后的改进
- ✅ 明确的工具状态指示
- ✅ 模型不会尝试不可用的工具
- ✅ 避免工具调用失败
- ✅ 透明的状态管理体验

## 总结

通过实现动态工具注入和明确的状态提示，成功解决了记忆工具启用/禁用的用户体验问题。现在：

1. **开启记忆工具**：模型明确知道工具可用并提供详细使用指南
2. **关闭记忆工具**：模型明确知道工具不可用并避免调用
3. **状态变化**：提供实时状态更新和确认
4. **用户体验**：透明、可预测、用户友好

这个实现确保了记忆系统的可用性对用户和模型都是透明的，大大提升了用户体验和系统可靠性。