import React from 'react';
import { Activity, Sliders, Zap, ShieldCheck, Loader2 } from 'lucide-react';
import type { AudioDevicesSettingsViewProps } from '../AudioDevicesSettingsView';

export type ReplayGainOptionProps = Pick<AudioDevicesSettingsViewProps, 'replaygainMode' | 'loc' | 'onSetReplayGain' | 'replaygainPreAmp' | 'replaygainFallbackGain' | 'replaygainPreventClipping' | 'replaygainStatus' | 'replaygainScanWriteTags' | 'onToggleReplaygainScanWriteTags' | 'onScanLibraryReplayGain' | 'isReplaygainScanning'>;

export const ReplayGainOption: React.FC<ReplayGainOptionProps> = ({
  isReplaygainScanning,
  loc,
  onScanLibraryReplayGain,
  onSetReplayGain,
  onToggleReplaygainScanWriteTags,
  replaygainFallbackGain,
  replaygainMode,
  replaygainPreAmp,
  replaygainPreventClipping,
  replaygainScanWriteTags,
  replaygainStatus,
}) => (
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
);
