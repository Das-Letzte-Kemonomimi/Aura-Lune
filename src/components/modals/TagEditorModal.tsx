import React, { useEffect, useId, useState } from 'react';
import { invoke, errorMessage } from '../../api/ipc';
import { Save, Tag as TagIcon, Check, AlertCircle, Sparkles } from '../ui/icons';
import { type Language, getTranslations } from '../../i18n';
import { fmt } from '../../utils/fmt';
import { formatBytes } from '../../utils/fileSizeFormat';
import {
  Badge,
  Button,
  Callout,
  Card,
  FieldLabel,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalShell,
  OptionCard,
  Spinner,
  TextArea,
  TextField,
} from '../ui';

export interface TrackMetadataFullDto {
  title: string;
  artist: string;
  album: string | null;
  album_artist: string | null;
  year: number | null;
  genre: string | null;
  track_no: number | null;
  track_total: number | null;
  disc_no: number | null;
  disc_total: number | null;
  comment: string | null;
}

export interface TrackFingerprintMatchDto {
  acoustid: string;
  recording_mbid: string | null;
  release_mbid: string | null;
  title: string;
  artist: string;
  album: string | null;
  album_artist: string | null;
  year: number | null;
  track_no: number | null;
  track_total: number | null;
  disc_no: number | null;
  score: number;
}

interface TagEditorModalProps {
  trackId: number;
  filePath: string;
  format?: string;
  bitDepth?: number | null;
  sampleRate?: number | null;
  channels?: number | null;
  fileSize?: number | null;
  currentLang?: Language;
  onClose: () => void;
  onSaveSuccess: () => void;
}

/** Label above one tag field. */
function TagField({ id, label, className, children }: { id: string; label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children}
    </div>
  );
}

/** "Number / total" pair (track 3 / 12, disc 1 / 2). The first field takes the label's id. */
function NumberPair({
  id,
  value,
  onChange,
  total,
  onTotalChange,
  totalLabel,
  totalPlaceholder,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  total: string;
  onTotalChange: (value: string) => void;
  totalLabel: string;
  totalPlaceholder: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <TextField id={id} type="number" min={1} value={value} onChange={(e) => onChange(e.target.value)} placeholder="1" className="flex-1" />
      <span aria-hidden="true" className="text-fg-muted">
        /
      </span>
      <TextField
        type="number"
        min={1}
        aria-label={`${totalLabel} (total)`}
        value={total}
        onChange={(e) => onTotalChange(e.target.value)}
        placeholder={totalPlaceholder}
        className="flex-1"
      />
    </div>
  );
}


