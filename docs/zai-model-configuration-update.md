# ZAI 模型配置更新文档

## 概述

本文档记录了对 ZAI (智谱AI) 模型配置的重大更新，包括新增免费模型和视觉模型的预设配置，以及修复模型显示问题。

## 更新内容

### 1. 新增模型配置

#### GLM-4.5-Flash 免费模型
- **模型ID**: `glm-4.5-flash`
- **特性**: 
  - 免费开放使用
  - 支持 128K 上下文处理
  - 支持"思考模式"和"非思考模式"
  - 可通过 `thinking.type` 参数控制推理深度
- **配置参数**:
  - `maxTokens`: 8192
  - `contextWindow`: 128000
  - `supportsImages`: false
  - `inputPrice`: 0 (免费)
  - `outputPrice`: 0 (免费)

#### GLM-4.5V 视觉模型
- **模型ID**: `glm-4.5v`
- **特性**:
  - 新一代旗舰视觉推理模型
  - 基于MOE架构，总参数量106B，激活参数12B
  - 支持视频、图像、文本、文件作为输入
  - 64K多模态长上下文
  - 支持"思考模式"开关
- **配置参数**:
  - `maxTokens`: 8192
  - `contextWindow`: 64000
  - `supportsImages`: true
**价格配置：**
- **国际版：** 输入 $0.6/百万tokens，输出 $1.8/百万tokens
- **中国版：** 输入 2元/百万tokens，输出 6元/百万tokens

### 2. 修复的问题

#### 模型显示问题
- **问题描述**: `provider-settings.ts` 中 ZAI 的模型配置仅使用了 `internationalZAiModels`，导致中国站点的模型无法在设置界面显示
- **解决方案**: 
  - 在 `provider-settings.ts` 中导入 `mainlandZAiModels`
  - 修改 ZAI 模型配置，合并国际版和中国版的模型列表
  - 在 `webview-ui/src/components/settings/constants.ts` 中同步更新

## 文件修改记录

### 1. `packages/types/src/providers/zai.ts`
- 在 `internationalZAiModels` 中添加了 `glm-4.5-flash` 和 `glm-4.5v` 模型配置
- 在 `mainlandZAiModels` 中添加了相同的模型配置

### 2. `packages/types/src/provider-settings.ts`
- 导入 `mainlandZAiModels`
- 修改 ZAI 模型配置：
  ```typescript
  zai: { id: "zai", label: "Zai", models: [...Object.keys(internationalZAiModels), ...Object.keys(mainlandZAiModels)] }
  ```

### 3. `webview-ui/src/components/settings/constants.ts`
- 导入 `mainlandZAiModels`
- 更新 ZAI 模型配置：
  ```typescript
  zai: { ...internationalZAiModels, ...mainlandZAiModels }
  ```

## 技术细节

### 模型配置结构
每个模型配置包含以下字段：
- `maxTokens`: 最大输出令牌数
- `contextWindow`: 上下文窗口大小
- `supportsImages`: 是否支持图像输入
- `inputPrice`: 输入价格 (元/M tokens)
- `outputPrice`: 输出价格 (元/M tokens)
- `description`: 模型描述

### API 线路支持
ZAI 支持多个 API 线路：
- `international_coding`: 国际编程版
- `international`: 国际版
- `china_coding`: 中国编程版
- `china`: 中国版

通过 `zaiApiLineConfigs` 配置不同区域的 API 入口点。

## 影响范围

### 用户界面
- 设置界面中的 ZAI 模型选择器现在显示所有可用模型
- 用户可以选择新增的免费模型和视觉模型

### API 调用
- 新模型支持标准的 OpenAI 兼容 API 调用格式
- GLM-4.5V 支持多模态输入（图像、视频、文本）
- GLM-4.5-Flash 支持思考模式控制

## 测试建议

1. **模型显示测试**:
   - 验证设置界面中 ZAI 提供商显示所有模型
   - 确认新增的 `glm-4.5-flash` 和 `glm-4.5v` 模型出现在列表中

2. **功能测试**:
   - 测试 GLM-4.5-Flash 的免费调用
   - 测试 GLM-4.5V 的图像处理能力
   - 验证思考模式参数的正确传递

3. **兼容性测试**:
   - 确认现有 ZAI 模型配置不受影响
   - 验证不同 API 线路的正确切换

## 注意事项

1. **免费额度**: GLM-4.5-Flash 虽然免费，但可能有使用限制
2. **视觉功能**: GLM-4.5V 的图像处理功能需要确保前端正确传递图像数据
3. **思考模式**: 新模型的思考模式参数需要在 API 调用时正确设置

## 后续工作

1. 测试新模型的实际功能
2. 根据用户反馈调整模型配置
3. 考虑添加更多智谱AI的新模型
4. 优化模型选择的用户体验

---

**更新时间**: 2025-01-25  
**更新人员**: AI Assistant  
**版本**: v1.0