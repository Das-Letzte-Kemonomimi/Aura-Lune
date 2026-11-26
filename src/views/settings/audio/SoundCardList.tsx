import React from 'react';
import { Zap, Headphones, Check, X } from '../../../components/ui/icons';
import type { AudioDevicesSettingsViewProps } from '../AudioDevicesSettingsView';
import { cn } from '../../../utils/cn';

export type SoundCardListProps = Pick<AudioDevicesSettingsViewProps, 'cards' | 'loc' | 'onDisableProAudio' | 'onEnableProAudio' | 'onSetCardProfile' | 'onSetBluetoothCodec'>;

export const SoundCardList: React.FC<SoundCardListProps> = ({
  cards,
  loc,
  onDisableProAudio,
  onEnableProAudio,
  onSetBluetoothCodec,
  onSetCardProfile,
}) => (
    <div className="flex flex-col gap-3.5">
      {cards.map((card) => (
        <div key={card.name} className="glass-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {card.is_bluetooth ? <Headphones size={18} className="text-accent-cyan" /> : <Zap size={18} className="text-accent-amber" />}
              <span className="font-semibold">{card.description}</span>
            </div>

            {card.profiles && card.profiles.some((p) => p.is_pro_audio) && (
              <span
                className="rounded-md border border-accent-green/40 bg-accent-green/20 px-2 py-1 text-xxs font-bold text-accent-green"
              >
                PRO AUDIO READY
              </span>
            )}
          </div>

          <p className="mb-2.5 font-mono text-xs text-fg-muted">
            ID: {card.name} | {loc.settings.active}: {card.active_profile || 'default'}
          </p>

          {/* Pro Audio actions */}
          {card.profiles && card.profiles.some((p) => p.is_pro_audio) && (
            <div className="mb-2.5">
              {card.active_profile === 'pro-audio' ? (
                <button
                  onClick={() => onDisableProAudio(card.name)}
                  className="flex items-center gap-1.5 rounded-lg border border-accent-pink/50 bg-accent-pink/25 px-3.5 py-2 text-ui font-bold text-accent-pink"
                >
                  <X size={14} /> Pro Audio OFF (Stereo)
                </button>
              ) : (
                <button
                  onClick={() => onEnableProAudio(card.name)}
                  className="rounded-lg border border-line bg-white/8 px-3 py-1.5 text-xs font-semibold text-fg"
                >
                  <Check size={13} className="icon-inline mr-1" />Pro Audio ON (Bit-Perfect Direct ALSA)
                </button>
              )}
            </div>
          )}

          {/* All available hardware profiles of the card */}
          {card.profiles && card.profiles.length > 0 && (
            <div className="mb-2.5">
              <span className="mb-1 block text-xs text-fg-secondary">
                {loc.settings.hardwareProfiles}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {card.profiles
                  .filter((p) => p.available && !p.bluetooth_codec)
                  .map((p) => {
                    const isCurrent = card.active_profile === p.name;
                    return (
                      <button
                        key={p.name}
                        onClick={() => onSetCardProfile(card.name, p.name)}
                        className={cn(
                          'rounded-md border px-2 py-1 text-xxs',
                          isCurrent ? 'bg-accent-green/25' : 'bg-white/4',
                          isCurrent ? 'border-accent-green' : 'border-white/8',
                          isCurrent ? 'text-accent-green' : 'text-fg-muted',
                        )}
                        title={p.description || p.name}
                      >
                        {isCurrent && <Check size={12} className="icon-inline mr-1" />}{p.description || p.name}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Bluetooth codecs */}
          {card.is_bluetooth && card.profiles && (
            <div>
              <span className="mb-1.5 block text-xs text-fg-secondary">
                {loc.settings.bluetoothCodecSelect}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {card.profiles
                  .filter((p) => p.bluetooth_codec)
                  .map((p) => (
                    <button
                      key={p.name}
                      onClick={() => onSetBluetoothCodec(card.name, p.bluetooth_codec!)}
                      className={cn(
                        'rounded-md px-2.5 py-1.5 text-xs font-medium text-fg',
                        card.active_profile === p.name ? 'bg-accent-cyan' : 'bg-white/6',
                      )}
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
