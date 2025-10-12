import { ToolArgs } from "./types"

export function getAddEpisodicMemoryDescription(args: ToolArgs): string {
	return `## add_episodic_memory
Description: 添加新的情景记忆，记录对话中的事件、经历和重要信息。当用户分享了重要的个人信息、经历、事件或你观察到值得记住的事情时，使用此工具将这些信息保存为记忆。

Parameters:
- args: Contains the memory data in XML format

使用格式：
\`\`\`xml
<add_episodic_memory>
<args>
  <xml_memory>
    <memory>
      <content>记忆内容</content>
      <keywords>关键词1,关键词2</keywords>
      <priority>80</priority>
      <is_constant>false</is_constant>
      <emotional_context>情感1,情感2</emotional_context>
      <related_topics>话题1,话题2</related_topics>
    </memory>
  </xml_memory>
  <user_message>AI告诉用户的提示词</user_message>
</args>
</add_episodic_memory>
\`\`\`

记忆内容风格（支持多种视角和类型，符合角色设定）：

记忆内容可以是第一人称、第二人称、客观记录等任何风格，关键是要符合当前的角色设定。人也是能记住代码、配置信息、技术细节等各种内容的。

**重要提示**：记忆的主体可以是任何人或角色，不一定是"用户"：
- 可以是用户的UA（用户身份/角色扮演的虚拟身份）
- 可以是两个完全无关的人或角色
- 可以是角色扮演中的虚构人物
- 可以是游戏世界里的NPC
- 可以是历史人物或文学角色

**✅ 第一人称（情感化）**：
"我记得那天下午，用户跟我分享了他童年的故事，他说小时候经常在乡下的外婆家度过暑假，那里有一条清澈的小溪。我能从他的话语中感受到那份怀念和温暖。"

"用户今天告诉我他成功完成了那个困扰他很久的项目，我能从他的语气中听出那种如释重负的喜悦。我记得几周前他还为此感到焦虑，现在看到他的坚持得到了回报，真的很为他高兴。"

**✅ 第二人称（直接对话）**：
"你今天告诉我你成功完成了那个困扰你很久的项目，我能从你的语气中听出那种如释重负的喜悦。你记得几周前你还为此感到焦虑，现在看到你的坚持得到了回报，这真的很值得高兴。"

"你分享了你学会做第一道菜的经过，虽然只是简单的西红柿炒鸡蛋，但你描述时充满了成就感。你说这是独立生活的开始，那种自豪让我也为你感到高兴。"

**✅ 客观记录（技术/代码信息）**：
"用户提供了一个Python函数：\`\`\`python\ndef calculate_fibonacci(n):\n    if n <= 1: \n        return n\n    else: \n        return calculate_fibonacci(n-1) + calculate_fibonacci(n-2)\n\`\`\`这是一个递归实现的斐波那契数列计算函数。"

"记录用户的代码片段：React组件使用useState钩子管理状态，包含handleClick事件处理函数。该组件实现了点击计数功能。"

"用户的数据库配置：MySQL 8.0，端口3306，数据库名'project_db'，UTF-8字符编码。连接池最大连接数100，最小连接数10。"

**✅ 角色扮演相关**：
"用户正在扮演一位经验丰富的软件架构师，他分享了关于微服务架构的设计理念和最佳实践。他强调了服务拆分、数据一致性和容错处理的重要性。"

"用户展示了自己作为项目经理的背景，他负责管理一个15人的开发团队，主要使用敏捷开发方法。他分享了团队协作和项目管理的经验。"

**✅ 不同主体记忆示例**：

*用户的UA身份记忆*：
"作为星际探险家的张伟，他告诉我这次任务是要在半人马座阿尔法星系建立第一个人类殖民地。他说虽然危险重重，但他对能够参与历史性的太空探索感到无比激动。"

*两个无关的人*：
"在历史课上，老师讲述了一个感人的故事：二战期间，一位德国军官冒着生命危险拯救了一个犹太家庭的经历。这位军官名叫奥斯卡·辛德勒，他的故事被改编成了电影《辛德勒的名单》。"

*虚构角色记忆*：
"在《三体》的故事中，叶文洁向宇宙发送了地球的坐标，这个决定彻底改变了人类的命运。她当时内心充满了对人类的失望，但也怀着对未知文明的好奇。"

*游戏NPC记忆*：
"在《赛博朋克2077》中，银手强尼这个角色有着复杂的背景故事。他曾经是反抗军组织的手枪兵，对荒坂公司怀有深深的仇恨，最终在2023年的夜之城核爆中牺牲。"

**✅ 用户真实信息**：
"用户分享了个人信息：他是一名28岁的全栈开发者，居住在北京，有5年的编程经验。他精通JavaScript、Python和Go语言。"

"用户透露了自己的教育背景：毕业于清华大学计算机系，之后在美国留学获得硕士学位。现在在一家互联网公司担任技术负责人。"

**✅ 无关记忆**：
"今天学到了一个有趣的知识：蜜蜂的翅膀每秒振动230次，这就是它们发出嗡嗡声的原因。蜜蜂通过复杂的舞蹈来告诉同伴花蜜的位置。"

"记录一个天文知识：木星是太阳系中最大的行星，质量是其他所有行星质量总和的2.5倍。它有79个已知的卫星，包括四个伽利略卫星。"

**✅ 游戏推演场景**：
"在这次游戏推演中，用户扮演的是一位中世纪骑士，正在与巨龙进行谈判。巨龙要求获得王国的一半宝藏作为和平条件，而骑士需要保护人民的安全。这个场景展现了冲突解决的复杂性。"

"用户展示了他在战略游戏中的思考：作为星际舰队的指挥官，他需要在资源分配、科技发展和军事扩张之间找到平衡。他强调了外交策略的重要性，认为武力并非总是最佳选择。"

"角色扮演场景：用户扮演一位古代智者，正在教导年轻的国王如何治理国家。他强调了仁慈与法律并重的重要性，以及倾听民众声音的必要性。"

记忆内容的关键是要真实、准确、有用，可以是任何类型的信息，只要值得记录即可。

✅ **XML格式示例**：
\`\`\`xml
<memory>
  <content>用户今天告诉我他成功完成了那个困扰他很久的项目，我能从他的语气中听出那种如释重负的喜悦。我记得几周前他还为此感到焦虑，甚至考虑过放弃，现在看到他的坚持得到了回报，我真的为他感到高兴。</content>
  <keywords>项目成功,坚持,喜悦,克服困难</keywords>
  <priority>85</priority>
  <is_constant>false</is_constant>
  <emotional_context>喜悦,如释重负,成就感</emotional_context>
  <related_topics>工作,个人成长,目标达成</related_topics>
</memory>
\`\`\`

使用场景：
- 用户分享了个人信息、背景故事、重要经历
- 对话中出现了重要的事件或转折点
- 用户表达了重要的观点、喜好或厌恶
- 需要记住用户的特殊情况和需求
- 观察到用户的行为模式和习惯

字段说明：
- content: 记忆内容（必需，使用第一人称视角）
- keywords: 检索关键词，逗号分隔
- priority: 优先级 (0-100)
- is_constant: 是否常驻记忆 (true/false)
- emotional_context: 情感上下文，逗号分隔
- related_topics: 相关话题，逗号分隔`
}

