import React from 'react';
import { ChevronDown, ChevronUp, Download, ExternalLink, RefreshCw, RotateCw } from 'lucide-react';
import { errorMessage, invoke } from '../../api/ipc';
import { type Language, type Translations } from '../../i18n';
import type { BuildInfo, InstallKind, UpdateInfo, UpdateProgress } from '../../types/updates';
import { fmt } from '../../utils/fmt';
import { ToggleSwitch } from '../../components/common/ToggleSwitch';
import { MarkdownText } from '../../components/common/MarkdownText';
import { ChangelogView } from '../changelog/ChangelogView';

export interface UpdatesSettingsViewProps {
  language: Language;
  loc: Translations;
  buildInfo: BuildInfo | null;
  info: UpdateInfo | null;
  checking: boolean;
  installing: boolean;
  installed: boolean;
  progress: UpdateProgress | null;
  error: string | null;
  isSkipped: boolean;
  autoCheckEnabled: boolean;
  onCheckNow: () => void;
  onInstall: () => void;
  onRestart: () => void;
  onSkip: () => void;
  onToggleAutoCheck: (enabled: boolean) => void;
}

const CARD: React.CSSProperties = { padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' };
const LABEL: React.CSSProperties = {
  fontSize: '0.72rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--text-muted)',
  fontWeight: 700,
};
const BUTTON: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: '8px',
  fontSize: '0.8rem',
  fontWeight: 700,
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  cursor: 'pointer',
  border: '1px solid var(--border-subtle)',
  background: 'rgba(255, 255, 255, 0.06)',
  color: 'var(--accent-cyan)',
};
const PRIMARY_BUTTON: React.CSSProperties = {
  ...BUTTON,
  border: 'none',
  background: 'linear-gradient(135deg, var(--accent-pink), var(--accent-purple))',
  color: '#fff',
};

function kindLabel(loc: Translations, kind: InstallKind): string {
  switch (kind) {
    case 'app_image_managed':
      return loc.updates.kindManaged;
    case 'app_image_other':
      return loc.updates.kindOther;
    case 'system':
      return loc.updates.kindSystem;
    case 'dev_server':
      return loc.updates.kindDevServer;
  }
}

function notice(loc: Translations, kind: InstallKind): string | null {
  switch (kind) {
    case 'system':
      return loc.updates.noticeSystem;
    case 'app_image_other':
      return loc.updates.noticeOther;
    case 'dev_server':
      return loc.updates.noticeDevServer;
    case 'app_image_managed':
      return null;
  }
}

