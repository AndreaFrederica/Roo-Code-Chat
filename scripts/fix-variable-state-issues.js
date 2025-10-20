#!/usr/bin/env node

/**
 * 变量状态持久化功能问题修复脚本
 * 
 * 此脚本自动修复数据链条分析中发现的关键问题：
 * 1. 类型定义不完整
 * 2. 数据结构不一致
 * 3. 性能优化
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 开始修复变量状态持久化功能问题...\n');

// 修复1: 更新ClineMessage类型定义
function fixMessageTypeDefinition() {
    console.log('📝 修复1: 更新ClineMessage类型定义');
    
    const messageFilePath = path.join(__dirname, '../packages/types/src/message.ts');
    
    if (!fs.existsSync(messageFilePath)) {
        console.log('⚠️  警告: message.ts文件未找到，跳过类型定义修复');
        return false;
    }
    
    let content = fs.readFileSync(messageFilePath, 'utf8');
    
    // 检查是否已经包含tool字段
    if (content.includes('tool: z.object')) {
        console.log('✅ 类型定义已包含tool字段，跳过修复');
        return true;
    }
    
    // 在clineMessageSchema中添加tool字段
    const toolField = `\ttool: z.object({
\t\tvariableState: z.record(z.string(), z.any()).optional(),
\t\tvariables: z.array(z.string()).optional(),
\t\ttodos: z.array(z.any()).optional(),
\t}).optional(),`;
    
    // 找到userAvatarSnapshot字段后插入tool字段
    const insertPoint = content.indexOf('\t}).optional(),\n})');
    
    if (insertPoint !== -1) {
        content = content.slice(0, insertPoint) + 
                 ',\n' + toolField + 
                 content.slice(insertPoint);
        
        fs.writeFileSync(messageFilePath, content);
        console.log('✅ 成功添加tool字段到ClineMessage类型定义');
        return true;
    } else {
        console.log('❌ 无法找到合适的插入点，请手动修复类型定义');
        return false;
    }
}

// 修复2: 更新TaskHeader组件的数据源
function fixTaskHeaderDataSource() {
    console.log('\n📝 修复2: 更新TaskHeader组件的数据源');
    
    const taskHeaderPath = path.join(__dirname, '../webview-ui/src/components/chat/TaskHeader.tsx');
    
    if (!fs.existsSync(taskHeaderPath)) {
        console.log('⚠️  警告: TaskHeader.tsx文件未找到，跳过数据源修复');
        return false;
    }
    
    let content = fs.readFileSync(taskHeaderPath, 'utf8');
    
    // 检查是否已经修复
    if (content.includes('variableState') && content.includes('Object.entries')) {
        console.log('✅ TaskHeader数据源已修复，跳过');
        return true;
    }
    
    // 替换变量数据获取逻辑
    const oldLogic = `	// 提取并合并变量状态
	const mergedVariableState = useMemo(() => {
		const variableCommands = (task as any)?.tool?.variables || []
		if (!Array.isArray(variableCommands) || variableCommands.length === 0) {
			return null
		}

		// 解析所有变量命令
		const parsedCommands: ParsedCommand[] = []
		variableCommands.forEach((variableStr: string) => {
			try {
				const commands = parseVariableCommands(variableStr)
				parsedCommands.push(...commands)
			} catch (error) {
				console.warn('Failed to parse variable command:', error)
			}
		})

		// 按变量名分组，保留最新的值
		const variableStates: Record<string, ParsedCommand> = {}
		parsedCommands.forEach(command => {
			const existing = variableStates[command.variable]
			// 保留最新的命令，或者如果没有则设置
			if (!existing || command.position && existing.position && 
				command.position.start > existing.position.start) {
				variableStates[command.variable] = command
			}
		})

		return variableStates
	}, [task])`;
    
    const newLogic = `	// 提取并合并变量状态
	const mergedVariableState = useMemo(() => {
		// 从variableState获取变量数据
		const variableState = (task as any)?.tool?.variableState
		if (!variableState || typeof variableState !== 'object') {
			return null
		}

		// 将variableState转换为ParsedCommand格式
		const variableStates: Record<string, ParsedCommand> = {}
		Object.entries(variableState).forEach(([key, value]) => {
			// 构造ParsedCommand对象
			variableStates[key] = {
				type: 'set',
				method: '_.set',
				variable: key,
				value: value,
				position: { start: 0, end: 0 }
			}
		})

		return variableStates
	}, [task])`;
    
    if (content.includes(oldLogic)) {
        content = content.replace(oldLogic, newLogic);
        fs.writeFileSync(taskHeaderPath, content);
        console.log('✅ 成功更新TaskHeader数据源逻辑');
        return true;
    } else {
        console.log('⚠️  未找到预期的数据源逻辑，可能已修改或需要手动修复');
        return false;
    }
}

// 修复3: 优化Task.ts中的变量命令检测
function optimizeVariableCommandDetection() {
    console.log('\n📝 修复3: 优化Task.ts中的变量命令检测');
    
    const taskFilePath = path.join(__dirname, '../src/core/task/Task.ts');
    
    if (!fs.existsSync(taskFilePath)) {
        console.log('⚠️  警告: Task.ts文件未找到，跳过性能优化');
        return false;
    }
    
    let content = fs.readFileSync(taskFilePath, 'utf8');
    
    // 检查是否已经优化
    if (content.includes('VARIABLE_COMMAND_REGEX')) {
        console.log('✅ 变量命令检测已优化，跳过');
        return true;
    }
    
    // 添加正则表达式常量
    const regexConstant = `	// 变量命令检测正则表达式
	private static readonly VARIABLE_COMMAND_REGEX = /_\.(set|add|insert|remove)\\s*\\(/`;
    
    // 添加检测方法
    const detectionMethod = `	/**
	 * 检查文本是否包含变量命令
	 */
	private hasVariableCommands(text?: string): boolean {
		if (!text) return false
		return Task.VARIABLE_COMMAND_REGEX.test(text)
	}`;
    
    // 找到类的合适位置插入
    const classStart = content.indexOf('export class Task extends EventEmitter<TaskEvents> implements TaskLike {');
    if (classStart === -1) {
        console.log('❌ 无法找到Task类定义');
        return false;
    }
    
    // 找到第一个属性或方法的插入点
    const insertPoint = content.indexOf('\treadonly taskId: string', classStart);
    if (insertPoint === -1) {
        console.log('❌ 无法找到合适的插入点');
        return false;
    }
    
    // 插入正则表达式常量
    content = content.slice(0, insertPoint) + 
             regexConstant + '\n\n' + 
             content.slice(insertPoint);
    
    // 找到saveVariableStateToMessage方法并优化
    const oldDetection = `const hasVariableCommands = message.text?.includes('_.set(') || 
											message.text?.includes('_.add(') || 
											message.text?.includes('_.insert(') || 
											message.text?.includes('_.remove(')`;
    
    const newDetection = `const hasVariableCommands = this.hasVariableCommands(message.text)`;
    
    if (content.includes(oldDetection)) {
        content = content.replace(oldDetection, newDetection);
    } else {
        console.log('⚠️  未找到预期的检测逻辑，跳过优化');
    }
    
    // 在saveVariableStateToMessage方法前添加检测方法
    const methodInsertPoint = content.indexOf('private async saveVariableStateToMessage(message: ClineMessage): Promise<void> {');
    if (methodInsertPoint !== -1) {
        content = content.slice(0, methodInsertPoint) + 
                 detectionMethod + '\n\n' + 
                 content.slice(methodInsertPoint);
    }
    
    fs.writeFileSync(taskFilePath, content);
    console.log('✅ 成功优化变量命令检测逻辑');
    return true;
}

// 修复4: 更新VariableStateDisplay组件的数据传递
function fixVariableStateDisplayProps() {
    console.log('\n📝 修复4: 更新VariableStateDisplay组件的数据传递');
    
    const taskHeaderPath = path.join(__dirname, '../webview-ui/src/components/chat/TaskHeader.tsx');
    
    if (!fs.existsSync(taskHeaderPath)) {
        console.log('⚠️  警告: TaskHeader.tsx文件未找到，跳过修复');
        return false;
    }
    
    let content = fs.readFileSync(taskHeaderPath, 'utf8');
    
    // 检查是否需要修复
    if (content.includes('variables={(task as any)?.tool?.variables || []}')) {
        const newProps = `variables={mergedVariableState ? Object.keys(mergedVariableState).map(key => {
			const command = mergedVariableState[key];
			return \`_.set("\${key}", \${JSON.stringify(command.value)})\`;
		}) : []}`;
        
        content = content.replace(
            'variables={(task as any)?.tool?.variables || []}',
            newProps
        );
        
        fs.writeFileSync(taskHeaderPath, content);
        console.log('✅ 成功更新VariableStateDisplay组件的数据传递');
        return true;
    } else {
        console.log('✅ VariableStateDisplay数据传递已修复或不需要修复');
        return true;
    }
}

// 主函数
function main() {
    console.log('🚀 开始执行变量状态持久化功能修复脚本\n');
    
    const results = [];
    
    results.push(fixMessageTypeDefinition());
    results.push(fixTaskHeaderDataSource());
    results.push(optimizeVariableCommandDetection());
    results.push(fixVariableStateDisplayProps());
    
    console.log('\n📊 修复结果汇总:');
    console.log('='.repeat(50));
    
    const successCount = results.filter(r => r === true).length;
    const totalCount = results.length;
    
    results.forEach((result, index) => {
        const status = result ? '✅ 成功' : '❌ 失败';
        console.log(`修复${index + 1}: ${status}`);
    });
    
    console.log('='.repeat(50));
    console.log(`总体结果: ${successCount}/${totalCount} 项修复成功`);
    
    if (successCount === totalCount) {
        console.log('🎉 所有关键问题已修复！');
        console.log('\n📋 建议后续操作:');
        console.log('1. 重新编译项目确保类型检查通过');
        console.log('2. 运行测试验证功能正常');
        console.log('3. 检查控制台日志确认无错误');
    } else {
        console.log('⚠️  部分修复失败，请检查上述错误信息');
        console.log('💡 建议手动修复失败的项目');
    }
    
    console.log('\n🔍 验证方法:');
    console.log('1. 启动应用并创建包含变量命令的任务');
    console.log('2. 检查变量状态是否正确显示在UI中');
    console.log('3. 重启应用验证变量状态是否正确恢复');
    console.log('4. 查看开发者工具控制台确认无TypeScript错误');
}

// 运行脚本
if (require.main === module) {
    main();
}

module.exports = {
    fixMessageTypeDefinition,
    fixTaskHeaderDataSource,
    optimizeVariableCommandDetection,
    fixVariableStateDisplayProps,
    main
};
