import React from 'react';
import { CheckCircle, Flame, Headphones, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import type { DspStudioViewProps } from '../DspStudioView';

export type DspMasteringRackProps = Pick<DspStudioViewProps, 'loc' | 'handleBassBoostChange' | 'bassBoost' | 'lastBassBoostRef' | 'handleToggleStereoWidener' | 'stereoWidenerActive' | 'stereoWidenerAmount' | 'handleStereoWidenerAmountChange' | 'handleToggleLimiter' | 'limiterEnabled' | 'handleSetCrossfeed' | 'crossfeedEnabled' | 'crossfeedPreset' | 'crossfeedFcut' | 'crossfeedFeed'>;

export const DspMasteringRack: React.FC<DspMasteringRackProps> = ({
  bassBoost,
  crossfeedEnabled,
  crossfeedFcut,
  crossfeedFeed,
  crossfeedPreset,
  handleBassBoostChange,
  handleSetCrossfeed,
  handleStereoWidenerAmountChange,
  handleToggleLimiter,
  handleToggleStereoWidener,
  lastBassBoostRef,
  limiterEnabled,
  loc,
  stereoWidenerActive,
  stereoWidenerAmount,
}) => (
    <div
      style={{
        marginTop: '24px',
        padding: '20px',
        background: 'rgba(0, 0, 0, 0.3)',
        borderRadius: '16px',
        border: '1px solid var(--border-subtle)',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '20px',
      }}
    >
      {/* KARTA 1: BASS BOOST (SUB-BAS EXCITER) */}
      <div
        style={{
          padding: '16px',
          borderRadius: '12px',
          background: 'rgba(255, 77, 148, 0.05)',
          border: '1px solid rgba(255, 77, 148, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Flame size={18} color="var(--accent-pink)" />
            <div>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
                {loc.dsp.bassBoostTitle}
              </h4>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {loc.dsp.bassBoostDesc}
              </span>
            </div>
          </div>
          <button
            onClick={() => handleBassBoostChange(bassBoost > 0 ? 0 : (lastBassBoostRef?.current || 6))}
            style={{
              padding: '4px 10px',
              borderRadius: '8px',
              fontSize: '0.72rem',
              fontWeight: 700,
              background: bassBoost > 0 ? 'rgba(255, 77, 148, 0.25)' : 'rgba(255, 255, 255, 0.06)',
              border: `1px solid ${bassBoost > 0 ? 'var(--accent-pink)' : 'var(--border-subtle)'}`,
              color: bassBoost > 0 ? 'var(--accent-pink)' : 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            {bassBoost > 0 ? `● BASS +${bassBoost.toFixed(1)} dB` : '○ BYPASS'}
          </button>
        </div>

        <input
          type="range"
          min={0}
          max={12}
          step={0.5}
          value={bassBoost}
          onChange={(e) => handleBassBoostChange(Number(e.target.value))}
          style={{ width: '100%', cursor: 'pointer' }}
        />

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[0, 3, 6, 9, 12].map((db) => (
            <button
              key={db}
              onClick={() => handleBassBoostChange(db)}
              style={{
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '0.7rem',
                fontWeight: 600,
                background: bassBoost === db ? 'rgba(255, 77, 148, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                border: `1px solid ${bassBoost === db ? 'var(--accent-pink)' : 'var(--border-subtle)'}`,
                color: bassBoost === db ? 'var(--accent-pink)' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              {db === 0 ? '0 dB (Off)' : `+${db} dB`}
            </button>
          ))}
        </div>
      </div>

      {/* KARTA 2: STEREO WIDENER (BAZA STEREO) */}
      <div
        style={{
          padding: '16px',
          borderRadius: '12px',
          background: 'rgba(56, 189, 248, 0.05)',
          border: '1px solid rgba(56, 189, 248, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <SlidersHorizontal size={18} color="var(--accent-cyan)" />
            <div>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
                {loc.dsp.stereoWidenerTitle}
              </h4>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {loc.dsp.stereoWidenerDesc}
              </span>
            </div>
          </div>
          <button
            onClick={() => handleToggleStereoWidener(!stereoWidenerActive)}
            style={{
              padding: '4px 10px',
              borderRadius: '8px',
              fontSize: '0.72rem',
              fontWeight: 700,
              background: stereoWidenerActive ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.06)',
              border: `1px solid ${stereoWidenerActive ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
              color: stereoWidenerActive ? 'var(--accent-cyan)' : 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            {stereoWidenerActive ? '● WIDENER ON' : '○ BYPASS'}
          </button>
        </div>

        <div style={{ opacity: stereoWidenerActive ? 1 : 0.45 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>{loc.dsp.stereoStageWidth}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
              {Math.round(stereoWidenerAmount * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={stereoWidenerAmount}
            onChange={(e) => handleStereoWidenerAmountChange(Number(e.target.value))}
            style={{ width: '100%', cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* KARTA 3: TRUE-PEAK LIMITER */}
      <div
        style={{
          padding: '16px',
          borderRadius: '12px',
          background: 'rgba(34, 197, 94, 0.05)',
          border: '1px solid rgba(34, 197, 94, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={18} color="var(--accent-green)" />
              <div>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
                  {loc.dsp.limiterTitle}
                </h4>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {loc.dsp.limiterDesc}
                </span>
              </div>
            </div>
            <button
              onClick={() => handleToggleLimiter(!limiterEnabled)}
              style={{
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '0.72rem',
                fontWeight: 700,
                background: limiterEnabled ? 'rgba(34, 197, 94, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                border: `1px solid ${limiterEnabled ? 'var(--accent-green)' : 'var(--border-subtle)'}`,
                color: limiterEnabled ? 'var(--accent-green)' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              {limiterEnabled ? '● LIMITER ON' : '○ BYPASS'}
            </button>
          </div>
        </div>

        <div
          style={{
            padding: '8px 10px',
            borderRadius: '8px',
            background: 'rgba(0, 0, 0, 0.25)',
            fontSize: '0.75rem',
            color: limiterEnabled ? '#86efac' : 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <CheckCircle size={14} />
          <span>
            {limiterEnabled
              ? loc.dsp.limiterDesc
              : loc.dsp.limiterOffWarning}
          </span>
        </div>
      </div>

      {/* KARTA 4: BAUER HEADPHONE CROSSFEED (BS2B) */}
      <div
        style={{
          padding: '16px',
          borderRadius: '12px',
          background: 'rgba(168, 85, 247, 0.05)',
          border: '1px solid rgba(168, 85, 247, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Headphones size={18} color="var(--accent-purple, #c084fc)" />
            <div>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
                {loc.settings.crossfeedTitle}
              </h4>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {loc.settings.crossfeedDesc}
              </span>
            </div>
          </div>
          <button
            onClick={() => handleSetCrossfeed(!crossfeedEnabled, crossfeedPreset)}
            style={{
              padding: '4px 10px',
              borderRadius: '8px',
              fontSize: '0.72rem',
              fontWeight: 700,
              background: crossfeedEnabled ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255, 255, 255, 0.06)',
              border: `1px solid ${crossfeedEnabled ? 'var(--accent-purple)' : 'var(--border-subtle)'}`,
              color: crossfeedEnabled ? 'var(--accent-purple)' : 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            {crossfeedEnabled ? '● CROSSFEED ON' : '○ BYPASS'}
          </button>
        </div>

        <div style={{ opacity: crossfeedEnabled ? 1 : 0.65, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {([
              { id: 'Default', label: 'Default (700Hz/4.5dB)' },
              { id: 'ChuMoy', label: 'Chu Moy (700Hz/6dB)' },
              { id: 'JanMeier', label: 'Jan Meier (650Hz/9dB)' },
              { id: 'Custom', label: loc.settings.crossfeedPresetCustom },
            ] as const).map((p) => {
              const isActive = crossfeedPreset === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => handleSetCrossfeed(true, p.id)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    background: isActive && crossfeedEnabled ? 'rgba(168, 85, 247, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${isActive && crossfeedEnabled ? 'var(--accent-purple)' : 'var(--border-subtle)'}`,
                    color: isActive && crossfeedEnabled ? 'var(--accent-purple)' : 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {crossfeedPreset === 'Custom' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '2px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{loc.settings.crossfeedFcut}:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{crossfeedFcut} Hz</span>
                </div>
                <input
                  type="range"
                  min="300"
                  max="2000"
                  step="25"
                  value={crossfeedFcut}
                  onChange={(e) => handleSetCrossfeed(true, 'Custom', parseInt(e.target.value, 10), crossfeedFeed)}
                  style={{ width: '100%', cursor: 'pointer' }}
                />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '2px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{loc.settings.crossfeedFeed}:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{(crossfeedFeed / 10).toFixed(1)} dB</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="150"
                  step="5"
                  value={crossfeedFeed}
                  onChange={(e) => handleSetCrossfeed(true, 'Custom', crossfeedFcut, parseInt(e.target.value, 10))}
                  style={{ width: '100%', cursor: 'pointer' }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
);
