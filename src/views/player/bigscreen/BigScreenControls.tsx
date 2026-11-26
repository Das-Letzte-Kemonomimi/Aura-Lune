import React from 'react';
import type { Translations } from '../../../i18n';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { SpectrumVisualizer } from '../../../components/player/SpectrumVisualizer';
import { VuMeterWidget } from '../../../components/player/VuMeterWidget';
import { WaveformCanvas } from '../../../components/player/WaveformCanvas';
import { formatTime } from '../../../utils/timeFormat';
import type { BigScreenViewProps } from '../BigScreenView';
import type { Dispatch, SetStateAction } from 'react';

export type BigScreenControlsProps = Pick<BigScreenViewProps, 'volume' | 'isPlaying' | 'durationMs' | 'currentLang' | 'onSeek' | 'onSeekPreview' | 'onSeekCommit' | 'tempoRatio' | 'onPrev' | 'onPlayPause' | 'onNext' | 'onVolumeChange' | 'onToggleVolumeUnit' | 'volumeUnit'> & {
  showHud: boolean;
  setBottomVisualMode: Dispatch<SetStateAction<"spectrum" | "vumeter">>;
  bottomVisualMode: "spectrum" | "vumeter";
  spectrum: number[];
  waveformPeaks: number[];
  progress: number;
  positionMs: number;
  t: Translations;
};

