import React from 'react';
import type { Translations } from '../../../i18n';
import { RotateCcw, Music, Piano } from 'lucide-react';
import type { StemChannel } from '../../../types/analysis';
import { sliderToDb } from '../../../types/analysis';
import type { StemProjectStudioModalProps } from '../StemProjectStudioModal';
import type { Dispatch, SetStateAction } from 'react';

export type StemStudioWorkspaceProps = Pick<StemProjectStudioModalProps, 'onOpenChords' | 'onOpenPianoRoll'> & {
  channels: StemChannel[];
  anySoloActive: boolean;
  setHoveredChannelId: Dispatch<SetStateAction<string | null>>;
  hoveredChannelId: string | null;
  handleToggleSolo: (channelId: string) => void;
  t: Translations;
  handleToggleMute: (channelId: string) => void;
  handlePanChange: (channelId: string, newPan: number) => void;
  handleVolumeChange: (channelId: string, newVolume: number) => void;
  masterVolume: number;
  setMasterVolume: Dispatch<SetStateAction<number>>;
  applyMixToEngine: (updatedChannels: StemChannel[], masterVol: number) => Promise<void>;
  handleResetAllToUnity: () => void;
  handleApplyPreset: (presetType: string) => void;
};

export const StemStudioWorkspace: React.FC<StemStudioWorkspaceProps> = ({
  anySoloActive,
  applyMixToEngine,
  channels,
  handleApplyPreset,
  handlePanChange,
  handleResetAllToUnity,
  handleToggleMute,
  handleToggleSolo,
  handleVolumeChange,
  hoveredChannelId,
  masterVolume,
  onOpenChords,
  onOpenPianoRoll,
  setHoveredChannelId,
  setMasterVolume,
  t,
}) => (
    <div style={{ flex: 1, display: 'flex', gap: '14px', minHeight: 0 }}>
      {/* Kontener suwaków kanałów (z przewijaniem poziomym) */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          gap: '12px',
          overflowX: 'auto',
          paddingBottom: '8px',
          minHeight: 0,
        }}
      >
        {channels.map((ch) => {
          const isMuted = ch.mute || (anySoloActive && !ch.solo);
          const dbVal = sliderToDb(ch.volume);

          return (
            <div
              key={ch.id}
              onMouseEnter={() => setHoveredChannelId(ch.id)}
              onMouseLeave={() => setHoveredChannelId(null)}
              style={{
                width: '130px',
                minWidth: '130px',
                background: 'rgba(15, 23, 42, 0.65)',
                borderRadius: '16px',
                border:
                  hoveredChannelId === ch.id
                    ? `1px solid ${ch.color_hex}`
                    : '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                padding: '12px 10px',
                boxShadow:
                  hoveredChannelId === ch.id
                    ? `0 0 15px ${ch.color_hex}33`
                    : '0 4px 12px rgba(0,0,0,0.3)',
                transition: 'border 0.2s ease, box-shadow 0.2s ease',
              }}
            >
              {/* Nagłówek kanału */}
              <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: ch.color_hex,
                    margin: '0 auto 4px auto',
                    boxShadow: `0 0 8px ${ch.color_hex}`,
                  }}
                />
                <span
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: isMuted ? '#64748b' : '#f8fafc',
                    display: 'block',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={ch.name}
                >
                  {ch.name}
                </span>
                <span
                  style={{
                    fontSize: '0.65rem',
                    color: '#94a3b8',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                  }}
                >
                  {ch.quality_tier}
                </span>
              </div>

              {/* Przyciski Solo i Mute */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                <button
                  onClick={() => handleToggleSolo(ch.id)}
                  style={{
                    flex: 1,
                    padding: '4px 0',
                    borderRadius: '6px',
                    border: ch.solo ? '1px solid #facc15' : '1px solid rgba(255,255,255,0.1)',
                    background: ch.solo ? '#facc15' : 'rgba(255,255,255,0.04)',
                    color: ch.solo ? '#000000' : '#cbd5e1',
                    fontWeight: 800,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                  title={t.stems.soloTooltip}
                >
                  S
                </button>
                <button
                  onClick={() => handleToggleMute(ch.id)}
                  style={{
                    flex: 1,
                    padding: '4px 0',
                    borderRadius: '6px',
                    border: ch.mute ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)',
                    background: ch.mute ? '#ef4444' : 'rgba(255,255,255,0.04)',
                    color: ch.mute ? '#ffffff' : '#cbd5e1',
                    fontWeight: 800,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                  title={t.stems.muteTooltip}
                >
                  M
                </button>
              </div>

              {/* Suwak Panoramy (Pan) */}
              <div style={{ marginBottom: '10px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.65rem',
                    color: '#94a3b8',
                    marginBottom: '2px',
                  }}
                >
                  <span>L</span>
                  <span
                    style={{ cursor: 'pointer' }}
                    onClick={() => handlePanChange(ch.id, 0.0)}
                    title={t.stems.panResetTooltip}
                  >
                    {ch.pan === 0
                      ? 'C'
                      : ch.pan < 0
                      ? `${Math.round(Math.abs(ch.pan) * 100)}L`
                      : `${Math.round(ch.pan * 100)}R`}
                  </span>
                  <span>R</span>
                </div>
                <input
                  type="range"
                  min="-1.0"
                  max="1.0"
                  step="0.05"
                  value={ch.pan}
                  onChange={(e) => handlePanChange(ch.id, parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: ch.color_hex }}
                />
              </div>

              {/* Suwak Fader Głośności (0 - 100%, 75% = 0 dB) */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.01"
                  value={ch.volume}
                  onChange={(e) => handleVolumeChange(ch.id, parseFloat(e.target.value))}
                  onDoubleClick={() => handleVolumeChange(ch.id, 0.75)}
                  style={{
                    writingMode: 'vertical-lr',
                    direction: 'rtl',
                    width: '32px',
                    height: '180px',
                    accentColor: ch.color_hex,
                    cursor: 'pointer',
                  }}
                  title={t.stems.volumeResetTooltip}
                />
              </div>

              {/* Odczyt decybeli / procentów */}
              <div style={{ textAlign: 'center', marginTop: '8px' }}>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    fontFamily: 'var(--font-mono)',
                    color: isMuted ? '#64748b' : ch.volume >= 0.75 ? ch.color_hex : '#cbd5e1',
                  }}
                >
                  {isMuted
                    ? '-INF dB'
                    : ch.volume <= 0.001
                    ? '-INF dB'
                    : `${dbVal >= 0 ? '+' : ''}${dbVal.toFixed(1)} dB`}
                </span>
                <div style={{ fontSize: '0.65rem', color: '#64748b' }}>
                  {Math.round(ch.volume * 100)}%
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Panel boczny Master & Presety */}
      <div
        style={{
          width: '260px',
          background: 'rgba(15, 23, 42, 0.8)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '8px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f8fafc' }}>
            {t.stems.masterAndPresets}
          </span>
        </div>

        {/* Suwak Master */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.75rem', color: '#cbd5e1', fontWeight: 600 }}>
              {t.stems.masterVolume}
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-pink)' }}>
              {Math.round(masterVolume * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0.0"
            max="1.5"
            step="0.05"
            value={masterVolume}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setMasterVolume(v);
              applyMixToEngine(channels, v);
            }}
            style={{ width: '100%', accentColor: 'var(--accent-pink)' }}
          />
        </div>

        {/* Przycisk Reset do 75% */}
        <button
          onClick={handleResetAllToUnity}
          style={{
            padding: '8px',
            borderRadius: '8px',
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#f8fafc',
            fontSize: '0.75rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <RotateCcw size={14} />
          {t.stems.resetAllUnity}
        </button>

        {/* Szybkie presety */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>
            {t.stems.quickModes}
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            <button
              onClick={() => handleApplyPreset('karaoke')}
              style={{
                padding: '6px',
                borderRadius: '6px',
                background: 'rgba(236, 72, 153, 0.1)',
                border: '1px solid rgba(236, 72, 153, 0.25)',
                color: '#f43f5e',
                fontSize: '0.7rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {t.stems.karaokeMode}
            </button>
            <button
              onClick={() => handleApplyPreset('acapella')}
              style={{
                padding: '6px',
                borderRadius: '6px',
                background: 'rgba(139, 92, 246, 0.1)',
                border: '1px solid rgba(139, 92, 246, 0.25)',
                color: '#a855f7',
                fontSize: '0.7rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {t.stems.acapellaSolo}
            </button>
            <button
              onClick={() => handleApplyPreset('drums_only')}
              style={{
                padding: '6px',
                borderRadius: '6px',
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                color: '#f59e0b',
                fontSize: '0.7rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {t.stems.drumsOnly}
            </button>
            <button
              onClick={() => handleApplyPreset('rhythm_section')}
              style={{
                padding: '6px',
                borderRadius: '6px',
                background: 'rgba(14, 165, 233, 0.1)',
                border: '1px solid rgba(14, 165, 233, 0.25)',
                color: '#0ea5e9',
                fontSize: '0.7rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {t.stems.rhythmDrumsBass}
            </button>
            <button
              onClick={() => handleApplyPreset('instrumental')}
              style={{
                padding: '6px',
                borderRadius: '6px',
                background: 'rgba(52, 211, 153, 0.1)',
                border: '1px solid rgba(52, 211, 153, 0.25)',
                color: '#34d399',
                fontSize: '0.7rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {t.stems.instrumental}
            </button>
            <button
              onClick={() => handleApplyPreset('practice_guitar')}
              style={{
                padding: '6px',
                borderRadius: '6px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                color: '#10b981',
                fontSize: '0.7rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {t.stems.practiceNoGuitar}
            </button>
          </div>
        </div>

        {/* Narzędzia analityczne powiązane ze stemami */}
        <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '10px' }}>
          <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
            {t.stems.trackAnalysis}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {onOpenChords && (
              <button
                onClick={onOpenChords}
                style={{
                  padding: '8px',
                  borderRadius: '8px',
                  background: 'rgba(236, 72, 153, 0.15)',
                  border: '1px solid rgba(236, 72, 153, 0.3)',
                  color: 'var(--accent-pink)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Music size={14} />
                {t.stems.chordsFromBass}
              </button>
            )}
            {onOpenPianoRoll && (
              <button
                onClick={onOpenPianoRoll}
                style={{
                  padding: '8px',
                  borderRadius: '8px',
                  background: 'rgba(139, 92, 246, 0.15)',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  color: '#c084fc',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Piano size={14} />
                {t.stems.vocalPianoRollBtn}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
);
