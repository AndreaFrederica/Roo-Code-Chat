import React from 'react';
import { VSCodeCheckbox, VSCodeTextField } from '@vscode/webview-ui-toolkit/react';

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

interface WorldBookConfigFormProps {
  config: WorldBookConfig;
  onChange: (updates: Partial<WorldBookConfig>) => void;
}

export const WorldBookConfigForm: React.FC<WorldBookConfigFormProps> = ({ config, onChange }) => {
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