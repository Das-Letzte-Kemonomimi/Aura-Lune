import React, { useId } from 'react';
import { ExternalLink, Radio } from '../../../components/ui/icons';
import { Badge, Button, Card, FieldLabel, TextField, ToggleCard } from '../../../components/ui';
import type { Translations } from '../../../i18n';
import { StatusMessage } from './StatusMessage';

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
    <ToggleCard
      icon={<Radio size={20} className="text-listenbrainz" />}
      tone="amber"
      title={loc.settings.listenbrainzTitle}
      badges={<Badge tone="amber">OPEN SOURCE</Badge>}
      description={loc.settings.listenbrainzDesc}
      checked={listenbrainzEnabled}
      onChange={onToggleListenbrainz}
    >
      <Card variant="inset" padding="sm" className="flex flex-col gap-2.5">
        <FieldLabel htmlFor={`${id}-lb-token`} className="mb-0">
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
            tone="amber"
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
      </Card>
    </ToggleCard>
  );
};
