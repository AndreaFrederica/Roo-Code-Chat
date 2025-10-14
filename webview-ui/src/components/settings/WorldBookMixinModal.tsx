import React, { useState, useEffect } from 'react';
import { VSCodeButton } from '@vscode/webview-ui-toolkit/react';
import { VSCodeTextField } from '@vscode/webview-ui-toolkit/react';
import { VSCodeTextArea } from '@vscode/webview-ui-toolkit/react';
import { VSCodeCheckbox } from '@vscode/webview-ui-toolkit/react';
import { Edit3, Eye, EyeOff, RefreshCw } from 'lucide-react';
import type { WorldBookInfo, WorldEntry, WorldBookEntryMixin } from '@roo-code/types';

interface WorldBookMixinModalProps {
  isOpen: boolean;
  onClose: () => void;
  worldBook: WorldBookInfo | null;
  isGlobal: boolean;
  onLoadMixin: (worldBook: WorldBookInfo, isGlobal: boolean) => Promise<{
    entries: WorldEntry[];
    mixinEntries: WorldBookEntryMixin[];
  } | null>;
  onUpdateEntryMixin: (entryUid: number | string, updates: Partial<WorldBookEntryMixin>) => Promise<void>;
  onRemoveEntryMixin: (entryUid: number | string) => Promise<void>;
}

