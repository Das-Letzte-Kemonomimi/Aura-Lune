import React from 'react';
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  RefreshCw,
  RotateCw,
} from '../../components/ui/icons';
import { Badge, Button, Callout, Card, ProgressBar, SettingRow, SettingsGroup, StatusDot } from '../../components/ui';
import { errorMessage, openExternalUrl } from '../../api/ipc';
import { type Language, type Translations } from '../../i18n';
import type { BuildInfo, InstallKind, UpdateInfo, UpdateProgress } from '../../types/updates';
import { fmt } from '../../utils/fmt';
import { ToggleSwitch } from '../../components/common/ToggleSwitch';
import { MarkdownText } from '../../components/common/MarkdownText';
import { ChangelogView } from '../changelog/ChangelogView';
import { cn } from '../../utils/cn';
import { SettingsPage } from './SettingsPage';

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
      await openExternalUrl(url);
    } catch (e: unknown) {
      setLinkError(errorMessage(e));
    }
  };

  const buildFacts = [
    { label: t.currentVersion, value: `v${buildInfo?.version ?? '…'}`, mono: false },
    { label: t.channel, value: channelLabel, mono: false },
    { label: t.commit, value: buildInfo?.commit_short ?? '…', mono: true },
    { label: t.installKind, value: kindLabel(loc, installKind), mono: false },
  ];

  return (
    <SettingsPage
      title={t.title}
      icon={<RefreshCw size={22} />}
      tone="cyan"
      actions={
        <Button onClick={onCheckNow} disabled={checking || installing}>
          <RefreshCw size={16} className={cn(checking && 'motion-safe:animate-spin')} />
          {checking ? t.checking : t.checkNow}
        </Button>
      }
    >
      <SettingsGroup label={loc.settings.group.buildInfo}>
        <dl className="grid grid-cols-2 gap-px bg-line">
          {buildFacts.map((fact) => (
            <div key={fact.label} className="bg-black/30 px-4 py-3">
              <dt className="label-caps text-fg-muted">{fact.label}</dt>
              <dd className={cn('mt-0.5 text-ui font-semibold text-fg', fact.mono && 'font-mono')}>{fact.value}</dd>
            </div>
          ))}
        </dl>
        <SettingRow
          compact
          title={t.autoCheck}
          description={`${t.autoCheckDesc} (${t.lastChecked}: ${lastChecked})`}
          control={<ToggleSwitch label={t.autoCheck} checked={autoCheckEnabled} onChange={onToggleAutoCheck} />}
        />
      </SettingsGroup>

      {info && !available && !installed && (
        <Callout tone="green" icon={<CheckCircle size={18} />} className="font-semibold text-accent-green">
          {t.upToDate}
        </Callout>
      )}

      {(available || installed) && (
        <Card highlight="green" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge tone="green" className="tracking-wider uppercase">
              <StatusDot tone="green" className="motion-safe:animate-update-dot" />
              {installed ? t.badgeInstalledTitle : t.available}
            </Badge>
            <span className="font-mono font-bold">{info?.latest_version}</span>
            {info?.release_notes && (
              <Button
                size="sm"
                aria-expanded={notesExpanded}
                onClick={() => setNotesExpanded((open) => !open)}
                className="ml-auto"
              >
                {t.releaseNotes}
                {notesExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </Button>
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
              <ProgressBar value={percent} label={fmt(t.downloading, percent)} />
            </div>
          )}
          {installed && <div className="font-semibold text-accent-green">{t.installedReady}</div>}
          {!installed && installNotice && <div className="text-ui leading-normal text-fg-secondary">{installNotice}</div>}
          <div className="flex flex-wrap gap-2.5">
            {installed ? (
              <Button variant="primary" onClick={onRestart}>
                <RotateCw size={16} /> {t.restartNow}
              </Button>
            ) : (
              info?.can_install && (
                <Button variant="primary" onClick={onInstall} disabled={installing}>
                  <Download size={16} /> {installing ? t.installing : t.install}
                </Button>
              )
            )}
            {info?.release_url && (
              <Button onClick={() => info.release_url && openLink(info.release_url)}>
                <ExternalLink size={16} /> {t.openRelease}
              </Button>
            )}
            {!installed && !isSkipped && (
              <Button variant="ghost" onClick={onSkip} disabled={installing}>
                {t.skip}
              </Button>
            )}
          </div>
          {isSkipped && !installed && <div className="text-xs text-fg-muted">{t.skipped}</div>}
        </Card>
      )}

      {(error || linkError) && (
        <Callout role="alert" tone="danger" icon={<AlertTriangle size={18} />} className="text-ui text-accent-red">
          {t.errorPrefix}: {error ?? linkError}
        </Callout>
      )}

      <section aria-labelledby="settings-changelog" className="flex flex-col gap-2">
        <h3 id="settings-changelog" className="label-caps px-1 text-fg-muted">
          {loc.settings.changelog}
        </h3>
        <ChangelogView currentLang={language} channel={buildInfo?.channel} />
      </section>
    </SettingsPage>
  );
};
