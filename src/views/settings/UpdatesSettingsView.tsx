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
    <div className="mx-auto my-0 flex max-w-187.5 flex-col gap-4">
      <div className="glass-card" style={CARD}>
        <h3 className="m-0 text-lg font-extrabold">{t.title}</h3>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
          <div>
            <div style={LABEL}>{t.currentVersion}</div>
            <div className="font-bold">v{buildInfo?.version ?? '…'}</div>
          </div>
          <div>
            <div style={LABEL}>{t.channel}</div>
            <div className="font-bold">{channelLabel}</div>
          </div>
          <div>
            <div style={LABEL}>{t.commit}</div>
            <div className="font-mono font-bold">{buildInfo?.commit_short ?? '…'}</div>
          </div>
          <div>
            <div style={LABEL}>{t.installKind}</div>
            <div className="text-ui font-semibold">{kindLabel(loc, installKind)}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" style={BUTTON} onClick={onCheckNow} disabled={checking || installing}>
            <RefreshCw size={14} style={checking ? { animation: 'spin 1s linear infinite' } : undefined} />
            {checking ? t.checking : t.checkNow}
          </button>
          <span className="text-ui text-fg-muted">
            {t.lastChecked}: {lastChecked}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
          <div>
            <div className="text-sm font-semibold">{t.autoCheck}</div>
            <div className="mt-0.5 text-xs text-fg-muted">{t.autoCheckDesc}</div>
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
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-green-500/45 bg-green-500/20 px-2.5 py-1 text-xs font-extrabold tracking-wider text-green-400 uppercase"
            >
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full bg-green-400 motion-safe:animate-update-dot"
              />
              {installed ? t.badgeInstalledTitle : t.available}
            </span>
            <span className="font-mono font-bold">{info?.latest_version}</span>
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
            <div className="max-h-65 overflow-y-auto">
              <MarkdownText source={info.release_notes} onOpenLink={openLink} />
            </div>
          )}
          {installing && (
            <div>
              <div className="mb-1 text-ui">{fmt(t.downloading, percent)}</div>
              <div
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-1.5 overflow-hidden rounded-sm bg-white/10"
              >
                <div
                  className="h-full bg-linear-to-r from-accent-pink to-accent-purple transition-[width] duration-200"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          )}
          {installed && <div className="font-semibold text-accent-green">{t.installedReady}</div>}
          {!installed && installNotice && (
            <div className="text-ui leading-normal text-fg-secondary">{installNotice}</div>
          )}
          <div className="flex flex-wrap gap-2.5">
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
            <div className="text-xs text-fg-muted">{t.skipped}</div>
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

      <h3 className="mx-0 mt-2 mb-0 text-lg font-extrabold">{loc.settings.changelog}</h3>
      <ChangelogView currentLang={language} />
    </div>
  );
};
