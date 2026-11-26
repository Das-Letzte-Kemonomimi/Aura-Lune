import React from 'react';
import type { Translations } from '../../../i18n';
import { RotateCcw, Music, Piano } from '../../ui/icons';
import type { StemChannel } from '../../../types/analysis';
import { sliderToDb } from '../../../types/analysis';
import type { StemProjectStudioModalProps } from '../StemProjectStudioModal';
import type { Dispatch, SetStateAction } from 'react';
import { cn } from '../../../utils/cn';

export type StemStudioWorkspaceProps = Pick<StemProjectStudioModalProps, 'onOpenChords' | 'onOpenPianoRoll'> & {
  channels: StemChannel[];
  anySoloActive: boolean;
  setHoveredChannelId: Dispatch<SetStateAction<string | null>>;
  hoveredChannelId: string | null;
  handleToggleSolo: (channelId: string) => void;
  t: Translations;
  handleToggleMute: (channelId: string) => void;
  handlePanChange: (channelId: string, newPan: number) => void;
  handleVolumeChange: (channelId: string, newVolume: number) => void;
  masterVolume: number;
  setMasterVolume: Dispatch<SetStateAction<number>>;
  applyMixToEngine: (updatedChannels: StemChannel[], masterVol: number) => Promise<void>;
  handleResetAllToUnity: () => void;
  handleApplyPreset: (presetType: string) => void;
};

