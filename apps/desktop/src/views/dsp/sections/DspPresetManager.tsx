import React from 'react';
import { Save, Sparkles } from 'lucide-react';
import type { DspStudioViewProps } from '../DspStudioView';

export type DspPresetManagerProps = Pick<DspStudioViewProps, 'loc' | 'presets' | 'newPresetName' | 'setNewPresetName' | 'handleSavePreset' | 'handleApplySignatureProfile' | 'handleLoadPreset'>;

export const DspPresetManager: React.FC<DspPresetManagerProps> = ({
  handleApplySignatureProfile,
  handleLoadPreset,
  handleSavePreset,
  loc,
  newPresetName,
  presets,
  setNewPresetName,
}) => (
    <div
      style={{
        background: 'rgba(0,0,0,0.25)',
        padding: '16px',
        borderRadius: '14px',
        border: '1px solid var(--border-subtle)',
        marginBottom: '28px',
      }}
    >
      <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px', fontWeight: 600 }}>
        {loc.dsp.eqPresets}:
      </label>
      <div style={{ display: 'flex', gap: '10px', marginBottom: presets.length > 0 ? '12px' : '0' }}>
        <input
          type="text"
          placeholder={loc.dsp.presetNamePlaceholder}
          value={newPresetName}
          onChange={(e) => setNewPresetName(e.target.value)}
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid var(--border-subtle)',
            background: 'rgba(0,0,0,0.3)',
            color: '#fff',
            fontSize: '0.85rem',
          }}
        />
        <button
          onClick={handleSavePreset}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
            color: '#fff',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.8rem',
            cursor: 'pointer',
          }}
        >
          <Save size={14} /> {loc.dsp.savePreset}
        </button>
      </div>

      {/* Profile Sygnaturowe 1.0 */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-pink)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Sparkles size={14} /> Profile Sygnaturowe Auralune 1.0 (Mastering Profiles)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
          <button
            onClick={() => handleApplySignatureProfile('vocal_air')}
            className="glass-card"
            style={{
              padding: '8px 12px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.2), rgba(168, 85, 247, 0.15))',
              border: '1px solid rgba(244, 63, 94, 0.4)',
              color: '#fff',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
            }}
          >
            <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#fff' }}>🌸 Anime Vocal Air</span>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{loc.dsp.vocalPreserveDesc}</span>
          </button>

          <button
            onClick={() => handleApplySignatureProfile('lofi_tape')}
            className="glass-card"
            style={{
              padding: '8px 12px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(235, 116, 34, 0.2), rgba(168, 85, 247, 0.15))',
              border: '1px solid rgba(235, 116, 34, 0.4)',
              color: '#fff',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
            }}
          >
            <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#fff' }}>☕ Midnight Lo-Fi Tape</span>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{loc.dsp.tapeWarmthDesc}</span>
          </button>

          <button
            onClick={() => handleApplySignatureProfile('bit_perfect')}
            className="glass-card"
            style={{
              padding: '8px 12px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(6, 182, 212, 0.15))',
              border: '1px solid rgba(34, 197, 94, 0.4)',
              color: '#fff',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
            }}
          >
            <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#fff' }}>🎧 Bit-Perfect Direct</span>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{loc.dsp.bitPerfectDesc}</span>
          </button>

          <button
            onClick={() => handleApplySignatureProfile('nightcore')}
            className="glass-card"
            style={{
              padding: '8px 12px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(236, 72, 153, 0.2))',
              border: '1px solid rgba(168, 85, 247, 0.4)',
              color: '#fff',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
            }}
          >
            <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#fff' }}>⚡ Nightcore Club Anthem</span>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{loc.dsp.nightcoreProfileDesc}</span>
          </button>

          <button
            onClick={() => handleApplySignatureProfile('slowed')}
            className="glass-card"
            style={{
              padding: '8px 12px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(168, 85, 247, 0.15))',
              border: '1px solid rgba(6, 182, 212, 0.4)',
              color: '#fff',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
            }}
          >
            <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#fff' }}>🌌 Ambient Slowed & Space</span>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{loc.dsp.slowedProfileDesc}</span>
          </button>
        </div>
      </div>

      {presets.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => handleLoadPreset(p)}
              style={{
                padding: '6px 12px',
                fontSize: '0.75rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: '#fff',
                background: 'rgba(25, 28, 48, 0.7)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              <Sparkles size={12} color="var(--accent-pink)" />
              <span>{p.name}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                ({p.pitch_semitones > 0 ? `+${p.pitch_semitones}` : p.pitch_semitones}st, {p.tempo_ratio}x)
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
);
