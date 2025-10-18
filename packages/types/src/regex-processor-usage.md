# STProfile 正则表达式处理器使用指南

## 概述

STProfile 正则表达式处理器支持用户在三个不同阶段对文本内容进行正则表达式处理：

1. **预处理阶段** (`PRE_PROCESSING`): 在模板渲染时对提示词内容进行处理
2. **AI输出阶段** (`AI_OUTPUT`): 对AI生成的回复内容进行实时处理
3. **后处理阶段** (`POST_PROCESSING`): 在内容展示前进行最终的格式化处理

## 基本使用

### 1. 完整处理流程

```typescript
import { STProfileProcessor } from './st-profile-processor.js'

// 创建处理器
const processor = new STProfileProcessor()

// 处理 STProfile 并获取处理器实例
const result = await processor.process(targetRole, profileData)

if (result.success && result.processors) {
  // 使用 AI 输出处理器
  const aiOutput = result.processors.aiOutput.processAIOutput(aiResponse)

  // 使用后处理器
  const finalContent = result.processors.postProcess.processFinalContent(
    content,
    RegexTargetSource.ALL_CONTENT
  )
}
```

### 2. 独立使用处理器

```typescript
import {
  createAIOutputProcessor,
  createPostProcessor,
  RegexTargetSource
} from './st-profile-processor.js'

// 从 profile 数据创建处理器
const aiProcessor = createAIOutputProcessor(profileData)
const postProcessor = createPostProcessor(profileData)

// 处理 AI 输出
const formattedAIOutput = aiProcessor.processAIOutput(
  "这是**粗体**文本",
  { variables: { user: "用户名" } }
)

// 处理最终内容
const finalFormatted = postProcessor.processFinalContent(
  "这是```代码块```内容",
  RegexTargetSource.ALL_CONTENT
)
```

## 配置示例

### TSProfile 中的正则绑定配置

```json5
{
  "extensions": {
    "SPreset": {
      "RegexBinding": [
        {
          // 基础配置
          "id": "format-dialogue",
          "scriptName": "格式化对话",
          "findRegex": ""([^"]*)"",
          "replaceString": "「$1」",

          // 处理配置
          "trimStrings": ["\\s+", "\\n+"],
          "substituteRegex": 1,  // 全局替换

          // 过滤配置
          "disabled": false,
          "promptOnly": false,
          "markdownOnly": false,
          "minDepth": 1,
          "maxDepth": 10,

          // 运行阶段控制
          "runStages": ["ai_output", "post_processing"],
          "targetSource": "ai_response",
          "priority": 100
        },

        {
          "id": "remove-code-blocks",
          "scriptName": "移除代码块",
          "findRegex": "```[\\s\\S]*?```",
          "replaceString": "",
          "substituteRegex": 1,
          "runStages": ["ai_output"],
          "targetSource": "ai_response",
          "priority": 200
        },

        {
          "id": "format-thoughts",
          "scriptName": "格式化思维",
          "findRegex": "'([^']*)'",
          "replaceString": "*$1*",
          "substituteRegex": 1,
          "runStages": ["pre_processing"],
          "targetSource": "prompt_content",
          "priority": 50
        }
      ]
    }
  }
}
```

## 运行阶段详解

### 1. 预处理阶段 (`PRE_PROCESSING`)

- **时机**: 在模板渲染时，LiquidJS 处理之后
- **目标**: 提示词内容
- **用途**: 格式化提示词、清理模板变量、标准化文本格式

```typescript
// 示例：标准化中文引号
const preProcessingBinding = {
  id: 'standardize-quotes',
  findRegex: '"([^"]*)"',
  replaceString: '「$1」',
  runStages: ['pre_processing'],
  targetSource: 'prompt_content',
  priority: 100
}
```

### 2. AI输出阶段 (`AI_OUTPUT`)

- **时机**: AI 生成回复后，显示给用户前
- **目标**: AI 回复内容
- **用途**: 格式化对话、移除不需要的内容、应用特定格式

```typescript
// 示例：格式化AI输出中的粗体
const aiOutputBinding = {
  id: 'format-bold',
  findRegex: '\\*\\*(.*?)\\*\\*',
  replaceString: '$1',
  runStages: ['ai_output'],
  targetSource: 'ai_response',
  priority: 100
}
```

