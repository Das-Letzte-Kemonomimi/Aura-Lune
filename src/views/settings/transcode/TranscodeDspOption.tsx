import React from 'react';
import type { TranscodeSettingsViewProps } from '../TranscodeSettingsView';

export type TranscodeDspOptionProps = Pick<TranscodeSettingsViewProps, 'transcodeApplyDsp' | 'onTranscodeApplyDspChange' | 'loc' | 'status' | 'reverbEnabled' | 'reverbLevel'>;

export const TranscodeDspOption: React.FC<TranscodeDspOptionProps> = ({
  loc,
  onTranscodeApplyDspChange,
  reverbEnabled,
  reverbLevel,
  status,
  transcodeApplyDsp,
}) => (
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
);
