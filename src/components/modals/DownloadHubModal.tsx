import React, { useEffect, useId, useRef, useState } from 'react';
import { Download, Folder, ShieldCheck, AlertCircle, CheckCircle2, RefreshCw, FileAudio, Play } from '../ui/icons';
import { errorMessage as describeError, invoke } from '../../api/ipc';
import { type Language, getTranslations } from '../../i18n';
import { formatBytes } from '../../utils/fileSizeFormat';
import { fmt } from '../../utils/fmt';
import { cn } from '../../utils/cn';
import {
  Badge,
  Button,
  Callout,
  Card,
  EmptyState,
  FieldLabel,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalShell,
  ProgressBar,
  SectionHeader,
  Spinner,
  TextField,
  type ToneOrNeutral,
} from '../ui';

export interface DownloadJobDto {
  id: string;
  provider: string;
  remote_url: string;
  destination_path: string;
  state: 'Pending' | 'Downloading' | 'Paused' | 'Completed' | 'Failed' | 'Cancelled';
  downloaded_bytes: number;
  total_bytes: number | null;
  expected_sha256: string | null;
  actual_sha256: string | null;
  error: string | null;
  created_at: number;
  completed_at: number | null;
}

/** Badge colour of each job state. */
const STATE_TONES: Record<DownloadJobDto['state'], ToneOrNeutral> = {
  Pending: 'neutral',
  Downloading: 'cyan',
  Paused: 'amber',
  Completed: 'green',
  Failed: 'red',
  Cancelled: 'neutral',
};

interface DownloadHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshLibrary: () => void;
  onPlayPath?: (path: string) => void;
  currentLang?: Language;
}

