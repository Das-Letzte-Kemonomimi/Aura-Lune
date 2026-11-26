import React, { useState, useEffect, useMemo } from 'react';
import {
  Music,
  Piano,
  Layers,
  Cpu,
  X,
  BarChart2,
  Sliders,
} from 'lucide-react';
import { ChordTimelineView } from '../player/ChordTimelineView';
import { PianoRollView } from '../player/piano-roll/PianoRollView';
import { StemMixerModal } from './StemMixerModal';
import { ModelManagerModal } from './ModelManagerModal';
import { StemProjectsLibraryView } from '../../views/stems/StemProjectsLibraryView';
import { type Language, getTranslations } from '../../i18n';
import { ModalShell } from '../ui';

export interface MusicAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackId?: number;
  trackPath?: string;
  trackTitle?: string;
  trackArtist?: string;
  /** Pozycja zapasowa (do pierwszego statusu na żywo); karty czytają pozycję na żywo same. */
  currentTimeMs: number;
  durationMs?: number;
  isPlaying?: boolean;
  /** Prędkość czasu źródła względem rzeczywistego (zob. `playbackSpeed`). */
  playbackSpeed?: number;
  onNotify?: (message: string, isError?: boolean) => void;
  pitchSemitones?: number;
  onSeek: (positionMs: number) => void;
  onSetLoop?: (startMs: number, endMs: number) => void;
  initialTab?: 'chords' | 'pianoroll' | 'stems' | 'projects' | 'models';
  onOpenStemProject?: (projectId: number) => void;
  onOpenCreateProject?: () => void;
  currentLang?: Language;
}

