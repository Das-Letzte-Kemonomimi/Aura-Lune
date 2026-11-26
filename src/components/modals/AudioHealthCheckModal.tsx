import React, { useState, useEffect } from 'react';
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
  X,
} from 'lucide-react';
import { invoke } from '../../api/ipc';
import { type Language, getTranslations } from '../../i18n';
import { fmt } from '../../utils/fmt';
import { cn } from '../../utils/cn';
import { ModalShell } from '../ui';

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
    <ModalShell
      onClose={onClose}
      layer="system"
      className="flex max-h-[88vh] max-w-170 flex-col overflow-hidden rounded-3xl border border-accent-purple/40 px-7 py-6.5 text-fg"
    >
      {/* Header */}
      <div className="mb-4.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-gradient shadow-lift shadow-pink-500/40"
          >
            <Activity size={22} className="text-fg" />
          </div>
          <div>
            <h3 className="m-0 text-xl font-extrabold tracking-tight">
              {t.healthCheck.title} <span className="text-sm text-accent-pink">v1.0</span>
            </h3>
            <p className="mx-0 mt-0.5 mb-0 text-ui text-fg-muted">
              {t.healthCheck.subtitle}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          aria-label={t.common.close}
          className="flex h-8 w-8 items-center justify-center rounded-full border-0 bg-white/6 text-fg-muted transition-[background] duration-150"
        >
          <X size={16} />
        </button>
      </div>

      {/* Content body */}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto pr-1">
        {loading && (
          <div className="flex flex-col items-center justify-center p-10">
            <RefreshCw size={28} className="text-accent-pink spin" />
            <p className="mt-3 text-sm text-fg-muted">{t.healthCheck.auditing}</p>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-accent-red/30 bg-accent-red/15 p-4 text-sm text-red-300">
            {fmt(t.healthCheck.testError, error)}
          </div>
        )}

        {!loading && health && (
          <>
            {/* Sekcja 1: Serwer Audio PipeWire */}
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

              <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2.5">
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

            {/* Sekcja 2: Silniki DSP */}
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

            {/* Sekcja 3: Kodeki Audio GStreamera */}
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

            {/* Sekcja 4: Baza Danych i Integracja Pulpitu */}
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
      </div>

      {/* Footer actions */}
      <div className="mt-4 flex items-center justify-between border-t border-white/8 pt-3.5">
        <button
          onClick={fetchHealth}
          disabled={loading}
          className={cn(
            'flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/6 px-3.5 py-2 text-ui font-semibold text-fg',
            loading ? 'cursor-default' : 'cursor-pointer',
          )}
        >
          <RefreshCw size={13} className={loading ? 'spin' : ''} />
          {t.healthCheck.recheckBtn}
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyReport}
            disabled={!health}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-4 py-2 text-ui font-bold text-fg shadow-lg shadow-pink-500/35',
              copied ? 'bg-green-500/25' : 'bg-accent-gradient',
              copied ? 'border border-green-400' : 'border-0',
              !health ? 'cursor-default' : 'cursor-pointer',
            )}
          >
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            {copied ? t.healthCheck.copiedReport : t.healthCheck.copyReport}
          </button>
        </div>
      </div>
    </ModalShell>
  );
};