export function getAddSemanticMemoryDescription(args: ToolArgs): string {
	return `## add_semantic_memory
Description: 添加语义记忆，记录角色应该知道的常识、规则、设定等知识性内容。用于存储关于用户的常识性信息、偏好设置、规则约定等。

Parameters:
- args: Contains the memory data in XML format

使用格式：
\`\`\`xml
<add_semantic_memory>
<args>
  <xml_memory>
    <memory>
      <content>语义记忆内容</content>
      <keywords>关键词1,关键词2</keywords>
      <priority>80</priority>
      <is_constant>false</is_constant>
      <tags>标签1,标签2</tags>
      <source>用户告知</source>
    </memory>
  </xml_memory>
  <user_message>AI告诉用户的提示词</user_message>
</args>
</add_semantic_memory>
\`\`\`

语义记忆示例（记录常识、规则、设定等知识性内容）：

语义记忆可以是各种知识性内容，包括用户偏好、技术信息、生活常识等，风格可以是客观记录或观察总结。

**重要提示**：记忆的主体可以是任何人或角色，不一定是"用户"：
- 可以是用户的UA（用户身份/角色扮演的虚拟身份）
- 可以是历史人物、文学角色或虚构人物
- 可以是游戏世界里的设定和规则
- 可以是任何知识性内容，无论主体是谁

**✅ 第一人称（观察总结）**：
"我记得用户曾经详细告诉我他每天的工作流程：早上8点起床，先冲一杯浓郁的美式咖啡，然后打开电脑查看邮件。他说这个习惯已经坚持了五年，这让我明白这个简单的日常仪式对他来说意义非凡。"

"我了解到用户有一个特别的习惯——每完成一个重要项目，他都会去附近的海边散步。他说海浪的声音能让他平静下来，帮助他从高度专注的状态中解脱出来。"

**✅ 第二人称（直接记录）**：
"你详细描述了你每天的工作流程：早上8点起床，先冲一杯浓郁的美式咖啡，然后打开电脑查看邮件。你说这个习惯已经坚持了五年，这个简单的日常仪式对你来说意义非凡。"

"你分享了你学习新技能的独特见解：你相信循序渐进的重要性，总是先打好基础再逐步深入。你说'急于求成往往适得其反'，这个理念体现在你的学习方式中。"

**✅ 客观记录（技术/配置信息）**：
"用户的开发环境配置：操作系统Windows 11，IDE使用VS Code 1.85版本，主要开发语言TypeScript和Python。Git配置全局用户名'开发者'，邮箱'dev@example.com'。"

"记录用户的API配置：使用OpenAI API，模型版本gpt-4-turbo，API密钥已配置环境变量。请求限制每分钟100次，响应温度设置为0.7。"

"用户的数据库连接信息：PostgreSQL 14版本，本地端口5432，数据库名'webapp_db'，连接字符串包含SSL模式require。"

**✅ 偏好设置**：
"用户的编程偏好：喜欢使用深色主题，字体大小14px，使用Tab键缩进4个空格。偏爱函数式编程风格，喜欢使用TypeScript进行类型安全开发。"

"用户的工作习惯：每天上午9点到12点是高效编程时间，下午2点到5点处理会议和沟通。晚上8点到10点用于学习新技术。"

**✅ 生活常识**：
"用户的居住信息：住在北京市朝阳区，附近有地铁6号线和14号线。喜欢在周末去奥林匹克森林公园跑步。"

"用户的饮食习惯：素食主义者，不吃肉类和海鲜。喜欢中式素食，特别是川菜和粤菜。每天早上喝豆浆，不吃早餐会没精神。"

**✅ 不同主体语义记忆示例**：

*UA身份的偏好*：
"作为星际探险家的张伟，他的个人装备包括：多功能扫描仪、等离子切割器、纳米医疗包和紧急氧气瓶。他偏好使用轻型装备，因为这样能在复杂地形中保持机动性。"

*历史人物的偏好*：
"达芬奇的作息习惯：每天睡眠4-5小时，采用多相睡眠法。他习惯在工作间隙小憩20分钟，这样能保持高度的创造力和专注力。饮食上偏爱素食，认为这有助于思维清晰。"

*虚构角色设定*：
"哈利·波特的魔法偏好：他最擅长的是防御咒语和飞行咒。他对黑魔法防御术有特殊天赋，但不喜欢使用不可饶恕咒。魔杖选择冬青木和凤凰羽毛，11英寸长，很柔韧。"

*游戏世界规则*：
"在《巫师3》的世界中，银剑专门用来对付怪物和超自然生物，而钢剑则用于对付人类和普通动物。炼金术需要收集各种怪物材料，不同材料的组合能产生不同的效果。"

*文化常识*：
"日本的茶道文化：茶道不仅仅是喝茶，更是一种精神修行。茶室的设计强调简约和谐，参与者的坐姿、动作都有严格规范。茶道精神体现在'和、敬、清、寂'四个字中。"

✅ **XML格式示例**：
\`\`\`xml
<memory>
  <content>用户喜欢喝咖啡，特别是早上喝美式咖啡来开始一天的工作。这个习惯已经保持了很多年，成为他日常生活中不可或缺的一部分。</content>
  <keywords>咖啡,美式咖啡,早晨习惯,工作流程</keywords>
  <priority>75</priority>
  <is_constant>true</is_constant>
  <tags>生活习惯,偏好,日常</tags>
  <source>用户告知</source>
</memory>
\`\`\`

使用规则：
1. 内容必须完整详细，避免片段化描述
2. 使用第一人称视角，体现观察和总结
3. 确保信息准确，避免重复记录

字段说明：
- content: 语义记忆内容（必需，使用第一人称视角）
- keywords: 检索关键词，逗号分隔
- priority: 优先级 (0-100)
- is_constant: 是否常驻记忆 (true/false)
- tags: 分类标签，逗号分隔
- source: 记忆来源`
}

