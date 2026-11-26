import React, { useState, useEffect } from 'react';
import {
  Layers,
  Cpu,
  Zap,
  CheckCircle2,
  HardDrive,
  Clock,
  Sparkles,
  X,
  Play,
  Music,
} from 'lucide-react';
import { invoke } from '../../api/ipc';
import type { ModelPackInfo, AnalysisCapabilities } from '../../types/analysis';
import { getTranslations, type Language } from '../../i18n';
import { fmt } from '../../utils/fmt';
import { cn } from '../../utils/cn';
import { ModalShell } from '../ui';

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
        console.error('Błąd pobierania pakietów:', err);
      }
    };

    loadData();
  }, [isOpen, effectiveTrackTitle, t.stems.title]);

  if (!isOpen) return null;

  const togglePack = (packId: string) => {
    if (packId === 'pack_dsp_cascade') return; // Zawsze aktywny fallback
    setSelectedPackIds((prev) =>
      prev.includes(packId) ? prev.filter((id) => id !== packId) : [...prev, packId]
    );
  };

  // Obliczenie wypadkowych stemów, które powstaną
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
      const project = await invoke<any>('create_stem_project', {
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
    <ModalShell
      onClose={onClose}
      layer="studio"
      className="flex max-h-[90vh] max-w-170 flex-col overflow-hidden rounded-3xl border border-pink-500/35"
    >
      {/* Nagłówek */}
      <div className="flex items-center justify-between border-b border-white/8 px-6 py-5">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-135 from-pink-500 to-violet-500 shadow-lift shadow-pink-500/40"
          >
            <Layers size={22} className="text-fg" />
          </div>
          <div>
            <h2 className="m-0 text-xl font-extrabold text-fg">
              {t.stems.title}
            </h2>
            <p className="m-0 text-sm text-fg-secondary">
              {effectiveTrackTitle} • {effectiveTrackArtist}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex rounded-full border-0 bg-transparent p-2 text-fg-secondary"
        >
          <X size={20} />
        </button>
      </div>

      {/* Zawartość z przewijaniem */}
      <div className="flex flex-col gap-5 overflow-y-auto p-6">
        {error && (
          <div className="rounded-xl border border-accent-red/30 bg-accent-red/15 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Nazwa projektu */}
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-300">
            {t.stems.projectName}
          </label>
          <input
            type="text"
            value={projectTitle}
            onChange={(e) => setProjectTitle(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-slate-900/70 px-3.5 py-2.5 text-md text-fg outline-none"
          />
        </div>

        {/* Wykryty sprzęt */}
        <div className="flex items-center justify-between rounded-xl border border-white/6 bg-white/3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Cpu size={18} className="text-sky-400" />
            <span className="text-sm text-slate-300">{t.stems.computeAccelerator}</span>
          </div>
          <span
            className={cn(
              'flex items-center gap-1.5 text-sm font-bold',
              (capabilities?.hardware_acceleration) ? 'text-emerald-400' : 'text-accent-purple',
            )}
          >
            <Zap size={14} />
            {capabilities?.accelerator_device || t.stems.detectingHardware}
          </span>
        </div>

        {/* Wybór pakietów modeli */}
        <div>
          <label className="mb-2.5 block text-sm font-semibold text-slate-300">
            {t.stems.selectPacks}
          </label>
          <div className="flex flex-col gap-2.5">
            {modelPacks.map((pack) => {
              const isSelected = selectedPackIds.includes(pack.id);
              return (
                <div
                  key={pack.id}
                  onClick={() => togglePack(pack.id)}
                  className={cn(
                    'flex items-center justify-between rounded-xl border px-4 py-3 transition-all duration-200',
                    isSelected ? 'bg-pink-500/10' : 'bg-slate-900/50',
                    isSelected ? 'border-pink-500/45' : 'border-white/8',
                    pack.id === 'pack_dsp_cascade' ? 'cursor-default' : 'cursor-pointer',
                  )}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-fg">
                        {pack.name}
                      </span>
                      {pack.id === 'pack_dsp_cascade' ? (
                        <span
                          className="rounded-md bg-accent-purple/20 px-1.5 py-0.5 text-xxs font-bold text-purple-400"
                        >
                          {t.stems.builtInStft}
                        </span>
                      ) : pack.is_installed ? (
                        <span
                          className="rounded-md bg-emerald-400/20 px-1.5 py-0.5 text-xxs font-bold text-emerald-400"
                        >
                          {t.stems.aiReady}
                        </span>
                      ) : (
                        <span
                          className="rounded-md bg-accent-amber/15 px-1.5 py-0.5 text-xxs font-semibold text-amber-400"
                        >
                          {t.stems.downloadInManager}
                        </span>
                      )}
                    </div>
                    <p className="mx-0 mt-1 mb-0 text-xs text-fg-secondary">
                      {(t.aiModels.packs as Record<string, string>)[pack.id] ?? pack.description}
                    </p>
                  </div>

                  <div
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-md',
                      isSelected ? 'border-0' : 'border-2 border-white/30',
                      isSelected ? 'bg-accent-pink' : 'bg-transparent',
                    )}
                  >
                    {isSelected && <CheckCircle2 size={16} className="text-fg" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Podgląd wynikowych stemów */}
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-300">
            {fmt(t.stems.outputTracks, String(calculatedStems.length))}
          </label>
          <div className="flex flex-wrap gap-1.5">
            {calculatedStems.map((stem) => (
              <span
                key={stem}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/6 px-2.5 py-1 text-xs font-semibold text-slate-200"
              >
                <Music size={12} className="text-accent-pink" />
                {stem}
              </span>
            ))}
          </div>
        </div>

        {/* Szacunki (Czas i Rozmiar) */}
        <div className="flex gap-3 rounded-xl border border-white/5 bg-slate-900/40 px-4 py-3">
          <div className="flex flex-1 items-center gap-2 text-ui text-fg-secondary">
            <Clock size={16} className="text-accent-amber" />
            <span>{fmt(t.stems.estimatedTime, String(estimatedTimeSec))}</span>
          </div>
          <div className="flex flex-1 items-center gap-2 text-ui text-fg-secondary">
            <HardDrive size={16} className="text-sky-400" />
            <span>{fmt(t.stems.diskSpace, String(Math.round(calculatedStems.length * 8.5)))}</span>
          </div>
        </div>
      </div>

      {/* Przyciski dolne */}
      <div className="flex justify-end gap-3 border-t border-white/8 px-6 py-4">
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="rounded-xl border border-white/10 bg-white/5 px-4.5 py-2.5 font-semibold text-slate-300"
        >
          {t.common.cancel}
        </button>

        <button
          onClick={handleCreate}
          disabled={isSubmitting || !projectTitle.trim()}
          className={cn(
            'flex items-center gap-2 rounded-xl border-0 bg-linear-135 from-pink-500 to-violet-500 px-5.5 py-2.5 font-bold text-fg shadow-lift shadow-pink-500/35',
            isSubmitting ? 'cursor-not-allowed' : 'cursor-pointer',
          )}
        >
          {isSubmitting ? (
            <>
              <Sparkles size={16} className="animate-spin" />
              {t.stems.creatingProject}
            </>
          ) : (
            <>
              <Play size={16} fill="#ffffff" />
              {t.stems.createAndMix}
            </>
          )}
        </button>
      </div>
    </ModalShell>
  );
};