export const MusicAnalysisModal: React.FC<MusicAnalysisModalProps> = ({
  isOpen,
  onClose,
  trackId,
  trackPath,
  trackTitle,
  trackArtist,
  currentTimeMs,
  durationMs = 180000,
  isPlaying = false,
  playbackSpeed,
  onNotify,
  pitchSemitones = 0,
  onSeek,
  onSetLoop,
  initialTab = 'chords',
  onOpenStemProject,
  onOpenCreateProject,
  currentLang = 'en',
}) => {
  const t = getTranslations(currentLang);
  const displayTitle = trackTitle || t.player.track;
  const displayArtist = trackArtist || t.player.artist;
  const [activeTab, setActiveTab] = useState<'chords' | 'pianoroll' | 'stems' | 'projects' | 'models'>(
    initialTab
  );

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const tabItems = useMemo<Array<{
    id: 'chords' | 'pianoroll' | 'stems' | 'projects' | 'models';
    label: string;
    icon: React.ReactNode;
    color: string;
    activeBg: string;
    activeBorder: string;
  }>>(() => [
      {
        id: 'chords',
        label: t.analysis.tabChords,
        icon: <Music size={14} />,
        color: '#f43f5e',
        activeBg: 'rgba(244, 63, 94, 0.18)',
        activeBorder: 'rgba(244, 63, 94, 0.45)',
      },
      {
        id: 'pianoroll',
        label: t.analysis.tabPianoRoll,
        icon: <Piano size={14} />,
        color: '#c084fc',
        activeBg: 'rgba(192, 132, 252, 0.18)',
        activeBorder: 'rgba(192, 132, 252, 0.45)',
      },
      {
        id: 'stems',
        label: t.analysis.tabStems,
        icon: <Layers size={14} />,
        color: '#38bdf8',
        activeBg: 'rgba(56, 189, 248, 0.18)',
        activeBorder: 'rgba(56, 189, 248, 0.45)',
      },
      {
        id: 'projects',
        label: t.analysis.tabProjects,
        icon: <Sliders size={14} />,
        color: '#10b981',
        activeBg: 'rgba(16, 185, 129, 0.18)',
        activeBorder: 'rgba(16, 185, 129, 0.45)',
      },
      {
        id: 'models',
        label: t.analysis.tabModels,
        icon: <Cpu size={14} />,
        color: '#f59e0b',
        activeBg: 'rgba(245, 158, 11, 0.18)',
        activeBorder: 'rgba(245, 158, 11, 0.45)',
      },
    ], [t]);

  if (!isOpen) return null;

  return (
    <ModalShell
      onClose={onClose}
      layer="studio"
      className="flex h-[88vh] max-h-230 max-w-300 flex-col overflow-hidden rounded-3xl border border-accent-purple/35 text-fg"
    >
      {/* Górny pasek narzędziowy studia analizy */}
      <div
        className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-white/8 bg-black/35 px-6 py-4"
      >
        {/* Tytuł studia i odtwarzany utwór */}
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-xl border border-accent-pink/35 bg-linear-135 from-accent-pink/25 to-accent-purple/25 text-accent-pink shadow-halo-md shadow-accent-pink/20"
          >
            <BarChart2 size={20} />
          </div>
          <div className="min-w-0">
            <h2
              className="m-0 bg-linear-to-r bg-clip-text from-accent-pink via-purple-400 to-sky-400 text-lg font-extrabold tracking-tight text-transparent"
            >
              {t.analysis.title}
            </h2>
            <p className="mx-0 mt-0.5 mb-0 max-w-95 truncate text-xs text-fg-secondary">
              {displayTitle} • {displayArtist}
            </p>
          </div>
        </div>

        {/* Przełącznik zakładek */}
        <div className="flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-white/8 bg-black/40 p-1">
          {tabItems.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-ui font-bold whitespace-nowrap transition-all duration-200"
                style={{
                  border: isActive ? `1px solid ${tab.activeBorder}` : '1px solid transparent',
                  background: isActive ? tab.activeBg : 'transparent',
                  color: isActive ? tab.color : '#94a3b8',
                  boxShadow: isActive ? `0 0 14px ${tab.activeBg}` : 'none',
                }}
              >
                <span className="flex items-center" style={{ color: isActive ? tab.color : '#64748b' }}>
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Przycisk zamknięcia [✕] */}
        <button
          onClick={onClose}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/6 text-fg-secondary transition-all duration-200"
          title={t.common.close}
        >
          <X size={18} />
        </button>
      </div>

      {/* Główna zawartość wybranej zakładki */}
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {activeTab === 'chords' && (
          <ChordTimelineView
            trackId={trackId}
            trackPath={trackPath}
            trackTitle={displayTitle}
            trackArtist={displayArtist}
            currentTimeMs={currentTimeMs}
            durationMs={durationMs}
            pitchSemitones={pitchSemitones}
            onSeek={onSeek}
            onSetLoop={onSetLoop}
            currentLang={currentLang}
          />
        )}

        {activeTab === 'pianoroll' && (
          <PianoRollView
            trackId={trackId}
            trackPath={trackPath}
            trackTitle={displayTitle}
            currentTimeMs={currentTimeMs}
            durationMs={durationMs}
            isPlaying={isPlaying}
            speed={playbackSpeed}
            onSeek={onSeek}
            onNotify={onNotify}
            currentLang={currentLang}
          />
        )}

        {activeTab === 'stems' && (
          <StemMixerModal
            isOpen={true}
            onClose={onClose}
            trackId={trackId}
            trackPath={trackPath}
            trackTitle={displayTitle}
            embedded={true}
            currentLang={currentLang}
          />
        )}

        {activeTab === 'projects' && (
          <div className="h-full overflow-y-auto">
            <StemProjectsLibraryView
              currentLang={currentLang}
              onOpenProject={(pid) => {
                onClose();
                onOpenStemProject?.(pid);
              }}
              onOpenCreateProject={() => {
                onClose();
                onOpenCreateProject?.();
              }}
            />
          </div>
        )}

        {activeTab === 'models' && (
          <ModelManagerModal
            isOpen={true}
            onClose={onClose}
            embedded={true}
            currentLang={currentLang}
          />
        )}
      </div>
    </ModalShell>
  );
};
