import React from 'react';
import type { PlayerViewProps } from '../PlayerView';
import { Sparkles } from '../../../components/ui/icons';
import { Chip } from '../../../components/ui';
import type { Tone } from '../../../components/ui/tones';

export type PlayerQuickDspVibesProps = Pick<PlayerViewProps, 'activeDspVibe' | 'handleApplyDspVibe'> & {
  t: PlayerViewProps['loc'];
};

type Vibe = Parameters<PlayerViewProps['handleApplyDspVibe']>[0];
type Loc = PlayerViewProps['loc'];

const VIBES: readonly { id: Vibe; tone: Tone; label: (t: Loc) => string; desc: (t: Loc) => string }[] = [
  { id: 'nightcore', tone: 'pink', label: (t) => t.quickVibes.nightcore, desc: (t) => t.quickVibes.nightcoreDesc },
  { id: 'slowed', tone: 'amber', label: (t) => t.quickVibes.slowed, desc: (t) => t.quickVibes.slowedDesc },
  { id: 'vocal', tone: 'purple', label: (t) => t.quickVibes.vocal, desc: (t) => t.quickVibes.vocalDesc },
  { id: 'bass', tone: 'cyan', label: (t) => t.quickVibes.bass, desc: (t) => t.quickVibes.bassDesc },
  { id: 'flat', tone: 'green', label: (t) => t.quickVibes.flat, desc: (t) => t.quickVibes.flatDesc },
];

// Memo: the section does not depend on the playback position, so it does not render on every status frame.
export const PlayerQuickDspVibes: React.FC<PlayerQuickDspVibesProps> = React.memo(({
  activeDspVibe,
  handleApplyDspVibe,
  t,
}) => (
  <div role="group" aria-label={t.quickVibes.label} className="flex items-center gap-2.5 rounded-2xl border border-line bg-black/25 py-1.5 pr-1.5 pl-3">
    <span className="flex shrink-0 items-center gap-1.5 text-xxs font-extrabold tracking-widest text-fg-muted uppercase">
      <Sparkles size={12} className="text-accent-purple" />
      {t.quickVibes.label}
    </span>
    <div aria-hidden="true" className="h-4 w-px shrink-0 bg-white/10" />
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
      {VIBES.map((v) => (
        <Chip
          key={v.id}
          tone={v.tone}
          pressed={activeDspVibe === v.id}
          onClick={() => handleApplyDspVibe(v.id)}
          title={v.desc(t)}
          className="rounded-full px-3 py-1"
        >
          {v.label(t)}
        </Chip>
      ))}
    </div>
  </div>
));
