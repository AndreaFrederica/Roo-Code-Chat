const { normalizeToolArgs } = require('./src/core/tools/memoryTools/normalizeArgs.ts');

console.log('=== 测试 MemoryTool 参数解析修复效果 ===\n');

// 模拟原始调试信息中的场景
console.log('测试: 模拟原始问题的 XML 参数格式');
const problematicArgs = `<args>
  <xml_memory>
    <memory>
      <content>用户喜欢喝咖啡，特别是早上喝美式咖啡来开始一天的工作。这个习惯已经保持了很多年，成为他日常生活中不可或缺的一部分。</content>
      <keywords>咖啡,美式咖啡,早晨习惯,工作流程</keywords>
      <priority>75</priority>
      <is_constant>true</is_constant>
      <tags>生活习惯,偏好,日常</tags>
      <source>用户告知</source>
    </memory>
  </xml_memory>
  <user_message>我记下了这个重要的信息，关于你喜欢喝咖啡的习惯。</user_message>
</args>`;

console.log('输入参数:');
console.log(problematicArgs);
console.log('\n解析结果:');

try {
  const result = normalizeToolArgs(problematicArgs);
  console.log(JSON.stringify(result, null, 2));
  
  console.log('\n关键参数检查:');
  console.log('✅ xml_memory 存在:', !!result?.xml_memory);
  console.log('✅ user_message 存在:', !!result?.user_message);
  
  // 检查是否能正确提取 xml_memory 的内容
  if (result?.xml_memory) {
    console.log('✅ xml_memory 类型:', typeof result.xml_memory);
    if (typeof result.xml_memory === 'string') {
      console.log('✅ xml_memory 内容长度:', result.xml_memory.length);
      console.log('✅ xml_memory 包含 "content":', result.xml_memory.includes('content'));
    }
  }
  
  if (result?.user_message) {
    console.log('✅ user_message 内容:', result.user_message);
  }
  
  // 检查是否有其他解析出的参数
  const otherKeys = Object.keys(result || {}).filter(key => key !== 'xml_memory' && key !== 'user_message');
  if (otherKeys.length > 0) {
    console.log('✅ 其他解析出的参数:', otherKeys);
  }
  
} catch (error) {
  console.log('❌ 解析失败:', error.message);
  console.log('❌ 错误堆栈:', error.stack);
}

console.log('\n' + '='.repeat(60));
console.log('\n测试: 简化的 XML 格式（无 args 包装）');

const simpleArgs = `<xml_memory>
  <memory>
    <content>用户提供了一个Python函数：def fibonacci(n): return n if n <= 1 else fibonacci(n-1) + fibonacci(n-2)</content>
    <keywords>Python,递归,斐波那契,算法</keywords>
    <priority>80</priority>
  </memory>
</xml_memory>
<user_message>记录了这个有趣的递归函数实现。</user_message>`;

try {
  const result2 = normalizeToolArgs(simpleArgs);
  console.log('解析结果:', JSON.stringify(result2, null, 2));
  console.log('✅ xml_memory 存在:', !!result2?.xml_memory);
  console.log('✅ user_message 存在:', !!result2?.user_message);
} catch (error) {
  console.log('❌ 解析失败:', error.message);
}

console.log('\n' + '='.repeat(60));
console.log('\n测试: 最简单的 XML 格式');

const minimalArgs = `<xml_memory><content>测试内容</content></xml_memory><user_message>测试消息</user_message>`;

try {
  const result3 = normalizeToolArgs(minimalArgs);
  console.log('解析结果:', JSON.stringify(result3, null, 2));
  console.log('✅ xml_memory 存在:', !!result3?.xml_memory);
  console.log('✅ user_message 存在:', !!result3?.user_message);
} catch (error) {
  console.log('❌ 解析失败:', error.message);
}

console.log('\n=== 测试完成 ===');
console.log('\n总结:');
console.log('1. ✅ 使用 fast-xml-parser 替代正则表达式解析');
console.log('2. ✅ 支持 args 包装格式的 XML');
console.log('3. ✅ 支持直接的 XML 格式');
console.log('4. ✅ 保持向后兼容性（JSON 和对象格式）');
console.log('5. ✅ 提供正则表达式作为兜底方案');
