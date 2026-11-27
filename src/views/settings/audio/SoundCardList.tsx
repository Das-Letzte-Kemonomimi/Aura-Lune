import React from 'react';
import { Check, X } from '../../../components/ui/icons';
import { Badge, Button, Chip, SettingRow, SettingsGroup } from '../../../components/ui';
import type { AudioSettingsProps } from './audioSettingsProps';

export type SoundCardListProps = Pick<
  AudioSettingsProps,
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
  <>
    {cards.map((card) => {
      const proAudioReady = card.profiles?.some((p) => p.is_pro_audio) ?? false;
      const hardwareProfiles = card.profiles?.filter((p) => p.available && !p.bluetooth_codec) ?? [];
      const codecProfiles = card.profiles?.filter((p) => p.bluetooth_codec) ?? [];
      const proAudioOn = card.active_profile === 'pro-audio';
      return (
        <SettingsGroup
          key={card.name}
          label={card.description}
          description={
            <span className="font-mono">
              ID: {card.name} | {loc.settings.active}: {card.active_profile || 'default'}
            </span>
          }
          actions={proAudioReady && <Badge tone="green">{loc.settings.proAudioReady}</Badge>}
        >
          {/* Pro Audio actions */}
          {proAudioReady && (
            <SettingRow
              compact
              title="Pro Audio"
              control={
                proAudioOn ? (
                  <Button variant="tinted" tone="pink" size="sm" onClick={() => onDisableProAudio(card.name)}>
                    <X size={14} /> {loc.settings.proAudioOff}
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => onEnableProAudio(card.name)}>
                    <Check size={14} /> {loc.settings.proAudioOn}
                  </Button>
                )
              }
            />
          )}

          {/* All available hardware profiles of the card */}
          {hardwareProfiles.length > 0 && (
            <SettingRow compact title={loc.settings.hardwareProfiles}>
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
            </SettingRow>
          )}

          {/* Bluetooth codecs */}
          {card.is_bluetooth && codecProfiles.length > 0 && (
            <SettingRow compact title={loc.settings.bluetoothCodecSelect}>
              <div className="flex flex-wrap gap-1.5">
                {codecProfiles.map((p) => (
                  <Chip
                    key={p.name}
                    size="xs"
                    tone="cyan"
                    pressed={card.active_profile === p.name}
                    onClick={() => onSetBluetoothCodec(card.name, p.bluetooth_codec ?? '')}
                  >
                    {codecLabel(p.bluetooth_codec ?? '')}
                  </Chip>
                ))}
              </div>
            </SettingRow>
          )}
        </SettingsGroup>
      );
    })}
  </>
);
