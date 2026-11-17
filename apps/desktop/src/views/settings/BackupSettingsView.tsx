import React, { useState } from 'react';
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
} from 'lucide-react';
import { type Language, type Translations } from '../../i18n';

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Sekcja Kopia Zapasowa Profilu */}
      <div className="glass-card" style={{ padding: '24px', borderRadius: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(168, 85, 247, 0.2)' }}>
            <Save size={20} color="var(--accent-purple)" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>{loc.settings.backupTitle}</h3>
            <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {loc.settings.backupDesc}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '16px' }}>
          <button
            onClick={onExportBackup}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              border: 'none',
            }}
          >
            <Download size={16} /> {loc.settings.exportBackupBtn}
          </button>

          <button
            onClick={onImportBackup}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid var(--border-subtle)',
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
            }}
          >
            <Upload size={16} color="var(--accent-cyan)" /> {loc.settings.importBackupBtn}
          </button>
        </div>
      </div>

      {/* Sekcja Zasobnik Systemowy Linuksa */}
      <div className="glass-card" style={{ padding: '24px', borderRadius: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(6, 182, 212, 0.2)' }}>
              <Headphones size={20} color="var(--accent-cyan)" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>{loc.settings.closeToTray}</h3>
              <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {loc.settings.closeToTrayDesc}
              </p>
            </div>
          </div>

          <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px' }}>
            <input
              type="checkbox"
              checked={closeToTray}
              onChange={(e) => onToggleCloseToTray(e.target.checked)}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span
              style={{
                position: 'absolute',
                cursor: 'pointer',
                inset: 0,
                backgroundColor: closeToTray ? 'var(--accent-purple)' : 'rgba(255,255,255,0.2)',
                transition: '0.3s',
                borderRadius: '24px',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  content: '""',
                  height: '18px',
                  width: '18px',
                  left: closeToTray ? '23px' : '3px',
                  bottom: '3px',
                  backgroundColor: 'white',
                  transition: '0.3s',
                  borderRadius: '50%',
                }}
              />
            </span>
          </label>
        </div>
      </div>

      {/* Sekcja Discord Rich Presence (RPC) */}
      <div className="glass-card" style={{ padding: '24px', borderRadius: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'rgba(88, 101, 242, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(88, 101, 242, 0.4)',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 20 19" fill="#5865F2">
                <path d="M16.224 3.768a14.5 14.5 0 0 0-3.67-1.153c-.158.286-.343.67-.47.976a13.5 13.5 0 0 0-4.067 0c-.128-.306-.317-.69-.476-.976A14.4 14.4 0 0 0 3.868 3.77C1.546 7.28.916 10.703 1.231 14.077a14.7 14.7 0 0 0 4.5 2.306q.545-.748.965-1.587a9.5 9.5 0 0 1-1.518-.74q.191-.14.372-.293c2.927 1.369 6.107 1.369 8.999 0q.183.152.372.294-.723.437-1.52.74.418.838.963 1.588a14.6 14.6 0 0 0 4.504-2.308c.37-3.911-.63-7.302-2.644-10.309m-9.13 8.234c-.878 0-1.599-.82-1.599-1.82 0-.998.705-1.82 1.6-1.82.894 0 1.614.82 1.599 1.82.001 1-.705 1.82-1.6 1.82m5.91 0c-.878 0-1.599-.82-1.599-1.82 0-.998.705-1.82 1.6-1.82.893 0 1.614.82 1.599 1.82 0 1-.706 1.82-1.6 1.82" />
              </svg>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>{loc.settings.discordRpcTitle}</h3>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    background: discordRpcConnected
                      ? 'rgba(34, 197, 94, 0.15)'
                      : 'rgba(255, 255, 255, 0.08)',
                    color: discordRpcConnected ? '#4ade80' : 'var(--text-muted)',
                    border: `1px solid ${discordRpcConnected ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: discordRpcConnected ? '#22c55e' : 'rgba(255, 255, 255, 0.4)',
                      boxShadow: discordRpcConnected ? '0 0 8px #22c55e' : 'none',
                    }}
                  />
                  {discordRpcConnected ? loc.settings.discordConnected : loc.settings.discordDisconnected}
                </span>
              </div>
              <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {loc.settings.discordRpcDesc}
              </p>
            </div>
          </div>

          <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px' }}>
            <input
              type="checkbox"
              checked={discordRpcEnabled}
              onChange={(e) => onToggleDiscordRpc(e.target.checked)}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span
              style={{
                position: 'absolute',
                cursor: 'pointer',
                inset: 0,
                backgroundColor: discordRpcEnabled ? '#5865F2' : 'rgba(255,255,255,0.2)',
                transition: '0.3s',
                borderRadius: '24px',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  content: '""',
                  height: '18px',
                  width: '18px',
                  left: discordRpcEnabled ? '23px' : '3px',
                  bottom: '3px',
                  backgroundColor: 'white',
                  transition: '0.3s',
                  borderRadius: '50%',
                }}
              />
            </span>
          </label>
        </div>

        {discordRpcEnabled && (
          <details
            style={{
              marginTop: '14px',
              background: 'rgba(0,0,0,0.2)',
              padding: '10px 14px',
              borderRadius: '10px',
              border: '1px solid rgba(88, 101, 242, 0.15)',
              fontSize: '0.8rem',
            }}
          >
            <summary
              style={{
                cursor: 'pointer',
                userSelect: 'none',
                color: 'var(--text-muted)',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>{loc.settings.discordAdvancedClientId}</span>
            </summary>
            <div style={{ marginTop: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  {loc.settings.discordClientIdLabel}
                </span>
                {discordClientId !== '1563876157387186226' && (
                  <button
                    onClick={() => onSaveDiscordClientId('1563876157387186226')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent-pink)',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      padding: 0,
                    }}
                  >
                    {loc.settings.discordClientIdDefaultBtn}
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
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
                  style={{
                    flex: 1,
                    background: 'rgba(22, 26, 46, 0.95)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: '#fff',
                    fontSize: '0.85rem',
                    fontFamily: 'monospace',
                  }}
                />
                {isEditingDiscordClientId && discordClientIdInput !== discordClientId && (
                  <button
                    onClick={() => {
                      onSaveDiscordClientId(discordClientIdInput);
                      setIsEditingDiscordClientId(false);
                    }}
                    className="btn btn-primary"
                    style={{
                      padding: '0 16px',
                      fontSize: '0.8rem',
                      background: '#5865F2',
                      borderColor: '#5865F2',
                    }}
                  >
                    Zapisz
                  </button>
                )}
              </div>
            </div>
          </details>
        )}
      </div>

      {/* Sekcja Płynny Crossfade (Poweramp style) */}
      <div className="glass-card" style={{ padding: '24px', borderRadius: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(244, 63, 94, 0.2)' }}>
            <Zap size={20} color="var(--accent-pink)" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>{loc.settings.crossfadeTitle}</h3>
            <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {loc.settings.crossfadeDesc}
            </p>
          </div>
        </div>

        <div style={{ marginTop: '12px', background: 'rgba(0,0,0,0.25)', padding: '16px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>
              {crossfadeDuration === 0
                ? loc.settings.crossfadeDisabled
                : loc.settings.crossfadeTime
                    .replace('{0}', (crossfadeDuration / 1000).toFixed(2))
                    .replace('{1}', String(crossfadeDuration))}
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[0, 1000, 1500, 3000, 5000].map((presetMs) => (
                <button
                  key={presetMs}
                  onClick={() => onCrossfadeDurationChange(presetMs)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    background: crossfadeDuration === presetMs ? 'rgba(255, 77, 148, 0.3)' : 'rgba(255, 255, 255, 0.06)',
                    border: `1px solid ${crossfadeDuration === presetMs ? 'var(--accent-pink)' : 'var(--border-subtle)'}`,
                    color: crossfadeDuration === presetMs ? 'var(--accent-pink)' : 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
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
            style={{ width: '100%', cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* Sekcja ListenBrainz Scrobbler (MetaBrainz Ecosystem) */}
      <div className="glass-card" style={{ padding: '24px', borderRadius: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(235, 116, 34, 0.2)' }}>
              <Radio size={20} color="#eb7422" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                {loc.settings.listenbrainzTitle}
                <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(235, 116, 34, 0.2)', color: '#eb7422', fontWeight: 700 }}>
                  OPEN SOURCE
                </span>
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {loc.settings.listenbrainzDesc}
              </p>
            </div>
          </div>

          <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px' }}>
            <input
              type="checkbox"
              checked={listenbrainzEnabled}
              onChange={(e) => onToggleListenbrainz(e.target.checked)}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span
              style={{
                position: 'absolute',
                cursor: 'pointer',
                inset: 0,
                backgroundColor: listenbrainzEnabled ? '#eb7422' : 'rgba(255,255,255,0.2)',
                transition: '0.3s',
                borderRadius: '24px',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  content: '""',
                  height: '18px',
                  width: '18px',
                  left: listenbrainzEnabled ? '23px' : '3px',
                  bottom: '3px',
                  backgroundColor: 'white',
                  transition: '0.3s',
                  borderRadius: '50%',
                }}
              />
            </span>
          </label>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(0,0,0,0.25)', padding: '16px', borderRadius: '12px' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#e2e8f0' }}>
            {loc.settings.listenbrainzToken}
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="password"
              placeholder={loc.settings.listenbrainzTokenPlaceholder}
              value={listenbrainzToken}
              onChange={(e) => onListenbrainzTokenChange(e.target.value)}
              style={{
                flex: 1,
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(0,0,0,0.3)',
                color: '#fff',
                fontSize: '0.8rem',
                outline: 'none',
              }}
            />
            <button
              type="button"
              disabled={listenbrainzTesting || !listenbrainzToken.trim()}
              onClick={onTestListenbrainz}
              style={{
                padding: '0 16px',
                borderRadius: '8px',
                background: 'rgba(235, 116, 34, 0.25)',
                border: '1px solid rgba(235, 116, 34, 0.5)',
                color: '#fff',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: listenbrainzTesting || !listenbrainzToken.trim() ? 'not-allowed' : 'pointer',
                opacity: listenbrainzTesting || !listenbrainzToken.trim() ? 0.6 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {listenbrainzTesting ? loc.settings.listenbrainzTesting : loc.settings.listenbrainzTest}
            </button>
          </div>

          {listenbrainzStatusMsg && (
            <div
              style={{
                fontSize: '0.8rem',
                color: listenbrainzUser ? '#4ade80' : '#f87171',
                marginTop: '4px',
                fontWeight: 600,
              }}
            >
              {listenbrainzStatusMsg}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span>{loc.settings.listenbrainzRequiresAccount}</span>
            <a
              href="https://listenbrainz.org/profile"
              target="_blank"
              rel="noreferrer"
              style={{ color: '#eb7422', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              {loc.settings.listenbrainzGetToken} <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>

      {/* Sekcja Last.fm Scrobbler (Official 2.0 API) */}
      <div className="glass-card" style={{ padding: '24px', borderRadius: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(213, 16, 7, 0.2)' }}>
              <Flame size={20} color="#d51007" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                {loc.settings.lastfmTitle}
                <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(213, 16, 7, 0.2)', color: '#d51007', fontWeight: 700 }}>
                  API 2.0
                </span>
                {lastfmUsername && (
                  <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80', fontWeight: 700 }}>
                    ● ONLINE
                  </span>
                )}
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {loc.settings.lastfmDesc}
              </p>
            </div>
          </div>

          <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px' }}>
            <input
              type="checkbox"
              checked={lastfmEnabled}
              onChange={(e) => onToggleLastfm(e.target.checked)}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span
              style={{
                position: 'absolute',
                cursor: 'pointer',
                inset: 0,
                backgroundColor: lastfmEnabled ? '#d51007' : 'rgba(255,255,255,0.2)',
                transition: '0.3s',
                borderRadius: '24px',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  content: '""',
                  height: '18px',
                  width: '18px',
                  left: lastfmEnabled ? '23px' : '3px',
                  bottom: '3px',
                  backgroundColor: 'white',
                  transition: '0.3s',
                  borderRadius: '50%',
                }}
              />
            </span>
          </label>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(0,0,0,0.25)', padding: '16px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0' }}>
                {lastfmUsername ? `${loc.settings.lastfmConnectedAs}: @${lastfmUsername}` : loc.settings.lastfmNotConnected}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {!lastfmPendingToken ? (
                <button
                  type="button"
                  disabled={lastfmTesting}
                  onClick={onConnectLastfm}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '8px',
                    background: 'rgba(213, 16, 7, 0.25)',
                    border: '1px solid rgba(213, 16, 7, 0.5)',
                    color: '#fff',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: lastfmTesting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <ExternalLink size={14} />
                  {loc.settings.lastfmConnectBtn}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={lastfmTesting}
                  onClick={onConfirmLastfmAuth}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '8px',
                    background: 'rgba(34, 197, 94, 0.3)',
                    border: '1px solid rgba(34, 197, 94, 0.6)',
                    color: '#4ade80',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <CheckCircle size={14} />
                  {loc.settings.lastfmConfirmAuthBtn}
                </button>
              )}

              {lastfmSessionKey && (
                <button
                  type="button"
                  onClick={onDisconnectLastfm}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#f87171',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  {loc.settings.lastfmDisconnectBtn}
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="password"
              placeholder={loc.settings.lastfmSessionKeyPlaceholder}
              value={lastfmSessionKey}
              onChange={(e) => onManualLastfmSessionKeyChange(e.target.value)}
              style={{
                flex: 1,
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(0,0,0,0.3)',
                color: '#fff',
                fontSize: '0.8rem',
                outline: 'none',
              }}
            />
            <button
              type="button"
              disabled={lastfmTesting || !lastfmSessionKey.trim()}
              onClick={onValidateLastfmSession}
              style={{
                padding: '0 16px',
                borderRadius: '8px',
                background: 'rgba(213, 16, 7, 0.25)',
                border: '1px solid rgba(213, 16, 7, 0.5)',
                color: '#fff',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: lastfmTesting || !lastfmSessionKey.trim() ? 'not-allowed' : 'pointer',
                opacity: lastfmTesting || !lastfmSessionKey.trim() ? 0.6 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {lastfmTesting ? loc.settings.lastfmTesting : 'Test'}
            </button>
          </div>

          {lastfmStatusMsg && (
            <div
              style={{
                fontSize: '0.8rem',
                color: lastfmUsername ? '#4ade80' : '#f87171',
                marginTop: '2px',
                fontWeight: 600,
              }}
            >
              {lastfmStatusMsg}
            </div>
          )}

          <div style={{ marginTop: '4px' }}>
            <button
              type="button"
              onClick={() => setLastfmShowAdvanced(!lastfmShowAdvanced)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: '0.75rem',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              {lastfmShowAdvanced ? '▼' : '▶'} {loc.settings.lastfmAdvancedKeys}
            </button>

            {lastfmShowAdvanced && (
              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)' }}>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                    {loc.settings.lastfmCustomApiKey}
                  </label>
                  <input
                    type="text"
                    placeholder={loc.settings.apiKeyDefaultPlaceholder}
                    value={lastfmCustomKey}
                    onChange={(e) => onSaveLastfmCustomKeys(e.target.value, lastfmCustomSecret)}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(0,0,0,0.3)',
                      color: '#fff',
                      fontSize: '0.75rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                    {loc.settings.lastfmCustomApiSecret}
                  </label>
                  <input
                    type="password"
                    placeholder={loc.settings.apiSecretDefaultPlaceholder}
                    value={lastfmCustomSecret}
                    onChange={(e) => onSaveLastfmCustomKeys(lastfmCustomKey, e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(0,0,0,0.3)',
                      color: '#fff',
                      fontSize: '0.75rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
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
