import React from 'react';
import { Gauge } from '../../../components/ui/icons';
import { Card, SectionHeader } from '../../../components/ui';
import type { PlaybackStatus } from '../../../types/player';
import type { DspStudioViewProps } from '../DspStudioView';
import { PreampControl } from './PreampControl';

export type DspPreampRackProps = Pick<
  DspStudioViewProps,
  | 'loc'
  | 'preampDb'
  | 'preampAuto'
  | 'autoPreampValue'
  | 'handlePreampChange'
  | 'handleTogglePreampAuto'
  | 'handleResetClipIndicator'
> & {
  status: PlaybackStatus;
};

/**
 * Standalone preamp / gain block. It sits outside the equalizer card because it is applied
 * whatever the EQ switch says, so the user can see at a glance what is active.
 */
export const DspPreampRack: React.FC<DspPreampRackProps> = ({
  autoPreampValue,
  handlePreampChange,
  handleResetClipIndicator,
  handleTogglePreampAuto,
  loc,
  preampAuto,
  preampDb,
  status,
}) => (
  <Card>
    <SectionHeader
      icon={<Gauge size={18} />}
      tone="purple"
      title={loc.dsp.preamp}
      description={loc.dsp.preampBlockDesc}
    />
    <div className="mt-4 flex">
      <PreampControl
        loc={loc}
        preampDb={preampDb}
        preampAuto={preampAuto}
        autoPreampValue={autoPreampValue}
        equalizerEnabled={Boolean(status.equalizer_enabled)}
        onPreampChange={handlePreampChange}
        onToggleAuto={handleTogglePreampAuto}
        clipDetected={Boolean(status.clip_detected)}
        onResetClip={handleResetClipIndicator}
      />
    </div>
  </Card>
);
