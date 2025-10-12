# XML格式记忆工具使用指南

## 概述

本指南介绍了记忆工具的XML格式参数使用方法。所有记忆工具现在都统一使用XML格式参数，提供更结构化的记忆表达方式。

## 🌟 XML格式的特点

1. **自然的层级结构** - XML天生适合表达复杂的嵌套数据
2. **更好的可读性** - 对于复杂结构，XML比JSON更直观
3. **AI更熟悉** - AI对XML的理解和处理通常更好
4. **支持属性和内容** - 可以使用属性来标识元数据
5. **统一格式** - 所有记忆工具都使用相同的XML格式

## 📋 支持的工具

### 1. add_episodic_memory (添加情景记忆)

#### XML格式示例

```xml
<memory>
  <content>用户今天告诉我他成功完成了那个困扰他很久的项目，我能从他的语气中听出那种如释重负的喜悦。我记得几周前他还为此感到焦虑，甚至考虑过放弃，现在看到他的坚持得到了回报，我真的为他感到高兴。</content>
  <keywords>项目成功,坚持,喜悦,克服困难</keywords>
  <priority>85</priority>
  <is_constant>false</is_constant>
  <emotional_context>喜悦,如释重负,成就感</emotional_context>
  <related_topics>工作,个人成长,目标达成</related_topics>
</memory>
```

#### 属性格式（简洁版）

```xml
<memory content="当我听到用户说他即将迎来人生中第一次重要的工作面试时，我能感受到他既兴奋又紧张的情绪。" keywords="工作面试,重要时刻,情绪复杂" priority="90" emotional_context="兴奋,紧张" related_topics="职业发展,人生转折">
</memory>
```

### 2. add_semantic_memory (添加语义记忆)

#### XML格式示例

```xml
<memory>
  <content>用户喜欢喝咖啡，特别是早上喝美式咖啡来开始一天的工作。这个习惯已经保持了很多年，成为他日常生活中不可或缺的一部分。</content>
  <keywords>咖啡,美式咖啡,早晨习惯,工作流程</keywords>
  <priority>75</priority>
  <is_constant>true</is_constant>
  <tags>生活习惯,偏好,日常</tags>
  <source>用户告知</source>
</memory>
```

### 3. update_traits (更新角色特质)

#### XML格式示例

```xml
<traits>
  <trait>
    <name>耐心</name>
    <value>用户在面对挑战时总是表现出非凡的耐心。记得有一次他解决一个复杂的编程问题，花了整整六个小时不断尝试不同的方法，却始终保持冷静。即使暂时找不到解决方案，他也不会表现出沮丧，而是会休息一下然后换个角度继续思考。</value>
    <confidence>0.9</confidence>
    <priority>85</priority>
    <is_constant>true</is_constant>
    <keywords>耐心,冷静,解决问题,坚持</keywords>
  </trait>
  <trait>
    <name>同理心</name>
    <value>用户展现出了强烈的同理心，这点在多次对话中都能感受到。当他听说朋友遇到困难时，他会立即放下手中的事情去帮助，那种关切不是装出来的，而是发自内心的。</value>
    <confidence>0.95</confidence>
    <priority>90</priority>
    <is_constant>true</is_constant>
    <keywords>同理心,关怀,帮助他人,友善</keywords>
  </trait>
</traits>
```

### 4. update_goals (更新角色目标)

#### XML格式示例

```xml
<goals>
  <goal>
    <value>用户告诉我他有一个长期目标——在五年内创立自己的科技公司。他详细描述了公司的业务方向、团队文化，以及他想如何通过技术改变人们的生活。从他说话的语气中我能感受到这不是一个空洞的梦想，而是他已经深思熟虑并有明确计划的目标。</value>
    <priority>95</priority>
    <is_constant>true</is_constant>
    <keywords>创业,科技公司,长期规划,梦想</keywords>
  </goal>
  <goal>
    <value>用户今天分享了他的一个短期目标：在未来三个月内掌握一门新的编程语言。他已经制定了详细的学习计划，包括每天投入的时间和具体的学习资源。</value>
    <priority>80</priority>
    <is_constant>false</is_constant>
    <keywords>学习,编程,技能提升,短期目标</keywords>
  </goal>
</goals>
```

