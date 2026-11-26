import type { AppTab } from '../../types/navigation';
import React from 'react';
import { Loader2 } from 'lucide-react';
import type { Translations } from '../../i18n';

interface BackgroundExportBadgeProps {
  isTranscoding: boolean;
  activeTab: AppTab;
  isPlayerScrolledDown: boolean;
  transcodeProgress: { percent: number } | null;
  transcodeElapsedSeconds: number;
  transcodeOutput: string;
  onOpenTranscodeSettings: () => void;
  loc: Translations;
}

export const BackgroundExportBadge: React.FC<BackgroundExportBadgeProps> = ({
  isTranscoding,
  activeTab,
  isPlayerScrolledDown,
  transcodeProgress,
  transcodeElapsedSeconds,
  transcodeOutput,
  onOpenTranscodeSettings,
  loc,
}) => {
  if (!isTranscoding) return null;

  const percent = transcodeProgress && transcodeProgress.percent > 0 ? Math.round(transcodeProgress.percent) : null;
  const outputFileName = transcodeOutput ? transcodeOutput.split('/').pop() || transcodeOutput : loc.notifications.exportProcessing;

  return (
    <div
      className="glass-card"
      style={{
        position: 'fixed',
        bottom: activeTab !== 'player' || isPlayerScrolledDown ? '90px' : '24px',
        right: '24px',
        zIndex: 1200,
        padding: '12px 18px',
        borderRadius: '14px',
        background: 'linear-gradient(135deg, rgba(25, 20, 40, 0.95) 0%, rgba(15, 10, 25, 0.98) 100%)',
        border: '1px solid var(--accent-pink)',
        boxShadow: '0 8px 32px rgba(236, 72, 153, 0.3), 0 0 15px rgba(168, 85, 247, 0.25)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        backdropFilter: 'blur(16px)',
        animation: 'fadeIn 0.25s ease',
        minWidth: '280px',
        maxWidth: '380px',
      }}
    >
      <div
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 0 12px rgba(236, 72, 153, 0.5)',
        }}
      >
        <Loader2 size={18} className="spin" color="#fff" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fff' }}>
            {loc.notifications.exportBackground}
          </span>
          <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-pink)' }}>
            {percent !== null ? `${percent}%` : `${transcodeElapsedSeconds}s`}
          </span>
        </div>
        <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden', margin: '3px 0' }}>
          <div
            style={{
              width: percent !== null ? `${Math.min(100, Math.max(3, percent))}%` : '100%',
              height: '100%',
              background: 'linear-gradient(90deg, var(--accent-pink), var(--accent-purple))',
              borderRadius: '2px',
              transition: 'width 0.2s ease',
              animation: percent === null ? 'pulse 1.5s ease-in-out infinite' : 'none',
            }}
          />
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {outputFileName}
        </div>
      </div>
      <button
        onClick={onOpenTranscodeSettings}
        className="glass-card"
        style={{
          padding: '6px 10px',
          borderRadius: '8px',
          background: 'rgba(255, 255, 255, 0.08)',
          border: '1px solid var(--border-subtle)',
          color: '#fff',
          fontSize: '0.72rem',
          fontWeight: 600,
          cursor: 'pointer',
          flexShrink: 0,
        }}
        title={loc.notifications.exportDetailsTooltip}
      >
        {loc.notifications.exportDetails}
      </button>
    </div>
  );
};