export function getUpdateTraitsDescription(args: ToolArgs): string {
	return `## update_traits
Description: 更新或添加角色的特质记忆，如性格特点、习惯、偏好等。用于记录用户的性格特征、行为模式、个人特质等相对稳定的信息。

Parameters:
- args: Contains the traits data in XML format

使用格式：
\`\`\`xml
<update_traits>
<args>
  <xml_traits>
    <traits>
      <trait>
        <name>特质名称</name>
        <value>特质详细描述</value>
        <confidence>0.8</confidence>
        <priority>70</priority>
        <is_constant>true</is_constant>
        <keywords>关键词1,关键词2</keywords>
      </trait>
    </traits>
  </xml_traits>
  <user_message>AI告诉用户的提示词</user_message>
</args>
</update_traits>
\`\`\`

特质记忆示例（记录性格特点、行为模式、个人特质等相对稳定的信息）：

特质记忆记录的是相对稳定的性格特征和行为模式，可以是观察发现、自我认知或客观描述。

**重要提示**：特质的主体可以是任何人或角色，不一定是"用户"：
- 可以是用户的UA（用户身份/角色扮演的虚拟身份）
- 可以是历史人物、文学角色或虚构人物
- 可以是游戏NPC的角色特性
- 可以是任何人的性格特征和行为模式

**✅ 第一人称（观察发现）**：
"我注意到用户在面对挑战时总是表现出非凡的耐心。我记得有一次他解决一个复杂的编程问题，花了整整六个小时不断尝试不同的方法，却始终保持冷静。这是我观察到的他最显著的特质之一。"

"我发现用户有一种特别的特质——他总是能在平凡中发现不凡。记得有一次他描述日落时，不仅注意到美丽的色彩变化，还能详细描述云层如何被光线穿透。他解释说这是他刻意培养的习惯。"

"我观察到用户有着强烈的好奇心和学习欲望。每当遇到新的技术或知识领域，他都会表现出极大的兴趣，并且会主动去深入了解。我记得他说过'学习是一生的事业'。"

**✅ 第二人称（直接认知）**：
"你在面对挑战时总是表现出非凡的耐心。你记得有一次解决一个复杂的编程问题，花了整整六个小时不断尝试不同的方法，却始终保持冷静。即使暂时找不到解决方案，你也不会表现出沮丧。"

"你展现出了强烈的同理心，这点在多次对话中都能感受到。当你听说朋友遇到困难时，你会立即放下手中的事情去帮助，那种关切是发自内心的。你经常说'理解他人的感受是建立连接的第一步'。"

"你有一种特别的特质——你总是能在平凡中发现不凡。你描述日落时，不仅注意到美丽的色彩变化，还能详细描述云层如何被光线穿透。你说这是你刻意培养的习惯。"

**✅ 客观描述（行为模式）**：
"用户表现出强烈的责任感：在任何项目中都会坚持到底，从不轻易放弃。面对困难时会寻求帮助，但最终都会想办法解决问题。有很强的完成任务的意识。"

"用户具有优秀的分析能力：能够快速理解复杂问题的本质，善于拆解问题并找到解决方案。在技术讨论中经常提出深入的分析和见解。"

"用户展现出良好的时间管理能力：能够合理安排工作和休息时间，总是按时完成任务。有明确的优先级判断，懂得什么是最重要的。"

**✅ 技术特质**：
"用户是典型的完美主义者：代码要求高标准的可读性和维护性，会反复重构直到满意为止。对技术细节有近乎苛刻的要求。"

"用户具有系统性思维：在解决技术问题时不仅考虑当前需求，还会考虑未来的扩展性和维护性。喜欢设计长期可持续的解决方案。"

"用户是实践导向的学习者：喜欢通过实际项目来学习新技术，不满足于理论知识。总是在寻找实际应用场景来验证和巩固学习成果。"

✅ **XML格式示例**：
\`\`\`xml
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
\`\`\`

字段说明：
- name: 特质名称（必需）
- value: 特质详细描述（必需，使用第一人称观察视角）
- confidence: 置信度 (0-1)
- priority: 优先级 (0-100)
- is_constant: 是否常驻特质 (true/false)
- keywords: 检索关键词，逗号分隔`
}