export const WorldBookMixinModal: React.FC<WorldBookMixinModalProps> = ({
  isOpen,
  onClose,
  worldBook,
  isGlobal,
  onLoadMixin,
  onUpdateEntryMixin,
  onRemoveEntryMixin
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [worldBookEntries, setWorldBookEntries] = useState<WorldEntry[]>([]);
  const [mixinEntries, setMixinEntries] = useState<WorldBookEntryMixin[]>([]);
  const [editingEntry, setEditingEntry] = useState<WorldBookEntryMixin | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('WorldBookMixinModal useEffect:', { isOpen, worldBook: worldBook?.name, isGlobal });
    if (isOpen && worldBook) {
      loadMixinData();
    } else {
      // 重置状态
      setWorldBookEntries([]);
      setMixinEntries([]);
      setEditingEntry(null);
      setError(null);
    }
  }, [isOpen, worldBook, isGlobal]);

  const loadMixinData = async () => {
    if (!worldBook) return;

    console.log('Loading mixin data for:', worldBook.name, 'Path:', worldBook.path, 'IsGlobal:', isGlobal);
    setIsLoading(true);
    setError(null);

    try {
      const result = await onLoadMixin(worldBook, isGlobal);
      console.log('Mixin data loaded:', result);
      if (result) {
        setWorldBookEntries(result.entries);
        setMixinEntries(result.mixinEntries);
        console.log('Set entries:', result.entries.length, 'Mixin entries:', result.mixinEntries.length);
      }
    } catch (err) {
      console.error('Failed to load mixin data:', err);
      setError(err instanceof Error ? err.message : '加载Mixin数据失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateEntryMixin = async (entryUid: number | string, updates: Partial<WorldBookEntryMixin>) => {
    try {
      await onUpdateEntryMixin(entryUid, updates);
      // 重新加载数据
      await loadMixinData();
      setEditingEntry(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新条目Mixin失败');
    }
  };

  const handleRemoveEntryMixin = async (entryUid: number | string) => {
    try {
      await onRemoveEntryMixin(entryUid);
      // 重新加载数据
      await loadMixinData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除条目Mixin失败');
    }
  };

  const toggleEntryEnabled = (entry: WorldEntry, currentMixin: WorldBookEntryMixin | undefined) => {
    if (entry.uid === undefined) return;

    const newEnabled = currentMixin ? !currentMixin.enabled : !entry.disable;
    handleUpdateEntryMixin(entry.uid, {
      enabled: newEnabled,
      disabled: !newEnabled,
      updatedAt: Date.now()
    });
  };

  const startEditEntry = (entry: WorldEntry, mixin: WorldBookEntryMixin | undefined) => {
    if (entry.uid === undefined) return;

    setEditingEntry({
      uid: entry.uid,
      keys: mixin?.keys || entry.key || [],
      secondaryKeys: mixin?.secondaryKeys || entry.keysecondary || [],
      content: mixin?.content || entry.content || '',
      comment: mixin?.comment || entry.comment || '',
      order: mixin?.order || entry.order || 0,
      constant: mixin?.constant || entry.constant || false,
      group: mixin?.group || entry.group || '',
      probability: mixin?.probability || entry.probability || 100,
      enabled: mixin?.enabled !== false,
      disabled: mixin?.disabled || false,
      createdAt: mixin?.createdAt || Date.now(),
      updatedAt: Date.now()
    });
  };

  const saveEditingEntry = () => {
    if (editingEntry && editingEntry.uid !== undefined) {
      handleUpdateEntryMixin(editingEntry.uid, editingEntry);
    }
  };

  const cancelEditEntry = () => {
    setEditingEntry(null);
  };

  const resetEntryMixin = async (entryUid: number | string) => {
    await handleRemoveEntryMixin(entryUid);
  };

  const getEntryStatus = (entry: WorldEntry, mixin: WorldBookEntryMixin | undefined) => {
    const isDisabled = entry.disable || (mixin && (mixin.disabled || mixin.enabled === false));
    return isDisabled ? 'disabled' : 'enabled';
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div className="modal-content" style={{
        backgroundColor: 'var(--vscode-editor-background)',
        border: '1px solid var(--vscode-panel-border)',
        borderRadius: '8px',
        width: '90vw',
        height: '85vh',
        maxWidth: '1200px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--vscode-panel-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Edit3 className="w-4 h-4" />
            世界书Mixin管理 - {worldBook?.name}
            {isGlobal && <span style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground)' }}>(全局)</span>}
          </h3>
          <VSCodeButton appearance="icon" onClick={onClose}>
            ✕
          </VSCodeButton>
        </div>

        {/* Modal Content */}
        <div style={{
          flex: 1,
          padding: '20px',
          overflow: 'auto'
        }}>
          {error && (
            <div style={{
              backgroundColor: 'var(--vscode-errorBackground)',
              color: 'var(--vscode-errorForeground)',
              padding: '8px 12px',
              borderRadius: '4px',
              marginBottom: '16px'
            }}>
              错误: {error}
            </div>
          )}

          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div>加载中...</div>
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: '16px' }}>
                <p style={{ margin: 0, color: 'var(--vscode-descriptionForeground)' }}>
                  通过Mixin系统，您可以临时修改世界书条目的内容、启用状态等，而不会修改原始文件。
                </p>
              </div>

              {worldBookEntries.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px',
                  border: '1px dashed var(--vscode-panel-border)',
                  borderRadius: '4px'
                }}>
                  <p>暂无世界书条目</p>
                  <p style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground)' }}>
                    请确保世界书文件有效且包含条目
                  </p>
                </div>
              ) : (
                <div className="mixin-entries-list">
                  {worldBookEntries.map((entry) => {
                    if (entry.uid === undefined) return null;

                    const mixin = mixinEntries.find(m => m.uid === entry.uid);
                    const isEditing = editingEntry?.uid === entry.uid;
                    const status = getEntryStatus(entry, mixin);

                    return (
                      <div key={String(entry.uid)} className="mixin-entry-item" style={{
                        border: '1px solid var(--vscode-panel-border)',
                        borderRadius: '4px',
                        marginBottom: '12px',
                        padding: '16px',
                        backgroundColor: mixin ? 'var(--vscode-inputValidation-warningBackground)' : 'var(--vscode-editor-background)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                              <strong>ID: {entry.uid}</strong>
                              {mixin && (
                                <span style={{
                                  backgroundColor: 'var(--vscode-badge-background)',
                                  color: 'var(--vscode-badge-foreground)',
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  fontSize: '11px'
                                }}>
                                  已修改
                                </span>
                              )}
                              <span style={{
                                backgroundColor: status === 'disabled' ? 'var(--vscode-errorBackground)' : 'var(--vscode-testing-background)',
                                color: status === 'disabled' ? 'var(--vscode-errorForeground)' : 'var(--vscode-testing-foreground)',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '11px'
                              }}>
                                {status === 'disabled' ? '已禁用' : '已启用'}
                              </span>
                            </div>

                            {entry.comment && (
                              <div style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground)', marginBottom: '4px' }}>
                                注释: {entry.comment}
                              </div>
                            )}

                            {(entry.key && entry.key.length > 0) && (
                              <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                                关键词: {entry.key.join(', ')}
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'flex', gap: '8px' }}>
                            <VSCodeButton
                              appearance="icon"
                              onClick={() => toggleEntryEnabled(entry, mixin)}
                              title={status === 'disabled' ? "启用词条" : "禁用词条"}
                            >
                              {status === 'disabled' ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                            </VSCodeButton>

                            {isEditing ? (
                              <>
                                <VSCodeButton
                                  appearance="icon"
                                  onClick={saveEditingEntry}
                                  title="保存修改"
                                >
                                  💾
                                </VSCodeButton>
                                <VSCodeButton
                                  appearance="icon"
                                  onClick={cancelEditEntry}
                                  title="取消编辑"
                                >
                                  ❌
                                </VSCodeButton>
                              </>
                            ) : (
                              <>
                                <VSCodeButton
                                  appearance="icon"
                                  onClick={() => startEditEntry(entry, mixin)}
                                  title="编辑Mixin"
                                >
                                  ✏️
                                </VSCodeButton>

                                {mixin && (
                                  <VSCodeButton
                                    appearance="icon"
                                    onClick={() => entry.uid !== undefined && resetEntryMixin(entry.uid)}
                                    title="重置为原始值"
                                  >
                                    <RefreshCw className="w-4 h-4" />
                                  </VSCodeButton>
                                )}
                              </>
                            )}
                          </div>
                        </div>

                        {isEditing && editingEntry && (
                          <div className="entry-edit-form" style={{
                            border: '1px solid var(--vscode-input-border)',
                            borderRadius: '4px',
                            padding: '12px',
                            backgroundColor: 'var(--vscode-input-background)'
                          }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                              <div>
                                <label style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>关键词 (用逗号分隔)</label>
                                <VSCodeTextField
                                  value={(editingEntry.keys || []).join(', ')}
                                  onChange={(e: any) => setEditingEntry({
                                    ...editingEntry,
                                    keys: e.target.value.split(',').map((k: string) => k.trim()).filter((k: string) => k)
                                  })}
                                  style={{ width: '100%' }}
                                />
                              </div>

                              <div>
                                <label style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>次要关键词</label>
                                <VSCodeTextField
                                  value={(editingEntry.secondaryKeys || []).join(', ')}
                                  onChange={(e: any) => setEditingEntry({
                                    ...editingEntry,
                                    secondaryKeys: e.target.value.split(',').map((k: string) => k.trim()).filter((k: string) => k)
                                  })}
                                  style={{ width: '100%' }}
                                />
                              </div>
                            </div>

                            <div style={{ marginBottom: '12px' }}>
                              <label style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>注释</label>
                              <VSCodeTextField
                                value={editingEntry.comment || ''}
                                onChange={(e: any) => setEditingEntry({
                                  ...editingEntry,
                                  comment: e.target.value
                                })}
                                style={{ width: '100%' }}
                              />
                            </div>

                            <div style={{ marginBottom: '12px' }}>
                              <label style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>内容</label>
                              <VSCodeTextArea
                                value={editingEntry.content || ''}
                                onChange={(e: any) => setEditingEntry({
                                  ...editingEntry,
                                  content: e.target.value
                                })}
                                rows={6}
                                style={{ width: '100%', resize: 'vertical' }}
                              />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                              <div>
                                <label style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>排序</label>
                                <VSCodeTextField
                                  value={String(editingEntry.order || 0)}
                                  onChange={(e: any) => setEditingEntry({
                                    ...editingEntry,
                                    order: parseInt(e.target.value) || 0
                                  })}
                                />
                              </div>

                              <div>
                                <label style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>分组</label>
                                <VSCodeTextField
                                  value={editingEntry.group || ''}
                                  onChange={(e: any) => setEditingEntry({
                                    ...editingEntry,
                                    group: e.target.value
                                  })}
                                />
                              </div>

                              <div>
                                <label style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>概率 (%)</label>
                                <VSCodeTextField
                                  value={String(editingEntry.probability || 100)}
                                  onChange={(e: any) => setEditingEntry({
                                    ...editingEntry,
                                    probability: parseInt(e.target.value) || 100
                                  })}
                                />
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '16px' }}>
                                <VSCodeCheckbox
                                  checked={editingEntry.constant || false}
                                  onChange={(e: any) => setEditingEntry({
                                    ...editingEntry,
                                    constant: e.target.checked
                                  })}
                                >
                                  常量
                                </VSCodeCheckbox>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 显示当前生效的内容 */}
                        {!isEditing && (
                          <div style={{
                            fontSize: '12px',
                            color: 'var(--vscode-descriptionForeground)',
                            backgroundColor: 'var(--vscode-textBlockQuote-background)',
                            border: '1px solid var(--vscode-textBlockQuote-border)',
                            borderRadius: '4px',
                            padding: '8px 12px'
                          }}>
                            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>当前生效内容:</div>
                            <div style={{ whiteSpace: 'pre-wrap' }}>
                              {(mixin && mixin.content !== undefined) ? mixin.content : (entry.content || '无内容')}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid var(--vscode-panel-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground)' }}>
            {mixinEntries.length} 个Mixin配置 • {worldBookEntries.length} 个条目
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <VSCodeButton appearance="secondary" onClick={onClose}>
              关闭
            </VSCodeButton>
          </div>
        </div>
      </div>
    </div>
  );
};