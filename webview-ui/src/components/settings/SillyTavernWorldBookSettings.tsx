import React, { useState, useEffect } from 'react';
import {
  VSCodeButton,
  VSCodeCheckbox,
  VSCodeTextField,
  VSCodeDivider,
  VSCodePanels,
  VSCodePanelTab,
  VSCodePanelView,
  VSCodePanelView as VSCodePanel,
  VSCodeRadioGroup,
  VSCodeRadio,
  VSCodeTextArea
} from '@vscode/webview-ui-toolkit/react';

interface WorldBookConfig {
  filePath: string;
  enabled: boolean;
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

interface WorldBookInfo {
  name: string;
  path: string;
  entryCount: number;
  fileSize: number;
  lastModified: number;
  loaded: boolean;
  error?: string;
}

interface SillyTavernWorldBookSettingsProps {
  state: any;
  vscode: any;
}

export const SillyTavernWorldBookSettings: React.FC<SillyTavernWorldBookSettingsProps> = ({ state, vscode }) => {
  const [worldBooks, setWorldBooks] = useState<WorldBookInfo[]>([]);
  const [originalConfigs, setOriginalConfigs] = useState<Record<string, WorldBookConfig>>({});
  const [configs, setConfigs] = useState<Record<string, WorldBookConfig>>({});
  const [originalActiveWorldBooks, setOriginalActiveWorldBooks] = useState<string[]>([]);
  const [activeWorldBooks, setActiveWorldBooks] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedWorldBook, setSelectedWorldBook] = useState<WorldBookInfo | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (state?.sillyTavernWorldBookState) {
      const wbState = state.sillyTavernWorldBookState;
      setWorldBooks(wbState.loadedWorldBooks || []);
      const newConfigs = wbState.configs || {};
      const newActiveBooks = wbState.activeWorldBooks || [];

      setOriginalConfigs(newConfigs);
      setConfigs(JSON.parse(JSON.stringify(newConfigs))); // 深拷贝
      setOriginalActiveWorldBooks(newActiveBooks);
      setActiveWorldBooks([...newActiveBooks]); // 浅拷贝
      setHasChanges(false);
    }
  }, [state?.sillyTavernWorldBookState]);

  const handleAddWorldBook = async () => {
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

  const handleToggleWorldBook = (filePath: string, enabled: boolean) => {
    // 更新本地状态
    setConfigs(prev => ({
      ...prev,
      [filePath]: { ...prev[filePath], enabled }
    }));

    // 更新激活列表
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

  const handleRemoveWorldBook = async (filePath: string) => {
    const confirmed = await vscode.postMessage({
      type: 'showConfirm',
      message: '确定要删除这个世界书配置吗？'
    });

    if (confirmed) {
      await vscode.postMessage({
        type: 'STWordBookRemove',
        worldBookFilePath: filePath
      });
    }
  };

  const handleReloadWorldBook = async (filePath: string) => {
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

  const handleConfigChange = (filePath: string, updates: Partial<WorldBookConfig>) => {
    setConfigs(prev => ({
      ...prev,
      [filePath]: { ...prev[filePath], ...updates }
    }));
    setHasChanges(true);
  };

  const handleSaveAll = async () => {
    try {
      setIsLoading(true);

      // 计算需要添加、更新、删除的配置
      const originalPaths = new Set(Object.keys(originalConfigs));
      const currentPaths = new Set(Object.keys(configs));

      // 找出新增的配置
      const addedPaths = [...currentPaths].filter(path => !originalPaths.has(path));
      // 找出删除的配置
      const removedPaths = [...originalPaths].filter(path => !currentPaths.has(path));
      // 找出更新的配置
      const updatedPaths = [...currentPaths].filter(path => {
        if (originalPaths.has(path)) {
          const original = originalConfigs[path];
          const current = configs[path];
          return JSON.stringify(original) !== JSON.stringify(current);
        }
        return false;
      });

      // 批量发送更新请求
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

      // 更新原始状态
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

  const handleSaveConfig = async (filePath: string) => {
    // 单个配置保存现在标记为有变化，等待全局保存
    setHasChanges(true);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
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

      <VSCodePanels>
        <VSCodePanelTab id="worldbook-list">世界书列表</VSCodePanelTab>
        <VSCodePanelTab id="worldbook-config">配置选项</VSCodePanelTab>

        <VSCodePanelView id="worldbook-list">
          <div className="settings-group">
            <div className="settings-group-header">
              <h4>已加载的世界书</h4>
              <VSCodeButton onClick={handleAddWorldBook} disabled={isLoading}>
                添加世界书
              </VSCodeButton>
            </div>

            {worldBooks.length === 0 ? (
              <div className="empty-state">
                <p>暂无世界书文件</p>
                <p className="empty-state-hint">
                  将SillyTavern格式的世界书JSON文件放置在
                  <code>novel-helper/.anh-chat/worldbook/</code>目录下，
                  或点击"添加世界书"按钮手动选择。
                </p>
              </div>
            ) : (
              <div className="worldbook-list">
                {worldBooks.map((worldBook) => {
                  const config = configs[worldBook.path];
                  const isActive = activeWorldBooks.includes(worldBook.path);

                  return (
                    <div key={worldBook.path} className="worldbook-item">
                      <div className="worldbook-header">
                        <div className="worldbook-info">
                          <h5>{worldBook.name}</h5>
                          <p className="worldbook-path">{worldBook.path}</p>
                          <div className="worldbook-stats">
                            <span>{worldBook.entryCount} 词条</span>
                            <span>{formatFileSize(worldBook.fileSize)}</span>
                            <span>更新于 {formatDate(worldBook.lastModified)}</span>
                          </div>
                        </div>
                        <div className="worldbook-actions">
                          <VSCodeCheckbox
                            checked={isActive}
                            onChange={(e: any) => handleToggleWorldBook(worldBook.path, e.target.checked)}
                          >
                            启用
                          </VSCodeCheckbox>
                          <VSCodeButton
                            appearance="icon"
                            onClick={() => setSelectedWorldBook(worldBook)}
                            title="配置"
                          >
                            ⚙️
                          </VSCodeButton>
                          <VSCodeButton
                            appearance="icon"
                            onClick={() => handleReloadWorldBook(worldBook.path)}
                            disabled={isLoading}
                            title="重新加载"
                          >
                            🔄
                          </VSCodeButton>
                          <VSCodeButton
                            appearance="icon"
                            onClick={() => handleRemoveWorldBook(worldBook.path)}
                            title="删除"
                          >
                            🗑️
                          </VSCodeButton>
                        </div>
                      </div>

                      {worldBook.error && (
                        <div className="worldbook-error">
                          <p>❌ {worldBook.error}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {selectedWorldBook && (
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

                {configs[selectedWorldBook.path] && (
                  <WorldBookConfigForm
                    config={configs[selectedWorldBook.path]}
                    onChange={(updates) => handleConfigChange(selectedWorldBook.path, updates)}
                  />
                )}
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

                <div className="form-group">
                  <label>内容过滤器</label>
                  <div className="form-row">
                    <div className="form-field">
                      <label>最大内容长度 (0=无限制)</label>
                      <VSCodeTextField value="0" />
                    </div>
                    <div className="form-field">
                      <VSCodeCheckbox checked={true}>
                        清理HTML标签
                      </VSCodeCheckbox>
                    </div>
                    <div className="form-field">
                      <VSCodeCheckbox checked={true}>
                        标准化空白字符
                      </VSCodeCheckbox>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </VSCodePanelView>
      </VSCodePanels>
    </div>
  );
};

interface WorldBookConfigFormProps {
  config: WorldBookConfig;
  onChange: (updates: Partial<WorldBookConfig>) => void;
}

const WorldBookConfigForm: React.FC<WorldBookConfigFormProps> = ({ config, onChange }) => {
  return (
    <div className="worldbook-config-form">
      <div className="form-group">
        <VSCodeCheckbox
          checked={config.enabled}
          onChange={(e: any) => onChange({ enabled: e.target.checked })}
        >
          启用此世界书
        </VSCodeCheckbox>
      </div>

      <div className="form-group">
        <VSCodeCheckbox
          checked={config.autoReload}
          onChange={(e: any) => onChange({ autoReload: e.target.checked })}
        >
          自动重载 (文件变化时自动更新)
        </VSCodeCheckbox>
      </div>

      <div className="form-group">
        <label>重载间隔 (毫秒)</label>
        <VSCodeTextField
          value={String(config.reloadInterval || 5000)}
          onChange={(e: any) => onChange({ reloadInterval: parseInt(e.target.value) || 5000 })}
        />
      </div>

      <div className="form-actions">
        <p style={{
          fontSize: '12px',
          color: 'var(--vscode-descriptionForeground)',
          fontStyle: 'italic',
          margin: 0
        }}>
          ⚠️ 配置更改将在点击"保存所有更改"后生效
        </p>
      </div>
    </div>
  );
};