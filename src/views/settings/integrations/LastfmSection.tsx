import React, { useId } from 'react';
import { CheckCircle, ExternalLink } from '../../../components/ui/icons';
import { Badge, Button, FieldLabel, SettingRow, SettingsGroup, StatusDot, TextField } from '../../../components/ui';
import type { Translations } from '../../../i18n';
import { StatusMessage } from './StatusMessage';
import { ToggleRow } from '../ToggleRow';

export interface LastfmSectionProps {
  loc: Translations;
  lastfmEnabled: boolean;
  lastfmUsername: string | null;
  lastfmSessionKey: string;
  lastfmPendingToken: string | null;
  lastfmTesting: boolean;
  lastfmStatusMsg: string | null;
  lastfmCustomKey: string;
  lastfmCustomSecret: string;
  onToggleLastfm: (enabled: boolean) => void;
  onConnectLastfm: () => void;
  onConfirmLastfmAuth: () => void;
  onDisconnectLastfm: () => void;
  onManualLastfmSessionKeyChange: (key: string) => void;
  onValidateLastfmSession: () => void;
  onSaveLastfmCustomKeys: (key: string, secret: string) => void;
}

/** Last.fm scrobbler (official 2.0 API). */
export const LastfmSection: React.FC<LastfmSectionProps> = ({
  loc,
  lastfmEnabled,
  lastfmUsername,
  lastfmSessionKey,
  lastfmPendingToken,
  lastfmTesting,
  lastfmStatusMsg,
  lastfmCustomKey,
  lastfmCustomSecret,
  onToggleLastfm,
  onConnectLastfm,
  onConfirmLastfmAuth,
  onDisconnectLastfm,
  onManualLastfmSessionKeyChange,
  onValidateLastfmSession,
  onSaveLastfmCustomKeys,
}) => {
  const id = useId();

  return (
    <SettingsGroup
      label="Last.fm"
      actions={
        lastfmUsername && (
          <Badge tone="green">
            <StatusDot tone="green" className="size-1.5" /> {loc.settings.lastfmOnline}
          </Badge>
        )
      }
    >
      <ToggleRow
        title={loc.settings.lastfmTitle}
        description={loc.settings.lastfmDesc}
        checked={lastfmEnabled}
        onChange={onToggleLastfm}
      />

      <SettingRow
        compact
        title={lastfmUsername ? `${loc.settings.lastfmConnectedAs}: @${lastfmUsername}` : loc.settings.lastfmNotConnected}
        control={
          <div className="flex flex-wrap justify-end gap-2">
            {!lastfmPendingToken ? (
              <Button variant="tinted" tone="cyan" disabled={lastfmTesting} onClick={onConnectLastfm}>
                <ExternalLink size={16} />
                {loc.settings.lastfmConnectBtn}
              </Button>
            ) : (
              <Button variant="tinted" tone="green" disabled={lastfmTesting} onClick={onConfirmLastfmAuth}>
                <CheckCircle size={16} />
                {loc.settings.lastfmConfirmAuthBtn}
              </Button>
            )}
            {lastfmSessionKey && (
              <Button variant="danger" onClick={onDisconnectLastfm}>
                {loc.settings.lastfmDisconnectBtn}
              </Button>
            )}
          </div>
        }
      >
        <div className="flex flex-col gap-2.5">
          <div className="flex gap-2">
            <TextField
              type="password"
              aria-label={loc.settings.lastfmSessionKeyPlaceholder}
              placeholder={loc.settings.lastfmSessionKeyPlaceholder}
              value={lastfmSessionKey}
              onChange={(e) => onManualLastfmSessionKeyChange(e.target.value)}
            />
            <Button
              variant="tinted"
              tone="cyan"
              disabled={lastfmTesting || !lastfmSessionKey.trim()}
              onClick={onValidateLastfmSession}
            >
              {lastfmTesting ? loc.settings.lastfmTesting : loc.settings.lastfmTest}
            </Button>
          </div>
          {lastfmStatusMsg && <StatusMessage ok={Boolean(lastfmUsername)}>{lastfmStatusMsg}</StatusMessage>}
        </div>
      </SettingRow>

      <SettingRow compact title={loc.settings.group.advanced}>
        <details>
          <summary className="cursor-pointer text-xs font-semibold text-fg-muted select-none">
            {loc.settings.lastfmAdvancedKeys}
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            <div>
              <FieldLabel htmlFor={`${id}-lf-key`}>{loc.settings.lastfmCustomApiKey}</FieldLabel>
              <TextField
                id={`${id}-lf-key`}
                size="sm"
                placeholder={loc.settings.apiKeyDefaultPlaceholder}
                value={lastfmCustomKey}
                onChange={(e) => onSaveLastfmCustomKeys(e.target.value, lastfmCustomSecret)}
              />
            </div>
            <div>
              <FieldLabel htmlFor={`${id}-lf-secret`}>{loc.settings.lastfmCustomApiSecret}</FieldLabel>
              <TextField
                id={`${id}-lf-secret`}
                type="password"
                size="sm"
                placeholder={loc.settings.apiSecretDefaultPlaceholder}
                value={lastfmCustomSecret}
                onChange={(e) => onSaveLastfmCustomKeys(lastfmCustomKey, e.target.value)}
              />
            </div>
          </div>
        </details>
      </SettingRow>
    </SettingsGroup>
  );
};
