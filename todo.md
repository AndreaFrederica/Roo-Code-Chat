# Markdown渲染器处理流程优化任务

## 目标
修改Markdown渲染器，禁用正则表达式中与AST处理重合的部分，改变处理流程为"先正则替换，再AST处理"

## 当前问题分析
✅ **已完成分析**：
- EnhancedMarkdownBlock.tsx 使用纯正则系统处理所有标签
- fold-config.ts 中定义的正则规则与AST处理的标签类型重合
- ast-fold-engine.ts 支持thinking、UpdateVariable等标签的树结构处理
- ASTEnhancedMarkdownBlock.tsx 有两套系统但存在重复处理问题

## 待完成任务

### 1. 设计新的处理流程
- [x] 确定哪些正则规则需要禁用（thinking、UpdateVariable等与AST重合的标签）
- [x] 设计"先正则后AST"的执行顺序
- [x] 确保不重复处理thinking/UpdateVariable标签

### 2. 实现修改
- [ ] 创建新的正则规则集（仅处理非AST标签）
- [ ] 修改AST折叠引擎，支持接收正则预处理结果
- [ ] 实现"先正则，后AST"的处理流程
- [ ] 更新EnhancedMarkdownBlock集成新的处理逻辑

## 解决方案设计

### 新的处理流程：
1. **第一阶段：正则预处理**
   - 仅处理非AST标签（如YAML front-matter、自定义分隔符等）
   - 禁用thinking、UpdateVariable等与AST重合的标签
   
2. **第二阶段：AST处理**
   - 对正则预处理后的文本进行AST解析
   - 专门处理thinking、UpdateVariable等复杂标签

### 禁用与AST重合的正则规则：
- thinking相关：thinking、think、思考、思索、ThinkingProcess等
- UpdateVariable相关：UpdateVariable
- 保留非AST标签：YAML front-matter、自定义分隔符等

## 关键文件
- `webview-ui/src/components/common/fold-config.ts` - 需要分离正则规则
- `webview-ui/src/components/common/fold-engine.ts` - 修改处理逻辑
- `webview-ui/src/components/common/EnhancedMarkdownBlock.tsx` - 集成新流程
- `webview-ui/src/components/common/ast-fold-engine.ts` - 接收正则结果
