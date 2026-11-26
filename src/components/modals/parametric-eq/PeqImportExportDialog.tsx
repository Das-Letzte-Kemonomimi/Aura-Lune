import React from 'react';
import type { Translations } from '../../../i18n';
import { X, Upload, AlertTriangle, Copy, Check } from '../../ui/icons';
import type { Dispatch, SetStateAction } from 'react';
import { ModalShell } from '../../ui';

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
}) => (
    <ModalShell
      onClose={() => setIsImportModalOpen(false)}
      layer="toolDialog"
      className="flex max-w-170 flex-col gap-4 rounded-2xl border border-line bg-field p-6 shadow-2xl shadow-black/80"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Upload size={18} className="text-blue-400" />
          <h3 className="m-0 text-lg font-extrabold">
            {loc.parametricEq.importExportTitle}
          </h3>
        </div>
        <button
          onClick={() => setIsImportModalOpen(false)}
          className="border-0 bg-transparent text-fg-muted"
        >
          <X size={18} />
        </button>
      </div>

      <p className="m-0 text-ui text-fg-secondary">
        {loc.parametricEq.importExportDesc}
      </p>

      <textarea
        value={importText || exportedApoText}
        onChange={(e) => setImportText(e.target.value)}
        placeholder="Preamp: -6.5 dB&#10;Filter 1: ON PK Fc 31 Hz Gain 4.8 dB Q 1.41&#10;Filter 2: ON LSC Fc 105 Hz Gain 3.5 dB Q 0.71"
        className="h-45 w-full resize-none rounded-lg border border-line bg-black/40 p-3 font-mono text-ui text-fg outline-none"
      />

      {importError && (
        <div className="flex items-center gap-1.5 text-xs font-semibold text-accent-pink">
          <AlertTriangle size={13} />
          {importError}
        </div>
      )}

      <div className="flex justify-between gap-3">
        <button
          onClick={handleCopyExport}
          className="flex items-center gap-1.5 rounded-lg border border-line bg-white/8 px-4 py-2 text-ui font-semibold text-fg"
        >
          {copiedExport ? <Check size={14} className="text-accent-green" /> : <Copy size={14} />}
          {copiedExport ? loc.parametricEq.copied : loc.parametricEq.copyConfig}
        </button>

        <div className="flex gap-2.5">
          <button
            onClick={() => setIsImportModalOpen(false)}
            className="rounded-lg border border-line bg-transparent px-4 py-2 text-ui text-fg-muted"
          >
            {loc.common.cancel}
          </button>
          <button
            onClick={handleImportSubmit}
            className="rounded-lg border-0 bg-linear-135 from-sky-600 to-blue-600 px-5 py-2 text-ui font-bold text-fg"
          >
            {loc.parametricEq.applyPasted}
          </button>
        </div>
      </div>
    </ModalShell>
);