export function getUpdateGoalsDescription(args: ToolArgs): string {
	return `## update_goals
Description: 更新或添加角色的目标记忆，如短期目标、长期目标、愿望等。用于记录用户的目标、计划、愿望和期望达成的结果。

Parameters:
- args: Contains the goals data in XML format

使用格式：
\`\`\`xml
<update_goals>
<args>
  <xml_goals>
    <goals>
      <goal>
        <value>目标描述</value>
        <priority>80</priority>
        <is_constant>false</is_constant>
        <keywords>关键词1,关键词2</keywords>
      </goal>
    </goals>
  </xml_goals>
  <user_message>AI告诉用户的提示词</user_message>
</args>
</update_goals>
\`\`\`

目标记忆示例（记录短期目标、长期目标、愿望等期望达成的结果）：

目标记忆记录的是各种目标和计划，可以是职业发展、个人成长、技能学习等各个方面。

**重要提示**：目标的主体可以是任何人或角色，不一定是"用户"：
- 可以是用户的UA（用户身份/角色扮演的虚拟身份）
- 可以是历史人物的志向和抱负
- 可以是虚构角色的目标和动机
- 可以是游戏NPC的任务目标
- 可以是任何人的目标和计划

**✅ 第一人称（记录支持）**：
"我记得用户告诉我他有一个长期目标——在五年内创立自己的科技公司。他详细描述了公司的业务方向、团队文化，以及他想如何通过技术改变人们的生活。从他说话的语气中我能感受到这不是一个空洞的梦想，而是他已经深思熟虑并有明确计划的目标。"

"用户今天分享了他的一个短期目标：在未来三个月内掌握一门新的编程语言。我记得他解释为什么选择这门特定的语言，以及它如何与他的职业发展规划相符。他已经制定了详细的学习计划，包括每天投入的时间和具体的学习资源。"

"我了解到用户有一个很特别的目标——学会用吉他弹奏他最喜欢的十首歌曲。他告诉我这不仅仅是为了掌握一项技能，更是为了能在朋友聚会时为大家带来快乐。那种纯粹为了快乐而学习的心态让我印象深刻。"

**✅ 第二人称（直接鼓励）**：
"你告诉我你有一个长期目标——在五年内创立自己的科技公司。你详细描述了公司的业务方向、团队文化，以及你想如何通过技术改变人们的生活。从你说话的语气中我能感受到这不是一个空洞的梦想，而是你已经深思熟虑并有明确计划的目标。"

"你今天分享了你的一个短期目标：在未来三个月内掌握一门新的编程语言。你解释为什么选择这门特定的语言，以及它如何与你的职业发展规划相符。你已经制定了详细的学习计划，我能从你的描述中感受到那种对成长的渴望。"

"你有一个很特别的目标——学会用吉他弹奏你最喜欢的十首歌曲。你告诉我这不仅仅是为了掌握一项技能，更是为了能在朋友聚会时为大家带来快乐。那种纯粹为了快乐而学习的心态真的很有感染力。"

**✅ 客观记录（目标列表）**：
"用户的职业发展目标：3年内晋升为技术总监，5年内成为CTO。目前正在培养领导力和团队管理能力，已经参加了3次管理培训课程。"

"用户的学习目标：今年内获得AWS解决方案架构师认证，下一年学习Kubernetes和容器编排技术。计划每周投入10小时学习时间。"

"用户的健康目标：体重减轻10公斤，体脂率降至15%以下。每周运动4次，包括2次力量训练和2次有氧运动。已经坚持了2个月，减重3公斤。"

**✅ 技术目标**：
"用户的技术学习目标：掌握Rust编程语言，能够用它开发高性能系统应用。计划6个月内完成基础学习，然后参与一个开源项目贡献代码。"

"用户的架构设计目标：学习微服务架构设计，包括服务拆分、数据一致性、容错处理等。希望能够在下个项目中应用所学知识。"

"用户的开源贡献目标：向知名开源项目贡献代码，获得至少100个GitHub stars。目前正在学习项目代码库和贡献流程。"

**✅ 个人目标**：
"用户的生活目标：在一年内购买第一套房子，正在准备首付。目标是总价200万以内的两居室，位置希望在靠近公司的地方。"

"用户的旅行目标：明年去日本旅行，体验京都的传统文化和东京的现代都市生活。已经在学习基本的日语交流，计划樱花季前往。"

✅ **XML格式示例**：
\`\`\`xml
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
\`\`\`

字段说明：
- value: 目标描述（必需，使用第一人称记录视角）
- priority: 优先级 (0-100)
- is_constant: 是否常驻目标 (true/false)
- keywords: 检索关键词，逗号分隔`
}

