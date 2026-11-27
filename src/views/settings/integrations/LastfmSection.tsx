import React, { useId, useState } from 'react';
import { CheckCircle, ChevronDown, ChevronRight, ExternalLink, Flame } from '../../../components/ui/icons';
import { Badge, Button, Card, FieldLabel, StatusDot, TextField, ToggleCard } from '../../../components/ui';
import type { Translations } from '../../../i18n';
import { StatusMessage } from './StatusMessage';

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
  const [lastfmShowAdvanced, setLastfmShowAdvanced] = useState(false);
  const id = useId();

  return (
    <ToggleCard
      icon={<Flame size={20} className="text-lastfm" />}
      tone="red"
      title={loc.settings.lastfmTitle}
      badges={
        <>
          <Badge tone="red">API 2.0</Badge>
          {lastfmUsername && (
            <Badge tone="green">
              <StatusDot tone="green" className="size-1.5" /> ONLINE
            </Badge>
          )}
        </>
      }
      description={loc.settings.lastfmDesc}
      checked={lastfmEnabled}
      onChange={onToggleLastfm}
    >
      <Card variant="inset" padding="sm" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-fg">
            {lastfmUsername ? `${loc.settings.lastfmConnectedAs}: @${lastfmUsername}` : loc.settings.lastfmNotConnected}
          </span>
          <div className="flex gap-2">
            {!lastfmPendingToken ? (
              <Button variant="tinted" tone="red" disabled={lastfmTesting} onClick={onConnectLastfm}>
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
        </div>

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
            tone="red"
            disabled={lastfmTesting || !lastfmSessionKey.trim()}
            onClick={onValidateLastfmSession}
          >
            {lastfmTesting ? loc.settings.lastfmTesting : 'Test'}
          </Button>
        </div>

        {lastfmStatusMsg && <StatusMessage ok={Boolean(lastfmUsername)}>{lastfmStatusMsg}</StatusMessage>}

        <div>
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={lastfmShowAdvanced}
            onClick={() => setLastfmShowAdvanced(!lastfmShowAdvanced)}
            className="px-0"
          >
            {lastfmShowAdvanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />}{' '}
            {loc.settings.lastfmAdvancedKeys}
          </Button>

          {lastfmShowAdvanced && (
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
          )}
        </div>
      </Card>
    </ToggleCard>
  );
};
