import React from 'react';
import { RotateCcw, Sliders, PointFilled } from '../../../components/ui/icons';
import type { PlaybackStatus } from '../../../types/player';
import type { PlayerViewProps } from '../PlayerView';
import { Badge, Button, Card, IconButton } from '../../../components/ui';

export type PlayerDspMiniBarProps = Pick<PlayerViewProps, 'handleEngineChange' | 'lastActiveDspEngineRef' | 'loc' | 'handleRestoreOriginalTrack' | 'handlePitchChange' | 'handleTempoChange' | 'setActiveTab'> & {
  status: PlaybackStatus;
};

// Memo: the section does not depend on the playback position, so it does not render on every status frame.
export const PlayerDspMiniBar: React.FC<PlayerDspMiniBarProps> = React.memo(({
  handleEngineChange,
  handlePitchChange,
  handleRestoreOriginalTrack,
  handleTempoChange,
  lastActiveDspEngineRef,
  loc,
  setActiveTab,
  status,
}) => {
  const bypass = status.engine === 'Bypass';
  return (
    <Card variant="inset" padding="none" className="flex items-center justify-between px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="label-caps text-fg-muted">DSP</span>

        {/* Quick Bypass / DSP toggle */}
        <Button
          variant="tinted"
          tone={bypass ? 'green' : 'pink'}
          size="sm"
          onClick={() => handleEngineChange(bypass ? (lastActiveDspEngineRef.current || 'RubberBand') : 'Bypass')}
          title={bypass ? loc.dsp.enableDspTooltip : loc.dsp.disableDspTooltip}
        >
          <PointFilled size={12} />
          {bypass ? 'Bypass' : status.engine === 'RubberBand' ? 'Rubber Band' : 'SoundTouch'}
        </Button>

        {/* Stem mix indicator with a way back to the original track */}
        {status.is_stems_active && (
          <Badge tone="pink" className="gap-1.5 py-1">
            <Sliders size={12} />
            {loc.player.stemMix}
            <Button size="sm" onClick={handleRestoreOriginalTrack} title={loc.player.returnToOriginalTooltip} className="px-1.5 py-0.5 text-xxs">
              <RotateCcw size={11} />
              {loc.player.restoreOriginal}
            </Button>
          </Badge>
        )}

        <div className="flex items-center gap-1.5 rounded-lg border border-line bg-black/25 py-0.5 pr-1 pl-2.5 text-ui">
          <span className="text-fg-muted">Pitch</span>
          <span className="font-mono font-bold text-accent-pink">
            {status.pitch_semitones > 0 ? `+${status.pitch_semitones.toFixed(1)}` : status.pitch_semitones.toFixed(1)} st
          </span>
          {status.pitch_semitones !== 0 && (
            <IconButton size="sm" label={loc.dsp.resetPitchTooltip} onClick={() => handlePitchChange(0)} className="size-6">
              <RotateCcw size={12} />
            </IconButton>
          )}
        </div>

        <div className="flex items-center gap-1.5 rounded-lg border border-line bg-black/25 py-0.5 pr-1 pl-2.5 text-ui">
          <span className="text-fg-muted">Tempo</span>
          <span className="font-mono font-bold text-accent-cyan">{status.tempo_ratio.toFixed(2)}x</span>
          {status.tempo_ratio !== 1 && (
            <IconButton size="sm" label={loc.dsp.resetTempoTooltip} onClick={() => handleTempoChange(1.0)} className="size-6">
              <RotateCcw size={12} />
            </IconButton>
          )}
        </div>
      </div>

      {/* Quick jump to the full DSP studio */}
      <Button variant="tinted" tone="purple" size="sm" onClick={() => setActiveTab('dsp')}>
        <Sliders size={13} />
        {loc.nav.dsp} &rarr;
      </Button>
    </Card>
  );
});
