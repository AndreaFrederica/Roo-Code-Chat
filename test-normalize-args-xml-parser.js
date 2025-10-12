const { normalizeToolArgs } = require('./src/core/tools/memoryTools/normalizeArgs.ts');

console.log('=== 测试 normalizeToolArgs XML 解析功能 ===\n');

// 测试用例 1: 基本的 XML 格式
console.log('测试 1: 基本 XML 格式');
const test1 = `<xml_memory>
  <memory>
    <content>用户喜欢喝咖啡，特别是早上喝美式咖啡来开始一天的工作。</content>
    <keywords>咖啡,美式咖啡,早晨习惯</keywords>
    <priority>75</priority>
    <is_constant>true</is_constant>
  </memory>
</xml_memory>
<user_message>我记下了这个重要的信息</user_message>`;

try {
  const result1 = normalizeToolArgs(test1);
  console.log('结果:', JSON.stringify(result1, null, 2));
  console.log('✅ xml_memory 存在:', !!result1?.xml_memory);
  console.log('✅ user_message 存在:', !!result1?.user_message);
} catch (error) {
  console.log('❌ 错误:', error.message);
}

console.log('\n' + '='.repeat(50) + '\n');

// 测试用例 2: 更简单的 XML 格式
console.log('测试 2: 简单 XML 格式');
const test2 = `<xml_memory><content>简单的测试内容</content><keywords>测试</keywords></xml_memory>
<user_message>简单的用户消息</user_message>`;

try {
  const result2 = normalizeToolArgs(test2);
  console.log('结果:', JSON.stringify(result2, null, 2));
  console.log('✅ xml_memory 存在:', !!result2?.xml_memory);
  console.log('✅ user_message 存在:', !!result2?.user_message);
} catch (error) {
  console.log('❌ 错误:', error.message);
}

console.log('\n' + '='.repeat(50) + '\n');

// 测试用例 3: 带属性的 XML
console.log('测试 3: 带属性的 XML');
const test3 = `<args>
  <xml_memory priority="high">
    <content>带属性的内容</content>
    <tags>标签1,标签2</tags>
  </xml_memory>
  <user_message type="info">用户消息</user_message>
</args>`;

try {
  const result3 = normalizeToolArgs(test3);
  console.log('结果:', JSON.stringify(result3, null, 2));
  console.log('✅ xml_memory 存在:', !!result3?.xml_memory);
  console.log('✅ user_message 存在:', !!result3?.user_message);
} catch (error) {
  console.log('❌ 错误:', error.message);
}

console.log('\n' + '='.repeat(50) + '\n');

// 测试用例 4: JSON 格式（应该正常工作）
console.log('测试 4: JSON 格式');
const test4 = '{"xml_memory": "<content>JSON内容</content>", "user_message": "JSON消息"}';

try {
  const result4 = normalizeToolArgs(test4);
  console.log('结果:', JSON.stringify(result4, null, 2));
  console.log('✅ xml_memory 存在:', !!result4?.xml_memory);
  console.log('✅ user_message 存在:', !!result4?.user_message);
} catch (error) {
  console.log('❌ 错误:', error.message);
}

console.log('\n' + '='.repeat(50) + '\n');

// 测试用例 5: 对象格式（应该正常工作）
console.log('测试 5: 对象格式');
const test5 = { xml_memory: "<content>对象内容</content>", user_message: "对象消息" };

try {
  const result5 = normalizeToolArgs(test5);
  console.log('结果:', JSON.stringify(result5, null, 2));
  console.log('✅ xml_memory 存在:', !!result5?.xml_memory);
  console.log('✅ user_message 存在:', !!result5?.user_message);
} catch (error) {
  console.log('❌ 错误:', error.message);
}

console.log('\n=== 测试完成 ===');
