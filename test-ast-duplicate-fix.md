# AST重复渲染修复测试

这个测试文件用于验证AST块重复渲染问题的修复效果。

## 测试用例1：单个AST块

<thinking>
这是一个单独的思维块，应该正常渲染。
</thinking>

这是思维块后的普通文本。

## 测试用例2：多个AST块

<thinking>
第一个思维块。
</thinking>

这是第一个和第二个思维块之间的文本。

<UpdateVariable>
_.set('test.variable', 'value')
</UpdateVariable>

这是第二个块后的文本。

## 测试用例3：混合内容

普通文本开始。

<thinking>
思维块内容
</thinking>

中间文本。

<UpdateVariable>
_.set('another.test', 'another value')
</UpdateVariable>

结尾文本。

## 测试用例4：嵌套情况

<thinking>
外层思维块
<UpdateVariable>
_.set('nested.variable', 'nested value')
</UpdateVariable>
继续外层思维块
</thinking>

## 预期结果

1. 每个AST块应该只渲染一次，不重复
2. 文本块不应该包含AST标签
3. 折叠状态应该正常工作
4. 流式更新时不应该出现重复渲染