import React from 'react';
import type { TranscodeSettingsViewProps } from '../TranscodeSettingsView';
import { cn } from '../../../utils/cn';

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
      className={cn(
        'mt-2.5 flex flex-col gap-2 rounded-xl border px-3.5 py-3 transition-all duration-200',
        transcodeApplyDsp ? 'bg-accent-pink/10' : 'bg-white/3',
        transcodeApplyDsp ? 'border-accent-pink' : 'border-line',
      )}
    >
      <label
        className={cn(
          'flex cursor-pointer select-none items-center gap-2.5 text-sm font-semibold',
          transcodeApplyDsp ? 'text-accent-pink' : 'text-fg',
        )}
      >
        <input
          type="checkbox"
          checked={transcodeApplyDsp}
          onChange={(e) => onTranscodeApplyDspChange(e.target.checked)}
          className="h-4 w-4 accent-accent-pink"
        />
        <span>{loc.settings.transcodeApplyDsp}</span>
      </label>
      <p className="m-0 pl-6.5 text-ui text-fg-muted">
        {loc.settings.transcodeApplyDspDesc}
      </p>
      {transcodeApplyDsp && (
        <div className="flex flex-wrap gap-2 pl-6.5 font-mono text-ui">
          <span className="rounded-sm bg-accent-pink/20 px-2 py-0.5 text-accent-pink">
            Pitch: {(status.pitch_semitones ?? 0) > 0 ? `+${(status.pitch_semitones ?? 0).toFixed(1)}` : (status.pitch_semitones ?? 0).toFixed(1)} st
          </span>
          <span className="rounded-sm bg-accent-cyan/20 px-2 py-0.5 text-accent-cyan">
            Tempo: {(status.tempo_ratio ?? 1.0).toFixed(2)}x
          </span>
          <span className="rounded-sm bg-accent-purple/20 px-2 py-0.5 text-accent-purple">
            Speed: {(status.rate_ratio ?? 1.0).toFixed(2)}x
          </span>
          {reverbEnabled && (
            <span className="rounded-sm bg-yellow-500/20 px-2 py-0.5 text-yellow-400">
              Reverb: {Math.round(reverbLevel * 100)}%
            </span>
          )}
        </div>
      )}
    </div>
);
