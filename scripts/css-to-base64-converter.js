#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

/**
 * CSS资源链接转Base64工具
 * 用于将CSS文件中的外部资源链接转换为内嵌base64格式
 */

class CssToBase64Converter {
    constructor(cssDir = './temp/split') {
        this.cssDir = cssDir;
        this.cache = new Map(); // 缓存已下载的资源
        this.processedUrls = new Set(); // 避免重复处理
        this.timeout = 10000; // 下载超时时间
    }

    /**
     * 下载资源并转换为base64
     */
    async downloadResource(url) {
        if (this.cache.has(url)) {
            return this.cache.get(url);
        }

        return new Promise((resolve, reject) => {
            const protocol = url.startsWith('https:') ? https : http;
            
            const request = protocol.get(url, { timeout: this.timeout }, (response) => {
                // 处理重定向
                if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                    return this.downloadResource(response.headers.location).then(resolve).catch(reject);
                }

                if (response.statusCode !== 200) {
                    return reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                }

                const chunks = [];
                response.on('data', chunk => chunks.push(chunk));
                response.on('end', () => {
                    const buffer = Buffer.concat(chunks);
                    const mimeType = this.getMimeTypeFromUrl(url) || this.getMimeTypeFromResponse(response);
                    const base64 = buffer.toString('base64');
                    const dataUrl = `data:${mimeType};base64,${base64}`;
                    
                    this.cache.set(url, dataUrl);
                    resolve(dataUrl);
                });
            });

            request.on('timeout', () => {
                request.destroy();
                reject(new Error(`下载超时: ${url}`));
            });

            request.on('error', (error) => {
                reject(new Error(`下载失败: ${url} - ${error.message}`));
            });
        });
    }

    /**
     * 从URL获取MIME类型
     */
    getMimeTypeFromUrl(url) {
        const ext = path.extname(new URL(url).pathname).toLowerCase();
        const mimeTypes = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon',
            '.bmp': 'image/bitmap',
            '.tiff': 'image/tiff',
            '.woff': 'font/woff',
            '.woff2': 'font/woff2',
            '.ttf': 'font/ttf',
            '.eot': 'application/vnd.ms-fontobject',
            '.otf': 'font/otf'
        };
        return mimeTypes[ext] || null;
    }

    /**
     * 从响应头获取MIME类型
     */
    getMimeTypeFromResponse(response) {
        const contentType = response.headers['content-type'];
        if (contentType) {
            return contentType.split(';')[0].trim();
        }
        return 'application/octet-stream';
    }

    /**
     * 提取CSS中的所有URL
     */
    extractUrls(cssContent) {
        const urls = [];
        
        // 匹配 url(...) 模式
        const urlRegex = /url\(\s*(['"]?)([^'")\s]+)\1\s*\)/gi;
        let match;
        
        while ((match = urlRegex.exec(cssContent)) !== null) {
            const url = match[2];
            
            // 跳过已经是data: URL的
            if (!url.startsWith('data:') && !url.startsWith('#') && !url.startsWith('about:')) {
                urls.push({
                    original: match[0],
                    url: url,
                    quote: match[1] || ''
                });
            }
        }
        
        // 匹配 @import 模式
        const importRegex = /@import\s+(['"])([^'"]+)\1/gi;
        while ((match = importRegex.exec(cssContent)) !== null) {
            const url = match[2];
            if (!url.startsWith('data:') && !url.startsWith('#')) {
                urls.push({
                    original: match[0],
                    url: url,
                    quote: match[1],
                    isImport: true
                });
            }
        }
        
        return urls;
    }

    /**
     * 转换单个CSS文件
     */
    async convertCssFile(filePath) {
        try {
            console.log(`🎨 正在处理: ${filePath}`);
            
            const fullPath = path.join(this.cssDir, filePath);
            const cssContent = fs.readFileSync(fullPath, 'utf8');
            
            // 提取所有URL
            const urls = this.extractUrls(cssContent);
            
            if (urls.length === 0) {
                console.log(`⚠️  文件 ${filePath} 中未找到外部资源链接`);
                return null;
            }
            
            console.log(`📡 找到 ${urls.length} 个资源链接`);
            
            let convertedContent = cssContent;
            let convertedCount = 0;
            let failedCount = 0;
            
            // 逐个处理URL
            for (const urlInfo of urls) {
                try {
                    if (this.processedUrls.has(urlInfo.url)) {
                        console.log(`⏭️  跳过已处理的URL: ${urlInfo.url}`);
                        continue;
                    }
                    
                    console.log(`⬇️  下载中: ${urlInfo.url}`);
                    const dataUrl = await this.downloadResource(urlInfo.url);
                    
                    // 替换原URL
                    if (urlInfo.isImport) {
                        const replacement = `@import '${dataUrl}'`;
                        convertedContent = convertedContent.replace(urlInfo.original, replacement);
                    } else {
                        const replacement = `url('${dataUrl}')`;
                        convertedContent = convertedContent.replace(urlInfo.original, replacement);
                    }
                    
                    this.processedUrls.add(urlInfo.url);
                    convertedCount++;
                    console.log(`✅ 转换完成: ${urlInfo.url}`);
                    
                } catch (error) {
                    console.log(`❌ 转换失败: ${urlInfo.url} - ${error.message}`);
                    failedCount++;
                }
            }
            
            // 生成输出文件名
            const baseName = path.basename(filePath, '.css');
            const outputPath = path.join(this.cssDir, `${baseName}-base64.css`);
            
            // 写入转换后的文件
            fs.writeFileSync(outputPath, convertedContent, 'utf8');
            
            console.log(`📝 转换完成:`);
            console.log(`   ✅ 成功: ${convertedCount} 个`);
            console.log(`   ❌ 失败: ${failedCount} 个`);
            console.log(`   📄 输出: ${outputPath}`);
            
            return {
                inputPath: fullPath,
                outputPath: outputPath,
                convertedCount,
                failedCount,
                totalUrls: urls.length
            };
            
        } catch (error) {
            console.error(`❌ 处理文件 ${filePath} 时出错:`, error.message);
            return null;
        }
    }

    /**
     * 获取目录下所有CSS文件
     */
    getCssFiles() {
        if (!fs.existsSync(this.cssDir)) {
            console.error(`❌ 目录不存在: ${this.cssDir}`);
            return [];
        }

        const files = fs.readdirSync(this.cssDir);
        return files.filter(file => file.endsWith('.css') && !file.includes('-base64'));
    }

    /**
     * 转换所有CSS文件
     */
    async convertAll() {
        console.log('🚀 开始转换CSS文件中的资源链接...\n');
        
        const cssFiles = this.getCssFiles();
        
        if (cssFiles.length === 0) {
            console.log('❌ 在目录中未找到CSS文件');
            return;
        }

        console.log(`📁 找到 ${cssFiles.length} 个CSS文件:\n`);
        
        const results = [];
        for (const file of cssFiles) {
            const result = await this.convertCssFile(file);
            if (result) {
                results.push(result);
            }
            console.log(''); // 空行分隔
        }

        const totalConverted = results.reduce((sum, r) => sum + r.convertedCount, 0);
        const totalFailed = results.reduce((sum, r) => sum + r.failedCount, 0);

        console.log(`🎉 转换完成!`);
        console.log(`📊 统计: 成功 ${totalConverted} 个, 失败 ${totalFailed} 个`);
        console.log(`📂 输出目录: ${this.cssDir}`);
        console.log(`💾 缓存: ${this.cache.size} 个资源`);
    }

    /**
     * 转换指定文件
     */
    async convertFile(fileName) {
        console.log('🎯 开始转换单个文件...\n');
        
        if (!fileName.endsWith('.css')) {
            fileName += '.css';
        }
        
        const result = await this.convertCssFile(fileName);
        
        if (result) {
            console.log(`\n🎉 转换完成!`);
            console.log(`📊 统计: 成功 ${result.convertedCount} 个, 失败 ${result.failedCount} 个`);
            console.log(`💾 缓存: ${this.cache.size} 个资源`);
        }
    }

    /**
     * 显示统计信息
     */
    showStats() {
        console.log(`
📊 缓存统计:
- 缓存的资源数量: ${this.cache.size}
- 已处理的URL数量: ${this.processedUrls.size}

缓存内容:
${Array.from(this.cache.keys()).map(url => `- ${url}`).join('\n')}
        `);
    }

    /**
     * 清理缓存
     */
    clearCache() {
        this.cache.clear();
        this.processedUrls.clear();
        console.log('🧹 缓存已清理');
    }

    /**
     * 显示帮助信息
     */
    showHelp() {
        console.log(`
🔧 CSS资源链接转Base64工具

用法:
  node css-to-base64-converter.js <命令> [参数]

命令:
  convert-all         转换目录下所有CSS文件
  convert <文件名>    转换指定的CSS文件
  stats               显示缓存统计信息
  clear-cache         清理缓存
  help                显示此帮助信息

示例:
  node css-to-base64-converter.js convert-all
  node css-to-base64-converter.js convert "水色rpg (3).css"
  node css-to-base64-converter.js stats
  node css-to-base64-converter.js clear-cache

说明:
  - 工具会自动下载CSS中的外部资源并转换为base64格式
  - 支持图片、字体等多种资源类型
  - 具有缓存机制，避免重复下载
  - 下载超时时间: 10秒
  - 输出文件名: 原文件名-base64.css

注意事项:
  - 请确保网络连接正常
  - 大型文件可能需要较长时间
  - 某些资源可能因跨域限制无法下载
        `);
    }
}

// 命令行处理
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('❌ 请指定命令。使用 "help" 查看帮助信息');
        process.exit(1);
    }

    const converter = new CssToBase64Converter();
    const command = args[0].toLowerCase();

    try {
        switch (command) {
            case 'convert-all':
                await converter.convertAll();
                break;

            case 'convert':
                if (!args[1]) {
                    console.log('❌ 请指定要转换的CSS文件名');
                    process.exit(1);
                }
                await converter.convertFile(args[1]);
                break;

            case 'stats':
                converter.showStats();
                break;

            case 'clear-cache':
                converter.clearCache();
                break;

            case 'help':
                converter.showHelp();
                break;

            default:
                console.log(`❌ 未知命令: ${command}`);
                console.log('使用 "help" 查看帮助信息');
                process.exit(1);
        }
    } catch (error) {
        console.error('❌ 执行命令时出错:', error.message);
        process.exit(1);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main();
}

module.exports = CssToBase64Converter;
