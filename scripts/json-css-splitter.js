#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * JSON-CSS 拆分工具
 * 用于将包含CSS的JSON文件拆分为独立的JSON和CSS文件
 * 以及将拆分后的文件重新编译合并
 */

class JsonCssSplitter {
    constructor(tempDir = './temp') {
        this.tempDir = tempDir;
        this.outputDir = path.join(tempDir, 'split');
    }

    /**
     * 确保输出目录存在
     */
    ensureOutputDir() {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    /**
     * 获取temp目录下所有的JSON文件
     */
    getJsonFiles() {
        if (!fs.existsSync(this.tempDir)) {
            console.error(`❌ 目录不存在: ${this.tempDir}`);
            return [];
        }

        const files = fs.readdirSync(this.tempDir);
        return files.filter(file => file.endsWith('.json'));
    }

    /**
     * 拆分单个JSON文件
     */
    splitJsonFile(filePath) {
        try {
            console.log(`📄 正在处理: ${filePath}`);
            
            const fullPath = path.join(this.tempDir, filePath);
            const content = fs.readFileSync(fullPath, 'utf8');
            const jsonData = JSON.parse(content);

            // 检查是否包含custom_css字段
            if (!jsonData.custom_css) {
                console.log(`⚠️  文件 ${filePath} 不包含 custom_css 字段，跳过`);
                return null;
            }

            // 提取CSS内容
            const cssContent = jsonData.custom_css;
            
            // 创建不包含CSS的JSON数据
            const jsonWithoutCss = { ...jsonData };
            delete jsonWithoutCss.custom_css;
            
            // 添加CSS文件引用
            jsonWithoutCss.css_file = `${path.basename(filePath, '.json')}.css`;

            // 生成文件名
            const baseName = path.basename(filePath, '.json');
            const jsonOutputPath = path.join(this.outputDir, `${baseName}.json`);
            const cssOutputPath = path.join(this.outputDir, `${baseName}.css`);

            // 写入JSON文件
            fs.writeFileSync(jsonOutputPath, JSON.stringify(jsonWithoutCss, null, 2), 'utf8');
            
            // 写入CSS文件
            fs.writeFileSync(cssOutputPath, cssContent, 'utf8');

            console.log(`✅ 拆分完成:`);
            console.log(`   📋 JSON: ${jsonOutputPath}`);
            console.log(`   🎨 CSS:  ${cssOutputPath}`);

            return {
                jsonPath: jsonOutputPath,
                cssPath: cssOutputPath,
                originalPath: fullPath
            };

        } catch (error) {
            console.error(`❌ 处理文件 ${filePath} 时出错:`, error.message);
            return null;
        }
    }

    /**
     * 拆分所有JSON文件
     */
    splitAll() {
        console.log('🚀 开始拆分JSON文件...\n');
        
        this.ensureOutputDir();
        const jsonFiles = this.getJsonFiles();
        
        if (jsonFiles.length === 0) {
            console.log('❌ 在temp目录中未找到JSON文件');
            return;
        }

        console.log(`📁 找到 ${jsonFiles.length} 个JSON文件:\n`);
        
        const results = [];
        for (const file of jsonFiles) {
            const result = this.splitJsonFile(file);
            if (result) {
                results.push(result);
            }
            console.log(''); // 空行分隔
        }

        console.log(`🎉 拆分完成! 共处理 ${results.length} 个文件`);
        console.log(`📂 输出目录: ${this.outputDir}`);
    }

    /**
     * 编译合并拆分的文件
     */
    compile(baseName) {
        try {
            console.log(`🔄 正在编译: ${baseName}`);
            
            const jsonPath = path.join(this.outputDir, `${baseName}.json`);
            const cssPath = path.join(this.outputDir, `${baseName}.css`);

            // 检查文件是否存在
            if (!fs.existsSync(jsonPath)) {
                throw new Error(`JSON文件不存在: ${jsonPath}`);
            }
            if (!fs.existsSync(cssPath)) {
                throw new Error(`CSS文件不存在: ${cssPath}`);
            }

            // 读取JSON和CSS内容
            const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            const cssContent = fs.readFileSync(cssPath, 'utf8');

            // 合并数据
            const mergedData = { ...jsonData };
            mergedData.custom_css = cssContent;
            
            // 移除css_file字段（如果存在）
            delete mergedData.css_file;

            // 生成输出文件名
            const outputPath = path.join(this.outputDir, `${baseName}-merged.json`);
            
            // 写入合并后的文件
            fs.writeFileSync(outputPath, JSON.stringify(mergedData, null, 2), 'utf8');

            console.log(`✅ 编译完成: ${outputPath}`);
            return outputPath;

        } catch (error) {
            console.error(`❌ 编译 ${baseName} 时出错:`, error.message);
            return null;
        }
    }

    /**
     * 编译所有拆分的文件
     */
    compileAll() {
        console.log('🔄 开始编译所有拆分的文件...\n');
        
        if (!fs.existsSync(this.outputDir)) {
            console.error(`❌ 输出目录不存在: ${this.outputDir}`);
            return;
        }

        const files = fs.readdirSync(this.outputDir);
        const jsonFiles = files.filter(file => file.endsWith('.json') && !file.includes('-merged'));
        
        if (jsonFiles.length === 0) {
            console.log('❌ 在输出目录中未找到可编译的JSON文件');
            return;
        }

        console.log(`📁 找到 ${jsonFiles.length} 个待编译的JSON文件:\n`);
        
        const results = [];
        for (const file of jsonFiles) {
            const baseName = path.basename(file, '.json');
            const result = this.compile(baseName);
            if (result) {
                results.push(result);
            }
            console.log(''); // 空行分隔
        }

        console.log(`🎉 编译完成! 共生成 ${results.length} 个合并文件`);
    }

    /**
     * 显示帮助信息
     */
    showHelp() {
        console.log(`
🔧 JSON-CSS 拆分工具

用法:
  node json-css-splitter.js <命令> [参数]

命令:
  split              拆分temp目录下的所有JSON文件
  split <文件名>     拆分指定的JSON文件
  compile <名称>     编译指定的拆分文件
  compile-all        编译所有拆分的文件
  help               显示此帮助信息

示例:
  node json-css-splitter.js split
  node json-css-splitter.js split "水色rpg (3).json"
  node json-css-splitter.js compile "水色rpg (3)"
  node json-css-splitter.js compile-all

说明:
  - 拆分功能会将JSON文件中的custom_css字段提取为独立的CSS文件
  - 编译功能会将拆分的JSON和CSS文件重新合并
  - 所有输出文件都保存在 temp/split 目录下
        `);
    }
}

// 命令行处理
function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('❌ 请指定命令。使用 "help" 查看帮助信息');
        process.exit(1);
    }

    const splitter = new JsonCssSplitter();
    const command = args[0].toLowerCase();

    switch (command) {
        case 'split':
            if (args[1]) {
                // 拆分指定文件
                splitter.ensureOutputDir();
                const result = splitter.splitJsonFile(args[1]);
                if (result) {
                    console.log('\n🎉 拆分完成!');
                }
            } else {
                // 拆分所有文件
                splitter.splitAll();
            }
            break;

        case 'compile':
            if (!args[1]) {
                console.log('❌ 请指定要编译的文件名称（不包含扩展名）');
                process.exit(1);
            }
            splitter.compile(args[1]);
            break;

        case 'compile-all':
            splitter.compileAll();
            break;

        case 'help':
            splitter.showHelp();
            break;

        default:
            console.log(`❌ 未知命令: ${command}`);
            console.log('使用 "help" 查看帮助信息');
            process.exit(1);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main();
}

module.exports = JsonCssSplitter;