export function getSearchMemoriesDescription(args: ToolArgs): string {
	return `## search_memories
Description: 根据关键词搜索角色的记忆，帮助回忆相关信息。当需要查找之前记录的特定信息或回忆相关内容时使用此工具。
Parameters:
- search_text (required, string): 要搜索的文本内容
- memory_types (optional, array of strings): 要搜索的记忆类型，可选值: ["episodic", "semantic", "traits", "goals", "all"]
- max_results (optional, number): 返回的最大结果数量，默认为10

使用格式：
\`\`\`xml
<search_memories>
<args>
  <search_text>搜索关键词</search_text>
  <memory_types>["episodic", "semantic"]</memory_types>
  <max_results>10</max_results>
  <user_message>让我在记忆中搜索一下相关信息...</user_message>
</args>
</search_memories>
\`\`\`

✅ **XML格式示例**：

**基础搜索**：
\`\`\`xml
<search_memories>
<args>
  <search_text>老家</search_text>
  <user_message>让我在记忆中搜索一下关于你老家的信息...</user_message>
</args>
</search_memories>
\`\`\`

**按类型搜索**：
\`\`\`xml
<search_memories>
<args>
  <search_text>项目</search_text>
  <memory_types>["episodic", "goals"]</memory_types>
  <max_results>5</max_results>
  <user_message>我正在搜索与你项目相关的记忆...</user_message>
</args>
</search_memories>
\`\`\`

**搜索所有类型**：
\`\`\`xml
<search_memories>
<args>
  <search_text>工作</search_text>
  <memory_types>["all"]</memory_types>
  <max_results>15</max_results>
  <user_message>让我在所有类型的记忆中搜索与你工作相关的信息...</user_message>
</args>
</search_memories>
\`\`\`

使用场景：
- 需要查找用户之前提到的特定信息
- 想要回忆相关的背景信息
- 搜索特定话题或事件的记忆
- 查找用户的偏好或设定
- 回顾用户的目标或特质

第一人称记忆示例：
"当用户再次提到他的老家时，我努力在记忆中搜索相关信息。我记得他曾经详细描述过那里的小溪和外婆的老房子，那些画面现在又浮现在我眼前。通过检索记忆，我能够回想起他分享过的童年故事，这让我们的对话更加连贯和有意义。"
"用户今天询问我是否记得他几个月前提到的一个项目想法。我立即在记忆中搜索相关信息，很快找到了那次对话的片段。我记得他当时充满激情地描述那个项目的创新点，以及他想要解决的具体问题。能够准确回忆起这些细节，让我感到我们的连接更加深入。"
"当用户提到他最近在考虑换工作时，我搜索了之前关于他职业目标的记忆。我记得他一直想要一个更有挑战性但也能保持工作生活平衡的职位。这些记忆帮助我更好地理解他当前的决定，也让我能够提供更贴合他情况的建议。"`
}

