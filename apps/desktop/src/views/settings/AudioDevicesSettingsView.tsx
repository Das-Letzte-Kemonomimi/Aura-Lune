import React from 'react';
import {
  Radio,
  Activity,
  RefreshCw,
  VolumeX,
  History,
  ListMusic,
} from 'lucide-react';
import { type Language, type Translations } from '../../i18n';
import {
  type AudioCard,
  type DspEngineType,
  type AlbumPlaybackBehavior,
} from '../../types/player';
import { type VolumeOsdPosition } from '../../components/player/VolumeOsd';
import { SoundCardList } from './audio/SoundCardList';
import { CrossfeedOption } from './audio/CrossfeedOption';
import { ReplayGainOption } from './audio/ReplayGainOption';
import { DspBlockSizeOption } from './audio/DspBlockSizeOption';
import { OutputBufferOption } from './audio/OutputBufferOption';
import { VolumeAndOsdCard } from './audio/VolumeAndOsdCard';
import type { VolumeDbStep } from '../../utils/volumeScale';

export interface AudioDevicesSettingsViewProps {
  language: Language;
  loc: Translations;
  onOpenHealthCheck: () => void;
  onRefreshDevices: () => void;
  seekFadeEnabled: boolean;
  onToggleSeekFade: () => void;
  instantVolume: boolean;
  onToggleInstantVolume: () => void;
  volumeUnit: 'percent' | 'db';
  onSetVolumeUnit: (unit: 'percent' | 'db') => void;
  volumeDbStep: VolumeDbStep;
  onSetVolumeDbStep: (step: VolumeDbStep) => void;
  volumeOsdPosition: VolumeOsdPosition;
  onSetVolumeOsdPosition: (pos: VolumeOsdPosition) => void;
  recapOptIn: boolean;
  onToggleRecapOptIn: () => void;
  restoreSessionOnStartup: boolean;
  onToggleRestoreSessionOnStartup: () => void;
  dspAutoStartup: boolean;
  onToggleDspAutoStartup: () => void;
  dspDefaultEngine: DspEngineType;
  onSetDefaultDspEngine: (engine: DspEngineType) => void;
  audioBufferMs: number;
  onSetAudioBuffer: (ms: number) => void;
  dspBlockSize: number;
  onSetDspBlockSize: (frames: number) => void;
  desktopNotificationsEnabled: boolean;
  onToggleDesktopNotifications: () => void;
  albumPlaybackMode: AlbumPlaybackBehavior;
  onSetAlbumPlaybackMode: (mode: AlbumPlaybackBehavior) => void;
  replaygainMode: 'Off' | 'Track' | 'Album' | 'Auto';
  replaygainPreAmp: number;
  replaygainFallbackGain: number;
  replaygainPreventClipping: boolean;
  onSetReplayGain: (
    mode: 'Off' | 'Track' | 'Album' | 'Auto',
    preAmp: number,
    fallback: number,
    preventClipping: boolean
  ) => void;
  replaygainStatus: [number, number, boolean];
  replaygainScanWriteTags: boolean;
  onToggleReplaygainScanWriteTags: (enabled: boolean) => void;
  onScanLibraryReplayGain: () => void;
  isReplaygainScanning: boolean;
  crossfeedEnabled: boolean;
  crossfeedPreset: 'Default' | 'ChuMoy' | 'JanMeier' | 'Custom';
  crossfeedFcut: number;
  crossfeedFeed: number;
  onSetCrossfeed: (
    enabled: boolean,
    preset: 'Default' | 'ChuMoy' | 'JanMeier' | 'Custom',
    fcut?: number,
    feed?: number
  ) => void;
  silenceTrimmingEnabled: boolean;
  silenceTrimmingThreshold: number;
  onSetSilenceTrimming: (enabled: boolean, threshold: number) => void;
  cards: AudioCard[];
  onDisableProAudio: (cardName: string) => void;
  onEnableProAudio: (cardName: string) => void;
  onSetCardProfile: (cardName: string, profileName: string) => void;
  onSetBluetoothCodec: (cardName: string, codec: string) => void;
}