export const BigScreenControls: React.FC<BigScreenControlsProps> = ({
  bottomVisualMode,
  currentLang,
  durationMs,
  isPlaying,
  onNext,
  onPlayPause,
  onPrev,
  onSeek,
  onSeekCommit,
  onSeekPreview,
  onToggleVolumeUnit,
  onVolumeChange,
  positionMs,
  progress,
  setBottomVisualMode,
  showHud,
  spectrum,
  t,
  tempoRatio,
  volume,
  volumeUnit,
  waveformPeaks,
}) => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        opacity: showHud ? 1 : 0,
        transition: 'opacity 0.4s ease',
        pointerEvents: showHud ? 'auto' : 'none',
      }}
    >
      {/* Neonowy wizualizator widma lub analogowy VU-Meter */}
      <div style={{ position: 'relative', width: '100%' }}>
        <div style={{ position: 'absolute', top: '-28px', right: '0', display: 'flex', gap: '6px', zIndex: 10 }}>
          <button
            onClick={() => setBottomVisualMode('spectrum')}
            style={{
              padding: '2px 8px',
              borderRadius: '6px',
              fontSize: '0.68rem',
              fontWeight: 700,
              background: bottomVisualMode === 'spectrum' ? 'var(--accent-pink)' : 'rgba(0,0,0,0.5)',
              border: '1px solid var(--border-subtle)',
              color: bottomVisualMode === 'spectrum' ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            Spectrum
          </button>
          <button
            onClick={() => setBottomVisualMode('vumeter')}
            style={{
              padding: '2px 8px',
              borderRadius: '6px',
              fontSize: '0.68rem',
              fontWeight: 700,
              background: bottomVisualMode === 'vumeter' ? 'var(--accent-pink)' : 'rgba(0,0,0,0.5)',
              border: '1px solid var(--border-subtle)',
              color: bottomVisualMode === 'vumeter' ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            VU-Meter
          </button>
        </div>

        {bottomVisualMode === 'vumeter' ? (
          <VuMeterWidget
            spectrum={spectrum}
            volume={volume}
            isPlaying={isPlaying}
            style={{ height: '90px', padding: '6px 12px' }}
          />
        ) : (
          <div style={{ height: '72px', width: '100%' }}>
            <SpectrumVisualizer
              spectrum={spectrum}
              isPlaying={isPlaying}
              style={{ height: '72px' }}
            />
          </div>
        )}
      </div>

      {/* Seeker z wizualizacją fali (Waveform) i wskaźnikiem DSP */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {/* Waveform bars */}
        <WaveformCanvas
          peaks={waveformPeaks}
          progress={progress}
          durationMs={durationMs || 0}
          positionMs={positionMs || 0}
          isPlaying={isPlaying}
          height={64}
          currentLang={currentLang}
          onSeek={(pct) => {
            if (durationMs && durationMs > 0) {
              onSeek(Math.floor(pct * durationMs));
            }
          }}
          onSeekPreview={(pct) => {
            if (durationMs && durationMs > 0) {
              onSeekPreview?.(Math.floor(pct * durationMs));
            }
          }}
          onSeekCommit={(pct) => {
            if (durationMs && durationMs > 0) {
              if (onSeekCommit) {
                onSeekCommit(Math.floor(pct * durationMs));
              } else {
                onSeek(Math.floor(pct * durationMs));
              }
            }
          }}
          title={t.waveform.hint}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#fff' }}>
              {formatTime(positionMs)}
            </span>
            {(tempoRatio !== 1.0) && (
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: '4px',
                  background: 'rgba(168, 85, 247, 0.3)',
                  color: 'var(--accent-purple)',
                  border: '1px solid rgba(168, 85, 247, 0.5)',
                }}
                title={`${t.dsp.tempo}: ${tempoRatio.toFixed(2)}x`}
              >
                DSP {tempoRatio.toFixed(2)}x
              </span>
            )}
          </div>
          <div
            onClick={(e) => {
              if (!durationMs || durationMs <= 0) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              onSeek(Math.floor(pct * durationMs));
            }}
            style={{
              flex: 1,
              height: '6px',
              borderRadius: '3px',
              background: 'rgba(255, 255, 255, 0.12)',
              cursor: 'pointer',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, var(--accent-cyan), var(--accent-pink))',
                borderRadius: '3px',
                boxShadow: '0 0 12px var(--accent-cyan)',
              }}
            />
          </div>
          <span style={{ fontSize: '0.82rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
            {durationMs ? formatTime(durationMs) : '--:--'}
          </span>
        </div>
      </div>

      {/* Przyciski sterowania */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px' }}>
        <button
          onClick={onPrev}
          title={t.player.previous}
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: 'none',
            borderRadius: '50%',
            width: '46px',
            height: '46px',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <SkipBack size={22} />
        </button>

        <button
          onClick={onPlayPause}
          title={isPlaying ? t.player.pause : t.player.play}
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 25px rgba(244, 63, 94, 0.55)',
          }}
        >
          {isPlaying ? <Pause size={28} /> : <Play size={28} style={{ marginLeft: '3px' }} />}
        </button>

        <button
          onClick={onNext}
          title={t.player.next}
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: 'none',
            borderRadius: '50%',
            width: '46px',
            height: '46px',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <SkipForward size={22} />
        </button>

        <div style={{ position: 'absolute', right: '48px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => onVolumeChange(volume === 0 ? 0.8 : 0)}
            title={volume === 0 ? t.player.unmute : t.player.mute}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
          >
            {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            onPointerUp={(e) => e.currentTarget.blur()}
            onMouseUp={(e) => e.currentTarget.blur()}
            onKeyDown={(e) => {
              if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) || ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
                e.currentTarget.blur();
              }
            }}
            style={{
              width: '80px',
              cursor: 'pointer',
              background: `linear-gradient(to right, var(--accent-purple) 0%, var(--accent-pink) ${Math.min(100, Math.max(0, volume * 100))}%, rgba(255, 255, 255, 0.12) ${Math.min(100, Math.max(0, volume * 100))}%, rgba(255, 255, 255, 0.12) 100%)`,
            }}
          />
          <button
            type="button"
            onClick={onToggleVolumeUnit}
            title={volumeUnit === 'db' ? 'Volume in dB (Click to toggle %)' : 'Volume in % (Click to toggle dB)'}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              padding: '2px 6px',
              fontSize: '0.72rem',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              color: volumeUnit === 'db' ? 'var(--accent-cyan)' : 'var(--accent-pink)',
              cursor: onToggleVolumeUnit ? 'pointer' : 'default',
              minWidth: '46px',
              textAlign: 'center',
            }}
          >
            {volumeUnit === 'db'
              ? (volume <= 0.0001 ? '-∞ dB' : `${(20 * Math.log10(volume)).toFixed(1)} dB`)
              : `${Math.round(volume * 100)}%`}
          </button>
        </div>
      </div>
    </div>
);