export const DownloadHubModal: React.FC<DownloadHubModalProps> = ({
  isOpen,
  onClose,
  onRefreshLibrary,
  onPlayPath,
  currentLang = 'pl',
}) => {
  const loc = getTranslations(currentLang);
  const titleId = useId();
  const [remoteUrl, setRemoteUrl] = useState('');
  const [destinationFolder, setDestinationFolder] = useState('');
  const [filename, setFilename] = useState('');
  const [expectedSha, setExpectedSha] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [jobs, setJobs] = useState<DownloadJobDto[]>([]);
  const pollTimerRef = useRef<number | null>(null);

  // Fetch the default music folder on first open
  useEffect(() => {
    if (isOpen) {
      invoke<string>('get_default_music_dir')
        .then((dir) => {
          setDestinationFolder((prev) => prev || dir);
        })
        .catch(() => {});
      fetchJobs();
    }
  }, [isOpen]);

  // Suggest a file name automatically from the URL being typed
  useEffect(() => {
    if (!remoteUrl) return;
    try {
      const urlObj = new URL(remoteUrl);
      const pathname = urlObj.pathname;
      const lastSegment = pathname.substring(pathname.lastIndexOf('/') + 1);
      if (lastSegment && (lastSegment.endsWith('.mp3') || lastSegment.endsWith('.flac') || lastSegment.endsWith('.ogg') || lastSegment.endsWith('.wav') || lastSegment.endsWith('.m4a') || lastSegment.endsWith('.opus'))) {
        setFilename(decodeURIComponent(lastSegment));
      } else {
        setFilename((prev) => prev || 'audio_download.mp3');
      }
    } catch {
      // Ignore an incomplete URL while typing
    }
  }, [remoteUrl]);

  // Poll the download state periodically (every 1 s while the modal is open)
  useEffect(() => {
    if (!isOpen) {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      return;
    }

    fetchJobs();
    pollTimerRef.current = window.setInterval(fetchJobs, 1000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [isOpen]);

  const fetchJobs = async () => {
    try {
      const list = await invoke<DownloadJobDto[]>('list_download_jobs');
      setJobs(list);
    } catch (err: unknown) {
      console.warn('Failed to fetch the job list:', err);
    }
  };

  const handlePickFolder = async () => {
    try {
      const selected = await invoke<string | null>('pick_folder');
      if (selected) {
        setDestinationFolder(selected);
      }
    } catch (err: unknown) {
      setErrorMessage(fmt(loc.downloadHub.errorSelectFolder, describeError(err)));
    }
  };

  const handleStartDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedUrl = remoteUrl.trim();
    if (!trimmedUrl) {
      setErrorMessage(loc.downloadHub.errorInvalidUrl);
      return;
    }
    if (!destinationFolder.trim()) {
      setErrorMessage(loc.downloadHub.errorSpecifyDest);
      return;
    }

    const cleanFilename = filename.trim() || 'audio_track.mp3';
    // Build the full path
    const sep = destinationFolder.endsWith('/') ? '' : '/';
    const fullDestinationPath = `${destinationFolder}${sep}${cleanFilename}`;

    setIsSubmitting(true);
    try {
      await invoke('add_download_job', {
        remoteUrl: trimmedUrl,
        destinationPath: fullDestinationPath,
        expectedSha256: expectedSha.trim() || null,
      });

      setSuccessMessage(loc.downloadHub.jobAdded);
      setRemoteUrl('');
      setFilename('');
      setExpectedSha('');
      await fetchJobs();
    } catch (err: unknown) {
      setErrorMessage(fmt(loc.downloadHub.errorStartDownload, describeError(err)));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      await invoke('cancel_download_job', { jobId });
      await fetchJobs();
    } catch (err: unknown) {
      console.error('Failed to cancel the job:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <ModalShell onClose={onClose} layer="studio" size="xl" labelledBy={titleId}>
      <ModalHeader
        titleId={titleId}
        title={loc.downloadHub.title}
        subtitle={loc.downloadHub.subtitle}
        icon={<Download size={20} />}
        onClose={onClose}
        closeLabel={loc.common.close}
      />

      <ModalBody className="flex flex-col gap-5">
        <Callout tone="cyan" icon={<ShieldCheck size={20} />} className="text-ui text-fg-secondary">
          {loc.downloadHub.securityBanner}
        </Callout>

        {errorMessage && (
          <Callout tone="danger" role="alert" icon={<AlertCircle size={16} />} className="text-sm text-fg">
            {errorMessage}
          </Callout>
        )}

        {successMessage && (
          <Callout tone="green" role="status" icon={<CheckCircle2 size={16} />} className="text-sm text-fg">
            {successMessage}
          </Callout>
        )}

        {/* New download */}
        <form onSubmit={handleStartDownload} className="flex flex-col gap-3.5">
          <div>
            <FieldLabel htmlFor={`${titleId}-url`}>{loc.downloadHub.directUrl}</FieldLabel>
            <TextField
              id={`${titleId}-url`}
              type="url"
              required
              placeholder="https://archive.org/download/.../track.flac"
              value={remoteUrl}
              onChange={(e) => setRemoteUrl(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.2fr_0.8fr]">
            <div>
              <FieldLabel htmlFor={`${titleId}-dest`}>{loc.downloadHub.destinationFolder}</FieldLabel>
              <div className="flex gap-2">
                <TextField
                  id={`${titleId}-dest`}
                  required
                  readOnly
                  placeholder={loc.downloadHub.selectFolderPlaceholder}
                  value={destinationFolder}
                  className="flex-1 text-fg-secondary"
                />
                <Button onClick={handlePickFolder}>
                  <Folder size={16} /> {loc.downloadHub.browse}
                </Button>
              </div>
            </div>

            <div>
              <FieldLabel htmlFor={`${titleId}-name`}>{loc.downloadHub.filename}</FieldLabel>
              <TextField
                id={`${titleId}-name`}
                required
                placeholder={loc.downloadHub.filenamePlaceholder}
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
              />
            </div>
          </div>

          <div>
            <FieldLabel htmlFor={`${titleId}-sha`}>
              {loc.downloadHub.expectedSha256}{' '}
              <span className="font-normal normal-case text-fg-muted">{loc.downloadHub.integrityOptional}</span>
            </FieldLabel>
            <TextField
              id={`${titleId}-sha`}
              mono
              placeholder={loc.downloadHub.shaPlaceholder}
              value={expectedSha}
              onChange={(e) => setExpectedSha(e.target.value)}
              className="text-xs"
            />
          </div>

          <Button type="submit" variant="primary" size="lg" disabled={isSubmitting} className="mt-1.5">
            {isSubmitting ? <Spinner size="sm" className="text-current" /> : <Download size={18} />}
            {isSubmitting ? loc.downloadHub.starting : loc.downloadHub.startDownload}
          </Button>
        </form>

        {/* Queued jobs */}
        <div className="mt-2.5">
          <SectionHeader
            icon={<FileAudio size={18} />}
            title={`${loc.downloadHub.queueTitle} (${jobs.length})`}
            actions={
              <Button variant="ghost" size="sm" onClick={fetchJobs}>
                <RefreshCw size={12} /> {loc.downloadHub.refreshList}
              </Button>
            }
            className="mb-3"
          />

          {jobs.length === 0 ? (
            <EmptyState
              icon={<Download size={28} />}
              title={loc.downloadHub.emptyQueue}
              className="rounded-xl border border-dashed border-line bg-black/20"
            />
          ) : (
            <div className="flex flex-col gap-2.5">
              {jobs.map((job) => {
                const percent =
                  job.total_bytes && job.total_bytes > 0
                    ? Math.min(100, Math.round((job.downloaded_bytes / job.total_bytes) * 100))
                    : null;
                const fileName = job.destination_path.split('/').pop();

                return (
                  <Card key={job.id} padding="none" className="flex flex-col gap-2 px-4 py-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <Badge tone={STATE_TONES[job.state]} size="xs" className="uppercase">
                          {job.state === 'Downloading' ? loc.downloadHub.downloading : job.state}
                        </Badge>
                        <span className="max-w-112.5 truncate text-sm font-semibold text-fg" title={job.destination_path}>
                          {fileName}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {job.state === 'Downloading' && (
                          <Button variant="danger" size="sm" onClick={() => handleCancelJob(job.id)}>
                            {loc.common.cancel}
                          </Button>
                        )}
                        {job.state === 'Completed' && (
                          <Button
                            variant="tinted"
                            tone="green"
                            size="sm"
                            onClick={() => {
                              onRefreshLibrary();
                              if (onPlayPath) onPlayPath(job.destination_path);
                            }}
                          >
                            <Play size={12} /> {loc.downloadHub.playInAuralune}
                          </Button>
                        )}
                      </div>
                    </div>

                    {job.state === 'Downloading' && (
                      <div>
                        {/* Without a known size the bar only shows that bytes are arriving. */}
                        <ProgressBar
                          value={percent ?? 60}
                          label={fileName}
                          className={cn('mt-1', percent === null && 'motion-safe:animate-pulse')}
                        />
                        <div className="mt-1 flex justify-between text-xs text-fg-muted">
                          <span>
                            {formatBytes(job.downloaded_bytes)}
                            {job.total_bytes ? ` / ${formatBytes(job.total_bytes)}` : ''}
                          </span>
                          <span>{percent !== null ? `${percent}%` : loc.downloadHub.streaming}</span>
                        </div>
                      </div>
                    )}

                    {job.error && (
                      <div className="text-xs text-accent-red">
                        {loc.downloadHub.error} {job.error}
                      </div>
                    )}

                    {job.state === 'Completed' && job.actual_sha256 && (
                      <div className="font-mono text-xxs text-fg-muted">
                        SHA-256: {job.actual_sha256.substring(0, 16)}...
                        {job.expected_sha256 && loc.downloadHub.verified}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </ModalBody>

      <ModalFooter className="justify-between">
        <span className="text-xs text-fg-muted">{loc.downloadHub.compliance}</span>
        <Button onClick={onClose}>{loc.common.close}</Button>
      </ModalFooter>
    </ModalShell>
  );
};
