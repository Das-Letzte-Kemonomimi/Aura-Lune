import React, { useId } from 'react';
import { FileAudio, ShieldCheck, Music, FolderOpen, Save, ArrowRight, ListPlus } from '../../components/ui/icons';
import {
  Button,
  Callout,
  Card,
  FieldLabel,
  ProgressBar,
  SectionHeader,
  SegmentedControl,
  SliderRow,
  Spinner,
  TextField,
  ToggleCard,
} from '../../components/ui';
import { type Language, type Translations } from '../../i18n';
import { type PlaybackStatus, type TrackRecord, type TrackBookmarkDto } from '../../types/player';
import { formatTimeMs, parseTimeToMs } from '../../utils/timeFormat';
import { TranscodeResultPanel } from './transcode/TranscodeResultPanel';
import { TranscodeRangeOption } from './transcode/TranscodeRangeOption';
import { TranscodeDspOption } from './transcode/TranscodeDspOption';
import { fmt } from '../../utils/fmt';
import { cn } from '../../utils/cn';
import { SettingsPage } from './SettingsPage';

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
  const id = useId();
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
  const percent = transcodeProgress && transcodeProgress.percent > 0 ? Math.round(transcodeProgress.percent) : 0;
  const formatLabels = { Opus: 'Ogg Opus', Flac: loc.settings.losslessFlac, Wav: loc.settings.wavPcm } as const;

  return (
    <SettingsPage title={loc.settings.exportOpus} icon={<FileAudio size={18} />} tone="pink">
      {/* Safety banner */}
      <Callout tone="green" icon={<ShieldCheck size={20} />}>
        <strong className="text-sm text-accent-green">{loc.settings.transcodeIntegrity}</strong>
        <p className="text-ui text-fg-secondary">{loc.settings.transcodeIntegrityDesc}</p>
      </Callout>

      <Card className="flex flex-col gap-4">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <FieldLabel htmlFor={`${id}-source`} className="mb-0">
              {loc.settings.sourceFile}
            </FieldLabel>
            {(currentPlayingTrack?.path || status.current_track?.uri) && (
              <Button variant="tinted" tone="pink" size="sm" onClick={onUseCurrentTrackAsSource}>
                <Music size={12} />
                {loc.settings.useCurrentTrack}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <TextField id={`${id}-source`} mono value={filePath} onChange={(e) => onFilePathChange(e.target.value)} />
            <Button disabled={isPickingSource} onClick={onPickTranscodeSource} title={loc.settings.chooseSource}>
              {isPickingSource ? <Spinner size="sm" tone="cyan" /> : <FolderOpen size={16} className="text-accent-cyan" />}
              {loc.settings.chooseFile}
            </Button>
          </div>
        </div>

        <div>
          <FieldLabel htmlFor={`${id}-output`}>{loc.settings.outputFile}</FieldLabel>
          <div className="flex gap-2">
            <TextField
              id={`${id}-output`}
              mono
              value={transcodeOutput}
              onChange={(e) => onTranscodeOutputChange(e.target.value)}
            />
            <Button
              disabled={isPickingDestination}
              onClick={onPickTranscodeDestination}
              title={loc.settings.chooseDestination}
            >
              {isPickingDestination ? <Spinner size="sm" /> : <Save size={16} className="text-accent-pink" />}
              {loc.settings.chooseDestination}
            </Button>
          </div>
        </div>

        <div>
          <FieldLabel>{loc.settings.targetFormat}</FieldLabel>
          <SegmentedControl
            label={loc.settings.targetFormat}
            tone="purple"
            items={(['Opus', 'Flac', 'Wav'] as const).map((f) => ({ value: f, label: formatLabels[f] }))}
            value={transcodeFormat}
            onChange={onTranscodeFormatChange}
          />
        </div>

        {transcodeFormat === 'Opus' && (
          <SliderRow
            label={loc.settings.opusBitrate}
            tone="cyan"
            min={64}
            max={320}
            step={32}
            value={transcodeBitrate}
            format={(v) => `${v} kbps`}
            onChange={onTranscodeBitrateChange}
          />
        )}
      </Card>

      {/* DSP option: Nightcore / Slowed / Pitch / Reverb / EQ */}
      <TranscodeDspOption {...props} />

      {/* Trim to the A and B markers */}
      <TranscodeRangeOption
        {...props}
        handleApplyLoopFromPlayer={handleApplyLoopFromPlayer}
        handleApplyBookmarksRange={handleApplyBookmarksRange}
        parsedA={parsedA}
        parsedB={parsedB}
        isOrderInvalid={isOrderInvalid}
      />

      {/* Add the rendered file to the queue automatically */}
      <ToggleCard
        icon={<ListPlus size={18} />}
        tone="cyan"
        title={loc.settings.transcodeAutoEnqueue}
        checked={transcodeAutoEnqueue}
        onChange={onTranscodeAutoEnqueueChange}
      />

      {/* Background rendering progress */}
      {isTranscoding && (
        <Card highlight="pink" className="flex flex-col gap-3 motion-safe:animate-fade-in">
          <SectionHeader
            icon={<Spinner />}
            tone="pink"
            title={loc.settings.transcodeRendering}
            description={loc.settings.transcodeGstreamerBgDesc}
            actions={
              <>
                <span className="font-mono text-ui text-fg-muted">
                  {Math.floor(transcodeElapsedSeconds / 60)}:{(transcodeElapsedSeconds % 60).toString().padStart(2, '0')}
                </span>
                <span className="font-mono text-md font-extrabold text-accent-pink">{percent}%</span>
              </>
            }
          />
          <ProgressBar
            value={percent > 0 ? Math.max(3, percent) : 12}
            label={loc.settings.transcodeRendering}
            className={cn(percent === 0 && 'motion-safe:animate-pulse')}
          />
          <div className="flex justify-end">
            <Button variant="tinted" tone="cyan" size="sm" onClick={onMinimizeToBackground}>
              <ArrowRight size={13} />
              {loc.settings.transcodeRunInBackground}
            </Button>
          </div>
        </Card>
      )}

      <Button variant="primary" size="lg" onClick={onTranscode} disabled={isTranscoding} className="w-full py-3.5">
        {isTranscoding && <Spinner size="md" tone="neutral" className="text-on-accent" />}
        {isTranscoding ? fmt(loc.settings.transcodeRenderingProgress, String(percent)) : loc.settings.exportOpus}
      </Button>

      {/* Actions after a successful render */}
      {lastExportedTrack && <TranscodeResultPanel {...props} lastExportedTrack={lastExportedTrack} />}
    </SettingsPage>
  );
};
