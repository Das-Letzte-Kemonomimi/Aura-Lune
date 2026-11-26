import React, { useState } from 'react';
import { invoke, errorMessage } from '../../api/ipc';
import {
  FileCode,
  X,
  Play,
  ListPlus,
  AlertCircle,
} from '../ui/icons';
import { type Language, getTranslations } from '../../i18n';
import { fmt } from '../../utils/fmt';
import { formatTime } from '../../utils/timeFormat';
import { ModalShell } from '../ui';

export interface CueTrackDto {
  number: number;
  title: string;
  performer: string | null;
  start_offset_ms: number;
  end_offset_ms: number | null;
  duration_ms: number | null;
}

export interface CueSheetDto {
  file_path: string;
  album_title: string | null;
  album_artist: string | null;
  genre: string | null;
  date: string | null;
  tracks: CueTrackDto[];
}

interface CueSheetModalProps {
  currentLang?: Language;
  onClose: () => void;
  onPlayCueTrack: (audioFile: string, track: CueTrackDto) => void;
  onAddCueTracksToQueue: (audioFile: string, tracks: CueTrackDto[]) => void;
}

export const CueSheetModal: React.FC<CueSheetModalProps> = ({
  currentLang = 'pl',
  onClose,
  onPlayCueTrack,
  onAddCueTracksToQueue,
}) => {
  const loc = getTranslations(currentLang);
  const [cueContent, setCueContent] = useState('');
  const [parsedSheet, setParsedSheet] = useState<CueSheetDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioTargetOverride, setAudioTargetOverride] = useState('');

  const handleParse = async () => {
    if (!cueContent.trim()) {
      setError(loc.cueSheet.provideContentError);
      return;
    }

    try {
      setError(null);
      const sheet = await invoke<CueSheetDto>('parse_cue_sheet_content', {
        cueContent,
      });
      setParsedSheet(sheet);
      if (sheet.file_path) {
        setAudioTargetOverride(sheet.file_path);
      }
    } catch (err: unknown) {
      setError(errorMessage(err) || loc.cueSheet.parseError);
    }
  };

  return (
    <ModalShell
      onClose={onClose}
      layer="studio"
      className="flex max-h-[85vh] max-w-170 flex-col overflow-hidden rounded-2xl border border-accent-purple"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/8 bg-white/2 px-6 py-4.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-purple/20 text-accent-purple">
            <FileCode size={20} />
          </div>
          <div>
            <h2 className="m-0 text-lg font-bold text-fg">
              {loc.cueSheet.title}
            </h2>
            <p className="mx-0 mt-0.5 mb-0 text-xs text-fg-secondary">
              {loc.cueSheet.subtitle}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="border-0 bg-transparent p-1.5 text-fg-secondary"
        >
          <X size={20} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {error && (
          <div
            className="mb-4 flex items-center gap-2 rounded-lg border border-accent-red/40 bg-accent-red/15 px-3.5 py-3 text-sm text-red-300"
          >
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {!parsedSheet ? (
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-200">
              {loc.cueSheet.pasteContent}
            </label>
            <textarea
              rows={10}
              value={cueContent}
              onChange={(e) => setCueContent(e.target.value)}
              placeholder={`PERFORMER "Yuki Kajiura"\nTITLE "FictionJunction OST"\nFILE "album.flac" WAVE\n  TRACK 01 AUDIO\n    TITLE "Prologue"\n    INDEX 01 00:00:00\n  TRACK 02 AUDIO\n    TITLE "Swordland"\n    INDEX 01 02:45:00`}
              className="w-full resize-y rounded-xl border border-white/10 bg-black/35 p-3 font-mono text-sm text-fg outline-none"
            />

            <div className="mt-4 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={handleParse}
                className="rounded-lg border-0 bg-accent-purple px-5.5 py-2.5 text-sm font-semibold text-fg"
              >
                {loc.cueSheet.parseBtn}
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* Header album info */}
            <div className="mb-4 rounded-xl border border-accent-purple/30 bg-accent-purple/10 px-4 py-3.5">
              <h3 className="m-0 text-base text-fg">
                {parsedSheet.album_title || 'Album CUE'}
              </h3>
              <p className="mx-0 mt-1 mb-0 text-ui text-slate-300">
                {parsedSheet.album_artist} {parsedSheet.date ? `(${parsedSheet.date})` : ''} • {fmt(loc.cueSheet.tracksCount, String(parsedSheet.tracks.length))}
              </p>
              <div className="mt-2 text-ui text-fg-secondary">
                <span>{loc.cueSheet.audioFileLabel}</span>
                <input
                  type="text"
                  value={audioTargetOverride}
                  onChange={(e) => setAudioTargetOverride(e.target.value)}
                  placeholder="album.flac"
                  className="ml-1.5 w-65 rounded-md border border-white/10 bg-black/40 px-2 py-1 text-ui text-fg"
                />
              </div>
            </div>

            {/* Tracks list */}
            <div className="flex max-h-85 flex-col gap-1.5 overflow-y-auto">
              {parsedSheet.tracks.map((track) => (
                <div
                  key={track.number}
                  className="flex items-center justify-between rounded-lg border border-white/6 bg-white/3 px-3 py-2"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-5.5 text-ui font-bold text-accent-purple">
                      {track.number < 10 ? `0${track.number}` : track.number}
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-fg">
                        {track.title}
                      </div>
                      {track.performer && (
                        <div className="text-xs text-fg-secondary">
                          {track.performer}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-fg-muted">
                      {formatTime(track.start_offset_ms)}
                      {track.duration_ms ? ` (${formatTime(track.duration_ms)})` : ''}
                    </span>
                    <button
                      onClick={() => onPlayCueTrack(audioTargetOverride, track)}
                      title={loc.cueSheet.playFromIndexTooltip}
                      className="flex items-center justify-center rounded-md border border-accent-purple/40 bg-accent-purple/20 p-1.5 text-fg"
                    >
                      <Play size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setParsedSheet(null)}
                className="rounded-lg border border-white/15 bg-transparent px-3.5 py-2 text-ui text-fg-secondary"
              >
                {loc.cueSheet.editCue}
              </button>

              <button
                type="button"
                onClick={() => {
                  onAddCueTracksToQueue(audioTargetOverride, parsedSheet.tracks);
                  onClose();
                }}
                className="flex items-center gap-1.5 rounded-lg border-0 bg-accent-purple px-4.5 py-2.5 text-sm font-semibold text-fg"
              >
                <ListPlus size={16} />
                <span>{loc.cueSheet.addAllToQueue}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
};