### 3. 后处理阶段 (`POST_PROCESSING`)

- **时机**: 内容展示前的最终处理
- **目标**: 所有类型的内容
- **用途**: 最终格式化、添加装饰、确保一致性

```typescript
// 示例：添加代码块标记
const postProcessingBinding = {
  id: 'mark-code',
  findRegex: '`([^`]*)`',
  replaceString: '「代码：$1」',
  runStages: ['post_processing'],
  targetSource: 'all_content',
  priority: 50
}
```

## 高级功能

### 1. 变量替换

可以在替换字符串中使用变量：

```typescript
const binding = {
  id: 'variable-replace',
  findRegex: 'USER_NAME',
  replaceString: '{{userName}}',
  runStages: ['ai_output'],
  targetSource: 'ai_response'
}

// 使用时传入变量
const result = processor.processAIOutput(
  "你好，USER_NAME",
  { variables: { userName: "张三" } }
)
// 结果: "你好，张三"
```

### 2. 优先级控制

优先级数值越高，越先执行：

```typescript
const bindings = [
  { id: 'low-priority', priority: 10, /* ... */ },
  { id: 'high-priority', priority: 100, /* ... */ }
]
// high-priority 会先执行
```

### 3. 条件过滤

可以使用各种条件来控制绑定的执行：

```typescript
const conditionalBinding = {
  id: 'conditional',
  findRegex: 'test',
  replaceString: 'replaced',

  // 只在 markdown 内容中执行
  "markdownOnly": true,

  // 只在特定深度执行
  "minDepth": 2,
  "maxDepth": 5,

  // 只在提示词中执行
  "promptOnly": true,

  // 指定运行阶段
  "runStages": ["pre_processing"],
  "targetSource": "prompt_content"
}
```

## 实际应用场景

### 1. 对话格式化

```typescript
// 将英文引号转换为中文引号
const dialogueFormat = {
  id: 'dialogue-format',
  findRegex: '"([^"]*)"',
  replaceString: '「$1」',
  runStages: ['ai_output'],
  targetSource: 'ai_response',
  priority: 100
}
```

### 2. 内容清理

```typescript
// 移除多余的空行
const cleanup = {
  id: 'cleanup',
  findRegex: '\\n{3,}',
  replaceString: '\\n\\n',
  runStages: ['post_processing'],
  targetSource: 'all_content',
  priority: 200
}
```

### 3. 特殊格式处理

```typescript
// 将代码块转换为特殊格式
const codeFormat = {
  id: 'code-format',
  findRegex: '```([\\s\\S]*?)```',
  replaceString: '［代码］$1［/代码］',
  runStages: ['ai_output'],
  targetSource: 'ai_response',
  priority: 150
}
```

## 错误处理

处理器具有内置的错误处理机制：

- 正则表达式语法错误：跳过该绑定，记录警告
- 其他异常：返回原始内容，不影响处理流程

```typescript
// 无效的正则表达式不会导致整个处理失败
const invalidBinding = {
  id: 'invalid',
  findRegex: '[invalid regex',  // 语法错误
  replaceString: 'test',
  runStages: ['pre_processing']
}

// 处理器会记录警告并跳过此绑定
```

## 性能优化建议

1. **合理使用优先级**：将高频使用的正则绑定设置较高优先级
2. **避免复杂正则**：复杂的正则表达式可能影响性能
3. **使用具体的目标**：精确指定 `targetSource` 和 `runStages`
4. **缓存处理器**：重复使用同一个处理器实例

## 调试技巧

1. **查看绑定信息**：

```typescript
const processor = createRegexProcessor(profileData)
console.log('所有绑定:', processor.getBindings())
console.log('预处理绑定:', processor.getBindingsForStage(RegexRunStage.PRE_PROCESSING))
```

2. **分阶段测试**：

```typescript
// 分别测试不同阶段
const preResult = processor.processContent(
  content,
  RegexRunStage.PRE_PROCESSING,
  RegexTargetSource.PROMPT_CONTENT
)

const aiResult = processor.processContent(
  content,
  RegexRunStage.AI_OUTPUT,
  RegexTargetSource.AI_RESPONSE
)
```

通过这些功能，你可以实现复杂的文本处理逻辑，满足各种格式化和内容处理需求。