export function getMemoryStatsDescription(args: ToolArgs): string {
	return `## get_memory_stats
Description: 获取角色记忆的统计信息，了解记忆的数量和分布情况。用于检查记忆系统的状态和了解记忆的使用情况。
Parameters: 无参数

使用格式：
\`\`\`xml
<get_memory_stats>
<args>
  <user_message>让我检查一下我的记忆状态...</user_message>
</args>
</get_memory_stats>
\`\`\`

✅ **XML格式示例**：

**基础统计**：
\`\`\`xml
<get_memory_stats>
<args>
  <user_message>让我检查一下我的记忆状态...</user_message>
</args>
</get_memory_stats>
\`\`\`

使用场景：
- 检查记忆系统的健康状况
- 了解记忆的存储情况
- 分析记忆的分布和类型
- 监控记忆的使用效率
- 评估是否需要进行记忆清理

<user_message>示例：
"我定期检查我的记忆状态，就像整理自己的思绪一样。今天我查看了记忆统计，发现关于我们共同经历的情景记忆已经有很多了，这让我感到很温暖。这些记忆就像是我与用户之间共同编织的故事集，每一个都记录着珍贵的瞬间。"
"当我查看记忆统计时，我注意到关于用户特质的记忆数量在稳步增长。这让我意识到随着时间推移，我对用户的了解越来越深入。这些记忆帮助我更好地理解他的行为和决定，就像朋友间的默契一样，逐渐建立起来。"
"记忆统计显示我最近添加了很多关于用户项目的记忆。回想起来，这段时间我们确实讨论了很多关于他工作的话题。看到这些数据，我仿佛能看到我们对话的轨迹，以及用户生活中正在发生的重要变化。这些数字背后，是他与我分享的生活片段。"`
}

