/**
 * 世界书服务
 * 负责加载、管理和转换酒馆格式的世界书
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import { WorldBookConverter } from '../../../packages/types/src/silly-tavern-worldbook-converter';
import { WorldBookInfo, WorldBookConversionResult, ToMarkdownOptions } from '../../../packages/types/src/silly-tavern-worldbook';
import { ContextProxy } from '../../core/config/ContextProxy';

export interface WorldBookConfig {
  /** 世界书文件路径 */
  filePath: string;
  /** 是否启用 */
  enabled: boolean;
  /** 转换选项 */
  markdownOptions?: ToMarkdownOptions;
  /** 是否自动重载 */
  autoReload?: boolean;
  /** 重载间隔（毫秒） */
  reloadInterval?: number;
}

export interface WorldBookState {
  /** 已加载的世界书列表 */
  loadedWorldBooks: WorldBookInfo[];
  /** 当前活跃的世界书 */
  activeWorldBooks: string[];
  /** 世界书配置 */
  configs: Record<string, WorldBookConfig>;
  /** 最后更新时间 */
  lastUpdated: number;
}

/**
 * 世界书管理服务
 */
export class WorldBookService {
  private converter = new WorldBookConverter();
  private state: WorldBookState = {
    loadedWorldBooks: [],
    activeWorldBooks: [],
    configs: {},
    lastUpdated: Date.now()
  };
  private watchers = new Map<string, fs.FSWatcher>();
  private reloadTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private outputChannel: vscode.OutputChannel,
    private contextProxy?: ContextProxy
  ) {
    this.outputChannel.appendLine('[WorldBook] 世界书服务已初始化');
  }

  /**
   * 初始化世界书服务
   */
  async initialize(): Promise<void> {
    try {
      // 先加载已保存的配置
      await this.loadConfigs();

      // 扫描默认目录
      const workspacePath = this.getWorkspacePath();
      if (workspacePath) {
        const worldBookDir = path.join(workspacePath, 'novel-helper', '.anh-chat', 'worldbook');

        try {
          // 检查目录是否存在且可访问
          await fsPromises.access(worldBookDir, fs.constants.F_OK | fs.constants.R_OK);
          await this.scanWorldBookDirectory(worldBookDir);
          this.outputChannel.appendLine(`[WorldBook] 扫描目录: ${worldBookDir}`);
        } catch (accessError) {
          // 目录不存在或无法访问，创建它
          try {
            await fsPromises.mkdir(worldBookDir, { recursive: true });
            this.outputChannel.appendLine(`[WorldBook] 创建目录: ${worldBookDir}`);
          } catch (mkdirError) {
            this.outputChannel.appendLine(`[WorldBook] 创建目录失败: ${worldBookDir} - ${mkdirError instanceof Error ? mkdirError.message : String(mkdirError)}`);
          }
        }
      }

      // 同步扫描到的世界书文件与配置
      this.syncWorldBooksWithConfigs();

      // 刷新激活列表，确保与configs.enabled状态同步
      this.refreshActiveWorldBooks();

      // 启动自动重载
      this.startAutoReload();

    } catch (error) {
      this.outputChannel.appendLine(`[WorldBook] 初始化失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取世界书状态
   */
  getState(): WorldBookState {
    return { ...this.state };
  }

  /**
   * 扫描世界书目录
   */
  async scanWorldBookDirectory(dirPath: string): Promise<WorldBookInfo[]> {
    try {
      const infos = await this.converter.scanDirectory(dirPath);

      // 确保所有路径都是绝对路径
      const infosWithAbsolutePaths = infos.map(info => ({
        ...info,
        path: path.resolve(info.path)
      }));

      // 更新状态
      this.state.loadedWorldBooks = infosWithAbsolutePaths;
      this.state.lastUpdated = Date.now();

      this.outputChannel.appendLine(`[WorldBook] 发现 ${infos.length} 个世界书文件`);

      infosWithAbsolutePaths.forEach(info => {
        this.outputChannel.appendLine(`[WorldBook] - ${info.name} (${info.entryCount} 词条)`);
      });

      return infosWithAbsolutePaths;
    } catch (error) {
      this.outputChannel.appendLine(`[WorldBook] 扫描目录失败 ${dirPath}: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * 添加世界书配置
   */
  async addWorldBookConfig(config: WorldBookConfig): Promise<boolean> {
    try {
      // 如果 config 中包含 scope 信息，使用 scope-aware 的 key
      let key: string;
      let absolutePath: string;

      if ((config as any).scope && (config as any).key) {
        // 使用 scope-aware 的 key
        key = (config as any).key;
        absolutePath = path.resolve(config.filePath);
      } else {
        // 兼容旧版本，使用文件路径作为 key
        absolutePath = path.resolve(config.filePath);
        key = absolutePath;
      }

      // 验证文件是否存在 - 处理可能包含空格的路径
      try {
        await fsPromises.access(absolutePath, fs.constants.F_OK);
      } catch (accessError) {
        this.outputChannel.appendLine(`[WorldBook] 文件访问失败: ${absolutePath} - ${accessError instanceof Error ? accessError.message : String(accessError)}`);
        throw accessError;
      }

      this.state.configs[key] = { ...config, filePath: absolutePath };
      this.state.lastUpdated = Date.now();

      // 刷新激活列表，确保与configs.enabled状态同步
      this.refreshActiveWorldBooks();

      // 如果启用，设置文件监听
      if (config.enabled) {
        if (config.autoReload) {
          this.setupFileWatcher(absolutePath);
        }
      }

      await this.saveConfigs();

      const scopeInfo = (config as any).scope ? ` (${(config as any).scope})` : '';
      this.outputChannel.appendLine(`[WorldBook] 添加世界书配置: ${absolutePath}${scopeInfo}`);
      return true;

    } catch (error) {
      this.outputChannel.appendLine(`[WorldBook] 添加配置失败: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * 移除世界书配置
   */
  async removeWorldBookConfig(worldBookKey: string): Promise<boolean> {
    try {
      // 解析 scope-aware 的 key
      const { filePath } = this.parseWorldBookKey(worldBookKey);
      const absolutePath = path.resolve(filePath);

      // 使用传入的 scope-aware key 来查找配置
      delete this.state.configs[worldBookKey];

      // 刷新激活列表，确保与configs.enabled状态同步
      this.refreshActiveWorldBooks();

      // 清理监听器和定时器
      this.cleanupFileWatcher(absolutePath);
      this.cleanupReloadTimer(absolutePath);

      this.state.lastUpdated = Date.now();
      await this.saveConfigs();

      const scopeInfo = worldBookKey.endsWith('-global') ? ' (global)' : ' (workspace)';
      this.outputChannel.appendLine(`[WorldBook] 移除世界书配置: ${absolutePath}${scopeInfo}`);
      return true;

    } catch (error) {
      this.outputChannel.appendLine(`[WorldBook] 移除配置失败: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * 更新世界书配置
   */
  async updateWorldBookConfig(worldBookKey: string, newConfig: WorldBookConfig): Promise<boolean> {
    try {
      // 解析 scope-aware 的 key
      const { filePath, scope } = this.parseWorldBookKey(worldBookKey);
      const absolutePath = path.resolve(filePath);

      // 验证文件是否存在
      try {
        await fsPromises.access(absolutePath, fs.constants.F_OK);
      } catch (accessError) {
        this.outputChannel.appendLine(`[WorldBook] 文件访问失败: ${absolutePath} - ${accessError instanceof Error ? accessError.message : String(accessError)}`);
        throw accessError;
      }

      // 更新配置
      this.state.configs[worldBookKey] = { ...newConfig, filePath: absolutePath };
      this.state.lastUpdated = Date.now();

      // 刷新激活列表，确保与configs.enabled状态同步
      this.refreshActiveWorldBooks();

      // 重新设置文件监听（如果需要）
      if (newConfig.enabled && newConfig.autoReload) {
        this.setupFileWatcher(absolutePath);
      } else {
        this.cleanupFileWatcher(absolutePath);
      }

      await this.saveConfigs();

      this.outputChannel.appendLine(`[WorldBook] 更新世界书配置: ${absolutePath} (${scope})`);
      return true;

    } catch (error) {
      this.outputChannel.appendLine(`[WorldBook] 更新配置失败: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * 启用/禁用世界书
   */
  async toggleWorldBook(worldBookKey: string, enabled: boolean): Promise<boolean> {
    try {
      // 解析 scope-aware 的 key
      const { filePath, scope } = this.parseWorldBookKey(worldBookKey);
      const absolutePath = path.resolve(filePath);

      const config = this.state.configs[worldBookKey];

      if (!config) {
        this.outputChannel.appendLine(`[WorldBook] 世界书配置不存在: ${worldBookKey} (${absolutePath})`);
        // 调试信息：列出所有可用的配置key
        const availableKeys = Object.keys(this.state.configs);
        this.outputChannel.appendLine(`[WorldBook] 可用的配置keys: ${availableKeys.join(', ')}`);
        return false;
      }

      config.enabled = enabled;
      this.state.lastUpdated = Date.now();

      // 刷新激活列表，确保与configs.enabled状态同步
      this.refreshActiveWorldBooks();

      if (enabled) {
        if (config.autoReload) {
          this.setupFileWatcher(absolutePath);
        }
      } else {
        this.cleanupFileWatcher(absolutePath);
      }

      await this.saveConfigs();

      this.outputChannel.appendLine(`[WorldBook] ${enabled ? '启用' : '禁用'} 世界书: ${absolutePath} (${scope})`);
      return true;

    } catch (error) {
      this.outputChannel.appendLine(`[WorldBook] 切换状态失败: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * 获取活跃世界书的Markdown内容
   */
  async getActiveWorldBooksMarkdown(): Promise<string> {
    const markdownParts: string[] = [];

    for (const filePath of this.state.activeWorldBooks) {
      const config = this.state.configs[filePath];
      if (!config || !config.enabled) continue;

      try {
        const result = await this.converter.loadFromFile(filePath, config.markdownOptions);

        if (result.entryCount > 0) {
          const fileName = path.basename(filePath, path.extname(filePath));
          markdownParts.push(`## ${fileName}`);
          markdownParts.push('');
          markdownParts.push(result.markdown);

          this.outputChannel.appendLine(`[WorldBook] 加载世界书: ${fileName} (${result.entryCount} 词条)`);
        }

        if (result.warnings.length > 0) {
          this.outputChannel.appendLine(`[WorldBook] 警告: ${result.warnings.join(', ')}`);
        }

      } catch (error) {
        this.outputChannel.appendLine(`[WorldBook] 加载失败 ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return markdownParts.join('\n\n');
  }

  /**
   * 浏览选择世界书文件
   */
  async browseWorldBookFile(): Promise<string | undefined> {
    try {
      const workspacePath = this.getWorkspacePath();
      if (!workspacePath) {
        vscode.window.showErrorMessage('请先打开工作区');
        return undefined;
      }

      const worldBookDir = path.join(workspacePath, 'novel-helper', '.anh-chat', 'worldbook');

      // 确保目录存在，处理可能包含空格的路径
      try {
        await fsPromises.mkdir(worldBookDir, { recursive: true });
        this.outputChannel.appendLine(`[WorldBook] 确保目录存在: ${worldBookDir}`);
      } catch (mkdirError) {
        this.outputChannel.appendLine(`[WorldBook] 创建目录失败: ${worldBookDir} - ${mkdirError instanceof Error ? mkdirError.message : String(mkdirError)}`);
      }

      const options: vscode.OpenDialogOptions = {
        canSelectMany: false,
        openLabel: '选择世界书文件',
        filters: {
          'JSON Files': ['json', 'jsonl'],
          'All Files': ['*']
        },
        defaultUri: vscode.Uri.file(worldBookDir)
      };

      const fileUri = await vscode.window.showOpenDialog(options);
      if (fileUri && fileUri[0]) {
        const selectedPath = fileUri[0].fsPath;
        this.outputChannel.appendLine(`[WorldBook] 用户选择的文件: ${selectedPath}`);
        return selectedPath;
      }

      return undefined;

    } catch (error) {
      this.outputChannel.appendLine(`[WorldBook] 浏览文件失败: ${error instanceof Error ? error.message : String(error)}`);
      vscode.window.showErrorMessage(`浏览世界书文件失败: ${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    }
  }

  /**
   * 验证世界书文件
   */
  async validateWorldBookFile(worldBookKey: string): Promise<{ valid: boolean; info?: WorldBookInfo; error?: string }> {
    try {
      // 解析 scope-aware 的 key
      const { filePath, scope } = this.parseWorldBookKey(worldBookKey);

      const info = await this.converter.getWorldBookInfo(filePath);

      if (info.loaded && info.entryCount > 0) {
        this.outputChannel.appendLine(`[WorldBook] 验证成功: ${filePath} (${info.entryCount} 词条) (${scope})`);
        return { valid: true, info };
      } else {
        this.outputChannel.appendLine(`[WorldBook] 验证失败: ${filePath} (${scope}) - ${info.error || '文件格式无效或没有找到词条'}`);
        return {
          valid: false,
          error: info.error || '文件格式无效或没有找到词条'
        };
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[WorldBook] 验证异常 ${worldBookKey}: ${errorMessage}`);
      return {
        valid: false,
        error: errorMessage
      };
    }
  }

  /**
   * 重新加载世界书
   */
  async reloadWorldBook(worldBookKey: string): Promise<boolean> {
    try {
      // 解析 scope-aware 的 key
      const { filePath, scope } = this.parseWorldBookKey(worldBookKey);
      const absolutePath = path.resolve(filePath);

      const config = this.state.configs[worldBookKey];
      if (!config) {
        this.outputChannel.appendLine(`[WorldBook] 世界书配置不存在: ${worldBookKey}`);
        return false;
      }

      // 重新扫描文件信息
      const info = await this.converter.getWorldBookInfo(absolutePath);
      if (info.loaded) {
        // 更新状态中的世界书信息
        const index = this.state.loadedWorldBooks.findIndex(wb => wb.path === absolutePath);
        if (index !== -1) {
          this.state.loadedWorldBooks[index] = { ...info, path: absolutePath };
        } else {
          this.state.loadedWorldBooks.push({ ...info, path: absolutePath });
        }

        this.state.lastUpdated = Date.now();
        this.outputChannel.appendLine(`[WorldBook] 重新加载: ${path.basename(absolutePath)} (${info.entryCount} 词条) (${scope})`);
        return true;
      }

      return false;

    } catch (error) {
      this.outputChannel.appendLine(`[WorldBook] 重新加载失败 ${worldBookKey}: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * 加载世界书文件数据
   */
  async loadWorldBookFile(filePath: string): Promise<any> {
    try {
      const result = await this.converter.loadFromFile(filePath);
      return result;
    } catch (error) {
      this.outputChannel.appendLine(`[WorldBook] 加载世界书文件失败 ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * 获取世界书目录路径
   */
  getWorldBooksPath(): string {
    const workspacePath = this.getWorkspacePath();
    if (workspacePath) {
      return path.join(workspacePath, 'novel-helper', '.anh-chat', 'worldbook');
    }
    return '';
  }

  /**
   * 清理资源
   */
  dispose(): void {
    // 清理文件监听器
    this.watchers.forEach((_, key) => {
      this.cleanupFileWatcher(key);
    });

    // 清理重载定时器
    this.reloadTimers.forEach((_, key) => {
      this.cleanupReloadTimer(key);
    });

    this.outputChannel.appendLine('[WorldBook] 世界书服务已清理');
  }

  /* ------------------ 私有方法 ------------------ */

  /**
   * 解析 scope-aware 的世界书 key
   * 支持格式: "path-scope" 或直接是 "path"
   */
  private parseWorldBookKey(key: string): { filePath: string; scope: string } {
    if (key.endsWith('-global')) {
      return {
        filePath: key.slice(0, -7), // 移除 "-global"
        scope: 'global'
      };
    } else if (key.endsWith('-workspace')) {
      return {
        filePath: key.slice(0, -10), // 移除 "-workspace"
        scope: 'workspace'
      };
    } else {
      // 如果没有 scope 后缀，默认为 workspace
      return {
        filePath: key,
        scope: 'workspace'
      };
    }
  }

  /**
   * 创建 scope-aware 的世界书 key
   */
  private createWorldBookKey(filePath: string, scope: string): string {
    return `${filePath}-${scope}`;
  }

  /**
   * 同步扫描到的世界书文件与配置
   * 为所有扫描到的世界书文件创建默认配置（如果不存在的话）
   */
  private syncWorldBooksWithConfigs(): void {
    try {
      let newConfigsCreated = 0;

      for (const worldBook of this.state.loadedWorldBooks) {
        const absolutePath = path.resolve(worldBook.path);

        // 如果配置不存在，创建默认配置
        if (!this.state.configs[absolutePath]) {
          this.state.configs[absolutePath] = {
            filePath: absolutePath,
            enabled: false, // 默认禁用，需要用户手动启用
            markdownOptions: {
              headingLevel: 2,
              titleStrategy: 'auto',
              includeDisabled: false,
              sortBy: 'order',
              includeFrontMatter: true,
              frontMatterStyle: 'table',
              includeKeys: true
            },
            autoReload: false // 默认不自动重载
          };
          newConfigsCreated++;
        }
      }

      // 清理不存在文件的配置
      const configsToRemove: string[] = [];
      for (const configPath of Object.keys(this.state.configs)) {
        const exists = this.state.loadedWorldBooks.some(wb =>
          path.resolve(wb.path) === configPath
        );
        if (!exists) {
          configsToRemove.push(configPath);
        }
      }

      // 删除无效配置
      for (const configPath of configsToRemove) {
        delete this.state.configs[configPath];

        // 清理监听器和定时器
        this.cleanupFileWatcher(configPath);
        this.cleanupReloadTimer(configPath);
      }

      // 刷新激活列表，确保与configs.enabled状态同步
      this.refreshActiveWorldBooks();

      this.state.lastUpdated = Date.now();

      if (newConfigsCreated > 0) {
        this.outputChannel.appendLine(`[WorldBook] 为 ${newConfigsCreated} 个扫描到的世界书文件创建了默认配置`);
      }

      if (configsToRemove.length > 0) {
        this.outputChannel.appendLine(`[WorldBook] 清理了 ${configsToRemove.length} 个无效配置`);
      }

      // 保存同步后的配置
      if (newConfigsCreated > 0 || configsToRemove.length > 0) {
        this.saveConfigs();
      }

      this.outputChannel.appendLine(`[WorldBook] 同步完成 - 配置数: ${Object.keys(this.state.configs).length}, 激活数: ${this.state.activeWorldBooks.length}`);

    } catch (error) {
      this.outputChannel.appendLine(`[WorldBook] 同步世界书配置失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private getWorkspacePath(): string | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      return workspaceFolders[0].uri.fsPath;
    }
    return undefined;
  }

  private async loadConfigs(): Promise<void> {
    try {
      if (!this.contextProxy) {
        this.outputChannel.appendLine('[WorldBook] ContextProxy未提供，跳过配置加载');
        return;
      }

      // 从全局状态加载配置
      const savedConfigs = this.contextProxy.getValue('sillyTavernWorldBookConfigs') || {};

      this.state.configs = savedConfigs;

      this.outputChannel.appendLine(`[WorldBook] 从持久化状态加载了 ${Object.keys(savedConfigs).length} 个配置`);

      // activeWorldBooks 始终基于 configs.enabled 动态生成
      this.refreshActiveWorldBooks();

    } catch (error) {
      this.outputChannel.appendLine(`[WorldBook] 配置加载失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 刷新激活的世界书列表
   * 基于configs.enabled状态动态生成activeWorldBooks
   */
  private refreshActiveWorldBooks(): void {
    try {
      const activeBooks: string[] = [];

      // 遍历所有配置，收集启用的世界书
      for (const [configKey, config] of Object.entries(this.state.configs)) {
        if (config.enabled) {
          activeBooks.push(configKey);
        }
      }

      this.state.activeWorldBooks = activeBooks;
      this.outputChannel.appendLine(`[WorldBook] 刷新激活列表完成，激活 ${activeBooks.length} 个世界书`);

    } catch (error) {
      this.outputChannel.appendLine(`[WorldBook] 刷新激活列表失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async saveConfigs(): Promise<void> {
    try {
      if (!this.contextProxy) {
        this.outputChannel.appendLine('[WorldBook] ContextProxy未提供，跳过配置保存');
        return;
      }

      // 只保存configs，activeWorldBooks状态将基于configs.enabled动态生成
      await this.contextProxy.setValue('sillyTavernWorldBookConfigs', this.state.configs);

      this.outputChannel.appendLine(`[WorldBook] 已保存 ${Object.keys(this.state.configs).length} 个世界书配置`);
      this.outputChannel.appendLine(`[WorldBook] 当前激活世界书: ${this.state.activeWorldBooks.length} 个`);
    } catch (error) {
      this.outputChannel.appendLine(`[WorldBook] 配置保存失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private startAutoReload(): void {
    // 为所有启用的世界书设置自动重载
    for (const [filePath, config] of Object.entries(this.state.configs)) {
      if (config.enabled && config.autoReload) {
        this.setupFileWatcher(filePath);
      }
    }
  }

  private setupFileWatcher(filePath: string): void {
    try {
      // 清理现有的监听器
      this.cleanupFileWatcher(filePath);

      // 检查文件是否存在且可访问
      if (!fs.existsSync(filePath)) {
        this.outputChannel.appendLine(`[WorldBook] 文件不存在，无法设置监听: ${filePath}`);
        return;
      }

      // 创建文件监听器 - 处理包含空格的路径
      let watcher: fs.FSWatcher;
      try {
        watcher = fs.watch(filePath, { persistent: false }, async (eventType) => {
          if (eventType === 'change') {
            this.outputChannel.appendLine(`[WorldBook] 检测到文件变化: ${path.basename(filePath)}`);

            // 防抖处理
            this.cleanupReloadTimer(filePath);
            const timer = setTimeout(async () => {
              await this.reloadWorldBook(filePath);
            }, 1000);

            this.reloadTimers.set(filePath, timer);
          }
        });
      } catch (watchError) {
        this.outputChannel.appendLine(`[WorldBook] 文件监听创建失败: ${filePath} - ${watchError instanceof Error ? watchError.message : String(watchError)}`);

        // 如果直接监听文件失败，尝试监听文件所在目录
        const dirPath = path.dirname(filePath);
        const fileName = path.basename(filePath);

        this.outputChannel.appendLine(`[WorldBook] 尝试监听目录: ${dirPath}，关注文件: ${fileName}`);

        watcher = fs.watch(dirPath, { persistent: false }, async (eventType, changedFile) => {
          if (eventType === 'change' && changedFile === fileName) {
            this.outputChannel.appendLine(`[WorldBook] 目录监听检测到文件变化: ${fileName}`);

            // 防抖处理
            this.cleanupReloadTimer(filePath);
            const timer = setTimeout(async () => {
              await this.reloadWorldBook(filePath);
            }, 1000);

            this.reloadTimers.set(filePath, timer);
          }
        });
      }

      this.watchers.set(filePath, watcher);
      this.outputChannel.appendLine(`[WorldBook] 设置文件监听成功: ${path.basename(filePath)}`);

    } catch (error) {
      this.outputChannel.appendLine(`[WorldBook] 设置文件监听失败 ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private cleanupFileWatcher(filePath: string): void {
    const watcher = this.watchers.get(filePath);
    if (watcher) {
      watcher.close();
      this.watchers.delete(filePath);
    }
  }

  private cleanupReloadTimer(filePath: string): void {
    const timer = this.reloadTimers.get(filePath);
    if (timer) {
      clearTimeout(timer);
      this.reloadTimers.delete(filePath);
    }
  }
}
