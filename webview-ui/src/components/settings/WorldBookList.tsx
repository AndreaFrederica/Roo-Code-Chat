import React, { useState, useMemo, useCallback } from 'react';
import { VSCodeButton } from '@vscode/webview-ui-toolkit/react';
import { VSCodeCheckbox } from '@vscode/webview-ui-toolkit/react';
import { Globe, Folder, Trash2, Settings, RefreshCw, Copy, Edit3, Eye, EyeOff } from 'lucide-react';
import type { WorldBookInfo } from '@roo-code/types';

interface WorldBookConfig {
  filePath: string;
  enabled: boolean;
  enabledFiles: string[];
}

interface WorldBookListProps {
  worldBooks: WorldBookInfo[];
  worldBookConfig: WorldBookConfig;
  isLoading: boolean;
  error: string | null;
  currentScope: 'all' | 'workspace' | 'global';
  onScopeChange: (scope: 'all' | 'workspace' | 'global') => void;
  onWorldBookToggle: (worldBookKey: string, enabled: boolean) => void;
  onWorldBookDelete: (worldBook: WorldBookInfo) => void;
  onWorldBookReload: (worldBookKey: string) => void;
  onWorldBookBrowse: () => void;
  onWorldBookValidate: (worldBookKey: string) => void;
  onCopyToGlobal: (filePath: string) => void;
  onCopyFromGlobal: (fileName: string) => void;
  onOpenMixinManager: (worldBook: WorldBookInfo) => void;
  onOpenConfigForm: (worldBook?: WorldBookInfo) => void;
}

