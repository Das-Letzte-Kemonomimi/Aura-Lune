import React from 'react';
import type { Translations } from '../../../i18n';
import { RotateCcw, Music, Piano } from '../../ui/icons';
import type { StemChannel } from '../../../types/analysis';
import { sliderToDb } from '../../../types/analysis';
import type { StemProjectStudioModalProps } from '../StemProjectStudioModal';
import type { Dispatch, SetStateAction } from 'react';
import { cn } from '../../../utils/cn';
import { fmt } from '../../../utils/fmt';
import { Button, Card, Chip, SectionHeader, SliderRow, type Tone } from '../../ui';

/** One-click stem mixes, in the order of the preset grid. */
const QUICK_MODES = [
  { id: 'karaoke', label: 'karaokeMode', tone: 'pink' },
  { id: 'acapella', label: 'acapellaSolo', tone: 'purple' },
  { id: 'drums_only', label: 'drumsOnly', tone: 'amber' },
  { id: 'rhythm_section', label: 'rhythmDrumsBass', tone: 'cyan' },
  { id: 'instrumental', label: 'instrumental', tone: 'green' },
  { id: 'practice_guitar', label: 'practiceNoGuitar', tone: 'red' },
] as const satisfies readonly { id: string; label: keyof Translations['stems']; tone: Tone }[];

