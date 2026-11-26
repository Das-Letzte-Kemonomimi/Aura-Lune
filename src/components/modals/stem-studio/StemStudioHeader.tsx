import React from 'react';
import type { Translations } from '../../../i18n';
import { RotateCcw, Download, Save, Sparkles, X, Sliders, Music } from 'lucide-react';
import type { StemProject, StemChannel, StemProjectMix } from '../../../types/analysis';
import type { Dispatch, SetStateAction } from 'react';
import { fmt } from '../../../utils/fmt';

export type StemStudioHeaderProps = {} & {
  project: StemProject | null;
  loc: Translations;
  channels: StemChannel[];
  handleSwitchToOriginal: () => Promise<void>;
  t: Translations;
  isOriginalMode: boolean;
  handleSwitchToStems: (startPlaying?: boolean | undefined) => Promise<void>;
  handleReturnToOriginalAndClose: () => Promise<void>;
  activeMixName: string;
  mixes: StemProjectMix[];
  handleLoadMix: (mix: StemProjectMix) => void;
  handleResetAllToUnity: () => void;
  setIsSavingMix: Dispatch<SetStateAction<boolean>>;
  handleExportZip: () => Promise<void>;
  handleClose: () => Promise<void>;
};

export const StemStudioHeader: React.FC<StemStudioHeaderProps> = ({
  activeMixName,
  channels,
  handleClose,
  handleExportZip,
  handleLoadMix,
  handleResetAllToUnity,
  handleReturnToOriginalAndClose,
  handleSwitchToOriginal,
  handleSwitchToStems,
  isOriginalMode,
  loc,
  mixes,
  project,
  setIsSavingMix,
  t,
}) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px',
        background: 'rgba(255, 255, 255, 0.04)',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        marginBottom: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 15px rgba(236, 72, 153, 0.4)',
          }}
        >
          <Sliders size={22} color="#ffffff" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc' }}>
              {project ? project.title : loc.stems.loadingProject}
            </h2>
            {project?.status === 'separating' && (
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: 'rgba(245, 158, 11, 0.2)',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  color: '#f59e0b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Sparkles size={12} className="animate-spin" />
                {fmt(loc.stems.statusSeparating, String(Math.round(project.progress * 100)))}
              </span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
            {project?.artist} • {project?.album} • {fmt(loc.stems.instrumentTracksCount, String(channels.length))}
          </p>
        </div>
      </div>

      {/* Zarządzanie miksami, odsłuch na żywo A/B i powrót do utworu */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Przełącznik odsłuchu na żywo (A/B Live Comparison) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(0, 0, 0, 0.45)',
            borderRadius: '12px',
            padding: '3px',
            border: '1px solid rgba(255, 255, 255, 0.14)',
          }}
        >
          <button
            onClick={handleSwitchToOriginal}
            title={t.stems.originalMaster}
            style={{
              padding: '6px 13px',
              borderRadius: '9px',
              background: isOriginalMode ? 'linear-gradient(135deg, #06b6d4, #3b82f6)' : 'transparent',
              color: isOriginalMode ? '#ffffff' : '#94a3b8',
              fontWeight: 700,
              fontSize: '0.78rem',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: isOriginalMode ? '0 2px 8px rgba(6, 182, 212, 0.4)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Music size={13} />
            {t.stems.originalMaster}
          </button>
          <button
            onClick={() => handleSwitchToStems()}
            title={t.stems.switchToStemsTooltip}
            style={{
              padding: '6px 13px',
              borderRadius: '9px',
              background: !isOriginalMode ? 'linear-gradient(135deg, #ec4899, #8b5cf6)' : 'transparent',
              color: !isOriginalMode ? '#ffffff' : '#94a3b8',
              fontWeight: 700,
              fontSize: '0.78rem',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: !isOriginalMode ? '0 2px 8px rgba(236, 72, 153, 0.4)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Sliders size={13} />
            {t.stems.liveStemMix}
          </button>
        </div>

        {/* Przycisk powrotu do oryginalnego utworu i zamknięcia studia */}
        <button
          onClick={handleReturnToOriginalAndClose}
          title={t.stems.returnToOriginalCloseTooltip}
          style={{
            padding: '7px 14px',
            borderRadius: '10px',
            background: 'rgba(6, 182, 212, 0.15)',
            border: '1px solid rgba(6, 182, 212, 0.4)',
            color: 'var(--accent-cyan)',
            fontWeight: 700,
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <RotateCcw size={14} />
          {t.stems.returnToTrack}
        </button>

        {/* Selektor miksu */}
        <select
          value={activeMixName}
          onChange={(e) => {
            const selected = mixes.find((m) => m.name === e.target.value);
            if (selected) handleLoadMix(selected);
            else if (e.target.value === 'Default (0 dB)') handleResetAllToUnity();
          }}
          style={{
            padding: '8px 12px',
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '10px',
            color: '#f8fafc',
            fontSize: '0.8rem',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="Default (0 dB)">{t.stems.defaultMix}</option>
          {mixes.map((m) => (
            <option key={m.name} value={m.name}>
              {m.name}
            </option>
          ))}
        </select>

        <button
          onClick={() => setIsSavingMix(true)}
          title={t.stems.saveMixTooltip}
          style={{
            padding: '8px 12px',
            borderRadius: '10px',
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#cbd5e1',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.8rem',
          }}
        >
          <Save size={14} />
          {t.stems.saveMix}
        </button>

        <button
          onClick={handleExportZip}
          title={t.stems.exportZipTooltip}
          style={{
            padding: '8px 12px',
            borderRadius: '10px',
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#cbd5e1',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.8rem',
          }}
        >
          <Download size={14} />
          {t.stems.exportZip}
        </button>

        <button
          onClick={handleClose}
          title={t.stems.closeStudio}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '50%',
            display: 'flex',
          }}
        >
          <X size={20} />
        </button>
      </div>
    </div>
);
