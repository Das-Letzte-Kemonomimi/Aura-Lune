import React, { useEffect, useId, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  RefreshCw,
  Cpu,
  Layers,
  Database,
  Radio,
  Volume2,
} from '../ui/icons';
import { invoke } from '../../api/ipc';
import { type Language, getTranslations } from '../../i18n';
import { fmt } from '../../utils/fmt';
import { cn } from '../../utils/cn';
import { Button, Callout, ModalBody, ModalFooter, ModalHeader, ModalShell, Spinner } from '../ui';

export interface AudioCodecStatus {
  format: string;
  decoder: string;
  available: boolean;
}

export interface AudioSystemHealth {
  pipewire_active: boolean;
  pipewire_version: string | null;
  sample_rate: number;
  channels: number;
  audio_buffer_ms: number;
  dsp_block_size: number;
  rubberband_available: boolean;
  soundtouch_available: boolean;
  gstreamer_version: string;
  codecs: AudioCodecStatus[];
  db_status: string;
  tracks_count: number;
  albums_count: number;
  mpris_active: boolean;
  waybar_ipc_active: boolean;
  fifo_ipc_active: boolean;
  waybar_ipc_path: string;
  fifo_ipc_path: string;
}

interface AudioHealthCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLang?: Language;
}

export const AudioHealthCheckModal: React.FC<AudioHealthCheckModalProps> = ({
  isOpen,
  onClose,
  currentLang = 'en',
}) => {
  const t = getTranslations(currentLang);
  const [loading, setLoading] = useState<boolean>(true);
  const titleId = useId();
  const [health, setHealth] = useState<AudioSystemHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await invoke<AudioSystemHealth>('get_audio_system_health');
      setHealth(res);
    } catch (e: unknown) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHealth();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyReport = () => {
    if (!health) return;
    const report = [
      '==================================================',
      '     AURALUNE 1.0 — AUDIO DIAGNOSTIC REPORT',
      '==================================================',
      `Test date: ${new Date().toISOString()}`,
      `Platform: Linux (Wayland / X11)`,
      `PipeWire audio server: ${health.pipewire_active ? `ACTIVE (v${health.pipewire_version || 'unknown'})` : 'ABSENT / PULSEAUDIO FALLBACK'}`,
      `GStreamer pipeline: v${health.gstreamer_version}`,
      `PipeWire audio buffer: ${health.audio_buffer_ms} ms`,
      `DSP block size: ${health.dsp_block_size} frames`,
      `DSP engine Rubber Band: ${health.rubberband_available ? 'AVAILABLE (Phase Vocoder v3)' : 'MISSING'}`,
      `DSP engine SoundTouch: ${health.soundtouch_available ? 'AVAILABLE (WSOLA)' : 'MISSING'}`,
      `SQLite database: ${health.db_status} (${health.tracks_count} tracks, ${health.albums_count} albums)`,
      `MPRIS v2 D-Bus: ${health.mpris_active ? 'ACTIVE' : 'INACTIVE'}`,
      `Linux IPC Waybar (${health.waybar_ipc_path}): ${health.waybar_ipc_active ? 'READY' : 'MISSING'}`,
      `Linux IPC FIFO (${health.fifo_ipc_path}): ${health.fifo_ipc_active ? 'READY' : 'MISSING'}`,
      '--------------------------------------------------',
      'GStreamer audio decoder codecs:',
      ...health.codecs.map(
        (c) => `  - [${c.available ? 'OK' : 'MISSING'}] ${c.format} -> ${c.decoder}`
      ),
      '==================================================',
    ].join('\n');

    navigator.clipboard.writeText(report).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <ModalShell onClose={onClose} layer="system" size="lg" labelledBy={titleId}>
      <ModalHeader
        titleId={titleId}
        title={
          <>
            {t.healthCheck.title} <span className="text-sm text-accent-pink">v1.0</span>
          </>
        }
        subtitle={t.healthCheck.subtitle}
        icon={<Activity size={20} />}
        onClose={onClose}
        closeLabel={t.common.close}
      />

      <ModalBody className="flex flex-col gap-4">
        {loading && (
          <div className="flex flex-col items-center justify-center p-10">
            <Spinner size="lg" />
            <p className="mt-3 text-sm text-fg-muted">{t.healthCheck.auditing}</p>
          </div>
        )}

        {error && (
          <Callout tone="danger" className="text-sm text-accent-red">
            {fmt(t.healthCheck.testError, error)}
          </Callout>
        )}

        {!loading && health && (
          <>
            {/* Section 1: PipeWire audio server */}
            <div className="rounded-2xl border border-white/7 bg-white/3 px-4 py-3.5">
              <div className="mb-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Volume2 size={16} className="text-accent-pink" />
                  <span className="text-sm font-bold">{t.healthCheck.audioServerBuffer}</span>
                </div>
                {health.pipewire_active ? (
                  <span className="flex items-center gap-1.5 rounded-xl border border-green-500/30 bg-green-500/15 px-2 py-1 text-xs font-bold text-green-400">
                    <CheckCircle2 size={12} /> {t.healthCheck.pipewireDirect}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 rounded-xl border border-yellow-500/30 bg-yellow-500/15 px-2 py-1 text-xs font-bold text-yellow-400">
                    {t.healthCheck.fallbackAlsa}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-[repeat(auto-fit,minmax(--spacing(32.5),1fr))] gap-2.5">
                <div className="rounded-lg bg-black/25 px-2.5 py-2">
                  <div className="text-xxs text-fg-muted">{t.healthCheck.pipewireServer}</div>
                  <div className="mt-0.5 text-ui font-semibold text-fg">
                    {health.pipewire_version ? `v${health.pipewire_version}` : t.healthCheck.activeDaemon}
                  </div>
                </div>
                <div className="rounded-lg bg-black/25 px-2.5 py-2">
                  <div className="text-xxs text-fg-muted">{t.healthCheck.bufferLatency}</div>
                  <div className="mt-0.5 text-ui font-semibold text-accent-pink">
                    {health.audio_buffer_ms} ms
                  </div>
                </div>
                <div className="rounded-lg bg-black/25 px-2.5 py-2">
                  <div className="text-xxs text-fg-muted">{t.healthCheck.dspBlock}</div>
                  <div className="mt-0.5 text-ui font-semibold text-fg">
                    {health.dsp_block_size} {t.healthCheck.frames}
                  </div>
                </div>
                <div className="rounded-lg bg-black/25 px-2.5 py-2">
                  <div className="text-xxs text-fg-muted">GStreamer Core</div>
                  <div className="mt-0.5 text-ui font-semibold text-accent-purple">
                    v{health.gstreamer_version}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: DSP engines */}
            <div className="rounded-2xl border border-white/7 bg-white/3 px-4 py-3.5">
              <div className="mb-2.5 flex items-center gap-2">
                <Cpu size={16} className="text-accent-purple" />
                <span className="text-sm font-bold">{t.healthCheck.realtimeDsp}</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="flex items-center justify-between rounded-lg bg-black/25 p-2.5">
                  <div>
                    <div className="text-ui font-bold">Rubber Band v3</div>
                    <div className="text-xxs text-fg-muted">{t.healthCheck.rubberbandDesc}</div>
                  </div>
                  <CheckCircle2 size={16} className="text-green-400" />
                </div>
                <div className="flex items-center justify-between rounded-lg bg-black/25 p-2.5">
                  <div>
                    <div className="text-ui font-bold">SoundTouch WSOLA</div>
                    <div className="text-xxs text-fg-muted">{t.healthCheck.soundtouchDesc}</div>
                  </div>
                  <CheckCircle2 size={16} className="text-green-400" />
                </div>
              </div>
            </div>

            {/* Section 3: GStreamer audio codecs */}
            <div className="rounded-2xl border border-white/7 bg-white/3 px-4 py-3.5">
              <div className="mb-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers size={16} className="text-accent-pink" />
                  <span className="text-sm font-bold">{t.healthCheck.gstreamerCodecs}</span>
                </div>
                <span className="text-xs text-fg-muted">GStreamer Plugins</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {health.codecs.map((c) => (
                  <div
                    key={c.format}
                    className="flex items-center justify-between rounded-lg bg-black/25 px-3 py-2"
                  >
                    <div className="overflow-hidden">
                      <div className="truncate text-ui font-semibold">
                        {c.format}
                      </div>
                      <div className="font-mono text-xxs text-fg-muted">
                        {c.decoder}
                      </div>
                    </div>
                    {c.available ? (
                      <CheckCircle2 size={15} className="shrink-0 text-green-400" />
                    ) : (
                      <XCircle size={15} className="shrink-0 text-red-400" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Section 4: database and desktop integration */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/7 bg-white/3 px-3.5 py-3">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <Database size={15} className="text-accent-purple" />
                  <span className="text-sm font-bold">{t.healthCheck.databaseIntegrity}</span>
                </div>
                <div className="text-ui font-semibold text-green-400">
                  {health.tracks_count} {t.stats.tracksUnit} • {health.albums_count} {t.library.albums.toLowerCase()}
                </div>
                <div className="mt-0.5 text-xxs text-fg-muted">
                  {health.db_status}
                </div>
              </div>

              <div className="rounded-2xl border border-white/7 bg-white/3 px-3.5 py-3">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <Radio size={15} className="text-accent-pink" />
                  <span className="text-sm font-bold">{t.healthCheck.desktopIpc}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <span className={cn(
                    'rounded-sm px-1.5 py-0.5 text-xxs',
                    health.mpris_active ? 'bg-green-500/20' : 'bg-white/5',
                    health.mpris_active ? 'text-green-400' : 'text-fg-muted',
                  )}>
                    MPRIS D-Bus
                  </span>
                  <span className={cn(
                    'rounded-sm px-1.5 py-0.5 text-xxs',
                    health.waybar_ipc_active ? 'bg-green-500/20' : 'bg-white/5',
                    health.waybar_ipc_active ? 'text-green-400' : 'text-fg-muted',
                  )}>
                    Waybar JSON
                  </span>
                  <span className={cn(
                    'rounded-sm px-1.5 py-0.5 text-xxs',
                    health.fifo_ipc_active ? 'bg-green-500/20' : 'bg-white/5',
                    health.fifo_ipc_active ? 'text-green-400' : 'text-fg-muted',
                  )}>
                    FIFO Control
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </ModalBody>

      <ModalFooter className="justify-between">
        <Button onClick={fetchHealth} disabled={loading}>
          <RefreshCw size={13} className={cn(loading && 'motion-safe:animate-spin')} />
          {t.healthCheck.recheckBtn}
        </Button>
        <Button
          variant={copied ? 'tinted' : 'primary'}
          tone="green"
          onClick={handleCopyReport}
          disabled={!health}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? t.healthCheck.copiedReport : t.healthCheck.copyReport}
        </Button>
      </ModalFooter>
    </ModalShell>
  );
};
