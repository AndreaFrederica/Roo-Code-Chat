/**
 * SillyTavern世界书触发词服务
 * 集成世界书触发词引擎到ANH Chat系统中
 */

import * as vscode from 'vscode';
import { ChatMessage } from '@roo-code/types';
import {
  WorldBookTriggerEngine,
  WorldBookTriggerConfig,
  WorldBookTriggerState,
  InjectionResult,
  WorldBookTriggerEntry,
  RealTimeTriggerOptions,
  WorldBookConversionResult
} from '../../../packages/types/src/silly-tavern-worldbook-trigger-engine.js';
import { WorldBookConverter } from '../../../packages/types/src/silly-tavern-worldbook-converter.js';
import { WorldEntry } from '../../../packages/types/src/silly-tavern-worldbook.js';

export interface WorldBookTriggerServiceConfig {
  /** 是否启用触发词系统 */
  enabled: boolean;
  /** 触发词配置 */
  triggerConfig: WorldBookTriggerConfig;
  /** 实时触发配置 */
  realTimeConfig: RealTimeTriggerOptions;
  /** 世界书文件列表 */
  worldBookFiles: string[];
  /** 自动重载世界书 */
  autoReloadWorldBooks: boolean;
  /** 重载间隔（分钟） */
  reloadInterval: number;
}

export interface TriggeredContent {
  /** 常驻内容（始终注入） */
  constantContent: string;
  /** 触发内容（条件注入） */
  triggeredContent: string;
  /** 合并后的完整内容 */
  fullContent: string;
  /** 注入的词条数量 */
  injectedCount: number;
  /** 处理耗时 */
  duration: number;
}

/**
 * 世界书触发词服务
 */
export class SillyTavernWorldBookTriggerService {
  private engine: WorldBookTriggerEngine | null = null;
  private converter = new WorldBookConverter();
  private loadedWorldBooks = new Map<string, WorldEntry[]>();
  private reloadTimer: NodeJS.Timeout | null = null;
  private isInitialized = false;

  constructor(
    private config: WorldBookTriggerServiceConfig,
    private outputChannel: vscode.OutputChannel
  ) {
    this.outputChannel.appendLine('[WorldBookTrigger] 触发词服务已创建');
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      this.outputChannel.appendLine('[WorldBookTrigger] 触发词系统已禁用');
      return;
    }