export const AudioDevicesSettingsView: React.FC<AudioDevicesSettingsViewProps> = (props) => {
  const {
    language: _language,
    loc,
    onOpenHealthCheck,
    onRefreshDevices,
    seekFadeEnabled,
    onToggleSeekFade,
    restoreSessionOnStartup,
    onToggleRestoreSessionOnStartup,
    dspAutoStartup,
    onToggleDspAutoStartup,
    dspDefaultEngine,
    onSetDefaultDspEngine,
    desktopNotificationsEnabled,
    onToggleDesktopNotifications,
    albumPlaybackMode,
    onSetAlbumPlaybackMode,
    silenceTrimmingEnabled,
    silenceTrimmingThreshold,
    onSetSilenceTrimming,
  } = props;
  return (
    <div className="glass-panel" style={{ padding: '28px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Radio size={20} color="var(--accent-green)" /> {loc.settings.audioDevices}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={onOpenHealthCheck}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              background: 'rgba(34, 197, 94, 0.2)',
              border: '1px solid rgba(34, 197, 94, 0.4)',
              color: '#4ade80',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Activity size={14} />
            Test Toru Audio (Health Check)
          </button>
          <button
            onClick={onRefreshDevices}
            className="glass-card"
            style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px', color: '#fff', fontSize: '0.8rem' }}
          >
            <RefreshCw size={14} /> {loc.library.refresh}
          </button>
        </div>
      </div>

      {/* Opcja płynnego wyciszenia paska postępu (Seek Fade) */}
      <div
        className="glass-card"
        style={{
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '14px',
          borderRadius: '12px',
          border: seekFadeEnabled ? '1px solid rgba(236, 72, 153, 0.4)' : '1px solid var(--border-subtle)',
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff', marginBottom: '4px' }}>
            {loc.player.seekFadeTitle}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            {loc.player.seekFadeDesc}
          </div>
        </div>
        <button
          onClick={onToggleSeekFade}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '0.8rem',
            fontWeight: 700,
            cursor: 'pointer',
            background: seekFadeEnabled ? 'rgba(236, 72, 153, 0.25)' : 'rgba(255, 255, 255, 0.06)',
            border: seekFadeEnabled ? '1px solid var(--accent-pink)' : '1px solid var(--border-subtle)',
            color: seekFadeEnabled ? 'var(--accent-pink)' : 'var(--text-muted)',
            transition: 'all 0.15s ease',
          }}
        >
          {seekFadeEnabled ? loc.player.seekFadeOn : loc.player.seekFadeOff}
        </button>
      </div>

      {/* Karta Konfiguracji Głośności, OSD i Statystyk Recap */}
      <VolumeAndOsdCard {...props} />

      {/* Opcja zapamiętywania sesji odtwarzania przy ponownym uruchomieniu */}
      <div
        className="glass-card"
        style={{
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '14px',
          borderRadius: '12px',
          border: restoreSessionOnStartup ? '1px solid rgba(168, 85, 247, 0.45)' : '1px solid var(--border-subtle)',
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={16} color="var(--accent-purple)" />
            {loc.settings.restoreSessionTitle}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            {loc.settings.restoreSessionDesc}
          </div>
        </div>
        <button
          onClick={onToggleRestoreSessionOnStartup}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '0.8rem',
            fontWeight: 700,
            cursor: 'pointer',
            background: restoreSessionOnStartup ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255, 255, 255, 0.06)',
            border: restoreSessionOnStartup ? '1px solid var(--accent-purple)' : '1px solid var(--border-subtle)',
            color: restoreSessionOnStartup ? 'var(--accent-purple)' : 'var(--text-muted)',
            transition: 'all 0.15s ease',
          }}
        >
          {restoreSessionOnStartup ? loc.settings.restoreSessionOn : loc.settings.restoreSessionOff}
        </button>
      </div>

      {/* Opcja zapamiętywania ustawień DSP przy uruchomieniu aplikacji */}
      <div
        className="glass-card"
        style={{
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '14px',
          borderRadius: '12px',
          border: dspAutoStartup ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-subtle)',
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff', marginBottom: '4px' }}>
            {loc.dsp.dspAutostart}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            {loc.dsp.bypassActiveNotice}
          </div>
        </div>
        <button
          onClick={onToggleDspAutoStartup}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '0.8rem',
            fontWeight: 700,
            cursor: 'pointer',
            background: dspAutoStartup ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.06)',
            border: dspAutoStartup ? '1px solid var(--accent-green)' : '1px solid var(--border-subtle)',
            color: dspAutoStartup ? 'var(--accent-green)' : 'var(--text-muted)',
            transition: 'all 0.15s ease',
          }}
        >
          {dspAutoStartup ? loc.dsp.dspAutostartOn : loc.dsp.dspAutostartOff}
        </button>
      </div>

      {/* Opcja wyboru domyślnego silnika DSP przy uruchomieniu */}
      <div
        className="glass-card"
        style={{
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '14px',
          borderRadius: '12px',
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff', marginBottom: '4px' }}>
            {loc.settings.dspStartupTitle}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            {loc.settings.dspStartupDesc}
          </div>
        </div>
        <select
          value={dspDefaultEngine}
          onChange={(e) => onSetDefaultDspEngine(e.target.value as DspEngineType)}
          style={{ padding: '8px 30px 8px 12px' }}
        >
          <option value="Bypass">
            {loc.settings.dspEngineDirectBypass}
          </option>
          <option value="RubberBand">Rubber Band (Hi-Fi R3)</option>
          <option value="SoundTouch">
            {loc.settings.dspEngineSoundTouch}
          </option>
        </select>
      </div>

      {/* Opcja bufora wyjściowego audio (PipeWire / ALSA) */}
      <OutputBufferOption {...props} />

      {/* Opcja rozmiaru bloku procesora DSP (Block Size) */}
      <DspBlockSizeOption {...props} />

      {/* Opcja powiadomień OSD Linuksa (libnotify / D-Bus) */}
      <div
        className="glass-card"
        style={{
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '14px',
          borderRadius: '12px',
          border: desktopNotificationsEnabled ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid var(--border-subtle)',
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff', marginBottom: '4px' }}>
            {loc.settings.desktopNotificationsTitle}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            {loc.settings.desktopNotificationsDesc}
          </div>
        </div>
        <button
          onClick={onToggleDesktopNotifications}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '0.8rem',
            fontWeight: 700,
            cursor: 'pointer',
            background: desktopNotificationsEnabled ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255, 255, 255, 0.06)',
            border: desktopNotificationsEnabled ? '1px solid #3b82f6' : '1px solid var(--border-subtle)',
            color: desktopNotificationsEnabled ? '#60a5fa' : 'var(--text-muted)',
            transition: 'all 0.15s ease',
          }}
        >
          {desktopNotificationsEnabled
            ? loc.settings.desktopNotificationsEnabled
            : loc.settings.desktopNotificationsDisabled}
        </button>
      </div>

      {/* Opcja zachowania odtwarzania albumów i playlist (Autoplay & Kolejka) */}
      <div
        className="glass-card"
        style={{
          padding: '18px 20px',
          marginBottom: '14px',
          borderRadius: '12px',
          border: '1px solid var(--border-subtle)',
          background: 'rgba(255, 255, 255, 0.03)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ListMusic size={18} color="var(--accent-pink, #ec4899)" />
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>
              {loc.settings.albumPlaybackTitle}
            </span>
          </div>
          <span
            style={{
              background: 'rgba(236, 72, 153, 0.2)',
              color: 'var(--accent-pink)',
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: '6px',
            }}
          >
            {albumPlaybackMode === 'replace'
              ? loc.settings.albumModeReplace
              : albumPlaybackMode === 'append'
                ? loc.settings.albumModeAppend
                : loc.settings.albumModeSingle}
          </span>
        </div>

        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
          {loc.settings.albumPlaybackDesc}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
          {[
            { id: 'replace', label: loc.settings.albumPlaybackReplace },
            { id: 'append', label: loc.settings.albumPlaybackAppend },
            { id: 'single', label: loc.settings.albumPlaybackSingle },
          ].map((item) => {
            const isActive = albumPlaybackMode === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSetAlbumPlaybackMode(item.id as AlbumPlaybackBehavior)}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  textAlign: 'left',
                  cursor: 'pointer',
                  background: isActive ? 'rgba(236, 72, 153, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                  border: isActive ? '1px solid var(--accent-pink)' : '1px solid var(--border-subtle)',
                  color: isActive ? '#fff' : 'var(--text-muted)',
                  transition: 'all 0.15s ease',
                }}
              >
                {isActive ? '✓ ' : ''}{item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Opcja normalizacji głośności ReplayGain 2.0 / EBU R128 */}
      <ReplayGainOption {...props} />

      {/* Opcja filtra Bauer Crossfeed (bs2b) dla słuchawek */}
      <CrossfeedOption {...props} />

      {/* Opcja automatycznego pomijania ciszy (Silence Trimming) */}
      <div
        className="glass-card"
        style={{
          padding: '18px 20px',
          marginBottom: '14px',
          borderRadius: '12px',
          border: silenceTrimmingEnabled ? '1px solid rgba(16, 185, 129, 0.45)' : '1px solid var(--border-subtle)',
          background: silenceTrimmingEnabled ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255, 255, 255, 0.03)',
          transition: 'all 0.2s ease',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <VolumeX size={18} color="var(--accent-emerald, #10b981)" />
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>
              {loc.settings.silenceTrimmingTitle}
            </span>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={silenceTrimmingEnabled}
              onChange={(e) => onSetSilenceTrimming(e.target.checked, silenceTrimmingThreshold)}
              style={{ accentColor: 'var(--accent-emerald, #10b981)', width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: silenceTrimmingEnabled ? 'var(--accent-emerald, #10b981)' : 'var(--text-muted)' }}>
              {silenceTrimmingEnabled ? loc.settings.desktopNotificationsEnabled : loc.settings.desktopNotificationsDisabled}
            </span>
          </label>
        </div>

        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
          {loc.settings.silenceTrimmingDesc}
        </div>

        <div style={{ opacity: silenceTrimmingEnabled ? 1 : 0.45, pointerEvents: silenceTrimmingEnabled ? 'auto' : 'none', transition: 'opacity 0.2s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {loc.settings.silenceTrimmingThreshold}
            </span>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>
              {silenceTrimmingThreshold.toFixed(1)} dBFS
            </span>
          </div>
          <input
            type="range"
            min="-80"
            max="-25"
            step="2.5"
            value={silenceTrimmingThreshold}
            onChange={(e) => onSetSilenceTrimming(silenceTrimmingEnabled, parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent-emerald, #10b981)' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            <span>-80 dB ({loc.settings.silenceTrimmingPure})</span>
            <span>-50 dB ({loc.settings.silenceTrimmingRecommended})</span>
            <span>-25 dB ({loc.settings.silenceTrimmingAggressive})</span>
          </div>
        </div>
      </div>

      {/* Lista kart dźwiękowych */}
      <SoundCardList {...props} />
    </div>
  );
};
