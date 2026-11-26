import React from 'react';
import { Zap, Headphones, Check, X } from '../../../components/ui/icons';
import { Badge, Button, Card, Chip, SectionHeader } from '../../../components/ui';
import type { AudioDevicesSettingsViewProps } from '../AudioDevicesSettingsView';

export type SoundCardListProps = Pick<
  AudioDevicesSettingsViewProps,
  'cards' | 'loc' | 'onDisableProAudio' | 'onEnableProAudio' | 'onSetCardProfile' | 'onSetBluetoothCodec'
>;

const codecLabel = (codec: string) => {
  if (codec === 'Ldac') return 'Sony LDAC (High-Res 990 kbps)';
  if (codec === 'AptxHd') return 'aptX HD';
  if (codec === 'SbcXq') return 'SBC-XQ (High Quality)';
  return codec;
};

export const SoundCardList: React.FC<SoundCardListProps> = ({
  cards,
  loc,
  onDisableProAudio,
  onEnableProAudio,
  onSetBluetoothCodec,
  onSetCardProfile,
}) => (
  <div className="flex flex-col gap-3.5">
    {cards.map((card) => {
      const proAudioReady = card.profiles?.some((p) => p.is_pro_audio) ?? false;
      const hardwareProfiles = card.profiles?.filter((p) => p.available && !p.bluetooth_codec) ?? [];
      const codecProfiles = card.profiles?.filter((p) => p.bluetooth_codec) ?? [];
      return (
        <Card key={card.name} padding="sm" className="flex flex-col gap-3">
          <SectionHeader
            icon={card.is_bluetooth ? <Headphones size={20} /> : <Zap size={20} />}
            tone={card.is_bluetooth ? 'cyan' : 'amber'}
            title={card.description}
            description={
              <span className="font-mono">
                ID: {card.name} | {loc.settings.active}: {card.active_profile || 'default'}
              </span>
            }
            actions={proAudioReady && <Badge tone="green">PRO AUDIO READY</Badge>}
          />

          {/* Pro Audio actions */}
          {proAudioReady && (
            <div>
              {card.active_profile === 'pro-audio' ? (
                <Button variant="tinted" tone="pink" onClick={() => onDisableProAudio(card.name)}>
                  <X size={16} /> Pro Audio OFF (Stereo)
                </Button>
              ) : (
                <Button size="sm" onClick={() => onEnableProAudio(card.name)}>
                  <Check size={14} /> Pro Audio ON (Bit-Perfect Direct ALSA)
                </Button>
              )}
            </div>
          )}

          {/* All available hardware profiles of the card */}
          {hardwareProfiles.length > 0 && (
            <div>
              <span className="mb-1.5 block text-xs text-fg-secondary">{loc.settings.hardwareProfiles}</span>
              <div className="flex flex-wrap gap-1.5">
                {hardwareProfiles.map((p) => {
                  const isCurrent = card.active_profile === p.name;
                  return (
                    <Chip
                      key={p.name}
                      size="xs"
                      tone="green"
                      pressed={isCurrent}
                      onClick={() => onSetCardProfile(card.name, p.name)}
                      title={p.description || p.name}
                    >
                      {isCurrent && <Check size={14} />}
                      {p.description || p.name}
                    </Chip>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bluetooth codecs */}
          {card.is_bluetooth && codecProfiles.length > 0 && (
            <div>
              <span className="mb-1.5 block text-xs text-fg-secondary">{loc.settings.bluetoothCodecSelect}</span>
              <div className="flex flex-wrap gap-1.5">
                {codecProfiles.map((p) => (
                  <Chip
                    key={p.name}
                    tone="cyan"
                    pressed={card.active_profile === p.name}
                    onClick={() => onSetBluetoothCodec(card.name, p.bluetooth_codec ?? '')}
                  >
                    {codecLabel(p.bluetooth_codec ?? '')}
                  </Chip>
                ))}
              </div>
            </div>
          )}
        </Card>
      );
    })}
  </div>
);
