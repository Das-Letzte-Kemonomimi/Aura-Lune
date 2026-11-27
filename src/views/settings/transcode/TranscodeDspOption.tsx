import React from 'react';
import { Wand2 } from '../../../components/ui/icons';
import { Badge, ToggleCard } from '../../../components/ui';
import type { TranscodeSettingsViewProps } from '../TranscodeSettingsView';

export type TranscodeDspOptionProps = Pick<
  TranscodeSettingsViewProps,
  'transcodeApplyDsp' | 'onTranscodeApplyDspChange' | 'loc' | 'status' | 'reverbEnabled' | 'reverbLevel'
>;

export const TranscodeDspOption: React.FC<TranscodeDspOptionProps> = ({
  loc,
  onTranscodeApplyDspChange,
  reverbEnabled,
  reverbLevel,
  status,
  transcodeApplyDsp,
}) => {
  const pitch = status.pitch_semitones ?? 0;
  return (
    <ToggleCard
      icon={<Wand2 size={20} />}
      tone="pink"
      title={loc.settings.transcodeApplyDsp}
      description={loc.settings.transcodeApplyDspDesc}
      checked={transcodeApplyDsp}
      onChange={onTranscodeApplyDspChange}
    >
      {transcodeApplyDsp && (
        <div className="flex flex-wrap gap-2">
          <Badge tone="pink" mono>
            Pitch: {pitch > 0 ? '+' : ''}
            {pitch.toFixed(1)} st
          </Badge>
          <Badge tone="cyan" mono>
            Tempo: {(status.tempo_ratio ?? 1.0).toFixed(2)}x
          </Badge>
          <Badge tone="purple" mono>
            Speed: {(status.rate_ratio ?? 1.0).toFixed(2)}x
          </Badge>
          {reverbEnabled && (
            <Badge tone="amber" mono>
              Reverb: {Math.round(reverbLevel * 100)}%
            </Badge>
          )}
        </div>
      )}
    </ToggleCard>
  );
};
