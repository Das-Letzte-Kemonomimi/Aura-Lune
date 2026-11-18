import React from 'react';
import {
  FileAudio,
  ShieldCheck,
  Music,
  FolderOpen,
  Save,
  Scissors,
  Repeat,
  Bookmark,
  Loader2,
  ArrowRight,
  CheckCircle,
  X,
  Play,
  Plus,
  ListPlus,
} from 'lucide-react';
import { type Language, type Translations } from '../../i18n';
import { type PlaybackStatus, type TrackRecord } from '../../types/player';
import { type TrackBookmarkDto } from '../../components/modals/TrackBookmarksModal';
import { formatTimeMs, parseTimeToMs } from '../../components/modals/LoopEditorModal';

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

export const TranscodeSettingsView: React.FC<TranscodeSettingsViewProps> = ({
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
  transcodeApplyDsp,
  onTranscodeApplyDspChange,
  reverbEnabled,
  reverbLevel,
  transcodeApplyRange,
  onTranscodeApplyRangeChange,
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
  onDismissLastExported,
  onPlayLibraryTrack,
  onAddTrackToQueue,
  onAddToPlaylist,
  onOpenContainingFolder,
  onShowMessage,
}) => {
  const handleApplyLoopFromPlayer = () => {
    const strA = loopPointA !== null ? formatTimeMs(loopPointA) : '0:00.000';
    const strB = loopPointB !== null ? formatTimeMs(loopPointB) : '';
    onTranscodeRangeAChange(strA);
    onTranscodeRangeBChange(strB);
    onShowMessage(
      loc.settings.transcodeAppliedLoopMsg
        .replace('{0}', strA)
        .replace('{1}', strB || loc.player.timerEnd)
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
      loc.settings.transcodeAppliedBookmarksMsg
        .replace('{0}', bmA.name)
        .replace('{1}', strA)
        .replace('{2}', bmB.name)
        .replace('{3}', strB)
    );
  };

  const parsedA = parseTimeToMs(transcodeRangeA) ?? 0;
  const parsedB = parseTimeToMs(transcodeRangeB);
  const isOrderInvalid = parsedB !== null && parsedB <= parsedA;

  return (
    <div className="glass-panel" style={{ padding: '28px', maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.2rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <FileAudio size={20} color="var(--accent-pink)" /> {loc.settings.exportOpus}
      </h2>

      {/* Baner bezpieczeństwa */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '14px 18px',
          borderRadius: '12px',
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          marginBottom: '24px',
        }}
      >
        <ShieldCheck size={24} color="var(--accent-green)" />
        <div>
          <strong style={{ color: 'var(--accent-green)', fontSize: '0.85rem' }}>{loc.settings.transcodeIntegrity}</strong>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {loc.settings.transcodeIntegrityDesc}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {loc.settings.sourceFile}
            </label>
            {(currentPlayingTrack?.path || status.current_track?.uri) && (
              <button
                type="button"
                onClick={onUseCurrentTrackAsSource}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  background: 'rgba(236, 72, 153, 0.15)',
                  border: '1px solid rgba(236, 72, 153, 0.35)',
                  color: 'var(--accent-pink)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  transition: 'all 0.2s ease',
                }}
              >
                <Music size={12} />
                {loc.settings.useCurrentTrack}
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={filePath}
              onChange={(e) => onFilePathChange(e.target.value)}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)',
                background: 'rgba(0,0,0,0.3)',
                color: '#fff',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
              }}
            />
            <button
              type="button"
              disabled={isPickingSource}
              onClick={onPickTranscodeSource}
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(168, 85, 247, 0.25))',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: isPickingSource ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
                opacity: isPickingSource ? 0.7 : 1,
              }}
              title={loc.settings.chooseSource}
            >
              {isPickingSource ? (
                <Loader2 size={16} className="spin" color="var(--accent-cyan)" />
              ) : (
                <FolderOpen size={16} color="var(--accent-cyan)" />
              )}
              {loc.settings.chooseFile}
            </button>
          </div>
        </div>

        <div>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
            {loc.settings.outputFile}
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={transcodeOutput}
              onChange={(e) => onTranscodeOutputChange(e.target.value)}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)',
                background: 'rgba(0,0,0,0.3)',
                color: '#fff',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
              }}
            />
            <button
              type="button"
              disabled={isPickingDestination}
              onClick={onPickTranscodeDestination}
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid var(--border-subtle)',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: isPickingDestination ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
                opacity: isPickingDestination ? 0.7 : 1,
              }}
              title={loc.settings.chooseDestination}
            >
              {isPickingDestination ? (
                <Loader2 size={16} className="spin" color="var(--accent-pink)" />
              ) : (
                <Save size={16} color="var(--accent-pink)" />
              )}
              {loc.settings.chooseDestination}
            </button>
          </div>
        </div>

        <div>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
            {loc.settings.targetFormat}
          </label>
          <div style={{ display: 'flex', gap: '10px' }}>
            {(['Opus', 'Flac', 'Wav'] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => onTranscodeFormatChange(fmt)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  background: transcodeFormat === fmt ? 'var(--accent-purple)' : 'rgba(255,255,255,0.06)',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                }}
              >
                {fmt === 'Opus' ? 'Ogg Opus' : fmt === 'Flac' ? loc.settings.losslessFlac : loc.settings.wavPcm}
              </button>
            ))}
          </div>
        </div>

        {transcodeFormat === 'Opus' && (
          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              {loc.settings.opusBitrate} <strong style={{ color: 'var(--accent-cyan)' }}>{transcodeBitrate} kbps</strong>
            </label>
            <input
              type="range"
              min={64}
              max={320}
              step={32}
              value={transcodeBitrate}
              onChange={(e) => onTranscodeBitrateChange(Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
        )}

        {/* Opcja nałożenia DSP: Nightcore / Slowed / Pitch / Reverb / EQ */}
        <div
          style={{
            marginTop: '10px',
            padding: '12px 14px',
            borderRadius: '10px',
            background: transcodeApplyDsp
              ? 'rgba(244, 63, 94, 0.12)'
              : 'rgba(255, 255, 255, 0.03)',
            border: transcodeApplyDsp
              ? '1px solid var(--accent-pink)'
              : '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            transition: 'all 0.2s ease',
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              userSelect: 'none',
              fontWeight: 600,
              fontSize: '0.88rem',
              color: transcodeApplyDsp ? 'var(--accent-pink)' : 'var(--text-primary)',
            }}
          >
            <input
              type="checkbox"
              checked={transcodeApplyDsp}
              onChange={(e) => onTranscodeApplyDspChange(e.target.checked)}
              style={{ accentColor: 'var(--accent-pink)', width: '16px', height: '16px' }}
            />
            <span>{loc.settings.transcodeApplyDsp}</span>
          </label>
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', paddingLeft: '26px' }}>
            {loc.settings.transcodeApplyDspDesc}
          </p>
          {transcodeApplyDsp && (
            <div
              style={{
                paddingLeft: '26px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                fontSize: '0.78rem',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: 'rgba(255, 105, 180, 0.2)',
                  color: 'var(--accent-pink)',
                }}
              >
                Pitch: {(status.pitch_semitones ?? 0) > 0 ? `+${(status.pitch_semitones ?? 0).toFixed(1)}` : (status.pitch_semitones ?? 0).toFixed(1)} st
              </span>
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: 'rgba(6, 182, 212, 0.2)',
                  color: 'var(--accent-cyan)',
                }}
              >
                Tempo: {(status.tempo_ratio ?? 1.0).toFixed(2)}x
              </span>
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: 'rgba(168, 85, 247, 0.2)',
                  color: 'var(--accent-purple)',
                }}
              >
                Speed: {(status.rate_ratio ?? 1.0).toFixed(2)}x
              </span>
              {reverbEnabled && (
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: 'rgba(234, 179, 8, 0.2)',
                    color: '#facc15',
                  }}
                >
                  Reverb: {Math.round(reverbLevel * 100)}%
                </span>
              )}
            </div>
          )}
        </div>

        {/* Opcja przycięcia do markerów A i B */}
        <div
          style={{
            marginTop: '10px',
            padding: '12px 14px',
            borderRadius: '10px',
            background: transcodeApplyRange
              ? 'rgba(6, 182, 212, 0.12)'
              : 'rgba(255, 255, 255, 0.03)',
            border: transcodeApplyRange
              ? '1px solid var(--accent-cyan)'
              : '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            transition: 'all 0.2s ease',
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              userSelect: 'none',
              fontWeight: 600,
              fontSize: '0.88rem',
              color: transcodeApplyRange ? 'var(--accent-cyan)' : 'var(--text-primary)',
            }}
          >
            <input
              type="checkbox"
              checked={transcodeApplyRange}
              onChange={(e) => onTranscodeApplyRangeChange(e.target.checked)}
              style={{ accentColor: 'var(--accent-cyan)', width: '16px', height: '16px' }}
            />
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <Scissors size={15} color={transcodeApplyRange ? 'var(--accent-cyan)' : 'var(--text-muted)'} />
              {loc.settings.transcodeApplyRange}
              {(loopPointA !== null || loopPointB !== null) && (
                <span
                  style={{
                    fontSize: '0.72rem',
                    padding: '1px 8px',
                    borderRadius: '10px',
                    background: 'rgba(6, 182, 212, 0.22)',
                    color: 'var(--accent-cyan)',
                    fontWeight: 700,
                    border: '1px solid rgba(6, 182, 212, 0.35)',
                  }}
                >
                  {loc.settings.transcodeLoopAB} {formatTimeMs(loopPointA ?? 0)} → {formatTimeMs(loopPointB)}
                </span>
              )}
            </span>
          </label>
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', paddingLeft: '26px' }}>
            {loc.settings.transcodeApplyRangeDesc}
          </p>

          {transcodeApplyRange && (
            <div
              style={{
                paddingLeft: '26px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                marginTop: '4px',
              }}
            >
              {/* Przyciski synchronizacji z pętlą A-B z odtwarzacza oraz zapisanymi znacznikami */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {(loopPointA !== null || loopPointB !== null) && (
                  <button
                    type="button"
                    onClick={handleApplyLoopFromPlayer}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      background: 'rgba(6, 182, 212, 0.15)',
                      border: '1px solid rgba(6, 182, 212, 0.3)',
                      color: 'var(--accent-cyan)',
                      fontSize: '0.76rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    <Repeat size={12} />
                    {loc.settings.transcodeFromPlayer} ({loopPointA !== null ? `A: ${formatTimeMs(loopPointA)}` : 'A: 0ms'} → {loopPointB !== null ? `B: ${formatTimeMs(loopPointB)}` : 'B: —'})
                  </button>
                )}

                {currentTrackBookmarks.length >= 2 && (
                  <button
                    type="button"
                    onClick={handleApplyBookmarksRange}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      background: 'rgba(236, 72, 153, 0.15)',
                      border: '1px solid rgba(236, 72, 153, 0.35)',
                      color: 'var(--accent-pink)',
                      fontSize: '0.76rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    <Bookmark size={12} />
                    {loc.settings.transcodeApplySavedBookmarks.replace('{0}', String(currentTrackBookmarks.length))}
                  </button>
                )}
              </div>

              {currentTrackBookmarks.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Zapisane znaczniki utworu:</span>
                  {currentTrackBookmarks.map((bm) => (
                    <div key={bm.id} style={{ display: 'flex', alignItems: 'center', gap: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', padding: '2px 6px', fontSize: '0.7rem' }}>
                      <span style={{ color: '#fff', fontWeight: 600 }}>{bm.name}</span>
                      <span style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>({formatTimeMs(bm.position_ms)})</span>
                      <button
                        type="button"
                        onClick={() => onTranscodeRangeAChange(formatTimeMs(bm.position_ms))}
                        title={`Ustaw "${bm.name}" jako Punkt A`}
                        style={{ background: 'rgba(6,182,212,0.2)', border: 'none', color: 'var(--accent-cyan)', borderRadius: '3px', padding: '1px 4px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 700 }}
                      >
                        A
                      </button>
                      <button
                        type="button"
                        onClick={() => onTranscodeRangeBChange(formatTimeMs(bm.position_ms))}
                        title={`Ustaw "${bm.name}" jako Punkt B`}
                        style={{ background: 'rgba(236,72,153,0.2)', border: 'none', color: 'var(--accent-pink)', borderRadius: '3px', padding: '1px 4px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 700 }}
                      >
                        B
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                {/* Punkt A */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                      {loc.settings.transcodePointA}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {formatTimeMs(parsedA)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      placeholder="np. 0:00.000, 0:22.449, 860ms"
                      value={transcodeRangeA}
                      onChange={(e) => onTranscodeRangeAChange(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-subtle)',
                        background: 'rgba(0,0,0,0.3)',
                        color: '#fff',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.8rem',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => onTranscodeRangeAChange(formatTimeMs(status.position_ms))}
                      title={loc.settings.transcodeSetCurrentPos}
                      style={{
                        padding: '6px 8px',
                        borderRadius: '6px',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-secondary)',
                        fontSize: '0.72rem',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {loc.settings.transcodeSetCurrentTime}
                    </button>
                    {loopPointA !== null && (
                      <button
                        type="button"
                        onClick={() => onTranscodeRangeAChange(formatTimeMs(loopPointA))}
                        title={loc.settings.transcodeGetLoopA}
                        style={{
                          padding: '6px 8px',
                          borderRadius: '6px',
                          background: 'rgba(6, 182, 212, 0.2)',
                          border: '1px solid var(--accent-cyan)',
                          color: 'var(--accent-cyan)',
                          fontSize: '0.72rem',
                          cursor: 'pointer',
                          fontWeight: 600,
                        }}
                      >
                        A
                      </button>
                    )}
                  </div>
                </div>

                {/* Punkt B */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--accent-pink)', fontWeight: 600 }}>
                      {loc.settings.transcodePointB}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {parsedB !== null
                        ? formatTimeMs(parsedB)
                        : loc.settings.transcodeEndOfTrack}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      placeholder={loc.settings.transcodeTimePlaceholder}
                      value={transcodeRangeB}
                      onChange={(e) => onTranscodeRangeBChange(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-subtle)',
                        background: 'rgba(0,0,0,0.3)',
                        color: '#fff',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.8rem',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => onTranscodeRangeBChange(formatTimeMs(status.position_ms))}
                      title={loc.settings.transcodeSetCurrentPos}
                      style={{
                        padding: '6px 8px',
                        borderRadius: '6px',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-secondary)',
                        fontSize: '0.72rem',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {loc.settings.transcodeSetCurrentTime}
                    </button>
                    {loopPointB !== null && (
                      <button
                        type="button"
                        onClick={() => onTranscodeRangeBChange(formatTimeMs(loopPointB))}
                        title={loc.settings.transcodeGetLoopB}
                        style={{
                          padding: '6px 8px',
                          borderRadius: '6px',
                          background: 'rgba(244, 63, 94, 0.2)',
                          border: '1px solid var(--accent-pink)',
                          color: 'var(--accent-pink)',
                          fontSize: '0.72rem',
                          cursor: 'pointer',
                          fontWeight: 600,
                        }}
                      >
                        B
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Podsumowanie zakresu i walidacja */}
              {isOrderInvalid ? (
                <div
                  style={{
                    color: 'var(--accent-pink)',
                    fontSize: '0.76rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: 600,
                  }}
                >
                  <span>⚠️ {loc.settings.transcodeEndMustBeGreater}</span>
                </div>
              ) : parsedB !== null ? (
                <div
                  style={{
                    color: 'var(--accent-cyan)',
                    fontSize: '0.76rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  <span>✂️ {loc.settings.transcodeRangeDuration.replace('{0}', `${((parsedB - parsedA) / 1000).toFixed(3)}s (${formatTimeMs(parsedB - parsedA)})`)}</span>
                </div>
              ) : (
                <div
                  style={{
                    color: 'var(--text-muted)',
                    fontSize: '0.76rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  <span>✂️ {loc.settings.transcodeExportRangeText.replace('{0}', formatTimeMs(parsedA))}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Opcja automatycznego dodania do kolejki */}
        <label
          style={{
            marginTop: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            userSelect: 'none',
            fontSize: '0.84rem',
            color: transcodeAutoEnqueue ? 'var(--accent-cyan)' : 'var(--text-secondary)',
            fontWeight: 600,
          }}
        >
          <input
            type="checkbox"
            checked={transcodeAutoEnqueue}
            onChange={(e) => onTranscodeAutoEnqueueChange(e.target.checked)}
            style={{ accentColor: 'var(--accent-cyan)', width: '16px', height: '16px' }}
          />
          <span>{loc.settings.transcodeAutoEnqueue}</span>
        </label>

        {/* Aktywny panel postępu renderowania w tle */}
        {isTranscoding && (
          <div
            className="glass-card"
            style={{
              marginTop: '16px',
              padding: '16px 20px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(236, 72, 153, 0.12) 100%)',
              border: '1px solid var(--accent-pink)',
              boxShadow: '0 4px 24px rgba(236, 72, 153, 0.22)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              animation: 'fadeIn 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Loader2 size={18} className="spin" color="var(--accent-pink)" />
                <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#fff' }}>
                  {loc.settings.transcodeRendering}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {Math.floor(transcodeElapsedSeconds / 60)}:{(transcodeElapsedSeconds % 60).toString().padStart(2, '0')}
                </span>
                <span style={{ fontSize: '0.94rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent-pink)' }}>
                  {transcodeProgress && transcodeProgress.percent > 0 ? `${Math.round(transcodeProgress.percent)}%` : '0%'}
                </span>
              </div>
            </div>

            {/* Pasek postępu */}
            <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '3px', overflow: 'hidden' }}>
              <div
                style={{
                  width: transcodeProgress && transcodeProgress.percent > 0
                    ? `${Math.min(100, Math.max(3, transcodeProgress.percent))}%`
                    : '12%',
                  height: '100%',
                  background: 'linear-gradient(90deg, var(--accent-pink), var(--accent-purple))',
                  borderRadius: '3px',
                  transition: 'width 0.2s ease',
                  boxShadow: '0 0 10px rgba(236, 72, 153, 0.5)',
                  animation: !transcodeProgress || transcodeProgress.percent === 0 ? 'pulse 1.5s ease-in-out infinite' : 'none',
                }}
              />
            </div>

            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {loc.settings.transcodeGstreamerBgDesc}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
              <button
                type="button"
                onClick={onMinimizeToBackground}
                className="glass-card"
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  color: 'var(--accent-cyan)',
                  border: '1px solid rgba(6, 182, 212, 0.3)',
                  background: 'rgba(6, 182, 212, 0.08)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
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
          style={{
            marginTop: '14px',
            padding: '14px',
            borderRadius: '12px',
            background: isTranscoding
              ? 'rgba(168, 85, 247, 0.35)'
              : 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
            color: '#fff',
            fontWeight: 700,
            fontSize: '0.95rem',
            boxShadow: isTranscoding ? 'none' : 'var(--shadow-glow)',
            cursor: isTranscoding ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            opacity: isTranscoding ? 0.75 : 1,
            transition: 'all 0.2s ease',
          }}
        >
          {isTranscoding && <Loader2 size={18} className="spin" />}
          {isTranscoding
            ? loc.settings.transcodeRenderingProgress.replace(
                '{0}',
                String(transcodeProgress && transcodeProgress.percent > 0 ? Math.round(transcodeProgress.percent) : 0)
              )
            : loc.settings.exportOpus}
        </button>

        {/* Panel akcji po pomyślnym wyrenderowaniu */}
        {lastExportedTrack && (
          <div
            className="glass-panel"
            style={{
              marginTop: '16px',
              padding: '16px',
              borderRadius: '12px',
              background: 'rgba(34, 197, 94, 0.08)',
              border: '1px solid rgba(34, 197, 94, 0.4)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              boxShadow: '0 4px 20px rgba(34, 197, 94, 0.1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={18} color="var(--accent-green)" />
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff' }}>
                  {loc.settings.transcodeCompletedTitle}
                </span>
              </div>
              <button
                onClick={onDismissLastExported}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={15} />
              </button>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', wordBreak: 'break-all', fontFamily: 'var(--font-mono)' }}>
              {lastExportedTrack.path}
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
              <button
                onClick={() => onPlayLibraryTrack(lastExportedTrack)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  border: 'none',
                  boxShadow: '0 2px 8px rgba(244, 63, 94, 0.3)',
                }}
              >
                <Play size={14} fill="#fff" />
                {loc.settings.playRenderedNow}
              </button>
              <button
                onClick={(e) => onAddTrackToQueue(lastExportedTrack, e)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--accent-cyan)',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
              >
                <Plus size={14} />
                {loc.settings.addRenderedToQueue}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToPlaylist(lastExportedTrack);
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--accent-purple)',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
              >
                <ListPlus size={14} />
                {loc.settings.addRenderedToPlaylist}
              </button>
              <button
                onClick={(e) => onOpenContainingFolder(lastExportedTrack.path, e)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
              >
                <FolderOpen size={14} />
                {loc.settings.openRenderedFolder}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