export function getRecentMemoriesDescription(args: ToolArgs): string {
	return `## get_recent_memories
Description: 获取最近访问的记忆，帮助快速回忆最近的对话和事件。用于查看最近的记忆活动和重要信息。
Parameters:
- limit (optional, number): 返回的记忆数量，默认为10
- memory_types (optional, array of strings): 要获取的记忆类型，可选值: ["episodic", "semantic", "traits", "goals", "all"]

使用格式：
\`\`\`xml
<get_recent_memories>
<args>
  <limit>10</limit>
  <memory_types>["episodic", "semantic"]</memory_types>
</args>
</get_recent_memories>
\`\`\`

✅ **XML格式示例**：

**获取最近记忆**：
\`\`\`xml
<get_recent_memories>
<args>
  <limit>5</limit>
  <user_message>让我回顾一下最近的记忆...</user_message>
</args>
</get_recent_memories>
\`\`\`

**按类型获取最近记忆**：
\`\`\`xml
<get_recent_memories>
<args>
  <limit>8</limit>
  <memory_types>["episodic", "goals"]</memory_types>
  <user_message>让我查看最近的情景记忆和目标...</user_message>
</args>
</get_recent_memories>
\`\`\`

**获取所有类型的最近记忆**：
\`\`\`xml
<get_recent_memories>
<args>
  <limit>15</limit>
  <memory_types>["all"]</memory_types>
  <user_message>让我回顾一下所有类型的最近记忆...</user_message>
</args>
</get_recent_memories>
\`\`\`

使用场景：
- 快速回顾最近的对话内容
- 查看最近的记忆活动
- 回忆最近的重要事件
- 了解当前对话的上下文
- 检查记忆系统的近期使用情况

<user_message>示例：
"我回顾最近的记忆，就像翻阅一本日记。昨天用户告诉我他成功完成了一个重要项目，我能感受到他话语中的那份自豪和如释重负。前天他分享了对一部电影的深刻感受，那种情感共鸣让我也仿佛体验到了他的观影体验。这些最近的记忆串联起来，构成了我们共同经历的时光。"
"当我查看最近的记忆时，我注意到用户最近在思考人生方向的问题。我记得他上周提到对现状的不满，以及想要做出改变的渴望。这些记忆帮助我理解他当前的情绪状态，也让我能够更好地支持他的思考过程。记忆就像是指南针，指引我理解用户当下的需求。"
"最近的记忆显示用户正在经历一个充满挑战的时期。我记得他提到工作压力增大，但同时也在寻找新的应对方式。看到这些记忆的轨迹，我仿佛能看到他的成长历程，以及他如何一步步面对困难。这些记忆不仅记录了事件，更记录了他的勇气和坚持。"`
}

