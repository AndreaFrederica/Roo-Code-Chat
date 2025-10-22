import * as vscode from 'vscode';
import { Volume, createFsFromVolume } from 'memfs';

/**
 * 系统提示词虚拟文件系统提供器
 * 使用内存盘实现实时预览功能
 */
export class SystemPromptFSProvider implements vscode.FileSystemProvider {
    private vol = new Volume();
    private memfs = createFsFromVolume(this.vol);
    private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    readonly onDidChangeFile = this._emitter.event;

    constructor() {
        this.vol.mkdirSync('/', { recursive: true });
        // 初始化空的系统提示词文件
        this.memfs.writeFileSync('/system-prompt.md', Buffer.from('# System Prompt\n\nGenerating...', 'utf-8'));
    }

    watch(uri: vscode.Uri): vscode.Disposable {
        return new vscode.Disposable(() => {});
    }

    stat(uri: vscode.Uri): vscode.FileStat {
        const p = this.toMemPath(uri);
        const s = this.memfs.statSync(p);
        return {
            type: s.isDirectory() ? vscode.FileType.Directory : vscode.FileType.File,
            ctime: s.ctimeMs,
            mtime: s.mtimeMs,
            size: s.size
        };
    }

    readDirectory(uri: vscode.Uri): [string, vscode.FileType][] {
        if (uri.path === '/') {
            return [
                ['system-prompt.md', vscode.FileType.File]
            ];
        }
        return [];
    }

    readFile(uri: vscode.Uri): Uint8Array {
        const p = this.toMemPath(uri);
        const content = this.memfs.readFileSync(p);
        // 处理 memfs 返回的内容，转换为 Uint8Array
        if (typeof content === 'string') {
            return new TextEncoder().encode(content);
        }
        return new Uint8Array(content);
    }

    writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean }): void {
        // 系统提示词文件是只读的，不允许直接写入
        throw vscode.FileSystemError.NoPermissions('System prompt file is read-only');
    }

    delete(uri: vscode.Uri): void {
        throw vscode.FileSystemError.NoPermissions('Cannot delete system prompt file');
    }

    rename(oldUri: vscode.Uri, newUri: vscode.Uri): void {
        throw vscode.FileSystemError.NoPermissions('Cannot rename system prompt file');
    }

    createDirectory(uri: vscode.Uri): void {
        throw vscode.FileSystemError.NoPermissions('Cannot create directories in system prompt provider');
    }

    private toMemPath(uri: vscode.Uri): string {
        const decodedPath = decodeURIComponent(uri.path);
        // 只支持根目录下的 system-prompt.md 文件
        if (decodedPath === '/system-prompt.md') {
            return '/system-prompt.md';
        }
        throw vscode.FileSystemError.FileNotFound(`File not found: ${decodedPath}`);
    }

    /**
     * 更新系统提示词内容
     * 这个方法会被外部调用来更新预览内容
     */
    public updateSystemPrompt(content: string): void {
        this.memfs.writeFileSync('/system-prompt.md', Buffer.from(content, 'utf-8'));
        const uri = vscode.Uri.parse('system-prompt://system-prompt.md');
        this._emitter.fire([{
            type: vscode.FileChangeType.Changed,
            uri
        }]);
    }

    /**
     * 获取当前系统提示词内容
     */
    public getCurrentSystemPrompt(): string {
        const content = this.memfs.readFileSync('/system-prompt.md');
        return content.toString('utf-8');
    }
}