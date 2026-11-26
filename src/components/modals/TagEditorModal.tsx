import React, { useState, useEffect } from 'react';
import { invoke, errorMessage } from '../../api/ipc';
import {
  X,
  Save,
  Tag as TagIcon,
  Check,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { type Language, getTranslations } from '../../i18n';
import { fmt } from '../../utils/fmt';
import { formatBytes } from '../../utils/fileSizeFormat';
import { cn } from '../../utils/cn';
import { ModalShell } from '../ui';

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

  return (
    <ModalShell
      onClose={onClose}
      layer="studio"
      className="flex max-h-[90vh] max-w-170 flex-col overflow-hidden rounded-2xl border border-accent-purple"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/8 bg-white/2 px-6 py-4.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-purple/20 text-accent-purple">
            <TagIcon size={20} />
          </div>
          <div>
            <h2 className="m-0 text-lg font-bold text-fg">
              {loc.tagEditor.title}
            </h2>
            <p
              className="mx-0 mt-0.5 mb-0 max-w-120 truncate text-xs text-fg-secondary"
              title={filePath}
            >
              {filePath}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex items-center justify-center rounded-lg border-0 bg-transparent p-1.5 text-fg-secondary"
        >
          <X size={20} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {/* File Audio Specs Banner & AcoustID Trigger */}
        <div
          className="mb-4.5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/8 bg-black/30 px-4 py-3"
        >
          <div className="flex flex-wrap gap-3.5 text-ui text-slate-300">
            <div>
              <span className="text-fg-muted">Format: </span>
              <strong>{format?.toUpperCase() || 'AUDIO'}</strong>
            </div>
            {bitDepth && (
              <div>
                <span className="text-fg-muted">Bit depth: </span>
                <strong>{bitDepth}-bit</strong>
              </div>
            )}
            {sampleRate && (
              <div>
                <span className="text-fg-muted">Sample rate: </span>
                <strong>{(sampleRate / 1000).toFixed(1)} kHz</strong>
              </div>
            )}
            {channels && (
              <div>
                <span className="text-fg-muted">Channels: </span>
                <strong>{channels === 2 ? 'Stereo (2ch)' : `${channels} ch`}</strong>
              </div>
            )}
            <div>
              <span className="text-fg-muted">File size: </span>
              <strong>{(fileSize ? formatBytes(fileSize) : '-')}</strong>
            </div>
          </div>

          <button
            type="button"
            onClick={handleIdentifyFingerprint}
            disabled={loading || saving || identifying}
            className={cn(
              'flex items-center gap-2 rounded-lg border border-accent-purple/45 bg-linear-135 from-accent-purple/25 to-pink-500/25 px-3.5 py-2 text-ui font-semibold text-fg shadow-lg shadow-accent-purple/20 transition-all duration-200',
              loading || saving || identifying ? 'cursor-default' : 'cursor-pointer',
            )}
            title={loc.tagEditor.acoustIdTooltip}
          >
            {identifying ? (
              <>
                <Loader2 size={15} className="animate-spin text-purple-400" />
                <span>{loc.tagEditor.identifying}</span>
              </>
            ) : (
              <>
                <Sparkles size={15} className="text-fuchsia-400" />
                <span>{loc.tagEditor.identifyAcoustId}</span>
              </>
            )}
          </button>
        </div>

        {identifyMessage && (
          <div
            className="mb-4 flex items-center gap-2 rounded-lg border border-accent-green/40 bg-accent-green/15 px-3.5 py-2.5 text-ui text-emerald-300"
          >
            <Sparkles size={16} />
            <span>{identifyMessage}</span>
          </div>
        )}

        {fingerprintMatches.length > 1 && (
          <div className="mb-4.5 rounded-xl border border-accent-purple/25 bg-accent-purple/8 px-3.5 py-3">
            <div className="mb-2 flex items-center gap-1.5 text-ui font-semibold text-purple-300">
              <TagIcon size={14} />
              <span>
                {fmt(loc.tagEditor.selectReleaseCandidate, String(fingerprintMatches.length))}
              </span>
            </div>
            <div className="flex max-h-35 flex-col gap-1.5 overflow-y-auto">
              {fingerprintMatches.map((m, idx) => (
                <button
                  key={`${m.release_mbid || idx}`}
                  type="button"
                  onClick={() => {
                    setSelectedMatchIndex(idx);
                    applyCandidate(m);
                  }}
                  className={cn(
                    'flex items-center justify-between rounded-lg border px-3 py-2 text-left text-ui text-fg transition-colors duration-150',
                    selectedMatchIndex === idx ? 'bg-accent-purple/30' : 'bg-black/35',
                    selectedMatchIndex === idx ? 'border-accent-purple' : 'border-white/8',
                  )}
                >
                  <div className="mr-2.5 truncate">
                    <strong>{m.title}</strong> — {m.artist} • <span className="text-slate-300">{m.album || 'Single/Release'}</span> {m.year ? `(${m.year})` : ''}
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-xl border px-2 py-0.5 text-xs font-semibold',
                      m.score >= 80 ? 'bg-accent-green/20' : 'bg-yellow-500/20',
                      m.score >= 80 ? 'text-emerald-400' : 'text-yellow-400',
                      m.score >= 80 ? 'border-accent-green/30' : 'border-yellow-500/30',
                    )}
                  >
                    {m.score}% match
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div
            className="mb-4 flex items-center gap-2 rounded-lg border border-accent-red/40 bg-accent-red/15 px-3.5 py-3 text-sm text-red-300"
          >
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="px-0 py-10 text-center text-accent-purple">
            <Loader2 size={32} className="animate-spin" />
            <p className="mt-3 text-sm text-fg-secondary">
              {loc.tagEditor.reading}
            </p>
          </div>
        ) : (
          <form id="tag-editor-form" onSubmit={handleSave}>
            <div className="grid grid-cols-2 gap-4">
              {/* Title */}
              <div className="col-span-2">
                <label className="mb-1.5 block text-ui font-semibold text-slate-200">
                  {loc.tagEditor.trackTitle}
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full rounded-lg border border-white/15 bg-black/35 px-3 py-2.5 text-sm text-fg outline-none"
                />
              </div>

              {/* Artist */}
              <div>
                <label className="mb-1.5 block text-ui font-semibold text-slate-200">
                  {loc.tagEditor.artist}
                </label>
                <input
                  type="text"
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  required
                  className="w-full rounded-lg border border-white/15 bg-black/35 px-3 py-2.5 text-sm text-fg outline-none"
                />
              </div>

              {/* Album Artist */}
              <div>
                <label className="mb-1.5 block text-ui font-semibold text-slate-200">
                  {loc.tagEditor.albumArtist}
                </label>
                <input
                  type="text"
                  value={albumArtist}
                  onChange={(e) => setAlbumArtist(e.target.value)}
                  placeholder={artist}
                  className="w-full rounded-lg border border-white/15 bg-black/35 px-3 py-2.5 text-sm text-fg outline-none"
                />
              </div>

              {/* Album */}
              <div className="col-span-2">
                <label className="mb-1.5 block text-ui font-semibold text-slate-200">
                  {loc.tagEditor.albumTitle}
                </label>
                <input
                  type="text"
                  value={album}
                  onChange={(e) => setAlbum(e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-black/35 px-3 py-2.5 text-sm text-fg outline-none"
                />
              </div>

              {/* Year / release year */}
              <div>
                <label className="mb-1.5 block text-ui font-semibold text-slate-200">
                  {loc.tagEditor.year}
                </label>
                <input
                  type="number"
                  min="1900"
                  max="2099"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="2024"
                  className="w-full rounded-lg border border-white/15 bg-black/35 px-3 py-2.5 text-sm text-fg outline-none"
                />
              </div>

              {/* Genre */}
              <div>
                <label className="mb-1.5 block text-ui font-semibold text-slate-200">
                  {loc.tagEditor.genre}
                </label>
                <input
                  type="text"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  placeholder="Anime, J-Pop, OST..."
                  className="w-full rounded-lg border border-white/15 bg-black/35 px-3 py-2.5 text-sm text-fg outline-none"
                />
              </div>

              {/* Track number and total */}
              <div>
                <label className="mb-1.5 block text-ui font-semibold text-slate-200">
                  {loc.tagEditor.trackNumber}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={trackNo}
                    onChange={(e) => setTrackNo(e.target.value)}
                    placeholder="1"
                    className="flex-1 rounded-lg border border-white/15 bg-black/35 px-3 py-2.5 text-sm text-fg outline-none"
                  />
                  <span className="text-fg-muted">/</span>
                  <input
                    type="number"
                    min="1"
                    value={trackTotal}
                    onChange={(e) => setTrackTotal(e.target.value)}
                    placeholder="12"
                    className="flex-1 rounded-lg border border-white/15 bg-black/35 px-3 py-2.5 text-sm text-fg outline-none"
                  />
                </div>
              </div>

              {/* Disc number and total */}
              <div>
                <label className="mb-1.5 block text-ui font-semibold text-slate-200">
                  {loc.tagEditor.discNumber}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={discNo}
                    onChange={(e) => setDiscNo(e.target.value)}
                    placeholder="1"
                    className="flex-1 rounded-lg border border-white/15 bg-black/35 px-3 py-2.5 text-sm text-fg outline-none"
                  />
                  <span className="text-fg-muted">/</span>
                  <input
                    type="number"
                    min="1"
                    value={discTotal}
                    onChange={(e) => setDiscTotal(e.target.value)}
                    placeholder="1"
                    className="flex-1 rounded-lg border border-white/15 bg-black/35 px-3 py-2.5 text-sm text-fg outline-none"
                  />
                </div>
              </div>

              {/* Comment */}
              <div className="col-span-2">
                <label className="mb-1.5 block text-ui font-semibold text-slate-200">
                  {loc.tagEditor.comment}
                </label>
                <textarea
                  rows={2}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={loc.tagEditor.commentPlaceholder}
                  className="w-full resize-none rounded-lg border border-white/15 bg-black/35 px-3 py-2.5 text-sm text-fg outline-none"
                />
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 border-t border-white/8 bg-white/2 px-6 py-3.5">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="rounded-lg border border-white/15 bg-transparent px-4.5 py-2.5 text-sm font-semibold text-slate-300"
        >
          {loc.tagEditor.cancel}
        </button>

        <button
          type="submit"
          form="tag-editor-form"
          disabled={loading || saving || savedSuccess}
          className={cn(
            'flex items-center gap-2 rounded-lg border-0 px-5.5 py-2.5 text-sm font-semibold text-fg shadow-lift shadow-accent-purple/35 transition-all duration-200',
            savedSuccess ? 'bg-accent-green' : 'bg-linear-135 from-accent-purple to-accent-pink',
            loading || saving || savedSuccess ? 'cursor-default' : 'cursor-pointer',
          )}
        >
          {saving ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>{loc.tagEditor.saving}</span>
            </>
          ) : savedSuccess ? (
            <>
              <Check size={16} />
              <span>{loc.tagEditor.saved}</span>
            </>
          ) : (
            <>
              <Save size={16} />
              <span>{loc.tagEditor.saveToFile}</span>
            </>
          )}
        </button>
      </div>
    </ModalShell>
  );
};
