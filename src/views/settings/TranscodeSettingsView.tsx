import React from 'react';
import {
  FileAudio,
  ShieldCheck,
  Music,
  FolderOpen,
  Save,
  Loader2,
  ArrowRight,
} from '../../components/ui/icons';
import { type Language, type Translations } from '../../i18n';
import { type PlaybackStatus, type TrackRecord, type TrackBookmarkDto } from '../../types/player';
import { formatTimeMs, parseTimeToMs } from '../../utils/timeFormat';
import { TranscodeResultPanel } from './transcode/TranscodeResultPanel';
import { TranscodeRangeOption } from './transcode/TranscodeRangeOption';
import { TranscodeDspOption } from './transcode/TranscodeDspOption';
import { fmt } from '../../utils/fmt';
import { cn } from '../../utils/cn';

export interface TranscodeSettingsViewProps {
  language: Language;
  loc: Translations;
  currentPlayingTrack: TrackRecord | null;
  status: PlaybackStatus;
  onUseCurrentTrackAsSource: () => void;
  filePath: string;
  onFilePathChange: (val: string) => void;
  isPickingSource: boolean;
  onPickTranscodeSource: () => void;
  transcodeOutput: string;
  onTranscodeOutputChange: (val: string) => void;
  isPickingDestination: boolean;
  onPickTranscodeDestination: () => void;
  transcodeFormat: 'Opus' | 'Flac' | 'Wav';
  onTranscodeFormatChange: (fmt: 'Opus' | 'Flac' | 'Wav') => void;
  transcodeBitrate: number;
  onTranscodeBitrateChange: (val: number) => void;
  transcodeApplyDsp: boolean;
  onTranscodeApplyDspChange: (val: boolean) => void;
  reverbEnabled: boolean;
  reverbLevel: number;
  transcodeApplyRange: boolean;
  onTranscodeApplyRangeChange: (val: boolean) => void;
  transcodeRangeA: string;
  onTranscodeRangeAChange: (val: string) => void;
  transcodeRangeB: string;
  onTranscodeRangeBChange: (val: string) => void;
  loopPointA: number | null;
  loopPointB: number | null;
  currentTrackBookmarks: TrackBookmarkDto[];
  transcodeAutoEnqueue: boolean;
  onTranscodeAutoEnqueueChange: (val: boolean) => void;
  isTranscoding: boolean;
  transcodeProgress: { percent: number } | null;
  transcodeElapsedSeconds: number;
  onMinimizeToBackground: () => void;
  onTranscode: () => void;
  lastExportedTrack: TrackRecord | null;
  onDismissLastExported: () => void;
  onPlayLibraryTrack: (track: TrackRecord) => void;
  onAddTrackToQueue: (track: TrackRecord, e: React.MouseEvent) => void;
  onAddToPlaylist: (track: TrackRecord) => void;
  onOpenContainingFolder: (path: string, e: React.MouseEvent) => void;
  onShowMessage: (msg: string) => void;
}

