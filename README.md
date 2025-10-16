# Anh Chat

> 基于 Roo Code 的特化版本，在保留强大编码能力的基础上，极大强化了聊天交互体验

<details>
  <summary>🌐 Available languages</summary>

**许多语言的文本尚未更新**
- [English](README.md)
- [Català](locales/ca/README.md)
- [Deutsch](locales/de/README.md)
- [Español](locales/es/README.md)
- [Français](locales/fr/README.md)
- [हिंदी](locales/hi/README.md)
- [Bahasa Indonesia](locales/id/README.md)
- [Italiano](locales/it/README.md)
- [日本語](locales/ja/README.md)
- [한국어](locales/ko/README.md)
- [Nederlands](locales/nl/README.md)
- [Polski](locales/pl/README.md)
- [Português (BR)](locales/pt-BR/README.md)
- [Русский](locales/ru/README.md)
- [Türkçe](locales/tr/README.md)
- [Tiếng Việt](locales/vi/README.md)
- [简体中文](locales/zh-CN/README.md)
- [繁體中文](locales/zh-TW/README.md)
- ...
  </details>

---

### 相关项目（小说助手）

通过小说助手 将您的Code变成专业的小说IDE

https://github.com/AndreaFrederica/andrea-novel-helper

https://marketplace.visualstudio.com/items?itemName=andreafrederica.andrea-novel-helper

https://open-vsx.org/extension/andreafrederica/andrea-novel-helper

## 为什么要写Anh Chat 

怎么说呢 当时做这个东西是想写小说的时候和小说里的角色能对话 
后面就先加入酒馆兼容性的支持了
不过对完备的Profile和插件系统尚未做兼容就是了
目前世界书 角色卡（V2）还是能用的 

比起酒馆注重聊天能力 Anh Chat（下文称Chat）更注重保留Agent能力的基础上增加聊天能力 

最后就莫名其妙的续写能力和写作辅助能力比较强 但是聊天能力也还不错这样了 

## Anh Chat 能为您做什么？

### 🎭 角色聊天系统
- **自定义角色创建**：编写独特的角色设定，打造专属的AI助手
- **多角色管理**：同时设定和管理多个不同特性的角色
- **用户代理角色**：支持设定用户代理角色，实现更丰富的交互体验
- **角色切换**：在不同场景下快速切换到最适合的角色
- **SillyTavern 角色卡支持**：直接使用 SillyTavern 导出的角色卡，无需额外配置。计划实现一键导出ANH（小说助手角色）为SillyTavern角色卡。（目前不支持使用酒馆助手的角色卡 请注意）
- **SillyTavern 预设支持**: 支持使用ST的预设（注意 支持不全）
**SillyTavern 世界书支持**：支持导入ST的世界书

### 💻 强大的编码能力（继承自 Roo Code）
- 从自然语言描述和规范生成代码
- 适应性模式：代码、架构、询问、调试和自定义模式
- 重构和调试现有代码
- 编写和更新文档
- 回答关于代码库的问题
- 自动化重复性任务
- 利用 MCP 服务器

### 🎯 增强的聊天体验
- **智能对话**：基于角色设定的个性化对话体验
- **上下文记忆**：保持长期对话上下文，理解您的偏好
- **情感交互**：角色能够表达情感，提供更自然的交流体验
- **场景适应**：根据不同的使用场景自动调整对话风格

## 模式系统

Anh Chat 继承了 Roo Code 的强大模式系统，并在此基础上增强了聊天功能：

- **Code Mode**: 日常编码、编辑和文件操作
- **Architect Mode**: 规划系统、规范和迁移
- **Ask Mode**: 快速回答、解释和文档
- **Debug Mode**: 追踪问题、添加日志、隔离根本原因
- **Chat Mode**: 🆕 专门的聊天模式，支持角色扮演和深度对话
- **Custom Modes**: 为您的团队或工作流程构建专门的模式
- **Roomote Control**: 远程控制在本地 VS Code 实例中运行的任务