export const UpdatesSettingsView: React.FC<UpdatesSettingsViewProps> = ({
  language,
  loc,
  buildInfo,
  info,
  checking,
  installing,
  installed,
  progress,
  error,
  isSkipped,
  autoCheckEnabled,
  onCheckNow,
  onInstall,
  onRestart,
  onSkip,
  onToggleAutoCheck,
}) => {
  const [linkError, setLinkError] = React.useState<string | null>(null);
  const [notesExpanded, setNotesExpanded] = React.useState(false);
  const t = loc.updates;
  const available = !!info?.available;
  const installKind = buildInfo?.install_kind ?? info?.install_kind ?? 'system';
  const percent =
    progress?.total && progress.total > 0
      ? Math.min(100, Math.floor((progress.downloaded / progress.total) * 100))
      : 0;
  const lastChecked = info?.checked_at
    ? new Date(info.checked_at * 1000).toLocaleString(language)
    : t.never;
  const channelLabel = buildInfo?.channel === 'dev' ? t.channelDev : t.channelStable;
  const installNotice = info?.can_install ? null : notice(loc, installKind);

  const openLink = async (url: string) => {
    setLinkError(null);
    try {
      await invoke('open_external_url', { url });
    } catch (e: unknown) {
      setLinkError(errorMessage(e));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '750px', margin: '0 auto' }}>
      <div className="glass-card" style={CARD}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>{t.title}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <div>
            <div style={LABEL}>{t.currentVersion}</div>
            <div style={{ fontWeight: 700 }}>v{buildInfo?.version ?? '…'}</div>
          </div>
          <div>
            <div style={LABEL}>{t.channel}</div>
            <div style={{ fontWeight: 700 }}>{channelLabel}</div>
          </div>
          <div>
            <div style={LABEL}>{t.commit}</div>
            <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{buildInfo?.commit_short ?? '…'}</div>
          </div>
          <div>
            <div style={LABEL}>{t.installKind}</div>
            <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{kindLabel(loc, installKind)}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button type="button" style={BUTTON} onClick={onCheckNow} disabled={checking || installing}>
            <RefreshCw size={14} style={checking ? { animation: 'spin 1s linear infinite' } : undefined} />
            {checking ? t.checking : t.checkNow}
          </button>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {t.lastChecked}: {lastChecked}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            paddingTop: '12px',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{t.autoCheck}</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>{t.autoCheckDesc}</div>
          </div>
          <ToggleSwitch label={t.autoCheck} checked={autoCheckEnabled} onChange={onToggleAutoCheck} />
        </div>
      </div>

      {info && !available && !installed && (
        <div className="glass-card" style={{ ...CARD, color: 'var(--accent-green)', fontWeight: 600 }}>
          {t.upToDate}
        </div>
      )}

      {(available || installed) && (
        <div className="glass-card" style={{ ...CARD, border: '1px solid var(--border-accent)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 10px',
                borderRadius: '999px',
                background: 'rgba(34, 197, 94, 0.2)',
                border: '1px solid rgba(34, 197, 94, 0.45)',
                color: '#4ade80',
                fontSize: '0.72rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              <span
                aria-hidden="true"
                style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#4ade80', animation: 'update-dot-pulse 1.6s ease-in-out infinite' }}
              />
              {installed ? t.badgeInstalledTitle : t.available}
            </span>
            <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{info?.latest_version}</span>
            {info?.release_notes && (
              <button
                type="button"
                aria-expanded={notesExpanded}
                onClick={() => setNotesExpanded((open) => !open)}
                style={{ ...BUTTON, marginLeft: 'auto', padding: '4px 10px', fontSize: '0.75rem' }}
              >
                {t.releaseNotes}
                {notesExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            )}
          </div>
          {notesExpanded && info?.release_notes && (
            <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
              <MarkdownText source={info.release_notes} onOpenLink={openLink} />
            </div>
          )}
          {installing && (
            <div>
              <div style={{ fontSize: '0.8rem', marginBottom: '4px' }}>{fmt(t.downloading, percent)}</div>
              <div
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}
              >
                <div
                  style={{
                    width: `${percent}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, var(--accent-pink), var(--accent-purple))',
                    transition: 'width 0.2s',
                  }}
                />
              </div>
            </div>
          )}
          {installed && <div style={{ color: 'var(--accent-green)', fontWeight: 600 }}>{t.installedReady}</div>}
          {!installed && installNotice && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{installNotice}</div>
          )}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {installed ? (
              <button type="button" style={PRIMARY_BUTTON} onClick={onRestart}>
                <RotateCw size={14} /> {t.restartNow}
              </button>
            ) : (
              info?.can_install && (
                <button type="button" style={PRIMARY_BUTTON} onClick={onInstall} disabled={installing}>
                  <Download size={14} /> {installing ? t.installing : t.install}
                </button>
              )
            )}
            {info?.release_url && (
              <button type="button" style={BUTTON} onClick={() => info.release_url && openLink(info.release_url)}>
                <ExternalLink size={14} /> {t.openRelease}
              </button>
            )}
            {!installed && !isSkipped && (
              <button type="button" style={BUTTON} onClick={onSkip} disabled={installing}>
                {t.skip}
              </button>
            )}
          </div>
          {isSkipped && !installed && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.skipped}</div>
          )}
        </div>
      )}

      {(error || linkError) && (
        <div
          role="alert"
          className="glass-card"
          style={{ ...CARD, color: '#f87171', border: '1px solid rgba(248,113,113,0.4)', fontSize: '0.82rem' }}
        >
          {t.errorPrefix}: {error ?? linkError}
        </div>
      )}

      <h3 style={{ margin: '8px 0 0', fontSize: '1.1rem', fontWeight: 800 }}>{loc.settings.changelog}</h3>
      <ChangelogView currentLang={language} />
    </div>
  );
};