export const WorldBookList: React.FC<WorldBookListProps> = ({
  worldBooks,
  worldBookConfig,
  isLoading,
  error,
  currentScope,
  onScopeChange,
  onWorldBookToggle,
  onWorldBookDelete,
  onWorldBookReload,
  onWorldBookBrowse,
  onWorldBookValidate,
  onCopyToGlobal,
  onCopyFromGlobal,
  onOpenMixinManager,
  onOpenConfigForm
}) => {
  const [deletingWorldBook, setDeletingWorldBook] = useState<string | null>(null);
  const [validatingFile, setValidatingFile] = useState<string | null>(null);

  // 过滤世界书
  const filteredWorldBooks = useMemo(() => {
    let filtered = [...worldBooks];

    if (currentScope === 'workspace') {
      filtered = filtered.filter(wb => wb.scope !== 'global');
    } else if (currentScope === 'global') {
      filtered = filtered.filter(wb => wb.scope === 'global');
    }

    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [worldBooks, currentScope]);

  const handleDeleteWorldBook = useCallback(async (worldBook: WorldBookInfo) => {
    const worldBookKey = `${worldBook.path}-${worldBook.scope === 'global' ? 'global' : 'workspace'}`;
    setDeletingWorldBook(worldBookKey);
    try {
      await onWorldBookDelete(worldBook);
    } finally {
      setDeletingWorldBook(null);
    }
  }, [onWorldBookDelete]);

  const handleValidateFile = useCallback(async (worldBook: WorldBookInfo) => {
    const worldBookKey = `${worldBook.path}-${worldBook.scope === 'global' ? 'global' : 'workspace'}`;
    setValidatingFile(worldBookKey);
    try {
      await onWorldBookValidate(worldBookKey);
    } finally {
      setValidatingFile(null);
    }
  }, [onWorldBookValidate]);

  return (
    <div className="worldbook-list">
      {/* 工具栏 */}
      <div className="worldbook-toolbar">
        <div className="worldbook-scope-filter">
          <label>范围:</label>
          <select
            aria-label="筛选世界书范围"
            value={currentScope}
            onChange={(e) => onScopeChange(e.target.value as 'all' | 'workspace' | 'global')}
            className="worldbook-scope-select"
          >
            <option value="all">全部</option>
            <option value="workspace">工作区</option>
            <option value="global">全局</option>
          </select>
        </div>

        <div className="worldbook-actions">
          <VSCodeButton appearance="primary" onClick={() => onOpenConfigForm()}>
            添加世界书
          </VSCodeButton>
          <VSCodeButton appearance="secondary" onClick={onWorldBookBrowse}>
            浏览文件
          </VSCodeButton>
        </div>
      </div>

      {error && (
        <div className="worldbook-error">
          <span>错误: {error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="worldbook-loading">
          <span>加载中...</span>
        </div>
      ) : filteredWorldBooks.length === 0 ? (
        <div className="worldbook-empty">
          <span>
            {currentScope === 'all'
              ? '暂无世界书'
              : currentScope === 'workspace'
                ? '工作区暂无世界书'
                : '全局存储暂无世界书'
            }
          </span>
          <VSCodeButton appearance="primary" onClick={() => onOpenConfigForm()}>
            添加世界书
          </VSCodeButton>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredWorldBooks.map((worldBook) => {
            // 使用路径+scope作为唯一标识
            const worldBookKey = `${worldBook.path}-${worldBook.scope === 'global' ? 'global' : 'workspace'}`;
            const isEnabled = worldBookConfig.enabledFiles.includes(worldBookKey);
            const isDeleting = deletingWorldBook === worldBookKey;
            const isValidating = validatingFile === worldBookKey;

            return (
              <div key={worldBookKey} className={`border border-vscode-panel-border rounded-md bg-vscode-sideBarSectionHeader-background/40 px-3 py-3 ${isEnabled ? 'enabled' : 'disabled'}`}>
                <div className="worldbook-header">
                  <div className="worldbook-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      {worldBook.scope === 'global' ? (
                        <Globe className="w-4 h-4 text-blue-400" />
                      ) : (
                        <Folder className="w-4 h-4 text-green-400" />
                      )}
                      <h5 style={{ margin: 0 }}>{worldBook.name}</h5>
                    </div>
                    <p className="worldbook-path">{worldBook.path}</p>
                    <div className="worldbook-stats">
                      <span>{worldBook.entryCount} 词条</span>
                    </div>
                  </div>

                  <div className="worldbook-controls">
                    <VSCodeCheckbox
                      checked={isEnabled}
                      onChange={(e: any) => onWorldBookToggle(worldBookKey, e.target.checked)}
                    >
                      启用
                    </VSCodeCheckbox>
                  </div>
                </div>

                <div className="worldbook-footer">
                  <div className="worldbook-description">
                    {/* 描述信息暂不可用 */}
                  </div>

                  <div className="worldbook-actions-group">
                    <VSCodeButton
                      appearance="icon"
                      onClick={() => handleValidateFile(worldBook)}
                      disabled={isValidating}
                      title="验证文件"
                    >
                      {isValidating ? '⏳' : '✓'}
                    </VSCodeButton>

                    <VSCodeButton
                      appearance="icon"
                      onClick={() => onWorldBookReload(worldBookKey)}
                      title="重新加载"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </VSCodeButton>

                    <VSCodeButton
                      appearance="icon"
                      onClick={() => onOpenMixinManager(worldBook)}
                      title="编辑世界书条目"
                      style={{ marginRight: '4px' }}
                    >
                      <Edit3 className="w-4 h-4" />
                    </VSCodeButton>

                    <VSCodeButton
                      appearance="icon"
                      onClick={() => onOpenConfigForm(worldBook)}
                      title="配置"
                    >
                      <Settings className="w-4 h-4" />
                    </VSCodeButton>

                    {worldBook.scope === 'global' ? (
                      <VSCodeButton
                        appearance="icon"
                        onClick={() => onCopyFromGlobal(worldBook.name)}
                        title="复制到工作区"
                      >
                        <Copy className="w-4 h-4" />
                      </VSCodeButton>
                    ) : (
                      <VSCodeButton
                        appearance="icon"
                        onClick={() => onCopyToGlobal(worldBook.path)}
                        title="复制到全局存储"
                      >
                        <Copy className="w-4 h-4" />
                      </VSCodeButton>
                    )}

                    <VSCodeButton
                      appearance="icon"
                      onClick={() => handleDeleteWorldBook(worldBook)}
                      disabled={isDeleting}
                      title="删除"
                    >
                      {isDeleting ? '⏳' : <Trash2 className="w-4 h-4" />}
                    </VSCodeButton>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 统计信息 */}
      <div className="worldbook-stats-summary">
        <div className="stats-item">
          <span>总数: {filteredWorldBooks.length}</span>
        </div>
        <div className="stats-item">
          <span>已启用: {filteredWorldBooks.filter(wb => {
            const worldBookKey = `${wb.path}-${wb.scope === 'global' ? 'global' : 'workspace'}`;
            return worldBookConfig.enabledFiles.includes(worldBookKey);
          }).length}</span>
        </div>
        <div className="stats-item">
          <span>总词条: {filteredWorldBooks.reduce((sum, wb) => sum + wb.entryCount, 0)}</span>
        </div>
      </div>
    </div>
  );
};