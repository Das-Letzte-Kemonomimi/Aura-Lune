import React from 'react';
import {
  Radio,
  Activity,
  RefreshCw,
  Volume2,
  VolumeX,
  History,
  Layers,
  RotateCcw,
  ListMusic,
  Sliders,
  Zap,
  ShieldCheck,
  Loader2,
  Headphones,
} from 'lucide-react';
import { type Language, type Translations } from '../../i18n';
import {
  type AudioCard,
  type DspEngineType,
  type AlbumPlaybackBehavior,
} from '../../types/player';
import { type VolumeOsdPosition } from '../../components/VolumeOsd';

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

export const AudioDevicesSettingsView: React.FC<AudioDevicesSettingsViewProps> = ({
  language,
  loc,
  onOpenHealthCheck,
  onRefreshDevices,
  seekFadeEnabled,
  onToggleSeekFade,
  instantVolume,
  onToggleInstantVolume,
  volumeUnit,
  onSetVolumeUnit,
  volumeOsdPosition,
  onSetVolumeOsdPosition,
  recapOptIn,
  onToggleRecapOptIn,
  restoreSessionOnStartup,
  onToggleRestoreSessionOnStartup,
  dspAutoStartup,
  onToggleDspAutoStartup,
  dspDefaultEngine,
  onSetDefaultDspEngine,
  audioBufferMs,
  onSetAudioBuffer,
  dspBlockSize,
  onSetDspBlockSize,
  desktopNotificationsEnabled,
  onToggleDesktopNotifications,
  albumPlaybackMode,
  onSetAlbumPlaybackMode,
  replaygainMode,
  replaygainPreAmp,
  replaygainFallbackGain,
  replaygainPreventClipping,
  onSetReplayGain,
  replaygainStatus,
  replaygainScanWriteTags,
  onToggleReplaygainScanWriteTags,
  onScanLibraryReplayGain,
  isReplaygainScanning,
  crossfeedEnabled,
  crossfeedPreset,
  crossfeedFcut,
  crossfeedFeed,
  onSetCrossfeed,
  silenceTrimmingEnabled,
  silenceTrimmingThreshold,
  onSetSilenceTrimming,
  cards,
  onDisableProAudio,
  onEnableProAudio,
  onSetCardProfile,
  onSetBluetoothCodec,
}) => {
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
      <div className="glass-card" style={{ padding: '20px', marginBottom: '14px', borderRadius: '12px' }}>
        <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Volume2 size={18} color="var(--accent-cyan)" /> {language === 'pl' ? 'Regulacja Głośności, OSD i Statystyki' : 'Volume, OSD & Recap Settings'}
        </h4>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.84rem' }}>
          {/* Tryb głośności: Natychmiastowy vs Płynny */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 600, color: '#fff' }}>
                {language === 'pl' ? 'Szybkość reakcji suwaka głośności:' : 'Volume Slider Response:'}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                {instantVolume
                  ? (language === 'pl' ? 'Natychmiastowa (Direct Zero-Latency) - brak opóźnienia' : 'Instant (Zero-Latency) - immediate change')
                  : (language === 'pl' ? 'Płynna (Smooth Fade) - łagodne przejście' : 'Smooth Fade - subtle fade ramp')}
              </div>
            </div>
            <button
              onClick={onToggleInstantVolume}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '0.76rem',
                fontWeight: 700,
                background: instantVolume ? 'rgba(6, 182, 212, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                border: `1px solid ${instantVolume ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                color: instantVolume ? 'var(--accent-cyan)' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              {instantVolume ? (language === 'pl' ? '⚡ Natychmiast' : '⚡ Instant') : (language === 'pl' ? '🌊 Płynnie (Fade)' : '🌊 Smooth Fade')}
            </button>
          </div>

          {/* Jednostka wyświetlania głośności: Procenty vs Decybele */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 600, color: '#fff' }}>
                {loc.settings.volumeUnitTitle}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                {volumeUnit === 'db' ? loc.settings.volumeUnitDb : loc.settings.volumeUnitPercent}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <button
                type="button"
                onClick={() => onSetVolumeUnit('percent')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: 'none',
                  background: volumeUnit === 'percent' ? 'var(--accent-pink)' : 'transparent',
                  color: volumeUnit === 'percent' ? '#fff' : 'var(--text-muted)',
                }}
              >
                %
              </button>
              <button
                type="button"
                onClick={() => onSetVolumeUnit('db')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: 'none',
                  background: volumeUnit === 'db' ? 'var(--accent-cyan)' : 'transparent',
                  color: volumeUnit === 'db' ? '#fff' : 'var(--text-muted)',
                }}
              >
                dB
              </button>
            </div>
          </div>

          {/* Pozycja OSD głośności */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 600, color: '#fff' }}>
                {language === 'pl' ? 'Pozycja wskaźnika głośności (OSD):' : 'Volume OSD Position:'}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                {language === 'pl' ? 'Pływające przezroczyste powiadomienie przy zmianie głośności' : 'Translucent floating HUD when volume changes'}
              </div>
            </div>
            <select
              value={volumeOsdPosition}
              onChange={(e) => onSetVolumeOsdPosition(e.target.value as VolumeOsdPosition)}
              style={{
                appearance: 'none',
                WebkitAppearance: 'none',
                background: 'rgba(20, 24, 44, 0.95)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '6px 30px 6px 12px',
                color: '#fff',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23f43f5e' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 10px center',
              }}
            >
              <option value="bottom-center" style={{ background: '#121420' }}>{language === 'pl' ? 'Dół (Środek)' : 'Bottom (Center)'}</option>
              <option value="center" style={{ background: '#121420' }}>{language === 'pl' ? 'Środek ekranu' : 'Screen Center'}</option>
              <option value="top-right" style={{ background: '#121420' }}>{language === 'pl' ? 'Góra (Prawo)' : 'Top (Right)'}</option>
              <option value="top-left" style={{ background: '#121420' }}>{language === 'pl' ? 'Góra (Lewo)' : 'Top (Left)'}</option>
              <option value="bottom-right" style={{ background: '#121420' }}>{language === 'pl' ? 'Dół (Prawo)' : 'Bottom (Right)'}</option>
              <option value="bottom-left" style={{ background: '#121420' }}>{language === 'pl' ? 'Dół (Lewo)' : 'Bottom (Left)'}</option>
              <option value="off" style={{ background: '#121420' }}>{language === 'pl' ? 'Wyłączone (Off)' : 'Disabled (Off)'}</option>
            </select>
          </div>

          {/* Zgoda na Auralune Recap (Opt-In) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 600, color: '#fff' }}>
                {language === 'pl' ? 'Auralune Recap (Podsumowania Tydzień / Miesiąc / Rok):' : 'Auralune Recap (Rewind & Statistics):'}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                {language === 'pl' ? 'Lokalne zliczanie czasu słuchania i rankingów w bazie SQLite' : 'Track listening hours and top artists locally in SQLite'}
              </div>
            </div>
            <button
              onClick={onToggleRecapOptIn}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '0.76rem',
                fontWeight: 700,
                background: recapOptIn ? 'rgba(244, 63, 94, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                border: `1px solid ${recapOptIn ? 'var(--accent-pink)' : 'var(--border-subtle)'}`,
                color: recapOptIn ? 'var(--accent-pink)' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              {recapOptIn ? (language === 'pl' ? '✓ Włączone' : '✓ Enabled') : (language === 'pl' ? '○ Wyłączone' : '○ Disabled')}
            </button>
          </div>
        </div>
      </div>

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
            {language === 'pl' ? 'Domyślny silnik DSP przy uruchomieniu' : 'Default DSP Engine on Startup'}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            {language === 'pl'
              ? 'Określa który silnik jest aktywny po starcie aplikacji (domyślnie: Direct Bypass bez procesora DSP).'
              : 'Determines which DSP engine is active upon application launch (default: Direct Bypass without DSP processing).'}
          </div>
        </div>
        <select
          value={dspDefaultEngine}
          onChange={(e) => onSetDefaultDspEngine(e.target.value as DspEngineType)}
          style={{ padding: '8px 30px 8px 12px' }}
        >
          <option value="Bypass">
            {language === 'pl' ? 'Direct Bypass (Domyślny - Czysty dźwięk)' : 'Direct Bypass (Default - Pure Sound)'}
          </option>
          <option value="RubberBand">Rubber Band (Hi-Fi R3)</option>
          <option value="SoundTouch">
            {language === 'pl' ? 'SoundTouch (Szybki)' : 'SoundTouch (Fast)'}
          </option>
        </select>
      </div>

      {/* Opcja bufora wyjściowego audio (PipeWire / ALSA) */}
      <div
        className="glass-card"
        style={{
          padding: '18px 20px',
          marginBottom: '14px',
          borderRadius: '12px',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={17} color="var(--accent-cyan)" />
              {language === 'pl' ? 'Bufor wyjściowy audio (PipeWire / ALSA)' : 'Audio Output Buffer (PipeWire / ALSA)'}
              {audioBufferMs === 600 && (
                <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.2)', color: 'var(--accent-green)', fontWeight: 600 }}>
                  {language === 'pl' ? 'Domyślny' : 'Default'}
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', maxWidth: '520px', lineHeight: 1.4 }}>
              {language === 'pl'
                ? 'Długość bufora kolejki przed wyjściem audio. Domyślne 600 ms zapewnia całkowicie płynne odtwarzanie bez zacięć z dysków USB i gęstych plików FLAC. Niższe wartości zmniejszają opóźnienie suwaków.'
                : 'Queue buffer length before audio sink. Default 600 ms guarantees stutter-free playback even from USB drives and high-resolution FLAC files.'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.05rem', fontWeight: 700, color: audioBufferMs === 600 ? 'var(--accent-green)' : 'var(--accent-pink)' }}>
              {audioBufferMs} ms
            </span>
            <button
              onClick={() => onSetAudioBuffer(600)}
              disabled={audioBufferMs === 600}
              className="glass-card"
              style={{
                padding: '6px 10px',
                fontSize: '0.75rem',
                fontWeight: 600,
                opacity: audioBufferMs === 600 ? 0.4 : 1,
                cursor: audioBufferMs === 600 ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: 'var(--accent-green)',
              }}
              title={language === 'pl' ? 'Przywróć domyślny bufor (600 ms)' : 'Reset to default buffer (600 ms)'}
            >
              <RotateCcw size={12} /> {language === 'pl' ? 'Domyślny (600 ms)' : 'Default (600 ms)'}
            </button>
          </div>
        </div>

        {/* Suwak + Presety */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '8px' }}>
          <input
            type="range"
            min={50}
            max={2000}
            step={25}
            value={audioBufferMs}
            onChange={(e) => onSetAudioBuffer(Number(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--accent-pink)', cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input
              type="number"
              min={50}
              max={4000}
              value={audioBufferMs}
              onChange={(e) => onSetAudioBuffer(Number(e.target.value))}
              style={{
                width: '70px',
                padding: '6px 8px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                textAlign: 'center',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-subtle)',
                color: '#fff',
              }}
            />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>ms</span>
          </div>
        </div>

        {/* Szybkie presety bufora audio */}
        <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
          {[
            { label: '80 ms (Ultra-low)', value: 80 },
            { label: language === 'pl' ? '250 ms (Niska latencja)' : '250 ms (Low latency)', value: 250 },
            { label: language === 'pl' ? '600 ms (Domyślny / Hi-Fi)' : '600 ms (Default / Hi-Fi)', value: 600, isDefault: true },
            { label: language === 'pl' ? '1000 ms (Stabilny)' : '1000 ms (Stable)', value: 1000 },
            { label: language === 'pl' ? '2000 ms (Maksymalny bufor)' : '2000 ms (Max buffer)', value: 2000 },
          ].map((preset) => {
            const isActive = audioBufferMs === preset.value;
            return (
              <button
                key={preset.value}
                onClick={() => onSetAudioBuffer(preset.value)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: isActive ? 700 : 500,
                  background: isActive
                    ? (preset.isDefault ? 'rgba(16, 185, 129, 0.25)' : 'rgba(236, 72, 153, 0.25)')
                    : 'rgba(255, 255, 255, 0.04)',
                  border: isActive
                    ? (preset.isDefault ? '1px solid var(--accent-green)' : '1px solid var(--accent-pink)')
                    : '1px solid var(--border-subtle)',
                  color: isActive
                    ? (preset.isDefault ? 'var(--accent-green)' : 'var(--accent-pink)')
                    : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Opcja rozmiaru bloku procesora DSP (Block Size) */}
      <div
        className="glass-card"
        style={{
          padding: '18px 20px',
          marginBottom: '14px',
          borderRadius: '12px',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={17} color="var(--accent-pink)" />
              {language === 'pl' ? 'Rozmiar bloku bufora DSP (Block Size)' : 'DSP Block Buffer Size (Block Size)'}
              {dspBlockSize === 2048 && (
                <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.2)', color: 'var(--accent-green)', fontWeight: 600 }}>
                  {language === 'pl' ? 'Domyślny' : 'Default'}
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', maxWidth: '520px', lineHeight: 1.4 }}>
              {language === 'pl'
                ? 'Liczba próbek audio przetwarzana w jednym cyklu DSP (Rubber Band / SoundTouch). Mniejszy blok (512-1024) = szybsza reakcja suwaków pitch/tempo; większy blok (2048-4096) = najwyższa jakość FFT i brak zakłóceń.'
                : 'Audio sample chunk size per DSP processing cycle (Rubber Band / SoundTouch). Smaller block (512-1024) = instant pitch/tempo responsiveness; larger block (2048-4096) = optimal FFT quality and glitch resistance.'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.05rem', fontWeight: 700, color: dspBlockSize === 2048 ? 'var(--accent-green)' : 'var(--accent-cyan)' }}>
              {dspBlockSize} {language === 'pl' ? 'ramek' : 'frames'}
            </span>
            <button
              onClick={() => onSetDspBlockSize(2048)}
              disabled={dspBlockSize === 2048}
              className="glass-card"
              style={{
                padding: '6px 10px',
                fontSize: '0.75rem',
                fontWeight: 600,
                opacity: dspBlockSize === 2048 ? 0.4 : 1,
                cursor: dspBlockSize === 2048 ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: 'var(--accent-green)',
              }}
              title={language === 'pl' ? 'Przywróć domyślny rozmiar bloku (2048 ramek)' : 'Reset to default block size (2048 frames)'}
            >
              <RotateCcw size={12} /> {language === 'pl' ? 'Domyślny (2048)' : 'Default (2048)'}
            </button>
          </div>
        </div>

        {/* Szybkie presety bloku DSP */}
        <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { label: language === 'pl' ? '512 ramek (~11 ms)' : '512 frames (~11 ms)', value: 512 },
            { label: language === 'pl' ? '1024 ramek (~23 ms)' : '1024 frames (~23 ms)', value: 1024 },
            { label: language === 'pl' ? '2048 ramek (Domyślny / ~46 ms)' : '2048 frames (Default / ~46 ms)', value: 2048, isDefault: true },
            { label: language === 'pl' ? '4096 ramek (~92 ms)' : '4096 frames (~92 ms)', value: 4096 },
            { label: language === 'pl' ? '8192 ramek (~185 ms)' : '8192 frames (~185 ms)', value: 8192 },
          ].map((preset) => {
            const isActive = dspBlockSize === preset.value;
            return (
              <button
                key={preset.value}
                onClick={() => onSetDspBlockSize(preset.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '0.74rem',
                  fontWeight: isActive ? 700 : 500,
                  background: isActive
                    ? (preset.isDefault ? 'rgba(16, 185, 129, 0.25)' : 'rgba(56, 189, 248, 0.25)')
                    : 'rgba(255, 255, 255, 0.04)',
                  border: isActive
                    ? (preset.isDefault ? '1px solid var(--accent-green)' : '1px solid var(--accent-cyan)')
                    : '1px solid var(--border-subtle)',
                  color: isActive
                    ? (preset.isDefault ? 'var(--accent-green)' : 'var(--accent-cyan)')
                    : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {preset.label}
              </button>
            );
          })}

          {/* Pole ręcznego wpisania dowolnej wielkości */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              {language === 'pl' ? 'Własny:' : 'Custom:'}
            </span>
            <input
              type="number"
              min={256}
              max={16384}
              step={256}
              value={dspBlockSize}
              onChange={(e) => onSetDspBlockSize(Number(e.target.value))}
              style={{
                width: '80px',
                padding: '5px 8px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                textAlign: 'center',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-subtle)',
                color: '#fff',
              }}
            />
          </div>
        </div>
      </div>

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
            {language === 'pl' ? 'Powiadomienia OSD Linuksa (libnotify)' : 'Linux Desktop OSD Notifications'}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            {language === 'pl'
              ? 'Wyświetlaj baner na pulpicie przy zmianie utworu w tle (z okładką i tytułem)'
              : 'Show desktop banner on track change in background (with cover and title)'}
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
            ? (language === 'pl' ? 'Włączone' : 'Enabled')
            : (language === 'pl' ? 'Wyłączone' : 'Disabled')}
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
              ? (language === 'pl' ? 'Zastąp kolejkę' : 'Replace queue')
              : albumPlaybackMode === 'append'
                ? (language === 'pl' ? 'Dopisz do kolejki' : 'Append to queue')
                : (language === 'pl' ? 'Pojedynczy utwór' : 'Single track')}
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
      <div
        className="glass-card"
        style={{
          padding: '18px 20px',
          marginBottom: '14px',
          borderRadius: '12px',
          border: replaygainMode !== 'Off' ? '1px solid rgba(168, 85, 247, 0.45)' : '1px solid var(--border-subtle)',
          background: replaygainMode !== 'Off' ? 'rgba(168, 85, 247, 0.05)' : 'rgba(255, 255, 255, 0.03)',
          transition: 'all 0.2s ease',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={18} color="var(--accent-purple, #a855f7)" />
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>
              {loc.settings.replaygainTitle}
            </span>
          </div>
          {replaygainMode !== 'Off' && (
            <span
              style={{
                background: 'rgba(168, 85, 247, 0.25)',
                color: 'var(--accent-purple, #c084fc)',
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Zap size={11} /> {
                replaygainMode === 'Auto'
                  ? loc.settings.replaygainModeAuto
                  : (replaygainMode === 'Track'
                    ? loc.settings.replaygainModeTrack
                    : loc.settings.replaygainModeAlbum)
              }
            </span>
          )}
        </div>

        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
          {loc.settings.replaygainDesc}
        </div>

        {/* Tryby normalizacji: Off / Track / Album / Auto */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px', marginBottom: '16px' }}>
          {(['Off', 'Track', 'Album', 'Auto'] as const).map((m) => {
            const isActive = replaygainMode === m;
            const label =
              m === 'Off'
                ? loc.settings.replaygainModeOff
                : m === 'Track'
                  ? loc.settings.replaygainModeTrack
                  : m === 'Album'
                    ? loc.settings.replaygainModeAlbum
                    : loc.settings.replaygainModeAuto;
            return (
              <button
                key={m}
                onClick={() => onSetReplayGain(m, replaygainPreAmp, replaygainFallbackGain, replaygainPreventClipping)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: isActive ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                  border: isActive ? '1px solid var(--accent-purple, #a855f7)' : '1px solid var(--border-subtle)',
                  color: isActive ? '#fff' : 'var(--text-muted)',
                  transition: 'all 0.15s ease',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Suwaki i opcje ReplayGain */}
        <div style={{ opacity: replaygainMode === 'Off' ? 0.45 : 1, pointerEvents: replaygainMode === 'Off' ? 'none' : 'auto', transition: 'opacity 0.2s ease', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Suwak Przedwzmacniacza (Pre-Amp Gain) */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {loc.settings.replaygainPreAmp}
              </span>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>
                {replaygainPreAmp >= 0 ? `+${replaygainPreAmp.toFixed(1)}` : replaygainPreAmp.toFixed(1)} dB
              </span>
            </div>
            <input
              type="range"
              min="-6"
              max="6"
              step="0.5"
              value={replaygainPreAmp}
              onChange={(e) => onSetReplayGain(replaygainMode, parseFloat(e.target.value), replaygainFallbackGain, replaygainPreventClipping)}
              style={{ width: '100%', accentColor: 'var(--accent-purple, #a855f7)' }}
            />
          </div>

          {/* Suwak Fallback Gain */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {loc.settings.replaygainFallbackGain}
              </span>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>
                {replaygainFallbackGain >= 0 ? `+${replaygainFallbackGain.toFixed(1)}` : replaygainFallbackGain.toFixed(1)} dB
              </span>
            </div>
            <input
              type="range"
              min="-12"
              max="0"
              step="1"
              value={replaygainFallbackGain}
              onChange={(e) => onSetReplayGain(replaygainMode, replaygainPreAmp, parseFloat(e.target.value), replaygainPreventClipping)}
              style={{ width: '100%', accentColor: 'var(--accent-purple, #a855f7)' }}
            />
          </div>

          {/* Przełącznik True-Peak Limiter */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={14} color="var(--accent-green)" /> {loc.settings.replaygainPreventClipping}
            </span>
            <input
              type="checkbox"
              checked={replaygainPreventClipping}
              onChange={(e) => onSetReplayGain(replaygainMode, replaygainPreAmp, replaygainFallbackGain, e.target.checked)}
              style={{ accentColor: 'var(--accent-purple, #a855f7)', width: '18px', height: '18px', cursor: 'pointer' }}
            />
          </div>
        </div>

        {/* Status w czasie rzeczywistym i wskaźnik Peak Limiter */}
        {replaygainMode !== 'Off' && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '12px',
              padding: '8px 12px',
              background: 'rgba(0, 0, 0, 0.25)',
              borderRadius: '8px',
              fontSize: '0.75rem',
            }}
          >
            <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>{loc.settings.replaygainTargetAdjustment}:</span>
              <strong style={{ color: '#fff', fontFamily: 'monospace' }}>
                {replaygainStatus[0] >= 0 ? `+${replaygainStatus[0].toFixed(1)}` : replaygainStatus[0].toFixed(1)} dB
              </strong>
            </div>
            <div style={{ color: 'var(--accent-green)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <ShieldCheck size={13} /> {loc.settings.replaygainLimiterActive}
            </div>
          </div>
        )}

        {/* Sekcja kalkulatora / skanera głośności EBU R128 */}
        <div
          style={{
            marginTop: '16px',
            paddingTop: '14px',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.78rem',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={replaygainScanWriteTags}
                onChange={(e) => onToggleReplaygainScanWriteTags(e.target.checked)}
                style={{ accentColor: 'var(--accent-purple, #a855f7)' }}
              />
              <span>{loc.settings.scanReplayGainWriteTags}</span>
            </label>

            <button
              onClick={onScanLibraryReplayGain}
              disabled={isReplaygainScanning}
              className="glass-card"
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: isReplaygainScanning ? 'not-allowed' : 'pointer',
                background: 'rgba(168, 85, 247, 0.25)',
                border: '1px solid var(--accent-purple, #a855f7)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.15s ease',
                opacity: isReplaygainScanning ? 0.6 : 1,
              }}
            >
              {isReplaygainScanning ? <Loader2 size={14} className="spin" /> : <Activity size={14} />}
              {isReplaygainScanning ? loc.settings.scanReplayGainScanning : loc.settings.scanReplayGainLibrary}
            </button>
          </div>
        </div>
      </div>

      {/* Opcja filtra Bauer Crossfeed (bs2b) dla słuchawek */}
      <div
        className="glass-card"
        style={{
          padding: '18px 20px',
          marginBottom: '14px',
          borderRadius: '12px',
          border: crossfeedEnabled ? '1px solid rgba(99, 102, 241, 0.45)' : '1px solid var(--border-subtle)',
          background: crossfeedEnabled ? 'rgba(99, 102, 241, 0.05)' : 'rgba(255, 255, 255, 0.03)',
          transition: 'all 0.2s ease',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Headphones size={18} color="var(--accent-cyan, #06b6d4)" />
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fff' }}>
              {loc.settings.crossfeedTitle}
            </span>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={crossfeedEnabled}
              onChange={(e) => onSetCrossfeed(e.target.checked, crossfeedPreset)}
              style={{ accentColor: 'var(--accent-cyan, #06b6d4)', width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: crossfeedEnabled ? 'var(--accent-cyan, #06b6d4)' : 'var(--text-muted)' }}>
              {crossfeedEnabled ? (language === 'pl' ? 'Aktywny' : 'Active') : (language === 'pl' ? 'Wyłączony' : 'Off')}
            </span>
          </label>
        </div>

        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
          {loc.settings.crossfeedDesc}
        </div>

        {/* Wybór presetu: Default / ChuMoy / JanMeier / Custom */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginBottom: '14px', opacity: crossfeedEnabled ? 1 : 0.45, pointerEvents: crossfeedEnabled ? 'auto' : 'none' }}>
          {([
            { id: 'Default', label: loc.settings.crossfeedPresetDefault },
            { id: 'ChuMoy', label: loc.settings.crossfeedPresetChuMoy },
            { id: 'JanMeier', label: loc.settings.crossfeedPresetJanMeier },
            { id: 'Custom', label: loc.settings.crossfeedPresetCustom },
          ] as const).map((p) => {
            const isActive = crossfeedPreset === p.id;
            return (
              <button
                key={p.id}
                onClick={() => onSetCrossfeed(crossfeedEnabled, p.id)}
                style={{
                  padding: '8px 10px',
                  borderRadius: '8px',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: isActive ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                  border: isActive ? '1px solid rgba(99, 102, 241, 0.6)' : '1px solid var(--border-subtle)',
                  color: isActive ? '#fff' : 'var(--text-muted)',
                  textAlign: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Suwaki częstotliwości i feedu */}
        <div style={{ opacity: crossfeedEnabled ? 1 : 0.45, pointerEvents: crossfeedEnabled && crossfeedPreset === 'Custom' ? 'auto' : 'none', transition: 'opacity 0.2s ease', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {loc.settings.crossfeedFcut}
              </span>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>
                {crossfeedFcut} Hz
              </span>
            </div>
            <input
              type="range"
              min="300"
              max="2000"
              step="25"
              value={crossfeedFcut}
              onChange={(e) => onSetCrossfeed(crossfeedEnabled, 'Custom', parseInt(e.target.value, 10), crossfeedFeed)}
              style={{ width: '100%', accentColor: 'var(--accent-cyan, #06b6d4)' }}
            />
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {loc.settings.crossfeedFeed}
              </span>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>
                {(crossfeedFeed / 10).toFixed(1)} dB
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="150"
              step="5"
              value={crossfeedFeed}
              onChange={(e) => onSetCrossfeed(crossfeedEnabled, 'Custom', crossfeedFcut, parseInt(e.target.value, 10))}
              style={{ width: '100%', accentColor: 'var(--accent-cyan, #06b6d4)' }}
            />
          </div>
        </div>
      </div>

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
              {silenceTrimmingEnabled ? (language === 'pl' ? 'Włączone' : 'Enabled') : (language === 'pl' ? 'Wyłączone' : 'Disabled')}
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
            <span>-80 dB ({language === 'pl' ? 'Tylko absolutna cisza' : 'Pure silence only'})</span>
            <span>-50 dB ({language === 'pl' ? 'Zalecane' : 'Recommended'})</span>
            <span>-25 dB ({language === 'pl' ? 'Mocne cięcie' : 'Aggressive'})</span>
          </div>
        </div>
      </div>

      {/* Lista kart dźwiękowych */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {cards.map((card) => (
          <div key={card.name} className="glass-card" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {card.is_bluetooth ? <Headphones size={18} color="var(--accent-cyan)" /> : <Zap size={18} color="var(--accent-amber)" />}
                <span style={{ fontWeight: 600 }}>{card.description}</span>
              </div>

              {card.profiles && card.profiles.some((p) => p.is_pro_audio) && (
                <span
                  style={{
                    background: 'rgba(16, 185, 129, 0.2)',
                    color: 'var(--accent-green)',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '6px',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                  }}
                >
                  PRO AUDIO READY
                </span>
              )}
            </div>

            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '10px' }}>
              ID: {card.name} | {loc.settings.active}: {card.active_profile || 'default'}
            </p>

            {/* Akcje Pro Audio */}
            {card.profiles && card.profiles.some((p) => p.is_pro_audio) && (
              <div style={{ marginBottom: '10px' }}>
                {card.active_profile === 'pro-audio' ? (
                  <button
                    onClick={() => onDisableProAudio(card.name)}
                    style={{
                      padding: '7px 14px',
                      borderRadius: '8px',
                      background: 'rgba(244, 63, 94, 0.25)',
                      color: 'var(--accent-pink)',
                      border: '1px solid rgba(244, 63, 94, 0.5)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    ✕ Pro Audio OFF (Stereo)
                  </button>
                ) : (
                  <button
                    onClick={() => onEnableProAudio(card.name)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid var(--border-subtle)',
                      color: '#fff',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    ✓ Pro Audio ON (Bit-Perfect Direct ALSA)
                  </button>
                )}
              </div>
            )}

            {/* Lista wszystkich dostępnych profili sprzętowych karty */}
            {card.profiles && card.profiles.length > 0 && (
              <div style={{ marginBottom: '10px' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  {loc.settings.hardwareProfiles}
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {card.profiles
                    .filter((p) => p.available && !p.bluetooth_codec)
                    .map((p) => {
                      const isCurrent = card.active_profile === p.name;
                      return (
                        <button
                          key={p.name}
                          onClick={() => onSetCardProfile(card.name, p.name)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
                            background: isCurrent ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                            border: `1px solid ${isCurrent ? 'var(--accent-green)' : 'rgba(255, 255, 255, 0.08)'}`,
                            color: isCurrent ? 'var(--accent-green)' : 'var(--text-muted)',
                            fontSize: '0.7rem',
                            cursor: 'pointer',
                          }}
                          title={p.description || p.name}
                        >
                          {isCurrent ? '✓ ' : ''}{p.description || p.name}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Kodeki Bluetooth */}
            {card.is_bluetooth && card.profiles && (
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  {loc.settings.bluetoothCodecSelect}
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {card.profiles
                    .filter((p) => p.bluetooth_codec)
                    .map((p) => (
                      <button
                        key={p.name}
                        onClick={() => onSetBluetoothCodec(card.name, p.bluetooth_codec!)}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '6px',
                          background: card.active_profile === p.name ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.06)',
                          color: '#fff',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                        }}
                      >
                        {p.bluetooth_codec === 'Ldac'
                          ? 'Sony LDAC (High-Res 990 kbps)'
                          : p.bluetooth_codec === 'AptxHd'
                            ? 'aptX HD'
                            : p.bluetooth_codec === 'SbcXq'
                              ? 'SBC-XQ (High Quality)'
                              : p.bluetooth_codec}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
