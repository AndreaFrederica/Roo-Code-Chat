import React, { useState, useEffect } from 'react';
import {
  VSCodeButton,
  VSCodeCheckbox,
  VSCodeDivider,
  VSCodePanels,
  VSCodePanelTab,
  VSCodePanelView,
  VSCodeRadioGroup,
  VSCodeRadio,
} from '@vscode/webview-ui-toolkit/react';
import type { WorldBookInfo, WorldEntry, WorldBookEntryMixin } from '@roo-code/types';
import { WorldBookConfigForm } from './WorldBookConfigForm';
import { WorldBookList } from './WorldBookList';
import { WorldBookMixinModal } from './WorldBookMixinModal';

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
}

export const SillyTavernWorldBookSettings: React.FC<SillyTavernWorldBookSettingsProps> = ({ state, vscode }) => {
  const [worldBooks, setWorldBooks] = useState<WorldBookInfo[]>([]);
  const [globalWorldBooks, setGlobalWorldBooks] = useState<string[]>([]);
  const [originalConfigs, setOriginalConfigs] = useState<Record<string, WorldBookConfig>>({});
  const [configs, setConfigs] = useState<Record<string, WorldBookConfig>>({});
  const [originalActiveWorldBooks, setOriginalActiveWorldBooks] = useState<string[]>([]);
  const [activeWorldBooks, setActiveWorldBooks] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedWorldBook, setSelectedWorldBook] = useState<WorldBookInfo | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mixin相关状态
  const [showMixinModal, setShowMixinModal] = useState(false);
  const [selectedWorldBookForMixin, setSelectedWorldBookForMixin] = useState<WorldBookInfo | null>(null);
  const [currentScope, setCurrentScope] = useState<'all' | 'workspace' | 'global'>('all');

  useEffect(() => {
    if (state?.sillyTavernWorldBookState) {
      const wbState = state.sillyTavernWorldBookState;
      setWorldBooks(wbState.loadedWorldBooks || []);
      const newConfigs = wbState.configs || {};
      const newActiveBooks = wbState.activeWorldBooks || [];

      setOriginalConfigs(newConfigs);
      setConfigs(JSON.parse(JSON.stringify(newConfigs)));
      setOriginalActiveWorldBooks(newActiveBooks);
      setActiveWorldBooks([...newActiveBooks]);
      setHasChanges(false);
    }
  }, [state?.sillyTavernWorldBookState]);

  // 加载全局世界书列表
  useEffect(() => {
    const loadGlobalWorldBooks = async () => {
      try {
        const response = await vscode.postMessage({
          type: 'STWordBookGetGlobal'
        });
        if (response?.globalWorldBooks) {
          setGlobalWorldBooks(response.globalWorldBooks);
        }
      } catch (error) {
        console.error('Failed to load global world books:', error);
      }
    };

    loadGlobalWorldBooks();
  }, [vscode]);

  // 处理世界书操作
  const handleWorldBookToggle = async (filePath: string, enabled: boolean) => {
    setConfigs(prev => ({
      ...prev,
      [filePath]: { ...prev[filePath], enabled }
    }));

    setActiveWorldBooks(prev => {
      if (enabled && !prev.includes(filePath)) {
        return [...prev, filePath];
      } else if (!enabled && prev.includes(filePath)) {
        return prev.filter(path => path !== filePath);
      }
      return prev;
    });

    setHasChanges(true);
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

  const handleWorldBookReload = async (filePath: string) => {
    setIsLoading(true);
    try {
      await vscode.postMessage({
        type: 'STWordBookReload',
        worldBookFilePath: filePath
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
          worldBookFilePath: result.worldBookFilePath
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
            worldBookConfig: newConfig
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

  const handleWorldBookValidate = async (filePath: string) => {
    try {
      const validation = await vscode.postMessage({
        type: 'STWordBookValidate',
        worldBookFilePath: filePath
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

      const response = await vscode.postMessage({
        type: 'STWordBookGetGlobal'
      });
      if (response?.globalWorldBooks) {
        setGlobalWorldBooks(response.globalWorldBooks);
      }
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
    return new Promise((resolve, reject) => {
      console.log('Sending getWorldBookMixin message:', { worldBookPath: worldBook.path, isGlobal });

      // Create a unique message ID
      const messageId = `getWorldBookMixin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Set up a one-time message listener
      const handleMessage = (event: MessageEvent) => {
        const message = event.data;
        if (message.type === 'worldBookMixinLoaded') {
          window.removeEventListener('message', handleMessage);

          console.log('Received response:', message);
          if (message?.worldBookMixin) {
            const result = {
              entries: message.worldBookMixin.originalEntries || [],
              mixinEntries: message.worldBookMixin.entries || []
            };
            console.log('Returning result:', result);
            resolve(result);
          } else if (message.error) {
            console.error('Error in response:', message.error);
            reject(new Error(message.error));
          } else {
            console.log('No worldBookMixin in response, returning null');
            resolve(null);
          }
        }
      };

      // Add the listener
      window.addEventListener('message', handleMessage);

      // Send the message
      vscode.postMessage({
        type: 'getWorldBookMixin',
        worldBookPath: worldBook.path,
        isGlobal,
        messageId
      });

      // Set a timeout
      setTimeout(() => {
        window.removeEventListener('message', handleMessage);
        reject(new Error('Timeout waiting for world book mixin response'));
      }, 10000); // 10 seconds timeout
    });
  };

  const handleUpdateEntryMixin = async (entryUid: number | string, updates: Partial<WorldBookEntryMixin>) => {
    try {
      await vscode.postMessage({
        type: 'updateWorldBookEntryMixin',
        worldBookPath: selectedWorldBookForMixin?.path,
        entryUid,
        mixinUpdates: updates
      });
    } catch (error) {
      console.error('Failed to update entry mixin:', error);
      throw error;
    }
  };

  const handleRemoveEntryMixin = async (entryUid: number | string) => {
    try {
      await vscode.postMessage({
        type: 'removeWorldBookEntryMixin',
        worldBookPath: selectedWorldBookForMixin?.path,
        entryUid
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

  // 保存操作
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
        await vscode.postMessage({
          type: 'STWordBookAdd',
          worldBookConfig: configs[filePath]
        });
      }

      for (const filePath of updatedPaths) {
        await vscode.postMessage({
          type: 'STWordBookUpdate',
          worldBookFilePath: filePath,
          worldBookConfig: configs[filePath]
        });
      }

      for (const filePath of removedPaths) {
        await vscode.postMessage({
          type: 'STWordBookRemove',
          worldBookFilePath: filePath
        });
      }

      setOriginalConfigs(JSON.parse(JSON.stringify(configs)));
      setOriginalActiveWorldBooks([...activeWorldBooks]);
      setHasChanges(false);

      vscode.postMessage({
        type: 'showInfo',
        message: '世界书配置已保存'
      });

    } catch (error) {
      vscode.postMessage({
        type: 'showError',
        message: '保存失败: ' + (error instanceof Error ? error.message : String(error))
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setConfigs(JSON.parse(JSON.stringify(originalConfigs)));
    setActiveWorldBooks([...originalActiveWorldBooks]);
    setHasChanges(false);
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
  const getEnhancedWorldBooks = (): WorldBookInfo[] => {
    let filtered = [...worldBooks];

    // 为工作区世界书添加isGlobal标志
    filtered = filtered.map(wb => ({ ...wb, isGlobal: false }));

    // 添加全局世界书
    const globalWorldBookInfos: WorldBookInfo[] = globalWorldBooks.map(fileName => ({
      name: fileName.replace('.json', ''),
      path: `~/.anh-chat/worldbook/${fileName}`,
      entryCount: 0,
      fileSize: 0,
      lastModified: 0,
      loaded: true,
      isGlobal: true
    }));

    return [...filtered, ...globalWorldBookInfos];
  };

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
            ⚠️ 您有未保存的更改
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <VSCodeButton appearance="secondary" onClick={handleReset} disabled={isLoading}>
              重置
            </VSCodeButton>
            <VSCodeButton appearance="primary" onClick={handleSaveAll} disabled={isLoading}>
              保存所有更改
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

      <VSCodePanels>
        <VSCodePanelTab id="worldbook-list">世界书列表</VSCodePanelTab>
        <VSCodePanelTab id="worldbook-config">配置选项</VSCodePanelTab>

        <VSCodePanelView id="worldbook-list">
          <WorldBookList
            worldBooks={getEnhancedWorldBooks()}
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
                    setHasChanges(true);
                  }}
                />
              </div>
            </>
          )}
        </VSCodePanelView>

        <VSCodePanelView id="worldbook-config">
          <div className="settings-group">
            <h4>默认转换选项</h4>
            <p className="settings-description">
              这些选项将作为新添加世界书的默认配置。
            </p>

            <div className="form-group">
              <VSCodeCheckbox checked={showAdvanced} onChange={(e: any) => setShowAdvanced(e.target.checked)}>
                显示高级选项
              </VSCodeCheckbox>
            </div>

            <div className="form-group">
              <label>标题级别</label>
              <VSCodeRadioGroup value="2" orientation="horizontal">
                <VSCodeRadio value="1">H1</VSCodeRadio>
                <VSCodeRadio value="2">H2</VSCodeRadio>
                <VSCodeRadio value="3">H3</VSCodeRadio>
                <VSCodeRadio value="4">H4</VSCodeRadio>
              </VSCodeRadioGroup>
            </div>

            <div className="form-group">
              <label>标题策略</label>
              <VSCodeRadioGroup value="auto">
                <VSCodeRadio value="auto">自动 (comment → key → uid)</VSCodeRadio>
                <VSCodeRadio value="comment">优先使用注释</VSCodeRadio>
                <VSCodeRadio value="key">优先使用关键词</VSCodeRadio>
                <VSCodeRadio value="uid">优先使用ID</VSCodeRadio>
              </VSCodeRadioGroup>
            </div>

            <div className="form-group">
              <label>排序策略</label>
              <VSCodeRadioGroup value="order">
                <VSCodeRadio value="order">按排序字段</VSCodeRadio>
                <VSCodeRadio value="displayIndex">按显示索引</VSCodeRadio>
                <VSCodeRadio value="uid">按ID</VSCodeRadio>
                <VSCodeRadio value="title">按标题</VSCodeRadio>
                <VSCodeRadio value="none">不排序</VSCodeRadio>
              </VSCodeRadioGroup>
            </div>

            <div className="form-group">
              <VSCodeCheckbox checked={true}>
                包含元数据表格
              </VSCodeCheckbox>
            </div>

            <div className="form-group">
              <VSCodeCheckbox checked={true}>
                包含关键词信息
              </VSCodeCheckbox>
            </div>

            <div className="form-group">
              <VSCodeCheckbox checked={false}>
                包含已禁用的词条
              </VSCodeCheckbox>
            </div>

            {showAdvanced && (
              <>
                <VSCodeDivider />
                <h5>高级选项</h5>

                <div className="form-group">
                  <label>元数据格式</label>
                  <VSCodeRadioGroup value="table">
                    <VSCodeRadio value="table">表格格式</VSCodeRadio>
                    <VSCodeRadio value="yaml">YAML格式</VSCodeRadio>
                  </VSCodeRadioGroup>
                </div>
              </>
            )}
          </div>
        </VSCodePanelView>
      </VSCodePanels>

      {/* Mixin管理模态框 */}
      <WorldBookMixinModal
        isOpen={showMixinModal}
        onClose={handleCloseMixinModal}
        worldBook={selectedWorldBookForMixin}
        isGlobal={selectedWorldBookForMixin?.isGlobal || false}
        onLoadMixin={handleLoadMixin}
        onUpdateEntryMixin={handleUpdateEntryMixin}
        onRemoveEntryMixin={handleRemoveEntryMixin}
      />
    </div>
  );
};