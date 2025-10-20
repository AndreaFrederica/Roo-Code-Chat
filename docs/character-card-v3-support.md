# Character Card V3 支持文档

## 概述

本项目现已支持 Character Card V3 格式，这是角色卡片的新一代规范，提供了更丰富的功能和更好的扩展性。

## 主要特性

### 1. 资源系统 (Assets)
- **头像支持**: V3 格式支持多种头像资源，包括 base64 数据、HTTP/HTTPS URL
- **多种资源类型**: 支持 icon、background、user_icon、emotion 等类型
- **命名资源**: 资源可以有名称，便于管理和引用

### 2. 增强的角色信息
- **昵称支持**: 除了角色名，还支持昵称字段，用于 `{{char}}` 占位符
- **多语言创作者备注**: 支持多语言的创作者备注
- **来源信息**: 可以记录角色卡片的来源链接
- **时间戳**: 记录创建和修改时间

### 3. 改进的 Lorebook
- **正则表达式支持**: Lorebook 条目支持正则表达式匹配
- **更多控制选项**: 增加了更多触发条件和控制选项
- **装饰器支持**: 支持高级装饰器语法

## 历史界面头像显示

### 功能说明
历史界面现在可以显示 Character Card V3 中的角色头像：

1. **自动检测**: 系统会自动检测历史记录中的角色是否使用 V3 格式
2. **头像提取**: 从 V3 卡片的 `assets` 数组中提取 `icon` 类型的资源
3. **优先级**: 优先显示名为 `main` 的 icon，如果没有则显示第一个 icon
4. **降级处理**: 如果头像加载失败，会自动降级到文字头像

### 实现细节

#### 类型定义更新
```typescript
// packages/types/src/history.ts
export const historyItemSchema = z.object({
  // ... 其他字段
  anhRoleAvatar: z.string().optional(), // 新增头像字段
})
```

#### UI 组件更新
```typescript
// webview-ui/src/components/history/HistoryPreview.tsx
const getAvatarContent = () => {
  // 尝试从任务中获取头像
  const taskWithAvatar = role.tasks.find(task => task.anhRoleAvatar)
  if (taskWithAvatar?.anhRoleAvatar) {
    return <img src={taskWithAvatar.anhRoleAvatar} alt={role.name} />
  }
  // 降级到文字头像
  return role.name.charAt(0).toUpperCase()
}
```

## 工具函数

### characterCardV3.ts
提供了完整的 V3 格式处理工具函数：

```typescript
import { 
  isCharacterCardV3, 
  extractAvatarFromCardV3, 
  getCharacterDisplayName,
  convertV2ToV3,
  validateCharacterCardV3 
} from '@/utils/characterCardV3'

// 检查是否为 V3 格式
if (isCharacterCardV3(card)) {
  // 提取头像
  const avatar = extractAvatarFromCardV3(card)
  // 获取显示名称
  const displayName = getCharacterDisplayName(card)
}
```

### 主要函数

| 函数名 | 描述 |
|--------|------|
| `isCharacterCardV3()` | 检查是否为 V3 格式 |
| `extractAvatarFromCardV3()` | 从 V3 卡片提取头像 |
| `resolveAssetUri()` | 解析资源 URI |
| `getCharacterDisplayName()` | 获取角色显示名称 |
| `convertV2ToV3()` | 将 V2 格式转换为 V3 |
| `validateCharacterCardV3()` | 验证 V3 格式 |
| `extractHistoryInfoFromCard()` | 提取历史记录所需信息 |

## 使用示例

### V3 卡片示例
```json
{
  "spec": "chara_card_v3",
  "spec_version": "3.0",
  "data": {
    "name": "水色",
    "nickname": "小水",
    "description": "一个温柔善良的少女...",
    "assets": [
      {
        "type": "icon",
        "uri": "data:image/png;base64,...",
        "name": "main",
        "ext": "png"
      }
    ],
    "character_book": {
      "entries": [
        {
          "keys": ["基本信息"],
          "content": "水色是一个18岁的少女...",
          "use_regex": false,
          "enabled": true
        }
      ]
    }
  }
}
```

### 在历史记录中使用
```typescript
// 当创建历史记录时，如果角色使用了 V3 卡片
if (isCharacterCardV3(characterCard)) {
  const historyInfo = extractHistoryInfoFromCard(characterCard)
  
  // 保存到历史记录
  const historyItem: HistoryItem = {
    // ... 其他字段
    anhRoleName: historyInfo.name,
    anhRoleAvatar: historyInfo.avatar, // 头像会被保存
  }
}
```

## 兼容性

### 向后兼容
- 完全兼容 Character Card V2 格式
- V2 卡片会自动转换为 V3 格式进行处理
- 历史记录中的 V2 格式仍然可以正常显示

### 格式转换
```typescript
// 将 V2 转换为 V3
const v3Card = convertV2ToV3(v2Card)
```

## 资源 URI 格式支持

### 支持的格式
1. **Base64 数据 URL**: `data:image/png;base64,...`
2. **HTTP/HTTPS URL**: `https://example.com/image.png`
3. **默认资源**: `ccdefault:` (暂不支持，显示默认头像)

### 暂不支持的格式
1. **嵌入资源**: `embeded://path/to/asset.png` (需要 CHARX 文件支持)
2. **本地文件**: `file:///path/to/image.png` (安全限制)

## 注意事项

1. **性能考虑**: 头像图片会缓存，避免重复加载
2. **错误处理**: 图片加载失败时会自动降级到文字头像
3. **安全限制**: 只支持安全的图片来源，避免 XSS 攻击
4. **存储优化**: 头像 URL 会存储在历史记录中，避免重复解析

## 未来扩展

1. **CHARX 文件支持**: 计划支持嵌入资源格式
2. **更多资源类型**: 支持音频、视频等资源类型
3. **动态头像**: 支持根据情绪变化的动态头像
4. **头像缓存**: 优化头像缓存机制

## 相关文件

- `packages/types/src/silly-tavern-card.ts` - 类型定义
- `src/utils/characterCardV3.ts` - 工具函数
- `webview-ui/src/components/history/HistoryPreview.tsx` - 历史预览组件
- `temp/chara_card_v3_example.json` - V3 格式示例
- `temp/SPEC_V3.md` - V3 规范文档
