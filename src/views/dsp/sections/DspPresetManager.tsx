import React from 'react';
import { Save, Sparkles } from '../../../components/ui/icons';
import type { DspStudioViewProps } from '../DspStudioView';
import { Button, Card, SectionHeader, TextField, type Tone } from '../../../components/ui';

export type DspPresetManagerProps = Pick<
  DspStudioViewProps,
  | 'loc'
  | 'presets'
  | 'newPresetName'
  | 'setNewPresetName'
  | 'handleSavePreset'
  | 'handleApplySignatureProfile'
  | 'handleLoadPreset'
>;

export const DspPresetManager: React.FC<DspPresetManagerProps> = ({
  handleApplySignatureProfile,
  handleLoadPreset,
  handleSavePreset,
  loc,
  newPresetName,
  presets,
  setNewPresetName,
}) => {
  // The emoji are part of the profile names, not icons.
  const profiles: { id: string; name: string; desc: string; tone: Tone }[] = [
    { id: 'vocal_air', name: '🌸 Anime Vocal Air', desc: loc.dsp.vocalPreserveDesc, tone: 'pink' },
    { id: 'lofi_tape', name: '☕ Midnight Lo-Fi Tape', desc: loc.dsp.tapeWarmthDesc, tone: 'amber' },
    { id: 'bit_perfect', name: '🎧 Bit-Perfect Direct', desc: loc.dsp.bitPerfectDesc, tone: 'green' },
    { id: 'nightcore', name: '⚡ Nightcore Club Anthem', desc: loc.dsp.nightcoreProfileDesc, tone: 'purple' },
    { id: 'slowed', name: '🌌 Ambient Slowed & Space', desc: loc.dsp.slowedProfileDesc, tone: 'cyan' },
  ];

  return (
    <Card>
      <SectionHeader icon={<Save size={18} />} tone="pink" title={loc.dsp.eqPresets} />

      <div className="mt-4 flex gap-2.5">
        <TextField
          aria-label={loc.dsp.presetNamePlaceholder}
          placeholder={loc.dsp.presetNamePlaceholder}
          value={newPresetName}
          onChange={(e) => setNewPresetName(e.target.value)}
          className="flex-1"
        />
        <Button variant="primary" onClick={handleSavePreset}>
          <Save size={14} /> {loc.dsp.savePreset}
        </Button>
      </div>

      {/* Signature profiles 1.0 */}
      <div className="mt-4 mb-2 flex items-center gap-1.5 text-xs font-bold text-accent-pink">
        <Sparkles size={14} /> Auralune Signature Profiles 1.0 (Mastering Profiles)
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(--spacing(45),1fr))] gap-2">
        {profiles.map((p) => (
          <Button
            key={p.id}
            variant="tinted"
            tone={p.tone}
            onClick={() => handleApplySignatureProfile(p.id)}
            className="flex-col items-start justify-start gap-0.5 rounded-xl px-3 py-2 text-left whitespace-normal"
          >
            <span className="text-ui font-bold text-fg">{p.name}</span>
            <span className="text-xxs font-normal text-fg-muted">{p.desc}</span>
          </Button>
        ))}
      </div>

      {presets.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {presets.map((p) => (
            <Button key={p.id} size="sm" onClick={() => handleLoadPreset(p)}>
              <Sparkles size={12} className="text-accent-pink" />
              {p.name}
              <span className="text-xxs font-normal text-fg-muted">
                ({p.pitch_semitones > 0 ? `+${p.pitch_semitones}` : p.pitch_semitones}st, {p.tempo_ratio}x)
              </span>
            </Button>
          ))}
        </div>
      )}
    </Card>
  );
};
