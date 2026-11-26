import React from 'react';
import type { PlayerViewProps } from '../PlayerView';

export type PlayerQuickDspVibesProps = Pick<PlayerViewProps, 'activeDspVibe' | 'handleApplyDspVibe'> & {
  t: PlayerViewProps['loc'];
};

// Memo: sekcja nie zależy od pozycji odtwarzania — nie renderuje się w każdej klatce statusu.
export const PlayerQuickDspVibes: React.FC<PlayerQuickDspVibesProps> = React.memo(({
  activeDspVibe,
  handleApplyDspVibe,
  t,
}) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', margin: '2px 0 0 0' }}>
      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.04em' }}>
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
            style={{
              padding: '5px 12px',
              borderRadius: '16px',
              fontSize: '0.74rem',
              fontWeight: isSelected ? 700 : 600,
              background: isSelected
                ? 'linear-gradient(135deg, rgba(244, 63, 94, 0.35), rgba(168, 85, 247, 0.35))'
                : 'rgba(255, 255, 255, 0.05)',
              border: isSelected
                ? '1px solid var(--accent-pink)'
                : '1px solid var(--border-subtle)',
              color: isSelected ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: isSelected ? '0 0 14px rgba(244, 63, 94, 0.45)' : undefined,
            }}
          >
            {isSelected && (
              <span
                style={{
                  display: 'inline-block',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: 'var(--accent-pink)',
                  boxShadow: '0 0 6px var(--accent-pink)',
                }}
              />
            )}
            {v.label}
          </button>
        );
      })}
    </div>
));
