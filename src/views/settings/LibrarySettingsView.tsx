import React from 'react';
import { Image as ImageIcon, Loader2, Music } from '../../components/ui/icons';
import { Badge, Button, ToggleCard } from '../../components/ui';
import type { Translations } from '../../i18n';
import type { CoverSyncProgress } from '../../types/library';
import { SettingsPage } from './SettingsPage';

export interface LibrarySettingsViewProps {
  loc: Translations;
  autoFetchCoversBg: boolean;
  onToggleAutoFetchCoversBg: (enabled: boolean) => void;
  onTriggerBackgroundCoverFetch: () => void;
  coverSyncProgress?: CoverSyncProgress;
}

/** Library: background cover art fetching. */
export const LibrarySettingsView: React.FC<LibrarySettingsViewProps> = ({
  loc,
  autoFetchCoversBg,
  onToggleAutoFetchCoversBg,
  onTriggerBackgroundCoverFetch,
  coverSyncProgress,
}) => (
  <SettingsPage title={loc.settings.nav.library} icon={<Music size={22} />} tone="cyan">
      {/* Automatic background high-confidence cover art fetching */}
      <ToggleCard
        icon={<ImageIcon size={20} />}
        tone="pink"
        title={loc.settings.autoFetchCoversTitle}
        description={loc.settings.autoFetchCoversDesc}
        checked={autoFetchCoversBg}
        onChange={onToggleAutoFetchCoversBg}
      >
        {autoFetchCoversBg && (
          <div className="flex justify-end">
            <Button
              variant="tinted"
              tone="pink"
              size="sm"
              disabled={coverSyncProgress?.running}
              aria-busy={coverSyncProgress?.running}
              onClick={onTriggerBackgroundCoverFetch}
            >
              {coverSyncProgress?.running ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  {loc.library.syncingMissingCovers}
                  {coverSyncProgress.total > 0 && (
                    <Badge tone="pink" size="xs" mono>
                      {coverSyncProgress.processed}/{coverSyncProgress.total}
                    </Badge>
                  )}
                </>
              ) : (
                <>
                  <ImageIcon size={14} />
                  {loc.settings.autoFetchCoversNow}
                </>
              )}
            </Button>
          </div>
        )}
      </ToggleCard>
  </SettingsPage>
);
