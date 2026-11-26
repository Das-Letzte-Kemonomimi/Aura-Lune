import React from 'react';
import type { Translations } from '../../../i18n';
import { Minimize2, Radio, Zap, Mic2, Music, Layers } from '../../../components/ui/icons';
import type { BigScreenViewProps } from '../BigScreenView';
import type { Dispatch, SetStateAction } from 'react';
import { cn } from '../../../utils/cn';

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
      className={cn(
        'flex items-center justify-between transition-opacity duration-300',
        showHud ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className="flex items-center gap-1.5 rounded-3xl border border-accent-cyan/40 bg-accent-cyan/15 px-3 py-1 text-ui font-bold text-accent-cyan"
        >
          <Radio size={14} /> PipeWire Hi-Fi • {format || 'FLAC'}
        </span>
        {(Math.abs(pitchSemitones) > 0.05 || Math.abs(tempoRatio - 1.0) > 0.02) && (
          <span
            className="flex items-center gap-1 rounded-3xl border border-accent-pink bg-accent-pink/20 px-2.5 py-1 text-ui font-bold text-accent-pink"
          >
            <Zap size={12} /> DSP: {tempoRatio.toFixed(2)}x
          </span>
        )}
        {currentChord && (
          <span
            className="flex items-center gap-1.5 rounded-3xl border border-pink-500/60 bg-pink-500/25 px-3 py-1 font-mono text-sm font-extrabold text-accent-pink shadow-halo shadow-pink-500/40"
            title={t.player.currentChord}
          >
            <Music size={14} /> {currentChord}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2.5">
        {onCreateStemProject && (
          <button
            onClick={onCreateStemProject}
            className="flex items-center gap-1.5 rounded-xl border border-accent-pink bg-pink-500/20 px-3.5 py-2 text-sm font-semibold text-accent-pink"
            title={t.bigScreen.createStemProject}
          >
            <Layers size={16} />
            {t.bigScreen.stemProject}
          </button>
        )}

        <button
          onClick={() => setShowLyrics(!showLyrics)}
          className={cn(
            'border',
            'flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold',
            showLyrics ? 'bg-accent-purple/25 text-accent-purple' : 'bg-white/8 text-fg-secondary',
            showLyrics ? 'border-accent-purple' : 'border-line',
          )}
        >
          <Mic2 size={16} />
          {t.nav.lyrics}
        </button>

        <button
          onClick={onClose}
          className="flex items-center gap-1.5 rounded-xl border border-line bg-white/8 px-3.5 py-2 text-sm font-semibold text-fg"
          title={`${t.common.close} (Esc / F11)`}
        >
          <Minimize2 size={16} />
          {t.common.close} (Esc)
        </button>
      </div>
    </div>
);