了解更多: [Using Modes](https://docs.roocode.com/basic-usage/using-modes) • [Custom Modes](https://docs.roocode.com/advanced-usage/custom-modes) • [Roomote Control](https://docs.roocode.com/roo-code-cloud/roomote-control)

## 注意

请勿滥用ANH-CHAT AI集成服务
如果您使用了ST兼容部分 请勿上报bug和问题到ST社区 除非这个问题在ST上能够复现
也不要上报到上游Roo Code社区 除非这个问题在Roo Code上复现
任何ANH-CHAT的问题 请在群里和Github社区 Issue 上报

您可以从ST社区获取ST格式的角色卡 世界书 预设 加载到ANH-CHAT里 为您的写作提供辅助支持 但是预设尚未完全兼容

也可以自行编写较为简单的ANH-CHAT格式角色卡 角色卡示例见我们的Github

## 角色系统特性

### 🔄 多角色切换
**目前每个会话只能使用一个角色**
- 快速在不同角色间切换
- 每个角色保持独立的对话历史
- 角色特定的知识库和专长领域

### 👥 用户代理角色
- 设定用户的虚拟身份
- 个性化的交互体验
- 基于用户角色的定制化建议

## 角色配置使用指南

### 📁 目录结构要求

要使用 Anh Chat 的角色功能，您需要在项目根目录创建 `novel-helper` 目录，并按以下结构组织文件：

```
项目根目录/
└── novel-helper/
    └── .anh-chat/
        ├── roles/
        │   ├── [SillyTavern].png             # 示例角色卡
        │   ├── index.json          # 角色索引文件
        │   └── [角色UUID].json      # 具体角色配置文件
        ├── tsprofile/               # SillyTavern 预设
        │   └── [预设名称].json
        ├── worldbooks/              # SillyTavern 世界书
        │   └── [世界书名称].json
        ├── Worldset/                # Anh Chat 世界设定集
        │   └── [设置名称].md
        ├── extension                # js扩展
        │   └── [扩展名称]
        │       ├── index.mjs
        │       └── extension.json
        ├── memory/                 # 记忆存储
        ├── storylines/             # 故事线
        └── timelines/              # 时间线
```

或者 可以使用全局配置目录（适用于所有项目）：

```
用户主目录/
└── .anh-chat/
    ├── roles/
    │   ├── [SillyTavern].png   # 示例角色卡
    │   ├── index.json          # 角色索引文件
    │   └── [角色UUID].json      # 具体角色配置文件
    ├── tsprofile/               # SillyTavern 预设
    │   └── [预设名称].json
    ├── worldbooks/              # SillyTavern 世界书
    │   └── [世界书名称].json
    ├── Worldset/                # Anh Chat 世界设定集
    │   └── [设置名称].md
    ├── extension                # js扩展
    │   └── [扩展名称]
    │       ├── index.mjs
    │       └── extension.json
    ├── memory/                 # 记忆存储
    ├── storylines/             # 故事线
    └── timelines/              # 时间线
    
```

### 🎭 角色配置文件格式

#### 角色索引文件 (roles/index.json)
```json
[
  {
    "uuid": "01998c7a-113e-73ef-bf63-e9911c33665b",
    "name": "博丽灵梦",
    "type": "主角",
    "packagePath": "roles/01998c7a-113e-73ef-bf63-e9911c33665b.json",
    "lastUpdatedAt": 1730918400000
  }
]
```

#### 具体角色配置文件
```json
{
  "uuid": "01998c7a-113e-73ef-bf63-e9911c33665b",
  "name": "博丽灵梦",
  "type": "主角",
  "aliases": ["博丽灵梦", "灵梦", "Reimu"],
  "affiliation": "博丽神社",
  "color": "#e94152ff",
  "description": "乐园的巫女。作为博丽神社的现任巫女...",
  "relationships": ["与雾雨魔理沙等常在异变中并肩或对阵..."],
  "notes": ["立场介于人之侧与幻想乡整体秩序之间..."],
  "profile": {
    "background": "人类。幻想乡博丽神社的巫女...",
    "appearance": ["红白巫女服，大红蝴蝶结与流苏"],
    "hobbies": ["把异变当作工作，偶尔悠闲泡茶或打扫神社"],
    "skills": ["在空中飞行程度的能力", "阴阳玉的攻防运用"],
    "代表符卡": ["梦想封印", "封魔阵"],
    "titles": ["乐园的巫女"]
  },
  "createdAt": 1730918400000,
  "updatedAt": 1730918400000,
  "lastUpdatedAt": 1730918400000
}
```

### 🚀 快速开始

1. **复制示例配置**：
   ```bash
   # 将 example/novel-helper 目录复制到项目根目录
   cp -r example/novel-helper ./novel-helper
   ```

2. **自定义角色**：
   - 编辑 `novel-helper/.anh-chat/roles/` 目录下的 JSON 文件
   - 修改角色的名称、描述、性格等属性
   - 更新 `index.json` 文件中的角色列表

3. **启动 Anh Chat**：
   - 打开 VS Code
   - 激活 Anh Chat 扩展
   - 在聊天界面选择您配置的角色

### 📝 角色属性说明

- **uuid**: 角色的唯一标识符
- **name**: 角色名称
- **type**: 角色类型（如：主角、配角、反派等）
- **aliases**: 角色的别名列表
- **affiliation**: 角色所属组织或阵营
- **color**: 角色的主题颜色（十六进制格式）
- **description**: 角色的详细描述
- **relationships**: 角色的人际关系
- **notes**: 关于角色的重要备注
- **profile**: 角色的详细档案
  - **background**: 背景故事
  - **appearance**: 外貌描述
  - **hobbies**: 兴趣爱好
  - **skills**: 技能和能力
  - **titles**: 称号或头衔

### 💡 使用技巧

- 使用有意义的 UUID 来组织角色
- 为角色设置独特的颜色主题
- 详细描述角色的性格和背景，以获得更好的聊天体验
- 定期更新 `lastUpdatedAt` 时间戳
- 可以参考 `example/novel-helper` 目录中的示例配置

## 社区讨论

**[GitHub Discussions](https://github.com/AndreaFrederica/andrea-novel-helper/discussions)** 
**[Discord 频道](https://discord.gg/YeVAXeKX)**
**[QQ群 小说助手用户反馈与交流](https://qm.qq.com/q/SG5A3XLoSQ)**

在这里您可以：
- 💬 参与社区讨论
- 🤝 分享使用经验和技巧
- 💡 提出功能建议和改进意见
- 🐛 报告问题和获取帮助
- 📚 查看常见问题解答


## 资源

- **[GitHub Discussions](https://github.com/AndreaFrederica/andrea-novel-helper/discussions):** 参与社区讨论，分享经验和获取帮助。
- **[文档](https://docs.roocode.com):** 安装、配置和掌握 Anh Chat 的官方指南。
- **[GitHub Issues](https://github.com/AndreaFrederica/andrea-novel-helper/issues):** 报告错误并跟踪开发进度。

---

## 本地设置和开发

1. **克隆** 仓库:

```sh
git clone https://github.com/RooCodeInc/Roo-Code.git
```

2. **安装依赖**:

```sh
pnpm install
```

3. **运行扩展**:

有几种方式运行 Anh Chat 扩展：

### 开发模式 (F5)

对于活跃开发，使用 VSCode 的内置调试：

在 VSCode 中按 `F5`（或转到 **运行** → **开始调试**）。这将打开一个运行 Anh Chat 扩展的新 VSCode 窗口。

- 对 webview 的更改将立即显示。
- 对核心扩展的更改也会自动热重载。

### 自动化 VSIX 安装

将扩展构建并安装为 VSIX 包直接到 VSCode：

```sh
pnpm install:vsix [-y] [--editor=<command>]
```

此命令将：

- 询问使用哪个编辑器命令（code/cursor/code-insiders）- 默认为 'code'
- 卸载任何现有版本的扩展。
- 构建最新的 VSIX 包。
- 安装新构建的 VSIX。
- 提示您重启 VS Code 以使更改生效。

选项：

- `-y`: 跳过所有确认提示并使用默认值
- `--editor=<command>`: 指定编辑器命令（例如，`--editor=cursor` 或 `--editor=code-insiders`）

### 手动 VSIX 安装

如果您更喜欢手动安装 VSIX 包：

1.  首先，构建 VSIX 包：
    ```sh
    pnpm vsix
    ```
2.  将在 `bin/` 目录中生成一个 `.vsix` 文件（例如，`bin/anh-cline-<version>.vsix`）。
3.  使用 VSCode CLI 手动安装：
    ```sh
    code --install-extension bin/anh-cline-<version>.vsix
    ```

---

我们使用 [changesets](https://github.com/changesets/changesets) 进行版本控制和发布。查看我们的 `CHANGELOG.md` 获取发布说明。

---

## 免责声明

**请注意** Roo Code, Inc ,Andrea Frederica **不对**与 Anh Chat、任何相关第三方工具或任何结果输出相关提供或提供的任何代码、模型或其他工具做出**任何陈述或保证**。您承担与使用任何此类工具或输出相关的**所有风险**；此类工具按 **"原样"** 和 **"可用"** 基础提供。此类风险可能包括但不限于 **知识产权侵权** 、**网络漏洞或攻击** 、**偏见** 、**不准确** 、**错误** 、**缺陷** 、**病毒** 、**停机** 、**财产损失或损坏** 和/或 **人身伤害** 。您对使用任何此类工具或输出（包括但不限于其合法性、适当性和结果）**承担全部责任**。

---

## 贡献

我们喜欢社区贡献！通过阅读我们的 [CONTRIBUTING.md](CONTRIBUTING.md) 开始。 
**文本尚未更新，如果您要贡献聊天组件部分 请勿提交到上游的 Roo Code 仓库，为 Roo Code 项目造成困扰**

---

## 许可证

[Apache 2.0 © 2025 Roo Code, Inc. & Andrea Frederica](./LICENSE)

---

**享受 Anh Chat！** 无论您是让它保持简单的编码助手，还是让它成为您的专属聊天伙伴，我们都迫不及待地想看到您的创作。如果您有问题或功能想法，请访问我们的 [GitHub Discussions](https://github.com/AndreaFrederica/andrea-novel-helper/discussions)。愉快编码和聊天！

---

## 贡献者

感谢所有帮助改进 Roo Code 和 Anh Chat 的贡献者！
没有Roo Code 就没有Anh Chat。

<!-- START CONTRIBUTORS SECTION - AUTO-GENERATED, DO NOT EDIT MANUALLY -->

[![Contributors](https://contrib.rocks/image?repo=AndreaFrederica/Roo-Code-Chat&max=120&columns=12&cacheBust=0000000000)](https://github.com/AndreaFrederica/Roo-Code-Chat/graphs/contributors)

<!-- END CONTRIBUTORS SECTION -->