import React from 'react';
import { Save, Sparkles } from 'lucide-react';
import type { DspStudioViewProps } from '../DspStudioView';
import { cn } from '../../../utils/cn';

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
    <div className="mb-7 rounded-2xl border border-line bg-black/25 p-4">
      <label className="mb-2 block text-sm font-semibold text-fg-secondary">
        {loc.dsp.eqPresets}:
      </label>
      <div className={cn('flex gap-2.5', presets.length > 0 ? 'mb-3' : 'mb-0')}>
        <input
          type="text"
          placeholder={loc.dsp.presetNamePlaceholder}
          value={newPresetName}
          onChange={(e) => setNewPresetName(e.target.value)}
          className="flex-1 rounded-lg border border-line bg-black/30 px-3 py-2 text-sm text-fg"
        />
        <button
          onClick={handleSavePreset}
          className="flex items-center gap-1.5 rounded-lg bg-accent-gradient px-4 py-2 text-ui font-semibold text-on-accent"
        >
          <Save size={14} /> {loc.dsp.savePreset}
        </button>
      </div>

      {/* Profile Sygnaturowe 1.0 */}
      <div className="mb-4">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-accent-pink">
          <Sparkles size={14} /> Profile Sygnaturowe Auralune 1.0 (Mastering Profiles)
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2">
          <button
            onClick={() => handleApplySignatureProfile('vocal_air')}
            className="glass-card flex flex-col gap-0.5 rounded-xl border border-accent-pink/40 bg-linear-135 from-accent-pink/20 to-accent-purple/15 px-3 py-2 text-left text-fg"
          >
            <span className="text-ui font-bold text-fg">🌸 Anime Vocal Air</span>
            <span className="text-xxs text-fg-muted">{loc.dsp.vocalPreserveDesc}</span>
          </button>

          <button
            onClick={() => handleApplySignatureProfile('lofi_tape')}
            className="glass-card flex flex-col gap-0.5 rounded-xl border border-orange-500/40 bg-linear-135 from-orange-500/20 to-accent-purple/15 px-3 py-2 text-left text-fg"
          >
            <span className="text-ui font-bold text-fg">☕ Midnight Lo-Fi Tape</span>
            <span className="text-xxs text-fg-muted">{loc.dsp.tapeWarmthDesc}</span>
          </button>

          <button
            onClick={() => handleApplySignatureProfile('bit_perfect')}
            className="glass-card flex flex-col gap-0.5 rounded-xl border border-green-500/40 bg-linear-135 from-green-500/20 to-accent-cyan/15 px-3 py-2 text-left text-fg"
          >
            <span className="text-ui font-bold text-fg">🎧 Bit-Perfect Direct</span>
            <span className="text-xxs text-fg-muted">{loc.dsp.bitPerfectDesc}</span>
          </button>

          <button
            onClick={() => handleApplySignatureProfile('nightcore')}
            className="glass-card flex flex-col gap-0.5 rounded-xl border border-accent-purple/40 bg-linear-135 from-accent-purple/20 to-pink-500/20 px-3 py-2 text-left text-fg"
          >
            <span className="text-ui font-bold text-fg">⚡ Nightcore Club Anthem</span>
            <span className="text-xxs text-fg-muted">{loc.dsp.nightcoreProfileDesc}</span>
          </button>

          <button
            onClick={() => handleApplySignatureProfile('slowed')}
            className="glass-card flex flex-col gap-0.5 rounded-xl border border-accent-cyan/40 bg-linear-135 from-accent-cyan/20 to-accent-purple/15 px-3 py-2 text-left text-fg"
          >
            <span className="text-ui font-bold text-fg">🌌 Ambient Slowed & Space</span>
            <span className="text-xxs text-fg-muted">{loc.dsp.slowedProfileDesc}</span>
          </button>
        </div>
      </div>

      {presets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => handleLoadPreset(p)}
              className="flex items-center gap-1.5 rounded-lg border border-line bg-card/70 px-3 py-1.5 text-xs font-semibold text-fg"
            >
              <Sparkles size={12} className="text-accent-pink" />
              <span>{p.name}</span>
              <span className="text-xxs text-fg-muted">
                ({p.pitch_semitones > 0 ? `+${p.pitch_semitones}` : p.pitch_semitones}st, {p.tempo_ratio}x)
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
);
