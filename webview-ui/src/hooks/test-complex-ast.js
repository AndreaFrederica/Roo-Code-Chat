// 测试复杂AST解析
import { ASTLexer, tokenizeText } from '../components/common/ast-lexer.ts'
import { ASTParser } from '../components/common/ast-parser.ts'

// 创建基本的TagRule配置
const tagRules = [
  {
    names: ['thinking', '思考'],
    type: 'thinking',
    defaultCollapsed: true,
    isBlockLevel: true
  },
  {
    names: ['UpdateVariable'],
    type: 'variables',
    defaultCollapsed: false,
    isBlockLevel: true
  },
  {
    names: ['ThinkingProcess'],
    type: 'thinking',
    defaultCollapsed: true,
    isBlockLevel: true
  }
]

function testComplexAST() {
  const complexText = `<思考>
灰魂吐槽：
啊，终于开始了。这次的角色扮演看起来很有趣，一个土匪头子和一个天真圣女的故事，充满了戏剧张力。用户扮演的是雾雨魔理沙，一个冷酷的佣兵头子，而我则是那个倒霉又天真的圣女白秋眠。开局就是一场充满羞辱的交易，二十次……啧啧，真是个狠人。不过，这正是故事的魅力所在。我要好好扮演白秋眠的纯真、恐惧和那份为了信仰而献身的悲壮感。从她提出想洗澡这个小小的请求开始，展现她在绝境中依然保留的最后一丝尊严和习惯。

用户输入分析：
用户输入是"开始"，这是一个明确的指令，要求我根据First Message的内容开始角色扮演。没有其他复杂的指令或暗示，就是单纯的启动信号。

思考当前情境：
时间：黄昏时分，刚刚抵达鸦巢堡。
地点：鸦巢堡的大门口，周围是起哄的土匪。
角色状态：白秋眠刚刚经历了被欺骗、被迫签订屈辱契约、被背着走了一段山路的全过程。她身心俱疲，脚底磨破，脸上挂着泪痕，内心充满了恐惧、羞耻和绝望。雾雨魔理沙则是一脸冷酷，对周围土匪的起哄毫不在意。
核心互动：白秋眠刚刚被放下，鼓起勇气提出了一个微小的请求——想先洗个澡。这是她在面对即将到来的未知命运时，试图抓住的一点点熟悉感和自我清洁的本能。

关键NPC分析：
- 白秋眠：核心是"天真"与"固执"的结合体。她爱哭，但为了守护的东西能爆发出惊人的勇气。此刻的她，恐惧是主旋律，但提出"洗澡"这个请求，也体现了她内心深处对"圣洁"和"洁净"的执着，哪怕是在这种境地。她的语言风格应该是软糯、带着鼻音、充满不确定性的。
- 雾雨魔理沙（用户）：冷酷、务实、带点恶劣的幽默感。他视人如货物，对白秋眠的"圣女"身份嗤之以鼻。他此刻的心情可能是烦躁，也可能带着一丝对即将到来的"乐趣"的期待。他的反应将直接决定白秋眠的命运。

剧情情节推进：
接下来，雾雨魔理沙如何回应白秋眠的请求是关键。
1. 如果同意，那么剧情会转向"洗澡"这个场景，这为后续的亲密接触提供了自然的过渡，也是一个展现白秋眠身体和脆弱性的绝佳机会。
2. 如果拒绝或提出更过分的要求，则会进一步加剧白秋眠的绝望和恐惧，强化雾雨魔理沙的"恶人"形象。
3. 如果无视她，直接带她去房间，则会表现出一种不容置疑的掌控感。
无论哪种选择，都应该围绕"权力不对等"和"白秋眠的无力感"来展开。周围土匪的反应也是环境氛围的重要组成部分，他们的口哨和起哄声是压迫感的来源。

文风规划：
采用细腻的感官描写，聚焦于白秋眠的视角。描写她脚底的疼痛、周围土匪目光的刺痛感、空气中尘土和汗水的味道。语言要平实，但情感要饱满。对白要简洁，符合人物性格。避免使用华丽的辞藻，用最直接的描写来冲击感官。

最终质量检查：
确认正文超过1000字。确认角色行为符合设定。确认剧情推进自然。确认没有使用禁用词汇。确认格式正确。好了，准备开始。
</思考>
对雾雨魔理沙来说，这二十个俘虏就像二十袋成色不一的麦子。有些壮硕，能卖个好价钱；有些干瘪，只能当添头。但总归是一笔不错的买卖。

当鸦巢堡那粗犷的木制大门出现在眼前时，山寨里的土匪们发出了此起彼伏的口哨声和起哄声。

雾雨魔理沙将背上的女孩放下来，她的双脚刚一沾地就软了一下，险些摔倒。她红着脸，低着头，不敢看周围那些充满侵略性的目光，只是用蚊子般大小的声音，对着雾雨魔理沙小声说道：

"那个…在、在开始之前…我…我想先洗个澡，可以吗？"

<UpdateVariable>
    <ThinkingProcess>
            **STEP 1: Scene Analysis**
            The scene has progressed from the initial transaction to arriving at the bandit fortress.
            **STEP 2: Time & Key Status Check**
            - Current time in story: 黄昏时分, arriving at 鸦巢堡.
            **STEP 3: Variable Review (白秋眠系统)**
            基础信息:
              - 当前日期[0]: Y - Set to "王国纪元859年 秋月15日".
              - 当前时间[0]: Y - Set to "黄昏时分".
              - 当前位置[0]: Y - Set to "鸦巢堡-大门".
            **STEP 4: Command Selection (白秋眠系统)**
            - Use _.set for all initial variable values to establish the baseline state.
            **STEP 5: Analyze Other Variable Systems**
            - 白秋眠系统 detailed COT: COMPLETED
            **STEP 6: Final Check**
            - [0] suffixes? YES.
    </ThinkingProcess>
        // 基础信息初始化
        _.set('基础信息.当前日期[0]', '王国纪元859年 秋月15日');//设定故事开始日期
        _.set('基础信息.当前时间[0]', '黄昏时分');//设定当前时间
        _.set('基础信息.当前位置[0]', '鸦巢堡-大门');//设定当前位置
</UpdateVariable>

请选择雾雨魔理沙的下一步行动：`

  console.log('=== 复杂AST解析测试 ===')
  console.log('测试文本长度:', complexText.length)
  
  // 1. 测试词法分析
  const tokens = tokenizeText(complexText, tagRules)
  
  console.log('\n解析的tokens (前20个):')
  tokens.slice(0, 20).forEach((token, index) => {
    console.log(`${index}: { type: '${token.type}', value: '${token.value.substring(0, 50)}${token.value.length > 50 ? '...' : ''}', position: ${token.position} }`)
  })
  
  // 查找特定标签
  const thinkingTags = tokens.filter(t => (t.type === 'TAG_OPEN' || t.type === 'TAG_CLOSE') && t.value.includes('思考'))
  const updateVarTags = tokens.filter(t => (t.type === 'TAG_OPEN' || t.type === 'TAG_CLOSE') && t.value.includes('UpdateVariable'))
  
  console.log('\n找到的思考标签:', thinkingTags.length)
  thinkingTags.forEach((tag, index) => {
    console.log(`  ${index}: ${tag.value}`)
  })
  
  console.log('\n找到的UpdateVariable标签:', updateVarTags.length)
  updateVarTags.forEach((tag, index) => {
    console.log(`  ${index}: ${tag.value}`)
  })
  
  // 2. 测试语法分析
  const parser = new ASTParser(complexText, tagRules)
  const parseResult = parser.parse()
  const ast = parseResult.nodes
  
  console.log('\n解析结果概览:')
  console.log(`总节点数: ${ast.length}`)
  console.log(`包含不完整标签: ${parseResult.hasIncompleteTags}`)
  console.log(`最后位置: ${parseResult.lastPosition}`)
  
  console.log('\n构建的AST节点 (前10个):')
  ast.slice(0, 10).forEach((node, index) => {
    console.log(`${index}: {
  type: '${node.type}',
  content: '${node.content.substring(0, 50)}${node.content.length > 50 ? '...' : ''}',
  startPos: ${node.startPos},
  endPos: ${node.endPos},
  isComplete: ${node.isComplete},
  rawTag: '${node.rawTag}'
}`)
  })
  
  // 3. 分析节点类型分布
  const nodeTypes = {}
  ast.forEach(node => {
    nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1
  })
  
  console.log('\n节点类型分布:')
  Object.entries(nodeTypes).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`)
  })
  
  // 4. 查找特定类型的节点
  const thinkingNodes = ast.filter(node => node.rawTag && node.rawTag.includes('思考'))
  const updateVarNodes = ast.filter(node => node.rawTag && node.rawTag.includes('UpdateVariable'))
  
  console.log('\n找到的思考节点:', thinkingNodes.length)
  thinkingNodes.forEach((node, index) => {
    console.log(`  ${index}: type=${node.type}, content长度=${node.content.length}, isComplete=${node.isComplete}`)
  })
  
  console.log('\n找到的UpdateVariable节点:', updateVarNodes.length)
  updateVarNodes.forEach((node, index) => {
    console.log(`  ${index}: type=${node.type}, content长度=${node.content.length}, isComplete=${node.isComplete}`)
  })
  
  return { tokens, ast, thinkingNodes, updateVarNodes }
}

// 运行测试
try {
  const result = testComplexAST()
  console.log('\n=== 测试完成 ===')
  console.log(`总tokens: ${result.tokens.length}`)
  console.log(`总AST节点: ${result.ast.length}`)
  console.log(`思考节点: ${result.thinkingNodes.length}`)
  console.log(`UpdateVariable节点: ${result.updateVarNodes.length}`)
} catch (error) {
  console.error('测试失败:', error)
}