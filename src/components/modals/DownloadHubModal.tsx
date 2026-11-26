import React, { useEffect, useId, useRef, useState } from 'react';
import {
  Download,
  Folder,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  FileAudio,
  Play,
} from '../ui/icons';
import { invoke } from '../../api/ipc';
import { type Language, getTranslations } from '../../i18n';
import { formatBytes } from '../../utils/fileSizeFormat';
import { fmt } from '../../utils/fmt';
import { cn } from '../../utils/cn';
import { Button, Callout, ModalBody, ModalFooter, ModalHeader, ModalShell } from '../ui';

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
    } catch (err) {
      console.warn('Failed to fetch the job list:', err);
    }
  };

  const handlePickFolder = async () => {
    try {
      const selected = await invoke<string | null>('pick_folder');
      if (selected) {
        setDestinationFolder(selected);
      }
    } catch (err) {
      setErrorMessage(fmt(loc.downloadHub.errorSelectFolder, String(err)));
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
    } catch (err) {
      setErrorMessage(fmt(loc.downloadHub.errorStartDownload, String(err)));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      await invoke('cancel_download_job', { jobId });
      await fetchJobs();
    } catch (err) {
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
        {/* Safety banner */}
        <Callout tone="cyan" icon={<ShieldCheck size={20} />} className="text-ui text-fg-secondary">
          {loc.downloadHub.securityBanner}
        </Callout>

        {errorMessage && (
          <Callout
            tone="red" className="flex items-center gap-2 text-sm text-red-300"
          >
            <AlertCircle size={16} />
            {errorMessage}
          </Callout>
        )}

        {successMessage && (
          <div
            className="flex items-center gap-2 rounded-xl border border-green-500/35 bg-green-500/15 px-4 py-3 text-sm text-green-300"
          >
            <CheckCircle2 size={16} />
            {successMessage}
          </div>
        )}

        {/* NEW DOWNLOAD FORM */}
        <form onSubmit={handleStartDownload} className="flex flex-col gap-3.5">
          <div>
            <label className="mb-1.5 block text-ui font-semibold text-slate-300">
              {loc.downloadHub.directUrl}
            </label>
            <input
              type="url"
              required
              placeholder="https://archive.org/download/.../track.flac"
              value={remoteUrl}
              onChange={(e) => setRemoteUrl(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-black/35 px-3.5 py-2.5 text-sm text-fg outline-none"
            />
          </div>

          <div className="grid grid-cols-[1.2fr_0.8fr] gap-3">
            <div>
              <label className="mb-1.5 block text-ui font-semibold text-slate-300">
                {loc.downloadHub.destinationFolder}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  readOnly
                  placeholder={loc.downloadHub.selectFolderPlaceholder}
                  value={destinationFolder}
                  className="flex-1 rounded-xl border border-white/15 bg-black/25 px-3 py-2.5 text-ui text-slate-300 outline-none"
                />
                <button
                  type="button"
                  onClick={handlePickFolder}
                  className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/8 px-3.5 py-0 text-ui font-semibold text-fg"
                >
                  <Folder size={16} /> {loc.downloadHub.browse}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-ui font-semibold text-slate-300">
                {loc.downloadHub.filename}
              </label>
              <input
                type="text"
                required
                placeholder={loc.downloadHub.filenamePlaceholder}
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/35 px-3 py-2.5 text-ui text-fg outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-ui font-semibold text-slate-300">
              {loc.downloadHub.expectedSha256}{' '}
              <span className="font-normal text-fg-muted">
                {loc.downloadHub.integrityOptional}
              </span>
            </label>
            <input
              type="text"
              placeholder={loc.downloadHub.shaPlaceholder}
              value={expectedSha}
              onChange={(e) => setExpectedSha(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-black/35 px-3 py-2.5 font-mono text-xs text-fg outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={cn(
              'mt-1.5 flex items-center justify-center gap-2 rounded-xl border-0 bg-accent-gradient px-5 py-3 text-sm font-bold text-on-accent shadow-lift shadow-accent-pink/30 transition-opacity duration-200',
              isSubmitting && 'cursor-not-allowed opacity-70',
            )}
          >
            <Download size={18} />
            {isSubmitting ? loc.downloadHub.starting : loc.downloadHub.startDownload}
          </button>
        </form>

        {/* QUEUED JOB LIST */}
        <div className="mt-2.5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="m-0 flex items-center gap-2 text-md font-bold text-slate-200">
              <FileAudio size={18} className="text-accent-pink" /> {loc.downloadHub.queueTitle} ({jobs.length})
            </h3>
            <button
              onClick={fetchJobs}
              className="flex items-center gap-1 border-0 bg-transparent text-xs text-fg-muted"
            >
              <RefreshCw size={12} /> {loc.downloadHub.refreshList}
            </button>
          </div>

          {jobs.length === 0 ? (
            <div
              className="rounded-xl border border-dashed border-white/10 bg-black/20 p-7 text-center text-sm text-fg-muted"
            >
              {loc.downloadHub.emptyQueue}
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {jobs.map((job) => {
                const percent =
                  job.total_bytes && job.total_bytes > 0
                    ? Math.min(100, Math.round((job.downloaded_bytes / job.total_bytes) * 100))
                    : null;

                return (
                  <div
                    key={job.id}
                    className="flex flex-col gap-2 rounded-xl border border-white/8 bg-white/4 px-4 py-3.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span
                          className={cn(
                            'rounded-md px-2 py-0.5 text-xxs font-bold uppercase',
                            job.state === 'Completed' ? 'bg-green-500/20' : job.state === 'Downloading' ? 'bg-sky-400/20' : job.state === 'Failed' ? 'bg-accent-red/20' : 'bg-white/10',
                            job.state === 'Completed' ? 'text-green-400' : job.state === 'Downloading' ? 'text-sky-400' : job.state === 'Failed' ? 'text-red-400' : 'text-slate-300',
                          )}
                        >
                          {job.state === 'Downloading' ? loc.downloadHub.downloading : job.state}
                        </span>
                        <span
                          className="max-w-112.5 truncate text-sm font-semibold text-fg"
                          title={job.destination_path}
                        >
                          {job.destination_path.split('/').pop()}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {job.state === 'Downloading' && (
                          <button
                            onClick={() => handleCancelJob(job.id)}
                            className="rounded-md border border-accent-red/40 bg-accent-red/20 px-2.5 py-1 text-xs font-semibold text-red-400"
                          >
                            {loc.common.cancel}
                          </button>
                        )}
                        {job.state === 'Completed' && (
                          <button
                            onClick={() => {
                              onRefreshLibrary();
                              if (onPlayPath) onPlayPath(job.destination_path);
                            }}
                            className="flex items-center gap-1 rounded-md border border-green-500/40 bg-green-500/20 px-2.5 py-1 text-xs font-semibold text-green-400"
                          >
                            <Play size={12} /> {loc.downloadHub.playInAuralune}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* PROGRESS BAR */}
                    {job.state === 'Downloading' && (
                      <div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-sm bg-black/40">
                          <div
                            className="h-full rounded-sm bg-linear-to-r from-accent-pink to-sky-400 transition-[width] duration-300"
                            style={{ width: percent !== null ? `${percent}%` : '60%' }}
                          />
                        </div>
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
                      <div className="text-xs text-red-400">
                        {loc.downloadHub.error} {job.error}
                      </div>
                    )}

                    {job.state === 'Completed' && job.actual_sha256 && (
                      <div className="font-mono text-xxs text-fg-muted">
                        SHA-256: {job.actual_sha256.substring(0, 16)}...
                        {job.expected_sha256 && loc.downloadHub.verified}
                      </div>
                    )}
                  </div>
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
