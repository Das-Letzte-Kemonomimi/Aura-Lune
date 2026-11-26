import React from 'react';
import type { PlayerViewProps } from '../PlayerView';
import { cn } from '../../../utils/cn';

export type PlayerQuickDspVibesProps = Pick<PlayerViewProps, 'activeDspVibe' | 'handleApplyDspVibe'> & {
  t: PlayerViewProps['loc'];
};

// Memo: the section does not depend on the playback position, so it does not render on every status frame.
export const PlayerQuickDspVibes: React.FC<PlayerQuickDspVibesProps> = React.memo(({
  activeDspVibe,
  handleApplyDspVibe,
  t,
}) => (
    <div className="mx-0 mt-0.5 mb-0 flex flex-wrap items-center gap-2">
      <span className="text-xs font-bold tracking-wider text-fg-muted">
        {t.quickVibes.label}
      </span>
      {[
        { id: 'nightcore', label: t.quickVibes.nightcore, desc: t.quickVibes.nightcoreDesc },
        { id: 'slowed', label: t.quickVibes.slowed, desc: t.quickVibes.slowedDesc },
        { id: 'vocal', label: t.quickVibes.vocal, desc: t.quickVibes.vocalDesc },
        { id: 'bass', label: t.quickVibes.bass, desc: t.quickVibes.bassDesc },
        { id: 'flat', label: t.quickVibes.flat, desc: t.quickVibes.flatDesc },
      ].map((v) => {
        const isSelected = activeDspVibe === v.id;
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => handleApplyDspVibe(v.id as any)}
            title={v.desc}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-2xl border px-3 py-1.5 text-xs transition-all duration-200',
              isSelected ? 'border-accent-pink font-bold text-fg shadow-halo-md shadow-accent-pink/45' : 'border-line font-semibold text-fg-secondary',
              isSelected ? 'bg-linear-135 from-accent-pink/35 to-accent-purple/35' : 'bg-white/5',
            )}
          >
            {isSelected && (
              <span
                className="inline-block h-1.5 w-1.5 rounded-full bg-accent-pink shadow-halo-sm shadow-accent-pink"
              />
            )}
            {v.label}
          </button>
        );
      })}
    </div>
));
