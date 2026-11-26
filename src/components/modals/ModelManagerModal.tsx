import React, { useEffect, useId, useState } from 'react';
import { Cpu, Trash2, CheckCircle2, Zap, Download } from '../ui/icons';
import { errorMessage, invoke } from '../../api/ipc';
import type { AiModelInfo, AnalysisCapabilities } from '../../types/analysis';
import { getTranslations, type Language } from '../../i18n';
import { useTauriEvent } from '../../hooks/useTauriEvent';
import { fmt } from '../../utils/fmt';
import {
  Badge,
  Button,
  Callout,
  Card,
  IconButton,
  ModalBody,
  ModalHeader,
  ModalShell,
  ProgressBar,
  SectionHeader,
  Spinner,
} from '../ui';

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
  const titleId = useId();
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
      } catch (err: unknown) {
        if (isMounted) setError(errorMessage(err));
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
      setError(fmt(t.aiModels.downloadError, errorMessage(err)));
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
      setError(fmt(t.aiModels.deleteError, errorMessage(err)));
    }
  };

  const content = (
    <div className="flex w-full flex-col gap-4">
      {error && (
        <Callout tone="danger" role="alert" className="text-ui text-fg">
          {error}
        </Callout>
      )}

      {/* Compute device */}
      {capabilities && (
        <Card padding="sm">
          <SectionHeader
            icon={<Zap size={18} />}
            tone={capabilities.hardware_acceleration ? 'green' : 'amber'}
            title={
              <span className="flex items-center gap-2">
                {t.aiModels.device}
                <span className="font-mono text-accent-pink">{capabilities.accelerator_device}</span>
              </span>
            }
            description={capabilities.hardware_acceleration ? t.aiModels.gpuDetected : t.aiModels.cpuDetected}
          />
        </Card>
      )}

      {/* Models */}
      <div className="flex flex-col gap-3">
        <h3 className="label-caps mt-1">{t.aiModels.availableModels}</h3>

        {loading ? (
          <div className="flex justify-center p-8">
            <Spinner size="lg" tone="purple" />
          </div>
        ) : (
          models.map((model) => {
            const isDown = downloading[model.id] !== undefined;
            const progress = downloading[model.id] || 0;
            const sizeMb = (model.file_size / (1024 * 1024)).toFixed(0);
            return (
              <Card key={model.id} padding="sm" className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex max-w-130 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold text-fg">{model.name}</span>
                    <Badge tone="purple" size="xs">
                      {model.task_type}
                    </Badge>
                  </div>
                  <p className="m-0 text-ui leading-snug text-fg-secondary">
                    {(t.aiModels.catalog as Record<string, string>)[model.id] ?? model.description}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-fg-muted">
                    <span>{fmt(t.aiModels.sizeLabel, sizeMb)}</span>
                    <span>{t.aiModels.formatLabel}</span>
                  </div>
                </div>

                {model.is_installed ? (
                  <div className="flex items-center gap-2.5">
                    <Badge tone="green" className="gap-1.5 px-3 py-1.5 text-ui">
                      <CheckCircle2 size={14} />
                      {t.aiModels.installed}
                    </Badge>
                    <IconButton
                      variant="secondary"
                      label={t.aiModels.deleteWeightsTooltip}
                      onClick={() => handleDelete(model.id)}
                      className="text-accent-red"
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </div>
                ) : isDown ? (
                  <div className="flex w-35 flex-col gap-1">
                    <ProgressBar value={progress * 100} label={model.name} />
                    <span className="text-center font-mono text-xxs text-fg-secondary">
                      {fmt(t.aiModels.downloading, String(Math.round(progress * 100)))}
                    </span>
                  </div>
                ) : (
                  <Button variant="primary" onClick={() => handleDownload(model.id)}>
                    <Download size={14} />
                    {fmt(t.aiModels.downloadBtn, sizeMb)}
                  </Button>
                )}
              </Card>
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
    <ModalShell onClose={onClose} layer="studio" size="lg" labelledBy={titleId}>
      <ModalHeader
        titleId={titleId}
        title={t.aiModels.title}
        subtitle={t.aiModels.subtitle}
        icon={<Cpu size={20} />}
        tone="purple"
        onClose={onClose}
        closeLabel={t.common.close}
      />
      <ModalBody>{content}</ModalBody>
    </ModalShell>
  );
};
