import React, { useId, useState } from 'react';
import { Save, Download, Upload, Check, Copy } from '../../components/ui/icons';
import { Button, Card, FieldLabel, SectionHeader, TextArea } from '../../components/ui';
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
      <Card>
        <SectionHeader
          icon={<Save size={20} />}
          tone="purple"
          title={loc.settings.backupTitle}
          description={loc.settings.backupDesc}
        />
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="primary" onClick={onExportBackup}>
            <Download size={16} /> {loc.settings.exportBackupBtn}
          </Button>
          <Button onClick={onImportBackup}>
            <Upload size={16} className="text-accent-cyan" /> {loc.settings.importBackupBtn}
          </Button>
        </div>
      </Card>

      {/* Safe JSON import and export */}
      <Card>
        <SectionHeader icon={<Download size={20} />} tone="pink" title={loc.settings.themePortability} />

        <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(--spacing(68),1fr))] gap-5">
          {/* Export */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor={`${id}-export`} className="mb-0">
                {loc.settings.exportTheme}
              </FieldLabel>
              <Button variant="tinted" tone="purple" size="sm" onClick={onExportTheme}>
                {loc.settings.generateJson}
              </Button>
            </div>
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
              <Button onClick={handleCopyJson}>
                {copiedJson ? <Check size={16} className="text-accent-green" /> : <Copy size={16} />}
                {copiedJson ? loc.settings.copiedJson : loc.settings.copyJson}
              </Button>
            )}
          </div>

          {/* Import */}
          <div className="flex flex-col gap-2.5">
            <FieldLabel htmlFor={`${id}-import`} className="mb-0 py-1">
              {loc.settings.importTheme}
            </FieldLabel>
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
            <Button variant="primary" onClick={onImportTheme}>
              <Upload size={16} />
              {loc.settings.verifyImport}
            </Button>
          </div>
        </div>
      </Card>
    </SettingsPage>
  );
};