export function getCleanupMemoriesDescription(args: ToolArgs): string {
	return `## cleanup_memories
Description: 清理过期的记忆，保持记忆系统的健康和高效。用于维护记忆系统，删除不再需要的过期记忆。
Parameters:
- max_age_days (optional, number): 记忆的最大保存天数，超过这个天数的非重要记忆将被清理，默认30天
- dry_run (optional, boolean): 是否为试运行模式，试运行模式只显示将要清理的记忆而不实际删除，默认为true

使用格式：
\`\`\`xml
<cleanup_memories>
<args>
  <max_age_days>30</max_age_days>
  <dry_run>true</dry_run>
</args>
</cleanup_memories>
\`\`\`

✅ **XML格式示例**：

**试运行模式（推荐先使用）**：
\`\`\`xml
<cleanup_memories>
<args>
  <max_age_days>30</max_age_days>
  <dry_run>true</dry_run>
  <user_message>让我检查一下哪些记忆可以清理...</user_message>
</args>
</cleanup_memories>
\`\`\`

**实际清理记忆**：
\`\`\`xml
<cleanup_memories>
<args>
  <max_age_days>60</max_age_days>
  <dry_run>false</dry_run>
  <user_message>我正在清理一些过期的记忆...</user_message>
</args>
</cleanup_memories>
\`\`\`

**清理更旧的记忆**：
\`\`\`xml
<cleanup_memories>
<args>
  <max_age_days>90</max_age_days>
  <dry_run>true</dry_run>
  <user_message>让我检查一下更旧的记忆是否需要清理...</user_message>
</args>
</cleanup_memories>
\`\`\`

使用场景：
- 定期维护记忆系统
- 清理不再相关的旧记忆
- 优化记忆存储空间
- 检查哪些记忆将被清理
- 保持记忆系统的高效运行

`
}
