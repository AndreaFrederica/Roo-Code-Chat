# 正则系统修复总结

## 修复的问题

### 1. 类型不一致问题

- ✅ 修复了 `AstRule.id` 从可选改为必需
- ✅ 修复了 `RegexRulesConfig` 值类型从 `RegexRuleDefinition` 改为 `RegexRule`
- ✅ 统一了前后端的接口定义

### 2. 前端对新格式的支持

- ✅ 更新了前端 `RegexRule` 接口，包含所有新字段
- ✅ 实现了前端替换函数注册表，支持 `replacementFunction`
- ✅ 添加了内置替换函数：`timestamp`, `dateformat`, `emoji`, `smartQuotes`, `footnoteRef`
- ✅ 更新了UI显示，支持显示新字段信息

### 3. 设置写入机制

- ✅ 修复了后端发送规则时使用UUID作为ID，规则名称作为key
- ✅ 修复了前端配置写入使用 `rule.id` 而不是 `rule.key`
- ✅ 添加了调试日志来追踪配置状态

### 4. 后端规则发送

- ✅ 更新后端发送完整的规则信息，包括新的字段
- ✅ 正则规则：包含 `replacementFunction`, `groups`, `stage`, `priority`
- ✅ AST规则：包含完整的节点和处理信息

## 数据流程

### 后端到前端

```typescript
// 后端发送规则对象
{
  id: "52206560-5c47-4697-ae30-be5ca8d60dac",  // UUID
  key: "thinking",                             // 规则名称
  type: "ast",
  enabled: true,
  defaultEnabled: true,
  description: "思考块折叠处理",
  nodeType: "thinking",
  action: "fold",
  priority: 1,
  // ... 其他字段
}
```

### 前端到后端

```typescript
// 前端写入配置
{
  builtinRulesEnabled: {
    ast: {
      "52206560-5c47-4697-ae30-be5ca8d60dac": true  // 使用UUID作为键
    }
  },
  builtinRulesConfig: {
    "52206560-5c47-4697-ae30-be5ca8d60dac": {     // 使用UUID作为键
      defaultFolded: true
    }
  }
}
```

## 使用示例

### 创建自定义正则规则

```json
{
	"version": "1.0.0",
	"type": "regex",
	"name": "custom-replacements",
	"rules": {
		"customEmoji": {
			"id": "custom-emoji-001",
			"enabled": true,
			"pattern": ":([a-z]+):",
			"flags": "g",
			"replacementFunction": "emoji",
			"description": "自定义表情转换",
			"stage": "post-ast",
			"priority": 25,
			"groups": [
				{
					"name": "emojiName",
					"description": "表情名称",
					"example": ":tada: → 🎉"
				}
			]
		}
	}
}
```

### 测试用例

1. **时间戳注入**: `{{timestamp}}` → 当前ISO时间戳
2. **表情转换**: `:smiley:` → 😊
3. **脚注引用**: `[1]` → `<sup>[1]</sup>`
4. **智能引号**: `"hello"` → "hello"

## 调试信息

启用调试日志后，控制台会显示：

- `[isRuleDesired]` - 规则状态检查
- `[RuleToggle]` - 规则切换操作
- `[OutputStreamProcessor]` - 配置接收和保存

## 验证步骤

1. 打开设置面板的 "OutputStream Processor" 选项卡
2. 查看 "规则列表" 部分是否正确显示所有内置规则
3. 切换规则开关，检查控制台日志确认配置正确写入
4. 创建测试 mixin 文件验证新格式支持
5. 在聊天中测试替换功能是否正常工作

## 技术架构

```
前端 (WebView)
├── 设置界面 (OutputStreamProcessorSettings.tsx)
├── 规则处理 (useMarkdownProcessor.ts)
└── 替换函数注册表 (frontendReplacementFunctions)

后端 (Extension)
├── 规则定义 (builtin-*.ts)
├── 配置管理 (webviewMessageHandler.ts)
└── 增强处理器 (regexProcessorService.ts)
```

现在系统完全支持你设计的完整正则替换功能，包括分组捕获、函数式替换、多阶段执行等高级特性。