export const TagEditorModal: React.FC<TagEditorModalProps> = ({
  trackId,
  filePath,
  format,
  bitDepth,
  sampleRate,
  channels,
  fileSize,
  currentLang = 'pl',
  onClose,
  onSaveSuccess,
}) => {
  const loc = getTranslations(currentLang);
  const titleId = useId();
  const formId = useId();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [albumArtist, setAlbumArtist] = useState('');
  const [year, setYear] = useState<string>('');
  const [genre, setGenre] = useState('');
  const [trackNo, setTrackNo] = useState<string>('');
  const [trackTotal, setTrackTotal] = useState<string>('');
  const [discNo, setDiscNo] = useState<string>('');
  const [discTotal, setDiscTotal] = useState<string>('');
  const [comment, setComment] = useState('');

  // AcoustID state
  const [identifying, setIdentifying] = useState(false);
  const [fingerprintMatches, setFingerprintMatches] = useState<TrackFingerprintMatchDto[]>([]);
  const [selectedMatchIndex, setSelectedMatchIndex] = useState<number | null>(null);
  const [identifyMessage, setIdentifyMessage] = useState<string | null>(null);

  const applyCandidate = (c: TrackFingerprintMatchDto) => {
    setTitle(c.title);
    setArtist(c.artist);
    if (c.album) setAlbum(c.album);
    if (c.album_artist) setAlbumArtist(c.album_artist);
    if (c.year != null) setYear(c.year.toString());
    if (c.track_no != null) setTrackNo(c.track_no.toString());
    if (c.track_total != null) setTrackTotal(c.track_total.toString());
    if (c.disc_no != null) setDiscNo(c.disc_no.toString());
  };

  const handleIdentifyFingerprint = async () => {
    try {
      setIdentifying(true);
      setError(null);
      setIdentifyMessage(null);
      setFingerprintMatches([]);
      setSelectedMatchIndex(null);

      const matches = await invoke<TrackFingerprintMatchDto[]>('identify_track_fingerprint', {
        path: filePath,
      });

      if (!matches || matches.length === 0) {
        setIdentifyMessage(loc.tagEditor.acoustIdNotFound);
        return;
      }

      setFingerprintMatches(matches);
      setSelectedMatchIndex(0);
      applyCandidate(matches[0]);

      setIdentifyMessage(
        fmt(loc.tagEditor.acoustIdIdentified, matches[0].artist, matches[0].title, String(matches[0].score))
      );
    } catch (err: unknown) {
      setError(errorMessage(err) || loc.tagEditor.acoustIdError);
    } finally {
      setIdentifying(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const loadMetadata = async () => {
      try {
        setLoading(true);
        setError(null);
        const meta = await invoke<TrackMetadataFullDto>('get_track_metadata', { path: filePath });
        if (!isMounted) return;
        setTitle(meta.title || '');
        setArtist(meta.artist || '');
        setAlbum(meta.album || '');
        setAlbumArtist(meta.album_artist || '');
        setYear(meta.year != null ? meta.year.toString() : '');
        setGenre(meta.genre || '');
        setTrackNo(meta.track_no != null ? meta.track_no.toString() : '');
        setTrackTotal(meta.track_total != null ? meta.track_total.toString() : '');
        setDiscNo(meta.disc_no != null ? meta.disc_no.toString() : '');
        setDiscTotal(meta.disc_total != null ? meta.disc_total.toString() : '');
        setComment(meta.comment || '');
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(errorMessage(err) || loc.tagEditor.readError);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadMetadata();
    return () => {
      isMounted = false;
    };
  }, [filePath, loc.tagEditor.readError]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !artist.trim()) {
      setError(loc.tagEditor.emptyTitleArtistError);
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const payload: TrackMetadataFullDto = {
        title: title.trim(),
        artist: artist.trim(),
        album: album.trim() ? album.trim() : null,
        album_artist: albumArtist.trim() ? albumArtist.trim() : null,
        year: year.trim() && !isNaN(parseInt(year, 10)) ? parseInt(year, 10) : null,
        genre: genre.trim() ? genre.trim() : null,
        track_no: trackNo.trim() && !isNaN(parseInt(trackNo, 10)) ? parseInt(trackNo, 10) : null,
        track_total: trackTotal.trim() && !isNaN(parseInt(trackTotal, 10)) ? parseInt(trackTotal, 10) : null,
        disc_no: discNo.trim() && !isNaN(parseInt(discNo, 10)) ? parseInt(discNo, 10) : null,
        disc_total: discTotal.trim() && !isNaN(parseInt(discTotal, 10)) ? parseInt(discTotal, 10) : null,
        comment: comment.trim() ? comment.trim() : null,
      };

      await invoke('update_track_metadata', {
        trackId,
        path: filePath,
        meta: payload,
      });

      setSavedSuccess(true);
      setTimeout(() => {
        onSaveSuccess();
        onClose();
      }, 700);
    } catch (err: unknown) {
      setError(errorMessage(err) || loc.tagEditor.saveError);
    } finally {
      setSaving(false);
    }
  };

  // Audio properties shown above the form; unknown ones are left out.
  const specs = (
    [
      ['Format', format?.toUpperCase() || 'AUDIO'],
      bitDepth ? ['Bit depth', `${bitDepth}-bit`] : null,
      sampleRate ? ['Sample rate', `${(sampleRate / 1000).toFixed(1)} kHz`] : null,
      channels ? ['Channels', channels === 2 ? 'Stereo (2ch)' : `${channels} ch`] : null,
      ['File size', fileSize ? formatBytes(fileSize) : '-'],
    ] as const
  ).filter((spec) => spec !== null);

  return (
    <ModalShell onClose={onClose} layer="studio" size="lg" labelledBy={titleId}>
      <ModalHeader
        titleId={titleId}
        title={loc.tagEditor.title}
        subtitle={
          <span className="block truncate" title={filePath}>
            {filePath}
          </span>
        }
        icon={<TagIcon size={20} />}
        tone="purple"
        onClose={onClose}
        closeLabel={loc.common.close}
      />

      <ModalBody>
        {/* Audio format of the file, and AcoustID identification */}
        <Card variant="inset" padding="none" className="mb-4.5 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <dl className="m-0 flex flex-wrap gap-3.5 text-ui text-fg-secondary">
            {specs.map(([label, value]) => (
              <div key={label} className="flex gap-1">
                <dt className="text-fg-muted">{label}:</dt>
                <dd className="m-0 font-bold">{value}</dd>
              </div>
            ))}
          </dl>

          <Button
            variant="tinted"
            tone="purple"
            onClick={handleIdentifyFingerprint}
            disabled={loading || saving || identifying}
            title={loc.tagEditor.acoustIdTooltip}
          >
            {identifying ? <Spinner size="sm" tone="purple" /> : <Sparkles size={15} />}
            {identifying ? loc.tagEditor.identifying : loc.tagEditor.identifyAcoustId}
          </Button>
        </Card>

        {identifyMessage && (
          <Callout tone="green" role="status" icon={<Sparkles size={16} />} className="mb-4 py-2.5 text-ui text-fg">
            {identifyMessage}
          </Callout>
        )}

        {fingerprintMatches.length > 1 && (
          <Callout tone="purple" className="mb-4.5">
            <div className="mb-2 flex items-center gap-1.5 text-ui font-semibold text-accent-purple">
              <TagIcon size={14} />
              {fmt(loc.tagEditor.selectReleaseCandidate, String(fingerprintMatches.length))}
            </div>
            <div className="flex max-h-35 flex-col gap-1.5 overflow-y-auto">
              {fingerprintMatches.map((m, idx) => (
                <OptionCard
                  key={`${m.release_mbid || idx}`}
                  tone="purple"
                  pressed={selectedMatchIndex === idx}
                  onClick={() => {
                    setSelectedMatchIndex(idx);
                    applyCandidate(m);
                  }}
                  className="flex-row items-center justify-between rounded-lg bg-black/35 px-3 py-2 text-ui"
                >
                  <span className="mr-2.5 truncate">
                    <strong>{m.title}</strong> — {m.artist} •{' '}
                    <span className="text-fg-secondary">{m.album || 'Single/Release'}</span> {m.year ? `(${m.year})` : ''}
                  </span>
                  <Badge tone={m.score >= 80 ? 'green' : 'amber'} className="shrink-0">
                    {m.score}% match
                  </Badge>
                </OptionCard>
              ))}
            </div>
          </Callout>
        )}

        {error && (
          <Callout tone="danger" role="alert" icon={<AlertCircle size={18} />} className="mb-4 text-sm text-fg">
            {error}
          </Callout>
        )}

        {loading ? (
          <div className="flex flex-col items-center px-0 py-10">
            <Spinner size="lg" tone="purple" />
            <p className="mt-3 text-sm text-fg-secondary">{loc.tagEditor.reading}</p>
          </div>
        ) : (
          <form id={formId} onSubmit={handleSave} className="grid grid-cols-2 gap-4">
            <TagField id={`${formId}-title`} label={loc.tagEditor.trackTitle} className="col-span-2">
              <TextField id={`${formId}-title`} value={title} onChange={(e) => setTitle(e.target.value)} required />
            </TagField>
            <TagField id={`${formId}-artist`} label={loc.tagEditor.artist}>
              <TextField id={`${formId}-artist`} value={artist} onChange={(e) => setArtist(e.target.value)} required />
            </TagField>
            <TagField id={`${formId}-album-artist`} label={loc.tagEditor.albumArtist}>
              <TextField
                id={`${formId}-album-artist`}
                value={albumArtist}
                onChange={(e) => setAlbumArtist(e.target.value)}
                placeholder={artist}
              />
            </TagField>
            <TagField id={`${formId}-album`} label={loc.tagEditor.albumTitle} className="col-span-2">
              <TextField id={`${formId}-album`} value={album} onChange={(e) => setAlbum(e.target.value)} />
            </TagField>
            <TagField id={`${formId}-year`} label={loc.tagEditor.year}>
              <TextField
                id={`${formId}-year`}
                type="number"
                min={1900}
                max={2099}
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="2024"
              />
            </TagField>
            <TagField id={`${formId}-genre`} label={loc.tagEditor.genre}>
              <TextField
                id={`${formId}-genre`}
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                placeholder="Anime, J-Pop, OST..."
              />
            </TagField>
            <TagField id={`${formId}-track`} label={loc.tagEditor.trackNumber}>
              <NumberPair
                id={`${formId}-track`}
                value={trackNo}
                onChange={setTrackNo}
                total={trackTotal}
                onTotalChange={setTrackTotal}
                totalLabel={loc.tagEditor.trackNumber}
                totalPlaceholder="12"
              />
            </TagField>
            <TagField id={`${formId}-disc`} label={loc.tagEditor.discNumber}>
              <NumberPair
                id={`${formId}-disc`}
                value={discNo}
                onChange={setDiscNo}
                total={discTotal}
                onTotalChange={setDiscTotal}
                totalLabel={loc.tagEditor.discNumber}
                totalPlaceholder="1"
              />
            </TagField>
            <TagField id={`${formId}-comment`} label={loc.tagEditor.comment} className="col-span-2">
              <TextArea
                id={`${formId}-comment`}
                rows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={loc.tagEditor.commentPlaceholder}
                className="resize-none"
              />
            </TagField>
          </form>
        )}
      </ModalBody>

      <ModalFooter>
        <Button onClick={onClose} disabled={saving}>
          {loc.tagEditor.cancel}
        </Button>
        <Button
          type="submit"
          form={formId}
          variant={savedSuccess ? 'tinted' : 'primary'}
          tone="green"
          disabled={loading || saving || savedSuccess}
        >
          {saving ? (
            <>
              <Spinner size="sm" className="text-current" />
              {loc.tagEditor.saving}
            </>
          ) : savedSuccess ? (
            <>
              <Check size={16} />
              {loc.tagEditor.saved}
            </>
          ) : (
            <>
              <Save size={16} />
              {loc.tagEditor.saveToFile}
            </>
          )}
        </Button>
      </ModalFooter>
    </ModalShell>
  );
};
