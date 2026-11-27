import React, { useEffect, useId, useMemo, useState } from 'react';
import {
  Music,
  Piano,
  Layers,
  Cpu,
  BarChart2,
  Sliders,
} from '../ui/icons';
import { ChordTimelineView } from '../player/ChordTimelineView';
import { PianoRollView } from '../player/piano-roll/PianoRollView';
import { StemMixerModal } from './StemMixerModal';
import { ModelManagerModal } from './ModelManagerModal';
import { StemProjectsLibraryView } from '../../views/stems/StemProjectsLibraryView';
import { type Language, getTranslations } from '../../i18n';
import { ModalBody, ModalHeader, ModalShell, SegmentedControl, type SegmentedItem } from '../ui';

type AnalysisTab = 'chords' | 'pianoroll' | 'stems' | 'projects' | 'models';

export interface MusicAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackId?: number;
  trackPath?: string;
  trackTitle?: string;
  trackArtist?: string;
  /** Fallback position (until the first live status); the cards read the live position themselves. */
  currentTimeMs: number;
  durationMs?: number;
  isPlaying?: boolean;
  /** Speed of the source time relative to real time (see `playbackSpeed`). */
  playbackSpeed?: number;
  onNotify?: (message: string, isError?: boolean) => void;
  pitchSemitones?: number;
  onSeek: (positionMs: number) => void;
  onSetLoop?: (startMs: number, endMs: number) => void;
  initialTab?: AnalysisTab;
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
  const titleId = useId();
  const displayTitle = trackTitle || t.player.track;
  const displayArtist = trackArtist || t.player.artist;
  const [activeTab, setActiveTab] = useState<AnalysisTab>(
    initialTab
  );

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const tabItems = useMemo<SegmentedItem<AnalysisTab>[]>(
    () => [
      { value: 'chords', label: t.analysis.tabChords, icon: <Music size={14} /> },
      { value: 'pianoroll', label: t.analysis.tabPianoRoll, icon: <Piano size={14} /> },
      { value: 'stems', label: t.analysis.tabStems, icon: <Layers size={14} /> },
      { value: 'projects', label: t.analysis.tabProjects, icon: <Sliders size={14} /> },
      { value: 'models', label: t.analysis.tabModels, icon: <Cpu size={14} /> },
    ],
    [t],
  );

  if (!isOpen) return null;

  return (
    <ModalShell onClose={onClose} layer="studio" size="full" labelledBy={titleId}>
      <ModalHeader
        titleId={titleId}
        title={t.analysis.title}
        subtitle={<span className="block truncate">{displayTitle} • {displayArtist}</span>}
        icon={<BarChart2 size={20} />}
        onClose={onClose}
        closeLabel={t.common.close}
        actions={
          <SegmentedControl
            label={t.analysis.title}
            items={tabItems}
            value={activeTab}
            onChange={setActiveTab}
            className="overflow-x-auto"
          />
        }
      />

      <ModalBody className="p-5">
        {activeTab === 'chords' && (
          <ChordTimelineView
            trackId={trackId}
            trackPath={trackPath}
            trackTitle={displayTitle}
            trackArtist={displayArtist}
            currentTimeMs={currentTimeMs}
            durationMs={durationMs}
            pitchSemitones={pitchSemitones}
            playbackSpeed={playbackSpeed}
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
      </ModalBody>
    </ModalShell>
  );
};
