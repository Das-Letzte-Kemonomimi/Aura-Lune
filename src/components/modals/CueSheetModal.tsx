import React, { useId, useState } from 'react';
import { invoke, errorMessage } from '../../api/ipc';
import {
  FileCode,
  Play,
  ListPlus,
  AlertCircle,
} from '../ui/icons';
import { type Language, getTranslations } from '../../i18n';
import { fmt } from '../../utils/fmt';
import { formatTime } from '../../utils/timeFormat';
import { Button, Callout, Card, FieldLabel, IconButton, ModalBody, ModalFooter, ModalHeader, ModalShell, TextArea, TextField } from '../ui';
import { iconTileTones } from '../ui/tones';

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
  const titleId = useId();

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
    <ModalShell onClose={onClose} layer="studio" size="lg" labelledBy={titleId}>
      <ModalHeader
        titleId={titleId}
        title={loc.cueSheet.title}
        subtitle={loc.cueSheet.subtitle}
        icon={<FileCode size={20} />}
        tone="purple"
        onClose={onClose}
        closeLabel={loc.common.close}
      />

      <ModalBody>
        {error && (
          <Callout tone="danger" icon={<AlertCircle size={18} />} className="mb-4 text-sm text-accent-red">
            {error}
          </Callout>
        )}

        {!parsedSheet ? (
          <div>
            <FieldLabel htmlFor={`${titleId}-cue`}>{loc.cueSheet.pasteContent}</FieldLabel>
            <TextArea
              id={`${titleId}-cue`}
              mono
              rows={10}
              value={cueContent}
              onChange={(e) => setCueContent(e.target.value)}
              placeholder={`PERFORMER "Yuki Kajiura"\nTITLE "FictionJunction OST"\nFILE "album.flac" WAVE\n  TRACK 01 AUDIO\n    TITLE "Prologue"\n    INDEX 01 00:00:00\n  TRACK 02 AUDIO\n    TITLE "Swordland"\n    INDEX 01 02:45:00`}
            />
          </div>
        ) : (
          <div>
            {/* Album info */}
            <Callout tone="purple" className="mb-4">
              <h3 className="text-base font-semibold text-fg">{parsedSheet.album_title || 'Album CUE'}</h3>
              <p className="mt-1 text-ui text-fg-secondary">
                {parsedSheet.album_artist} {parsedSheet.date ? `(${parsedSheet.date})` : ''} •{' '}
                {fmt(loc.cueSheet.tracksCount, String(parsedSheet.tracks.length))}
              </p>
              <label className="mt-2 flex items-center gap-1.5 text-ui text-fg-secondary">
                <span>{loc.cueSheet.audioFileLabel}</span>
                <TextField
                  size="sm"
                  value={audioTargetOverride}
                  onChange={(e) => setAudioTargetOverride(e.target.value)}
                  placeholder="album.flac"
                  className="w-65"
                />
              </label>
            </Callout>

            {/* Tracks list */}
            <div className="flex max-h-85 flex-col gap-1.5 overflow-y-auto">
              {parsedSheet.tracks.map((track) => (
                <Card key={track.number} padding="none" className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-2.5">
                    <span className="w-5.5 text-ui font-bold text-accent-purple">
                      {track.number < 10 ? `0${track.number}` : track.number}
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-fg">{track.title}</div>
                      {track.performer && <div className="text-xs text-fg-secondary">{track.performer}</div>}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-fg-muted">
                      {formatTime(track.start_offset_ms)}
                      {track.duration_ms ? ` (${formatTime(track.duration_ms)})` : ''}
                    </span>
                    <IconButton
                      size="sm"
                      label={loc.cueSheet.playFromIndexTooltip}
                      onClick={() => onPlayCueTrack(audioTargetOverride, track)}
                      className={iconTileTones.purple}
                    >
                      <Play size={14} />
                    </IconButton>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </ModalBody>

      {!parsedSheet ? (
        <ModalFooter>
          <Button variant="primary" onClick={handleParse}>
            {loc.cueSheet.parseBtn}
          </Button>
        </ModalFooter>
      ) : (
        <ModalFooter className="justify-between">
          <Button variant="ghost" onClick={() => setParsedSheet(null)}>
            {loc.cueSheet.editCue}
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              onAddCueTracksToQueue(audioTargetOverride, parsedSheet.tracks);
              onClose();
            }}
          >
            <ListPlus size={16} />
            {loc.cueSheet.addAllToQueue}
          </Button>
        </ModalFooter>
      )}
    </ModalShell>
  );
};
