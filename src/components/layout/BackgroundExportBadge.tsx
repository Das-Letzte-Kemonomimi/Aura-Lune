import type { AppTab } from '../../types/navigation';
import React from 'react';
import { Loader2 } from '../ui/icons';
import { cn } from '../../utils/cn';
import { Button } from '../ui';
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
      className={cn(
        'fixed right-6 z-70 flex max-w-95 min-w-70 items-center gap-3 rounded-2xl border border-accent-pink bg-modal px-4.5 py-3 shadow-halo-xl shadow-accent-pink/30 backdrop-blur-lg motion-safe:animate-fade-in',
        // `bottom-29` clears the `h-25.5` BottomPlaybackDock when visible.
        activeTab !== 'player' || isPlayerScrolledDown ? 'bottom-29' : 'bottom-6',
      )}
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-gradient shadow-halo shadow-accent-pink/50">
        <Loader2 size={18} className="text-on-accent motion-safe:animate-spin" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center justify-between">
          <span className="text-ui font-bold text-fg">{loc.notifications.exportBackground}</span>
          <span className="font-mono text-xs font-bold text-accent-pink">
            {percent !== null ? `${percent}%` : `${transcodeElapsedSeconds}s`}
          </span>
        </div>
        <div className="my-0.5 h-1 w-full overflow-hidden rounded-xs bg-white/10">
          <div
            className={cn(
              'h-full rounded-xs bg-linear-to-r from-accent-pink to-accent-purple transition-[width] duration-200',
              percent === null && 'motion-safe:animate-pulse',
            )}
            style={{ width: percent !== null ? `${Math.min(100, Math.max(3, percent))}%` : '100%' }}
          />
        </div>
        <div className="truncate text-xxs text-fg-secondary">{outputFileName}</div>
      </div>
      <Button size="sm" onClick={onOpenTranscodeSettings} title={loc.notifications.exportDetailsTooltip} className="shrink-0">
        {loc.notifications.exportDetails}
      </Button>
    </div>
  );
};