export const StemStudioWorkspace: React.FC<StemStudioWorkspaceProps> = ({
  anySoloActive,
  applyMixToEngine,
  channels,
  handleApplyPreset,
  handlePanChange,
  handleResetAllToUnity,
  handleToggleMute,
  handleToggleSolo,
  handleVolumeChange,
  hoveredChannelId,
  masterVolume,
  onOpenChords,
  onOpenPianoRoll,
  setHoveredChannelId,
  setMasterVolume,
  t,
}) => (
    <div className="flex min-h-0 flex-1 gap-3.5">
      {/* Channel slider container (with horizontal scrolling) */}
      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-2">
        {channels.map((ch) => {
          const isMuted = ch.mute || (anySoloActive && !ch.solo);
          const dbVal = sliderToDb(ch.volume);

          return (
            <div
              key={ch.id}
              onMouseEnter={() => setHoveredChannelId(ch.id)}
              onMouseLeave={() => setHoveredChannelId(null)}
              className="flex w-32.5 min-w-32.5 flex-col rounded-2xl bg-slate-900/65 px-2.5 py-3 transition-[border,box-shadow] duration-200"
              style={{
                border:
                  hoveredChannelId === ch.id
                    ? `1px solid ${ch.color_hex}`
                    : '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow:
                  hoveredChannelId === ch.id
                    ? `0 0 15px ${ch.color_hex}33`
                    : '0 4px 12px rgba(0,0,0,0.3)',
              }}
            >
              {/* Channel header */}
              <div className="mb-2 text-center">
                <div
                  className="mx-auto mt-0 mb-1 h-2.5 w-2.5 rounded-full"
                  style={{ background: ch.color_hex, boxShadow: `0 0 8px ${ch.color_hex}` }}
                />
                <span
                  className={cn('block truncate text-ui font-bold', isMuted ? 'text-fg-muted' : 'text-fg')}
                  title={ch.name}
                >
                  {ch.name}
                </span>
                <span className="text-xxs font-semibold text-fg-secondary uppercase">
                  {ch.quality_tier}
                </span>
              </div>

              {/* Solo and Mute buttons */}
              <div className="mb-2.5 flex gap-1.5">
                <button
                  onClick={() => handleToggleSolo(ch.id)}
                  className={cn(
                    'flex-1 rounded-md border px-0 py-1 text-xs font-extrabold',
                    ch.solo ? 'border-yellow-400' : 'border-white/10',
                    ch.solo ? 'bg-yellow-400' : 'bg-white/4',
                    ch.solo ? 'text-black' : 'text-slate-300',
                  )}
                  title={t.stems.soloTooltip}
                >
                  S
                </button>
                <button
                  onClick={() => handleToggleMute(ch.id)}
                  className={cn(
                    'flex-1 rounded-md border px-0 py-1 text-xs font-extrabold',
                    ch.mute ? 'border-accent-red' : 'border-white/10',
                    ch.mute ? 'bg-accent-red' : 'bg-white/4',
                    ch.mute ? 'text-fg' : 'text-slate-300',
                  )}
                  title={t.stems.muteTooltip}
                >
                  M
                </button>
              </div>

              {/* Pan slider */}
              <div className="mb-2.5">
                <div className="mb-0.5 flex justify-between text-xxs text-fg-secondary">
                  <span>L</span>
                  <span
                    className="cursor-pointer"
                    onClick={() => handlePanChange(ch.id, 0.0)}
                    title={t.stems.panResetTooltip}
                  >
                    {ch.pan === 0
                      ? 'C'
                      : ch.pan < 0
                      ? `${Math.round(Math.abs(ch.pan) * 100)}L`
                      : `${Math.round(ch.pan * 100)}R`}
                  </span>
                  <span>R</span>
                </div>
                <input
                  type="range"
                  min="-1.0"
                  max="1.0"
                  step="0.05"
                  value={ch.pan}
                  onChange={(e) => handlePanChange(ch.id, parseFloat(e.target.value))}
                  className="w-full"
                  style={{ accentColor: ch.color_hex }}
                />
              </div>

              {/* Volume fader (0 - 100%, 75% = 0 dB) */}
              <div className="relative flex flex-1 flex-col items-center justify-center">
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.01"
                  value={ch.volume}
                  onChange={(e) => handleVolumeChange(ch.id, parseFloat(e.target.value))}
                  onDoubleClick={() => handleVolumeChange(ch.id, 0.75)}
                  className="h-45 w-8 cursor-pointer [writing-mode:vertical-lr] [direction:rtl]"
                  style={{ accentColor: ch.color_hex }}
                  title={t.stems.volumeResetTooltip}
                />
              </div>

              {/* Decibel / percent readout */}
              <div className="mt-2 text-center">
                <span
                  className="font-mono text-xs font-extrabold"
                  style={{ color: isMuted ? '#64748b' : ch.volume >= 0.75 ? ch.color_hex : '#cbd5e1' }}
                >
                  {isMuted
                    ? '-INF dB'
                    : ch.volume <= 0.001
                    ? '-INF dB'
                    : `${dbVal >= 0 ? '+' : ''}${dbVal.toFixed(1)} dB`}
                </span>
                <div className="text-xxs text-fg-muted">
                  {Math.round(ch.volume * 100)}%
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Master & presets side panel */}
      <div className="flex w-65 flex-col gap-3.5 rounded-2xl border border-white/8 bg-slate-900/80 p-4">
        <div className="border-b border-white/8 pb-2">
          <span className="text-sm font-extrabold text-fg">
            {t.stems.masterAndPresets}
          </span>
        </div>

        {/* Suwak Master */}
        <div>
          <div className="mb-1 flex justify-between">
            <span className="text-xs font-semibold text-slate-300">
              {t.stems.masterVolume}
            </span>
            <span className="text-xs font-extrabold text-accent-pink">
              {Math.round(masterVolume * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0.0"
            max="1.5"
            step="0.05"
            value={masterVolume}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setMasterVolume(v);
              applyMixToEngine(channels, v);
            }}
            className="w-full accent-accent-pink"
          />
        </div>

        {/* Reset to 75% button */}
        <button
          onClick={handleResetAllToUnity}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/6 p-2 text-xs font-bold text-fg"
        >
          <RotateCcw size={14} />
          {t.stems.resetAllUnity}
        </button>

        {/* Quick presets */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xxs font-bold text-fg-secondary uppercase">
            {t.stems.quickModes}
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => handleApplyPreset('karaoke')}
              className="rounded-md border border-pink-500/25 bg-pink-500/10 p-1.5 text-xxs font-bold text-accent-pink"
            >
              {t.stems.karaokeMode}
            </button>
            <button
              onClick={() => handleApplyPreset('acapella')}
              className="rounded-md border border-violet-500/25 bg-violet-500/10 p-1.5 text-xxs font-bold text-accent-purple"
            >
              {t.stems.acapellaSolo}
            </button>
            <button
              onClick={() => handleApplyPreset('drums_only')}
              className="rounded-md border border-accent-amber/25 bg-accent-amber/10 p-1.5 text-xxs font-bold text-accent-amber"
            >
              {t.stems.drumsOnly}
            </button>
            <button
              onClick={() => handleApplyPreset('rhythm_section')}
              className="rounded-md border border-sky-500/25 bg-sky-500/10 p-1.5 text-xxs font-bold text-sky-500"
            >
              {t.stems.rhythmDrumsBass}
            </button>
            <button
              onClick={() => handleApplyPreset('instrumental')}
              className="rounded-md border border-emerald-400/25 bg-emerald-400/10 p-1.5 text-xxs font-bold text-emerald-400"
            >
              {t.stems.instrumental}
            </button>
            <button
              onClick={() => handleApplyPreset('practice_guitar')}
              className="rounded-md border border-accent-green/25 bg-accent-green/10 p-1.5 text-xxs font-bold text-accent-green"
            >
              {t.stems.practiceNoGuitar}
            </button>
          </div>
        </div>

        {/* Analysis tools linked to the stems */}
        <div className="mt-auto border-t border-white/8 pt-2.5">
          <span className="mb-1.5 block text-xxs font-bold text-fg-secondary uppercase">
            {t.stems.trackAnalysis}
          </span>
          <div className="flex flex-col gap-1.5">
            {onOpenChords && (
              <button
                onClick={onOpenChords}
                className="flex items-center gap-1.5 rounded-lg border border-pink-500/30 bg-pink-500/15 p-2 text-xs font-bold text-accent-pink"
              >
                <Music size={14} />
                {t.stems.chordsFromBass}
              </button>
            )}
            {onOpenPianoRoll && (
              <button
                onClick={onOpenPianoRoll}
                className="flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/15 p-2 text-xs font-bold text-purple-400"
              >
                <Piano size={14} />
                {t.stems.vocalPianoRollBtn}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
);
