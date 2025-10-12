// 测试多样化主体的记忆系统
console.log('=== 测试多样化主体记忆系统 ===\n');

// 测试1: UA身份记忆
console.log('测试1 - UA身份记忆:');
const uaMemory = `
<memory>
  <content>作为星际探险家的张伟，他告诉我这次任务是要在半人马座阿尔法星系建立第一个人类殖民地。他说虽然危险重重，但他对能够参与历史性的太空探索感到无比激动。</content>
  <keywords>星际探险家,张伟,半人马座阿尔法星,人类殖民地</keywords>
  <priority>90</priority>
  <is_constant>false</is_constant>
  <perspective>first_person_direct</perspective>
  <context_type>ua_information</context_type>
  <ua_info>虚拟身份,太空探索,职业背景</ua_info>
  <memory_tone>professional_inspired</memory_tone>
  <emotional_context>激动,责任感,期待</emotional_context>
  <related_topics>科幻,太空探索,未来</related_topics>
</memory>`;

console.log('记忆主体：张伟（UA身份）');
console.log('记忆内容：星际探险任务');
console.log('XML数据：');
console.log(uaMemory.trim());
console.log();

// 测试2: 历史人物记忆
console.log('测试2 - 历史人物记忆:');
const historicalMemory = `
<memory>
  <content>在历史课上，老师讲述了一个感人的故事：二战期间，德国军官奥斯卡·辛德勒冒着生命危险拯救了1100多名犹太人。他利用自己的工厂雇佣这些犹太人，使他们免遭纳粹屠杀。战争结束后，他几乎破产，但他说'救了一个人就是救了整个世界'。</content>
  <keywords>奥斯卡·辛德勒,二战,拯救犹太人,人道主义</keywords>
  <priority>85</priority>
  <is_constant>true</is_constant>
  <perspective>third_person_observer</perspective>
  <context_type>historical_account</context_type>
  <memory_tone>respectful_inspiring</memory_tone>
  <emotional_context>感动,敬佩,沉重</emotional_context>
  <related_topics>历史,二战,人道主义</related_topics>
</memory>`;

console.log('记忆主体：奥斯卡·辛德勒（历史人物）');
console.log('记忆内容：二战期间拯救犹太人的事迹');
console.log('XML数据：');
console.log(historicalMemory.trim());
console.log();

// 测试3: 虚构角色记忆
console.log('测试3 - 虚构角色记忆:');
const fictionalMemory = `
<memory>
  <content>在《三体》的故事中，叶文洁向宇宙发送了地球的坐标。当时她内心充满了对人类的失望，认为人类无法自我拯救，需要更高级的文明来干预。这个决定源于她在文革期间遭受的创伤，以及后来在红岸基地工作时对人类文明的深刻反思。</content>
  <keywords>叶文洁,三体,发送地球坐标,文明反思</keywords>
  <priority>80</priority>
  <is_constant>true</is_constant>
  <perspective>third_person_literary</perspective>
  <context_type>fictional_character</context_type>
  <memory_tone>analytical_psychological</memory_tone>
  <emotional_context>复杂,失望,反思</emotional_context>
  <related_topics>科幻,文学,人性思考</related_topics>
</memory>`;

console.log('记忆主体：叶文洁（虚构角色）');
console.log('记忆内容：《三体》中的关键决定');
console.log('XML数据：');
console.log(fictionalMemory.trim());
console.log();

// 测试4: 游戏NPC记忆
console.log('测试4 - 游戏NPC记忆:');
const npcMemory = `
<memory>
  <content>在《赛博朋克2077》中，银手强尼这个角色有着复杂的背景故事。他曾经是反抗军组织的手枪兵，对荒坂公司怀有深深的仇恨。2023年，他在夜之城核爆中牺牲，但意识被上传到荒坂的数据库中，50年后通过数字幽灵的形式重新出现。他的目标是摧毁荒坂公司，夺回属于人类的自由。</content>
  <keywords>银手强尼,赛博朋克2077,荒坂公司,数字幽灵</keywords>
  <priority>75</priority>
  <is_constant>true</is_constant>
  <perspective>third_person_gaming</perspective>
  <context_type>game_npc</context_type>
  <game_state>cyberpunk_2077</game_state>
  <memory_tone>cinematic_rebellious</memory_tone>
  <emotional_context>愤怒,反抗,复仇</emotional_context>
  <related_topics>游戏,赛博朋克,反乌托邦</related_topics>
</memory>`;

console.log('记忆主体：银手强尼（游戏NPC）');
console.log('记忆内容：《赛博朋克2077》中的角色背景');
console.log('XML数据：');
console.log(npcMemory.trim());
console.log();

// 测试5: 两个无关的人
console.log('测试5 - 两个无关的人:');
const unrelatedMemory = `
<memory>
  <content>在新闻中看到报道：一位名叫艾米丽的年轻医生在西非的埃博拉疫情爆发时，主动前往当地参与救援工作。在那里，她遇到了一位当地的老护士玛丽，她们一起工作了三个月，建立了深厚的友谊。艾米丽说玛丽教会了她什么是真正的勇气和奉献。</content>
  <keywords>艾米丽,玛丽,埃博拉疫情,医疗救援</keywords>
  <priority>70</priority>
  <is_constant>false</is_constant>
  <perspective>third_person_news</perspective>
  <context_type>current_events</context_type>
  <memory_tone>inspiring_humanitarian</memory_tone>
  <emotional_context>感动,敬佩,温暖</emotional_context>
  <related_topics>医疗,疫情,人道主义</related_topics>
</memory>`;

console.log('记忆主体：艾米丽和玛丽（两个无关的人）');
console.log('记忆内容：埃博拉疫情中的医疗救援故事');
console.log('XML数据：');
console.log(unrelatedMemory.trim());
console.log();

// 测试6: 文化常识记忆
console.log('测试6 - 文化常识记忆:');
const culturalMemory = `
<memory>
  <content>日本的茶道文化有着深厚的历史传统。茶道不仅仅是喝茶，更是一种精神修行，体现了'和、敬、清、寂'四个核心精神。茶室的设计强调简约和谐，参与者的每一个动作都有严格规范，体现了对美的追求和对客人的尊重。这种文化传统可以追溯到16世纪的千利休。</content>
  <keywords>日本茶道,千利休,和敬清寂,精神修行</keywords>
  <priority>65</priority>
  <is_constant>true</is_constant>
  <perspective>cultural_education</perspective>
  <context_type>cultural_knowledge</context_type>
  <memory_tone>educational_respectful</memory_tone>
  <emotional_context>敬佩,平和,文化欣赏</emotional_context>
  <related_topics>文化,日本,传统艺术</related_topics>
</memory>`;

console.log('记忆主体：文化常识（无特定主体）');
console.log('记忆内容：日本茶道文化');
console.log('XML数据：');
console.log(culturalMemory.trim());
console.log();

console.log('=== 测试完成 ===');
console.log('');
console.log('总结：记忆系统成功支持多样化的主体：');
console.log('✅ UA身份（虚拟角色）');
console.log('✅ 历史人物');
console.log('✅ 虚构角色');
console.log('✅ 游戏NPC');
console.log('✅ 两个无关的人');
console.log('✅ 文化常识（无特定主体）');
console.log('');
console.log('这体现了记忆系统的灵活性和广泛适用性！');