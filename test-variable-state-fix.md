# 变量状态显示修复测试指南

## 修复内容

### 问题分析
原始问题：变量状态栏（`VariableStateDisplay`）只在任务的第一条消息中寻找变量数据，而变量实际上是在后续的AI回复中定义的。

### 解决方案
1. **修改 `TaskHeader.tsx`**：
   - 重写了 `mergedVariableState` 的计算逻辑
   - 优先从所有消息的 `tool.variableState` 中获取已保存的变量状态
   - 如果没有找到已保存的状态，则从消息文本中解析变量命令
   - 保留了从task本身的variableState获取数据的兼容性

2. **修改 `VariableStateDisplay.tsx`**：
   - 更新了组件props，增加了 `variableState` 参数
   - 保持了向后兼容性，仍然支持旧的 `variables` 数组参数
   - 优先使用新的 `variableState`，如果没有则使用旧的 `variables`

## 测试步骤

### 1. 启动应用
```bash
npm run build
npm run install:vsix
```

### 2. 测试场景
**场景1：基本变量设置**
1. 开始一个新的对话
2. 输入包含变量命令的提示，例如：
   ```
   请帮我设置一些变量：
   ```typescript
   _.set("username", "张三")
   _.set("age", 25)
   _.set("city", "北京")
   ```
   ```

**场景2：变量更新**
1. 设置初始变量
2. 在后续消息中更新变量：
   ```
   更新变量：
   ```typescript
   _.set("age", 26)
   _.set("city", "上海")
   ```
   ```

**场景3：混合操作**
1. 设置不同类型的变量操作：
   ```
   变量操作：
   ```typescript
   _.set("name", "李四")
   _.add("scores", 95)
   _.insert("tags", "javascript")
   ```
   ```

### 3. 验证点
1. **任务头部的变量状态栏**应该显示在任务头部，在TODO列表上方
2. **变量数量**应该显示当前活跃变量的数量
3. **最重要的变量**应该显示在折叠状态的主栏中
4. **展开后的详细视图**应该显示所有变量的详细信息
5. **实时更新**：每条包含变量命令的AI回复后，状态栏应该立即更新

### 4. 预期行为
- ✅ 变量状态栏显示在任务头部
- ✅ 从最新消息中正确读取变量状态
- ✅ 显示所有活跃变量的数量
- ✅ 点击展开可以看到所有变量的详细信息
- ✅ 变量状态在每条消息后实时更新

### 5. 故障排除
如果变量状态栏仍然不显示：
1. 检查浏览器控制台是否有错误
2. 确认AI回复中确实包含了 `_.set()`, `_.add()`, `_.insert()`, `_.remove()` 等命令
3. 检查消息数据结构中是否包含 `tool.variableState`
4. 验证 `VariableCommandParser` 是否正确解析了命令

## 技术细节

### 数据流
1. AI发送包含变量命令的消息
2. `Task.saveVariableStateToMessage()` 解析并保存变量状态到消息的 `tool.variableState`
3. `TaskHeader.mergedVariableState` 从所有消息中收集最新的变量状态
4. `VariableStateDisplay` 显示变量状态

### 兼容性
- 保持了对旧版本 `variables` 数组参数的兼容性
- 支持从多个数据源获取变量状态
- 保持了原有的UI样式和交互行为