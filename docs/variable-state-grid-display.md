# 变量状态网格显示功能

## 功能概述

为变量状态栏添加了网格显示功能，用户可以在UI设置中控制折叠状态下变量状态的显示行数和列数，从而更好地利用空间展示多个变量。

## 实现内容

### 1. 设置持久化机制

在 `ExtensionStateContext` 中添加了两个新的设置项：
- `variableStateDisplayRows`: 最大显示行数 (默认值: 2, 范围: 1-10)
- `variableStateDisplayColumns`: 最大显示列数 (默认值: 3, 范围: 1-5)

这些设置遵循应用一致的暂存和保存机制，通过 `setCachedStateField` 进行更新。

### 2. UI设置界面

在 `UISettings` 组件中添加了变量状态显示设置区域：
- 使用网格布局显示行数和列数控制
- 包含输入验证和限制
- 添加了相应的国际化翻译（中文和英文）

### 3. 网格显示逻辑

更新了 `VariableStateDisplay` 组件：
- **单个变量**：保持原有的单行显示方式
- **多个变量**：使用网格布局显示多个变量
- **空位处理**：当变量数量不足以填满网格时，显示空位占位

### 4. 显示特性

- 网格中的每个变量显示为一个小卡片
- 包含变量图标和变量名
- 鼠标悬停显示完整信息（变量名和值）
- 底部显示变量总数和超出限制的计数

## 设置界面

### 位置
设置 → UI → 变量状态显示

### 选项
- **最大显示行数**: 控制网格的行数 (1-10)
- **最大显示列数**: 控制网格的列数 (1-5)

### 默认值
- 行数: 2
- 列数: 3

## 显示效果

### 单个变量
```
[图标] 变量名: 值           [数据库图标] 1
```

### 多个变量 (2行×3列示例)
```
[图标]变量1  [图标]变量2  [图标]变量3
[图标]变量4  [图标]变量5             [数据库图标] 5
```

### 超出限制的情况
```
[图标]变量1  [图标]变量2  [图标]变量3
[图标]变量4  [图标]变量5             [数据库图标] 5+2
```

## 技术实现细节

### 数据流
1. 用户在UI设置中修改行列数
2. 通过 `setCachedStateField` 更新状态
3. `TaskHeader` 获取最新设置值
4. 传递给 `VariableStateDisplay` 组件
5. 组件根据设置计算网格布局

### 网格计算
```typescript
const maxDisplayCount = maxRows * maxColumns
const limitedVariableNames = variableNames.slice(0, maxDisplayCount)

// 生成网格数组，包含空位占位
const gridVariables = useMemo(() => {
  const grid = []
  for (let i = 0; i < maxRows * maxColumns; i++) {
    if (i < limitedVariableNames.length) {
      grid.push({ name: limitedVariableNames[i], command: variableStates[limitedVariableNames[i]] })
    } else {
      grid.push(null) // 空位
    }
  }
  return grid
}, [limitedVariableNames, variableStates, maxRows, maxColumns])
```

### CSS Grid布局
```css
display: grid;
grid-template-columns: repeat(var(--columns), 1fr);
gap: 4px 8px;
```

## 用户体验

### 优势
- **空间效率**: 可以在有限空间内显示更多变量
- **信息密度**: 用户可以快速浏览多个变量的状态
- **可定制性**: 根据个人偏好调整显示密度
- **一致性**: 遵循现有的设置保存机制

### 使用建议
- **小屏幕**: 使用较少的列数 (1-2列)
- **大屏幕**: 可以使用更多列数 (3-5列)
- **变量较少**: 保持较小的网格
- **变量较多**: 适当增加网格大小

## 兼容性

- 向后兼容：保持原有的单变量显示方式
- 渐进增强：多变量时自动使用网格布局
- 响应式设计：适应不同的屏幕尺寸

## 未来扩展

可以考虑的改进：
- 添加变量类型过滤选项
- 支持自定义网格排序
- 添加变量值的实时预览
- 支持点击变量跳转到定义位置