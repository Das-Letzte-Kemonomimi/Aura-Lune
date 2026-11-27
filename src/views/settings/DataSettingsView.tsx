import React, { useId, useState } from 'react';
import { Save, Download, Upload, Check, Copy } from '../../components/ui/icons';
import { Button, SettingRow, SettingsGroup, TextArea } from '../../components/ui';
import type { Translations } from '../../i18n';
import { SettingsPage } from './SettingsPage';

export interface DataSettingsViewProps {
  loc: Translations;
  onExportBackup: () => void;
  onImportBackup: () => void;
  jsonExportContent: string;
  onExportTheme: () => void;
  jsonImportContent: string;
  onJsonImportContentChange: (content: string) => void;
  onImportTheme: () => void;
}

/** Backup & Data: profile backup and theme JSON import / export. */
export const DataSettingsView: React.FC<DataSettingsViewProps> = ({
  loc,
  onExportBackup,
  onImportBackup,
  jsonExportContent,
  onExportTheme,
  jsonImportContent,
  onJsonImportContentChange,
  onImportTheme,
}) => {
  const [copiedJson, setCopiedJson] = useState<boolean>(false);
  const id = useId();

  const handleCopyJson = () => {
    if (!jsonExportContent) return;
    navigator.clipboard.writeText(jsonExportContent);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  return (
    <SettingsPage title={loc.settings.nav.data} icon={<Save size={22} />} tone="purple">
      {/* Profile backup */}
      <SettingsGroup label={loc.settings.backupTitle} description={loc.settings.backupDesc}>
        <div className="flex flex-wrap gap-3 px-4 py-3">
          <Button variant="primary" onClick={onExportBackup}>
            <Download size={16} /> {loc.settings.exportBackupBtn}
          </Button>
          <Button onClick={onImportBackup}>
            <Upload size={16} className="text-accent-cyan" /> {loc.settings.importBackupBtn}
          </Button>
        </div>
      </SettingsGroup>

      {/* Safe JSON import and export of themes */}
      <SettingsGroup label={loc.settings.themePortability}>
        <SettingRow
          compact
          title={loc.settings.exportTheme}
          htmlFor={`${id}-export`}
          control={
            <Button variant="tinted" tone="purple" size="sm" onClick={onExportTheme}>
              {loc.settings.generateJson}
            </Button>
          }
        >
          <div className="flex flex-col gap-2.5">
            <TextArea
              id={`${id}-export`}
              readOnly
              mono
              size="sm"
              value={jsonExportContent}
              placeholder={loc.settings.generateJsonPlaceholder}
              rows={6}
              className="resize-none text-accent-cyan"
            />
            {jsonExportContent && (
              <Button onClick={handleCopyJson} className="self-start">
                {copiedJson ? <Check size={16} className="text-accent-green" /> : <Copy size={16} />}
                {copiedJson ? loc.settings.copiedJson : loc.settings.copyJson}
              </Button>
            )}
          </div>
        </SettingRow>
        <SettingRow compact title={loc.settings.importTheme} htmlFor={`${id}-import`}>
          <div className="flex flex-col gap-2.5">
            <TextArea
              id={`${id}-import`}
              mono
              size="sm"
              value={jsonImportContent}
              onChange={(e) => onJsonImportContentChange(e.target.value)}
              placeholder={loc.settings.importPlaceholder}
              rows={6}
              className="resize-none"
            />
            <Button variant="tinted" tone="purple" onClick={onImportTheme} className="self-start">
              <Upload size={16} />
              {loc.settings.verifyImport}
            </Button>
          </div>
        </SettingRow>
      </SettingsGroup>
    </SettingsPage>
  );
};
