import React from 'react';
import { CassetteTape, Disc, Disc3, Gauge, Sparkles, Upload } from 'lucide-react';
import { TapeDeckWidget } from '../../../components/player/TapeDeckWidget';
import { VinylTurntable } from '../../../components/player/VinylTurntable';
import { VuMeterWidget } from '../../../components/player/VuMeterWidget';
import type { PlaybackStatus } from '../../../types/player';
import type { PlayerViewProps } from '../PlayerView';
import { fmt } from '../../../utils/fmt';

export type PlayerVisualColumnProps = Pick<PlayerViewProps, 'nowPlayingVisualMode' | 'handleSelectNowPlayingVisualMode' | 'loc' | 'language' | 'currentCover' | 'currentPlayingTrack' | 'tracks' | 'handlePlayPause' | 'vinylRpm' | 'handleSelectVinylRpm' | 'setIsLoFiModalOpen' | 'tapeType' | 'handleSelectTapeType' | 'tapeSpeed' | 'handleSelectTapeSpeed' | 'currentAlbum' | 'handleOpenCoverPicker' | 'albums' | 'handleUploadCustomCoverDirect' | 'dspBadgeTitle' | 'dspBadgeText'> & {
  status: PlaybackStatus;
};

export const PlayerVisualColumn: React.FC<PlayerVisualColumnProps> = ({
  albums,
  currentAlbum,
  currentCover,
  currentPlayingTrack,
  dspBadgeText,
  dspBadgeTitle,
  handleOpenCoverPicker,
  handlePlayPause,
  handleSelectNowPlayingVisualMode,
  handleSelectTapeSpeed,
  handleSelectTapeType,
  handleSelectVinylRpm,
  handleUploadCustomCoverDirect,
  language,
  loc,
  nowPlayingVisualMode,
  setIsLoFiModalOpen,
  status,
  tapeSpeed,
  tapeType,
  tracks,
  vinylRpm,
}) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      {/* Selektor trybu wizualnego: Okładka • Winyl Hi-Fi • Taśma • Wskaźnik VU */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '10px',
          background: 'rgba(0, 0, 0, 0.35)',
          padding: '3px',
          borderRadius: '8px',
          width: '100%',
          maxWidth: nowPlayingVisualMode === 'cover' ? '240px' : '275px',
          transition: 'max-width 0.2s ease',
        }}
      >
        <button
          onClick={() => handleSelectNowPlayingVisualMode('cover')}
          style={{
            flex: 1,
            padding: '4px 6px',
            borderRadius: '6px',
            border: 'none',
            background: nowPlayingVisualMode === 'cover' ? 'var(--accent-pink)' : 'transparent',
            color: nowPlayingVisualMode === 'cover' ? '#fff' : 'var(--text-muted)',
            fontSize: '0.72rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
          }}
        >
          <Disc size={13} /> {loc.player.displayCover}
        </button>
        <button
          onClick={() => handleSelectNowPlayingVisualMode('turntable')}
          style={{
            flex: 1,
            padding: '4px 6px',
            borderRadius: '6px',
            border: 'none',
            background: nowPlayingVisualMode === 'turntable' ? 'var(--accent-pink)' : 'transparent',
            color: nowPlayingVisualMode === 'turntable' ? '#fff' : 'var(--text-muted)',
            fontSize: '0.72rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
          }}
        >
          <Disc3 size={13} /> {loc.player.displayVinyl}
        </button>
        <button
          onClick={() => handleSelectNowPlayingVisualMode('tape')}
          style={{
            flex: 1,
            padding: '4px 6px',
            borderRadius: '6px',
            border: 'none',
            background: nowPlayingVisualMode === 'tape' ? 'var(--accent-pink)' : 'transparent',
            color: nowPlayingVisualMode === 'tape' ? '#fff' : 'var(--text-muted)',
            fontSize: '0.72rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
          }}
        >
          <CassetteTape size={13} /> {loc.player.displayTape}
        </button>
        <button
          onClick={() => handleSelectNowPlayingVisualMode('vumeter')}
          style={{
            flex: 1,
            padding: '4px 6px',
            borderRadius: '6px',
            border: 'none',
            background: nowPlayingVisualMode === 'vumeter' ? 'var(--accent-pink)' : 'transparent',
            color: nowPlayingVisualMode === 'vumeter' ? '#fff' : 'var(--text-muted)',
            fontSize: '0.72rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
          }}
        >
          <Gauge size={13} /> VU
        </button>
      </div>

      {nowPlayingVisualMode === 'turntable' ? (
        <VinylTurntable
          currentLang={language}
          coverUrl={currentCover}
          isPlaying={status.state === 'Playing'}
          tempo={status.tempo_ratio ?? 1.0}
          rate={status.rate_ratio ?? 1.0}
          engine={status.engine}
          isDspActive={status.engine !== 'Bypass'}
          bpm={
            currentPlayingTrack?.bpm ||
            tracks.find(
              (t) =>
                (status.current_track?.track_id && t.id === status.current_track.track_id) ||
                t.path === status.current_track?.uri
            )?.bpm ||
            null
          }
          trackTitle={status.current_track?.title || currentPlayingTrack?.title}
          artistName={status.current_track?.artist || currentPlayingTrack?.artist}
          onTogglePlayPause={handlePlayPause}
          rpm={vinylRpm}
          onRpmChange={handleSelectVinylRpm}
          onOpenLoFi={() => setIsLoFiModalOpen(true)}
          size={265}
        />
      ) : nowPlayingVisualMode === 'tape' ? (
        <TapeDeckWidget
          currentLang={language}
          isPlaying={status.state === 'Playing'}
          positionMs={status.position_ms ?? 0}
          durationMs={status.current_track?.duration_ms ?? 180000}
          tempo={status.tempo_ratio ?? 1.0}
          rate={status.rate_ratio ?? 1.0}
          engine={status.engine}
          isDspActive={status.engine !== 'Bypass'}
          trackTitle={status.current_track?.title || currentPlayingTrack?.title}
          artistName={status.current_track?.artist || currentPlayingTrack?.artist}
          tapeType={tapeType}
          onTapeTypeChange={handleSelectTapeType}
          tapeSpeed={tapeSpeed}
          onTapeSpeedChange={handleSelectTapeSpeed}
          onOpenLoFi={() => setIsLoFiModalOpen(true)}
          size={265}
        />
      ) : nowPlayingVisualMode === 'vumeter' ? (
        <VuMeterWidget
          spectrum={status.spectrum}
          volume={status.volume}
          isPlaying={status.state === 'Playing'}
          style={{ width: '100%', height: '175px' }}
        />
      ) : (
        <div
          style={{
            width: '220px',
            height: '220px',
            borderRadius: '20px',
            position: 'relative',
            overflow: 'hidden',
            background: currentCover
              ? `url("${currentCover}") center/cover no-repeat`
              : 'radial-gradient(circle at center, #1e1b4b 0%, #0f172a 60%, #030712 100%)',
            boxShadow: status.state === 'Playing'
              ? '0 0 28px rgba(244, 63, 94, 0.45), 0 0 50px rgba(168, 85, 247, 0.3)'
              : 'var(--shadow-card)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'box-shadow 0.3s ease',
            willChange: 'transform',
            transform: 'translateZ(0)',
          }}
        >
          {!currentCover && (
            <div
              style={{
                width: '188px',
                height: '188px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, #0b0f19 35%, #182032 50%, #0f172a 75%, #050811 100%)',
                border: '2px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'inset 0 0 18px rgba(0,0,0,0.85), 0 0 10px rgba(0,0,0,0.5)',
                animation: status.state === 'Playing' ? 'spin 12s linear infinite' : 'none',
              }}
            >
              {/* Centrum winylu z logo Kitsune */}
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '3px solid rgba(0,0,0,0.6)',
                  boxShadow: '0 0 10px rgba(244, 63, 94, 0.5)',
                }}
              >
                <Disc size={28} color="#fff" />
              </div>
            </div>
          )}

          {/* Badge formatu na okładce */}
          <div
            style={{
              position: 'absolute',
              bottom: '10px',
              right: '10px',
              padding: '3px 8px',
              borderRadius: '6px',
              background: 'rgba(0, 0, 0, 0.88)',
              fontSize: '0.68rem',
              fontWeight: 700,
              color: 'var(--accent-cyan)',
              border: '1px solid rgba(6, 182, 212, 0.35)',
              letterSpacing: '0.04em',
            }}
          >
            {status.current_track?.duration_ms ? 'HI-RES AUDIO' : 'PIPEWIRE'}
          </div>
        </div>
      )}

      {/* Przyciski lub kontrolki pod elementem wizualnym w zależności od trybu */}
      {nowPlayingVisualMode === 'cover' ? (
        <div style={{ marginTop: '10px', display: 'flex', gap: '8px', width: '100%', maxWidth: '240px' }}>
          <button
            onClick={() => {
              if (currentAlbum) {
                handleOpenCoverPicker(currentAlbum);
              } else {
                const trackAlbum = currentPlayingTrack?.album_id
                  ? albums.find((a) => a.id === currentPlayingTrack.album_id)?.title
                  : null;
                const targetTitle =
                  status.current_track?.album ||
                  trackAlbum ||
                  status.current_track?.title ||
                  currentPlayingTrack?.title ||
                  'Unknown Album';
                const targetArtist =
                  status.current_track?.artist ||
                  currentPlayingTrack?.artist ||
                  'Unknown Artist';
                handleOpenCoverPicker({
                  id: 0,
                  title: targetTitle,
                  album_artist: targetArtist,
                  year: null,
                  cover_path: null,
                  release_mbid: null,
                });
              }
            }}
            title={loc.covers.matchCoverTitle}
            style={{
              flex: 1,
              padding: '7px 8px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.2), rgba(168, 85, 247, 0.2))',
              border: '1px solid rgba(244, 63, 94, 0.35)',
              color: '#fff',
              fontSize: '0.73rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
              transition: 'all 0.2s',
            }}
          >
            <Sparkles size={12} color="var(--accent-pink)" /> {loc.covers.matchCover}
          </button>
          <button
            onClick={() => handleUploadCustomCoverDirect(currentAlbum)}
            title={loc.covers.uploadCustomCover}
            style={{
              flex: 1,
              padding: '7px 8px',
              borderRadius: '8px',
              background: 'rgba(6, 182, 212, 0.15)',
              border: '1px solid rgba(6, 182, 212, 0.35)',
              color: '#fff',
              fontSize: '0.73rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
              transition: 'all 0.2s',
            }}
          >
            <Upload size={12} color="var(--accent-cyan)" /> {loc.covers.uploadCustomCover}
          </button>
        </div>
      ) : nowPlayingVisualMode === 'turntable' ? (
        <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'center', width: '100%' }}>
          <div
            title={dspBadgeTitle}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-muted)',
              fontSize: '0.68rem',
              fontFamily: 'var(--font-mono)',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              flexWrap: 'wrap',
              justifyContent: 'center',
              textAlign: 'center',
            }}
          >
            <Disc3 size={11} color="var(--accent-pink)" />
            {status.state === 'Playing'
              ? `${fmt(loc.player.vinylPlayingStatus, vinylRpm === 33 ? '33⅓' : '45')} (${dspBadgeText})`
              : fmt(loc.player.vinylPausedStatus, vinylRpm === 33 ? '33⅓' : '45')}
          </div>
        </div>
      ) : nowPlayingVisualMode === 'tape' ? (
        <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'center', width: '100%' }}>
          <div
            title={dspBadgeTitle}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-muted)',
              fontSize: '0.68rem',
              fontFamily: 'var(--font-mono)',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              flexWrap: 'wrap',
              justifyContent: 'center',
              textAlign: 'center',
            }}
          >
            <CassetteTape size={11} color="var(--accent-pink)" />
            {status.state === 'Playing'
              ? `${fmt(loc.player.tapePlayingStatus, tapeSpeed === '7.5' ? '7½' : '3¾', tapeType === 'TYPE_I' ? 'FE-I' : tapeType === 'TYPE_II' ? 'CR-II' : 'METAL')} (${dspBadgeText})`
              : fmt(loc.player.tapePausedStatus, tapeSpeed === '7.5' ? '7½' : '3¾', tapeType === 'TYPE_I' ? 'FE-I' : tapeType === 'TYPE_II' ? 'CR-II' : 'METAL')}
          </div>
        </div>
      ) : (
        <div
          style={{
            marginTop: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            maxWidth: '280px',
            padding: '0 4px',
          }}
        >
          <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            0 VU = +4 dBu (1.23V)
          </span>
          <span
            style={{
              fontSize: '0.66rem',
              color: status.state === 'Playing' ? 'var(--accent-green)' : 'var(--text-muted)',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span
              style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                background: status.state === 'Playing' ? 'var(--accent-green)' : 'var(--text-muted)',
                boxShadow: status.state === 'Playing' ? '0 0 6px var(--accent-green)' : 'none',
              }}
            />
            {status.state === 'Playing' ? loc.player.meterActive : loc.player.meterStandby}
          </span>
        </div>
      )}
    </div>
);
