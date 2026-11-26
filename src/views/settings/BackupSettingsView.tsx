import React, { useState } from 'react';
import { Save, Download, Upload, Headphones, Zap, Radio, Flame, ExternalLink, CheckCircle, BrandDiscord, ChevronDown, ChevronRight, PointFilled } from '../../components/ui/icons';
import { type Language, type Translations } from '../../i18n';
import { fmt } from '../../utils/fmt';
import { cn } from '../../utils/cn';

export interface BackupSettingsViewProps {
  language: Language;
  loc: Translations;
  onExportBackup: () => void;
  onImportBackup: () => void;
  closeToTray: boolean;
  onToggleCloseToTray: (enabled: boolean) => void;
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

  return (
    <div className="flex flex-col gap-5">
      {/* Profile backup section */}
      <div className="glass-card rounded-2xl p-6">
        <div className="mb-3 flex items-center gap-2.5">
          <div className="rounded-lg bg-accent-purple/20 p-2">
            <Save size={20} className="text-accent-purple" />
          </div>
          <div>
            <h3 className="m-0 text-base font-bold">{loc.settings.backupTitle}</h3>
            <p className="mx-0 mt-1 mb-0 text-ui text-fg-muted">
              {loc.settings.backupDesc}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={onExportBackup}
            className="flex items-center gap-2 rounded-xl border-0 bg-accent-gradient px-4.5 py-2.5 text-sm font-semibold text-on-accent"
          >
            <Download size={16} /> {loc.settings.exportBackupBtn}
          </button>

          <button
            onClick={onImportBackup}
            className="flex items-center gap-2 rounded-xl border border-line bg-white/8 px-4.5 py-2.5 text-sm font-semibold text-fg"
          >
            <Upload size={16} className="text-accent-cyan" /> {loc.settings.importBackupBtn}
          </button>
        </div>
      </div>

      {/* Linux system tray section */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-accent-cyan/20 p-2">
              <Headphones size={20} className="text-accent-cyan" />
            </div>
            <div>
              <h3 className="m-0 text-base font-bold">{loc.settings.closeToTray}</h3>
              <p className="mx-0 mt-1 mb-0 text-ui text-fg-muted">
                {loc.settings.closeToTrayDesc}
              </p>
            </div>
          </div>

          <label className="relative inline-block h-6 w-11">
            <input
              type="checkbox"
              checked={closeToTray}
              onChange={(e) => onToggleCloseToTray(e.target.checked)}
              className="h-0 w-0 opacity-0"
            />
            <span
              className={cn(
                'transition-all duration-300',
                'absolute inset-0 cursor-pointer rounded-3xl',
                closeToTray ? 'bg-accent-purple' : 'bg-white/20',
              )}
            >
              <span
                className={cn(
                  'transition-all duration-300',
                  'absolute bottom-1 h-4.5 w-4.5 rounded-full bg-white',
                  closeToTray ? 'left-6' : 'left-1',
                )}
              />
            </span>
          </label>
        </div>
      </div>

      {/* Discord Rich Presence (RPC) section */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9.5 w-9.5 items-center justify-center rounded-xl border border-discord/40 bg-discord/25"
            >
              <BrandDiscord size={22} className="text-discord" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="m-0 text-base font-bold">{loc.settings.discordRpcTitle}</h3>
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-xl border px-2 py-0.5 text-xs font-semibold',
                    discordRpcConnected ? 'bg-green-500/15' : 'bg-white/8',
                    discordRpcConnected ? 'text-green-400' : 'text-fg-muted',
                    discordRpcConnected ? 'border-green-500/30' : 'border-white/10',
                  )}
                >
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      discordRpcConnected ? 'bg-green-500' : 'bg-white/40',
                      discordRpcConnected ? 'shadow-halo-sm shadow-green-500' : 'shadow-none',
                    )}
                  />
                  {discordRpcConnected ? loc.settings.discordConnected : loc.settings.discordDisconnected}
                </span>
              </div>
              <p className="mx-0 mt-1 mb-0 text-ui text-fg-muted">
                {loc.settings.discordRpcDesc}
              </p>
            </div>
          </div>

          <label className="relative inline-block h-6 w-11">
            <input
              type="checkbox"
              checked={discordRpcEnabled}
              onChange={(e) => onToggleDiscordRpc(e.target.checked)}
              className="h-0 w-0 opacity-0"
            />
            <span
              className={cn(
                'absolute inset-0 cursor-pointer rounded-3xl transition-all duration-300',
                discordRpcEnabled ? 'bg-discord' : 'bg-white/20',
              )}
            >
              <span
                className={cn(
                  'transition-all duration-300',
                  'absolute bottom-1 h-4.5 w-4.5 rounded-full bg-white',
                  discordRpcEnabled ? 'left-6' : 'left-1',
                )}
              />
            </span>
          </label>
        </div>

        {discordRpcEnabled && (
          <details className="mt-3.5 rounded-xl border border-discord/15 bg-black/20 px-3.5 py-2.5 text-ui">
            <summary className="flex cursor-pointer select-none items-center gap-1.5 font-medium text-fg-muted">
              <span>{loc.settings.discordAdvancedClientId}</span>
            </summary>
            <div className="mt-2.5">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-ui font-semibold text-fg-muted">
                  {loc.settings.discordClientIdLabel}
                </span>
                {discordClientId !== '1563876157387186226' && (
                  <button
                    onClick={() => onSaveDiscordClientId('1563876157387186226')}
                    className="border-0 bg-transparent p-0 text-xs text-accent-pink underline"
                  >
                    {loc.settings.discordClientIdDefaultBtn}
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={discordClientIdInput}
                  onChange={(e) => {
                    setDiscordClientIdInput(e.target.value);
                    setIsEditingDiscordClientId(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onSaveDiscordClientId(discordClientIdInput);
                      setIsEditingDiscordClientId(false);
                    }
                  }}
                  placeholder="1563876157387186226"
                  className="flex-1 rounded-lg border border-white/15 bg-field/95 px-3 py-2 font-mono text-sm text-fg"
                />
                {isEditingDiscordClientId && discordClientIdInput !== discordClientId && (
                  <button
                    onClick={() => {
                      onSaveDiscordClientId(discordClientIdInput);
                      setIsEditingDiscordClientId(false);
                    }}
                    className="border-discord bg-discord px-4 py-0 text-ui btn btn-primary"
                  >
                    Zapisz
                  </button>
                )}
              </div>
            </div>
          </details>
        )}
      </div>

      {/* Smooth crossfade section (Poweramp style) */}
      <div className="glass-card rounded-2xl p-6">
        <div className="mb-3.5 flex items-center gap-2.5">
          <div className="rounded-lg bg-accent-pink/20 p-2">
            <Zap size={20} className="text-accent-pink" />
          </div>
          <div>
            <h3 className="m-0 text-base font-bold">{loc.settings.crossfadeTitle}</h3>
            <p className="mx-0 mt-1 mb-0 text-ui text-fg-muted">
              {loc.settings.crossfadeDesc}
            </p>
          </div>
        </div>

        <div className="mt-3 rounded-xl bg-black/25 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-fg">
              {crossfadeDuration === 0
                ? loc.settings.crossfadeDisabled
                : fmt(loc.settings.crossfadeTime, (crossfadeDuration / 1000).toFixed(2), String(crossfadeDuration))}
            </span>
            <div className="flex gap-1.5">
              {[0, 1000, 1500, 3000, 5000].map((presetMs) => (
                <button
                  key={presetMs}
                  onClick={() => onCrossfadeDurationChange(presetMs)}
                  className={cn(
                    'rounded-md border px-2 py-1 text-xxs font-semibold',
                    crossfadeDuration === presetMs ? 'bg-accent-pink/30' : 'bg-white/6',
                    crossfadeDuration === presetMs ? 'border-accent-pink' : 'border-line',
                    crossfadeDuration === presetMs ? 'text-accent-pink' : 'text-fg-muted',
                  )}
                >
                  {presetMs === 0 ? '0s (Off)' : `${presetMs / 1000}s`}
                </button>
              ))}
            </div>
          </div>

          <input
            type="range"
            min={0}
            max={8000}
            step={250}
            value={crossfadeDuration}
            onChange={(e) => onCrossfadeDurationChange(Number(e.target.value))}
            className="w-full cursor-pointer"
          />
        </div>
      </div>

      {/* ListenBrainz Scrobbler section (MetaBrainz ecosystem) */}
      <div className="glass-card rounded-2xl p-6">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-listenbrainz/20 p-2">
              <Radio size={20} className="text-listenbrainz" />
            </div>
            <div>
              <h3 className="m-0 flex items-center gap-1.5 text-base font-bold">
                {loc.settings.listenbrainzTitle}
                <span className="rounded-sm bg-listenbrainz/20 px-1.5 py-0.5 text-xxs font-bold text-listenbrainz">
                  OPEN SOURCE
                </span>
              </h3>
              <p className="mx-0 mt-1 mb-0 text-ui text-fg-muted">
                {loc.settings.listenbrainzDesc}
              </p>
            </div>
          </div>

          <label className="relative inline-block h-6 w-11">
            <input
              type="checkbox"
              checked={listenbrainzEnabled}
              onChange={(e) => onToggleListenbrainz(e.target.checked)}
              className="h-0 w-0 opacity-0"
            />
            <span
              className={cn(
                'absolute inset-0 cursor-pointer rounded-3xl transition-all duration-300',
                listenbrainzEnabled ? 'bg-listenbrainz' : 'bg-white/20',
              )}
            >
              <span
                className={cn(
                  'transition-all duration-300',
                  'absolute bottom-1 h-4.5 w-4.5 rounded-full bg-white',
                  listenbrainzEnabled ? 'left-6' : 'left-1',
                )}
              />
            </span>
          </label>
        </div>

        <div className="flex flex-col gap-2.5 rounded-xl bg-black/25 p-4">
          <label className="text-ui font-semibold text-slate-200">
            {loc.settings.listenbrainzToken}
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              placeholder={loc.settings.listenbrainzTokenPlaceholder}
              value={listenbrainzToken}
              onChange={(e) => onListenbrainzTokenChange(e.target.value)}
              className="flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-2.5 text-ui text-fg outline-none"
            />
            <button
              type="button"
              disabled={listenbrainzTesting || !listenbrainzToken.trim()}
              onClick={onTestListenbrainz}
              className={cn(
                'border border-listenbrainz/50 bg-listenbrainz/25',
                'rounded-lg px-4 py-0 text-ui font-semibold whitespace-nowrap text-fg',
                listenbrainzTesting || !listenbrainzToken.trim() ? 'cursor-not-allowed' : 'cursor-pointer',
                listenbrainzTesting || !listenbrainzToken.trim() ? 'opacity-60' : 'opacity-100',
              )}
            >
              {listenbrainzTesting ? loc.settings.listenbrainzTesting : loc.settings.listenbrainzTest}
            </button>
          </div>

          {listenbrainzStatusMsg && (
            <div
              className={cn(
                'mt-1 text-ui font-semibold',
                listenbrainzUser ? 'text-green-400' : 'text-red-400',
              )}
            >
              {listenbrainzStatusMsg}
            </div>
          )}

          <div className="mt-1.5 flex items-center justify-between text-xs text-fg-muted">
            <span>{loc.settings.listenbrainzRequiresAccount}</span>
            <a
              href="https://listenbrainz.org/profile"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-listenbrainz no-underline"
            >
              {loc.settings.listenbrainzGetToken} <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>

      {/* Last.fm Scrobbler section (official 2.0 API) */}
      <div className="glass-card rounded-2xl p-6">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-lastfm/20 p-2">
              <Flame size={20} className="text-lastfm" />
            </div>
            <div>
              <h3 className="m-0 flex items-center gap-1.5 text-base font-bold">
                {loc.settings.lastfmTitle}
                <span className="rounded-sm bg-lastfm/20 px-1.5 py-0.5 text-xxs font-bold text-lastfm">
                  API 2.0
                </span>
                {lastfmUsername && (
                  <span className="rounded-sm bg-green-500/20 px-1.5 py-0.5 text-xxs font-bold text-green-400">
                    <PointFilled size={10} className="icon-inline" /> ONLINE
                  </span>
                )}
              </h3>
              <p className="mx-0 mt-1 mb-0 text-ui text-fg-muted">
                {loc.settings.lastfmDesc}
              </p>
            </div>
          </div>

          <label className="relative inline-block h-6 w-11">
            <input
              type="checkbox"
              checked={lastfmEnabled}
              onChange={(e) => onToggleLastfm(e.target.checked)}
              className="h-0 w-0 opacity-0"
            />
            <span
              className={cn(
                'absolute inset-0 cursor-pointer rounded-3xl transition-all duration-300',
                lastfmEnabled ? 'bg-lastfm' : 'bg-white/20',
              )}
            >
              <span
                className={cn(
                  'transition-all duration-300',
                  'absolute bottom-1 h-4.5 w-4.5 rounded-full bg-white',
                  lastfmEnabled ? 'left-6' : 'left-1',
                )}
              />
            </span>
          </label>
        </div>

        <div className="flex flex-col gap-3 rounded-xl bg-black/25 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-200">
                {lastfmUsername ? `${loc.settings.lastfmConnectedAs}: @${lastfmUsername}` : loc.settings.lastfmNotConnected}
              </span>
            </div>
            <div className="flex gap-2">
              {!lastfmPendingToken ? (
                <button
                  type="button"
                  disabled={lastfmTesting}
                  onClick={onConnectLastfm}
                  className={cn(
                    'border border-lastfm/50 bg-lastfm/25',
                    'flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-ui font-semibold text-fg',
                    lastfmTesting ? 'cursor-not-allowed' : 'cursor-pointer',
                  )}
                >
                  <ExternalLink size={14} />
                  {loc.settings.lastfmConnectBtn}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={lastfmTesting}
                  onClick={onConfirmLastfmAuth}
                  className="flex items-center gap-1.5 rounded-lg border border-green-500/60 bg-green-500/30 px-3.5 py-2 text-ui font-bold text-green-400"
                >
                  <CheckCircle size={14} />
                  {loc.settings.lastfmConfirmAuthBtn}
                </button>
              )}

              {lastfmSessionKey && (
                <button
                  type="button"
                  onClick={onDisconnectLastfm}
                  className="rounded-lg border border-accent-red/30 bg-accent-red/15 px-3.5 py-2 text-ui text-red-400"
                >
                  {loc.settings.lastfmDisconnectBtn}
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="password"
              placeholder={loc.settings.lastfmSessionKeyPlaceholder}
              value={lastfmSessionKey}
              onChange={(e) => onManualLastfmSessionKeyChange(e.target.value)}
              className="flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-2.5 text-ui text-fg outline-none"
            />
            <button
              type="button"
              disabled={lastfmTesting || !lastfmSessionKey.trim()}
              onClick={onValidateLastfmSession}
              className={cn(
                'border border-lastfm/50 bg-lastfm/25',
                'rounded-lg px-4 py-0 text-ui font-semibold whitespace-nowrap text-fg',
                lastfmTesting || !lastfmSessionKey.trim() ? 'cursor-not-allowed' : 'cursor-pointer',
                lastfmTesting || !lastfmSessionKey.trim() ? 'opacity-60' : 'opacity-100',
              )}
            >
              {lastfmTesting ? loc.settings.lastfmTesting : 'Test'}
            </button>
          </div>

          {lastfmStatusMsg && (
            <div
              className={cn(
                'mt-0.5 text-ui font-semibold',
                lastfmUsername ? 'text-green-400' : 'text-red-400',
              )}
            >
              {lastfmStatusMsg}
            </div>
          )}

          <div className="mt-1">
            <button
              type="button"
              onClick={() => setLastfmShowAdvanced(!lastfmShowAdvanced)}
              className="flex items-center gap-1 border-0 bg-transparent p-0 text-xs text-fg-muted"
            >
              {lastfmShowAdvanced ? <ChevronDown size={13} /> : <ChevronRight size={13} />} {loc.settings.lastfmAdvancedKeys}
            </button>

            {lastfmShowAdvanced && (
              <div className="mt-2.5 flex flex-col gap-2 rounded-lg bg-black/20 p-2.5">
                <div>
                  <label className="mb-1 block text-xxs text-fg-muted">
                    {loc.settings.lastfmCustomApiKey}
                  </label>
                  <input
                    type="text"
                    placeholder={loc.settings.apiKeyDefaultPlaceholder}
                    value={lastfmCustomKey}
                    onChange={(e) => onSaveLastfmCustomKeys(e.target.value, lastfmCustomSecret)}
                    className="w-full rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-fg outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xxs text-fg-muted">
                    {loc.settings.lastfmCustomApiSecret}
                  </label>
                  <input
                    type="password"
                    placeholder={loc.settings.apiSecretDefaultPlaceholder}
                    value={lastfmCustomSecret}
                    onChange={(e) => onSaveLastfmCustomKeys(lastfmCustomKey, e.target.value)}
                    className="w-full rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-fg outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
