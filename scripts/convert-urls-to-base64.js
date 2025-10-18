const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// 用于存储URL到base64的映射
const urlToBase64Map = new Map();

// 获取文件扩展名对应的MIME类型
function getMimeType(extension) {
    const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.webp': 'image/webp',
        '.ico': 'image/x-icon',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
        '.eot': 'application/vnd.ms-fontobject'
    };
    return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
}

// 下载URL并转换为base64
function downloadAndConvertToBase64(url) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https:') ? https : http;
        
        protocol.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}: ${url}`));
                return;
            }

            let data = [];
            response.on('data', (chunk) => {
                data.push(chunk);
            });

            response.on('end', () => {
                const buffer = Buffer.concat(data);
                const extension = path.extname(new URL(url).pathname);
                const mimeType = getMimeType(extension);
                const base64 = `data:${mimeType};base64,${buffer.toString('base64')}`;
                resolve(base64);
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

// 递归查找包含URL的文件
function findFilesWithUrls(dir, extensions = ['.md', '.json', '.tsx', '.ts', '.jsx', '.js', '.html', '.css']) {
    const files = [];
    
    function traverse(currentDir) {
        const items = fs.readdirSync(currentDir);
        
        for (const item of items) {
            const fullPath = path.join(currentDir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
                traverse(fullPath);
            } else if (stat.isFile()) {
                const ext = path.extname(item);
                if (extensions.includes(ext)) {
                    files.push(fullPath);
                }
            }
        }
    }
    
    traverse(dir);
    return files;
}

// 从文件内容中提取URL
function extractUrls(content) {
    // 匹配HTTP/HTTPS URL的正则表达式
    const urlRegex = /https?:\/\/[^\s"'>]+\.(jpg|jpeg|png|gif|svg|webp|ico|woff|woff2|ttf|eot)(\?[^\s"'>]*)?/gi;
    const urls = [];
    let match;
    
    while ((match = urlRegex.exec(content)) !== null) {
        urls.push(match[0]);
    }
    
    // 去重
    return [...new Set(urls)];
}

// 替换文件中的URL为base64
async function replaceUrlsWithBase64(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const urls = extractUrls(content);
        
        if (urls.length === 0) {
            return { filePath, urlsFound: 0, urlsReplaced: 0 };
        }
        
        console.log(`\n处理文件: ${filePath}`);
        console.log(`发现 ${urls.length} 个URL`);
        
        let newContent = content;
        let replacedCount = 0;
        
        for (const url of urls) {
            try {
                console.log(`  下载: ${url}`);
                
                // 检查是否已经转换过这个URL
                if (urlToBase64Map.has(url)) {
                    console.log(`  使用缓存: ${url.substring(0, 50)}...`);
                    newContent = newContent.replace(new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), urlToBase64Map.get(url));
                    replacedCount++;
                    continue;
                }
                
                const base64 = await downloadAndConvertToBase64(url);
                urlToBase64Map.set(url, base64);
                
                // 替换所有出现的URL
                const urlRegex = new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
                newContent = newContent.replace(urlRegex, base64);
                
                console.log(`  ✓ 转换成功: ${url.substring(0, 50)}... -> base64 (${base64.length} 字符)`);
                replacedCount++;
                
            } catch (error) {
                console.log(`  ✗ 转换失败: ${url} - ${error.message}`);
            }
        }
        
        if (replacedCount > 0) {
            fs.writeFileSync(filePath, newContent, 'utf8');
            console.log(`  已更新文件，替换了 ${replacedCount} 个URL`);
        }
        
        return { 
            filePath, 
            urlsFound: urls.length, 
            urlsReplaced: replacedCount 
        };
        
    } catch (error) {
        console.error(`处理文件 ${filePath} 时出错:`, error.message);
        return { 
            filePath, 
            urlsFound: 0, 
            urlsReplaced: 0, 
            error: error.message 
        };
    }
}

// 主函数
async function main() {
    const projectDir = process.cwd();
    console.log('开始扫描项目中的外部资源URL...');
    
    // 查找可能包含URL的文件
    const files = findFilesWithUrls(projectDir);
    console.log(`找到 ${files.length} 个可能包含URL的文件`);
    
    let totalUrlsFound = 0;
    let totalUrlsReplaced = 0;
    let errors = [];
    
    // 处理每个文件
    for (const file of files) {
        const result = await replaceUrlsWithBase64(file);
        totalUrlsFound += result.urlsFound;
        totalUrlsReplaced += result.urlsReplaced;
        
        if (result.error) {
            errors.push(`${file}: ${result.error}`);
        }
    }
    
    // 输出统计信息
    console.log('\n=== 转换完成 ===');
    console.log(`总共发现URL: ${totalUrlsFound}`);
    console.log(`成功转换: ${totalUrlsReplaced}`);
    console.log(`失败: ${totalUrlsFound - totalUrlsReplaced}`);
    
    if (errors.length > 0) {
        console.log('\n=== 错误信息 ===');
        errors.forEach(error => console.log(error));
    }
    
    // 保存URL映射到文件
    const mappingFile = path.join(projectDir, 'url-to-base64-mapping.json');
    const mappingObject = Object.fromEntries(urlToBase64Map);
    fs.writeFileSync(mappingFile, JSON.stringify(mappingObject, null, 2), 'utf8');
    console.log(`\nURL映射已保存到: ${mappingFile}`);
    
    console.log('\n所有URL已成功转换为内嵌base64格式！');
}

// 运行脚本
if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    downloadAndConvertToBase64,
    extractUrls,
    replaceUrlsWithBase64,
    findFilesWithUrls
};