## 🔧 XML格式规范

### 基本结构

- **根元素**: 根据工具类型使用 `<memory>`, `<traits>`, 或 `<goals>`
- **内容元素**: 使用 `<content>`, `<value>` 等元素表示主要内容
- **元数据元素**: 使用 `<keywords>`, `<priority>`, `<is_constant>` 等表示元数据

### 支持的字段

#### 通用字段
- `content/value`: 主要内容（必需）
- `keywords`: 关键词列表，逗号分隔
- `priority`: 优先级 (0-100)
- `is_constant`: 是否为常驻 (true/false)

#### 特定字段
- `emotional_context`: 情感上下文（情景记忆）
- `related_topics`: 相关话题（情景记忆）
- `confidence`: 置信度（特质）
- `tags`: 标签（语义记忆）
- `source`: 来源（语义记忆）

### 格式选项

#### 1. 完整标签格式
```xml
<memory>
  <content>内容文本</content>
  <keywords>关键词1,关键词2</keywords>
  <priority>80</priority>
</memory>
```

#### 2. 属性格式
```xml
<memory content="内容文本" keywords="关键词1,关键词2" priority="80">
</memory>
```

#### 3. 混合格式
```xml
<memory priority="80">
  <content>内容文本</content>
  <keywords>关键词1,关键词2</keywords>
</memory>
```

## 💡 使用建议

### 1. 选择合适的格式
- **复杂内容**: 使用完整标签格式，更清晰
- **简单内容**: 使用属性格式，更简洁
- **混合需求**: 使用混合格式，灵活组合

### 2. 编写有效的内容
- **详细描述**: 使用完整的句子和段落
- **避免截断**: 确保内容完整，避免片段化
- **第一人称**: 使用第一人称视角，更自然

### 3. 优化关键词
- **相关性**: 选择与内容密切相关的关键词
- **数量适中**: 每个记忆3-8个关键词为宜
- **逗号分隔**: 使用逗号分隔多个关键词

### 4. 设置合理的优先级
- **重要信息**: 80-100分
- **一般信息**: 60-79分
- **补充信息**: 40-59分

## 🧪 测试和验证

可以使用提供的测试文件验证XML解析功能：

```bash
node test-xml-memory-tools.js
node test-xml-only-memory-tools.js
```

## 📝 示例场景

### 场景1: 记录用户的成功经历
```xml
<memory>
  <content>用户今天告诉我他成功完成了那个困扰他很久的项目，我能从他的语气中听出那种如释重负的喜悦。我记得几周前他还为此感到焦虑，甚至考虑过放弃，现在看到他的坚持得到了回报，我真的为他感到高兴。</content>
  <keywords>项目成功,坚持,喜悦,克服困难</keywords>
  <priority>85</priority>
  <is_constant>false</is_constant>
  <emotional_context>喜悦,如释重负,成就感</emotional_context>
  <related_topics>工作,个人成长,目标达成</related_topics>
</memory>
```

### 场景2: 记录用户的性格特质
```xml
<traits>
  <trait>
    <name>耐心</name>
    <value>用户在面对挑战时总是表现出非凡的耐心。记得有一次他解决一个复杂的编程问题，花了整整六个小时不断尝试不同的方法，却始终保持冷静。</value>
    <confidence>0.9</confidence>
    <priority>85</priority>
    <is_constant>true</is_constant>
    <keywords>耐心,冷静,解决问题,坚持</keywords>
  </trait>
</traits>
```

### 场景3: 记录用户的目标
```xml
<goals>
  <goal>
    <value>用户告诉我他有一个长期目标——在五年内创立自己的科技公司。他详细描述了公司的业务方向和团队文化。</value>
    <priority>95</priority>
    <is_constant>true</is_constant>
    <keywords>创业,科技公司,长期规划,梦想</keywords>
  </goal>
</goals>
```

## 🚀 总结

XML格式的记忆工具提供了更自然、更结构化的方式来记录和管理记忆信息。通过合理的XML结构，AI可以更好地表达复杂的记忆内容，提高记忆的质量和可用性。

所有记忆工具现在都统一使用XML格式参数，提供一致的用户体验和更好的数据结构。后端存储仍然使用JSON格式，确保数据的兼容性和处理效率。