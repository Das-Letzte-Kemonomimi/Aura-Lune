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
import { Badge, Button, Callout, Card, ProgressBar, SectionHeader, SettingRow, StatusDot } from '../../components/ui';
import { errorMessage, invoke } from '../../api/ipc';
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
      await invoke('open_external_url', { url });
    } catch (e: unknown) {
      setLinkError(errorMessage(e));
    }
  };

  return (
    <SettingsPage>
      <Card className="flex flex-col gap-3">
        <SectionHeader icon={<RefreshCw size={18} />} tone="cyan" title={t.title} />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(--spacing(45),1fr))] gap-3">
          <div>
            <div className="label-caps">{t.currentVersion}</div>
            <div className="font-bold">v{buildInfo?.version ?? '…'}</div>
          </div>
          <div>
            <div className="label-caps">{t.channel}</div>
            <div className="font-bold">{channelLabel}</div>
          </div>
          <div>
            <div className="label-caps">{t.commit}</div>
            <div className="font-mono font-bold">{buildInfo?.commit_short ?? '…'}</div>
          </div>
          <div>
            <div className="label-caps">{t.installKind}</div>
            <div className="text-ui font-semibold">{kindLabel(loc, installKind)}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={onCheckNow} disabled={checking || installing}>
            <RefreshCw size={14} className={cn(checking && 'motion-safe:animate-spin')} />
            {checking ? t.checking : t.checkNow}
          </Button>
          <span className="text-ui text-fg-muted">
            {t.lastChecked}: {lastChecked}
          </span>
        </div>
        <SettingRow
          title={t.autoCheck}
          description={t.autoCheckDesc}
          control={<ToggleSwitch label={t.autoCheck} checked={autoCheckEnabled} onChange={onToggleAutoCheck} />}
          className="border-t border-line pb-0"
        />
      </Card>

      {info && !available && !installed && (
        <Callout tone="green" icon={<CheckCircle size={16} />} className="font-semibold text-accent-green">
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
                <RotateCw size={14} /> {t.restartNow}
              </Button>
            ) : (
              info?.can_install && (
                <Button variant="primary" onClick={onInstall} disabled={installing}>
                  <Download size={14} /> {installing ? t.installing : t.install}
                </Button>
              )
            )}
            {info?.release_url && (
              <Button onClick={() => info.release_url && openLink(info.release_url)}>
                <ExternalLink size={14} /> {t.openRelease}
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
        <Callout role="alert" tone="danger" icon={<AlertTriangle size={16} />} className="text-ui text-accent-red">
          {t.errorPrefix}: {error ?? linkError}
        </Callout>
      )}

      <h3 className="mt-2 text-lg font-bold text-fg">{loc.settings.changelog}</h3>
      <ChangelogView currentLang={language} />
    </SettingsPage>
  );
};
