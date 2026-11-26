import React from 'react';
import type { PlayerViewProps } from '../PlayerView';
import { Chip } from '../../../components/ui';

export type PlayerQuickDspVibesProps = Pick<PlayerViewProps, 'activeDspVibe' | 'handleApplyDspVibe'> & {
  t: PlayerViewProps['loc'];
};

type Vibe = Parameters<PlayerViewProps['handleApplyDspVibe']>[0];
type Loc = PlayerViewProps['loc'];

const VIBES: readonly { id: Vibe; label: (t: Loc) => string; desc: (t: Loc) => string }[] = [
  { id: 'nightcore', label: (t) => t.quickVibes.nightcore, desc: (t) => t.quickVibes.nightcoreDesc },
  { id: 'slowed', label: (t) => t.quickVibes.slowed, desc: (t) => t.quickVibes.slowedDesc },
  { id: 'vocal', label: (t) => t.quickVibes.vocal, desc: (t) => t.quickVibes.vocalDesc },
  { id: 'bass', label: (t) => t.quickVibes.bass, desc: (t) => t.quickVibes.bassDesc },
  { id: 'flat', label: (t) => t.quickVibes.flat, desc: (t) => t.quickVibes.flatDesc },
];

// Memo: the section does not depend on the playback position, so it does not render on every status frame.
export const PlayerQuickDspVibes: React.FC<PlayerQuickDspVibesProps> = React.memo(({
  activeDspVibe,
  handleApplyDspVibe,
  t,
}) => (
  <div className="flex flex-wrap items-center gap-2">
    <span className="text-xs font-bold tracking-wider text-fg-muted">{t.quickVibes.label}</span>
    {VIBES.map((v) => (
      <Chip key={v.id} pressed={activeDspVibe === v.id} onClick={() => handleApplyDspVibe(v.id)} title={v.desc(t)}>
        {v.label(t)}
      </Chip>
    ))}
  </div>
));
