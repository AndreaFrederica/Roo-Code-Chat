import * as vscode from 'vscode';
import { SystemPromptFSProvider } from '../providers/SystemPromptFSProvider';
import { ClineProvider } from '../webview/ClineProvider';
import { generateSystemPrompt } from '../webview/generateSystemPrompt';
import type { ClineMessage } from '@roo-code/types';

/**
 * 系统提示词预览管理器
 * 负责监听设置变更并实时更新预览
 */
export class SystemPromptPreviewManager implements vscode.Disposable {
    private provider: SystemPromptFSProvider;
    private disposables: vscode.Disposable[] = [];
    private updateTimeout: NodeJS.Timeout | undefined;
    private isUpdating = false;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly clineProvider: ClineProvider
    ) {
        this.provider = new SystemPromptFSProvider();
        this.initialize();
    }

    private initialize(): void {
        // 注册文件系统提供器
        this.disposables.push(
            vscode.workspace.registerFileSystemProvider('system-prompt', this.provider, { isReadonly: true })
        );

        // 监听设置变更
        this.disposables.push(
            vscode.workspace.onDidChangeConfiguration((e) => {
                // 检查是否是我们关心的设置变更
                if (this.isRelevantConfigChange(e)) {
                    this.scheduleUpdate();
                }
            })
        );

        // 初始更新
        this.updatePrompt();
    }

    /**
     * 判断是否是相关的配置变更
     */
    private isRelevantConfigChange(e: vscode.ConfigurationChangeEvent): boolean {
        // 检查所有可能影响系统提示词的配置项
        const relevantConfigs = [
            'rooCode',
            'claude-code',
            'anthropic.experiments',
            'claudeCode.experimental',
            'mcp',
            'git',
            'terminal',
            'editor.fontSize',
            'editor.fontFamily',
            'editor.lineHeight',
            'editor.fontWeight',
            'editor.letterSpacing',
            'editor.lineNumbers',
            'editor.wordWrap',
            'editor.minimap.enabled',
            'editor.tabSize',
            'editor.insertSpaces',
            'files.encoding',
            'files.eol',
            'files.autoGuessEncoding',
            'files.trimTrailingWhitespace',
            'files.insertFinalNewline',
            'files.trimFinalNewlines',
            'search.exclude',
            'files.exclude',
            'files.watcherExclude'
        ];

        return relevantConfigs.some(config => e.affectsConfiguration(config));
    }

    /**
     * 调度更新（使用防抖避免频繁更新）
     */
    private scheduleUpdate(): void {
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }

        this.updateTimeout = setTimeout(() => {
            this.updatePrompt();
        }, 500); // 500ms 防抖延迟
    }

    /**
     * 更新系统提示词
     */
    private async updatePrompt(): Promise<void> {
        if (this.isUpdating) {
            return;
        }

        this.isUpdating = true;

        try {
            // 获取当前状态
            const state = await this.clineProvider.getState();
            if (!state) {
                console.warn('[SystemPromptPreviewManager] No state available');
                return;
            }

            // 生成系统提示词
            const systemPrompt = await generateSystemPrompt(this.clineProvider, {
                type: 'getSystemPrompt',
                mode: 'code' // 默认使用 code 模式
            });

            // 更新虚拟文件内容
            this.provider.updateSystemPrompt(systemPrompt);

            console.log('[SystemPromptPreviewManager] System prompt updated successfully');
        } catch (error) {
            console.error('[SystemPromptPreviewManager] Failed to update system prompt:', error);

            // 更新错误信息到预览文件
            const errorContent = `# System Prompt Error\n\nFailed to generate system prompt:\n\n${error instanceof Error ? error.message : String(error)}`;
            this.provider.updateSystemPrompt(errorContent);
        } finally {
            this.isUpdating = false;
        }
    }

    /**
     * 打开系统提示词预览
     */
    public async openPreview(): Promise<void> {
        try {
            // 确保使用正确的URI格式
            const uri = vscode.Uri.from({
                scheme: 'system-prompt',
                path: '/system-prompt.md'
            });
            
            console.log('[SystemPromptPreviewManager] Opening URI:', uri.toString());
            
            const document = await vscode.workspace.openTextDocument(uri);

            // 在当前编辑器组中打开（不自动分屏）
            await vscode.window.showTextDocument(document, {
                preview: false,
                viewColumn: vscode.ViewColumn.Active
            });

            vscode.window.showInformationMessage('System prompt preview opened');
        } catch (error) {
            console.error('[SystemPromptPreviewManager] Failed to open preview:', error);
            vscode.window.showErrorMessage(`Failed to open system prompt preview: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 手动触发更新
     */
    public async refresh(): Promise<void> {
        await this.updatePrompt();
    }

    /**
     * 获取当前系统提示词内容
     */
    public getCurrentPrompt(): string {
        return this.provider.getCurrentSystemPrompt();
    }

    /**
     * 清理资源
     */
    public dispose(): void {
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }

        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }
}
