import React from 'react';
import type { Translations } from '../../../i18n';
import { X, Upload, AlertTriangle, Copy, Check } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';

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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10600,
        background: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={() => setIsImportModalOpen(false)}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '680px',
          background: '#161c2d',
          borderRadius: '16px',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Upload size={18} color="#60a5fa" />
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
              {loc.parametricEq.importExportTitle}
            </h3>
          </div>
          <button
            onClick={() => setIsImportModalOpen(false)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          {loc.parametricEq.importExportDesc}
        </p>

        <textarea
          value={importText || exportedApoText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder="Preamp: -6.5 dB&#10;Filter 1: ON PK Fc 31 Hz Gain 4.8 dB Q 1.41&#10;Filter 2: ON LSC Fc 105 Hz Gain 3.5 dB Q 0.71"
          style={{
            width: '100%',
            height: '180px',
            padding: '12px',
            borderRadius: '8px',
            background: 'rgba(0, 0, 0, 0.4)',
            border: '1px solid var(--border-subtle)',
            color: '#fff',
            fontFamily: 'monospace',
            fontSize: '0.8rem',
            outline: 'none',
            resize: 'none',
          }}
        />

        {importError && (
          <div
            style={{
              color: '#f43f5e',
              fontSize: '0.75rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <AlertTriangle size={13} />
            {importError}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
          <button
            onClick={handleCopyExport}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid var(--border-subtle)',
              color: '#fff',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {copiedExport ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
            {copiedExport ? loc.parametricEq.copied : loc.parametricEq.copyConfig}
          </button>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setIsImportModalOpen(false)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                background: 'transparent',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-muted)',
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              {loc.common.cancel}
            </button>
            <button
              onClick={handleImportSubmit}
              style={{
                padding: '8px 20px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                border: 'none',
                color: '#fff',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {loc.parametricEq.applyPasted}
            </button>
          </div>
        </div>
      </div>
    </div>
);
