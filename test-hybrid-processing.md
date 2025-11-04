# 测试混合处理流程

## 测试用例1：只有正则规则

```yaml
---
title: 测试文档
author: 用户
---

这是一个测试文档。

<<<BEGIN>>>
这是一个元数据块
<<<END>>>

普通文本内容。
```

## 测试用例2：只有AST规则

普通文本内容。

<thinking>
这是一个思考块，应该被AST系统处理。
包含多行内容。
</thinking>

更多普通文本。

<UpdateVariable>
_.set('test.variable', 'value')
</UpdateVariable>

## 测试用例3：正则和AST混合

```yaml
---
title: 混合测试
---

普通文本开始。

<thinking>
这个思考块应该被AST处理，不受正则预处理影响。
</thinking>

<<<BEGIN>>>
这个元数据块应该被正则处理。
<<<END>>>

<UpdateVariable>
_.set('mixed.test', '处理成功')
</UpdateVariable>

普通文本结束。
```

## 测试用例4：流式更新测试

<thinking>
第一段思考内容
</thinking>

普通文本1

<UpdateVariable>
_.set('streaming.test1', 'value1')
</UpdateVariable>

普通文本2

<thinking>
第二段思考内容，在流式更新中添加
</thinking>

<UpdateVariable>
_.set('streaming.test2', 'value2')
</UpdateVariable>