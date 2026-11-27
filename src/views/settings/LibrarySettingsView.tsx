import React from 'react';
import { Image as ImageIcon, Loader2, Music } from '../../components/ui/icons';
import { Badge, Button, SettingsGroup } from '../../components/ui';
import type { Translations } from '../../i18n';
import type { CoverSyncProgress } from '../../types/library';
import { SettingsPage } from './SettingsPage';
import { ToggleRow } from './ToggleRow';

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
    <SettingsGroup label={loc.settings.group.coverArt}>
      {/* Automatic background high-confidence cover art fetching */}
      <ToggleRow
        title={loc.settings.autoFetchCoversTitle}
        description={loc.settings.autoFetchCoversDesc}
        checked={autoFetchCoversBg}
        onChange={onToggleAutoFetchCoversBg}
      >
        {autoFetchCoversBg && (
          <div className="flex justify-end">
            <Button
              variant="tinted"
              tone="cyan"
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
                    <Badge tone="cyan" size="xs" mono>
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
      </ToggleRow>
    </SettingsGroup>
  </SettingsPage>
);