/** Pan readout: `C`, `40L` or `25R`. */
const formatPan = (pan: number) =>
  pan === 0 ? 'C' : pan < 0 ? `${Math.round(Math.abs(pan) * 100)}L` : `${Math.round(pan * 100)}R`;

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
    {/* Channel strips (scroll sideways when they do not fit) */}
    <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-2">
      {channels.map((ch) => {
        const isMuted = ch.mute || (anySoloActive && !ch.solo);
        const dbVal = sliderToDb(ch.volume);
        const hovered = hoveredChannelId === ch.id;

        return (
          <Card
            key={ch.id}
            padding="none"
            onMouseEnter={() => setHoveredChannelId(ch.id)}
            onMouseLeave={() => setHoveredChannelId(null)}
            className="flex w-32.5 min-w-32.5 flex-col px-2.5 py-3 transition-[border-color,box-shadow] duration-200"
            // The channel colour comes from the project data, so the hover glow stays inline.
            style={hovered ? { borderColor: ch.color_hex, boxShadow: `0 0 15px ${ch.color_hex}33` } : undefined}
          >
            {/* Channel header */}
            <div className="mb-2 text-center">
              <div
                aria-hidden="true"
                className="mx-auto mt-0 mb-1 size-2.5 rounded-full"
                style={{ background: ch.color_hex, boxShadow: `0 0 8px ${ch.color_hex}` }}
              />
              <span className={cn('block truncate text-ui font-bold', isMuted ? 'text-fg-muted' : 'text-fg')} title={ch.name}>
                {ch.name}
              </span>
              <span className="text-xxs font-semibold text-fg-secondary uppercase">{ch.quality_tier}</span>
            </div>

            {/* Solo and mute */}
            <div className="mb-2.5 flex gap-1.5">
              <Chip
                size="xs"
                tone="amber"
                pressed={ch.solo}
                onClick={() => handleToggleSolo(ch.id)}
                title={t.stems.soloTooltip}
                className="flex-1 justify-center font-extrabold"
              >
                S
              </Chip>
              <Chip
                size="xs"
                tone="red"
                pressed={ch.mute}
                onClick={() => handleToggleMute(ch.id)}
                title={t.stems.muteTooltip}
                className="flex-1 justify-center font-extrabold"
              >
                M
              </Chip>
            </div>

            {/* Pan */}
            <div className="mb-2.5">
              <div className="mb-0.5 flex items-center justify-between text-xxs text-fg-secondary">
                <span aria-hidden="true">L</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePanChange(ch.id, 0)}
                  title={t.stems.panResetTooltip}
                  className="px-1 py-0 font-mono text-xxs"
                >
                  {formatPan(ch.pan)}
                </Button>
                <span aria-hidden="true">R</span>
              </div>
              <input
                type="range"
                aria-label={fmt(t.stems.panLabel, ch.name)}
                min={-1}
                max={1}
                step={0.05}
                value={ch.pan}
                onChange={(e) => handlePanChange(ch.id, Number(e.target.value))}
                onDoubleClick={() => handlePanChange(ch.id, 0)}
                className="w-full"
                style={{ accentColor: ch.color_hex }}
              />
            </div>

            {/* Volume fader (0 to 100 %, 75 % = 0 dB) */}
            <div className="relative flex flex-1 flex-col items-center justify-center">
              <input
                type="range"
                aria-label={fmt(t.stems.faderLabel, ch.name)}
                min={0}
                max={1}
                step={0.01}
                value={ch.volume}
                onChange={(e) => handleVolumeChange(ch.id, Number(e.target.value))}
                onDoubleClick={() => handleVolumeChange(ch.id, 0.75)}
                className="h-45 w-8 [writing-mode:vertical-lr] [direction:rtl]"
                style={{ accentColor: ch.color_hex }}
                title={t.stems.volumeResetTooltip}
              />
            </div>

            {/* Decibel / percent readout */}
            <div className="mt-2 text-center">
              <span
                className={cn('font-mono text-xs font-extrabold', isMuted ? 'text-fg-muted' : 'text-fg-secondary')}
                style={!isMuted && ch.volume >= 0.75 ? { color: ch.color_hex } : undefined}
              >
                {isMuted || ch.volume <= 0.001 ? '-INF dB' : `${dbVal >= 0 ? '+' : ''}${dbVal.toFixed(1)} dB`}
              </span>
              <div className="text-xxs text-fg-muted">{Math.round(ch.volume * 100)}%</div>
            </div>
          </Card>
        );
      })}
    </div>

    {/* Master and presets */}
    <Card padding="sm" className="flex w-65 flex-col gap-3.5">
      <SectionHeader title={t.stems.masterAndPresets} className="border-b border-line pb-2" />

      <SliderRow
        label={t.stems.masterVolume}
        min={0}
        max={1.5}
        step={0.05}
        value={masterVolume}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={(v) => {
          setMasterVolume(v);
          applyMixToEngine(channels, v);
        }}
      />

      <Button size="sm" onClick={handleResetAllToUnity}>
        <RotateCcw size={14} />
        {t.stems.resetAllUnity}
      </Button>

      {/* Quick presets */}
      <div className="flex flex-col gap-1.5">
        <span className="label-caps">{t.stems.quickModes}</span>
        <div className="grid grid-cols-2 gap-1.5">
          {QUICK_MODES.map((mode) => (
            <Button
              key={mode.id}
              variant="tinted"
              tone={mode.tone}
              size="sm"
              onClick={() => handleApplyPreset(mode.id)}
              className="px-1.5 text-xxs whitespace-normal"
            >
              {t.stems[mode.label]}
            </Button>
          ))}
        </div>
      </div>

      {/* Analysis tools linked to the stems */}
      {(onOpenChords || onOpenPianoRoll) && (
        <div className="mt-auto flex flex-col gap-1.5 border-t border-line pt-2.5">
          <span className="label-caps">{t.stems.trackAnalysis}</span>
          {onOpenChords && (
            <Button variant="tinted" tone="pink" size="sm" onClick={onOpenChords} className="justify-start">
              <Music size={14} />
              {t.stems.chordsFromBass}
            </Button>
          )}
          {onOpenPianoRoll && (
            <Button variant="tinted" tone="purple" size="sm" onClick={onOpenPianoRoll} className="justify-start">
              <Piano size={14} />
              {t.stems.vocalPianoRollBtn}
            </Button>
          )}
        </div>
      )}
    </Card>
  </div>
);
