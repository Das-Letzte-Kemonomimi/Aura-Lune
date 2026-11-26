import React from 'react';
import type { Translations } from '../../../i18n';
import { Upload, AlertTriangle, Copy, Check } from '../../ui/icons';
import type { Dispatch, SetStateAction } from 'react';
import { Button, ModalBody, ModalFooter, ModalHeader, ModalShell, TextArea } from '../../ui';

export type PeqImportExportDialogProps = {} & {
  setIsImportModalOpen: Dispatch<SetStateAction<boolean>>;
  loc: Translations;
  importText: string;
  exportedApoText: string;
  setImportText: Dispatch<SetStateAction<string>>;
  importError: string | null;
  handleCopyExport: () => void;
  copiedExport: boolean;
  handleImportSubmit: () => Promise<void>;
};

export const PeqImportExportDialog: React.FC<PeqImportExportDialogProps> = ({
  copiedExport,
  exportedApoText,
  handleCopyExport,
  handleImportSubmit,
  importError,
  importText,
  loc,
  setImportText,
  setIsImportModalOpen,
}) => {
  const close = () => setIsImportModalOpen(false);
  return (
    <ModalShell onClose={close} layer="toolDialog" size="lg" labelledBy="peq-import-export-title">
      <ModalHeader
        titleId="peq-import-export-title"
        title={loc.parametricEq.importExportTitle}
        subtitle={loc.parametricEq.importExportDesc}
        icon={<Upload size={20} />}
        tone="cyan"
        onClose={close}
        closeLabel={loc.common.close}
      />

      <ModalBody className="flex flex-col gap-3">
        <TextArea
          mono
          aria-label={loc.parametricEq.importExportTitle}
          value={importText || exportedApoText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder="Preamp: -6.5 dB&#10;Filter 1: ON PK Fc 31 Hz Gain 4.8 dB Q 1.41&#10;Filter 2: ON LSC Fc 105 Hz Gain 3.5 dB Q 0.71"
          className="h-45 resize-none"
        />
        {importError && (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-accent-red">
            <AlertTriangle size={13} />
            {importError}
          </div>
        )}
      </ModalBody>

      <ModalFooter className="justify-between">
        <Button onClick={handleCopyExport}>
          {copiedExport ? <Check size={14} className="text-accent-green" /> : <Copy size={14} />}
          {copiedExport ? loc.parametricEq.copied : loc.parametricEq.copyConfig}
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={close}>
            {loc.common.cancel}
          </Button>
          <Button variant="primary" onClick={handleImportSubmit}>
            {loc.parametricEq.applyPasted}
          </Button>
        </div>
      </ModalFooter>
    </ModalShell>
  );
};
