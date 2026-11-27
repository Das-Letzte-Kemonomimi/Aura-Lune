import React, { useId, useState } from 'react';
import { Badge, Button, FieldLabel, SettingsGroup, StatusDot, TextField } from '../../../components/ui';
import type { Translations } from '../../../i18n';
import { ToggleRow } from '../ToggleRow';

const DEFAULT_DISCORD_CLIENT_ID = '1563876157387186226';

export interface DiscordSectionProps {
  loc: Translations;
  discordRpcEnabled: boolean;
  discordRpcConnected: boolean;
  discordClientId: string;
  onToggleDiscordRpc: (enabled: boolean) => void;
  onSaveDiscordClientId: (clientId: string) => void;
}

/** Discord Rich Presence toggle with the advanced client id override. */
export const DiscordSection: React.FC<DiscordSectionProps> = ({
  loc,
  discordRpcEnabled,
  discordRpcConnected,
  discordClientId,
  onToggleDiscordRpc,
  onSaveDiscordClientId,
}) => {
  const [discordClientIdInput, setDiscordClientIdInput] = useState(discordClientId);
  const [isEditingDiscordClientId, setIsEditingDiscordClientId] = useState(false);
  const id = useId();

  const saveDiscordClientId = () => {
    onSaveDiscordClientId(discordClientIdInput);
    setIsEditingDiscordClientId(false);
  };

  return (
    <SettingsGroup
      label="Discord"
      actions={
        <Badge tone={discordRpcConnected ? 'green' : 'neutral'}>
          <StatusDot tone={discordRpcConnected ? 'green' : 'neutral'} className="size-1.5" />
          {discordRpcConnected ? loc.settings.discordConnected : loc.settings.discordDisconnected}
        </Badge>
      }
    >
      <ToggleRow
        title={loc.settings.discordRpcTitle}
        description={loc.settings.discordRpcDesc}
        checked={discordRpcEnabled}
        onChange={onToggleDiscordRpc}
      >
        {discordRpcEnabled && (
          <details>
            <summary className="cursor-pointer text-xs font-semibold text-fg-muted select-none">
              {loc.settings.discordAdvancedClientId}
            </summary>
            <div className="mt-2.5">
              <div className="mb-2 flex items-center justify-between">
                <FieldLabel htmlFor={`${id}-discord`} className="mb-0">
                  {loc.settings.discordClientIdLabel}
                </FieldLabel>
                {discordClientId !== DEFAULT_DISCORD_CLIENT_ID && (
                  <Button variant="ghost" size="sm" onClick={() => onSaveDiscordClientId(DEFAULT_DISCORD_CLIENT_ID)}>
                    {loc.settings.discordClientIdDefaultBtn}
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <TextField
                  id={`${id}-discord`}
                  mono
                  value={discordClientIdInput}
                  onChange={(e) => {
                    setDiscordClientIdInput(e.target.value);
                    setIsEditingDiscordClientId(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveDiscordClientId();
                  }}
                  placeholder={DEFAULT_DISCORD_CLIENT_ID}
                />
                {isEditingDiscordClientId && discordClientIdInput !== discordClientId && (
                  <Button variant="tinted" tone="purple" onClick={saveDiscordClientId}>
                    {loc.common.save}
                  </Button>
                )}
              </div>
            </div>
          </details>
        )}
      </ToggleRow>
    </SettingsGroup>
  );
};
