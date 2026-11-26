import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Trash2,
  CheckCircle2,
  X,
  Sparkles,
  Zap,
  Download,
} from 'lucide-react';
import { invoke } from '../../api/ipc';
import type { AiModelInfo, AnalysisCapabilities } from '../../types/analysis';
import { getTranslations, type Language } from '../../i18n';
import { useTauriEvent } from '../../hooks/useTauriEvent';
import { fmt } from '../../utils/fmt';
import { cn } from '../../utils/cn';
import { ModalShell } from '../ui';

export interface ModelManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  embedded?: boolean;
  currentLang?: Language;
}

export const ModelManagerModal: React.FC<ModelManagerModalProps> = ({
  isOpen,
  onClose,
  embedded = false,
  currentLang = 'en',
}) => {
  const t = getTranslations(currentLang);
  const [capabilities, setCapabilities] = useState<AnalysisCapabilities | null>(null);
  const [models, setModels] = useState<AiModelInfo[]>([]);
  const [downloading, setDownloading] = useState<{ [id: string]: number }>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchInfo = async () => {
      setLoading(true);
      setError(null);
      try {
        const caps = await invoke<AnalysisCapabilities>('get_analysis_capabilities');
        const list = await invoke<AiModelInfo[]>('list_ai_models');
        if (isMounted) {
          setCapabilities(caps);
          setModels(list);
        }
      } catch (err) {
        if (isMounted) setError(String(err));
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchInfo();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  useTauriEvent<{
    model_id: string;
    downloaded_bytes: number;
    total_bytes: number | null;
    progress: number;
    status: string;
  }>('auralune://model-download-progress', (payload) => {
    const { model_id, progress, status } = payload;
    setDownloading((prev) => ({
      ...prev,
      [model_id]: progress,
    }));
    if (progress >= 1.0 || status === 'ready') {
      setModels((prev) =>
        prev.map((m) => (m.id === model_id ? { ...m, is_installed: true } : m))
      );
      setDownloading((prev) => {
        const next = { ...prev };
        delete next[model_id];
        return next;
      });
    }
  });

  if (!isOpen) return null;

  const handleDownload = async (id: string) => {
    setError(null);
    try {
      setDownloading((prev) => ({ ...prev, [id]: 0.01 }));
      await invoke('download_ai_model', { modelId: id });
    } catch (err: unknown) {
      setError(fmt(t.aiModels.downloadError, String(err)));
      setDownloading((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t.aiModels.deleteConfirm)) return;
    setError(null);
    try {
      await invoke('delete_ai_model', { modelId: id });
      setModels((prev) =>
        prev.map((m) => (m.id === id ? { ...m, is_installed: false } : m))
      );
    } catch (err: unknown) {
      setError(fmt(t.aiModels.deleteError, String(err)));
    }
  };

  const content = (
    <div className="flex w-full flex-col gap-4">
      {error && (
        <div className="rounded-xl border border-accent-red/30 bg-accent-red/15 px-4 py-3 text-ui text-red-300">
          {error}
        </div>
      )}

      {/* Hardware acceleration banner */}
      {capabilities && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/4 px-4.5 py-3.5"
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-xl border',
                capabilities.hardware_acceleration ? 'bg-accent-green/20' : 'bg-accent-amber/20',
                capabilities.hardware_acceleration ? 'border-accent-green/40' : 'border-accent-amber/40',
                capabilities.hardware_acceleration ? 'text-emerald-400' : 'text-amber-400',
              )}
            >
              <Zap size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-fg">
                <span>{t.aiModels.device}</span>
                <span className="font-mono text-pink-500">
                  {capabilities.accelerator_device}
                </span>
              </div>
              <p className="mx-0 mt-0.5 mb-0 text-xs text-fg-secondary">
                {capabilities.hardware_acceleration
                  ? t.aiModels.gpuDetected
                  : t.aiModels.cpuDetected}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Model list */}
      <div className="flex flex-col gap-3">
        <h3 className="mx-0 mt-1 mb-0 text-xs font-bold tracking-wider text-fg-secondary uppercase">
          {t.aiModels.availableModels}
        </h3>

        {loading ? (
          <div className="flex justify-center p-8">
            <Sparkles size={24} className="animate-spin text-purple-400" />
          </div>
        ) : (
          models.map((model) => {
            const isDown = downloading[model.id] !== undefined;
            const progress = downloading[model.id] || 0;
            return (
              <div
                key={model.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/8 bg-white/3 p-4"
              >
                <div className="flex max-w-130 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold text-fg">
                      {model.name}
                    </span>
                    <span
                      className="rounded-xl border border-accent-purple/30 bg-accent-purple/15 px-2 py-0.5 text-xxs font-bold text-purple-400"
                    >
                      {model.task_type}
                    </span>
                  </div>
                  <p className="m-0 text-ui leading-snug text-fg-secondary">
                    {(t.aiModels.catalog as Record<string, string>)[model.id] ?? model.description}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-fg-muted">
                    <span>{fmt(t.aiModels.sizeLabel, (model.file_size / (1024 * 1024)).toFixed(0))}</span>
                    <span>{t.aiModels.formatLabel}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  {model.is_installed ? (
                    <div className="flex items-center gap-2.5">
                      <span
                        className="flex items-center gap-1.5 rounded-xl border border-accent-green/35 bg-accent-green/15 px-3 py-1.5 text-ui font-bold text-emerald-400"
                      >
                        <CheckCircle2 size={14} />
                        {t.aiModels.installed}
                      </span>
                      <button
                        onClick={() => handleDelete(model.id)}
                        className="flex items-center gap-1 rounded-lg border border-accent-red/30 bg-accent-red/15 px-2.5 py-2 text-red-400"
                        title={t.aiModels.deleteWeightsTooltip}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ) : isDown ? (
                    <div className="flex w-35 flex-col gap-1">
                      <div className="h-1.5 w-full overflow-hidden rounded-sm bg-white/10">
                        <div
                          className="h-full bg-linear-to-r from-pink-500 to-violet-500 transition-[width] duration-200"
                          style={{ width: `${Math.round(progress * 100)}%` }}
                        />
                      </div>
                      <span className="text-center font-mono text-xxs text-fg-secondary">
                        {fmt(t.aiModels.downloading, String(Math.round(progress * 100)))}
                      </span>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleDownload(model.id)}
                      className="flex items-center gap-1.5 rounded-xl border-0 bg-linear-135 from-pink-500 to-violet-500 px-4 py-2 text-ui font-bold text-fg shadow-lift shadow-pink-500/30"
                    >
                      <Download size={14} />
                      <span>{fmt(t.aiModels.downloadBtn, (model.file_size / (1024 * 1024)).toFixed(0))}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  if (embedded) {
    return (
      <div className="h-full w-full overflow-y-auto p-1">
        {content}
      </div>
    );
  }

  return (
    <ModalShell
      onClose={onClose}
      layer="studio"
      className="flex max-w-180 flex-col overflow-hidden rounded-3xl border border-accent-purple/35 p-6 text-fg"
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between border-b border-white/8 pb-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9.5 w-9.5 items-center justify-center rounded-xl border border-accent-purple/35 bg-accent-purple/20 text-purple-400"
          >
            <Cpu size={20} />
          </div>
          <div>
            <h2
              className="m-0 bg-linear-to-r bg-clip-text from-purple-400 to-pink-500 text-lg font-extrabold text-transparent"
            >
              {t.aiModels.title}
            </h2>
            <p className="mx-0 mt-0.5 mb-0 text-xs text-fg-secondary">
              {t.aiModels.subtitle}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/6 text-fg-secondary"
        >
          <X size={18} />
        </button>
      </div>

      {content}
    </ModalShell>
  );
};
