import React, { useState, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import {
  VSCodeButton,
  VSCodeCheckbox,
  VSCodeDivider,
} from '@vscode/webview-ui-toolkit/react';
import type { WorldBookInfo, WorldEntry, WorldBookEntryMixin } from '@roo-code/types';
import { useMessageListener, createTemporaryListener } from "@/hooks/useMessageListener";
import { WorldBookConfigForm } from './WorldBookConfigForm';
import { WorldBookList } from './WorldBookList';
import { WorldBookMixinModal } from './WorldBookMixinModal';

// 路径工具函数
const joinPath = (basePath: string, fileName: string): string => {
  // 标准化路径分隔符
  const normalizedBasePath = basePath.replace(/[/\\]/g, '\\');
  return `${normalizedBasePath}\\${fileName}`;
};

const normalizePath = (path: string): string => {
  // 将所有路径分隔符标准化为反斜杠（Windows风格）
  return path.replace(/[/\\]/g, '\\');
};

interface WorldBookConfig {
  filePath: string;
  enabled: boolean;
  enabledFiles: string[];
  autoReload?: boolean;
  reloadInterval?: number;
  markdownOptions?: {
    headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
    titleStrategy?: 'auto' | 'comment' | 'key' | 'uid';
    includeDisabled?: boolean;
    sortBy?: 'order' | 'displayIndex' | 'uid' | 'title' | 'none';
    includeFrontMatter?: boolean;
    frontMatterStyle?: 'table' | 'yaml';
    includeKeys?: boolean;
  };
}

interface SillyTavernWorldBookSettingsProps {
  state: any;
  vscode: any;
  onHasChangesChange?: (hasChanges: boolean) => void;
  onSaveChanges?: () => Promise<void>;
  onResetChanges?: () => void;
}

const SillyTavernWorldBookSettings = forwardRef<
  { handleSaveAll: () => Promise<void> },
  SillyTavernWorldBookSettingsProps
>(({
  state,
  vscode,
  onHasChangesChange,
  onSaveChanges,
  onResetChanges
}, ref) => {
  const [worldBooks, setWorldBooks] = useState<WorldBookInfo[]>([]);
  const [globalWorldBooks, setGlobalWorldBooks] = useState<string[]>([]);
  const [globalWorldBooksPath, setGlobalWorldBooksPath] = useState<string>('');
  const [globalWorldBooksWithInfo, setGlobalWorldBooksWithInfo] = useState<any[]>([]);
  const [originalConfigs, setOriginalConfigs] = useState<Record<string, WorldBookConfig>>({});
  const [configs, setConfigs] = useState<Record<string, WorldBookConfig>>({});
  const [originalActiveWorldBooks, setOriginalActiveWorldBooks] = useState<string[]>([]);
  const [activeWorldBooks, setActiveWorldBooks] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedWorldBook, setSelectedWorldBook] = useState<WorldBookInfo | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 计算是否有变更
  const hasChanges = useMemo(() => {
    const configsChanged = JSON.stringify(originalConfigs) !== JSON.stringify(configs);
    const activeBooksChanged = JSON.stringify(originalActiveWorldBooks.sort()) !== JSON.stringify(activeWorldBooks.sort());
    return configsChanged || activeBooksChanged;
  }, [originalConfigs, configs, originalActiveWorldBooks, activeWorldBooks]);

  // Mixin相关状态
  const [showMixinModal, setShowMixinModal] = useState(false);
  const [selectedWorldBookForMixin, setSelectedWorldBookForMixin] = useState<WorldBookInfo | null>(null);
  const [currentScope, setCurrentScope] = useState<'all' | 'workspace' | 'global'>('all');

  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (state?.sillyTavernWorldBookState && !isInitialized) {
      const wbState = state.sillyTavernWorldBookState;
      setWorldBooks(wbState.loadedWorldBooks || []);
      const newConfigs = wbState.configs || {};
      const newActiveBooks = wbState.activeWorldBooks || [];

      setOriginalConfigs(newConfigs);
      setConfigs(JSON.parse(JSON.stringify(newConfigs)));
      setOriginalActiveWorldBooks(newActiveBooks);
      setActiveWorldBooks([...newActiveBooks]);
      setIsInitialized(true);
    }
  }, [state?.sillyTavernWorldBookState, isInitialized]);

  // 通知父组件变更状态
  useEffect(() => {
    onHasChangesChange?.(hasChanges);
  }, [hasChanges]);

  // 使用统一的消息监听 Hook 来处理全局世界书响应
  useMessageListener(['STWordBookGetGlobalResponse'], (message: any) => {
    console.log('Received STWordBookGetGlobalResponse:', message);
    if (message.globalWorldBooks) {
      console.log('Setting global world books:', message.globalWorldBooks);
      setGlobalWorldBooks(message.globalWorldBooks);
    } else {
      console.log('No global world books in response');
    }

    // 处理 globalWorldBooksPath
    if (message.globalWorldBooksPath) {
      console.log('Setting global world books path:', message.globalWorldBooksPath);
      setGlobalWorldBooksPath(message.globalWorldBooksPath);
    } else {
      console.log('No global world books path in response');
    }

    // 处理 globalWorldBooksWithInfo - 包含词条数的详细信息
    if (message.globalWorldBooksWithInfo) {
      console.log('Setting global world books with info:', message.globalWorldBooksWithInfo);
      console.log('globalWorldBooksWithInfo structure:', JSON.stringify(message.globalWorldBooksWithInfo, null, 2));
      setGlobalWorldBooksWithInfo(message.globalWorldBooksWithInfo);
    } else {
      console.log('No global world books with info in response');
    }
  }, []);

  // 加载全局世界书列表
  useEffect(() => {
    // 发送消息获取全局世界书列表
    vscode.postMessage({
      type: 'STWordBookGetGlobal'
    });
  }, [vscode]);

  // 处理世界书操作（使用scope-aware的worldbookKey）- 暂存模式
  const handleWorldBookToggle = (worldBookKey: string, enabled: boolean) => {
    // worldBookKey格式：path-scope
    // 这里我们需要根据scope决定如何处理
    const [filePath, scope] = worldBookKey.endsWith('-global')
      ? [worldBookKey.slice(0, -7), 'global']
      : [worldBookKey.slice(0, -10), 'workspace'];

    setConfigs(prev => {
      const existingConfig = prev[filePath] || {};
      const newEnabledFiles = enabled
        ? [...(existingConfig.enabledFiles || []), worldBookKey].filter((key, index, arr) => arr.indexOf(key) === index)
        : (existingConfig.enabledFiles || []).filter(key => key !== worldBookKey);

      // 创建默认配置
      const defaultConfig: WorldBookConfig = {
        filePath,
        enabled: false,
        enabledFiles: [],
        autoReload: true,
        reloadInterval: 5000,
        markdownOptions: {
          headingLevel: 2,
          titleStrategy: 'auto',
          includeDisabled: false,
          sortBy: 'order',
          includeFrontMatter: true,
          frontMatterStyle: 'table',
          includeKeys: true
        }
      };

      // 合并配置，当前状态优先
      const finalConfig: WorldBookConfig = {
        ...defaultConfig,
        ...existingConfig,
        filePath, // 确保filePath始终正确
        enabled,  // 当前启用状态
        enabledFiles: newEnabledFiles // 更新后的文件列表
      };

      return {
        ...prev,
        [filePath]: finalConfig
      };
    });

    setActiveWorldBooks(prev => {
      if (enabled && !prev.includes(worldBookKey)) {
        return [...prev, worldBookKey];
      } else if (!enabled && prev.includes(worldBookKey)) {
        return prev.filter(key => key !== worldBookKey);
      }
      return prev;
    });

    // 不再立即发送给后端，而是等待用户点击保存
  };

  const handleWorldBookDelete = async (worldBook: WorldBookInfo) => {
    const confirmed = await vscode.postMessage({
      type: 'showConfirm',
      message: '确定要删除这个世界书配置吗？'
    });

    if (confirmed) {
      await vscode.postMessage({
        type: 'STWordBookRemove',
        worldBook
      });
    }
  };

  const handleWorldBookReload = async (worldBookKey: string) => {
    setIsLoading(true);
    try {
      const [filePath, scope] = worldBookKey.endsWith('-global')
        ? [worldBookKey.slice(0, -7), 'global']
        : [worldBookKey.slice(0, -10), 'workspace'];

      await vscode.postMessage({
        type: 'STWordBookReload',
        worldBookFilePath: filePath,
        worldBookScope: scope
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleWorldBookBrowse = async () => {
    const result = await vscode.postMessage({
      type: 'STWordBookBrowse'
    });

    if (result?.worldBookFilePath) {
      setIsLoading(true);
      try {
        const validation = await vscode.postMessage({
          type: 'STWordBookValidate',
          worldBookFilePath: result.worldBookFilePath,
          worldBookScope: 'workspace' // 验证默认为工作区范围
        });

        if (validation?.worldBookValid) {
          const newConfig: WorldBookConfig = {
            filePath: result.worldBookFilePath,
            enabled: true,
            enabledFiles: [], // 新配置默认没有启用的文件
            autoReload: true,
            reloadInterval: 5000,
            markdownOptions: {
              headingLevel: 2,
              titleStrategy: 'auto',
              includeDisabled: false,
              sortBy: 'order',
              includeFrontMatter: true,
              frontMatterStyle: 'table',
              includeKeys: true
            }
          };

          await vscode.postMessage({
            type: 'STWordBookAdd',
            worldBookConfig: newConfig,
            worldBookScope: 'workspace' // 新添加的默认为工作区范围
          });
        } else {
          vscode.postMessage({
            type: 'showError',
            message: validation?.worldBookValidationError || '无效的世界书文件'
          });
        }
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleWorldBookValidate = async (worldBookKey: string) => {
    try {
      const [filePath, scope] = worldBookKey.endsWith('-global')
        ? [worldBookKey.slice(0, -7), 'global']
        : [worldBookKey.slice(0, -10), 'workspace'];

      const validation = await vscode.postMessage({
        type: 'STWordBookValidate',
        worldBookFilePath: filePath,
        worldBookScope: scope
      });

      if (!validation?.worldBookValid) {
        vscode.postMessage({
          type: 'showError',
          message: validation?.worldBookValidationError || '文件验证失败'
        });
      }
    } catch (error) {
      console.error('Failed to validate world book:', error);
    }
  };

  const handleCopyToGlobal = async (filePath: string) => {
    try {
      await vscode.postMessage({
        type: 'STWordBookCopyToGlobal',
        worldBookFilePath: filePath
      });

      // 刷新全局世界书列表
      vscode.postMessage({
        type: 'STWordBookGetGlobal'
      });
    } catch (error) {
      console.error('Failed to copy world book to global:', error);
    }
  };

  const handleCopyFromGlobal = async (fileName: string) => {
    try {
      await vscode.postMessage({
        type: 'STWordBookCopyFromGlobal',
        worldBookFileName: fileName
      });
    } catch (error) {
      console.error('Failed to copy world book from global:', error);
    }
  };

  // Mixin操作
  const handleOpenMixinManager = (worldBook: WorldBookInfo) => {
    console.log('Opening mixin manager for:', worldBook.name, 'Path:', worldBook.path);
    setSelectedWorldBookForMixin(worldBook);
    setShowMixinModal(true);
  };

  const handleCloseMixinModal = () => {
    setShowMixinModal(false);
    setSelectedWorldBookForMixin(null);
  };

  const handleLoadMixin = (worldBook: WorldBookInfo, isGlobal: boolean): Promise<{
    entries: WorldEntry[];
    mixinEntries: WorldBookEntryMixin[];
  } | null> => {
    console.log('Sending getWorldBookMixin message:', { worldBookPath: worldBook.path, isGlobal });

    // Create a unique message ID
    const messageId = `getWorldBookMixin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 使用统一的临时监听器，不设置超时
    const mixinListener = createTemporaryListener(['worldBookMixinLoaded'], {
      debug: true
    });

    // Send the message
    vscode.postMessage({
      type: 'getWorldBookMixin',
      worldBookPath: worldBook.path,
      isGlobal,
      worldBookScope: isGlobal ? 'global' : 'workspace',
      messageId
    });

    // 处理响应
    return mixinListener.promise
      .then((message: any) => {
        console.log('Received response:', message);
        if (message?.worldBookMixin) {
          const result = {
            entries: message.worldBookMixin.originalEntries || [],
            mixinEntries: message.worldBookMixin.entries || []
          };
          console.log('Returning result:', result);
          return result;
        } else if (message.error) {
          console.error('Error in response:', message.error);
          throw new Error(message.error);
        } else {
          console.log('No worldBookMixin in response, returning null');
          return null;
        }
      })
      .finally(() => {
        // 确保监听器被清理
        mixinListener.cleanup();
      });
  };

  const handleUpdateEntryMixin = async (entryUid: number | string, updates: Partial<WorldBookEntryMixin>) => {
    try {
      if (!selectedWorldBookForMixin) return;

      await vscode.postMessage({
        type: 'updateWorldBookEntryMixin',
        worldBookPath: selectedWorldBookForMixin.path,
        entryUid,
        mixinUpdates: updates,
        isGlobal: selectedWorldBookForMixin.scope === 'global',
        worldBookScope: selectedWorldBookForMixin.scope
      });
    } catch (error) {
      console.error('Failed to update entry mixin:', error);
      throw error;
    }
  };

  const handleRemoveEntryMixin = async (entryUid: number | string) => {
    try {
      if (!selectedWorldBookForMixin) return;

      await vscode.postMessage({
        type: 'removeWorldBookEntryMixin',
        worldBookPath: selectedWorldBookForMixin.path,
        entryUid,
        isGlobal: selectedWorldBookForMixin.scope === 'global',
        worldBookScope: selectedWorldBookForMixin.scope
      });
    } catch (error) {
      console.error('Failed to remove entry mixin:', error);
      throw error;
    }
  };

  // 配置表单操作
  const handleOpenConfigForm = (worldBook?: WorldBookInfo) => {
    setSelectedWorldBook(worldBook || null);
  };

  // 保存操作 - 通过父组件的统一保存机制调用
  const handleSaveAll = async () => {
    try {
      setIsLoading(true);

      const originalPaths = new Set(Object.keys(originalConfigs));
      const currentPaths = new Set(Object.keys(configs));

      const addedPaths = [...currentPaths].filter(path => !originalPaths.has(path));
      const removedPaths = [...originalPaths].filter(path => !currentPaths.has(path));
      const updatedPaths = [...currentPaths].filter(path => {
        if (originalPaths.has(path)) {
          const original = originalConfigs[path];
          const current = configs[path];
          return JSON.stringify(original) !== JSON.stringify(current);
        }
        return false;
      });

      for (const filePath of addedPaths) {
        // 检查这个配置是否来自全局世界书
        const isGlobal = globalWorldBooks.some(fileName => {
          // 使用本地状态中的全局世界书路径进行判断
          const globalPath = globalWorldBooksPath 
            ? joinPath(globalWorldBooksPath, fileName)
            : joinPath('~/.anh-chat/worldbook', fileName);
          
          return normalizePath(filePath).includes(normalizePath(globalPath)) ||
                 filePath.includes(fileName.replace('.json', ''));
        });

        await vscode.postMessage({
          type: 'STWordBookAdd',
          worldBookConfig: configs[filePath],
          worldBookScope: isGlobal ? 'global' : 'workspace'
        });
      }

      for (const filePath of updatedPaths) {
        // 检查这个配置是否来自全局世界书
        const isGlobal = globalWorldBooks.some(fileName => {
          // 使用本地状态中的全局世界书路径进行判断
          const globalPath = globalWorldBooksPath 
            ? joinPath(globalWorldBooksPath, fileName)
            : joinPath('~/.anh-chat/worldbook', fileName);
          
          return normalizePath(filePath).includes(normalizePath(globalPath)) ||
                 filePath.includes(fileName.replace('.json', ''));
        });

        await vscode.postMessage({
          type: 'STWordBookUpdate',
          worldBookFilePath: filePath,
          worldBookConfig: configs[filePath],
          worldBookScope: isGlobal ? 'global' : 'workspace'
        });
      }

      for (const filePath of removedPaths) {
        // 检查这个配置是否来自全局世界书
        const isGlobal = globalWorldBooks.some(fileName => {
          // 使用本地状态中的全局世界书路径进行判断
          const globalPath = globalWorldBooksPath 
            ? joinPath(globalWorldBooksPath, fileName)
            : joinPath('~/.anh-chat/worldbook', fileName);
          
          return normalizePath(filePath).includes(normalizePath(globalPath)) ||
                 filePath.includes(fileName.replace('.json', ''));
        });

        await vscode.postMessage({
          type: 'STWordBookRemove',
          worldBookFilePath: filePath,
          worldBookScope: isGlobal ? 'global' : 'workspace'
        });
      }

      // 保存成功后，更新原始状态为当前状态，这样hasChanges会变为false
      setOriginalConfigs(JSON.parse(JSON.stringify(configs)));
      setOriginalActiveWorldBooks([...activeWorldBooks]);

      vscode.postMessage({
        type: 'showInfo',
        message: '世界书配置已保存'
      });

    } catch (error) {
      vscode.postMessage({
        type: 'showError',
        message: '保存失败: ' + (error instanceof Error ? error.message : String(error))
      });
      throw error; // 重新抛出错误以便父组件处理
    } finally {
      setIsLoading(false);
    }
  };

  // 使用useImperativeHandle暴露handleSaveAll方法给父组件
  useImperativeHandle(ref, () => ({
    handleSaveAll
  }), [handleSaveAll]);

  // 使用useEffect来响应onSaveChanges的调用（保持向后兼容）
  useEffect(() => {
    if (onSaveChanges) {
      // 将handleSaveAll方法暴露给父组件
      (onSaveChanges as any).current = handleSaveAll;
    }
  }, [onSaveChanges, handleSaveAll]);

  const handleReset = () => {
    // 使用父组件提供的重置方法，如果没有则使用本地重置
    if (onResetChanges) {
      onResetChanges();
    } else {
      setConfigs(JSON.parse(JSON.stringify(originalConfigs)));
      setActiveWorldBooks([...originalActiveWorldBooks]);
    }
    // 重置初始化标志，允许重新从state初始化
    setIsInitialized(false);
  };

  // 准备世界书配置
  const worldBookConfig: WorldBookConfig = {
    filePath: '',
    enabled: true,
    enabledFiles: activeWorldBooks,
    autoReload: true,
    reloadInterval: 5000,
    markdownOptions: {
      headingLevel: 2,
      titleStrategy: 'auto',
      includeDisabled: false,
      sortBy: 'order',
      includeFrontMatter: true,
      frontMatterStyle: 'table',
      includeKeys: true
    }
  };

  // 获取增强的世界书列表
  const enhancedWorldBooks = useMemo((): WorldBookInfo[] => {
    let filtered = [...worldBooks];

    // 为工作区世界书添加scope标志
    filtered = filtered.map(wb => ({ ...wb, scope: 'workspace' as const }));

    // 添加全局世界书
    const globalWorldBookInfos: WorldBookInfo[] = globalWorldBooks.map(fileName => {
      // 使用本地状态中的全局世界书路径信息，如果没有则使用文件名作为标识
      const globalPath = globalWorldBooksPath 
        ? joinPath(globalWorldBooksPath, fileName)
        : fileName;
      
      // 查找对应的详细信息
      const detailedInfo = globalWorldBooksWithInfo.find(info => info.fileName === fileName);
      console.log(`Looking for ${fileName}, found:`, detailedInfo);
      
      return {
        name: fileName.replace('.json', ''),
        path: globalPath,
        entryCount: detailedInfo?.entryCount || 0,
        fileSize: detailedInfo?.fileSize || 0,
        lastModified: detailedInfo?.lastModified || 0,
        loaded: detailedInfo?.loaded || true,
        scope: 'global' as const
      };
    });

    
    return [...filtered, ...globalWorldBookInfos];
  }, [worldBooks, globalWorldBooks, globalWorldBooksPath]);

  return (
    <div className="settings-section">
      <h3>SillyTavern 世界书设置</h3>
      <p className="settings-description">
        管理SillyTavern格式的世界书文件，支持自动转换为Markdown并集成到对话中。
      </p>

      {hasChanges && (
        <div className="settings-alert" style={{
          backgroundColor: 'var(--vscode-inputValidation-warningBackground)',
          border: '1px solid var(--vscode-inputValidation-warningBorder)',
          borderRadius: '4px',
          padding: '8px 12px',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ color: 'var(--vscode-inputValidation-warningForeground)' }}>
            ⚠️ 世界书设置有未保存的更改
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <VSCodeButton appearance="secondary" onClick={handleReset} disabled={isLoading}>
              重置更改
            </VSCodeButton>
          </div>
        </div>
      )}

      {error && (
        <div className="settings-error" style={{
          backgroundColor: 'var(--vscode-errorBackground)',
          color: 'var(--vscode-errorForeground)',
          padding: '8px 12px',
          borderRadius: '4px',
          marginBottom: '16px'
        }}>
          错误: {error}
        </div>
      )}

      <div className="settings-content">
        <WorldBookList
          worldBooks={enhancedWorldBooks}
          worldBookConfig={worldBookConfig}
          isLoading={isLoading}
          error={error}
          currentScope={currentScope}
          onScopeChange={setCurrentScope}
          onWorldBookToggle={handleWorldBookToggle}
          onWorldBookDelete={handleWorldBookDelete}
          onWorldBookReload={handleWorldBookReload}
          onWorldBookBrowse={handleWorldBookBrowse}
          onWorldBookValidate={handleWorldBookValidate}
          onCopyToGlobal={handleCopyToGlobal}
          onCopyFromGlobal={handleCopyFromGlobal}
          onOpenMixinManager={handleOpenMixinManager}
          onOpenConfigForm={handleOpenConfigForm}
        />

        {selectedWorldBook && configs[selectedWorldBook.path] && (
          <>
            <VSCodeDivider />
            <div className="settings-group">
              <div className="settings-group-header">
                <h4>配置: {selectedWorldBook.name}</h4>
                <VSCodeButton
                  appearance="secondary"
                  onClick={() => setSelectedWorldBook(null)}
                >
                  关闭
                </VSCodeButton>
              </div>

              <WorldBookConfigForm
                config={configs[selectedWorldBook.path]}
                onChange={(updates: any) => {
                  setConfigs(prev => ({
                    ...prev,
                    [selectedWorldBook.path]: { ...prev[selectedWorldBook.path], ...updates }
                  }));
                }}
              />
            </div>
          </>
        )}
      </div>

      {/* Mixin管理模态框 */}
      <WorldBookMixinModal
        isOpen={showMixinModal}
        onClose={handleCloseMixinModal}
        worldBook={selectedWorldBookForMixin}
        isGlobal={selectedWorldBookForMixin?.scope === 'global' || false}
        onLoadMixin={handleLoadMixin}
        onUpdateEntryMixin={handleUpdateEntryMixin}
        onRemoveEntryMixin={handleRemoveEntryMixin}
      />
    </div>
  );
});

export { SillyTavernWorldBookSettings };
