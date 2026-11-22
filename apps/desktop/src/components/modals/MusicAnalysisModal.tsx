import React, { useState, useEffect } from 'react';
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
import { PianoRollCanvas } from '../player/PianoRollCanvas';
import { StemMixerModal } from './StemMixerModal';
import { ModelManagerModal } from './ModelManagerModal';
import { StemProjectsLibraryView } from '../../views/stems/StemProjectsLibraryView';
import { type Language, getTranslations } from '../../i18n';
import { useLivePositionMs } from '../../state/livePlayback';

export interface MusicAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackId?: number;
  trackPath?: string;
  trackTitle?: string;
  trackArtist?: string;
  currentTimeMs: number;
  durationMs?: number;
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
  currentTimeMs: currentTimeMsProp,
  durationMs = 180000,
  pitchSemitones = 0,
  onSeek,
  onSetLoop,
  initialTab = 'chords',
  onOpenStemProject,
  onOpenCreateProject,
  currentLang = 'en',
}) => {
  // Pozycja/spektrum na żywo (livePlayback) — renderuje się ten komponent, nie cała aplikacja.
  const currentTimeMs = useLivePositionMs(currentTimeMsProp);
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

  if (!isOpen) return null;

  const tabItems: Array<{
    id: 'chords' | 'pianoroll' | 'stems' | 'projects' | 'models';
    label: string;
    icon: React.ReactNode;
    color: string;
    activeBg: string;
    activeBorder: string;
  }> = [
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
    ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(5, 5, 12, 0.86)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
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
          maxWidth: '1200px',
          height: '88vh',
          maxHeight: '920px',
          background: 'linear-gradient(145deg, rgba(18, 20, 36, 0.98), rgba(10, 12, 24, 0.99))',
          borderRadius: '24px',
          border: '1px solid rgba(168, 85, 247, 0.35)',
          boxShadow: '0 25px 65px rgba(0, 0, 0, 0.9), 0 0 35px rgba(168, 85, 247, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#f8fafc',
          animation: 'fadeInScale 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Górny pasek narzędziowy studia analizy */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(0, 0, 0, 0.35)',
            flexShrink: 0,
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          {/* Tytuł studia i odtwarzany utwór */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.25), rgba(168, 85, 247, 0.25))',
                border: '1px solid rgba(244, 63, 94, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f43f5e',
                boxShadow: '0 0 15px rgba(244, 63, 94, 0.2)',
                flexShrink: 0,
              }}
            >
              <BarChart2 size={20} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: '1.15rem',
                  fontWeight: 800,
                  background: 'linear-gradient(90deg, #f43f5e, #c084fc, #38bdf8)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  letterSpacing: '-0.01em',
                }}
              >
                {t.analysis.title}
              </h2>
              <p
                style={{
                  margin: '2px 0 0 0',
                  fontSize: '0.75rem',
                  color: '#94a3b8',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '380px',
                }}
              >
                {displayTitle} • {displayArtist}
              </p>
            </div>
          </div>

          {/* Przełącznik zakładek */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px',
              borderRadius: '14px',
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              overflowX: 'auto',
            }}
          >
            {tabItems.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 13px',
                    borderRadius: '10px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    border: isActive ? `1px solid ${tab.activeBorder}` : '1px solid transparent',
                    background: isActive ? tab.activeBg : 'transparent',
                    color: isActive ? tab.color : '#94a3b8',
                    boxShadow: isActive ? `0 0 14px ${tab.activeBg}` : 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', color: isActive ? tab.color : '#64748b' }}>
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
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
              flexShrink: 0,
            }}
            title={t.common.close}
          >
            <X size={18} />
          </button>
        </div>

        {/* Główna zawartość wybranej zakładki */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px' }}>
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
            <PianoRollCanvas
              trackId={trackId}
              trackPath={trackPath}
              trackTitle={displayTitle}
              currentTimeMs={currentTimeMs}
              durationMs={durationMs}
              onSeek={onSeek}
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
            <div style={{ height: '100%', overflowY: 'auto' }}>
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
      </div>
    </div>
  );
};
