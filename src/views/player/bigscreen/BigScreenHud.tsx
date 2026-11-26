import React from 'react';
import type { Translations } from '../../../i18n';
import { Minimize2, Radio, Zap, Mic2, Music, Layers } from 'lucide-react';
import type { BigScreenViewProps } from '../BigScreenView';
import type { Dispatch, SetStateAction } from 'react';

export type BigScreenHudProps = Pick<BigScreenViewProps, 'format' | 'pitchSemitones' | 'tempoRatio' | 'currentChord' | 'onCreateStemProject' | 'onClose'> & {
  showHud: boolean;
  t: Translations;
  setShowLyrics: Dispatch<SetStateAction<boolean>>;
  showLyrics: boolean;
};

export const BigScreenHud: React.FC<BigScreenHudProps> = ({
  currentChord,
  format,
  onClose,
  onCreateStemProject,
  pitchSemitones,
  setShowLyrics,
  showHud,
  showLyrics,
  t,
  tempoRatio,
}) => (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        opacity: showHud ? 1 : 0,
        transition: 'opacity 0.4s ease',
        pointerEvents: showHud ? 'auto' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span
          style={{
            padding: '4px 12px',
            borderRadius: '20px',
            background: 'rgba(6, 182, 212, 0.15)',
            border: '1px solid rgba(6, 182, 212, 0.4)',
            color: 'var(--accent-cyan)',
            fontSize: '0.8rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Radio size={14} /> PipeWire Hi-Fi • {format || 'FLAC'}
        </span>
        {(Math.abs(pitchSemitones) > 0.05 || Math.abs(tempoRatio - 1.0) > 0.02) && (
          <span
            style={{
              padding: '4px 10px',
              borderRadius: '20px',
              background: 'rgba(244, 63, 94, 0.2)',
              border: '1px solid var(--accent-pink)',
              color: 'var(--accent-pink)',
              fontSize: '0.78rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Zap size={12} /> DSP: {tempoRatio.toFixed(2)}x
          </span>
        )}
        {currentChord && (
          <span
            style={{
              padding: '4px 12px',
              borderRadius: '20px',
              background: 'rgba(236, 72, 153, 0.25)',
              border: '1px solid rgba(236, 72, 153, 0.6)',
              color: 'var(--accent-pink)',
              fontSize: '0.85rem',
              fontWeight: 800,
              fontFamily: 'var(--font-mono)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 0 12px rgba(236, 72, 153, 0.4)',
            }}
            title={t.player.currentChord}
          >
            <Music size={14} /> {currentChord}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {onCreateStemProject && (
          <button
            onClick={onCreateStemProject}
            style={{
              background: 'rgba(236, 72, 153, 0.2)',
              border: '1px solid var(--accent-pink)',
              borderRadius: '10px',
              color: 'var(--accent-pink)',
              padding: '8px 14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
            title={t.bigScreen.createStemProject}
          >
            <Layers size={16} />
            {t.bigScreen.stemProject}
          </button>
        )}

        <button
          onClick={() => setShowLyrics(!showLyrics)}
          style={{
            background: showLyrics ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255,255,255,0.08)',
            border: `1px solid ${showLyrics ? 'var(--accent-purple)' : 'var(--border-subtle)'}`,
            borderRadius: '10px',
            color: showLyrics ? 'var(--accent-purple)' : 'var(--text-secondary)',
            padding: '8px 14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.85rem',
            fontWeight: 600,
          }}
        >
          <Mic2 size={16} />
          {t.nav.lyrics}
        </button>

        <button
          onClick={onClose}
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            color: '#fff',
            padding: '8px 14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.85rem',
            fontWeight: 600,
          }}
          title={`${t.common.close} (Esc / F11)`}
        >
          <Minimize2 size={16} />
          {t.common.close} (Esc)
        </button>
      </div>
    </div>
);