    try {
      this.outputChannel.appendLine('[WorldBookTrigger] 正在初始化触发词引擎...');

      // 创建触发词引擎
      this.engine = new WorldBookTriggerEngine(
        this.config.triggerConfig,
        {
          enableSemantic: true,
          // TODO: 添加语义搜索配置
        }
      );

      // 加载世界书文件
      await this.loadWorldBooks();

      // 设置实时触发
      await this.engine.setupRealTimeTriggering(this.config.realTimeConfig);

      // 设置自动重载
      if (this.config.autoReloadWorldBooks) {
        this.setupAutoReload();
      }

      this.isInitialized = true;
      this.outputChannel.appendLine('[WorldBookTrigger] 触发词引擎初始化完成');

    } catch (error) {
      this.outputChannel.appendLine(`[WorldBookTrigger] 初始化失败: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * 处理消息并生成触发内容
   */
  async processMessage(
    message: ChatMessage,
    conversationHistory: ChatMessage[] = []
  ): Promise<TriggeredContent | null> {
    if (!this.isInitialized || !this.engine) {
      return null;
    }

    try {
      const result = await this.engine.processMessage(message, conversationHistory);

      const triggeredContent: TriggeredContent = {
        constantContent: result.constantContent,
        triggeredContent: result.triggeredContent,
        fullContent: this.combineContent(result.constantContent, result.triggeredContent),
        injectedCount: result.injectedCount,
        duration: result.duration
      };

      if (this.config.triggerConfig.debugMode) {
        this.outputChannel.appendLine(`[WorldBookTrigger] 处理消息完成，注入 ${result.injectedCount} 个词条`);
        if (result.triggeredContent) {
          this.outputChannel.appendLine(`[WorldBookTrigger] 触发内容预览: ${result.triggeredContent.substring(0, 100)}...`);
        }
      }

      return triggeredContent;

    } catch (error) {
      this.outputChannel.appendLine(`[WorldBookTrigger] 处理消息失败: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * 获取常驻内容（不依赖触发的固定内容）
   */
  async getConstantContent(): Promise<string> {
    if (!this.isInitialized || !this.engine) {
      return '';
    }

    try {
      const state = this.engine.getState();
      const constantEntries = state.loadedEntries.filter(entry => entry.isConstant);

      if (constantEntries.length === 0) {
        return '';
      }

      const constantContent = constantEntries
        .map(entry => this.formatEntryContent(entry))
        .join('\n\n---\n\n');

      this.outputChannel.appendLine(`[WorldBookTrigger] 获取常驻内容，共 ${constantEntries.length} 个词条`);
      return constantContent;

    } catch (error) {
      this.outputChannel.appendLine(`[WorldBookTrigger] 获取常驻内容失败: ${error instanceof Error ? error.message : String(error)}`);
      return '';
    }
  }

  /**
   * 手动重新加载世界书
   */
  async reloadWorldBooks(): Promise<void> {
    if (!this.config.enabled) return;

    try {
      this.outputChannel.appendLine('[WorldBookTrigger] 手动重新加载世界书...');
      await this.loadWorldBooks();
      this.outputChannel.appendLine('[WorldBookTrigger] 世界书重新加载完成');
    } catch (error) {
      this.outputChannel.appendLine(`[WorldBookTrigger] 重新加载失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 添加世界书文件
   */
  async addWorldBookFile(filePath: string): Promise<boolean> {
    try {
      // 验证文件
      const result = await this.converter.loadFromFile(filePath);
      if (result.entryCount === 0) {
        this.outputChannel.appendLine(`[WorldBookTrigger] 世界书文件为空或无效: ${filePath}`);
        return false;
      }

      // 添加到配置
      if (!this.config.worldBookFiles.includes(filePath)) {
        this.config.worldBookFiles.push(filePath);
        this.loadedWorldBooks.set(filePath, []);

        // 重新加载
        await this.loadWorldBooks();

        this.outputChannel.appendLine(`[WorldBookTrigger] 添加世界书文件: ${filePath} (${result.entryCount} 词条)`);
        return true;
      }

      return false;

    } catch (error) {
      this.outputChannel.appendLine(`[WorldBookTrigger] 添加世界书文件失败: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * 移除世界书文件
   */
  async removeWorldBookFile(filePath: string): Promise<boolean> {
    try {
      const index = this.config.worldBookFiles.indexOf(filePath);
      if (index !== -1) {
        this.config.worldBookFiles.splice(index, 1);
        this.loadedWorldBooks.delete(filePath);

        // 重新加载
        await this.loadWorldBooks();

        this.outputChannel.appendLine(`[WorldBookTrigger] 移除世界书文件: ${filePath}`);
        return true;
      }

      return false;

    } catch (error) {
      this.outputChannel.appendLine(`[WorldBookTrigger] 移除世界书文件失败: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * 获取触发词状态
   */
  getTriggerState(): WorldBookTriggerState | null {
    if (!this.engine) return null;
    return this.engine.getState();
  }

  /**
   * 更新配置
   */
  async updateConfig(newConfig: Partial<WorldBookTriggerServiceConfig>): Promise<void> {
    const oldConfig = { ...this.config };
    Object.assign(this.config, newConfig);

    // 如果启用状态发生变化，重新初始化
    if (oldConfig.enabled !== this.config.enabled) {
      if (this.config.enabled) {
        await this.initialize();
      } else {
        this.dispose();
      }
      return;
    }

    // 如果引擎配置发生变化，重新创建引擎
    if (this.engine && newConfig.triggerConfig) {
      this.engine = new WorldBookTriggerEngine(
        this.config.triggerConfig,
        {
          enableSemantic: true,
          // TODO: 保留现有的语义搜索配置
        }
      );

      // 重新加载世界书
      await this.loadWorldBooks();
    }

    // 如果实时配置发生变化，重新设置
    if (this.engine && newConfig.realTimeConfig) {
      await this.engine.setupRealTimeTriggering(this.config.realTimeConfig);
    }

    // 如果自动重载配置发生变化
    if (newConfig.autoReloadWorldBooks !== undefined || newConfig.reloadInterval !== undefined) {
      this.setupAutoReload();
    }
  }

  /**
   * 清理资源
   */
  dispose(): void {
    if (this.reloadTimer) {
      clearInterval(this.reloadTimer);
      this.reloadTimer = null;
    }

    this.engine = null;
    this.loadedWorldBooks.clear();
    this.isInitialized = false;

    this.outputChannel.appendLine('[WorldBookTrigger] 触发词服务已清理');
  }

  /* ------------------ 私有方法 ------------------ */

  private async loadWorldBooks(): Promise<void> {
    if (!this.engine) return;

    const allEntries: WorldEntry[] = [];

    for (const filePath of this.config.worldBookFiles) {
      try {
        const result = await this.converter.loadFromFile(filePath);
        if (result.entryCount > 0) {
          // 转换为WorldEntry数组
          const entries = await this.parseWorldBookResult(result);
          this.loadedWorldBooks.set(filePath, entries);
          allEntries.push(...entries);

          this.outputChannel.appendLine(`[WorldBookTrigger] 加载世界书: ${filePath} (${entries.length} 词条)`);
        }
      } catch (error) {
        this.outputChannel.appendLine(`[WorldBookTrigger] 加载世界书失败 ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // 加载到引擎
    if (allEntries.length > 0) {
      await this.engine.loadWorldBookEntries(allEntries);
      this.outputChannel.appendLine(`[WorldBookTrigger] 总共加载了 ${allEntries.length} 个世界书词条`);
    }
  }

  private async parseWorldBookResult(result: WorldBookConversionResult): Promise<WorldEntry[]> {
    // 这里需要从转换结果中解析出原始的WorldEntry
    // 由于转换器目前只返回Markdown，我们需要修改转换器以保留原始数据
    // 暂时返回空数组，后续需要修改转换器
    return [];
  }

  private setupAutoReload(): void {
    if (this.reloadTimer) {
      clearInterval(this.reloadTimer);
      this.reloadTimer = null;
    }

    if (this.config.autoReloadWorldBooks && this.config.reloadInterval > 0) {
      const intervalMs = this.config.reloadInterval * 60 * 1000; // 转换为毫秒

      this.reloadTimer = setInterval(async () => {
        try {
          this.outputChannel.appendLine('[WorldBookTrigger] 自动重载世界书...');
          await this.loadWorldBooks();
          this.outputChannel.appendLine('[WorldBookTrigger] 自动重载完成');
        } catch (error) {
          this.outputChannel.appendLine(`[WorldBookTrigger] 自动重载失败: ${error instanceof Error ? error.message : String(error)}`);
        }
      }, intervalMs);

      this.outputChannel.appendLine(`[WorldBookTrigger] 设置自动重载,间隔: ${this.config.reloadInterval} 分钟`);
    }
  }

  private combineContent(constantContent: string, triggeredContent: string): string {
    const parts: string[] = [];

    if (constantContent) {
      parts.push('## 常驻知识库');
      parts.push(constantContent);
    }

    if (triggeredContent) {
      if (constantContent) {
        parts.push('---');
      }
      parts.push('## 触发知识库');
      parts.push(triggeredContent);
    }

    return parts.join('\n\n');
  }

  private formatEntryContent(entry: WorldBookTriggerEntry): string {
    const { entry: worldEntry } = entry;
    let content = '';

    // 添加标题
    const title = worldEntry.comment || worldEntry.key?.[0] || `词条 #${worldEntry.uid}`;
    content += `### ${title}\n\n`;

    // 添加关键词信息
    if (worldEntry.key && worldEntry.key.length > 0) {
      content += `**关键词：** ${worldEntry.key.join(' · ')}\n`;
    }
    if (worldEntry.keysecondary && worldEntry.keysecondary.length > 0) {
      content += `**同义词：** ${worldEntry.keysecondary.join(' · ')}\n`;
    }
    content += '\n';

    // 添加主要内容
    if (worldEntry.content) {
      content += worldEntry.content;
    } else {
      content += '*(暂无详细内容)*';
    }

    return content;
  }
}