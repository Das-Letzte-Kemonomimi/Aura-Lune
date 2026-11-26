import React from 'react';
import { Bookmark } from 'lucide-react';
import { WaveformCanvas } from '../../../components/player/WaveformCanvas';
import type { PlaybackStatus } from '../../../types/player';
import type { PlayerViewProps } from '../PlayerView';
import { fmt } from '../../../utils/fmt';

export type PlayerProgressSectionProps = Pick<PlayerViewProps, 'formatTime' | 'dspCombination' | 'loopPointA' | 'loopPointB' | 'setIsLoopEditorOpen' | 'loc' | 'formatTimeMs' | 'setLoopPointA' | 'setLoopPointB' | 'showMessage' | 'handleToggleSeekFade' | 'seekFadeEnabled' | 'trackWaveformPeaks' | 'language' | 'handleSeek' | 'handleSeekPreview' | 'handleSeekCommit' | 'currentBookmark' | 'currentTrackBookmarks'> & {
  status: PlaybackStatus;
  seekProgressPercent: number;
};

export const PlayerProgressSection: React.FC<PlayerProgressSectionProps> = ({
  currentBookmark,
  currentTrackBookmarks,
  dspCombination,
  formatTime,
  formatTimeMs,
  handleSeek,
  handleSeekCommit,
  handleSeekPreview,
  handleToggleSeekFade,
  language,
  loc,
  loopPointA,
  loopPointB,
  seekFadeEnabled,
  seekProgressPercent,
  setIsLoopEditorOpen,
  setLoopPointA,
  setLoopPointB,
  showMessage,
  status,
  trackWaveformPeaks,
}) => (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '6px',
          fontSize: '0.78rem',
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-secondary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
            {formatTime(status.position_ms)}
          </span>
          {/* Wskaźnik prędkości i transpozycji DSP jeśli tempo, szybkość lub pitch jest modyfikowane */}
          {(dspCombination.hasTempo || dspCombination.hasRate || dspCombination.hasPitch) && (
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: '4px',
                background: 'rgba(168, 85, 247, 0.25)',
                color: 'var(--accent-purple)',
                border: '1px solid rgba(168, 85, 247, 0.45)',
              }}
              title={`DSP (${dspCombination.engine}): Σ Speed ${dspCombination.totalSpeedRatio.toFixed(2)}x, Σ Pitch ${dspCombination.totalPitchSemitones > 0 ? `+${dspCombination.totalPitchSemitones.toFixed(2)}` : dspCombination.totalPitchSemitones.toFixed(2)}st (Tempo: ${dspCombination.tempoRatio.toFixed(2)}x, Pitch: ${dspCombination.pitchSt.toFixed(2)}st, Rate: ${dspCombination.rateRatio.toFixed(2)}x)`}
            >
              DSP {dspCombination.totalSpeedRatio !== 1.0 ? `${dspCombination.totalSpeedRatio.toFixed(2)}x` : ''}
              {dspCombination.totalSpeedRatio !== 1.0 && Math.abs(dspCombination.totalPitchSemitones) > 0.005 ? ', ' : ''}
              {Math.abs(dspCombination.totalPitchSemitones) > 0.005 ? `${dspCombination.totalPitchSemitones > 0 ? `+${dspCombination.totalPitchSemitones.toFixed(2)}` : dspCombination.totalPitchSemitones.toFixed(2)}st` : ''}
            </span>
          )}
          {(loopPointA !== null || loopPointB !== null) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span
                onClick={() => setIsLoopEditorOpen(true)}
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: '4px',
                  background: loopPointA !== null && loopPointB !== null ? 'rgba(6, 182, 212, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                  color: loopPointA !== null && loopPointB !== null ? 'var(--accent-cyan)' : '#fbbf24',
                  border: loopPointA !== null && loopPointB !== null ? '1px solid rgba(6, 182, 212, 0.45)' : '1px solid rgba(251, 191, 36, 0.4)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title={loc.player.editLoopTooltip}
              >
                <span>🔁 {loc.player.loopAB}:</span>
                <span style={{ color: 'var(--accent-cyan)' }}>{loopPointA !== null ? formatTimeMs(loopPointA) : '0:00.000'}</span>
                <span>→</span>
                <span style={{ color: 'var(--accent-pink)' }}>{loopPointB !== null ? formatTimeMs(loopPointB) : '—'}</span>
                {loopPointA !== null && loopPointB !== null && loopPointB > loopPointA && (
                  <span style={{ opacity: 0.85, fontSize: '0.62rem' }}>
                    ({((loopPointB - loopPointA) / 1000).toFixed(1)}s)
                  </span>
                )}
              </span>
              <button
                onClick={() => {
                  setLoopPointA(null);
                  setLoopPointB(null);
                  showMessage(loc.player.clearedLoopMsg);
                }}
                style={{
                  padding: '1px 5px',
                  fontSize: '0.65rem',
                  background: 'rgba(244, 63, 94, 0.2)',
                  border: '1px solid rgba(244, 63, 94, 0.45)',
                  color: '#ff6b81',
                  borderRadius: '3px',
                  cursor: 'pointer',
                }}
                title={loc.player.clearLoop}
              >
                ✕
              </button>
            </div>
          )}

          {/* Przełącznik płynnego wyciszenia paska postępu (Fade Seek) */}
          <button
            onClick={handleToggleSeekFade}
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              padding: '1px 8px',
              borderRadius: '4px',
              background: seekFadeEnabled ? 'rgba(236, 72, 153, 0.2)' : 'rgba(255, 255, 255, 0.06)',
              color: seekFadeEnabled ? 'var(--accent-pink)' : 'var(--text-muted)',
              border: seekFadeEnabled ? '1px solid rgba(236, 72, 153, 0.45)' : '1px solid var(--border-subtle)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title={loc.player.seekFadeDesc}
          >
            {seekFadeEnabled ? loc.player.seekFadeOn : loc.player.seekFadeOff}
          </button>
        </div>
        <span>{status.duration_ms ? formatTime(status.duration_ms) : '--:--'}</span>
      </div>

      {/* Wizualizacja przebiegu utworu (Waveform) - interaktywna fala zsynchronizowana z DSP */}
      <WaveformCanvas
        peaks={trackWaveformPeaks || []}
        progress={status.duration_ms && status.duration_ms > 0 ? (status.position_ms / status.duration_ms) * 100 : 0}
        durationMs={status.duration_ms || 0}
        positionMs={status.position_ms || 0}
        loopPointA={loopPointA}
        loopPointB={loopPointB}
        isPlaying={status.state === 'Playing'}
        height={66}
        colorPlayedStart="#f43f5e"
        colorPlayedEnd="#a855f7"
        currentLang={language}
        onSeek={(pct) => {
          if (status.duration_ms && status.duration_ms > 0) {
            handleSeek(Math.floor(pct * status.duration_ms));
          }
        }}
        onSeekPreview={(pct) => {
          if (status.duration_ms && status.duration_ms > 0) {
            handleSeekPreview?.(Math.floor(pct * status.duration_ms));
          }
        }}
        onSeekCommit={(pct) => {
          if (status.duration_ms && status.duration_ms > 0) {
            if (handleSeekCommit) {
              handleSeekCommit(Math.floor(pct * status.duration_ms));
            } else {
              handleSeek(Math.floor(pct * status.duration_ms));
            }
          }
        }}
        title={`${loc.waveform.title} (${loc.waveform.hint})`}
        style={{ marginBottom: '10px' }}
      />

      {/* Kontener suwaka z podświetleniem pętli A-B oraz znacznikiem zakładki */}
      <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
        {loopPointA !== null && loopPointB !== null && status.duration_ms && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              transform: 'translateY(-50%)',
              left: `${(loopPointA / status.duration_ms) * 100}%`,
              width: `${Math.max(2, ((loopPointB - loopPointA) / status.duration_ms) * 100)}%`,
              height: '8px',
              borderRadius: '4px',
              background: 'linear-gradient(90deg, rgba(6, 182, 212, 0.65), rgba(244, 63, 94, 0.65))',
              boxShadow: '0 0 10px rgba(6, 182, 212, 0.6)',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />
        )}
        {loopPointA !== null && status.duration_ms && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              handleSeek(loopPointA);
              showMessage(fmt(loc.player.jumpToPointAMsg, formatTimeMs(loopPointA)));
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setIsLoopEditorOpen(true);
            }}
            style={{
              position: 'absolute',
              top: '-16px',
              left: `${(loopPointA / status.duration_ms) * 100}%`,
              transform: 'translateX(-50%)',
              fontSize: '0.62rem',
              fontWeight: 800,
              color: 'var(--accent-cyan)',
              background: '#090d16',
              border: '1px solid var(--accent-cyan)',
              borderRadius: '3px',
              padding: '0 4px',
              cursor: 'pointer',
              zIndex: 2,
            }}
            title={fmt(loc.player.pointATooltip, formatTimeMs(loopPointA), String(loopPointA))}
          >
            A
          </div>
        )}
        {loopPointB !== null && status.duration_ms && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              handleSeek(loopPointB);
              showMessage(fmt(loc.player.jumpToPointBMsg, formatTimeMs(loopPointB)));
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setIsLoopEditorOpen(true);
            }}
            style={{
              position: 'absolute',
              top: '-16px',
              left: `${(loopPointB / status.duration_ms) * 100}%`,
              transform: 'translateX(-50%)',
              fontSize: '0.62rem',
              fontWeight: 800,
              color: 'var(--accent-pink)',
              background: '#090d16',
              border: '1px solid var(--accent-pink)',
              borderRadius: '3px',
              padding: '0 4px',
              cursor: 'pointer',
              zIndex: 2,
            }}
            title={fmt(loc.player.pointBTooltip, formatTimeMs(loopPointB), String(loopPointB))}
          >
            B
          </div>
        )}
        {/* Wskaźnik zapisanej zakładki na osi czasu */}
        {currentBookmark !== null && status.duration_ms && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              handleSeek(currentBookmark);
            }}
            style={{
              position: 'absolute',
              top: '-18px',
              left: `${(currentBookmark / status.duration_ms) * 100}%`,
              transform: 'translateX(-50%)',
              fontSize: '0.62rem',
              fontWeight: 800,
              color: '#fbbf24',
              background: '#090d16',
              border: '1px solid #fbbf24',
              borderRadius: '3px',
              padding: '0 4px',
              cursor: 'pointer',
              zIndex: 3,
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              boxShadow: '0 0 8px rgba(251, 191, 36, 0.4)',
            }}
            title={`${fmt(loc.player.bookmarkJump, formatTime(currentBookmark))} (${loc.player.clickToJump})`}
          >
            <Bookmark size={9} fill="#fbbf24" /> {formatTime(currentBookmark)}
          </div>
        )}
        {/* Wskaźniki wielopunktowych zakładek (Track Bookmarks / Cue Points) na osi czasu */}
        {status.duration_ms && status.duration_ms > 0 && currentTrackBookmarks.map((bm) => {
          const leftPct = Math.min(100, Math.max(0, (bm.position_ms / status.duration_ms!) * 100));
          return (
            <div
              key={`bm-${bm.id}`}
              onClick={(e) => {
                e.stopPropagation();
                handleSeek(bm.position_ms);
                showMessage(`📌 ${bm.name} (${formatTimeMs(bm.position_ms)})`);
              }}
              style={{
                position: 'absolute',
                top: '50%',
                left: `${leftPct}%`,
                transform: 'translate(-50%, -50%) rotate(45deg)',
                width: '8px',
                height: '8px',
                backgroundColor: 'var(--accent-cyan, #06b6d4)',
                border: '1px solid #fff',
                borderRadius: '2px',
                zIndex: 4,
                cursor: 'pointer',
                boxShadow: '0 0 6px rgba(6, 182, 212, 0.9)',
              }}
              title={`📌 ${bm.name} - ${formatTimeMs(bm.position_ms)} (${loc.player.clickToJump})`}
            />
          );
        })}
        <input
          type="range"
          min={0}
          max={status.duration_ms || 100}
          value={status.position_ms}
          onChange={(e) => {
            const val = Number(e.target.value);
            if (handleSeekPreview) handleSeekPreview(val);
            else handleSeek(val);
          }}
          onPointerUp={(e) => {
            handleSeekCommit?.(Number(e.currentTarget.value));
            e.currentTarget.blur();
          }}
          onMouseUp={(e) => {
            handleSeekCommit?.(Number(e.currentTarget.value));
            e.currentTarget.blur();
          }}
          onTouchEnd={(e) => {
            handleSeekCommit?.(Number(e.currentTarget.value));
            e.currentTarget.blur();
          }}
          onKeyUp={(e) => {
            if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
              handleSeekCommit?.(Number(e.currentTarget.value));
            }
          }}
          onKeyDown={(e) => {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) || ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
              e.currentTarget.blur();
            }
          }}
          style={{
            width: '100%',
            position: 'relative',
            zIndex: 3,
            background: `linear-gradient(to right, var(--accent-pink) 0%, var(--accent-purple) ${seekProgressPercent}%, rgba(255, 255, 255, 0.12) ${seekProgressPercent}%, rgba(255, 255, 255, 0.12) 100%)`,
          }}
        />
      </div>
    </div>
);
