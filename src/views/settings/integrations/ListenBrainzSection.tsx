import React, { useId } from 'react';
import { ExternalLink } from '../../../components/ui/icons';
import { Badge, Button, FieldLabel, SettingRow, SettingsGroup, TextField } from '../../../components/ui';
import type { Translations } from '../../../i18n';
import { StatusMessage } from './StatusMessage';
import { ToggleRow } from '../ToggleRow';

export interface ListenBrainzSectionProps {
  loc: Translations;
  listenbrainzEnabled: boolean;
  listenbrainzToken: string;
  listenbrainzUser: string | null;
  listenbrainzStatusMsg: string | null;
  listenbrainzTesting: boolean;
  onToggleListenbrainz: (enabled: boolean) => void;
  onListenbrainzTokenChange: (token: string) => void;
  onTestListenbrainz: () => void;
}

/** ListenBrainz scrobbler (MetaBrainz ecosystem). */
export const ListenBrainzSection: React.FC<ListenBrainzSectionProps> = ({
  loc,
  listenbrainzEnabled,
  listenbrainzToken,
  listenbrainzUser,
  listenbrainzStatusMsg,
  listenbrainzTesting,
  onToggleListenbrainz,
  onListenbrainzTokenChange,
  onTestListenbrainz,
}) => {
  const id = useId();

  return (
    <SettingsGroup label="ListenBrainz" actions={<Badge tone="neutral">{loc.settings.openSourceBadge}</Badge>}>
      <ToggleRow
        title={loc.settings.listenbrainzTitle}
        description={loc.settings.listenbrainzDesc}
        checked={listenbrainzEnabled}
        onChange={onToggleListenbrainz}
      />
      <SettingRow compact title={loc.settings.listenbrainzToken}>
        <div className="flex flex-col gap-2.5">
          <FieldLabel htmlFor={`${id}-lb-token`} className="sr-only">
            {loc.settings.listenbrainzToken}
          </FieldLabel>
          <div className="flex gap-2">
            <TextField
              id={`${id}-lb-token`}
              type="password"
              placeholder={loc.settings.listenbrainzTokenPlaceholder}
              value={listenbrainzToken}
              onChange={(e) => onListenbrainzTokenChange(e.target.value)}
            />
            <Button
              variant="tinted"
              tone="cyan"
              disabled={listenbrainzTesting || !listenbrainzToken.trim()}
              onClick={onTestListenbrainz}
            >
              {listenbrainzTesting ? loc.settings.listenbrainzTesting : loc.settings.listenbrainzTest}
            </Button>
          </div>
          {listenbrainzStatusMsg && (
            <StatusMessage ok={Boolean(listenbrainzUser)}>{listenbrainzStatusMsg}</StatusMessage>
          )}
          <div className="flex items-center justify-between text-xs text-fg-muted">
            <span>{loc.settings.listenbrainzRequiresAccount}</span>
            <a
              href="https://listenbrainz.org/profile"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-listenbrainz no-underline"
            >
              {loc.settings.listenbrainzGetToken} <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </SettingRow>
    </SettingsGroup>
  );
};
