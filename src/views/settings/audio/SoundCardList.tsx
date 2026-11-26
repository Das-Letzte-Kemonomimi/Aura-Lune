import React from 'react';
import { Zap, Headphones } from 'lucide-react';
import type { AudioDevicesSettingsViewProps } from '../AudioDevicesSettingsView';

export type SoundCardListProps = Pick<AudioDevicesSettingsViewProps, 'cards' | 'loc' | 'onDisableProAudio' | 'onEnableProAudio' | 'onSetCardProfile' | 'onSetBluetoothCodec'>;

export const SoundCardList: React.FC<SoundCardListProps> = ({
  cards,
  loc,
  onDisableProAudio,
  onEnableProAudio,
  onSetBluetoothCodec,
  onSetCardProfile,
}) => (
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
);