export const TranscodeSettingsView: React.FC<TranscodeSettingsViewProps> = (props) => {
  const {
    language: _language,
    loc,
    currentPlayingTrack,
    status,
    onUseCurrentTrackAsSource,
    filePath,
    onFilePathChange,
    isPickingSource,
    onPickTranscodeSource,
    transcodeOutput,
    onTranscodeOutputChange,
    isPickingDestination,
    onPickTranscodeDestination,
    transcodeFormat,
    onTranscodeFormatChange,
    transcodeBitrate,
    onTranscodeBitrateChange,
    transcodeRangeA,
    onTranscodeRangeAChange,
    transcodeRangeB,
    onTranscodeRangeBChange,
    loopPointA,
    loopPointB,
    currentTrackBookmarks,
    transcodeAutoEnqueue,
    onTranscodeAutoEnqueueChange,
    isTranscoding,
    transcodeProgress,
    transcodeElapsedSeconds,
    onMinimizeToBackground,
    onTranscode,
    lastExportedTrack,
    onShowMessage,
  } = props;
  const handleApplyLoopFromPlayer = () => {
    const strA = loopPointA !== null ? formatTimeMs(loopPointA) : '0:00.000';
    const strB = loopPointB !== null ? formatTimeMs(loopPointB) : '';
    onTranscodeRangeAChange(strA);
    onTranscodeRangeBChange(strB);
    onShowMessage(
      fmt(loc.settings.transcodeAppliedLoopMsg, strA, strB || loc.player.timerEnd)
    );
  };

  const handleApplyBookmarksRange = () => {
    if (currentTrackBookmarks.length < 2) return;
    const bmA = currentTrackBookmarks.find((b) => /\b(a|punkt a|start|pocz[aą]tek)\b/i.test(b.name)) || currentTrackBookmarks[0];
    const bmB = currentTrackBookmarks.find((b) => /\b(b|punkt b|stop|end|koniec)\b/i.test(b.name) && b.id !== bmA?.id) || currentTrackBookmarks[1];
    const strA = formatTimeMs(bmA.position_ms);
    const strB = formatTimeMs(bmB.position_ms);
    onTranscodeRangeAChange(strA);
    onTranscodeRangeBChange(strB);
    onShowMessage(
      fmt(loc.settings.transcodeAppliedBookmarksMsg, bmA.name, strA, bmB.name, strB)
    );
  };

  const parsedA = parseTimeToMs(transcodeRangeA) ?? 0;
  const parsedB = parseTimeToMs(transcodeRangeB);
  const isOrderInvalid = parsedB !== null && parsedB <= parsedA;

  return (
    <div className="glass-panel mx-auto my-0 max-w-200 p-7">
      <h2 className="mb-3.5 flex items-center gap-2 text-xl">
        <FileAudio size={20} className="text-accent-pink" /> {loc.settings.exportOpus}
      </h2>

      {/* Safety banner */}
      <div
        className="mb-6 flex items-center gap-3 rounded-xl border border-accent-green/30 bg-accent-green/10 px-4.5 py-3.5"
      >
        <ShieldCheck size={24} className="text-accent-green" />
        <div>
          <strong className="text-sm text-accent-green">{loc.settings.transcodeIntegrity}</strong>
          <p className="text-ui text-fg-secondary">
            {loc.settings.transcodeIntegrityDesc}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-sm text-fg-secondary">
              {loc.settings.sourceFile}
            </label>
            {(currentPlayingTrack?.path || status.current_track?.uri) && (
              <button
                type="button"
                onClick={onUseCurrentTrackAsSource}
                className="flex items-center gap-1.5 rounded-md border border-pink-500/35 bg-pink-500/15 px-2.5 py-1 text-xs font-semibold text-accent-pink transition-all duration-200"
              >
                <Music size={12} />
                {loc.settings.useCurrentTrack}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={filePath}
              onChange={(e) => onFilePathChange(e.target.value)}
              className="flex-1 rounded-xl border border-line bg-black/30 px-3.5 py-2.5 font-mono text-sm text-fg"
            />
            <button
              type="button"
              disabled={isPickingSource}
              onClick={onPickTranscodeSource}
              className={cn(
                'flex items-center gap-1.5 rounded-xl border border-sky-400/40 bg-linear-135 from-sky-400/25 to-accent-purple/25 px-4 py-2.5 text-sm font-semibold whitespace-nowrap text-fg',
                isPickingSource ? 'cursor-not-allowed' : 'cursor-pointer',
                isPickingSource ? 'opacity-70' : 'opacity-100',
              )}
              title={loc.settings.chooseSource}
            >
              {isPickingSource ? (
                <Loader2 size={16} className="animate-spin text-accent-cyan" />
              ) : (
                <FolderOpen size={16} className="text-accent-cyan" />
              )}
              {loc.settings.chooseFile}
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm text-fg-secondary">
            {loc.settings.outputFile}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={transcodeOutput}
              onChange={(e) => onTranscodeOutputChange(e.target.value)}
              className="flex-1 rounded-xl border border-line bg-black/30 px-3.5 py-2.5 font-mono text-sm text-fg"
            />
            <button
              type="button"
              disabled={isPickingDestination}
              onClick={onPickTranscodeDestination}
              className={cn(
                'flex items-center gap-1.5 rounded-xl border border-line bg-white/8 px-4 py-2.5 text-sm font-semibold whitespace-nowrap text-fg',
                isPickingDestination ? 'cursor-not-allowed' : 'cursor-pointer',
                isPickingDestination ? 'opacity-70' : 'opacity-100',
              )}
              title={loc.settings.chooseDestination}
            >
              {isPickingDestination ? (
                <Loader2 size={16} className="animate-spin text-accent-pink" />
              ) : (
                <Save size={16} className="text-accent-pink" />
              )}
              {loc.settings.chooseDestination}
            </button>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm text-fg-secondary">
            {loc.settings.targetFormat}
          </label>
          <div className="flex gap-2.5">
            {(['Opus', 'Flac', 'Wav'] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => onTranscodeFormatChange(fmt)}
                className={cn(
                  'rounded-xl px-5 py-2.5 text-sm font-semibold text-fg',
                  transcodeFormat === fmt ? 'bg-accent-purple' : 'bg-white/6',
                )}
              >
                {fmt === 'Opus' ? 'Ogg Opus' : fmt === 'Flac' ? loc.settings.losslessFlac : loc.settings.wavPcm}
              </button>
            ))}
          </div>
        </div>

        {transcodeFormat === 'Opus' && (
          <div>
            <label className="mb-1.5 block text-sm text-fg-secondary">
              {loc.settings.opusBitrate} <strong className="text-accent-cyan">{transcodeBitrate} kbps</strong>
            </label>
            <input
              type="range"
              min={64}
              max={320}
              step={32}
              value={transcodeBitrate}
              onChange={(e) => onTranscodeBitrateChange(Number(e.target.value))}
              className="w-full"
            />
          </div>
        )}

        {/* DSP option: Nightcore / Slowed / Pitch / Reverb / EQ */}
        <TranscodeDspOption {...props} />

        {/* Trim to the A and B markers */}
        <TranscodeRangeOption {...props} handleApplyLoopFromPlayer={handleApplyLoopFromPlayer} handleApplyBookmarksRange={handleApplyBookmarksRange} parsedA={parsedA} parsedB={parsedB} isOrderInvalid={isOrderInvalid} />

        {/* Automatically add to the queue option */}
        <label
          className={cn(
            'mt-2.5 flex cursor-pointer select-none items-center gap-2.5 text-ui font-semibold',
            transcodeAutoEnqueue ? 'text-accent-cyan' : 'text-fg-secondary',
          )}
        >
          <input
            type="checkbox"
            checked={transcodeAutoEnqueue}
            onChange={(e) => onTranscodeAutoEnqueueChange(e.target.checked)}
            className="h-4 w-4 accent-accent-cyan"
          />
          <span>{loc.settings.transcodeAutoEnqueue}</span>
        </label>

        {/* Active background rendering progress panel */}
        {isTranscoding && (
          <div
            className="glass-card mt-4 flex flex-col gap-3 rounded-xl border border-accent-pink bg-linear-135 from-accent-purple/15 to-pink-500/10 px-5 py-4 shadow-xl shadow-pink-500/20 motion-safe:animate-fade-in"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 size={18} className="animate-spin text-accent-pink" />
                <span className="text-md font-bold text-fg">
                  {loc.settings.transcodeRendering}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-ui text-fg-muted">
                  {Math.floor(transcodeElapsedSeconds / 60)}:{(transcodeElapsedSeconds % 60).toString().padStart(2, '0')}
                </span>
                <span className="font-mono text-md font-extrabold text-accent-pink">
                  {transcodeProgress && transcodeProgress.percent > 0 ? `${Math.round(transcodeProgress.percent)}%` : '0%'}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 w-full overflow-hidden rounded-sm bg-white/10">
              <div
                className={cn(
                  'h-full rounded-sm bg-linear-to-r from-accent-pink to-accent-purple shadow-halo-sm shadow-pink-500/50 transition-[width] duration-200',
                  !transcodeProgress || transcodeProgress.percent === 0 && 'motion-safe:animate-pulse',
                )}
                style={{
                  width: transcodeProgress && transcodeProgress.percent > 0
                    ? `${Math.min(100, Math.max(3, transcodeProgress.percent))}%`
                    : '12%',
                }}
              />
            </div>

            <p className="m-0 text-ui leading-snug text-fg-secondary">
              {loc.settings.transcodeGstreamerBgDesc}
            </p>

            <div className="mt-0.5 flex justify-end">
              <button
                type="button"
                onClick={onMinimizeToBackground}
                className="glass-card flex items-center gap-1.5 rounded-lg border border-accent-cyan/30 bg-accent-cyan/8 px-3 py-1.5 text-xs font-semibold text-accent-cyan"
              >
                <ArrowRight size={13} />
                {loc.settings.transcodeRunInBackground}
              </button>
            </div>
          </div>
        )}

        <button
          onClick={onTranscode}
          disabled={isTranscoding}
          className={cn(
            'mt-3.5 flex items-center justify-center gap-2 rounded-xl p-3.5 text-md font-bold text-fg transition-all duration-200',
            isTranscoding ? 'bg-accent-purple/35' : 'bg-accent-gradient',
            isTranscoding ? 'shadow-none' : 'shadow-accent-glow',
            isTranscoding ? 'cursor-not-allowed' : 'cursor-pointer',
            isTranscoding ? 'opacity-75' : 'opacity-100',
          )}
        >
          {isTranscoding && <Loader2 size={18} className="animate-spin" />}
          {isTranscoding
            ? fmt(loc.settings.transcodeRenderingProgress, String(transcodeProgress && transcodeProgress.percent > 0 ? Math.round(transcodeProgress.percent) : 0))
            : loc.settings.exportOpus}
        </button>

        {/* Actions after a successful render */}
        {lastExportedTrack && (
          <TranscodeResultPanel {...props} lastExportedTrack={lastExportedTrack} />
        )}
      </div>
    </div>
  );
};
