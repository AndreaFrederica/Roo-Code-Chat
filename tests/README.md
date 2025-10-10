# LiquidJS 模板系统测试

这个文件夹包含了 LiquidJS 模板系统的所有测试文件和生成的报告。

## 文件结构

```
tests/
├── README.md                          # 本文件
├── reports/                          # 测试报告目录
│   ├── liquidjs-template-test-report.md        # 主要测试报告
│   ├── complete-system-prompt-*.md              # 完整系统提示词报告
│   ├── processed-role-*.md                        # 格式化角色信息报告
│   ├── complete-role-json-*.md                   # 完整JSON分析报告
│   └── processed-role-*.json                      # 纯JSON角色数据
├── generate-complete-role-json.js               # 生成完整JSON报告的脚本
└── (其他测试脚本会放在这里)
```

## 测试脚本

### 主要测试脚本

- **`generate-complete-role-json.js`**: 生成完整的处理后角色JSON信息，包括详细的数据分析和对比

### 运行测试

```bash
# 运行完整JSON报告生成
npx tsx tests/generate-complete-role-json.js

# 运行主要测试（从项目根目录）
npx tsx src/utils/test-liquidjs-templates.ts
```

## 报告说明

### 1. 主要测试报告 (`liquidjs-template-test-report.md`)
- 包含基础模板功能测试结果
- 性能测试结果
- LiquidJS功能验证
- 测试概览和结论

### 2. 完整系统提示词报告 (`complete-system-prompt-*.md`)
- 包含处理后的完整系统提示词内容
- 使用的模板变量信息
- 处理统计数据

### 3. 格式化角色信息报告 (`processed-role-*.md`)
- 详细的处理后角色对象信息
- Profile处理统计
- 模板变量验证结果
- 完整的角色对象结构

### 4. 完整JSON分析报告 (`complete-role-json-*.md`)
- 最详细的角色对象分析
- 字段级别的对比和变化统计
- 数据完整性验证
- 功能验证状态

### 5. 纯JSON数据文件 (`processed-role-*.json`)
- 原始的JSON格式角色数据
- 可直接用于其他系统或分析

## 测试数据

测试使用的原始数据：
- **PNG角色卡**: `novel-helper/.anh-chat/roles/灰风 (1).png`
- **Profile预设**: `novel-helper/.anh-chat/profile/GrayWill-0.36-ex (2).json`

## 关键功能验证

✅ **核心功能**
- PNG角色卡解析
- Profile预设读取
- 模板变量替换
- LiquidJS语法支持
- 中文字符变量支持
- 多行内容处理
- 系统提示词生成

✅ **数据完整性**
- UUID保持一致
- 基础属性保留
- 扩展信息完整
- 时间戳更新
- 规格信息正确

✅ **性能指标**
- 平均处理时间 < 0.2ms/次
- 支持6,000+字符的系统提示词
- 零错误处理
- 完美模板渲染

## 清理旧文件

项目根目录下的旧测试文件可以被清理：
```bash
# 清理根目录下的测试报告
rm -f liquidjs-template-test-report.md
rm -f complete-system-prompt-*.md
rm -f processed-role-*.md
rm -f complete-role-json-*.md
rm -f processed-role-*.json
```

---
*LiquidJS 模板系统测试套件*