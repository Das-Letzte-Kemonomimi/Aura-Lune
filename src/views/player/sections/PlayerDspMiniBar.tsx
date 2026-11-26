import React from 'react';
import { RotateCcw, Sliders } from 'lucide-react';
import type { PlaybackStatus } from '../../../types/player';
import type { PlayerViewProps } from '../PlayerView';
import { cn } from '../../../utils/cn';

export type PlayerDspMiniBarProps = Pick<PlayerViewProps, 'handleEngineChange' | 'lastActiveDspEngineRef' | 'loc' | 'handleRestoreOriginalTrack' | 'handlePitchChange' | 'handleTempoChange' | 'setActiveTab'> & {
  status: PlaybackStatus;
};

// Memo: sekcja nie zależy od pozycji odtwarzania — nie renderuje się w każdej klatce statusu.
export const PlayerDspMiniBar: React.FC<PlayerDspMiniBarProps> = React.memo(({
  handleEngineChange,
  handlePitchChange,
  handleRestoreOriginalTrack,
  handleTempoChange,
  lastActiveDspEngineRef,
  loc,
  setActiveTab,
  status,
}) => (
    <div
      className="glass-card flex items-center justify-between rounded-xl border border-line bg-black/30 px-4.5 py-2.5"
    >
      <div className="flex items-center gap-4">
        <span className="text-xs font-bold tracking-wider text-fg-muted uppercase">
          DSP:
        </span>

        {/* Szybki przełącznik Bypass / DSP */}
        <button
          onClick={() => handleEngineChange(status.engine === 'Bypass' ? (lastActiveDspEngineRef.current || 'RubberBand') : 'Bypass')}
          className={cn(
            'flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-bold',
            status.engine === 'Bypass' ? 'border-accent-green/40 bg-accent-green/20 text-accent-green' : 'border-accent-pink/40 bg-accent-pink/20 text-accent-pink',
          )}
          title={status.engine === 'Bypass' ? loc.dsp.enableDspTooltip : loc.dsp.disableDspTooltip}
        >
          {status.engine === 'Bypass' ? '● BYPASS' : `● ${status.engine === 'RubberBand' ? 'Rubber Band' : 'SoundTouch'}`}
        </button>

        {/* Wskaźnik i przycisk powrotu ze stemów (jeśli stemy są aktywne) */}
        {status.is_stems_active && (
          <div
            className="flex items-center gap-1.5 rounded-lg border border-pink-500/45 bg-pink-500/20 px-2 py-1 text-xs font-bold text-accent-pink"
          >
            <Sliders size={12} />
            <span>{loc.player.stemMix}</span>
            <button
              onClick={handleRestoreOriginalTrack}
              title={loc.player.returnToOriginalTooltip}
              className="flex items-center gap-1 rounded-md border border-white/30 bg-white/20 px-1.5 py-0.5 text-xxs font-bold text-fg"
            >
              <RotateCcw size={11} />
              {loc.player.restoreOriginal}
            </button>
          </div>
        )}

        {/* Pitch Chip */}
        <div className="flex items-center gap-1.5 text-ui">
          <span className="text-fg-secondary">Pitch:</span>
          <span className="font-mono font-bold text-accent-pink">
            {status.pitch_semitones > 0 ? `+${status.pitch_semitones.toFixed(1)}` : status.pitch_semitones.toFixed(1)} st
          </span>
          {status.pitch_semitones !== 0 && (
            <button
              onClick={() => handlePitchChange(0)}
              title={loc.dsp.resetPitchTooltip}
              className="flex bg-transparent p-0.5 text-fg-muted"
            >
              <RotateCcw size={12} />
            </button>
          )}
        </div>

        {/* Tempo Chip */}
        <div className="flex items-center gap-1.5 text-ui">
          <span className="text-fg-secondary">Tempo:</span>
          <span className="font-mono font-bold text-accent-cyan">
            {status.tempo_ratio.toFixed(2)}x
          </span>
          {status.tempo_ratio !== 1 && (
            <button
              onClick={() => handleTempoChange(1.0)}
              title={loc.dsp.resetTempoTooltip}
              className="flex bg-transparent p-0.5 text-fg-muted"
            >
              <RotateCcw size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Szybkie przejście do pełnego korektora DSP */}
      <button
        onClick={() => setActiveTab('dsp')}
        className="flex items-center gap-1.5 rounded-lg border border-accent-purple/35 bg-accent-purple/15 px-3 py-1.5 text-ui font-semibold text-accent-purple"
      >
        <Sliders size={13} />
        <span>{loc.nav.dsp} &rarr;</span>
      </button>
    </div>
));
