import React, { useEffect, useId, useState } from 'react';
import {
  Layers,
  Cpu,
  Zap,
  CheckCircle2,
  HardDrive,
  Clock,
  Play,
  Music,
} from '../ui/icons';
import { invoke } from '../../api/ipc';
import type { ModelPackInfo, AnalysisCapabilities, StemProject } from '../../types/analysis';
import { getTranslations, type Language } from '../../i18n';
import { fmt } from '../../utils/fmt';
import { cn } from '../../utils/cn';
import { Badge, Button, Callout, Card, FieldLabel, ModalBody, ModalFooter, ModalHeader, ModalShell, OptionCard, Spinner, TextField } from '../ui';

interface CreateStemProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  track?: {
    id: number;
    title: string;
    artist?: string;
    duration_ms?: number;
  } | null;
  trackId?: number;
  trackTitle?: string;
  trackArtist?: string;
  trackDurationMs?: number;
  onProjectCreated: (projectId: number) => void;
  currentLang?: Language;
}

export const CreateStemProjectModal: React.FC<CreateStemProjectModalProps> = ({
  isOpen,
  onClose,
  track,
  trackId,
  trackTitle,
  trackArtist,
  trackDurationMs = 180000,
  onProjectCreated,
  currentLang = 'en',
}) => {
  const t = getTranslations(currentLang);
  const effectiveTrackId = track?.id ?? trackId ?? 0;
  const effectiveTrackTitle = track?.title ?? trackTitle ?? t.stems.modalTrackDefault;
  const effectiveTrackArtist = track?.artist ?? trackArtist ?? t.stems.artistDefault;
  const effectiveDurationMs = track?.duration_ms ?? trackDurationMs ?? 180000;

  const titleId = useId();
  const nameId = useId();
  const [modelPacks, setModelPacks] = useState<ModelPackInfo[]>([]);
  const [selectedPackIds, setSelectedPackIds] = useState<string[]>([
    'pack_dsp_cascade',
    'pack_drum_pieces',
    'pack_vocal_harmonies',
  ]);
  const [capabilities, setCapabilities] = useState<AnalysisCapabilities | null>(null);
  const [projectTitle, setProjectTitle] = useState<string>(`${effectiveTrackTitle} (${t.stems.title})`);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setProjectTitle(`${effectiveTrackTitle} (${t.stems.title})`);
    setError(null);

    const loadData = async () => {
      try {
        const [packs, caps] = await Promise.all([
          invoke<ModelPackInfo[]>('list_model_packs'),
          invoke<AnalysisCapabilities>('get_analysis_capabilities'),
        ]);
        setModelPacks(packs);
        setCapabilities(caps);
      } catch (err: unknown) {
        console.error('Failed to fetch the packages:', err);
      }
    };

    loadData();
  }, [isOpen, effectiveTrackTitle, t.stems.title]);

  if (!isOpen) return null;

  const togglePack = (packId: string) => {
    if (packId === 'pack_dsp_cascade') return; // Always-active fallback
    setSelectedPackIds((prev) =>
      prev.includes(packId) ? prev.filter((id) => id !== packId) : [...prev, packId]
    );
  };

  // Compute the resulting stems that will be created
  const calculatedStems = Array.from(
    new Set(
      modelPacks
        .filter((p) => selectedPackIds.includes(p.id))
        .flatMap((p) => p.unlocked_stems)
    )
  );

  const durationMin = Math.max(1, (effectiveDurationMs || 180000) / 60000);
  const estimatedTimeSec = Math.round(
    selectedPackIds.reduce((sum, packId) => {
      const p = modelPacks.find((mp) => mp.id === packId);
      return sum + (p ? p.speed_estimate_sec_per_min * durationMin : 1);
    }, 0)
  );

  const handleCreate = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const project = await invoke<StemProject>('create_stem_project', {
        trackId: effectiveTrackId,
        title: projectTitle,
        requestedPacks: selectedPackIds,
      });
      onProjectCreated(project.id);
      onClose();
    } catch (err: unknown) {
      setError(String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalShell onClose={onClose} layer="studio" size="lg" labelledBy={titleId}>
      <ModalHeader
        titleId={titleId}
        title={t.stems.title}
        subtitle={`${effectiveTrackTitle} • ${effectiveTrackArtist}`}
        icon={<Layers size={20} />}
        onClose={onClose}
        closeLabel={t.common.close}
      />

      <ModalBody className="flex flex-col gap-5">
        {error && <Callout tone="danger" className="text-sm text-accent-red">{error}</Callout>}

        {/* Project name */}
        <div>
          <FieldLabel htmlFor={nameId}>{t.stems.projectName}</FieldLabel>
          <TextField id={nameId} value={projectTitle} onChange={(e) => setProjectTitle(e.target.value)} />
        </div>

        {/* Detected hardware */}
        <Card variant="inset" padding="none" className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Cpu size={18} className="text-accent-cyan" />
            <span className="text-sm text-fg-secondary">{t.stems.computeAccelerator}</span>
          </div>
          <span
            className={cn(
              'flex items-center gap-1.5 text-sm font-bold',
              capabilities?.hardware_acceleration ? 'text-accent-green' : 'text-accent-purple',
            )}
          >
            <Zap size={14} />
            {capabilities?.accelerator_device || t.stems.detectingHardware}
          </span>
        </Card>

        {/* Model package choice */}
        <div>
          <h3 className="label-caps mb-2.5">{t.stems.selectPacks}</h3>
          <div className="flex flex-col gap-2.5">
            {modelPacks.map((pack) => {
              const isSelected = selectedPackIds.includes(pack.id);
              // The built-in DSP pack is always on, so its row cannot be toggled.
              const isBuiltIn = pack.id === 'pack_dsp_cascade';
              return (
                <OptionCard
                  key={pack.id}
                  pressed={isSelected}
                  onClick={() => togglePack(pack.id)}
                  className={cn('flex-row items-center justify-between px-4 py-3', isBuiltIn && 'cursor-default')}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-fg">
                        {pack.name}
                      </span>
                      {isBuiltIn ? (
                        <Badge tone="purple" className="font-bold">{t.stems.builtInStft}</Badge>
                      ) : pack.is_installed ? (
                        <Badge tone="green" className="font-bold">{t.stems.aiReady}</Badge>
                      ) : (
                        <Badge tone="amber">{t.stems.downloadInManager}</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-fg-secondary">
                      {(t.aiModels.packs as Record<string, string>)[pack.id] ?? pack.description}
                    </p>
                  </div>

                  {isSelected ? (
                    <CheckCircle2 size={20} className="shrink-0 text-accent-pink" aria-hidden="true" />
                  ) : (
                    <span aria-hidden="true" className="size-5 shrink-0 rounded-full border-2 border-white/30" />
                  )}
                </OptionCard>
              );
            })}
          </div>
        </div>

        {/* Resulting stems preview */}
        <div>
          <h3 className="label-caps mb-2">{fmt(t.stems.outputTracks, String(calculatedStems.length))}</h3>
          <div className="flex flex-wrap gap-1.5">
            {calculatedStems.map((stem) => (
              <Badge key={stem} className="gap-1.5 px-2.5 py-1 text-xs">
                <Music size={12} className="text-accent-pink" />
                {stem}
              </Badge>
            ))}
          </div>
        </div>

        {/* Estimates (time and size) */}
        <Card variant="inset" padding="none" className="flex gap-3 px-4 py-3">
          <div className="flex flex-1 items-center gap-2 text-ui text-fg-secondary">
            <Clock size={16} className="text-accent-amber" />
            <span>{fmt(t.stems.estimatedTime, String(estimatedTimeSec))}</span>
          </div>
          <div className="flex flex-1 items-center gap-2 text-ui text-fg-secondary">
            <HardDrive size={16} className="text-accent-cyan" />
            <span>{fmt(t.stems.diskSpace, String(Math.round(calculatedStems.length * 8.5)))}</span>
          </div>
        </Card>
      </ModalBody>

      <ModalFooter>
        <Button onClick={onClose} disabled={isSubmitting}>
          {t.common.cancel}
        </Button>
        <Button variant="primary" onClick={handleCreate} disabled={isSubmitting || !projectTitle.trim()}>
          {isSubmitting ? (
            <>
              <Spinner size="sm" tone="neutral" />
              {t.stems.creatingProject}
            </>
          ) : (
            <>
              <Play size={16} fill="currentColor" />
              {t.stems.createAndMix}
            </>
          )}
        </Button>
      </ModalFooter>
    </ModalShell>
  );
};
