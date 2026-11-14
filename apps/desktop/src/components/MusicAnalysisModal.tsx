import React, { useState } from 'react';
import {
  Music,
  Piano,
  Layers,
  Cpu,
  X,
  BarChart2,
  Sliders,
} from 'lucide-react';
import { ChordTimelineView } from './ChordTimelineView';
import { PianoRollCanvas } from './PianoRollCanvas';
import { StemMixerModal } from './StemMixerModal';
import { ModelManagerModal } from './ModelManagerModal';
import { StemProjectsLibraryView } from './StemProjectsLibraryView';

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
}

export const MusicAnalysisModal: React.FC<MusicAnalysisModalProps> = ({
  isOpen,
  onClose,
  trackId,
  trackPath,
  trackTitle = 'Utwór',
  trackArtist = 'Wykonawca',
  currentTimeMs,
  durationMs = 180000,
  pitchSemitones = 0,
  onSeek,
  onSetLoop,
  initialTab = 'chords',
  onOpenStemProject,
  onOpenCreateProject,
}) => {
  const [activeTab, setActiveTab] = useState<'chords' | 'pianoroll' | 'stems' | 'projects' | 'models'>(
    initialTab
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="bg-slate-900/95 border border-slate-700/60 rounded-2xl w-full max-w-5xl h-[88vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Górny pasek nawigacji zakładek */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/60 bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-pink-500/20 to-purple-500/20 text-pink-400 border border-pink-500/30">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold bg-gradient-to-r from-pink-400 via-purple-300 to-cyan-400 bg-clip-text text-transparent">
                Music Analysis Studio
              </h2>
              <p className="text-[11px] text-slate-400 truncate max-w-sm">
                {trackTitle} • {trackArtist}
              </p>
            </div>
          </div>

          {/* Przełącznik zakładek */}
          <div className="flex items-center space-x-1.5 p-1 rounded-xl bg-slate-900 border border-slate-700/70">
            <button
              onClick={() => setActiveTab('chords')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'chords'
                  ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40 shadow-sm shadow-pink-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Music className="w-3.5 h-3.5" />
              <span>Akordy & Harmonia</span>
            </button>

            <button
              onClick={() => setActiveTab('pianoroll')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'pianoroll'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm shadow-purple-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Piano className="w-3.5 h-3.5" />
              <span>Piano-Roll & MIDI</span>
            </button>

            <button
              onClick={() => setActiveTab('stems')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'stems'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Stemy & Karaoke</span>
            </button>

            <button
              onClick={() => setActiveTab('projects')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'projects'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Projekty Stemów</span>
            </button>

            <button
              onClick={() => setActiveTab('models')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'models'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Modele AI</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Zawartość wybranej zakładki */}
        <div className="flex-1 overflow-hidden p-4">
          {activeTab === 'chords' && (
            <ChordTimelineView
              trackId={trackId}
              trackPath={trackPath}
              trackTitle={trackTitle}
              trackArtist={trackArtist}
              currentTimeMs={currentTimeMs}
              durationMs={durationMs}
              pitchSemitones={pitchSemitones}
              onSeek={onSeek}
              onSetLoop={onSetLoop}
            />
          )}

          {activeTab === 'pianoroll' && (
            <PianoRollCanvas
              trackId={trackId}
              trackPath={trackPath}
              trackTitle={trackTitle}
              currentTimeMs={currentTimeMs}
              durationMs={durationMs}
              onSeek={onSeek}
            />
          )}

          {activeTab === 'stems' && (
            <StemMixerModal
              isOpen={true}
              onClose={() => {}}
              trackId={trackId}
              trackPath={trackPath}
              trackTitle={trackTitle}
            />
          )}

          {activeTab === 'projects' && (
            <div className="h-full overflow-y-auto">
              <StemProjectsLibraryView
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
            <ModelManagerModal isOpen={true} onClose={() => {}} />
          )}
        </div>
      </div>
    </div>
  );
};

