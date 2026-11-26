import React, { useId, useState } from 'react';
import {
  Save,
  Download,
  Upload,
  Headphones,
  Zap,
  Radio,
  Flame,
  ExternalLink,
  CheckCircle,
  BrandDiscord,
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  Loader2,
} from '../../components/ui/icons';
import {
  Badge,
  Button,
  Card,
  Chip,
  FieldLabel,
  SectionHeader,
  SliderRow,
  StatusDot,
  TextField,
  ToggleCard,
} from '../../components/ui';
import { type Language, type Translations } from '../../i18n';
import type { CoverSyncProgress } from '../../types/library';
import { fmt } from '../../utils/fmt';
import { cn } from '../../utils/cn';
import { SettingsPage } from './SettingsPage';

const DEFAULT_DISCORD_CLIENT_ID = '1563876157387186226';
const CROSSFADE_PRESETS_MS = [0, 1000, 1500, 3000, 5000] as const;

/** Result line under a credential test: green on success, red on failure. */
function StatusMessage({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div role="status" className={cn('text-ui font-semibold', ok ? 'text-accent-green' : 'text-accent-red')}>
      {children}
    </div>
  );
}

export interface BackupSettingsViewProps {
  language: Language;
  loc: Translations;
  onExportBackup: () => void;
  onImportBackup: () => void;
  closeToTray: boolean;
  onToggleCloseToTray: (enabled: boolean) => void;
  autoFetchCoversBg: boolean;
  onToggleAutoFetchCoversBg: (enabled: boolean) => void;
  onTriggerBackgroundCoverFetch: () => void;
  coverSyncProgress?: CoverSyncProgress;
  discordRpcEnabled: boolean;
  discordRpcConnected: boolean;
  discordClientId: string;
  onToggleDiscordRpc: (enabled: boolean) => void;
  onSaveDiscordClientId: (clientId: string) => void;
  crossfadeDuration: number;
  onCrossfadeDurationChange: (durationMs: number) => void;
  listenbrainzEnabled: boolean;
  listenbrainzToken: string;
  listenbrainzUser: string | null;
  listenbrainzStatusMsg: string | null;
  listenbrainzTesting: boolean;
  onToggleListenbrainz: (enabled: boolean) => void;
  onListenbrainzTokenChange: (token: string) => void;
  onTestListenbrainz: () => void;
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

export const BackupSettingsView: React.FC<BackupSettingsViewProps> = ({
  language: _language,
  loc,
  onExportBackup,
  onImportBackup,
  closeToTray,
  onToggleCloseToTray,
  autoFetchCoversBg,
  onToggleAutoFetchCoversBg,
  onTriggerBackgroundCoverFetch,
  coverSyncProgress,
  discordRpcEnabled,
  discordRpcConnected,
  discordClientId,
  onToggleDiscordRpc,
  onSaveDiscordClientId,
  crossfadeDuration,
  onCrossfadeDurationChange,
  listenbrainzEnabled,
  listenbrainzToken,
  listenbrainzUser,
  listenbrainzStatusMsg,
  listenbrainzTesting,
  onToggleListenbrainz,
  onListenbrainzTokenChange,
  onTestListenbrainz,
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
  const [discordClientIdInput, setDiscordClientIdInput] = useState(discordClientId);
  const [isEditingDiscordClientId, setIsEditingDiscordClientId] = useState(false);
  const [lastfmShowAdvanced, setLastfmShowAdvanced] = useState(false);
  const id = useId();

  const saveDiscordClientId = () => {
    onSaveDiscordClientId(discordClientIdInput);
    setIsEditingDiscordClientId(false);
  };

  return (
    <SettingsPage>
      {/* Profile backup */}
      <Card>
        <SectionHeader
          icon={<Save size={20} />}
          tone="purple"
          title={loc.settings.backupTitle}
          description={loc.settings.backupDesc}
        />
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="primary" onClick={onExportBackup}>
            <Download size={16} /> {loc.settings.exportBackupBtn}
          </Button>
          <Button onClick={onImportBackup}>
            <Upload size={16} className="text-accent-cyan" /> {loc.settings.importBackupBtn}
          </Button>
        </div>
      </Card>

      {/* Linux system tray */}
      <ToggleCard
        icon={<Headphones size={20} />}
        tone="cyan"
        title={loc.settings.closeToTray}
        description={loc.settings.closeToTrayDesc}
        checked={closeToTray}
        onChange={onToggleCloseToTray}
      />

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

      {/* Discord Rich Presence (RPC) */}
      <ToggleCard
        icon={<BrandDiscord size={20} className="text-discord" />}
        tone="purple"
        title={loc.settings.discordRpcTitle}
        badges={
          <Badge tone={discordRpcConnected ? 'green' : 'neutral'}>
            <StatusDot tone={discordRpcConnected ? 'green' : 'neutral'} className="size-1.5" />
            {discordRpcConnected ? loc.settings.discordConnected : loc.settings.discordDisconnected}
          </Badge>
        }
        description={loc.settings.discordRpcDesc}
        checked={discordRpcEnabled}
        onChange={onToggleDiscordRpc}
      >
        {discordRpcEnabled && (
          <Card variant="inset" padding="none" className="px-3.5 py-2.5 text-ui">
            <details>
              <summary className="cursor-pointer font-medium text-fg-muted select-none">
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
                    <Button variant="primary" onClick={saveDiscordClientId}>
                      {loc.common.save}
                    </Button>
                  )}
                </div>
              </div>
            </details>
          </Card>
        )}
      </ToggleCard>

      {/* Smooth crossfade between tracks */}
      <Card>
        <SectionHeader
          icon={<Zap size={20} />}
          tone="pink"
          title={loc.settings.crossfadeTitle}
          description={loc.settings.crossfadeDesc}
        />
        <Card variant="inset" padding="sm" className="mt-4 flex flex-col gap-3">
          <SliderRow
            label={
              crossfadeDuration === 0
                ? loc.settings.crossfadeDisabled
                : fmt(loc.settings.crossfadeTime, (crossfadeDuration / 1000).toFixed(2), String(crossfadeDuration))
            }
            ariaLabel={loc.settings.crossfadeTitle}
            min={0}
            max={8000}
            step={250}
            value={crossfadeDuration}
            format={(ms) => `${(ms / 1000).toFixed(2)} s`}
            onChange={onCrossfadeDurationChange}
          />
          <div className="flex flex-wrap gap-1.5">
            {CROSSFADE_PRESETS_MS.map((presetMs) => (
              <Chip
                key={presetMs}
                size="xs"
                pressed={crossfadeDuration === presetMs}
                onClick={() => onCrossfadeDurationChange(presetMs)}
              >
                {presetMs === 0 ? '0s (Off)' : `${presetMs / 1000}s`}
              </Chip>
            ))}
          </div>
        </Card>
      </Card>

      {/* ListenBrainz scrobbler (MetaBrainz ecosystem) */}
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

      {/* Last.fm scrobbler (official 2.0 API) */}
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
    </SettingsPage>
  );
};
