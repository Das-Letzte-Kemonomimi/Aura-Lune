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
      } catch (err: any) {
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
    } catch (err: any) {
      setError(String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(5, 5, 10, 0.85)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '680px',
          background: 'linear-gradient(135deg, rgba(20, 15, 35, 0.96), rgba(10, 8, 20, 0.98))',
          borderRadius: '24px',
          border: '1px solid rgba(236, 72, 153, 0.35)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 35px rgba(236, 72, 153, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          overflow: 'hidden',
          animation: 'fadeInScale 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Nagłówek */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 15px rgba(236, 72, 153, 0.4)',
              }}
            >
              <Layers size={22} color="#ffffff" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc' }}>
                {t.stems.title}
              </h2>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
                {effectiveTrackTitle} • {effectiveTrackArtist}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '50%',
              display: 'flex',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Zawartość z przewijaniem */}
        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {error && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '12px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                fontSize: '0.85rem',
              }}
            >
              {error}
            </div>
          )}

          {/* Nazwa projektu */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '8px' }}>
              {t.stems.projectName}
            </label>
            <input
              type="text"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '10px',
                color: '#f8fafc',
                fontSize: '0.95rem',
                outline: 'none',
              }}
            />
          </div>

          {/* Wykryty sprzęt */}
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Cpu size={18} color="#38bdf8" />
              <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>{t.stems.computeAccelerator}</span>
            </div>
            <span
              style={{
                fontSize: '0.85rem',
                fontWeight: 700,
                color: capabilities?.hardware_acceleration ? '#34d399' : '#a855f7',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Zap size={14} />
              {capabilities?.accelerator_device || t.stems.detectingHardware}
            </span>
          </div>

          {/* Wybór pakietów modeli */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '10px' }}>
              {t.stems.selectPacks}
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {modelPacks.map((pack) => {
                const isSelected = selectedPackIds.includes(pack.id);
                return (
                  <div
                    key={pack.id}
                    onClick={() => togglePack(pack.id)}
                    style={{
                      padding: '12px 16px',
                      borderRadius: '12px',
                      background: isSelected ? 'rgba(236, 72, 153, 0.12)' : 'rgba(15, 23, 42, 0.5)',
                      border: isSelected ? '1px solid rgba(236, 72, 153, 0.45)' : '1px solid rgba(255, 255, 255, 0.08)',
                      cursor: pack.id === 'pack_dsp_cascade' ? 'default' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f8fafc' }}>
                          {pack.name}
                        </span>
                        {pack.id === 'pack_dsp_cascade' ? (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              padding: '2px 6px',
                              borderRadius: '6px',
                              background: 'rgba(168, 85, 247, 0.2)',
                              color: '#c084fc',
                              fontWeight: 700,
                            }}
                          >
                            {t.stems.builtInStft}
                          </span>
                        ) : pack.is_installed ? (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              padding: '2px 6px',
                              borderRadius: '6px',
                              background: 'rgba(52, 211, 153, 0.2)',
                              color: '#34d399',
                              fontWeight: 700,
                            }}
                          >
                            {t.stems.aiReady}
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              padding: '2px 6px',
                              borderRadius: '6px',
                              background: 'rgba(245, 158, 11, 0.15)',
                              color: '#fbbf24',
                              fontWeight: 600,
                            }}
                          >
                            {t.stems.downloadInManager}
                          </span>
                        )}
                      </div>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                        {pack.description}
                      </p>
                    </div>

                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '6px',
                        border: isSelected ? 'none' : '2px solid rgba(255, 255, 255, 0.3)',
                        background: isSelected ? 'var(--accent-pink)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {isSelected && <CheckCircle2 size={16} color="#ffffff" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Podgląd wynikowych stemów */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '8px' }}>
              {t.stems.outputTracks.replace('{0}', String(calculatedStems.length))}
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {calculatedStems.map((stem) => (
                <span
                  key={stem}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    fontSize: '0.75rem',
                    color: '#e2e8f0',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <Music size={12} color="var(--accent-pink)" />
                  {stem}
                </span>
              ))}
            </div>
          </div>

          {/* Szacunki (Czas i Rozmiar) */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              padding: '12px 16px',
              borderRadius: '12px',
              background: 'rgba(15, 23, 42, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
            }}
          >
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#94a3b8' }}>
              <Clock size={16} color="#f59e0b" />
              <span>{t.stems.estimatedTime.replace('{0}', String(estimatedTimeSec))}</span>
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#94a3b8' }}>
              <HardDrive size={16} color="#38bdf8" />
              <span>{t.stems.diskSpace.replace('{0}', String(Math.round(calculatedStems.length * 8.5)))}</span>
            </div>
          </div>
        </div>

        {/* Przyciski dolne */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
          }}
        >
          <button
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#cbd5e1',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {t.common.cancel}
          </button>

          <button
            onClick={handleCreate}
            disabled={isSubmitting || !projectTitle.trim()}
            style={{
              padding: '10px 22px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
              border: 'none',
              color: '#ffffff',
              fontWeight: 700,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 15px rgba(236, 72, 153, 0.35)',
            }}
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
      </div>
    </div>
  );
};
