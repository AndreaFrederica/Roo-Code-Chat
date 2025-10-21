/**
 * SillyTavern世界书触发词服务
 * 集成世界书触发词引擎到ANH Chat系统中
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { createHash } from 'crypto';
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
   * 同步世界书文件列表
   */
  async setWorldBookFiles(filePaths: string[], options: { reload?: boolean } = {}): Promise<void> {
    const { reload = true } = options;
    const normalized = Array.from(
      new Set(
        filePaths
          .filter(Boolean)
          .map((filePath) => path.resolve(filePath)),
      ),
    );

    const current = new Set(this.config.worldBookFiles.map((filePath) => path.resolve(filePath)));
    let hasChanged = normalized.length !== this.config.worldBookFiles.length;

    if (!hasChanged) {
      for (const filePath of normalized) {
        if (!current.has(filePath)) {
          hasChanged = true;
          break;
        }
      }
    }

    if (!hasChanged) {
      return;
    }

    this.config.worldBookFiles = normalized;
    this.outputChannel.appendLine(`[WorldBookTrigger] 同步世界书文件列表: ${normalized.length} 个文件`);

    if (!this.isInitialized || !reload) {
      return;
    }

    await this.loadWorldBooks();
    this.setupAutoReload();
  }

  /**
   * 处理消息并生成触发内容
   */
	async processMessage(
		message: ChatMessage,
		conversationHistory: ChatMessage[] = [],
	): Promise<TriggeredContent | null> {
		if (!this.isInitialized || !this.engine) {
			return null
		}

		try {
			const maxDepth = this.config.triggerConfig.maxRecursiveDepth ?? 0
			const aggregate = await this.processMessageRecursive(
				message,
				conversationHistory,
				0,
				maxDepth,
				new Set<string>(),
				new Set<string>(),
				new Set<string>(),
			)

			if (aggregate.injectedCount === 0 && aggregate.constantContents.size === 0) {
				return null
			}

			const constantContent = Array.from(aggregate.constantContents).join("\n\n---\n\n")
			const triggeredContent = Array.from(aggregate.triggeredContents).join("\n\n---\n\n")

			const fullParts: string[] = []
			if (constantContent) {
				fullParts.push(constantContent)
			}
			if (triggeredContent) {
				fullParts.push(triggeredContent)
			}

			const result: TriggeredContent = {
				constantContent,
				triggeredContent,
				fullContent: fullParts.join("\n\n---\n\n"),
				injectedCount: aggregate.injectedCount,
				duration: aggregate.duration,
			}

			if (this.config.triggerConfig.debugMode) {
				this.outputChannel.appendLine(
					`[WorldBookTrigger] 处理消息完成，注入 ${result.injectedCount} 个词条（深度 ${maxDepth}）`,
				)
				if (result.triggeredContent) {
					this.outputChannel.appendLine(
						`[WorldBookTrigger] 触发内容预览: ${result.triggeredContent.substring(0, 100)}...`,
					)
				}
			}

			return result
		} catch (error) {
			this.outputChannel.appendLine(
				`[WorldBookTrigger] 处理消息失败: ${error instanceof Error ? error.message : String(error)}`,
			)
			return null
		}
	}

	private async processMessageRecursive(
		message: ChatMessage,
		conversationHistory: ChatMessage[],
		depth: number,
		maxDepth: number,
		processedKeys: Set<string>,
		constantContents: Set<string>,
		triggeredContents: Set<string>,
	): Promise<{
		constantContents: Set<string>
		triggeredContents: Set<string>
		injectedCount: number
		duration: number
	}> {
		if (!this.engine) {
			return { constantContents, triggeredContents, injectedCount: 0, duration: 0 }
		}

		const result = await this.engine.processMessage(message, conversationHistory)

		let injectedCount = 0
		const newTriggeredChunks: string[] = []

		for (const action of result.actions) {
			const key = this.getActionKey(action)
			if (processedKeys.has(key)) {
				continue
			}

			processedKeys.add(key)
			injectedCount += 1

			if (action.type === "inject_constant") {
				constantContents.add(action.content)
			} else if (action.type === "inject_entry") {
				triggeredContents.add(action.content)
				newTriggeredChunks.push(action.content)
			}
		}

		let totalDuration = result.duration

		if (depth < maxDepth && newTriggeredChunks.length > 0) {
			const combinedContent = newTriggeredChunks.join("\n\n")
			if (combinedContent.trim().length > 0) {
				const recursiveMessage: ChatMessage = {
					role: "assistant",
					content: combinedContent,
					timestamp: Date.now(),
				}

				const recursionResult = await this.processMessageRecursive(
					recursiveMessage,
					[...conversationHistory, message],
					depth + 1,
					maxDepth,
					processedKeys,
					constantContents,
					triggeredContents,
				)

				injectedCount += recursionResult.injectedCount
				totalDuration += recursionResult.duration
			}
		}

		return {
			constantContents,
			triggeredContents,
			injectedCount,
			duration: totalDuration,
		}
	}

	private getActionKey(action: InjectionResult["actions"][number]): string {
		if (action.entryId) {
			return action.entryId
		}

		return createHash("sha1").update(action.content || "").digest("hex")
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
    const seen = new Set<string>();
    this.loadedWorldBooks.clear();

    for (const filePath of this.config.worldBookFiles) {
      try {
        const result = await this.converter.loadFromFile(filePath);
        if (result.entryCount > 0) {
          const entries = await this.parseWorldBookResult(result);
          if (entries.length > 0) {
            this.loadedWorldBooks.set(filePath, entries);
            for (const entry of entries) {
              const key = `${entry.uid ?? entry.comment ?? entry.key?.[0] ?? path.basename(filePath)}_${filePath}`;
              if (!seen.has(key)) {
                seen.add(key);
                allEntries.push(entry);
              }
            }

            this.outputChannel.appendLine(`[WorldBookTrigger] 加载世界书: ${filePath} (${entries.length} 词条)`);
          } else {
            this.outputChannel.appendLine(`[WorldBookTrigger] 世界书未解析出有效词条: ${filePath}`);
          }
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
    if (!result.entries || result.entries.length === 0) {
      return [];
    }

    const normalizeKeyValue = (value: unknown): string | null => {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
      }
      if (typeof value === 'number' || typeof value === 'boolean') {
        const normalized = String(value).trim();
        return normalized.length > 0 ? normalized : null;
      }
      return null;
    };

    const normalizeKeyArray = (values: unknown): string[] => {
      if (Array.isArray(values)) {
        return values
          .map(normalizeKeyValue)
          .filter((key): key is string => key !== null);
      }

      const single = normalizeKeyValue(values);
      return single ? [single] : [];
    };

    return result.entries.map((entry) => {
      const primaryKeys = normalizeKeyArray(entry.key);
      const secondaryKeys = normalizeKeyArray(entry.keysecondary);

      const normalizedEntry: WorldEntry = {
        ...entry,
        key: primaryKeys.length > 0 ? primaryKeys : undefined,
        keysecondary: secondaryKeys.length > 0 ? secondaryKeys : undefined,
      };

      return normalizedEntry;
    });
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
