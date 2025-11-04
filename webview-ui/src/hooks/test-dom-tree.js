// 测试AST解析器并打印完整的DOM树
import { parseTextToAST } from '../components/common/ast-parser.ts'

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

// 递归打印AST节点树
function printASTNode(node, level = 0) {
  const indent = '  '.repeat(level)
  console.log(`${indent}├─ Node:`)
  console.log(`${indent}   type: "${node.type}"`)
  console.log(`${indent}   rawTag: "${node.rawTag || 'none'}"`)
  console.log(`${indent}   startPos: ${node.startPos}`)
  console.log(`${indent}   endPos: ${node.endPos}`)
  console.log(`${indent}   isComplete: ${node.isComplete}`)
  console.log(`${indent}   contentLength: ${node.content.length}`)
  console.log(`${indent}   content: "${node.content.substring(0, 200)}${node.content.length > 200 ? '...' : ''}"`)
  console.log(`${indent}   --- 完整内容开始 ---`)
  console.log(node.content)
  console.log(`${indent}   --- 完整内容结束 ---`)
  
  if (node.children && node.children.length > 0) {
    console.log(`${indent}   children (${node.children.length}):`)
    node.children.forEach(child => printASTNode(child, level + 2))
  }
  
  console.log('')
}

function testDOMTree() {
  console.log('=== AST DOM树测试 ===')
  
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
对雾雨魔理沙来说，这二十个俘虏就像二十袋成色不一的麦子。有些壮硕，能卖个好价钱；有些干瘪，只能当添头。但总归是一笔不错的买卖。石桥镇的治安官虽然吝啬得像只守着粮仓的老老鼠，可黑狼佣兵团的脑袋，每一个都实打实地挂着赏金。这笔钱足够鸦巢堡的兄弟们换上几件像样的皮甲，再痛饮几桶不掺水的麦酒了。

秋日的风带着灰林边境地特有的微凉，吹拂着道路两旁的橡树叶，发出干燥的沙沙声。空气中弥漫着泥土和腐叶混合的气息，这是收获与凋零并存的味道。雾雨魔理沙骑在马上，不紧不慢地跟在队伍旁边，眼神像鹰一样扫视着这些垂头丧气的"麦子"。他们身上伪装用的粗布村民服饰已经被扒得七七八八，露出了底下印有黑狼纹章的皮背心，铁证如山。

生意本该就这么简单明了，直到那个女孩的出现。

她就像一颗从贵族果园里滚落到乡间泥地上的白浆果，小巧，饱满，散发着与这片贫瘠土地格格不入的甜香。她从林间小径里钻出来，身上那件圣洁的白色长袍在一众灰扑扑的颜色里扎眼得厉害。袍子的款式很奇怪，庄重中透着一种毫不设防的暴露，高高的开叉下，裹着白丝的肉感大腿若隐若现，随着步伐轻轻晃动，像挂在枝头等待采摘的果实。

当她那双像受惊小鹿一样的棕色眼睛望过来时，被绳子捆成一串的佣兵们立刻嗅到了机会。

"圣女大人！救救我们！"为首的那个佣兵最先喊了起来，他脸上恰到好处地挤出悲愤与无助，"我们是橡木村的村民啊！只是想去镇上卖点山货，就被这个恶匪给抓起来了！"

哭喊声此起彼伏，仿佛他们真的是一群被恶龙掳掠的无辜者。

女孩，也就是橡木村那位小有名气的圣女白秋眠，果然停下了脚步。她的目光在雾雨魔理沙冷漠的脸和佣兵们"真挚"的表演之间来回移动，小巧的鼻翼微微翕动，似乎在分辨空气中谎言的浓度。

"你…你们真的是橡木村的村民吗？"她开口了，声音带着很重的鼻音，软糯得像刚出炉的面包。

"是啊是啊！我们都是土生土长的村民！"

白秋眠信了。她那纯净得不起一丝波澜的眼神转向雾雨魔理沙，里面充满了恳求。"这位…大人，他们都是好人，您能不能…放了他们？"

雾雨魔理沙几乎要被气笑了。他见过蠢的，没见过这么离谱的。这就像一个商人分不清劣质的黑麦和优质的小麦一样不可理喻。他跳下马，走到她面前，巨大的身高差让她不得不仰起那张肉乎乎的可爱脸蛋。

"好人？圣女小姐，你的虔诚难道没有让你获得分辨善恶的智慧吗？看看他们身上的纹身，黑狼佣兵团，一群靠劫掠和杀戮为生的豺狼。"

白秋眠的视线顺着他的指引看去，看到了那些狰狞的狼头纹章，小脸瞬间变得煞白。但她没有退缩，反而向前走了一小步，用她那娇小的身躯挡在了俘虏和雾雨魔理沙之间。

"就算…就算他们犯过错，神也会原谅他们的…求求您，给他们一个机会吧！"

看着她那副"我就是要保护他们"的固执模样，一种混合着烦躁和恶劣玩笑的情绪涌上了雾雨魔理沙的心头。他打量着她，从那双含着泪水的大眼睛，到微微隆起的胸口，再到白丝包裹下的丰腴腿线。这具娇小而柔软的身体，本身就是一件价值连城的商品。

"机会？"雾雨魔理沙嗤笑一声，刻意压低了声音，用只有他们两人能听到的音量说道，"可以啊。做生意嘛，讲究等价交换。这里有二十个人，每一个都值一笔钱。你想要我放了他们，也得拿出等价的东西来换。"

"我…我没有钱…"她的声音带着哭腔，像被雨淋湿的小动物，"但是…但是我可以为您祈祷，神会赐福给您的！"

"我不需要虚无缥缈的赐福，"雾雨魔理沙的嘴角勾起一抹残忍的弧度，"我就要你。跟我上一次床，我就放一个人。这里有二十个，你算算，总共需要多少次？"

空气仿佛凝固了。白秋眠彻底愣住了，她脸上的血色瞬间褪得一干二净，嘴唇哆嗦着，一个字也说不出来。那双纯洁的眼睛里写满了震惊、恐惧和屈辱。这笔交易，远远超出了她对这个世界的所有认知。

时间一分一秒地流逝，佣兵们还在低声哀求，风声如同魔鬼的低语。白秋眠的眼泪终于决堤，大颗大颗地从脸颊滑落，砸在胸前的圣徽上。她紧紧攥着拳头，指甲几乎要嵌进掌心的软肉里。她在祈祷，在天人交战。最终，她抬起泪眼朦胧的脸，看着雾雨魔理沙，那眼神里除了恐惧，还多了一丝为信仰献身的悲壮。

"……好。"她用尽全身力气，从喉咙里挤出这个字。声音轻得像羽毛，却重重地砸在了雾雨魔理沙的心上。

"我答应你。"

交易成立。

雾雨魔理沙挥手让手下解开了佣兵们的绳索，看着他们屁滚尿流地逃进森林。他没有再看身旁那个浑身颤抖的女孩一眼，只是翻身上马，冷冷地丢下一句："跟上。"

通往鸦巢堡的山路崎岖难行。白秋眠穿着那双秀气的小布鞋，深一脚浅一脚地跟在马后。她低着头，一言不发，只有偶尔从喉咙里溢出的、压抑的抽泣声证明着她的存在。没过多久，她细嫩的脚底就被粗粝的石子磨破了。每走一步，都像踩在针尖上。她的步伐越来越慢，脸色也愈发苍白。

雾雨魔理沙终于不耐烦地勒住了马。"喂，你打算走到天黑吗？"

她抬起头，满是泪痕的脸上写满了无助和痛苦，咬着嘴唇说不出话。

"啧。"雾雨魔理沙发出一声咂舌，从马上跳下来，走到她面前，不由分说地弯腰将她打横抱起，然后像扔一个麻袋一样甩到了自己的背上。

"呀！"白秋眠发出一声短促的惊呼，柔软的胸部和温热的小腹瞬间紧紧贴在了他宽阔的后背上。她整个人都僵住了，能清晰地闻到他身上传来的汗水、皮革与山野尘土混合的男性气息。这种前所未有的亲密接触让她的大脑一片空白，脸颊瞬间烫得能煎熟鸡蛋。

雾雨魔理沙没有理会她的反应，只是重新爬上马背，双腿一夹马腹，朝着山寨的方向走去。他能感觉到背上那具身体的柔软和轻盈，像一团温暖的云。

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

  console.log('测试文本长度:', complexText.length)
  
  try {
    // 使用AST解析器解析文本
    const astNodes = parseTextToAST(complexText, tagRules)
    
    console.log('\n=== AST DOM树结构 ===')
    console.log(`总节点数: ${astNodes.length}`)
    console.log('')
    
    // 打印每个顶级节点
    astNodes.forEach((node, index) => {
      console.log(`顶级节点 ${index + 1}:`)
      printASTNode(node, 1)
    })
    
    // 统计节点类型
    const nodeTypes = {}
    function countTypes(nodes) {
      nodes.forEach(node => {
        nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1
        if (node.children && node.children.length > 0) {
          countTypes(node.children)
        }
      })
    }
    countTypes(astNodes)
    
    console.log('=== 节点类型统计 ===')
    Object.entries(nodeTypes).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`)
    })
    
    // 检查关键节点
    const thinkingNodes = []
    const variableNodes = []
    
    function findNodes(nodes, type, targetArray) {
      nodes.forEach(node => {
        if (node.type === type) {
          targetArray.push(node)
        }
        if (node.children && node.children.length > 0) {
          findNodes(node.children, type, targetArray)
        }
      })
    }
    
    findNodes(astNodes, 'thinking', thinkingNodes)
    findNodes(astNodes, 'variables', variableNodes)
    
    console.log('\n=== 关键节点检查 ===')
    console.log(`思考节点数量: ${thinkingNodes.length}`)
    console.log(`变量节点数量: ${variableNodes.length}`)
    
    if (thinkingNodes.length > 0) {
      console.log('✅ 成功识别思考节点')
      thinkingNodes.forEach((node, i) => {
        console.log(`  思考节点 ${i + 1}: "${node.rawTag}" (内容长度: ${node.content.length})`)
      })
    } else {
      console.log('❌ 未能识别思考节点')
    }
    
    if (variableNodes.length > 0) {
      console.log('✅ 成功识别变量节点')
      variableNodes.forEach((node, i) => {
        console.log(`  变量节点 ${i + 1}: "${node.rawTag}" (内容长度: ${node.content.length})`)
        if (node.children && node.children.length > 0) {
          console.log(`    包含 ${node.children.length} 个子节点`)
        }
      })
    } else {
      console.log('❌ 未能识别变量节点')
    }
    
  } catch (error) {
    console.error('测试失败:', error)
  }
}

// 运行测试
testDOMTree()